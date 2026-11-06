import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { Store } from "../src/database.js";

test("an ambient mix uses its own preference identity, validates levels and remains owner-scoped", async () => {
  const store = await Store.open(":memory:");
  try {
    const app = createApp({
      store,
      ai: {
        mode: "offline",
        model: "unused",
        baseUrl: "https://example.invalid",
      },
      rateLimits: false,
    });
    const signup = async (email: string) =>
      (
        await request(app)
          .post("/api/auth/register")
          .send({ email, name: "Mix QA", password: "fixture-only-password" })
          .expect(201)
      ).body.token as string;
    const owner = await signup("mix-owner@solace.test");
    const other = await signup("mix-other@solace.test");
    const path = "/api/records/preferences";
    const body = {
      id: "ambient-mix",
      volumes: { rain: 48, ocean: 27, forest: 0, wind: 13 },
      masterVolume: 66,
      timerMinutes: 15,
    };
    await request(app)
      .post(path)
      .auth(owner, { type: "bearer" })
      .send({ id: "wellness", environment: "ocean" })
      .expect(201);
    for (const status of [201, 200])
      await request(app)
        .post(path)
        .auth(owner, { type: "bearer" })
        .send(body)
        .expect(status);
    await request(app)
      .patch(`${path}/ambient-mix`)
      .auth(owner, { type: "bearer" })
      .send({ volumes: { ...body.volumes, rain: 101 } })
      .expect(400);
    await request(app)
      .patch(`${path}/ambient-mix`)
      .auth(owner, { type: "bearer" })
      .send({ timerMinutes: 3 })
      .expect(400);
    await request(app)
      .patch(`${path}/ambient-mix`)
      .auth(other, { type: "bearer" })
      .send({ masterVolume: 0 })
      .expect(404);
    const state = (
      await request(app)
        .get("/api/state")
        .auth(owner, { type: "bearer" })
        .expect(200)
    ).body.data.preferences;
    assert.equal(state.length, 2);
    assert.deepEqual(
      state.find(({ id }: { id: string }) => id === body.id).volumes,
      body.volumes,
    );
    assert.equal(
      state.find(({ id }: { id: string }) => id === "wellness").environment,
      "ocean",
    );
    const separate = (
      await request(app)
        .get("/api/state")
        .auth(other, { type: "bearer" })
        .expect(200)
    ).body.data.preferences;
    assert.deepEqual(separate, []);
  } finally {
    store.close();
  }
});
