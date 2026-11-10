import { z } from "zod";
import { momentSchema, environments } from "./moments.js";
import {
  isCanonicalTimedPractice,
  isTimedPracticeId,
} from "./timed-practice-contract.js";
import { planFocuses, planMinutes } from "./wellness-plans.js";
import { MESSAGE_MAX_LENGTH } from "./ai.js";
import { chatPracticeIds } from "./chat-practice.js";
import { chatEvidenceKinds } from "./chat-evidence.js";
import { weeklyPeriodSchema } from "./weekly.js";
import { ambientTracks } from "./ambient-contract.js";
import { ritualActivities, ritualDurations } from "./ritual-contract.js";
import { emotionalRecheckResponses } from "./practice-recheck.js";
import {
  MAX_JOURNAL_TAG_LENGTH,
  MAX_JOURNAL_TAGS,
} from "./journal-contract.js";
import {
  goalMetrics,
  goalPeriods,
  goalTargetBounds,
  validGoalTarget,
} from "./goal-contract.js";

export const collections = [
  "checkins",
  "conversations",
  "sessions",
  "reflections",
  "assessments",
  "memories",
  "reminders",
  "plans",
  "favorites",
  "preferences",
  "goals",
] as const;
export type Collection = (typeof collections)[number];
export const collectionSchema = z.enum(collections);
export const idSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9_-]+$/);
const text = z.string().trim().max(10000);
const shortText = z.string().trim().max(200);
const duration = z.number().min(0).max(7200);
const isoDate = z
  .string()
  .datetime({ offset: true })
  .refine((value) => Number.isFinite(Date.parse(value)), "Enter a valid date.");
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const d = new Date(value + "T12:00:00Z");
    return (
      Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value
    );
  }, "Enter a valid calendar day.");
const base = z
  .object({
    id: idSchema.optional(),
    createdAt: isoDate.optional(),
    updatedAt: isoDate.optional(),
    day: day.optional(),
  })
  .passthrough();
const journalEntry = base.extend({
  kind: z.literal("journal"),
  title: z.string().trim().max(240).optional(),
  text: z
    .string()
    .refine(
      (value) => value.trim().length > 0,
      "Write an entry before saving.",
    ),
  mood: z
    .enum(["Okay", "Calm", "Low", "Stressed", "Great"])
    .nullable()
    .optional(),
  tags: z
    .array(z.string().trim().min(1).max(MAX_JOURNAL_TAG_LENGTH))
    .max(MAX_JOURNAL_TAGS)
    .optional(),
  bookmarked: z.boolean().optional(),
  weeklyPeriod: z.never().optional(),
  weeklyProvider: z.never().optional(),
});
export const registerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((x) => x.toLowerCase()),
  password: z.string().min(8).max(128),
});
export const loginSchema = registerSchema.omit({ name: true });
export const conversationTitle = z.string().trim().min(1).max(160);
const goalBase = base.extend({
  title: z.string().trim().min(1).max(120),
  active: z.boolean().default(true),
});
const legacyGoalTarget = z.number().int().min(5).max(210);
const volume = z.number().int().min(0).max(100);
const ambientMixRecord = base
  .extend({
    id: z.literal("ambient-mix"),
    volumes: z
      .object(Object.fromEntries(ambientTracks.map((track) => [track, volume])))
      .strict(),
    masterVolume: volume,
    timerMinutes: z.union([
      z.literal(0),
      z.literal(15),
      z.literal(30),
      z.literal(60),
    ]),
  })
  .strict();
const planTaskRecord = z
  .object({
    id: shortText.optional(),
    title: z.string().trim().min(1).max(200),
    description: z.string().max(1000).optional(),
    action: z.string().max(80).optional(),
    completed: z.boolean().optional(),
    focus: z.enum(planFocuses).optional(),
    minutes: z.literal(planMinutes).optional(),
  })
  .passthrough();
const planRecord = base
  .extend({
    type: z.enum(["wellness", "affirmation", "challenge"]).optional(),
    title: z.string().max(200).optional(),
    text: text.optional(),
    completed: z.boolean().optional(),
    tasks: z.array(planTaskRecord).max(100).optional(),
    programId: idSchema.optional(),
    goal: z.enum(planFocuses).optional(),
    preferredFocuses: z
      .array(z.enum(planFocuses))
      .max(planFocuses.length)
      .optional(),
    dailyMinutes: z.literal(planMinutes).optional(),
    startedAt: isoDate.optional(),
  })
  .superRefine((plan, context) => {
    const tasks = plan.tasks ?? [];
    const configured =
      plan.programId !== undefined ||
      plan.goal !== undefined ||
      plan.preferredFocuses !== undefined ||
      plan.dailyMinutes !== undefined ||
      tasks.some(
        (task) => task.focus !== undefined || task.minutes !== undefined,
      );
    if (!configured) return;
    const invalidTask = tasks.some(
      (task) =>
        !idSchema.safeParse(task.id).success ||
        task.focus === undefined ||
        task.minutes === undefined ||
        !!task.action ||
        task.completed === true,
    );
    if (
      plan.type !== "wellness" ||
      !plan.title?.trim() ||
      !tasks.length ||
      invalidTask ||
      new Set(tasks.map((task) => task.id)).size !== tasks.length ||
      plan.completed === true ||
      (plan.programId
        ? !plan.startedAt ||
          !!plan.goal ||
          !!plan.preferredFocuses ||
          !!plan.dailyMinutes
        : !plan.goal ||
          !plan.dailyMinutes ||
          tasks.length !== 3 ||
          tasks.some((task) => task.minutes !== plan.dailyMinutes) ||
          new Set(plan.preferredFocuses).size !==
            (plan.preferredFocuses?.length ?? 0))
    )
      context.addIssue({
        code: "custom",
        path: ["tasks"],
        message:
          "Choose a valid wellness plan with one registered practice per day.",
      });
  });
const recordSchemas: Record<Collection, z.ZodTypeAny> = {
  preferences: z.union([
    ambientMixRecord,
    base
      .extend({
        id: z.literal("wellness"),
        environment: z.enum(environments).optional(),
        ambientEnabled: z.boolean().optional(),
        streaksEnabled: z.boolean().optional(),
        dailyRitual: z
          .object({
            enabled: z.boolean(),
            day,
            skipPractice: z.boolean(),
            activity: z.enum(ritualActivities).optional(),
            durationMinutes: z.literal(ritualDurations).optional(),
          })
          .strict()
          .optional(),
      })
      .strict(),
  ]),
  goals: z.union([
    goalBase
      .extend({
        metric: z.enum(goalMetrics),
        period: z.enum(goalPeriods),
        target: z.number().int(),
        // The generic PATCH merges old fields before validating the record.
        targetMinutesPerWeek: legacyGoalTarget.optional(),
      })
      .strict()
      .superRefine(({ metric, period, target }, context) => {
        if (validGoalTarget(metric, period, target)) return;
        const { min, max } = goalTargetBounds(metric, period);
        context.addIssue({
          code: "custom",
          path: ["target"],
          message: `Choose a whole number from ${min} to ${max}.`,
        });
      })
      .transform(({ targetMinutesPerWeek, ...record }) => record),
    goalBase.extend({ targetMinutesPerWeek: legacyGoalTarget }).strict(),
  ]),
  favorites: base
    .extend({
      kind: z.enum(["resource", "breathing", "reflection", "grounding"]),
      targetId: z.string().trim().min(1).max(80),
      title: z.string().trim().min(1).max(120),
    })
    .strict()
    .superRefine((record, context) => {
      const valid =
        record.kind === "resource"
          ? [
              "mindfulness",
              "anxiety",
              "low-mood",
              "self-esteem",
              "sleep",
            ].includes(record.targetId)
          : record.targetId === record.kind;
      if (!valid)
        context.addIssue({
          code: "custom",
          path: ["targetId"],
          message: "Choose an available toolkit practice.",
        });
    }),
  checkins: base.extend({
    mood: z.union([z.string().min(1).max(40), z.number().min(1).max(5)]),
    note: text.optional(),
    tags: z.array(z.string().max(40)).max(15).optional(),
  }),
  conversations: base.extend({
    contextResetMessageCount: z.number().int().min(0).max(200).optional(),
    contextResetAt: isoDate.optional(),
    contextResetId: idSchema.optional(),
    title: conversationTitle.optional(),
    messages: z
      .array(
        z.object({
          id: idSchema.optional(),
          role: z.enum(["user", "assistant"]),
          content: z.string().min(1).max(MESSAGE_MAX_LENGTH),
          createdAt: z.string().optional(),
          provider: z.enum(["live", "offline"]).optional(),
          action: z
            .object({
              type: z.enum(chatPracticeIds),
              label: z.string().trim().min(1).max(200),
              explanation: z
                .discriminatedUnion("basis", [
                  z.object({ basis: z.enum(["general", "conversation"]) }),
                  z.object({
                    basis: z.literal("personalized"),
                    evidence: z.object({
                      kind: z.enum(chatEvidenceKinds),
                      id: idSchema,
                      revision: isoDate,
                    }),
                  }),
                ])
                .optional(),
            })
            .optional(),
          support: z.boolean().optional(),
          safety: z.boolean().optional(),
        }),
      )
      .max(200)
      .optional(),
  }),
  sessions: base.extend({
    kind: z.enum(["generated"]).optional(),
    activity: z
      .union([
        momentSchema.refine((activity) => !isTimedPracticeId(activity.id)),
        z.custom(isCanonicalTimedPractice),
      ])
      .optional(),
    environment: z.enum(environments).optional(),
    provider: z.enum(["live", "offline"]).optional(),
    type: shortText.optional(),
    title: shortText.optional(),
    resourceId: idSchema.optional(),
    duration: duration.optional(),
    durationSeconds: duration.optional(),
    durationSec: duration.optional(),
    plannedDurationSec: duration.optional(),
    feedback: z
      .enum(["Helped", "A little", "Not for me", "skipped"])
      .optional(),
    note: text.optional(),
    source: shortText.optional(),
    planId: idSchema.optional(),
    planTaskId: idSchema.optional(),
    steps: z.array(z.number().int().min(0).max(99)).max(100).optional(),
    completed: z.boolean().optional(),
    practiceId: idSchema.optional(),
    originCheckinId: idSchema.optional(),
    originActionId: idSchema.optional(),
    sourceConversationId: idSchema.nullable().optional(),
    startedAt: isoDate.optional(),
    endedAt: isoDate.optional(),
    outcome: z
      .enum(["completed", "early-exit", "interrupted", "failed"])
      .optional(),
    emotionalRecheck: z
      .object({
        response: z.enum(emotionalRecheckResponses),
        recordedAt: isoDate,
      })
      .strict()
      .optional(),
  }),
  reflections: base.extend({
    text: text.optional(),
    content: text.optional(),
    note: text.optional(),
    need: text.optional(),
    weeklyPeriod: weeklyPeriodSchema.optional(),
    weeklyProvider: z.enum(["live", "offline"]).optional(),
    answers: z
      .union([z.array(text).max(10), z.record(z.string(), text)])
      .optional(),
  }),
  assessments: base.extend({
    type: shortText.optional(),
    assessmentType: shortText.optional(),
    title: shortText.optional(),
    answers: z
      .array(z.union([z.number().min(0).max(10), z.string().max(200)]))
      .max(40)
      .optional(),
    score: z.number().min(0).max(1000).optional(),
    summary: z
      .object({ score: z.number().optional() })
      .passthrough()
      .optional(),
  }),
  memories: base.extend({
    category: z.enum(["preference", "activity", "goal", "context"]).optional(),
    text: text.optional(),
    content: text.optional(),
    value: text.optional(),
    approved: z.boolean().optional(),
    sourceConversationId: idSchema.nullable().optional(),
    sourceType: z.enum(["session", "conversation"]).optional(),
    sourceId: idSchema.optional(),
  }),
  reminders: base.extend({
    type: z
      .enum(["checkin", "affirmation", "breathing", "selfcare", "custom"])
      .optional(),
    title: z.string().max(140).optional(),
    enabled: z.boolean().optional(),
    hour: z.number().int().min(0).max(23).optional(),
    minute: z.number().int().min(0).max(59).optional(),
    days: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
    time: z.string().max(20).optional(),
    notificationIds: z.array(z.string().max(200)).max(7).optional(),
    permission: z.string().max(50).optional(),
  }),
  plans: planRecord,
};
export function parseRecord(collection: Collection, value: unknown) {
  const schema =
    collection === "reflections" &&
    (value as { kind?: unknown } | null | undefined)?.kind === "journal"
      ? journalEntry
      : recordSchemas[collection];
  const parsed = schema.parse(value) as Record<string, unknown>;
  if (JSON.stringify(parsed).length > 100000)
    throw new Error("RECORD_TOO_LARGE");
  if (
    collection === "memories" &&
    ![parsed.text, parsed.content, parsed.value].some(
      (x) => typeof x === "string" && x.trim(),
    )
  ) {
    throw new z.ZodError([
      {
        code: "custom",
        path: ["text"],
        message: "Enter a preference to remember.",
      },
    ]);
  }
  if (
    collection === "reflections" &&
    ![parsed.text, parsed.content, parsed.note].some(
      (x) => typeof x === "string" && x.trim(),
    ) &&
    !parsed.answers
  ) {
    throw new z.ZodError([
      {
        code: "custom",
        path: ["text"],
        message: "Write a reflection before saving.",
      },
    ]);
  }
  if (
    collection === "reflections" &&
    parsed.weeklyProvider !== undefined &&
    parsed.weeklyPeriod === undefined
  ) {
    throw new z.ZodError([
      {
        code: "custom",
        path: ["weeklyPeriod"],
        message: "Choose the week for an assisted reflection.",
      },
    ]);
  }
  if (
    collection === "sessions" &&
    parsed.kind === "generated" &&
    !parsed.activity
  ) {
    throw new z.ZodError([
      {
        code: "custom",
        path: ["activity"],
        message: "A generated session needs its validated activity snapshot.",
      },
    ]);
  }
  if (
    collection === "sessions" &&
    (parsed.planId === undefined) !== (parsed.planTaskId === undefined)
  )
    throw new z.ZodError([
      {
        code: "custom",
        path: ["planTaskId"],
        message: "A plan completion needs both its plan and day.",
      },
    ]);
  if (collection === "sessions") {
    const issue = (path: string, message: string) => {
      throw new z.ZodError([{ code: "custom", path: [path], message }]);
    };
    const seconds = Number(
      parsed.durationSec ?? parsed.durationSeconds ?? parsed.duration ?? 0,
    );
    const started =
      typeof parsed.startedAt === "string"
        ? Date.parse(parsed.startedAt)
        : undefined;
    const ended =
      typeof parsed.endedAt === "string"
        ? Date.parse(parsed.endedAt)
        : undefined;
    const recheck = parsed.emotionalRecheck as
      { recordedAt: string } | undefined;
    if (
      (started === undefined) !== (ended === undefined) ||
      (started !== undefined &&
        ended !== undefined &&
        (ended < started || seconds * 1000 > ended - started + 1000))
    )
      issue(
        "endedAt",
        "Enter a valid start, finish, and active practice duration.",
      );
    if (
      parsed.outcome !== undefined &&
      (parsed.outcome === "completed") !== (parsed.completed === true)
    )
      issue("outcome", "The session result must match its completion status.");
    if (
      recheck &&
      (parsed.completed !== true ||
        parsed.type === "resource" ||
        seconds <= 0 ||
        (ended !== undefined && Date.parse(recheck.recordedAt) < ended))
    )
      issue(
        "emotionalRecheck",
        "A check-in after practice needs a completed practice and a later response time.",
      );
  }
  return parsed;
}
