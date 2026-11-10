import type { Store } from "./database.js";
import {
  currentGardenIntention,
  gardenIntentionTargets,
  remainingGardenHabitDays,
  type GardenContributor,
  type GardenIntention,
  type GardenIntentionChoice,
  type GardenState,
} from "./garden-contract.js";
import {
  habitDay,
  habitGardenStage,
  habitWeekStart,
  type Habit,
  type HabitGarden,
  type HabitProgress,
} from "./habit-contract.js";
import type { SolaceMoment } from "./moment-contract.js";
import { getTimedPractice } from "./timed-practice-contract.js";

const intentionCollection = "gardenIntentions";
const creditCollection = "gardenIntentionCredits";
type Source = { id: string; createdAt: string } & Record<string, unknown>;
type CreditCollection = GardenContributor["collection"];
type Row = { json: string };

function get<T>(store: Store, owner: string, collection: string, id: string) {
  const row = store.one<Row>(
    "SELECT json FROM records WHERE user_id=? AND collection=? AND id=?",
    [owner, collection, id],
  );
  return row ? (JSON.parse(row.json) as T) : undefined;
}

function put(
  store: Store,
  owner: string,
  collection: string,
  record: { id: string; createdAt: string },
) {
  store.run(
    "INSERT INTO records(id,user_id,collection,json,created_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,collection,id) DO UPDATE SET json=excluded.json,created_at=excluded.created_at",
    [record.id, owner, collection, JSON.stringify(record), record.createdAt],
  );
}

function latestIntention(store: Store, owner: string, asOf = new Date()) {
  const row = store.one<Row>(
    "SELECT json FROM records WHERE user_id=? AND collection=? AND created_at<=? ORDER BY created_at DESC LIMIT 1",
    [owner, intentionCollection, asOf.toISOString()],
  );
  return row ? (JSON.parse(row.json) as GardenIntention) : undefined;
}

export function gardenState(store: Store, owner: string): GardenState {
  const garden = get<HabitGarden>(store, owner, "habitGarden", "garden");
  return {
    habitGarden: garden ? [garden] : [],
    gardenIntentions: store
      .all<Row>(
        "SELECT json FROM records WHERE user_id=? AND collection=? ORDER BY created_at DESC",
        [owner, intentionCollection],
      )
      .map(({ json }) => JSON.parse(json) as GardenIntention),
  };
}

/** Update the original Garden ledger from within the caller's transaction. */
export function advanceGarden(store: Store, owner: string, now: Date) {
  const previous = get<HabitGarden>(store, owner, "habitGarden", "garden");
  const earnedTotal = (previous?.earnedTotal ?? 0) + 1;
  const timestamp = now.toISOString();
  const garden: HabitGarden = {
    id: "garden",
    earnedTotal,
    stage: habitGardenStage(earnedTotal),
    createdAt: previous?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
  put(store, owner, "habitGarden", garden);
  return garden;
}

export function saveGardenChoice(
  store: Store,
  owner: string,
  choice: GardenIntentionChoice,
  timeZone: string,
  now = new Date(),
) {
  const latest = latestIntention(store, owner, now);
  const current = currentGardenIntention(latest ? [latest] : [], now);
  const zone = current?.timeZone ?? timeZone;
  const weekStart = habitWeekStart(habitDay(zone, now));
  if (!current && latest && weekStart <= latest.weekStart)
    return "The next intention opens when your new week starts.";
  if (
    current?.kind === choice.kind &&
    (current.kind !== "habit" ||
      (choice.kind === "habit" && current.habitId === choice.habitId))
  )
    return;
  if (current?.contributors.length)
    return "Your current intention has started. Choose a new one next week.";

  let target: number;
  if (choice.kind === "habit") {
    const habit = get<Habit>(store, owner, "habits", choice.habitId);
    if (!habit || habit.status !== "active")
      return "Choose one of your active habits.";
    const progress = store
      .all<Row>(
        "SELECT json FROM records WHERE user_id=? AND collection='habitProgress' AND json_extract(json,'$.habitId')=? AND json_extract(json,'$.day')>=?",
        [owner, habit.id, weekStart],
      )
      .map(({ json }) => JSON.parse(json) as HabitProgress);
    target = remainingGardenHabitDays(habit, progress, weekStart, now);
    if (!target) return "Choose a habit with a scheduled day left this week.";
  } else {
    target = gardenIntentionTargets[choice.kind];
  }

  const intention: GardenIntention = {
    ...choice,
    id: weekStart,
    weekStart,
    timeZone: zone,
    target,
    contributors: [],
    createdAt: now.toISOString(),
  };
  store.transaction(() => put(store, owner, intentionCollection, intention));
}

const creditId = (collection: CreditCollection, id: string) =>
  `${collection}-${id}`;

export function sessionHasGardenCredit(
  store: Store,
  owner: string,
  id: string,
) {
  return !!get(store, owner, creditCollection, creditId("sessions", id));
}

function applyContribution(
  store: Store,
  owner: string,
  intention: GardenIntention,
  collection: CreditCollection,
  id: string,
  happenedAt: Date,
  now: Date,
) {
  const claimId = creditId(collection, id);
  if (
    intention.contributors.length >= intention.target ||
    happenedAt < new Date(intention.createdAt) ||
    happenedAt > now ||
    get(store, owner, creditCollection, claimId)
  )
    return false;
  const day = habitDay(intention.timeZone, happenedAt);
  if (habitWeekStart(day) !== intention.weekStart) return false;
  const next: GardenIntention = {
    ...intention,
    contributors: [
      ...intention.contributors,
      { collection, recordId: id, day },
    ],
  };
  put(store, owner, intentionCollection, next);
  put(store, owner, creditCollection, {
    id: claimId,
    createdAt: now.toISOString(),
  });
  return true;
}

function isSleepPractice(identity: string, title: unknown, duration: number) {
  const timed = /^timed-practice-sleep-(\d+)$/.exec(identity);
  if (timed)
    return (
      getTimedPractice("sleep", Number(timed[1]))?.durationSec === duration
    );
  return (
    ((identity === "wind-down" || identity === "chat-wind-down") &&
      duration === 180) ||
    (identity === "explore-rest-10" &&
      title === "Sleep Wind Down" &&
      duration === 600)
  );
}

function eligibleActivity(record: Source, duration: number) {
  const { practiceId, plannedDurationSec, type, title } = record;
  if (typeof practiceId !== "string") return;
  if (record.kind === "generated") {
    // The session schema validates the complete snapshot, including steps and
    // their durations, before it is written and considered for Garden credit.
    const activity = record.activity as SolaceMoment | undefined;
    if (
      !activity ||
      (activity.id !== practiceId &&
        activity.id !== `chat-${practiceId}` &&
        activity.id !== `technique-${practiceId}`) ||
      activity.type !== type ||
      activity.durationSec !== plannedDurationSec
    )
      return;
    // These guided techniques are finished by advancing their steps. Their
    // displayed duration is an estimate, unlike an automatic timed Moment.
    const selfPaced =
      type === "grounding" &&
      ((practiceId === "grounding" && activity.id === "chat-grounding") ||
        (practiceId === "focus" && activity.id === "chat-focus"));
    if (
      (!selfPaced && duration !== activity.durationSec) ||
      (type === "breathing" && duration < 60)
    )
      return;
    return { type, identity: activity.id, title: activity.title };
  }

  // The classic breathing player supports 1–3 minutes. Classic grounding
  // lets users skip senses, so use its recorded steps instead of a timer target.
  if (
    (practiceId === "breathing" &&
      type === "breathing" &&
      Number.isInteger(duration) &&
      duration >= 60 &&
      duration <= 180 &&
      duration === plannedDurationSec) ||
    (practiceId === "grounding" &&
      type === "grounding" &&
      Array.isArray(record.steps) &&
      record.steps.length > 0 &&
      record.steps.every(
        (step) => Number.isInteger(step) && step >= 0 && step < 5,
      ))
  )
    return { type, identity: practiceId, title };
}

/** Accept only saved, completed practice records with a usable elapsed interval. */
function completedPractice(record: Source) {
  const duration = record.durationSec ?? record.durationSeconds;
  if (
    record.completed !== true ||
    record.outcome !== "completed" ||
    record.resourceId ||
    typeof duration !== "number" ||
    !Number.isFinite(duration) ||
    duration <= 0 ||
    typeof record.startedAt !== "string" ||
    typeof record.endedAt !== "string"
  )
    return;
  const startedAt = Date.parse(record.startedAt);
  const endedAt = Date.parse(record.endedAt);
  if (
    !Number.isFinite(startedAt) ||
    !Number.isFinite(endedAt) ||
    endedAt - startedAt < Math.max(1, duration - 1) * 1_000
  )
    return;
  const activity = eligibleActivity(record, duration);
  if (activity) return { ...activity, duration, happenedAt: new Date(endedAt) };
}

/** Call after persisting the owned source, in the same transaction. */
export function creditGardenIntention(
  store: Store,
  owner: string,
  collection: "sessions" | "reflections",
  record: Source,
  now = new Date(),
) {
  const practice =
    collection === "sessions" ? completedPractice(record) : undefined;
  const happenedAt = practice?.happenedAt ?? new Date(record.createdAt);
  if (!Number.isFinite(happenedAt.valueOf()) || happenedAt > now) return false;
  const latest = latestIntention(store, owner, happenedAt);
  const intention = currentGardenIntention(latest ? [latest] : [], happenedAt);
  if (!intention || intention.kind === "habit") return false;
  if (collection === "reflections") {
    if (
      intention.kind !== "journal" ||
      record.kind !== "journal" ||
      typeof record.text !== "string" ||
      !record.text.trim()
    )
      return false;
  } else {
    if (!practice || intention.kind === "journal") return false;
    const { type, identity, title, duration } = practice;
    const eligible =
      intention.kind === "breathing"
        ? type === "breathing"
        : intention.kind === "sleep"
          ? type === "rest" && isSleepPractice(identity, title, duration)
          : type === "breathing" || type === "grounding" || type === "rest";
    if (!eligible) return false;
  }
  if (
    !applyContribution(
      store,
      owner,
      intention,
      collection,
      record.id,
      happenedAt,
      now,
    )
  )
    return false;
  advanceGarden(store, owner, now);
  return true;
}

/** A qualifying habit day already grew the Garden through the existing ledger. */
export function creditGardenHabit(
  store: Store,
  owner: string,
  progress: HabitProgress,
  now: Date,
) {
  const latest = latestIntention(store, owner, now);
  const intention = currentGardenIntention(latest ? [latest] : [], now);
  return intention?.kind === "habit" &&
    intention.habitId === progress.habitId &&
    habitWeekStart(progress.day) === intention.weekStart
    ? applyContribution(
        store,
        owner,
        intention,
        "habitProgress",
        progress.id,
        now,
        now,
      )
    : false;
}
