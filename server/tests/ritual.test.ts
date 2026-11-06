import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import type { AIConfig } from "../src/ai.js";
import { Store } from "../src/database.js";

const ai: AIConfig = {
  mode: "offline",
  model: "test",
  baseUrl: "https://api.openai.com/v1",
};

test("daily ritual choices persist across a database reopen and stay scoped to the owner", async () => {
  const directory = mkdtempSync(join(tmpdir(), "solace-ritual-"));
  const database = join(directory, "ritual.sqlite");
  let store: Store | undefined;
  try {
    store = await Store.open(database);
    const app = createApp({ store, ai, rateLimits: false });
    const create = async (email: string) =>
      (
        await request(app)
          .post("/api/auth/register")
          .send({ name: "Ritual QA", email, password: "fixture-only-password" })
          .expect(201)
      ).body.token as string;
    const owner = await create("ritual-owner@solace.test");
    const another = await create("ritual-other@solace.test");
    const preference = {
      id: "wellness",
      environment: "ocean",
      dailyRitual: {
        enabled: true,
        day: "2026-11-05",
        skipPractice: false,
        activity: "grounding",
        durationMinutes: 5,
      },
    };
    for (const status of [201, 200])
      await request(app)
        .post("/api/records/preferences")
        .auth(owner, { type: "bearer" })
        .send(preference)
        .expect(status);

    const path = "/api/records/preferences/wellness";
    await request(app)
      .patch(path)
      .auth(another, { type: "bearer" })
      .send({ dailyRitual: preference.dailyRitual })
      .expect(404);
    for (const invalid of [
      { durationMinutes: 999 },
      { activity: "invented-activity" },
      { day: "2026-02-30" },
      { route: "invented-route" },
    ])
      await request(app)
        .patch(path)
        .auth(owner, { type: "bearer" })
        .send({ dailyRitual: { ...preference.dailyRitual, ...invalid } })
        .expect(400);

    const dailyRitual = {
      enabled: false,
      day: "2026-11-06",
      skipPractice: true,
    };
    await request(app)
      .patch(path)
      .auth(owner, { type: "bearer" })
      .send({ dailyRitual })
      .expect(200);
    store.close();
    store = undefined;
    store = await Store.open(database);
    const reopened = createApp({ store, ai, rateLimits: false });
    const saved = (
      await request(reopened)
        .get("/api/state")
        .auth(owner, { type: "bearer" })
        .expect(200)
    ).body.data.preferences;
    assert.equal(saved.length, 1);
    assert.equal(saved[0].environment, "ocean");
    assert.deepEqual(saved[0].dailyRitual, dailyRitual);
    const unrelated = (
      await request(reopened)
        .get("/api/state")
        .auth(another, { type: "bearer" })
        .expect(200)
    ).body.data.preferences;
    assert.deepEqual(unrelated, []);
  } finally {
    store?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
