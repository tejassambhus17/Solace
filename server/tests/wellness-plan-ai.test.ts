import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { Store } from "../src/database.js";
import { planTaskActivity } from "../src/wellness-plans.js";

const preference = {
  goal: "calm",
  preferredFocuses: ["calm", "sleep"],
  dailyMinutes: 10,
};

test("OpenAI previews build canonical activities without writing the user's plan", async () => {
  const store = await Store.open(":memory:");
  const api = request(
    createApp({
      store,
      ai: {
        mode: "live",
        model: "test-chat",
        lightModel: "test-structured",
        apiKey: "test-key",
        baseUrl: "https://provider.invalid/v1",
      },
      rateLimits: false,
    }),
  );
  const original = globalThis.fetch;
  let calls = 0;
  let focuses = ["sleep", "calm", "sleep"];
  globalThis.fetch = async (url, init) => {
    calls += 1;
    assert.equal(String(url), "https://provider.invalid/v1/responses");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, "test-structured");
    assert.equal(body.store, false);
    assert.deepEqual(JSON.parse(body.input), preference);
    assert.equal(body.text.format.strict, true);
    return Response.json({
      status: "completed",
      output: [
        {
          type: "message",
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text: JSON.stringify({ focuses }) }],
        },
      ],
    });
  };
  try {
    await api.post("/api/plans/preview").send(preference).expect(401);
    const account = await api
      .post("/api/auth/register")
      .send({
        name: "Plan QA",
        email: "openai-plan@example.test",
        password: "test-plan-password",
      })
      .expect(201);
    const authorization = `Bearer ${account.body.token}`;
    await api
      .post("/api/plans/preview")
      .set("Authorization", authorization)
      .send({ ...preference, preferredFocuses: ["calm", "calm"] })
      .expect(400);
    assert.equal(calls, 0);
    const preview = await api
      .post("/api/plans/preview")
      .set("Authorization", authorization)
      .send(preference)
      .expect(200);
    assert.equal(preview.body.provider, "live");
    assert.deepEqual(
      preview.body.tasks.map((task) => task.focus),
      focuses,
    );
    assert.deepEqual(
      preview.body.tasks.map((task) => task.id),
      ["day-1", "day-2", "day-3"],
    );
    for (const task of preview.body.tasks)
      assert.equal(planTaskActivity(task)?.durationSec, 600);

    focuses = ["calm", "unknown", "sleep"];
    await api
      .post("/api/plans/preview")
      .set("Authorization", authorization)
      .send(preference)
      .expect(502);
    assert.equal(calls, 2);
    assert.equal(
      store.one<{ count: number }>(
        "SELECT count(*) AS count FROM records WHERE collection = 'plans'",
      )?.count,
      0,
    );
  } finally {
    globalThis.fetch = original;
    store.close();
  }
});

test("a rejected plan generation does not retry after account logout", async () => {
  const store = await Store.open(":memory:");
  const api = request(
    createApp({
      store,
      ai: {
        mode: "live",
        model: "test-chat",
        apiKey: "test-key",
        baseUrl: "https://provider.invalid/v1",
      },
      rateLimits: false,
    }),
  );
  const original = globalThis.fetch;
  const started = Promise.withResolvers<void>();
  const rejected = Promise.withResolvers<Response>();
  let calls = 0;
  try {
    const account = await api
      .post("/api/auth/register")
      .send({
        name: "Plan QA",
        email: "revoked-plan@example.test",
        password: "test-plan-password",
      })
      .expect(201);
    const authorization = `Bearer ${account.body.token}`;
    globalThis.fetch = async () => {
      calls += 1;
      started.resolve();
      return rejected.promise.then((response) => response.clone());
    };
    const preview = api
      .post("/api/plans/preview")
      .set("Authorization", authorization)
      .send(preference)
      .then((response) => response);
    await started.promise;
    await api
      .post("/api/auth/logout")
      .set("Authorization", authorization)
      .expect(204);
    rejected.resolve(
      Response.json(
        { error: { message: "Fixture rate limit" } },
        { status: 429, headers: { "retry-after-ms": "1" } },
      ),
    );
    assert.equal((await preview).status, 429);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = original;
    store.close();
  }
});

test("a built-in preview is explicitly marked offline", async () => {
  const store = await Store.open(":memory:");
  try {
    const api = request(createApp({ store, ai: { mode: "offline" } }));
    const account = await api
      .post("/api/auth/register")
      .send({
        name: "Offline Plan QA",
        email: "built-in-plan@example.test",
        password: "test-plan-password",
      })
      .expect(201);
    const result = await api
      .post("/api/plans/preview")
      .set("Authorization", `Bearer ${account.body.token}`)
      .send(preference)
      .expect(200);
    assert.equal(result.body.provider, "offline");
    assert.deepEqual(
      result.body.tasks.map((task) => task.focus),
      ["calm", "sleep", "calm"],
    );
  } finally {
    store.close();
  }
});
