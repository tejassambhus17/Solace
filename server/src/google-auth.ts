import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import {
  Router,
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import { createRemoteJWKSet, customFetch, errors, jwtVerify } from "jose";
import { z } from "zod";
import { newToken, publicUser, tokenHash, type UserRow } from "./auth.js";
import type { Store } from "./database.js";
import { registerSchema } from "./validation.js";

const authorizationEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";
const tokenEndpoint = "https://oauth2.googleapis.com/token";
const googleKeySet = "https://www.googleapis.com/oauth2/v3/certs";
const callbackPath = "/api/auth/google/callback";
const browserReturnPath = "/api/auth/google/return";
const appReturn = "solace://google-auth";
const flowLifetimeMs = 10 * 60 * 1000;
const handoffLifetimeMs = 2 * 60 * 1000;
const maxActiveFlows = 2000;
const handoffCookie = "__Secure-solace-google-handoff";
const handoffCookieOptions = {
  path: browserReturnPath,
  secure: true,
  httpOnly: true,
  sameSite: "lax",
} as const;

export type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export function readGoogleOAuthConfig(
  env: Record<string, string | undefined>,
): GoogleOAuthConfig | undefined {
  const clientId = env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const redirectUri = env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (
    !clientId ||
    !/^\d+(?:-[A-Za-z0-9_-]+)?\.apps\.googleusercontent\.com$/.test(clientId) ||
    !clientSecret ||
    !/^[A-Za-z0-9_-]{10,256}$/.test(clientSecret) ||
    !redirectUri
  )
    return undefined;
  try {
    const url = new URL(redirectUri);
    if (
      url.protocol !== "https:" ||
      !url.hostname.includes(".") ||
      url.hostname.endsWith(".localhost") ||
      isIP(url.hostname.replace(/^\[|\]$/g, "")) ||
      url.pathname !== callbackPath ||
      url.search ||
      url.hash ||
      url.username ||
      url.password ||
      url.href !== redirectUri
    )
      return undefined;
    return { clientId, clientSecret, redirectUri };
  } catch {
    return undefined;
  }
}

const proof = (verifier: string) =>
  createHash("sha256").update(verifier, "ascii").digest("base64url");
const randomKey = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const startBody = z.object({ challenge: randomKey }).strict();
const redeemBody = z
  .object({
    id: randomKey,
    verifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/),
    handoff: randomKey,
  })
  .strict();

const failures = {
  GOOGLE_UNAVAILABLE: [
    503,
    "Google sign-in is unavailable. You can still use email sign-in.",
  ],
  GOOGLE_FLOW_INVALID: [
    400,
    "This Google sign-in request has expired or is invalid. Please start again.",
  ],
  GOOGLE_PENDING: [409, "Google sign-in is still finishing. Please try again."],
  GOOGLE_CANCELLED: [400, "Google sign-in was cancelled."],
  GOOGLE_PROVIDER_UNAVAILABLE: [
    502,
    "We could not connect to Google. Please try again.",
  ],
  GOOGLE_IDENTITY_INVALID: [
    400,
    "We could not verify this Google account. Please try again.",
  ],
  GOOGLE_EMAIL_IN_USE: [
    409,
    "An account already uses this email. Sign in to that account first, then link Google in Account settings.",
  ],
  GOOGLE_ALREADY_LINKED: [
    409,
    "This Google account or Solace account is already linked to a different account.",
  ],
  GOOGLE_BUSY: [
    429,
    "Too many Google sign-in requests. Please try again shortly.",
  ],
} as const;
type Failure = keyof typeof failures;

function reject(res: Response, code: Failure) {
  const [status, error] = failures[code];
  return res.status(status).json({ error, code });
}

type Identity = { subject: string; email: string; name: string };
type Binding = { owner: string; sessionHash: string };
type Outcome =
  | { status: "pending" | "exchanging" }
  | { status: "ready"; identity: Identity }
  | { status: "failed"; code: Failure };
type Flow = {
  state: string;
  nonce: string;
  pkceVerifier: string;
  appChallenge: string;
  expires: number;
  binding?: Binding;
  handoffDigest?: string;
  outcome: Outcome;
};
type AuthRequest = Request & { user?: UserRow; token?: string };

class InvalidIdentity extends Error {}

function googleIdentityVerifier(
  config: GoogleOAuthConfig,
  fetcher: typeof fetch,
) {
  const jwks = createRemoteJWKSet(new URL(googleKeySet), {
    [customFetch]: fetcher,
    timeoutDuration: 5000,
  });
  return async (code: string, flow: Flow): Promise<Identity> => {
    const response = await fetcher(tokenEndpoint, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code",
        code_verifier: flow.pkceVerifier,
        code,
      }),
    });
    if (!response.ok) throw new Error("Google token exchange failed");
    const tokens = z
      .object({
        id_token: z.string().min(1).max(16384),
        token_type: z
          .string()
          .refine((value) => value.toLowerCase() === "bearer"),
        access_token: z.string().min(1).max(8192).optional(),
      })
      .safeParse(await response.json());
    if (!tokens.success) throw new InvalidIdentity();
    const { payload, protectedHeader } = await jwtVerify(
      tokens.data.id_token,
      jwks,
      {
        algorithms: ["RS256"],
        issuer: ["https://accounts.google.com", "accounts.google.com"],
        audience: config.clientId,
        requiredClaims: ["exp", "iat", "sub", "nonce"],
        maxTokenAge: "10 minutes",
        clockTolerance: 10,
      },
    );
    const accessToken = tokens.data.access_token;
    const accessTokenHash =
      accessToken &&
      createHash("sha256")
        .update(accessToken, "ascii")
        .digest()
        .subarray(0, 16)
        .toString("base64url");
    const email = registerSchema.shape.email.safeParse(payload.email);
    if (
      (protectedHeader.typ !== undefined && protectedHeader.typ !== "JWT") ||
      payload.aud !== config.clientId ||
      (payload.azp !== undefined && payload.azp !== config.clientId) ||
      payload.nonce !== flow.nonce ||
      !payload.sub ||
      payload.sub.length > 255 ||
      payload.email_verified !== true ||
      !email.success ||
      (payload.at_hash !== undefined &&
        (!accessTokenHash || payload.at_hash !== accessTokenHash))
    )
      throw new InvalidIdentity();
    const name =
      typeof payload.name === "string"
        ? payload.name
            .replace(/[\u0000-\u001F\u007F]/g, "")
            .trim()
            .slice(0, 80)
            .replace(/[\uD800-\uDBFF]$/, "")
        : "";
    return {
      subject: payload.sub,
      email: email.data,
      name: name || "Solace user",
    };
  };
}

const nativeReturn = (handoff: string) => `${appReturn}?handoff=${handoff}`;

function returnToApp(req: Request, res: Response, flow: Flow) {
  // The app must prove it also received the result from the callback browser.
  // Knowing the app verifier alone cannot complete a forwarded login URL.
  const handoff = newToken();
  flow.handoffDigest = tokenHash(handoff);
  flow.expires = Math.min(flow.expires, Date.now() + handoffLifetimeMs);
  // Android browsers can require a user gesture before opening an app link.
  // Keep the handoff and Google's code out of the visible web URL.
  if (/\bAndroid\b/i.test(req.get("user-agent") ?? "")) {
    res.cookie(handoffCookie, handoff, {
      ...handoffCookieOptions,
      maxAge: handoffLifetimeMs,
    });
    return res.status(303).location(browserReturnPath).end();
  }
  return res.status(303).location(nativeReturn(handoff)).end();
}

function returnPage(req: Request, res: Response) {
  const cookies = (req.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${handoffCookie}=`));
  const handoff = randomKey.safeParse(
    cookies.length === 1
      ? cookies[0].slice(handoffCookie.length + 1)
      : undefined,
  );
  res.clearCookie(handoffCookie, handoffCookieOptions);
  const content = handoff.success
    ? `<p>Go back to the app to finish Google sign-in.</p><a href="${nativeReturn(handoff.data)}">Open Solace</a>`
    : `<p>This Google sign-in request has expired. Open Solace to try again.</p>`;
  return res.type("html").send(`<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Return to Solace</title><style>
body{background:#fbf0e8;color:#183a2b;font:1rem/1.6 system-ui;margin:0;padding:3rem 1.5rem}
main{max-width:28rem;margin:auto}h1{font:2rem Georgia,serif}
a{display:inline-block;background:#2d5038;color:#fff9ec;padding:.8rem 1.4rem;border-radius:2rem}
@media(prefers-color-scheme:dark){body{background:#141225;color:#f4eee6}a{background:#e7c7a8;color:#2b211a}}
</style></head><body><main><h1>Return to Solace</h1>${content}</main></body></html>`);
}

export function createGoogleAuthRoutes({
  store,
  config,
  fetcher = fetch,
  issueToken,
  authLimit,
}: {
  store: Store;
  config?: GoogleOAuthConfig;
  fetcher?: typeof fetch;
  issueToken: (owner: string) => string;
  authLimit: RequestHandler;
}) {
  const publicRoutes = Router();
  const linkedRoutes = Router();
  const flows = new Map<string, Flow>();
  const browserStates = new Map<string, string>();
  const verifyIdentity = config && googleIdentityVerifier(config, fetcher);

  function deleteFlow(id: string, flow: Flow) {
    flows.delete(id);
    browserStates.delete(flow.state);
  }

  function activeFlow(id: string) {
    const flow = flows.get(id);
    if (flow && flow.expires <= Date.now()) {
      deleteFlow(id, flow);
      return undefined;
    }
    return flow;
  }

  const sessionStillActive = (binding: Binding) =>
    Boolean(
      store.one(
        "SELECT 1 FROM tokens WHERE user_id=? AND hash=? AND expires_at>?",
        [binding.owner, binding.sessionHash, Date.now()],
      ),
    );
  const linkBinding = (req: AuthRequest): Binding => ({
    owner: req.user!.id,
    sessionHash: tokenHash(req.token!),
  });

  function start(req: Request, res: Response, binding?: Binding) {
    if (!config) return reject(res, "GOOGLE_UNAVAILABLE");
    const { challenge } = startBody.parse(req.body);
    for (const id of flows.keys()) activeFlow(id);
    if (flows.size >= maxActiveFlows) return reject(res, "GOOGLE_BUSY");
    const id = newToken();
    const state = newToken();
    flows.set(id, {
      state,
      nonce: newToken(),
      pkceVerifier: newToken(),
      appChallenge: challenge,
      expires: Date.now() + flowLifetimeMs,
      binding,
      outcome: { status: "pending" },
    });
    browserStates.set(state, id);
    const url = new URL(`/api/auth/google/browser/${id}`, config.redirectUri);
    return res.json({ id, url: url.href });
  }

  function beginBrowser(req: Request, res: Response) {
    if (!config) return reject(res, "GOOGLE_UNAVAILABLE");
    const id = randomKey.safeParse(req.params.id);
    const flow = id.success && activeFlow(id.data);
    if (
      !flow ||
      flow.outcome.status !== "pending" ||
      (flow.binding && !sessionStillActive(flow.binding))
    )
      return reject(res, "GOOGLE_FLOW_INVALID");
    const url = new URL(authorizationEndpoint);
    url.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state: flow.state,
      nonce: flow.nonce,
      code_challenge: proof(flow.pkceVerifier),
      code_challenge_method: "S256",
      prompt: "select_account",
      access_type: "online",
    }).toString();
    return res.status(303).location(url.href).end();
  }

  async function callback(req: Request, res: Response) {
    if (!verifyIdentity) return reject(res, "GOOGLE_UNAVAILABLE");
    const state = randomKey.safeParse(req.query.state);
    const id = state.success && browserStates.get(state.data);
    const flow = id && activeFlow(id);
    if (!flow || flow.outcome.status !== "pending")
      return reject(res, "GOOGLE_FLOW_INVALID");
    browserStates.delete(flow.state);
    if (req.query.error === "access_denied") {
      flow.outcome = { status: "failed", code: "GOOGLE_CANCELLED" };
      return returnToApp(req, res, flow);
    }
    const code = z.string().min(1).max(4096).safeParse(req.query.code);
    if (!code.success || req.query.error !== undefined) {
      flow.outcome = { status: "failed", code: "GOOGLE_PROVIDER_UNAVAILABLE" };
      return returnToApp(req, res, flow);
    }
    if (flow.binding && !sessionStillActive(flow.binding)) {
      flow.outcome = { status: "failed", code: "GOOGLE_FLOW_INVALID" };
      return returnToApp(req, res, flow);
    }
    // Consume the browser state before awaiting Google so duplicate callbacks
    // cannot exchange the same code or race to replace the verified identity.
    flow.outcome = { status: "exchanging" };
    try {
      const identity = await verifyIdentity(code.data, flow);
      if (
        flow.expires <= Date.now() ||
        (flow.binding && !sessionStillActive(flow.binding))
      )
        flow.outcome = { status: "failed", code: "GOOGLE_FLOW_INVALID" };
      else flow.outcome = { status: "ready", identity };
    } catch (error) {
      // Provider error objects can contain auth request data. Keep them out of logs.
      const invalid =
        error instanceof InvalidIdentity ||
        (error instanceof errors.JOSEError &&
          !(error instanceof errors.JWKSTimeout));
      flow.outcome = {
        status: "failed",
        code: invalid
          ? "GOOGLE_IDENTITY_INVALID"
          : "GOOGLE_PROVIDER_UNAVAILABLE",
      };
    }
    return returnToApp(req, res, flow);
  }

  function redeem(req: Request, res: Response, binding?: Binding) {
    if (!config) return reject(res, "GOOGLE_UNAVAILABLE");
    const { id, verifier, handoff } = redeemBody.parse(req.body);
    const flow = activeFlow(id);
    if (
      !flow ||
      flow.binding?.owner !== binding?.owner ||
      flow.binding?.sessionHash !== binding?.sessionHash ||
      !timingSafeEqual(
        Buffer.from(flow.appChallenge),
        Buffer.from(proof(verifier)),
      )
    )
      return reject(res, "GOOGLE_FLOW_INVALID");
    const outcome = flow.outcome;
    if (outcome.status === "pending" || outcome.status === "exchanging")
      return reject(res, "GOOGLE_PENDING");
    if (
      !flow.handoffDigest ||
      !timingSafeEqual(
        Buffer.from(flow.handoffDigest, "hex"),
        Buffer.from(tokenHash(handoff), "hex"),
      )
    )
      return reject(res, "GOOGLE_FLOW_INVALID");
    // Never store or replay a bearer token. A lost response can safely retry
    // with a fresh Google flow and reach the same account by subject.
    deleteFlow(id, flow);
    if (outcome.status === "failed") return reject(res, outcome.code);
    if (outcome.status !== "ready") return reject(res, "GOOGLE_FLOW_INVALID");

    const { subject, email, name } = outcome.identity;
    const subjectOwner = store.one<UserRow>(
      "SELECT u.* FROM users u JOIN google_identities g ON g.user_id=u.id WHERE g.subject=?",
      [subject],
    );
    if (binding && subjectOwner?.id === binding.owner)
      return res.json({ linked: true });
    if (
      binding &&
      (subjectOwner ||
        store.one("SELECT 1 FROM google_identities WHERE user_id=?", [
          binding.owner,
        ]))
    )
      return reject(res, "GOOGLE_ALREADY_LINKED");

    const emailOwner = store.one<{ id: string }>(
      "SELECT id FROM users WHERE email=?",
      [email],
    );
    if (!subjectOwner && emailOwner && emailOwner.id !== binding?.owner)
      return reject(res, "GOOGLE_EMAIL_IN_USE");
    const insertIdentity = (owner: string) =>
      store.run("INSERT INTO google_identities(subject,user_id) VALUES(?,?)", [
        subject,
        owner,
      ]);
    if (binding) {
      store.transaction(() => insertIdentity(binding.owner));
      return res.json({ linked: true });
    }
    const owner = subjectOwner?.id ?? randomUUID();
    const result = store.transaction(() => {
      if (!subjectOwner) {
        // Google-only accounts have no password credential. Email/password
        // login performs the normal dummy scrypt operation for this marker.
        store.run(
          "INSERT INTO users(id,email,name,password,created_at) VALUES(?,?,?,?,?)",
          [owner, email, name, "", new Date().toISOString()],
        );
        insertIdentity(owner);
      }
      const row =
        subjectOwner ??
        store.one<UserRow>("SELECT * FROM users WHERE id=?", [owner])!;
      return { token: issueToken(owner), user: publicUser(row) };
    });
    return res.json(result);
  }

  publicRoutes.get("/config", (_req, res) => res.json({ enabled: !!config }));
  publicRoutes.post("/start", authLimit, (req, res) => start(req, res));
  publicRoutes.get("/browser/:id", authLimit, beginBrowser);
  publicRoutes.get("/callback", authLimit, (req, res, next) => {
    void callback(req, res).catch(next);
  });
  publicRoutes.get("/return", returnPage);
  publicRoutes.post("/complete", authLimit, (req, res) => redeem(req, res));
  linkedRoutes.get("/link", (req: AuthRequest, res) =>
    res.json({
      linked: Boolean(
        store.one("SELECT 1 FROM google_identities WHERE user_id=?", [
          req.user!.id,
        ]),
      ),
    }),
  );
  linkedRoutes.post("/link/start", authLimit, (req: AuthRequest, res) =>
    start(req, res, linkBinding(req)),
  );
  linkedRoutes.post("/link/complete", authLimit, (req: AuthRequest, res) =>
    redeem(req, res, linkBinding(req)),
  );
  return { publicRoutes, linkedRoutes };
}
