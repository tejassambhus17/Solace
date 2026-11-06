import assert from "node:assert/strict";
import { mkdtempSync, rmSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { Store } from "../src/database.js";

const api = (store: Store) =>
  createApp({
    store,
    ai: {
      mode: "offline",
      model: "unused",
      baseUrl: "https://example.invalid",
    },
    rateLimits: false,
  });
const reflections = "/api/records/reflections";

test("private journal entries preserve long multiline text, retry safely, and survive reopening the database", async () => {
  const directory = mkdtempSync(join(tmpdir(), "solace-journal-test-"));
  const file = join(directory, "journal.sqlite");
  let store = await Store.open(file);
  try {
    let app = api(store);
    const signup = async (email: string) => ({
      Authorization: `Bearer ${
        (
          await request(app)
            .post("/api/auth/register")
            .send({
              email,
              name: "Journal QA",
              password: "fixture-only-password",
            })
            .expect(201)
        ).body.token
      }`,
    });
    const owner = await signup("journal-owner@solace.test");
    const other = await signup("journal-other@solace.test");
    const entry = {
      id: "journal-sample",
      kind: "journal",
      title: "Notes from the park",
      text: `  Start of page 🌿\n\n${"The trees moved in the wind.\n".repeat(450)}End of page.\n  `,
      mood: "Calm",
      tags: ["park", "weekend"],
      bookmarked: false,
      day: "2026-11-05",
      createdAt: "2026-11-05T12:00:00.000Z",
    };
    assert.ok(entry.text.length > 10_000);
    const path = `${reflections}/${entry.id}`;
    await request(app).post(reflections).send(entry).expect(401);
    const created = await request(app)
      .post(reflections)
      .set(owner)
      .send(entry)
      .expect(201);
    assert.deepEqual(created.body.record, {
      ...entry,
      updatedAt: entry.createdAt,
    });
    const replay = await request(app)
      .post(reflections)
      .set(owner)
      .send(entry)
      .expect(200);
    assert.deepEqual(replay.body.record, created.body.record);
    await request(app)
      .post(reflections)
      .set(owner)
      .send({ ...entry, title: "Changed payload" })
      .expect(409);
    await request(app)
      .patch(path)
      .set(owner)
      .send({ kind: "other" })
      .expect(409);
    await request(app)
      .patch(path)
      .set(owner)
      .send({ mood: "invented" })
      .expect(400);
    await request(app)
      .patch(path)
      .set(owner)
      .send({ text: " \n " })
      .expect(400);
    const updated = await request(app)
      .patch(path)
      .set(owner)
      .send({ bookmarked: true, tags: ["park"], mood: null })
      .expect(200);
    assert.equal(updated.body.record.text, entry.text);
    assert.equal(updated.body.record.createdAt, entry.createdAt);
    assert.equal(updated.body.record.bookmarked, true);
    assert.ok(Number.isFinite(Date.parse(updated.body.record.updatedAt)));
    await request(app)
      .patch(path)
      .set(other)
      .send({ bookmarked: false })
      .expect(404);
    await request(app).delete(path).set(other).expect(404);
    const separate = await request(app).get(reflections).set(other).expect(200);
    assert.deepEqual(separate.body.records, []);

    store.close();
    store = await Store.open(file);
    app = api(store);
    const reopened = await request(app).get(reflections).set(owner).expect(200);
    assert.deepEqual(reopened.body.records, [updated.body.record]);
    await request(app).delete(path).set(owner).expect(204);
    const deleted = await request(app).get(reflections).set(owner).expect(200);
    assert.deepEqual(deleted.body.records, []);
  } finally {
    store.close();
    rmSync(file, { force: true });
    rmSync(file + ".tmp", { force: true });
    rmdirSync(directory);
  }
});

test("a legacy personal reflection can become a journal entry without changing its identity or weekly stories", async () => {
  const store = await Store.open(":memory:");
  try {
    const app = api(store);
    const account = await request(app)
      .post("/api/auth/register")
      .send({
        email: "legacy-journal@solace.test",
        name: "Journal QA",
        password: "fixture-only-password",
      })
      .expect(201);
    const auth = { Authorization: `Bearer ${account.body.token}` };
    const legacy = await request(app)
      .post(reflections)
      .set(auth)
      .send({
        id: "legacy-personal",
        content: "A regular afternoon.",
        need: "Rest",
      })
      .expect(201);
    const migrated = await request(app)
      .patch(`${reflections}/legacy-personal`)
      .set(auth)
      .send({ kind: "journal", text: "A regular afternoon.", bookmarked: true })
      .expect(200);
    assert.equal(migrated.body.record.id, legacy.body.record.id);
    assert.equal(migrated.body.record.createdAt, legacy.body.record.createdAt);
    assert.equal(migrated.body.record.need, "Rest");
    const weeklyPeriod = { start: "2026-10-26", end: "2026-11-01" };
    await request(app)
      .post(reflections)
      .set(auth)
      .send({
        id: "weekly",
        text: "Weekly summary.",
        weeklyPeriod,
        weeklyProvider: "offline",
      })
      .expect(201);
    await request(app)
      .patch(`${reflections}/weekly`)
      .set(auth)
      .send({ kind: "journal", bookmarked: true })
      .expect(409);
    const records = (await request(app).get(reflections).set(auth).expect(200))
      .body.records;
    assert.equal(records.length, 2);
    assert.deepEqual(
      records.find((record: { id: string }) => record.id === "weekly")
        .weeklyPeriod,
      weeklyPeriod,
    );
  } finally {
    store.close();
  }
});
