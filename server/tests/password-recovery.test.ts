import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { Store } from "../src/database.js";
import { tokenHash } from "../src/auth.js";

const path = "/api/auth/password";
const email = "recovery-test@example.test";
const password = "original-test-only-pass";
const changed = "replacement-test-only-pass";

async function fixture(enabled = true) {
  const store = await Store.open();
  const deliveries: { email: string; code: string }[] = [];
  const app = request(
    createApp({
      store,
      ai: { mode: "offline" },
      rateLimits: false,
      recoveryMailer: enabled
        ? async (email, code) => {
            deliveries.push({ email, code });
          }
        : undefined,
    }),
  );
  const { body: session } = await app
    .post("/api/auth/register")
    .send({ name: "Recovery QA", email, password })
    .expect(201);
  const requestCode = (address = email) =>
    app.post(`${path}/request`).send({ email: address });
  const reset = (code: string, address = email) =>
    app.post(`${path}/reset`).send({ email: address, code, password: changed });
  return { app, store, session, deliveries, requestCode, reset };
}

test("unconfigured recovery reports unavailable and password login still works", async (t) => {
  const f = await fixture(false);
  t.after(() => f.store.close());
  const result = await f.requestCode().expect(503);
  assert.equal(result.body.code, "RECOVERY_UNAVAILABLE");
  await f.app.post("/api/auth/login").send({ email, password }).expect(200);
});

test("recovery is non-enumerating, throttled and stores only a code hash", async (t) => {
  const f = await fixture();
  t.after(() => f.store.close());
  const known = await f.requestCode(email.toUpperCase()).expect(202);
  const unknown = await f.requestCode("unknown@example.test").expect(202);
  assert.deepEqual(known.body, unknown.body);
  await f.requestCode().expect(202);
  assert.equal(f.deliveries.length, 1);
  assert.equal(f.deliveries[0].email, email);
  assert.equal(
    f.store.one<{ hash: string }>("SELECT hash FROM password_reset_codes")
      ?.hash,
    tokenHash(f.deliveries[0].code),
  );
});

test("an expired or reused code fails and a valid reset revokes previous sessions", async (t) => {
  const f = await fixture();
  t.after(() => f.store.close());
  await f.requestCode().expect(202);
  const expired = f.deliveries[0].code;
  f.store.run("UPDATE password_reset_codes SET created_at=0,expires_at=0");
  await f.reset(expired).expect(400);
  await f.requestCode().expect(202);
  const code = f.deliveries[1].code;
  await f.reset(code, "unknown@example.test").expect(400);
  await f.reset(code).expect(200, { reset: true });
  await f.reset(code).expect(400);
  await f.app
    .get("/api/state")
    .set("Authorization", `Bearer ${f.session.token}`)
    .expect(401);
  await f.app.post("/api/auth/login").send({ email, password }).expect(401);
  const loggedIn = await f.app
    .post("/api/auth/login")
    .send({ email, password: changed })
    .expect(200);
  assert.equal(loggedIn.body.user.id, f.session.user.id);
});
