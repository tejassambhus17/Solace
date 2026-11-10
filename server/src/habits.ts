import { Router, type Request, type Response } from "express";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import type { Store } from "./database.js";
import {
  addHabitDays,
  habitCategories,
  habitColors,
  habitDay,
  habitIcons,
  habitRevisionOn,
  habitStatuses,
  habitTarget,
  isHabitScheduled,
  type Habit,
  type HabitDraft,
  type HabitGarden,
  type HabitProgress,
} from "./habit-contract.js";
import { idSchema } from "./validation.js";
import { calendarDay, weeklyTimeZone } from "./weekly.js";
import {
  advanceGarden,
  creditGardenHabit,
  gardenState,
  saveGardenChoice,
  sessionHasGardenCredit,
} from "./garden-intentions.js";

const goalSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("completion") }),
  z.strictObject({
    type: z.literal("quantity"),
    target: z.number().int().min(1).max(1000),
    unit: z.string().trim().min(1).max(28),
  }),
  z.strictObject({
    type: z.literal("duration"),
    target: z.number().int().min(1).max(720),
  }),
]);
const scheduleSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("daily") }),
  z.strictObject({
    type: z.literal("weekdays"),
    days: z
      .array(z.number().int().min(0).max(6))
      .min(1)
      .max(7)
      .refine(
        (days) => new Set(days).size === days.length,
        "Choose each day once.",
      )
      .transform((days) => days.slice().sort((a, b) => a - b)),
  }),
  z.strictObject({
    type: z.literal("weekly"),
    daysPerWeek: z.number().int().min(1).max(7),
  }),
]);
const habitFields = {
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(280).optional(),
  category: z.enum(habitCategories),
  icon: z.enum(habitIcons),
  color: z.enum(habitColors),
  goal: goalSchema,
  schedule: scheduleSchema,
  reminderTime: z
    .string()
    .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
    .nullable(),
  activity: z.literal("breathing").optional(),
};
const validActivity = ({ activity, goal }: HabitDraft) =>
  activity === undefined || goal.type === "duration";
const activityError = {
  path: ["activity"],
  message: "Link a breathing practice to a minutes goal.",
};
export const habitDraftSchema = z
  .strictObject(habitFields)
  .refine(validActivity, activityError);
const createSchema = z
  .strictObject({ ...habitFields, id: idSchema, timeZone: weeklyTimeZone })
  .refine(validActivity, activityError);
const editSchema = z
  .strictObject({
    draft: habitDraftSchema.optional(),
    status: z.enum(habitStatuses).optional(),
    expectedRevision: z.number().int().min(1),
  })
  .refine(({ draft, status }) => draft !== undefined || status !== undefined);
const progressSchema = z.strictObject({
  day: calendarDay,
  amount: z.number().int().min(0).max(10_000),
  expectedRevision: z.number().int().min(0),
  sessionId: idSchema.optional(),
});
const intentionSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.enum(["calming", "breathing", "sleep", "journal"]),
    timeZone: weeklyTimeZone,
  }),
  z.strictObject({
    kind: z.literal("habit"),
    habitId: idSchema,
    timeZone: weeklyTimeZone,
  }),
]);

const collections = {
  habits: "habits",
  progress: "habitProgress",
  garden: "habitGarden",
  claims: "habitActivityClaims",
  tombstones: "habitDeletionReceipts",
} as const;
type HabitCollection = (typeof collections)[keyof typeof collections];
type HabitRecord = { id: string; createdAt: string };
type ActivityClaim = HabitRecord & { habitId?: string; day?: string };

function list<T>(
  store: Store,
  owner: string,
  collection: HabitCollection,
): T[] {
  return store
    .all<{ json: string }>(
      "SELECT json FROM records WHERE user_id=? AND collection=? ORDER BY created_at DESC, id DESC",
      [owner, collection],
    )
    .map(({ json }) => JSON.parse(json) as T);
}

function get<T>(
  store: Store,
  owner: string,
  collection: HabitCollection | "sessions",
  id: string,
) {
  const row = store.one<{ json: string }>(
    "SELECT json FROM records WHERE user_id=? AND collection=? AND id=?",
    [owner, collection, id],
  );
  return row && (JSON.parse(row.json) as T);
}

function put<T extends HabitRecord>(
  store: Store,
  owner: string,
  collection: HabitCollection,
  record: T,
) {
  store.run(
    "INSERT INTO records(id,user_id,collection,json,created_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,collection,id) DO UPDATE SET json=excluded.json",
    [record.id, owner, collection, JSON.stringify(record), record.createdAt],
  );
}

export function habitState(store: Store, owner: string) {
  return {
    habits: list<Habit>(store, owner, collections.habits),
    habitProgress: list<HabitProgress>(store, owner, collections.progress),
    ...gardenState(store, owner),
  };
}

function draftOf(habit: Habit): HabitDraft {
  const {
    name,
    description,
    category,
    icon,
    color,
    goal,
    schedule,
    reminderTime,
    activity,
  } = habit;
  return {
    name,
    ...(description ? { description } : {}),
    category,
    icon,
    color,
    goal,
    schedule,
    reminderTime,
    ...(activity ? { activity } : {}),
  };
}

function cleanDraft(draft: HabitDraft): HabitDraft {
  const { description, ...fields } = draft;
  return { ...fields, ...(description ? { description } : {}) };
}

const progressId = (habitId: string, day: string) => `${habitId}-${day}`;
const failure = (
  response: Response,
  status: number,
  message: string,
  code: string,
) => response.status(status).json({ error: message, code });
const missing = (response: Response) =>
  failure(response, 404, "This habit could not be found.", "HABIT_NOT_FOUND");
const conflict = (response: Response) =>
  failure(
    response,
    409,
    "This habit changed. Refresh and try again.",
    "HABIT_CONFLICT",
  );

export function habitRoutes(
  store: Store,
  ownerFor: (request: Request) => string,
) {
  const router = Router();

  router.get("/", (request, response) =>
    response.json(habitState(store, ownerFor(request))),
  );

  router.get("/garden-intention", (request, response) =>
    response.json(gardenState(store, ownerFor(request))),
  );
  router.put("/garden-intention", (request, response) => {
    const owner = ownerFor(request);
    const { timeZone, ...choice } = intentionSchema.parse(request.body);
    const error = saveGardenChoice(store, owner, choice, timeZone);
    return error
      ? failure(response, 409, error, "GARDEN_INTENTION_UNAVAILABLE")
      : response.json(gardenState(store, owner));
  });

  router.post("/", (request, response) => {
    const owner = ownerFor(request);
    const { id, timeZone, ...rawDraft } = createSchema.parse(request.body);
    const draft = cleanDraft(rawDraft);
    if (get(store, owner, collections.tombstones, id))
      return conflict(response);
    const previous = get<Habit>(store, owner, collections.habits, id);
    if (previous) {
      return previous.timeZone === timeZone &&
        isDeepStrictEqual(draftOf(previous), draft)
        ? response.json({ habit: previous })
        : conflict(response);
    }
    const count = store.one<{ total: number }>(
      "SELECT COUNT(*) AS total FROM records WHERE user_id=? AND collection=?",
      [owner, collections.habits],
    )?.total;
    if ((count ?? 0) >= 100)
      return failure(
        response,
        409,
        "Your library holds up to 100 habits.",
        "HABIT_LIMIT",
      );
    const now = new Date();
    const timestamp = now.toISOString();
    const habit: Habit = {
      ...draft,
      id,
      timeZone,
      createdAt: timestamp,
      updatedAt: timestamp,
      status: "active",
      revision: 1,
      revisions: [
        {
          day: habitDay(timeZone, now),
          status: "active",
          goal: draft.goal,
          schedule: draft.schedule,
          activity: draft.activity,
        },
      ],
    };
    store.transaction(() => put(store, owner, collections.habits, habit));
    return response.status(201).json({ habit });
  });

  router.patch("/:id", (request, response) => {
    const owner = ownerFor(request);
    const id = idSchema.parse(request.params.id);
    const input = editSchema.parse(request.body);
    const previous = get<Habit>(store, owner, collections.habits, id);
    if (!previous) return missing(response);
    const currentDraft = draftOf(previous);
    const draft = input.draft ? cleanDraft(input.draft) : currentDraft;
    const status = input.status ?? previous.status;
    if (status === previous.status && isDeepStrictEqual(draft, currentDraft))
      return response.json({ habit: previous });
    if (input.expectedRevision !== previous.revision) return conflict(response);
    const now = new Date();
    let revisions = previous.revisions;
    if (
      status !== previous.status ||
      !isDeepStrictEqual(draft.schedule, previous.schedule) ||
      !isDeepStrictEqual(draft.goal, previous.goal) ||
      draft.activity !== previous.activity
    ) {
      const today = habitDay(previous.timeZone, now);
      const lockedDay = get<HabitProgress>(
        store,
        owner,
        collections.progress,
        progressId(id, today),
      );
      const effectiveDay = lockedDay ? addHabitDays(today, 1) : today;
      revisions = [
        ...revisions.filter(({ day }) => day < effectiveDay),
        {
          day: effectiveDay,
          status,
          goal: draft.goal,
          schedule: draft.schedule,
          activity: draft.activity,
        },
      ];
    }
    const habit: Habit = {
      ...previous,
      ...draft,
      description: draft.description,
      activity: draft.activity,
      status,
      revisions,
      updatedAt: now.toISOString(),
      revision: previous.revision + 1,
    };
    store.transaction(() => put(store, owner, collections.habits, habit));
    return response.json({ habit });
  });

  router.put("/:id/progress", (request, response) => {
    const owner = ownerFor(request);
    const habitId = idSchema.parse(request.params.id);
    const { day, amount, expectedRevision, sessionId } = progressSchema.parse(
      request.body,
    );
    const habit = get<Habit>(store, owner, collections.habits, habitId);
    if (!habit) return missing(response);
    const id = progressId(habitId, day);
    const previous = get<HabitProgress>(store, owner, collections.progress, id);
    const garden = get<HabitGarden>(store, owner, collections.garden, "garden");
    const now = new Date();
    const today = habitDay(habit.timeZone, now);
    const revision = habitRevisionOn(habit, day);
    if (sessionId) {
      const claim = get<ActivityClaim>(
        store,
        owner,
        collections.claims,
        sessionId,
      );
      if (claim)
        return claim.habitId === habitId && claim.day === day && previous
          ? response.json({
              progress: previous,
              garden,
              ...gardenState(store, owner),
            })
          : failure(
              response,
              409,
              "This practice already counted toward a habit.",
              "HABIT_PRACTICE_USED",
            );
    }
    if (!sessionId && previous?.amount === amount)
      return response.json({
        progress: previous,
        garden,
        ...gardenState(store, owner),
      });
    if (
      !revision ||
      !isHabitScheduled(habit, day) ||
      day > today ||
      (!previous && (day < today || habit.status !== "active"))
    )
      return failure(
        response,
        400,
        "You can log today’s scheduled habit or correct an existing entry.",
        "HABIT_DAY_UNAVAILABLE",
      );
    if ((previous?.revision ?? 0) !== expectedRevision)
      return conflict(response);
    let nextAmount = amount;
    if (sessionId) {
      const session = get<{
        type?: string;
        activity?: { type?: string };
        completed?: boolean;
        durationSec?: number;
        durationSeconds?: number;
        createdAt?: string;
      }>(store, owner, "sessions", sessionId);
      const minutes = Math.floor(
        (session?.durationSec ?? session?.durationSeconds ?? 0) / 60,
      );
      const when = new Date(session?.createdAt ?? "");
      if (
        revision.activity !== "breathing" ||
        revision.goal.type !== "duration" ||
        session?.completed !== true ||
        (session.activity?.type ?? session.type) !== "breathing" ||
        !Number.isFinite(when.valueOf()) ||
        when > now ||
        habitDay(habit.timeZone, when) !== day ||
        minutes < 1
      )
        return failure(
          response,
          400,
          "Choose a saved breathing practice from this habit day.",
          "HABIT_PRACTICE_UNAVAILABLE",
        );
      nextAmount = Math.min(10_000, (previous?.amount ?? 0) + minutes);
    }
    if (revision.goal.type === "completion" && nextAmount > 1)
      return failure(
        response,
        400,
        "Choose complete or undo for this habit.",
        "VALIDATION_ERROR",
      );
    const target = habitTarget(revision.goal);
    const complete = nextAmount >= target;
    const timestamp = now.toISOString();
    const firstEarning = complete && !previous?.earned;
    const coveredBySession =
      !!sessionId &&
      firstEarning &&
      sessionHasGardenCredit(store, owner, sessionId);
    const progress: HabitProgress = {
      id,
      habitId,
      day,
      amount: nextAmount,
      target,
      complete,
      earned: complete || previous?.earned === true,
      ...(coveredBySession || previous?.gardenCreditFromSession
        ? { gardenCreditFromSession: true }
        : {}),
      revision: (previous?.revision ?? 0) + 1,
      createdAt: previous?.createdAt ?? timestamp,
      updatedAt: timestamp,
      linkedSessionIds: sessionId
        ? [...(previous?.linkedSessionIds ?? []), sessionId]
        : previous?.linkedSessionIds,
    };
    let nextGarden = garden;
    let credited = false;
    store.transaction(() => {
      put(store, owner, collections.progress, progress);
      if (firstEarning) {
        if (!coveredBySession) nextGarden = advanceGarden(store, owner, now);
        credited = creditGardenHabit(store, owner, progress, now);
      }
      if (sessionId)
        put(store, owner, collections.claims, {
          id: sessionId,
          createdAt: timestamp,
          habitId,
          day,
        });
    });
    return response.json({
      progress,
      garden: nextGarden,
      ...(credited ? gardenState(store, owner) : {}),
    });
  });

  router.delete("/:id", (request, response) => {
    const owner = ownerFor(request);
    const id = idSchema.parse(request.params.id);
    if (!get(store, owner, collections.habits, id))
      return get(store, owner, collections.tombstones, id)
        ? response.status(204).end()
        : missing(response);
    store.transaction(() => {
      store.run(
        "DELETE FROM records WHERE user_id=? AND collection=? AND id=?",
        [owner, collections.habits, id],
      );
      put(store, owner, collections.tombstones, {
        id,
        createdAt: new Date().toISOString(),
      });
      for (const log of list<HabitProgress>(
        store,
        owner,
        collections.progress,
      )) {
        if (log.habitId === id)
          store.run(
            "DELETE FROM records WHERE user_id=? AND collection=? AND id=?",
            [owner, collections.progress, log.id],
          );
      }
      for (const claim of list<ActivityClaim>(
        store,
        owner,
        collections.claims,
      )) {
        if (claim.habitId === id)
          put(store, owner, collections.claims, {
            id: claim.id,
            createdAt: claim.createdAt,
          });
      }
    });
    return response.status(204).end();
  });

  return router;
}
