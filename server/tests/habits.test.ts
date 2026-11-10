import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { Store } from "../src/database.js";
import {
  addHabitDays,
  habitDay,
  habitGardenStage,
  habitInsights,
  habitWeekStart,
  isHabitScheduled,
  type Habit,
  type HabitDraft,
  type HabitProgress,
  type HabitRevision,
} from "../src/habit-contract.js";

const draft: HabitDraft = {
  name: "Take a stretch break",
  category: "self-care",
  icon: "heart",
  color: "sage",
  goal: { type: "completion" },
  schedule: { type: "daily" },
  reminderTime: null,
};
const timestamp = "2026-10-26T12:00:00Z";
const revision = (
  day: string,
  changes: Partial<HabitRevision> = {},
): HabitRevision => ({
  day,
  status: "active",
  schedule: draft.schedule,
  goal: draft.goal,
  ...changes,
});
const habit = (
  id: string,
  revisions: HabitRevision[],
  timeZone = "UTC",
): Habit => ({
  ...draft,
  id,
  timeZone,
  status: revisions.at(-1)!.status,
  revisions,
  revision: revisions.length,
  createdAt: timestamp,
  updatedAt: timestamp,
});
const log = (habitId: string, day: string, complete = true): HabitProgress => ({
  id: `${habitId}-${day}`,
  habitId,
  day,
  complete,
  earned: complete,
  amount: complete ? 1 : 0,
  target: 1,
  revision: 1,
  createdAt: timestamp,
  updatedAt: timestamp,
});
const appFor = (store: Store) =>
  createApp({
    store,
    ai: {
      mode: "offline",
      model: "unused",
      baseUrl: "https://example.invalid",
    },
    rateLimits: false,
  });
type App = ReturnType<typeof appFor>;
const bearer = { type: "bearer" as const };
async function signup(app: App, label: string) {
  const { body } = await request(app)
    .post("/api/auth/register")
    .send({
      email: `${label}@habits.test`,
      name: "Habit QA",
      password: "fixture-only-password",
    })
    .expect(201);
  return { token: body.token as string, owner: body.user.id as string };
}
const create = (
  app: App,
  token: string,
  id: string,
  values = draft,
  timeZone = "UTC",
) =>
  request(app)
    .post("/api/habits")
    .auth(token, bearer)
    .send({ ...values, id, timeZone });
const recordProgress = (
  app: App,
  token: string,
  id: string,
  day: string,
  amount: number,
  expectedRevision: number,
  sessionId?: string,
) =>
  request(app)
    .put(`/api/habits/${id}/progress`)
    .auth(token, bearer)
    .send({ day, amount, expectedRevision, sessionId });

test("habit days use pinned calendar dates across UTC, DST and leap boundaries", () => {
  const instant = new Date("2026-11-01T06:30:00Z");
  assert.equal(habitDay("America/Los_Angeles", instant), "2026-10-31");
  assert.equal(habitDay("Asia/Kolkata", instant), "2026-11-01");
  assert.equal(
    habitDay("America/Los_Angeles", new Date("2026-11-01T09:30:00Z")),
    "2026-11-01",
  );
  assert.equal(addHabitDays("2028-02-28", 1), "2028-02-29");
  assert.equal(habitWeekStart("2027-01-01"), "2026-12-28");
  assert.deepEqual([0, 1, 5, 12, 25].map(habitGardenStage), [
    "seed",
    "sprout",
    "growing",
    "blooming",
    "flourishing",
  ]);
});

test("insights respect dated weekday changes, paused days, archived history and flexible caps", () => {
  const fixed = habit("fixed", [
    revision("2026-10-26", { schedule: { type: "weekdays", days: [1, 3, 5] } }),
    revision("2026-10-29", { status: "paused" }),
    revision("2026-11-02", { schedule: { type: "weekdays", days: [1] } }),
    revision("2026-11-03", { status: "archived" }),
  ]);
  const flex = habit("flex", [
    revision("2026-10-26", { schedule: { type: "weekly", daysPerWeek: 2 } }),
  ]);
  assert.equal(isHabitScheduled(fixed, "2026-10-27"), false);
  assert.equal(isHabitScheduled(fixed, "2026-10-30"), false);
  assert.equal(isHabitScheduled(fixed, "2026-11-02"), true);
  assert.equal(isHabitScheduled(fixed, "2026-11-03"), false);
  const progress = [
    log("fixed", "2026-10-26"),
    log("fixed", "2026-10-28"),
    log("fixed", "2026-11-02"),
    log("flex", "2026-10-26"),
    log("flex", "2026-10-27"),
    log("flex", "2026-10-28"),
    log("flex", "2026-11-01", false),
    log("flex", "2026-11-03"),
  ];
  const summary = habitInsights(
    [fixed, flex],
    progress,
    "2026-10-26",
    "2026-11-30",
    "2026-11-03",
  );
  assert.deepEqual(summary.habits, [
    { habitId: "fixed", scheduled: 3, completed: 3, percentage: 100 },
    { habitId: "flex", scheduled: 4, completed: 3, percentage: 75 },
  ]);
  assert.equal(summary.completedActions, 7);
  assert.equal(summary.daysWithCompletion, 5);
  assert.deepEqual(summary.fixed, { scheduled: 3, completed: 3 });
  assert.deepEqual(summary.flexible, { scheduled: 4, completed: 3 });
  assert.equal(summary.currentStreak, 3);
  assert.equal(summary.bestStreak, 3);
  assert.deepEqual(
    summary.days.find(({ day }) => day === "2026-10-27"),
    {
      day: "2026-10-27",
      completed: 1,
      scheduled: 0,
      fixedCompleted: 0,
      closedMissed: 0,
    },
  );
  const october = habitInsights(
    [fixed, flex],
    progress,
    "2026-10-01",
    "2026-10-31",
    "2026-11-03",
  );
  assert.equal(october.scheduled, 4);
  assert.equal(october.completed, 4);
  assert.equal(october.completedActions, 5);
});

test("a local day in progress does not break a streak when the viewer travels", () => {
  const fixed = habit("la", [revision("2026-10-31")], "America/Los_Angeles");
  const progress = [log("la", "2026-10-31")];
  const now = new Date("2026-11-02T02:00:00Z");
  const insights = habitInsights(
    [fixed],
    progress,
    "2026-10-31",
    "2026-11-02",
    "2026-11-02",
    now,
  );
  assert.equal(insights.scheduled, 2);
  assert.equal(insights.currentStreak, 1);
  assert.equal(insights.bestStreak, 1);
  assert.deepEqual(insights.days.at(-1), {
    day: "2026-11-02",
    completed: 0,
    scheduled: 0,
    fixedCompleted: 0,
    closedMissed: 0,
  });
  assert.equal(insights.days[1].closedMissed, 0);
});

test("calendar distinguishes completed days, fixed misses and flexible progress", () => {
  const daily = habit("daily", [revision("2026-11-02")]);
  const flexible = habit("flex", [
    revision("2026-11-02", {
      schedule: { type: "weekly", daysPerWeek: 2 },
    }),
  ]);
  const novemberSecond = log("daily", "2026-11-02");
  const summary = habitInsights(
    [daily, flexible],
    [
      novemberSecond,
      novemberSecond,
      log("flex", "2026-11-02"),
      log("flex", "2026-11-03"),
      log("daily", "2026-11-05"),
    ],
    "2026-11-02",
    "2026-11-08",
    "2026-11-04",
  );
  assert.equal(summary.completedActions, 3);
  assert.equal(summary.daysWithCompletion, 2);
  assert.deepEqual(summary.fixed, { scheduled: 3, completed: 1 });
  assert.deepEqual(summary.flexible, { scheduled: 2, completed: 2 });
  assert.deepEqual(
    summary.days.map(({ day, completed, fixedCompleted, closedMissed }) => [
      day,
      completed,
      fixedCompleted,
      closedMissed,
    ]),
    [
      ["2026-11-02", 2, 1, 0],
      ["2026-11-03", 1, 0, 1],
      ["2026-11-04", 0, 0, 0],
    ],
  );
});

test("habit records and exports stay owner-scoped and concurrent completions award once", async () => {
  const store = await Store.open(":memory:");
  try {
    const app = appFor(store);
    const first = await signup(app, "owner");
    const second = await signup(app, "other");
    const day = habitDay("UTC");
    await request(app).get("/api/habits").expect(401);
    await create(app, first.token, "stretch", {
      ...draft,
      schedule: { type: "weekdays", days: [1, 1] },
    }).expect(400);
    await create(app, first.token, "stretch", {
      ...draft,
      reminderTime: "25:11",
    }).expect(400);
    await create(app, first.token, "stretch", draft, "invalid/zone").expect(
      400,
    );
    await create(app, first.token, "stretch").expect(201);
    await create(app, first.token, "stretch").expect(200);
    await create(app, first.token, "stretch", {
      ...draft,
      name: "Different",
    }).expect(409);
    await request(app)
      .post("/api/records/habits")
      .auth(first.token, bearer)
      .send(draft)
      .expect(400);
    await recordProgress(app, second.token, "stretch", day, 1, 0).expect(404);
    await request(app)
      .delete("/api/habits/stretch")
      .auth(second.token, bearer)
      .expect(404);
    await recordProgress(
      app,
      first.token,
      "stretch",
      addHabitDays(day, 1),
      1,
      0,
    ).expect(400);
    await recordProgress(app, first.token, "stretch", day, 2, 0).expect(400);
    const results = await Promise.all(
      [0, 0].map((rev) =>
        recordProgress(app, first.token, "stretch", day, 1, rev).expect(200),
      ),
    );
    for (const { body } of results) {
      assert.equal(body.progress.revision, 1);
      assert.equal(body.garden.earnedTotal, 1);
      assert.equal(body.garden.stage, "sprout");
    }
    await recordProgress(app, first.token, "stretch", day, 0, 0).expect(409);
    const undo = await recordProgress(
      app,
      first.token,
      "stretch",
      day,
      0,
      1,
    ).expect(200);
    assert.equal(undo.body.progress.complete, false);
    assert.equal(undo.body.garden.earnedTotal, 1);
    const redo = await recordProgress(
      app,
      first.token,
      "stretch",
      day,
      1,
      2,
    ).expect(200);
    assert.equal(redo.body.garden.earnedTotal, 1);
    const state = await request(app)
      .get("/api/state")
      .auth(first.token, bearer)
      .expect(200);
    assert.equal(state.body.data.habitProgress.length, 1);
    assert.equal(state.body.data.habits.length, 1);
    const exported = await request(app)
      .get("/api/export")
      .auth(first.token, bearer)
      .expect(200);
    assert.deepEqual(
      exported.body.data.habitGarden,
      state.body.data.habitGarden,
    );
    const other = await request(app)
      .get("/api/habits")
      .auth(second.token, bearer)
      .expect(200);
    assert.deepEqual(other.body, {
      habits: [],
      habitProgress: [],
      habitGarden: [],
      gardenIntentions: [],
    });
    await request(app)
      .delete("/api/habits/stretch")
      .auth(first.token, bearer)
      .expect(204);
    await request(app)
      .delete("/api/habits/stretch")
      .auth(first.token, bearer)
      .expect(204);
    await create(app, first.token, "stretch").expect(409);
    const deleted = await request(app)
      .get("/api/habits")
      .auth(first.token, bearer)
      .expect(200);
    assert.deepEqual(deleted.body.habits, []);
    assert.deepEqual(deleted.body.habitProgress, []);
    assert.equal(deleted.body.habitGarden[0].earnedTotal, 1);
    await request(app)
      .delete("/api/account")
      .auth(first.token, bearer)
      .expect(204);
    assert.deepEqual(
      store.all("SELECT id FROM records WHERE user_id=?", [first.owner]),
      [],
    );
  } finally {
    store.close();
  }
});

test("goal changes preserve recorded targets and pause, resume and archive preserve the history", async () => {
  const store = await Store.open(":memory:");
  try {
    const app = appFor(store);
    const { token } = await signup(app, "edits");
    const day = habitDay("UTC");
    const quantity: HabitDraft = {
      ...draft,
      goal: { type: "quantity", target: 3, unit: "glasses" },
      reminderTime: "08:15",
    };
    await create(app, token, "water", quantity).expect(201);
    const change = (values: {
      status?: string;
      draft?: HabitDraft;
      expectedRevision: number;
    }) =>
      request(app).patch("/api/habits/water").auth(token, bearer).send(values);
    await recordProgress(app, token, "water", day, 1, 0).expect(200);
    const edited: HabitDraft = {
      ...quantity,
      goal: { type: "duration", target: 5 },
      schedule: { type: "weekly", daysPerWeek: 3 },
      reminderTime: "19:45",
    };
    const update = await change({ draft: edited, expectedRevision: 1 }).expect(
      200,
    );
    assert.equal(update.body.habit.reminderTime, "19:45");
    assert.equal(update.body.habit.revisions[1].day, addHabitDays(day, 1));
    assert.deepEqual(update.body.habit.revisions[0].goal, quantity.goal);
    await change({ status: "archived", expectedRevision: 1 }).expect(409);
    const completed = await recordProgress(
      app,
      token,
      "water",
      day,
      3,
      1,
    ).expect(200);
    assert.equal(completed.body.progress.target, 3);
    assert.equal(completed.body.progress.complete, true);
    await change({ status: "paused", expectedRevision: 2 }).expect(200);
    await change({ status: "active", expectedRevision: 3 }).expect(200);
    await change({ status: "archived", expectedRevision: 4 }).expect(200);
    const state = (
      await request(app).get("/api/habits").auth(token, bearer).expect(200)
    ).body;
    assert.equal(state.habits[0].status, "archived");
    assert.equal(state.habitProgress[0].complete, true);
    assert.equal(state.habitGarden[0].earnedTotal, 1);
  } finally {
    store.close();
  }
});

test("a saved breathing practice can contribute once and survives database reopen", async () => {
  const directory = await mkdtemp(join(tmpdir(), "solace-habits-"));
  const file = join(directory, "habits.sqlite");
  let store = await Store.open(file);
  try {
    let app = appFor(store);
    const first = await signup(app, "practice-owner");
    const other = await signup(app, "practice-other");
    const day = habitDay("UTC");
    const linked: HabitDraft = {
      ...draft,
      goal: { type: "duration", target: 3 },
      activity: "breathing",
    };
    await create(app, first.token, "breathing", linked).expect(201);
    await create(app, first.token, "another", linked).expect(201);
    await create(app, other.token, "breathing", linked).expect(201);
    await request(app)
      .post("/api/records/sessions")
      .auth(first.token, bearer)
      .send({
        id: "practice",
        type: "breathing",
        durationSec: 185,
        completed: true,
      })
      .expect(201);
    await recordProgress(
      app,
      other.token,
      "breathing",
      day,
      0,
      0,
      "practice",
    ).expect(400);
    const applied = await recordProgress(
      app,
      first.token,
      "breathing",
      day,
      0,
      0,
      "practice",
    ).expect(200);
    assert.equal(applied.body.progress.amount, 3);
    assert.equal(applied.body.progress.complete, true);
    assert.deepEqual(applied.body.progress.linkedSessionIds, ["practice"]);
    store.close();
    store = await Store.open(file);
    app = appFor(store);
    const replay = await recordProgress(
      app,
      first.token,
      "breathing",
      day,
      0,
      0,
      "practice",
    ).expect(200);
    assert.equal(replay.body.progress.revision, 1);
    assert.equal(replay.body.garden.earnedTotal, 1);
    await recordProgress(
      app,
      first.token,
      "another",
      day,
      0,
      0,
      "practice",
    ).expect(409);
    await request(app)
      .delete("/api/habits/breathing")
      .auth(first.token, bearer)
      .expect(204);
    await recordProgress(
      app,
      first.token,
      "another",
      day,
      0,
      0,
      "practice",
    ).expect(409);
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});
