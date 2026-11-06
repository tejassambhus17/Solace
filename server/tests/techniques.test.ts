import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import { createChatPractice } from "../../src/chat-practices.js";
import { isPlayableMoment } from "../../src/moments.js";
import { goalProgress, journeySummary } from "../../src/progress.js";
import {
  getTechnique,
  listTechniques,
  techniqueCategories,
} from "../../src/techniques.js";
import { createApp } from "../src/app.js";
import { chatPracticeIds } from "../src/chat-practice.js";
import { Store } from "../src/database.js";
import { momentSchema } from "../src/moments.js";

test("all technique categories open the canonical, validated activity snapshots", () => {
  const catalog = listTechniques("All");
  assert.equal(catalog.length, 8);
  assert.equal(
    new Set(catalog.map(({ activity }) => activity.id)).size,
    catalog.length,
  );
  for (const technique of catalog) {
    assert.ok(isPlayableMoment(technique.activity));
    assert.ok(momentSchema.safeParse(technique.activity).success);
    assert.deepEqual(getTechnique(technique.id), technique);
  }
  for (const category of techniqueCategories) {
    if (category === "All") continue;
    const matches = listTechniques(category);
    assert.ok(matches.length > 0, category);
    assert.deepEqual(
      matches,
      catalog.filter((technique) => technique.categories.includes(category)),
    );
  }
  for (const id of chatPracticeIds) {
    assert.deepEqual(createChatPractice(id), getTechnique(id)?.activity);
    assert.equal(createChatPractice(id).id, `chat-${id}`);
  }
  assert.equal(getTechnique("__proto__"), undefined);
  assert.equal(getTechnique("/profile"), undefined);
  assert.equal(getTechnique("grounding")?.activity.steps.length, 5);
  assert.equal(getTechnique("grounding")?.selfPaced, true);
});

test("self-paced technique completion contributes its actual duration once to the owning Journey", async () => {
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
        .send({ name: "Synthetic QA", email, password: "private-qa-password" })
        .expect(201);
      return { Authorization: `Bearer ${response.body.token}` };
    }
    const owner = await register("guided-owner@example.test");
    const other = await register("guided-other@example.test");
    const activity = getTechnique("grounding")!.activity;
    const completion = {
      id: "guided-grounding-completion",
      kind: "generated",
      type: activity.type,
      title: activity.title,
      activity,
      environment: activity.environment,
      provider: "offline",
      durationSec: 27,
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
    const isolated = (
      await request(app).get("/api/state").set(other).expect(200)
    ).body.data;
    const journey = journeySummary(state);
    assert.equal(state.sessions.length, 1);
    assert.equal(state.sessions[0].activity.id, activity.id);
    assert.equal(journey.completedCount, 1);
    assert.equal(journey.weeklySeconds, 27);
    assert.equal(goalProgress(5, journey.weeklySeconds).fraction, 27 / 300);
    assert.equal(
      journey.milestones.find(({ id }) => id === "first-moment")?.earned,
      true,
    );
    assert.equal(isolated.sessions.length, 0);
  } finally {
    store.close();
  }
});
