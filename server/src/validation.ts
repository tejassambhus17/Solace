import { z } from "zod";

export const collections = [
  "checkins",
  "conversations",
  "sessions",
  "reflections",
  "assessments",
  "memories",
  "reminders",
  "plans",
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
const recordSchemas: Record<Collection, z.ZodTypeAny> = {
  checkins: base.extend({
    mood: z.union([z.string().min(1).max(40), z.number().min(1).max(5)]),
    note: text.optional(),
    tags: z.array(z.string().max(40)).max(15).optional(),
  }),
  conversations: base.extend({
    title: z.string().trim().min(1).max(160).optional(),
    messages: z
      .array(
        z.object({
          id: idSchema.optional(),
          role: z.enum(["user", "assistant"]),
          content: z.string().min(1).max(10000),
          createdAt: z.string().optional(),
          provider: z.enum(["live", "offline"]).optional(),
          action: z
            .object({
              type: z.enum(["breathing", "reflection"]),
              label: z.string().trim().min(1).max(200),
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
    steps: z.array(z.number().int().min(0).max(99)).max(100).optional(),
    completed: z.boolean().optional(),
  }),
  reflections: base.extend({
    text: text.optional(),
    content: text.optional(),
    note: text.optional(),
    need: text.optional(),
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
  plans: base.extend({
    type: z.enum(["wellness", "affirmation", "challenge"]).optional(),
    title: z.string().max(200).optional(),
    text: text.optional(),
    completed: z.boolean().optional(),
    tasks: z
      .array(
        z
          .object({
            id: shortText.optional(),
            title: z.string().trim().min(1).max(200),
            description: z.string().max(1000).optional(),
            action: z.string().max(80).optional(),
            completed: z.boolean().optional(),
          })
          .passthrough(),
      )
      .max(100)
      .optional(),
  }),
};
export function parseRecord(collection: Collection, value: unknown) {
  const parsed = recordSchemas[collection].parse(value) as Record<
    string,
    unknown
  >;
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
  return parsed;
}
