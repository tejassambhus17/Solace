import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import {
  journeyGoalProgress,
  selectJourneyGoal,
  type JourneyGoal,
} from "../../src/journey-goals.js";
import { createApp } from "../src/app.js";
import { Store } from "../src/database.js";

const now = () => new Date(2026, 10, 6, 12);
const goal: JourneyGoal = {
  id: "personal-weekly-goal",
  title: "Make a little time for myself",
  metric: "checkin-days",
  period: "week",
  target: 5,
  active: true,
};

test("Journey goals load legacy time targets and skip unusable records", () => {
  const legacy = selectJourneyGoal([
    null,
    { id: "bad", title: "Broken", targetMinutesPerWeek: 0 },
    {
      id: "legacy",
      title: "Take a pause",
      targetMinutesPerWeek: 15,
      active: false,
    },
  ]);
  assert.deepEqual(legacy, {
    id: "legacy",
    title: "Take a pause",
    metric: "mindful-minutes",
    period: "week",
    target: 15,
    active: false,
    legacyWeekly: true,
  });
  assert.equal(selectJourneyGoal([legacy!, goal])?.id, goal.id);
  assert.equal(
    journeyGoalProgress(
      legacy!,
      {
        sessions: [
          {
            id: "prior-week",
            day: "2026-11-01",
            completed: true,
            durationSec: 180,
          },
        ],
      },
      now(),
    ).current,
    3,
  );
});

test("check-in goals count one saved day within the chosen local period", () => {
  const data = {
    checkins: [
      { id: "old-month", day: "2026-10-30" },
      { id: "old-week", day: "2026-11-01" },
      { id: "same-day", day: "2026-11-03" },
      { id: "same-day-again", day: "2026-11-03" },
      { id: "today", day: "2026-11-06" },
      { id: "future", day: "2026-11-07" },
      { id: "waiting", day: "2026-11-04", localOnly: true },
    ],
  };
  const weekly = journeyGoalProgress(goal, data, now());
  assert.equal(weekly.current, 2);
  assert.equal(weekly.activities.length, 2);
  assert.equal(weekly.percentage, 40);
  assert.equal(
    journeyGoalProgress({ ...goal, period: "month" }, data, now()).current,
    3,
  );
  assert.equal(
    journeyGoalProgress({ ...goal, period: "all" }, data, now()).current,
    4,
  );
});

test("completed activities use active time and preserve over-target totals", () => {
  const data = {
    sessions: [
      {
        id: "abandoned",
        day: "2026-11-06",
        completed: false,
        durationSec: 180,
        plannedDurationSec: 300,
      },
      {
        id: "saved",
        day: "2026-11-06",
        completed: true,
        durationSec: 299,
        plannedDurationSec: 300,
      },
    ],
    reflections: [
      { id: "saved-reflection", day: "2026-11-06", text: "I took a walk." },
      { id: "pending-reflection", day: "2026-11-06", localOnly: true },
    ],
  };
  const timeGoal = { ...goal, metric: "mindful-minutes" as const };
  const before = journeyGoalProgress(timeGoal, data, now());
  assert.equal(before.current, 4);
  assert.equal(before.percentage, 99);
  assert.equal(before.reached, false);
  assert.equal(before.activities.length, 1);
  assert.equal(
    journeyGoalProgress({ ...goal, metric: "moments" }, data, now()).current,
    1,
  );
  assert.equal(
    journeyGoalProgress({ ...goal, metric: "reflections" }, data, now())
      .current,
    1,
  );
  data.sessions.push({
    id: "saved-another",
    day: "2026-11-06",
    completed: true,
    durationSec: 301,
    plannedDurationSec: 300,
  });
  const reached = journeyGoalProgress(timeGoal, data, now());
  assert.equal(reached.current, 10);
  assert.equal(reached.percentage, 100);
  assert.equal(reached.reached, true);
  assert.equal(
    journeyGoalProgress({ ...goal, target: 0 }, data, now()).fraction,
    0,
  );
});

test("the goals API validates, upgrades, pauses and removes private records", async () => {
  const store = await Store.open(":memory:");
  try {
    const app = createApp({
      store,
      rateLimits: false,
      ai: {
        mode: "offline",
        model: "test",
        baseUrl: "https://api.openai.com/v1",
      },
    });
    async function register(email: string) {
      return (
        await request(app)
          .post("/api/auth/register")
          .send({
            email,
            name: "Journey test",
            password: "journey-test-password",
          })
          .expect(201)
      ).body.token as string;
    }
    const owner = await register("goal-owner@solace.test");
    const other = await register("goal-other@solace.test");
    const collection = "/api/records/goals";
    const path = `${collection}/${goal.id}`;
    const legacy = {
      id: goal.id,
      title: "Older goal",
      targetMinutesPerWeek: 15,
    };
    await request(app)
      .post(collection)
      .auth(owner, { type: "bearer" })
      .send(legacy)
      .expect(201);
    await request(app)
      .post(collection)
      .auth(owner, { type: "bearer" })
      .send(legacy)
      .expect(200);
    await request(app)
      .patch(path)
      .auth(other, { type: "bearer" })
      .send({ active: false })
      .expect(404);
    await request(app).delete(path).auth(other, { type: "bearer" }).expect(404);
    assert.deepEqual(
      (
        await request(app)
          .get(collection)
          .auth(other, { type: "bearer" })
          .expect(200)
      ).body.records,
      [],
    );
    const updated = await request(app)
      .patch(path)
      .auth(owner, { type: "bearer" })
      .send({
        title: goal.title,
        metric: goal.metric,
        period: goal.period,
        target: goal.target,
      })
      .expect(200);
    assert.equal(updated.body.record.metric, goal.metric);
    assert.equal(updated.body.record.target, goal.target);
    assert.equal(updated.body.record.targetMinutesPerWeek, undefined);
    for (const invalid of [
      { target: 0 },
      { target: 8 },
      { period: "day" },
      { metric: "invented" },
    ]) {
      await request(app)
        .patch(path)
        .auth(owner, { type: "bearer" })
        .send(invalid)
        .expect(400);
    }
    const paused = await request(app)
      .patch(path)
      .auth(owner, { type: "bearer" })
      .send({ active: false })
      .expect(200);
    assert.equal(paused.body.record.active, false);
    assert.equal(paused.body.record.target, goal.target);
    const reopened = await request(app)
      .get("/api/state")
      .auth(owner, { type: "bearer" })
      .expect(200);
    assert.equal(reopened.body.data.goals[0].active, false);
    await request(app)
      .post(collection)
      .auth(other, { type: "bearer" })
      .send(goal)
      .expect(201);
    await request(app)
      .post(collection)
      .auth(other, { type: "bearer" })
      .send(goal)
      .expect(200);
    await request(app).delete(path).auth(owner, { type: "bearer" }).expect(204);
    assert.deepEqual(
      (
        await request(app)
          .get(collection)
          .auth(owner, { type: "bearer" })
          .expect(200)
      ).body.records,
      [],
    );
    const otherRecords = await request(app)
      .get(collection)
      .auth(other, { type: "bearer" })
      .expect(200);
    assert.equal(otherRecords.body.records[0].id, goal.id);
  } finally {
    store.close();
  }
});
