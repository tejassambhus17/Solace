import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import { journeySummary } from "../../src/progress.js";
import { createApp } from "../src/app.js";
import { Store } from "../src/database.js";
import { momentSchema } from "../src/moments.js";
import {
  getTimedPractice,
  isCanonicalTimedPractice,
  timedPracticeDurations,
  timedPracticeFocuses,
} from "../src/timed-practice-contract.js";
import { parseRecord } from "../src/validation.js";

test("all 16 curated timed activities satisfy the save schema while AI output stays capped", () => {
  for (const focus of timedPracticeFocuses) {
    for (const minutes of timedPracticeDurations) {
      const activity = getTimedPractice(focus, minutes);
      assert.ok(isCanonicalTimedPractice(activity));
      assert.equal(momentSchema.safeParse(activity).success, minutes <= 10);
      assert.deepEqual(
        parseRecord("sessions", { id: "qa-timed", activity }).activity,
        activity,
      );
    }
  }
  const activity = getTimedPractice("calm", 20);
  assert.throws(() =>
    parseRecord("sessions", {
      id: "qa-timed",
      activity: { ...activity, id: "unregistered-long" },
    }),
  );
  assert.throws(() =>
    parseRecord("sessions", {
      id: "qa-timed",
      activity: { ...activity, description: "Unregistered description" },
    }),
  );
  assert.equal(
    isCanonicalTimedPractice({ ...activity, environment: ["forest"] }),
    false,
  );
  assert.equal(
    isCanonicalTimedPractice({ ...activity, environment: "ocean" }),
    true,
  );
});

test("a saved 20-minute guided practice contributes its active duration once to the owner's Journey", async () => {
  const store = await Store.open(":memory:");
  try {
    const app = createApp({
      store,
      ai: {
        mode: "offline",
        baseUrl: "https://api.openai.com/v1",
        model: "test",
      },
      rateLimits: false,
    });
    async function register(email: string) {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Timed Practice QA",
          email,
          password: "private-qa-password",
        })
        .expect(201);
      return { Authorization: `Bearer ${response.body.token}` };
    }
    const owner = await register("timed-owner@example.test");
    const other = await register("timed-other@example.test");
    const activity = { ...getTimedPractice("sleep", 20), environment: "ocean" };
    const completion = {
      id: "timed-practice-completion",
      kind: "generated",
      type: activity.type,
      title: activity.title,
      activity,
      environment: activity.environment,
      provider: "offline",
      durationSec: activity.durationSec,
      plannedDurationSec: activity.durationSec,
      completed: true,
      feedback: "Helped",
      source: "Explore",
      createdAt: new Date().toISOString(),
    };
    await request(app)
      .post("/api/records/sessions")
      .set(owner)
      .send(completion)
      .expect(201);
    await request(app)
      .post("/api/records/sessions")
      .set(owner)
      .send(completion)
      .expect(200);
    const state = (await request(app).get("/api/state").set(owner).expect(200))
      .body.data;
    assert.equal(state.sessions.length, 1);
    assert.equal(state.sessions[0].activity.id, activity.id);
    assert.equal(journeySummary(state).weeklySeconds, 1200);
    const isolated = (
      await request(app).get("/api/state").set(other).expect(200)
    ).body.data;
    assert.equal(isolated.sessions.length, 0);
  } finally {
    store.close();
  }
});
