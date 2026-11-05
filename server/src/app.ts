import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { z, ZodError } from "zod";
import { Store } from "./database.js";
import {
  hashPassword,
  verifyPassword,
  newToken,
  tokenHash,
  publicUser,
  type UserRow,
} from "./auth.js";
import {
  collections,
  collectionSchema,
  idSchema,
  registerSchema,
  loginSchema,
  parseRecord,
  type Collection,
} from "./validation.js";
import { getReply, provider, type AIConfig, type Message } from "./ai.js";
import { AvatarError, prepareAvatar } from "./avatar.js";

type RecordData = Record<string, unknown> & { id: string; createdAt: string };
type AuthRequest = Request & { user?: UserRow; token?: string };
export type AppConfig = {
  store: Store;
  ai: AIConfig;
  allowedOrigins?: string[];
  rateLimits?: boolean;
  trustProxyHops?: number;
};
const asyncRoute =
  (
    handler: (
      req: AuthRequest,
      res: Response,
      next: NextFunction,
    ) => Promise<unknown>,
  ) =>
  (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch(next);
  };
const apiError = (
  res: Response,
  status: number,
  message: string,
  code: string,
) => res.status(status).json({ error: message, code });

export function createApp(config: AppConfig) {
  const app = express();
  const store = config.store;
  const proxyHops = config.trustProxyHops ?? 0;
  if (!Number.isInteger(proxyHops) || proxyHops < 0 || proxyHops > 3) {
    throw new Error("TRUST_PROXY_HOPS must be an integer from 0 to 3.");
  }
  app.set("trust proxy", proxyHops === 0 ? false : proxyHops);
  app.disable("x-powered-by");
  app.use(helmet());
  const allowed = config.allowedOrigins ?? [
    "http://localhost:8081",
    "http://localhost:8082",
    "http://localhost:19006",
    "http://127.0.0.1:8081",
    "http://127.0.0.1:8082",
    "http://127.0.0.1:19006",
  ];
  app.use(
    cors({
      origin(origin, callback) {
        callback(null, !origin || allowed.includes(origin));
      },
    }),
  );
  // Only the profile-photo endpoint needs room for a bounded base64 image.
  const profileJSON = express.json({ limit: "512kb" });
  app.use("/api/auth/me", (req, res, next) =>
    req.method === "PATCH" ? profileJSON(req, res, next) : next(),
  );
  app.use(express.json({ limit: "200kb" }));
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  if (config.rateLimits !== false)
    app.use(
      "/api",
      rateLimit({
        windowMs: 60000,
        limit: 180,
        standardHeaders: "draft-7",
        legacyHeaders: false,
      }),
    );
  const authLimit =
    config.rateLimits === false
      ? (_req: Request, _res: Response, next: NextFunction) => next()
      : rateLimit({
          windowMs: 15 * 60000,
          limit: 30,
          standardHeaders: "draft-7",
          legacyHeaders: false,
          message: {
            error: "Too many attempts. Please wait before trying again.",
            code: "RATE_LIMITED",
          },
        });
  const user = (req: AuthRequest) => req.user!;
  const list = (owner: string, collection: Collection) =>
    store
      .all<{ json: string }>(
        "SELECT json FROM records WHERE user_id=? AND collection=? ORDER BY created_at DESC",
        [owner, collection],
      )
      .map((r) => JSON.parse(r.json) as RecordData)
      .sort((a, b) => {
        // A continued conversation stays at the top after refreshing or signing
        // in again, just as it does immediately after sending a message.
        if (collection !== "conversations") return 0;
        return (
          Date.parse(String(b.updatedAt || b.createdAt)) -
          Date.parse(String(a.updatedAt || a.createdAt))
        );
      });
  const get = (owner: string, collection: Collection, id: string) => {
    const row = store.one<{ json: string }>(
      "SELECT json FROM records WHERE user_id=? AND collection=? AND id=?",
      [owner, collection, id],
    );
    return row && (JSON.parse(row.json) as RecordData);
  };
  const put = (owner: string, collection: Collection, record: RecordData) =>
    store.run(
      "INSERT INTO records(id,user_id,collection,json,created_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,collection,id) DO UPDATE SET json=excluded.json",
      [record.id, owner, collection, JSON.stringify(record), record.createdAt],
    );
  const validMemorySource = (owner: string, record: RecordData) => {
    if (
      record.sourceConversationId &&
      !get(owner, "conversations", String(record.sourceConversationId))
    )
      return false;
    if (record.sourceType && record.sourceId) {
      const collection =
        record.sourceType === "session" ? "sessions" : "conversations";
      if (!get(owner, collection, String(record.sourceId))) return false;
      if (record.sourceType === "conversation")
        record.sourceConversationId = record.sourceId;
    }
    return true;
  };
  const state = (owner: string) =>
    Object.fromEntries(collections.map((c) => [c, list(owner, c)]));
  const issueToken = (id: string) => {
    const token = newToken();
    store.transaction(() => {
      store.run("DELETE FROM tokens WHERE expires_at < ?", [Date.now()]);
      store.run("INSERT INTO tokens(hash,user_id,expires_at) VALUES(?,?,?)", [
        tokenHash(token),
        id,
        Date.now() + 30 * 86400000,
      ]);
    });
    return token;
  };
  app.get("/api/health", (_req, res) =>
    res.json({
      ok: true,
      service: "Solace API",
      aiProvider: provider(config.ai),
      aiConfigured: !!config.ai.apiKey,
      database: "sqlite",
      version: "1.0.0",
    }),
  );
  app.post(
    "/api/auth/register",
    authLimit,
    asyncRoute(async (req, res) => {
      const input = registerSchema.parse(req.body);
      if (store.one("SELECT id FROM users WHERE email=?", [input.email]))
        return apiError(
          res,
          409,
          "An account with this email already exists.",
          "EMAIL_EXISTS",
        );
      const password = await hashPassword(input.password);
      const id = randomUUID();
      try {
        store.transaction(() =>
          store.run(
            "INSERT INTO users(id,email,name,password,created_at) VALUES(?,?,?,?,?)",
            [id, input.email, input.name, password, new Date().toISOString()],
          ),
        );
      } catch (error) {
        if (store.one("SELECT id FROM users WHERE email=?", [input.email]))
          return apiError(
            res,
            409,
            "An account with this email already exists.",
            "EMAIL_EXISTS",
          );
        throw error;
      }
      const row = store.one<UserRow>("SELECT * FROM users WHERE id=?", [id])!;
      return res
        .status(201)
        .json({ token: issueToken(id), user: publicUser(row) });
    }),
  );
  app.post(
    "/api/auth/login",
    authLimit,
    asyncRoute(async (req, res) => {
      const input = loginSchema.parse(req.body);
      const row = store.one<UserRow>("SELECT * FROM users WHERE email=?", [
        input.email,
      ]);
      // Use a full scrypt operation even for a missing account to reduce account timing disclosure.
      const valid = row
        ? await verifyPassword(input.password, row.password)
        : await verifyPassword(
            input.password,
            "00112233445566778899aabbccddeeff:" + "0".repeat(128),
          );
      if (!row || !valid)
        return apiError(
          res,
          401,
          "Email or password is incorrect.",
          "INVALID_CREDENTIALS",
        );
      return res.json({ token: issueToken(row.id), user: publicUser(row) });
    }),
  );
  app.use("/api", (req: AuthRequest, res, next) => {
    const token = /^Bearer ([A-Za-z0-9_-]{40,100})$/.exec(
      req.headers.authorization ?? "",
    )?.[1];
    if (!token)
      return apiError(res, 401, "Please log in to continue.", "UNAUTHORIZED");
    const row = store.one<UserRow>(
      "SELECT u.* FROM users u JOIN tokens t ON t.user_id=u.id WHERE t.hash=? AND t.expires_at>?",
      [tokenHash(token), Date.now()],
    );
    if (!row)
      return apiError(
        res,
        401,
        "Your session has expired. Please log in again.",
        "UNAUTHORIZED",
      );
    req.user = row;
    req.token = token;
    next();
  });
  app.get("/api/auth/me", (req: AuthRequest, res) =>
    res.json({ user: publicUser(user(req)) }),
  );
  const avatarChanges = new Map<string, symbol>();
  app.patch(
    "/api/auth/me",
    asyncRoute(async (req, res) => {
      const input = z
        .object({
          name: z.string().trim().min(1).max(80).optional(),
          personalization: z.boolean().optional(),
          avatar: z.string().nullable().optional(),
        })
        .strict()
        .parse(req.body);
      const owner = user(req).id;
      const change = input.avatar === undefined ? undefined : Symbol();
      if (change) avatarChanges.set(owner, change);
      try {
        const avatar =
          typeof input.avatar === "string"
            ? await prepareAvatar(input.avatar)
            : input.avatar;
        // Image decoding is asynchronous. Revoked/expired sessions and removed
        // accounts cannot commit a late upload, even if the initial auth passed.
        const current = store.one<UserRow>(
          "SELECT u.* FROM users u JOIN tokens t ON t.user_id=u.id WHERE u.id=? AND t.hash=? AND t.expires_at>?",
          [owner, tokenHash(req.token!), Date.now()],
        );
        if (!current)
          return apiError(
            res,
            401,
            "Your session has expired. Please log in again.",
            "UNAUTHORIZED",
          );
        if (change && avatarChanges.get(owner) !== change)
          return apiError(
            res,
            409,
            "Your profile photo changed while this upload was processing. Please choose the photo again.",
            "AVATAR_CHANGED",
          );
        store.transaction(() =>
          store.run(
            "UPDATE users SET name=?,personalization=?,avatar=? WHERE id=?",
            [
              input.name ?? current.name,
              input.personalization === undefined
                ? current.personalization
                : Number(input.personalization),
              avatar === undefined ? current.avatar : avatar,
              owner,
            ],
          ),
        );
        return res.json({
          user: publicUser(
            store.one<UserRow>("SELECT * FROM users WHERE id=?", [owner])!,
          ),
        });
      } finally {
        if (change && avatarChanges.get(owner) === change)
          avatarChanges.delete(owner);
      }
    }),
  );
  app.post("/api/auth/logout", (req: AuthRequest, res) => {
    store.transaction(() =>
      store.run("DELETE FROM tokens WHERE hash=?", [tokenHash(req.token!)]),
    );
    res.status(204).end();
  });
  app.get("/api/state", (req: AuthRequest, res) =>
    res.json({ user: publicUser(user(req)), data: state(user(req).id) }),
  );
  app.get("/api/export", (req: AuthRequest, res) => {
    res.attachment("solace-export.json");
    res.json({
      exportedAt: new Date().toISOString(),
      user: publicUser(user(req)),
      data: state(user(req).id),
    });
  });
  app.delete(["/api/account", "/api/auth/me"], (req: AuthRequest, res) => {
    store.transaction(() =>
      store.run("DELETE FROM users WHERE id=?", [user(req).id]),
    );
    res.status(204).end();
  });
  app.get("/api/records/:collection", (req: AuthRequest, res) =>
    res.json({
      records: list(
        user(req).id,
        collectionSchema.parse(req.params.collection),
      ),
    }),
  );
  app.post("/api/records/:collection", (req: AuthRequest, res) => {
    const collection = collectionSchema.parse(req.params.collection);
    const parsed = parseRecord(collection, req.body);
    const record: RecordData = {
      ...parsed,
      id:
        collection === "favorites"
          ? `favorite-${String(parsed.kind)}-${String(parsed.targetId)}`
          : ((parsed.id as string | undefined) ?? randomUUID()),
      createdAt:
        (parsed.createdAt as string | undefined) ?? new Date().toISOString(),
    };
    const existing = get(user(req).id, collection, record.id);
    // Adding a saved practice is idempotent, including rapid taps or retries
    // after a response was lost. Identity is scoped by the authenticated owner.
    if (collection === "favorites" && existing)
      return res.json({ record: existing });
    if (existing)
      return apiError(
        res,
        409,
        "This item already exists. Update it instead.",
        "RECORD_EXISTS",
      );
    if (collection === "memories") {
      record.approved = parsed.approved ?? true;
      if (!validMemorySource(user(req).id, record))
        return apiError(
          res,
          404,
          "The source activity or conversation was not found.",
          "NOT_FOUND",
        );
    }
    store.transaction(() => put(user(req).id, collection, record));
    return res.status(201).json({ record });
  });
  app.patch("/api/records/:collection/:id", (req: AuthRequest, res) => {
    const collection = collectionSchema.parse(req.params.collection);
    const id = idSchema.parse(req.params.id);
    const existing = get(user(req).id, collection, id);
    if (!existing)
      return apiError(res, 404, "This item was not found.", "NOT_FOUND");
    const merged = parseRecord(collection, {
      ...existing,
      ...req.body,
      id: existing.id,
      createdAt: existing.createdAt,
    });
    const record: RecordData = {
      ...merged,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    if (
      collection === "favorites" &&
      (record.kind !== existing.kind || record.targetId !== existing.targetId)
    )
      return apiError(
        res,
        409,
        "Remove this saved practice before choosing a different one.",
        "FAVORITE_TARGET_LOCKED",
      );
    if (collection === "memories" && !validMemorySource(user(req).id, record))
      return apiError(
        res,
        404,
        "The source activity or conversation was not found.",
        "NOT_FOUND",
      );
    store.transaction(() => put(user(req).id, collection, record));
    return res.json({ record });
  });
  app.delete("/api/records/:collection/:id", (req: AuthRequest, res) => {
    const collection = collectionSchema.parse(req.params.collection);
    const id = idSchema.parse(req.params.id);
    if (!get(user(req).id, collection, id))
      return apiError(res, 404, "This item was not found.", "NOT_FOUND");
    store.transaction(() => {
      store.run(
        "DELETE FROM records WHERE user_id=? AND collection=? AND id=?",
        [user(req).id, collection, id],
      );
      if (collection === "conversations" || collection === "sessions")
        for (const memory of list(user(req).id, "memories")) {
          const linked =
            collection === "conversations"
              ? memory.sourceConversationId === id ||
                (memory.sourceType === "conversation" && memory.sourceId === id)
              : memory.sourceType === "session" && memory.sourceId === id;
          if (linked)
            store.run(
              "DELETE FROM records WHERE user_id=? AND collection=? AND id=?",
              [user(req).id, "memories", memory.id],
            );
        }
    });
    return res.status(204).end();
  });
  const chatLocks = new Set<string>();
  app.post(
    "/api/chat",
    asyncRoute(async (req, res) => {
      const input = z
        .object({
          text: z.string().trim().min(1).max(4000),
          conversationId: idSchema.optional(),
        })
        .parse(req.body);
      const owner = user(req).id;
      if (chatLocks.has(owner))
        return apiError(
          res,
          409,
          "Please wait for the current reply before sending another message.",
          "CHAT_BUSY",
        );
      const previous = input.conversationId
        ? get(owner, "conversations", input.conversationId)
        : undefined;
      if (input.conversationId && !previous)
        return apiError(
          res,
          404,
          "This conversation was not found.",
          "NOT_FOUND",
        );
      const history = (previous?.messages ?? []) as Message[];
      if (
        history.length >= 199 ||
        history.reduce(
          (length, m) => length + m.content.length,
          input.text.length,
        ) > 80000
      )
        return apiError(
          res,
          400,
          "Please start a new conversation to continue.",
          "CONVERSATION_LIMIT",
        );
      chatLocks.add(owner);
      try {
        const memories = user(req).personalization
          ? list(owner, "memories")
              .filter((m) => m.approved !== false)
              .slice(0, 10)
              .map((m) =>
                String(m.text ?? m.content ?? m.value ?? "").slice(0, 1000),
              )
              .filter(Boolean)
          : [];
        const context = user(req).personalization
          ? list(owner, "checkins")
              .slice(0, 3)
              .map((c) => ({ mood: c.mood, tags: c.tags, date: c.createdAt }))
          : [];
        const reply = await getReply(config.ai, {
          text: input.text,
          name: user(req).name,
          history,
          memories,
          context,
        });
        // If the account or conversation was removed while the provider was working, never recreate it.
        if (!store.one("SELECT id FROM users WHERE id=?", [owner]))
          return apiError(
            res,
            401,
            "Your account is no longer available.",
            "UNAUTHORIZED",
          );
        // Metadata can change while the provider is working (for example a
        // history rename). Re-read it so this reply cannot restore an old title.
        const current = input.conversationId
          ? get(owner, "conversations", input.conversationId)
          : undefined;
        if (input.conversationId && !current)
          return apiError(
            res,
            404,
            "This conversation was deleted.",
            "NOT_FOUND",
          );
        const now = new Date().toISOString();
        const conversation = {
          ...current,
          id: current?.id ?? randomUUID(),
          title: current?.title ?? input.text.slice(0, 60),
          createdAt: current?.createdAt ?? now,
          updatedAt: now,
          messages: [
            ...history,
            {
              id: randomUUID(),
              role: "user",
              content: input.text,
              createdAt: now,
            },
            {
              id: randomUUID(),
              role: "assistant",
              content: reply.reply,
              createdAt: now,
              action: reply.action,
              provider: reply.provider,
              support: "support" in reply ? reply.support : undefined,
              safety: "safety" in reply ? reply.safety : undefined,
            },
          ],
        };
        store.transaction(() => put(owner, "conversations", conversation));
        return res.json({ conversation, ...reply });
      } finally {
        chatLocks.delete(owner);
      }
    }),
  );
  app.use("/api", (_req, res) =>
    apiError(res, 404, "This API route was not found.", "NOT_FOUND"),
  );
  app.use(
    (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      if (error instanceof ZodError)
        return res.status(400).json({
          error: "Please check the information you entered.",
          code: "VALIDATION_ERROR",
          fields: error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        });
      if (error instanceof AvatarError)
        return apiError(
          res,
          error.code === "AVATAR_TOO_LARGE" ? 413 : 400,
          error.code === "AVATAR_TOO_LARGE"
            ? "Choose a profile photo smaller than 256 KB."
            : "This photo could not be read. Please choose a JPEG photo and try again.",
          error.code,
        );
      const message = error instanceof Error ? error.message : "";
      if (message === "AI_NOT_CONFIGURED")
        return apiError(
          res,
          503,
          "Live AI is not configured. Ask the app owner to configure the server key.",
          "AI_NOT_CONFIGURED",
        );
      if (/AI_|aborted|timeout/i.test(message))
        return apiError(
          res,
          502,
          "Solace could not reach the AI service. Your conversation is safe; please try again.",
          "AI_UNAVAILABLE",
        );
      if (message === "RECORD_TOO_LARGE")
        return apiError(
          res,
          413,
          "This item is too large to save.",
          "RECORD_TOO_LARGE",
        );
      if ((error as { type?: string })?.type === "entity.too.large")
        return apiError(
          res,
          413,
          "This request is too large.",
          "REQUEST_TOO_LARGE",
        );
      if (error instanceof SyntaxError)
        return apiError(
          res,
          400,
          "The request was not valid JSON.",
          "INVALID_JSON",
        );
      console.error(
        "API error:",
        error instanceof Error ? error.name : "UnknownError",
      );
      return apiError(
        res,
        500,
        "Something went wrong while saving. Please try again.",
        "INTERNAL_ERROR",
      );
    },
  );
  return app;
}
