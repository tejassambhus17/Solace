import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import request from "supertest";
import { createExplorePractice } from "../../src/explore-practices.js";
import { createTechniquePractice } from "../../src/techniques.js";
import { createApp } from "../src/app.js";
import { Store } from "../src/database.js";
import { currentGardenIntention } from "../src/garden-contract.js";
import { saveGardenChoice } from "../src/garden-intentions.js";
import { habitDay } from "../src/habit-contract.js";
import type { SolaceMoment } from "../src/moment-contract.js";
import { curatedMoment } from "../src/moments.js";
import { getTimedPractice } from "../src/timed-practice-contract.js";
import { buildWellnessTasks, planTaskActivity } from "../src/wellness-plans.js";

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
      email: `${label}@garden.test`,
      name: "Garden QA",
      password: "fixture-only-password",
    })
    .expect(201);
  return { token: body.token as string, owner: body.user.id as string };
}

const choose = (app: App, token: string, kind: string, habitId?: string) =>
  request(app)
    .put("/api/habits/garden-intention")
    .auth(token, bearer)
    .send({ kind, habitId, timeZone: "UTC" });
const read = (app: App, token: string) =>
  request(app).get("/api/habits/garden-intention").auth(token, bearer);
const save = (
  app: App,
  token: string,
  collection: "sessions" | "reflections",
  record: Record<string, unknown>,
) =>
  request(app)
    .post(`/api/records/${collection}`)
    .auth(token, bearer)
    .send(record);
function breathing(id: string, changes: Record<string, unknown> = {}) {
  const end = new Date();
  const start = new Date(end.valueOf() - 60_000);
  return {
    id,
    type: "breathing",
    title: "Breath Reset",
    durationSec: 60,
    plannedDurationSec: 60,
    completed: true,
    outcome: "completed",
    practiceId: "breathing",
    startedAt: start.toISOString(),
    endedAt: end.toISOString(),
    createdAt: end.toISOString(),
    ...changes,
  };
}
function generated(
  id: string,
  activity: SolaceMoment,
  changes: Record<string, unknown> = {},
) {
  return breathing(id, {
    kind: "generated",
    activity,
    practiceId: activity.id,
    type: activity.type,
    title: activity.title,
    durationSec: activity.durationSec,
    plannedDurationSec: activity.durationSec,
    startedAt: new Date(
      Date.now() - activity.durationSec * 1_000,
    ).toISOString(),
    ...changes,
  });
}
const habitDraft = {
  id: "breath-habit",
  name: "One minute of breathing",
  category: "mindfulness",
  icon: "leaf",
  color: "sage",
  goal: { type: "duration", target: 1 },
  schedule: { type: "daily" },
  reminderTime: null,
  activity: "breathing",
  timeZone: "UTC",
};
const habitLog = (
  app: App,
  token: string,
  amount: number,
  expectedRevision: number,
  sessionId?: string,
) =>
  request(app)
    .put("/api/habits/breath-habit/progress")
    .auth(token, bearer)
    .send({ day: habitDay("UTC"), amount, expectedRevision, sessionId });

test("completed practices credit the owned current intention once and retain the original Garden stages", async (t) => {
  const store = await Store.open(":memory:");
  t.after(() => store.close());
  const app = appFor(store);
  const account = await signup(app, "practice");
  const other = await signup(app, "other");
  await request(app).get("/api/habits/garden-intention").expect(401);
  await choose(app, account.token, "breathing").expect(200);
  await save(
    app,
    account.token,
    "sessions",
    breathing("ended-early", { completed: false, outcome: "early-exit" }),
  ).expect(201);
  assert.deepEqual(
    (await read(app, account.token).expect(200)).body.habitGarden,
    [],
  );

  const record = breathing("one-real-breath");
  const results = await Promise.all([
    save(app, account.token, "sessions", record),
    save(app, account.token, "sessions", record),
  ]);
  assert.deepEqual(results.map(({ status }) => status).sort(), [200, 201]);
  const { body } = await read(app, account.token).expect(200);
  assert.equal(body.habitGarden[0].earnedTotal, 1);
  assert.equal(body.habitGarden[0].stage, "sprout");
  assert.deepEqual(body.gardenIntentions[0].contributors, [
    { collection: "sessions", recordId: record.id, day: habitDay("UTC") },
  ]);
  await choose(app, account.token, "sleep").expect(409);
  await choose(app, account.token, "breathing").expect(200);
  assert.deepEqual((await read(app, other.token).expect(200)).body, {
    gardenIntentions: [],
    habitGarden: [],
  });

  for (const id of ["breath-2", "breath-3", "breath-4"]) {
    await save(app, account.token, "sessions", breathing(id)).expect(201);
  }
  const finished = (await read(app, account.token).expect(200)).body;
  assert.equal(finished.habitGarden[0].earnedTotal, 3);
  assert.equal(finished.gardenIntentions[0].contributors.length, 3);
});

test("replaying a saved plan practice returns its Garden progress without growing it twice", async (t) => {
  const store = await Store.open(":memory:");
  t.after(() => store.close());
  const app = appFor(store);
  const { token } = await signup(app, "plan-practice-replay");
  await choose(app, token, "breathing").expect(200);
  const tasks = buildWellnessTasks("calm", ["calm"], 5);
  const activity = planTaskActivity(tasks[0]);
  assert.ok(activity && activity.type === "breathing");
  const stamp = new Date().toISOString();
  const { body: saved } = await request(app)
    .post("/api/records/plans")
    .auth(token, bearer)
    .send({
      id: "garden-plan",
      type: "wellness",
      title: "Garden plan",
      goal: "calm",
      preferredFocuses: ["calm"],
      dailyMinutes: 5,
      tasks,
      startedAt: stamp,
      createdAt: stamp,
    })
    .expect(201);
  const completion = generated("first-plan-session", activity, {
    planId: saved.record.id,
    planTaskId: tasks[0].id,
  });
  const { body: first } = await save(app, token, "sessions", completion).expect(
    201,
  );
  assert.equal(first.habitGarden[0].earnedTotal, 1);
  const { body: retry } = await save(app, token, "sessions", {
    ...completion,
    id: "retry-plan-session",
  }).expect(200);
  assert.deepEqual(retry, first);
  const { body: records } = await request(app)
    .get("/api/records/sessions")
    .auth(token, bearer)
    .expect(200);
  assert.deepEqual(
    records.records.map(({ id }: { id: string }) => id),
    [completion.id],
  );
});

test("practice credit requires a registered classic practice or a completed validated Moment", async (t) => {
  const store = await Store.open(":memory:");
  t.after(() => store.close());
  const app = appFor(store);
  const { token } = await signup(app, "activity-validation");
  await choose(app, token, "breathing").expect(200);

  const oneMinute = createExplorePractice("breathe", 1);
  for (const record of [
    breathing("phantom", { practiceId: "missing-practice-id", durationSec: 1 }),
    breathing("fake-classic", { practiceId: "missing-practice-id" }),
    breathing("partial-classic", { durationSec: 1, plannedDurationSec: 1 }),
    generated("partial-snapshot", oneMinute, { durationSec: 1 }),
    generated("changed-plan", oneMinute, { plannedDurationSec: 1 }),
    generated("mismatched-snapshot", oneMinute, { practiceId: "wrong-id" }),
  ]) {
    await save(app, token, "sessions", record).expect(201);
  }
  assert.deepEqual((await read(app, token).expect(200)).body.habitGarden, []);

  for (const record of [
    generated("actual-mood-or-voice-reset", oneMinute),
    generated("user-moment", curatedMoment("breathing")),
  ]) {
    await save(app, token, "sessions", record).expect(201);
  }
  const { body } = await read(app, token).expect(200);
  assert.equal(body.habitGarden[0].earnedTotal, 2);
  assert.deepEqual(
    body.gardenIntentions[0].contributors.map(
      (entry: { recordId: string }) => entry.recordId,
    ),
    ["actual-mood-or-voice-reset", "user-moment"],
  );
});

test("calming credit respects the existing step-based grounding completion", async (t) => {
  const store = await Store.open(":memory:");
  t.after(() => store.close());
  const app = appFor(store);
  const { token } = await signup(app, "grounding-steps");
  await choose(app, token, "calming").expect(200);
  const classic = breathing("classic-grounding", {
    practiceId: "grounding",
    type: "grounding",
    durationSec: 28,
    plannedDurationSec: undefined,
  });
  await save(app, token, "sessions", { ...classic, id: "no-steps" }).expect(
    201,
  );
  assert.deepEqual((await read(app, token).expect(200)).body.habitGarden, []);
  await save(app, token, "sessions", { ...classic, steps: [0, 2, 4] }).expect(
    201,
  );
  await save(
    app,
    token,
    "sessions",
    generated("guided-grounding", createTechniquePractice("grounding"), {
      practiceId: "grounding",
      durationSec: 28,
    }),
  ).expect(201);
  const { body } = await read(app, token).expect(200);
  assert.equal(body.habitGarden[0].earnedTotal, 2);
});

test("habit intentions use the existing scheduled completion and linking a credited practice does not award it twice", async (t) => {
  const store = await Store.open(":memory:");
  t.after(() => store.close());
  const app = appFor(store);
  const account = await signup(app, "habit");
  const other = await signup(app, "linked");
  await request(app)
    .post("/api/habits")
    .auth(account.token, bearer)
    .send(habitDraft)
    .expect(201);
  await choose(app, other.token, "habit", habitDraft.id).expect(409);
  const choice = await choose(
    app,
    account.token,
    "habit",
    habitDraft.id,
  ).expect(200);
  assert.ok(choice.body.gardenIntentions[0].target >= 1);
  const complete = await habitLog(app, account.token, 1, 0).expect(200);
  assert.equal(complete.body.garden.earnedTotal, 1);
  assert.equal(complete.body.gardenIntentions[0].contributors.length, 1);
  await habitLog(app, account.token, 0, 1).expect(200);
  await habitLog(app, account.token, 1, 2).expect(200);
  const restored = (await read(app, account.token).expect(200)).body;
  assert.equal(restored.habitGarden[0].earnedTotal, 1);
  assert.equal(restored.gardenIntentions[0].contributors.length, 1);

  await request(app)
    .post("/api/habits")
    .auth(other.token, bearer)
    .send(habitDraft)
    .expect(201);
  await choose(app, other.token, "breathing").expect(200);
  await save(app, other.token, "sessions", breathing("also-a-habit")).expect(
    201,
  );
  const linked = await habitLog(app, other.token, 0, 0, "also-a-habit").expect(
    200,
  );
  assert.equal(linked.body.progress.complete, true);
  assert.equal(linked.body.progress.gardenCreditFromSession, true);
  assert.equal(linked.body.garden.earnedTotal, 1);
});

test("sleep intentions accept a completed registered wind-down without treating all rest activities as sleep", async (t) => {
  const store = await Store.open(":memory:");
  t.after(() => store.close());
  const app = appFor(store);
  const account = await signup(app, "sleep");
  await choose(app, account.token, "sleep").expect(200);
  await save(
    app,
    account.token,
    "sessions",
    generated("generic-rest", createExplorePractice("rest", 3)),
  ).expect(201);
  assert.deepEqual(
    (await read(app, account.token).expect(200)).body.habitGarden,
    [],
  );

  const sleep = getTimedPractice("sleep", 5)!;
  await save(
    app,
    account.token,
    "sessions",
    generated("registered-sleep", sleep),
  ).expect(201);
  const { body } = await read(app, account.token).expect(200);
  assert.equal(body.habitGarden[0].earnedTotal, 1);
  assert.equal(
    body.gardenIntentions[0].contributors[0].recordId,
    "registered-sleep",
  );
});

test("a delayed journal sync counts in its recorded week and growth persists after the source is removed", async () => {
  const folder = await mkdtemp(join(tmpdir(), "solace-garden-"));
  const file = join(folder, "store.sqlite");
  let store = await Store.open(file);
  try {
    const app = appFor(store);
    const account = await signup(app, "journal");
    const savedAt = new Date(Date.now() - 14 * 86_400_000);
    assert.equal(
      saveGardenChoice(
        store,
        account.owner,
        { kind: "journal" },
        "UTC",
        savedAt,
      ),
      undefined,
    );
    const entryAt = new Date(savedAt.valueOf() + 60_000);
    const entry = {
      id: "saved-private-entry",
      kind: "journal",
      title: "Private title",
      text: "Private writing",
      createdAt: entryAt.toISOString(),
    };
    await save(app, account.token, "reflections", {
      id: "normal-reflection",
      text: "A separate reflection",
      createdAt: entryAt.toISOString(),
    }).expect(201);
    await save(app, account.token, "reflections", entry).expect(201);
    await save(app, account.token, "reflections", entry).expect(200);
    await request(app)
      .delete(`/api/records/reflections/${entry.id}`)
      .auth(account.token, bearer)
      .expect(204);

    store.close();
    store = await Store.open(file);
    const reopened = appFor(store);
    await save(reopened, account.token, "reflections", entry).expect(201);
    const { body } = await read(reopened, account.token).expect(200);
    assert.equal(body.habitGarden[0].earnedTotal, 1);
    assert.equal(
      currentGardenIntention(body.gardenIntentions, new Date()),
      undefined,
    );
    assert.deepEqual(body.gardenIntentions[0].contributors, [
      {
        collection: "reflections",
        recordId: entry.id,
        day: habitDay("UTC", entryAt),
      },
    ]);
    assert.doesNotMatch(JSON.stringify(body), /Private title|Private writing/);
  } finally {
    store.close();
    await rm(folder, { recursive: true, force: true });
  }
});
