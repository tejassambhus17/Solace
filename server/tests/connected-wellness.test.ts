import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { Store } from "../src/database.js";

test("a completed practice and recheck share one owned record and one Garden credit", async (t) => {
  const store = await Store.open(":memory:");
  const app = createApp({
    store,
    ai: { mode: "offline", baseUrl: "https://example.invalid", model: "test" },
    allowedOrigins: [],
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    store.close();
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const call = (path: string, method: string, body?: unknown, token?: string) =>
    fetch(`http://127.0.0.1:${address.port}/api${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  async function account(name: string) {
    const response = await call("/auth/register", "POST", {
      name,
      email: `${name}@example.test`,
      password: "isolated-test-password",
    });
    assert.equal(response.status, 201);
    return (await response.json()).token as string;
  }
  const owner = await account("owner");
  const other = await account("other");
  const now = new Date();
  const iso = (ms: number) => new Date(now.valueOf() + ms).toISOString();
  const mood = {
    id: "source-checkin",
    mood: "Stressed",
    createdAt: iso(-70_000),
  };
  assert.equal(
    (await call("/records/checkins", "POST", mood, owner)).status,
    201,
  );
  assert.equal(
    (await call("/records/checkins", "POST", mood, owner)).status,
    409,
  );
  assert.equal(
    (
      await call(
        "/habits/garden-intention",
        "PUT",
        { kind: "breathing", timeZone: "UTC" },
        owner,
      )
    ).status,
    200,
  );
  const session = {
    id: "moment-session-connected",
    type: "breathing",
    title: "Breath Reset",
    practiceId: "breathing",
    durationSec: 60,
    plannedDurationSec: 60,
    startedAt: iso(-60_000),
    endedAt: new Date().toISOString(),
    completed: true,
    outcome: "completed",
    originCheckinId: mood.id,
  };
  const forbiddenOrigin = await call(
    "/records/sessions",
    "POST",
    session,
    other,
  );
  assert.equal(forbiddenOrigin.status, 404);
  assert.equal(
    (await forbiddenOrigin.json()).code,
    "PRACTICE_ORIGIN_NOT_FOUND",
  );
  assert.equal(
    (
      await call(
        "/records/sessions",
        "POST",
        { ...session, durationSec: 200 },
        owner,
      )
    ).status,
    400,
  );
  const chat = await call(
    "/chat",
    "POST",
    { text: "An isolated practice" },
    owner,
  );
  assert.equal(chat.status, 200);
  const { conversation } = await chat.json();
  const linked = { ...session, sourceConversationId: conversation.id };
  const saved = await call("/records/sessions", "POST", linked, owner);
  assert.equal(saved.status, 201);
  const savedPayload = await saved.json();
  assert.equal(savedPayload.record.originCheckinId, mood.id);
  assert.equal(savedPayload.habitGarden[0].earnedTotal, 1);
  const retried = await call("/records/sessions", "POST", linked, owner);
  assert.equal(retried.status, 200);
  assert.equal((await retried.json()).habitGarden[0].earnedTotal, 1);
  assert.equal(
    (
      await call(
        `/records/sessions/${session.id}`,
        "PATCH",
        { originCheckinId: "replacement" },
        owner,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await call(
        `/records/conversations/${conversation.id}`,
        "DELETE",
        undefined,
        owner,
      )
    ).status,
    204,
  );
  const recheck = {
    response: "more-settled",
    recordedAt: new Date().toISOString(),
  };
  assert.equal(
    (
      await call(
        `/records/sessions/${session.id}`,
        "PATCH",
        { emotionalRecheck: recheck },
        other,
      )
    ).status,
    404,
  );
  const response = await call(
    `/records/sessions/${session.id}`,
    "PATCH",
    { emotionalRecheck: recheck },
    owner,
  );
  assert.equal(response.status, 200);
  const repeated = await call(
    `/records/sessions/${session.id}`,
    "PATCH",
    { emotionalRecheck: { ...recheck, recordedAt: iso(10_000) } },
    owner,
  );
  assert.equal(repeated.status, 200);
  assert.deepEqual((await repeated.json()).record.emotionalRecheck, recheck);
  assert.equal(
    (
      await call(
        `/records/sessions/${session.id}`,
        "PATCH",
        { emotionalRecheck: { ...recheck, response: "less-settled" } },
        owner,
      )
    ).status,
    409,
  );
  const state = (await (await call("/state", "GET", undefined, owner)).json())
    .data;
  assert.equal(state.sessions.length, 1);
  assert.equal(state.checkins.length, 1);
  assert.deepEqual(state.sessions[0].emotionalRecheck, recheck);
  assert.equal(state.sessions[0].sourceConversationId, conversation.id);
  assert.equal(state.gardenIntentions[0].contributors[0].recordId, session.id);
  assert.equal(state.habitGarden[0].earnedTotal, 1);
});
