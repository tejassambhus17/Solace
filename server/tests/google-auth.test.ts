import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createHash,
  generateKeyPairSync,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SignJWT, type JWTPayload } from "jose";
import request from "supertest";
import { createApp } from "../src/app.js";
import { Store } from "../src/database.js";
import {
  readGoogleOAuthConfig,
  type GoogleOAuthConfig,
} from "../src/google-auth.js";

const oauth: GoogleOAuthConfig = {
  clientId: "123456789-examplefixture.apps.googleusercontent.com",
  clientSecret: "synthetic-oauth-secret",
  redirectUri: "https://solace.example/api/auth/google/callback",
};
const key = generateKeyPairSync("rsa", { modulusLength: 2048 });
const attacker = generateKeyPairSync("rsa", { modulusLength: 2048 });
const kid = "test-provider-key";
const jwk = {
  ...key.publicKey.export({ format: "jwk" }),
  kid,
  alg: "RS256",
  use: "sig",
};
const auth = "/api/auth/google";
const returnUri = "solace://google-auth";
const digest = (value: string) => createHash("sha256").update(value, "ascii");
const proof = (value: string) => digest(value).digest("base64url");

type Flow = {
  id: string;
  state: string;
  verifier: string;
  url: URL;
  handoff?: string;
};
function receiveBrowserHandoff(flow: Flow, location?: string) {
  if (!location?.startsWith(returnUri + "?")) return;
  const redirect = new URL(location);
  assert.deepEqual([...redirect.searchParams.keys()], ["handoff"]);
  const handoff = redirect.searchParams.get("handoff")!;
  assert.match(handoff, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(handoff, flow.id);
  assert.notEqual(handoff, flow.verifier);
  flow.handoff = handoff;
}
type TokenFixture = {
  flow: Flow;
  claims?: JWTPayload;
  signWithAttacker?: boolean;
  typ?: string;
  tokenType?: string;
  omitIdentityToken?: boolean;
  providerFailure?: boolean;
  waitFor?: Promise<void>;
  exchanging?: () => void;
};

async function fixture(file = ":memory:", enabled = true) {
  const store = await Store.open(file);
  const pending = new Map<string, TokenFixture>();
  let exchanges = 0;
  const fetcher: typeof fetch = async (input, options) => {
    if (String(input) === "https://www.googleapis.com/oauth2/v3/certs")
      return Response.json({ keys: [jwk] });
    assert.equal(String(input), "https://oauth2.googleapis.com/token");
    assert.equal(options?.method, "POST");
    assert.equal(options.redirect, "error");
    const body = options.body as URLSearchParams;
    const code = body.get("code")!;
    const attempt = pending.get(code);
    assert.ok(attempt);
    pending.delete(code);
    exchanges += 1;
    assert.equal(body.get("client_id"), oauth.clientId);
    assert.equal(body.get("redirect_uri"), oauth.redirectUri);
    assert.equal(body.get("grant_type"), "authorization_code");
    assert.equal(
      proof(body.get("code_verifier")!),
      attempt.flow.url.searchParams.get("code_challenge"),
    );
    assert.notEqual(body.get("code_verifier"), attempt.flow.verifier);
    attempt.exchanging?.();
    await attempt.waitFor;
    if (attempt.providerFailure)
      throw new TypeError("Synthetic network failure");
    const accessToken = "test-only-provider-access-token";
    const seconds = Math.floor(Date.now() / 1000);
    const jwt = await new SignJWT({
      iss: "https://accounts.google.com",
      aud: oauth.clientId,
      iat: seconds,
      exp: seconds + 600,
      sub: "google-subject-001",
      nonce: attempt.flow.url.searchParams.get("nonce"),
      email: "first@example.test",
      email_verified: true,
      name: "Fixture Account",
      at_hash: digest(accessToken)
        .digest()
        .subarray(0, 16)
        .toString("base64url"),
      ...attempt.claims,
    })
      .setProtectedHeader({
        alg: "RS256",
        kid,
        ...(attempt.typ && { typ: attempt.typ }),
      })
      .sign(attempt.signWithAttacker ? attacker.privateKey : key.privateKey);
    return Response.json({
      token_type: attempt.tokenType ?? "Bearer",
      id_token: attempt.omitIdentityToken ? undefined : jwt,
      access_token: accessToken,
    });
  };
  const app = createApp({
    store,
    ai: {
      mode: "offline",
      model: "test",
      baseUrl: "https://api.openai.com/v1",
    },
    googleOAuth: enabled ? oauth : undefined,
    googleFetch: fetcher,
    rateLimits: false,
  });
  const api = request(app);
  const register = async (email: string) =>
    (
      await api
        .post("/api/auth/register")
        .send({
          email,
          name: "Password account",
          password: "synthetic password",
        })
        .expect(201)
    ).body;
  const start = async (ownerToken?: string): Promise<Flow> => {
    const verifier = randomBytes(32).toString("base64url");
    const operation = api.post(auth + (ownerToken ? "/link/start" : "/start"));
    if (ownerToken) operation.auth(ownerToken, { type: "bearer" });
    const { body } = await operation
      .send({ challenge: proof(verifier) })
      .expect(200);
    const browser = new URL(body.url);
    assert.equal(
      browser.href,
      new URL(`${auth}/browser/${body.id}`, oauth.redirectUri).href,
    );
    const entry = await api
      .get(browser.pathname)
      .expect(303)
      .expect("Cache-Control", "no-store");
    const url = new URL(entry.headers.location);
    assert.equal(url.origin, "https://accounts.google.com");
    const state = url.searchParams.get("state")!;
    assert.match(state, /^[A-Za-z0-9_-]{43}$/);
    assert.notEqual(state, body.id);
    assert.equal(url.searchParams.get("redirect_uri"), oauth.redirectUri);
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.equal(url.searchParams.get("scope"), "openid email profile");
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    assert.notEqual(url.searchParams.get("code_challenge"), proof(verifier));
    assert.notEqual(url.searchParams.get("nonce"), body.id);
    return { id: body.id, state, verifier, url };
  };
  const callback = (flow: Flow, options: Omit<TokenFixture, "flow"> = {}) => {
    const code = randomUUID();
    pending.set(code, { flow, ...options });
    return api
      .get(auth + "/callback")
      .query({ code, state: flow.state })
      .expect(({ headers }) => receiveBrowserHandoff(flow, headers.location));
  };
  const redeem = (flow: Flow, ownerToken?: string) => {
    const operation = api.post(
      auth + (ownerToken ? "/link/complete" : "/complete"),
    );
    if (ownerToken) operation.auth(ownerToken, { type: "bearer" });
    return operation.send({
      id: flow.id,
      verifier: flow.verifier,
      handoff: flow.handoff ?? "a".repeat(43),
    });
  };
  return {
    store,
    api,
    register,
    start,
    callback,
    redeem,
    exchanges: () => exchanges,
  };
}

test("Google configuration accepts only a full HTTPS callback configuration and leaves email auth available", async (t) => {
  const env = {
    GOOGLE_OAUTH_CLIENT_ID: oauth.clientId,
    GOOGLE_OAUTH_CLIENT_SECRET: oauth.clientSecret,
    GOOGLE_OAUTH_REDIRECT_URI: oauth.redirectUri,
  };
  assert.deepEqual(readGoogleOAuthConfig(env), oauth);
  for (const redirect of [
    "http://solace.example/api/auth/google/callback",
    "https://localhost/api/auth/google/callback",
    "https://127.0.0.1/api/auth/google/callback",
    "https://solace.example/api/auth/google/callback?return=elsewhere",
    "https://solace.example/other-path",
    "https://user@solace.example/api/auth/google/callback",
  ])
    assert.equal(
      readGoogleOAuthConfig({ ...env, GOOGLE_OAUTH_REDIRECT_URI: redirect }),
      undefined,
    );
  assert.equal(
    readGoogleOAuthConfig({ ...env, GOOGLE_OAUTH_CLIENT_SECRET: "" }),
    undefined,
  );
  const f = await fixture(":memory:", false);
  t.after(() => f.store.close());
  await f.api.get(auth + "/config").expect(200, { enabled: false });
  await f.api
    .post(auth + "/start")
    .send({})
    .expect(503)
    .expect(({ body }) => assert.equal(body.code, "GOOGLE_UNAVAILABLE"));
  const account = await f.register("email-login@example.test");
  await f.api
    .post("/api/auth/login")
    .send({ email: account.user.email, password: "synthetic password" })
    .expect(200);
});

test("browser callback requires state, preserves the native return boundary, and can redeem only once with proof", async (t) => {
  const f = await fixture();
  t.after(() => f.store.close());
  await f.api.get(auth + "/config").expect(200, { enabled: true });
  await f.api
    .post(auth + "/start")
    .send({ challenge: "too-short", email: "injected@example.test" })
    .expect(400);
  await f.api
    .get(auth + "/callback")
    .query({ code: "forged", state: "a".repeat(43) })
    .expect(400);
  await f.api.get(auth + "/browser/" + "a".repeat(43)).expect(400);
  assert.equal(f.exchanges(), 0);
  const flow = await f.start();
  await f.api
    .get(auth + "/callback")
    .query({ code: "forged", state: flow.id })
    .expect(400);
  await f
    .redeem(flow)
    .expect(409)
    .expect(({ body }) => assert.equal(body.code, "GOOGLE_PENDING"));
  const browserCallback = await f
    .callback(flow)
    .set("User-Agent", "Mozilla/5.0 (Linux; Android 15)")
    .expect(303)
    .expect("Location", auth + "/return");
  const [cookie] = browserCallback.headers["set-cookie"] as unknown as string[];
  assert.match(cookie, /^__Secure-solace-google-handoff=[A-Za-z0-9_-]{43};/);
  assert.match(cookie, /Max-Age=120/);
  assert.match(cookie, /Path=\/api\/auth\/google\/return/);
  assert.match(cookie, /HttpOnly; Secure; SameSite=Lax/);
  // The app that originally started this flow cannot redeem the Google
  // authorization if only a different browser saw the callback.
  await f.api
    .post(auth + "/complete")
    .send({ id: flow.id, verifier: flow.verifier })
    .expect(400);
  await f
    .redeem(flow)
    .expect(400)
    .expect(({ body }) => assert.equal(body.code, "GOOGLE_FLOW_INVALID"));
  await f.api
    .get(auth + "/return")
    .expect(200)
    .expect(({ text }) => assert.equal(text.includes("?handoff="), false));
  const browserReturn = await f.api
    .get(auth + "/return")
    .set("Cookie", cookie.split(";")[0])
    .expect(200)
    .expect("Cache-Control", "no-store")
    .expect("Referrer-Policy", "no-referrer")
    .expect(({ text }) => {
      receiveBrowserHandoff(
        flow,
        text.match(
          /href="(solace:\/\/google-auth\?handoff=[A-Za-z0-9_-]{43})"/,
        )?.[1],
      );
      assert.ok(flow.handoff);
      assert.equal(text.includes(flow.id), false);
      assert.equal(text.includes(flow.verifier), false);
    });
  const [expiredCookie] = browserReturn.headers[
    "set-cookie"
  ] as unknown as string[];
  assert.match(
    expiredCookie,
    /^__Secure-solace-google-handoff=;.*Expires=Thu, 01 Jan 1970/,
  );
  await f.callback(flow).expect(400);
  await f.api.get(auth + "/browser/" + flow.id).expect(400);
  assert.equal(f.exchanges(), 1);
  await f.redeem({ ...flow, verifier: "a".repeat(43) }).expect(400);
  const results = await Promise.all([f.redeem(flow), f.redeem(flow)]);
  assert.deepEqual(
    results.map((response) => response.status).sort(),
    [200, 400],
  );
  const account = results.find((response) => response.status === 200)!.body;
  assert.equal(account.user.email, "first@example.test");
  assert.equal(account.user.password, undefined);
  assert.equal(f.store.all("SELECT id FROM users").length, 1);
  await f.api
    .get("/api/auth/me")
    .auth(account.token, { type: "bearer" })
    .expect(200, { user: account.user });
  await f.api
    .post("/api/auth/login")
    .send({ email: account.user.email, password: "synthetic password" })
    .expect(401);
  await f.api
    .post("/api/auth/logout")
    .auth(account.token, { type: "bearer" })
    .expect(204);
  await f.api
    .get("/api/auth/me")
    .auth(account.token, { type: "bearer" })
    .expect(401);
});

test("rejects forged, expired, wrong-audience, wrong-issuer, wrong-nonce and non-ID tokens", async (t) => {
  const f = await fixture();
  t.after(() => f.store.close());
  const cases: Omit<TokenFixture, "flow">[] = [
    { signWithAttacker: true },
    { claims: { exp: Math.floor(Date.now() / 1000) - 120 } },
    { claims: { aud: "foreign-client" } },
    { claims: { aud: [oauth.clientId, "foreign-client"] } },
    { claims: { azp: "foreign-client" } },
    { claims: { iss: "https://attacker.example" } },
    { claims: { nonce: "replayed-nonce" } },
    { claims: { email_verified: false } },
    { claims: { at_hash: "unrelated-access-token" } },
    { typ: "at+jwt" },
    { tokenType: "custom" },
    { omitIdentityToken: true },
  ];
  for (const claims of cases) {
    const flow = await f.start();
    await f.callback(flow, claims).expect(303);
    assert.ok(flow.handoff);
    await f
      .redeem(flow)
      .expect(400)
      .expect(({ body }) => assert.equal(body.code, "GOOGLE_IDENTITY_INVALID"));
  }
  assert.equal(f.store.all("SELECT id FROM users").length, 0);
  assert.equal(f.store.all("SELECT hash FROM tokens").length, 0);
});

test("Google denial, expiration and network errors do not create a session", async (t) => {
  const f = await fixture();
  t.after(() => f.store.close());
  const denied = await f.start();
  const denial = await f.api
    .get(auth + "/callback")
    .query({ state: denied.state, error: "access_denied" })
    .expect(303);
  receiveBrowserHandoff(denied, denial.headers.location);
  await f
    .redeem(denied)
    .expect(400)
    .expect(({ body }) => assert.equal(body.code, "GOOGLE_CANCELLED"));
  assert.equal(f.exchanges(), 0);
  const failed = await f.start();
  await f.callback(failed, { providerFailure: true }).expect(303);
  await f
    .redeem(failed)
    .expect(502)
    .expect(({ body }) =>
      assert.equal(body.code, "GOOGLE_PROVIDER_UNAVAILABLE"),
    );
  const expired = await f.start();
  t.mock.method(Date, "now", () => 10 * 60000 + 1 + new Date().getTime());
  await f.callback(expired).expect(400);
  await f
    .redeem(expired)
    .expect(400)
    .expect(({ body }) => assert.equal(body.code, "GOOGLE_FLOW_INVALID"));
  assert.equal(f.store.all("SELECT id FROM users").length, 0);
});

test("Google completion handoffs are scoped to the exact flow and expire after two minutes", async (t) => {
  const f = await fixture();
  t.after(() => f.store.close());
  const first = await f.start();
  await f.callback(first).expect(303);
  const second = await f.start();
  await f.callback(second).expect(303);
  await f.redeem({ ...first, handoff: second.handoff }).expect(400);
  t.mock.method(Date, "now", () => 2 * 60000 + 1 + new Date().getTime());
  await f.redeem(first).expect(400);
  assert.equal(f.store.all("SELECT id FROM users").length, 0);
});

test("email collision requires authenticated linking and ownership survives sign-in and account deletion", async (t) => {
  const f = await fixture();
  t.after(() => f.store.close());
  const original = await f.register("first@example.test");
  const other = await f.register("second@example.test");
  const header = { type: "bearer" } as const;
  const date = new Date().toISOString();
  f.store.transaction(() =>
    f.store.run("INSERT INTO records VALUES(?,?,?,?,?)", [
      "original-record",
      original.user.id,
      "checkins",
      JSON.stringify({ id: "original-record", createdAt: date, mood: "Calm" }),
      date,
    ]),
  );
  const collision = await f.start();
  await f
    .callback(collision, { claims: { email: "FIRST@EXAMPLE.TEST" } })
    .expect(303);
  await f
    .redeem(collision)
    .expect(409)
    .expect(({ body }) => assert.equal(body.code, "GOOGLE_EMAIL_IN_USE"));
  await f.api
    .post(auth + "/link/start")
    .send({ challenge: proof("foreign-verifier") })
    .expect(401);
  await f.api
    .get(auth + "/link")
    .auth(original.token, header)
    .expect(200, { linked: false });
  const linking = await f.start(original.token);
  await f.callback(linking).expect(303);
  await f.redeem(linking).expect(400);
  await f.redeem(linking, other.token).expect(400);
  const secondSession = (
    await f.api
      .post("/api/auth/login")
      .send({ email: original.user.email, password: "synthetic password" })
      .expect(200)
  ).body;
  await f.redeem(linking, secondSession.token).expect(400);
  await f.redeem(linking, original.token).expect(200, { linked: true });
  await f.api
    .get(auth + "/link")
    .auth(original.token, header)
    .expect(200, { linked: true });
  const duplicate = await f.start(other.token);
  await f.callback(duplicate).expect(303);
  await f
    .redeem(duplicate, other.token)
    .expect(409)
    .expect(({ body }) => assert.equal(body.code, "GOOGLE_ALREADY_LINKED"));
  const returning = await f.start();
  await f
    .callback(returning, {
      claims: { email: "renamed@example.test", name: "New name" },
    })
    .expect(303);
  const account = (await f.redeem(returning).expect(200)).body;
  assert.deepEqual(account.user, original.user);
  await f.api
    .get("/api/records/checkins")
    .auth(account.token, header)
    .expect(200)
    .expect(({ body }) => assert.equal(body.records[0]?.id, "original-record"));
  await f.api
    .get("/api/records/checkins")
    .auth(other.token, header)
    .expect(200, { records: [] });
  assert.equal(f.store.all("SELECT id FROM users").length, 2);
  await f.api.delete("/api/account").auth(account.token, header).expect(204);
  assert.equal(f.store.all("SELECT subject FROM google_identities").length, 0);
  await f.api.get("/api/auth/me").auth(original.token, header).expect(401);
  const later = await f.start();
  await f.callback(later).expect(303);
  const newAccount = (await f.redeem(later).expect(200)).body;
  assert.notEqual(newAccount.user.id, original.user.id);
  await f.api
    .get("/api/records/checkins")
    .auth(newAccount.token, header)
    .expect(200, { records: [] });
});

test("revoking the originating session during a callback blocks Google linking", async (t) => {
  const f = await fixture();
  t.after(() => f.store.close());
  const account = await f.register("first@example.test");
  const flow = await f.start(account.token);
  const reached = Promise.withResolvers<void>();
  const resume = Promise.withResolvers<void>();
  const callback = f
    .callback(flow, { waitFor: resume.promise, exchanging: reached.resolve })
    .expect(303)
    .then((response) => response);
  try {
    await reached.promise;
    await f.api
      .post("/api/auth/logout")
      .auth(account.token, { type: "bearer" })
      .expect(204);
  } finally {
    resume.resolve();
  }
  await callback;
  await f.redeem(flow, account.token).expect(401);
  assert.equal(f.store.all("SELECT subject FROM google_identities").length, 0);
});

test("Google subject and session persist in SQLite across API restarts", async (t) => {
  const path = mkdtempSync(join(tmpdir(), "solace-google-test-"));
  t.after(() => rmSync(path, { recursive: true, force: true }));
  const file = join(path, "test.sqlite");
  const f = await fixture(file);
  let account: any;
  try {
    const flow = await f.start();
    await f.callback(flow).expect(303);
    account = (await f.redeem(flow).expect(200)).body;
  } finally {
    f.store.close();
  }
  const restarted = await fixture(file);
  try {
    await restarted.api
      .get("/api/auth/me")
      .auth(account.token, { type: "bearer" })
      .expect(200, { user: account.user });
    const returning = await restarted.start();
    await restarted.callback(returning).expect(303);
    assert.deepEqual(
      (await restarted.redeem(returning).expect(200)).body.user,
      account.user,
    );
    assert.equal(
      restarted.store.all("SELECT subject FROM google_identities").length,
      1,
    );
  } finally {
    restarted.store.close();
  }
});
