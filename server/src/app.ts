import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
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
  conversationTitle,
  idSchema,
  registerSchema,
  loginSchema,
  parseRecord,
  type Collection,
} from "./validation.js";
import {
  getReply,
  isUrgent,
  provider,
  type Action,
  type AIConfig,
  type Message,
} from "./ai.js";
import { AvatarError, prepareAvatar } from "./avatar.js";
import { generateMoment, environments, type MomentMemory } from "./moments.js";
import { calendarDay, weeklyFacts, weeklyReflection } from "./weekly.js";
import { transcribeAudio, voiceAvailable, audioTypes } from "./voice.js";

type RecordData = Record<string, unknown> & { id: string; createdAt: string };
type AuthRequest = Request & { user?: UserRow; token?: string };
type ChatReceipt = {
  conversation_id: string;
  assistant_message_id: string;
  source_conversation_id: string | null;
};
type StoredChatMessage = Message & {
  action?: Action;
  provider?: "live" | "offline";
  support?: boolean;
  safety?: boolean;
};
const CHAT_RETRY_WINDOW_MS = 24 * 60 * 60 * 1000;
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
  const resetConversationContext = (owner: string) => {
    const resetAt = new Date().toISOString();
    for (const conversation of list(owner, "conversations"))
      put(owner, "conversations", {
        ...conversation,
        contextResetMessageCount: Array.isArray(conversation.messages)
          ? conversation.messages.length
          : 0,
        contextResetAt: resetAt,
        contextResetId: randomUUID(),
      });
  };
  const validSessionSource = (owner: string, record: RecordData) => {
    if (
      record.sourceConversationId === undefined ||
      record.sourceConversationId === null
    )
      return true;
    const source = idSchema.parse(record.sourceConversationId);
    return !!get(owner, "conversations", source);
  };
  const memoryProvenance = (record: RecordData) =>
    JSON.stringify([
      record.sourceType ?? null,
      record.sourceId ?? null,
      record.sourceConversationId ?? null,
    ]);
  const validMemorySource = (owner: string, record: RecordData) => {
    const explicitConversation = record.sourceConversationId;
    if (
      explicitConversation &&
      (!idSchema.safeParse(explicitConversation).success ||
        !get(owner, "conversations", String(explicitConversation)))
    )
      return false;
    // A source label without its identity is not a source-free manual preference.
    if ((record.sourceType === undefined) !== (record.sourceId === undefined))
      return false;
    if (record.sourceType && record.sourceId) {
      const collection =
        record.sourceType === "session" ? "sessions" : "conversations";
      const source = get(owner, collection, String(record.sourceId));
      if (!source) return false;
      const canonicalConversation =
        record.sourceType === "conversation"
          ? source.id
          : source.sourceConversationId;
      if (
        canonicalConversation !== undefined &&
        canonicalConversation !== null
      ) {
        if (
          !idSchema.safeParse(canonicalConversation).success ||
          !get(owner, "conversations", String(canonicalConversation))
        )
          return false;
        if (
          explicitConversation &&
          explicitConversation !== canonicalConversation
        )
          return false;
        record.sourceConversationId = canonicalConversation;
      } else if (explicitConversation) {
        // A session cannot be relabeled as originating in an unrelated chat.
        return false;
      }
    }
    return true;
  };
  const state = (owner: string) =>
    Object.fromEntries(collections.map((c) => [c, list(owner, c)]));
  const issueToken = (id: string) => {
    const token = newToken();
    const now = Date.now();
    store.run("DELETE FROM tokens WHERE expires_at < ?", [now]);
    store.run("INSERT INTO tokens(hash,user_id,expires_at) VALUES(?,?,?)", [
      tokenHash(token),
      id,
      now + 30 * 86400000,
    ]);
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
      let token: string;
      try {
        token = store.transaction(() => {
          store.run(
            "INSERT INTO users(id,email,name,password,created_at) VALUES(?,?,?,?,?)",
            [id, input.email, input.name, password, new Date().toISOString()],
          );
          return issueToken(id);
        });
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
      return res.status(201).json({ token, user: publicUser(row) });
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
      const current =
        row && valid
          ? store.one<UserRow>(
              "SELECT * FROM users WHERE id=? AND password=?",
              [row.id, row.password],
            )
          : undefined;
      if (!current)
        return apiError(
          res,
          401,
          "Email or password is incorrect.",
          "INVALID_CREDENTIALS",
        );
      const token = store.transaction(() => issueToken(current.id));
      return res.json({ token, user: publicUser(current) });
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
        store.transaction(() => {
          if (input.personalization === false && current.personalization)
            resetConversationContext(owner);
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
          );
        });
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
    if (collection === "conversations") {
      delete parsed.contextResetMessageCount;
      delete parsed.contextResetAt;
      delete parsed.contextResetId;
      parsed.conversationInstanceId = randomUUID();
    }
    const record: RecordData = {
      ...parsed,
      id:
        collection === "favorites"
          ? `favorite-${String(parsed.kind)}-${String(parsed.targetId)}`
          : ((parsed.id as string | undefined) ?? randomUUID()),
      createdAt:
        (parsed.createdAt as string | undefined) ?? new Date().toISOString(),
    };
    if (collection === "sessions" && !validSessionSource(user(req).id, record))
      return apiError(
        res,
        404,
        "The source conversation was not found.",
        "NOT_FOUND",
      );
    const existing = get(user(req).id, collection, record.id);
    // Adding a saved practice is idempotent, including rapid taps or retries
    // after a response was lost. Identity is scoped by the authenticated owner.
    if (collection === "favorites" && existing)
      return res.json({ record: existing });
    if (
      existing &&
      (collection === "preferences" ||
        collection === "goals" ||
        (collection === "sessions" &&
          parsed.kind === "generated" &&
          existing.kind === "generated"))
    ) {
      // Stable client IDs reconcile a lost response without recording another completion.
      // Supplied timestamps and every supplied field must match; changed payloads conflict.
      if (
        Object.entries(parsed).every(
          ([key, value]) =>
            JSON.stringify(value) === JSON.stringify(existing[key]),
        )
      )
        return res.json({ record: existing });
    }
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
    if (collection === "conversations") {
      const { title, messages } = z
        .object({
          title: conversationTitle.optional(),
          messages: z.unknown().optional(),
        })
        .parse(req.body);
      if (
        messages !== undefined &&
        !isDeepStrictEqual(messages, existing.messages)
      )
        return apiError(
          res,
          409,
          "Messages cannot be edited in a saved conversation.",
          "CONVERSATION_HISTORY_LOCKED",
        );
      if (title === undefined) return res.json({ record: existing });
      const record = {
        ...existing,
        title,
        updatedAt: new Date().toISOString(),
      };
      store.transaction(() => put(user(req).id, collection, record));
      return res.json({ record });
    }
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
    if (collection === "sessions") {
      if (!validSessionSource(user(req).id, record))
        return apiError(
          res,
          404,
          "The source conversation was not found.",
          "NOT_FOUND",
        );
      if (
        (record.sourceConversationId ?? null) !==
        (existing.sourceConversationId ?? null)
      )
        return apiError(
          res,
          409,
          "An activity's source conversation cannot be changed after it is saved.",
          "SOURCE_LOCKED",
        );
    }
    if (collection === "memories") {
      const canonicalExisting = { ...existing };
      if (
        !validMemorySource(user(req).id, canonicalExisting) ||
        !validMemorySource(user(req).id, record)
      )
        return apiError(
          res,
          404,
          "The source activity or conversation was not found.",
          "NOT_FOUND",
        );
      if (memoryProvenance(record) !== memoryProvenance(canonicalExisting))
        return apiError(
          res,
          409,
          "A saved preference's source cannot be changed. You can add a separate manual preference instead.",
          "SOURCE_LOCKED",
        );
    }
    store.transaction(() => {
      put(user(req).id, collection, record);
      if (collection === "memories") resetConversationContext(user(req).id);
    });
    return res.json({ record });
  });
  app.delete("/api/records/:collection/:id", (req: AuthRequest, res) => {
    const collection = collectionSchema.parse(req.params.collection);
    const id = idSchema.parse(req.params.id);
    if (!get(user(req).id, collection, id))
      return apiError(res, 404, "This item was not found.", "NOT_FOUND");
    store.transaction(() => {
      let memoryRemoved = collection === "memories";
      store.run(
        "DELETE FROM records WHERE user_id=? AND collection=? AND id=?",
        [user(req).id, collection, id],
      );
      if (collection === "conversations" || collection === "sessions")
        for (const memory of list(user(req).id, "memories")) {
          const linked =
            collection === "conversations"
              ? memory.sourceConversationId === id ||
                (memory.sourceType === "conversation" &&
                  memory.sourceId === id) ||
                (memory.sourceType === "session" &&
                  typeof memory.sourceId === "string" &&
                  get(user(req).id, "sessions", memory.sourceId)
                    ?.sourceConversationId === id)
              : memory.sourceType === "session" && memory.sourceId === id;
          if (linked) {
            memoryRemoved = true;
            store.run(
              "DELETE FROM records WHERE user_id=? AND collection=? AND id=?",
              [user(req).id, "memories", memory.id],
            );
          }
        }
      if (memoryRemoved) resetConversationContext(user(req).id);
    });
    return res.status(204).end();
  });
  const currentAccount = (req: AuthRequest) =>
    store.one<UserRow>(
      "SELECT u.* FROM users u JOIN tokens t ON t.user_id=u.id WHERE u.id=? AND t.hash=? AND t.expires_at>?",
      [user(req).id, tokenHash(req.token!), Date.now()],
    );
  const approvedMemories = (owner: string, enabled: boolean): MomentMemory[] =>
    enabled
      ? list(owner, "memories")
          .filter(
            (memory) =>
              memory.approved !== false &&
              Date.parse(memory.createdAt) <= Date.now() &&
              validMemorySource(owner, memory),
          )
          .map((memory) => ({
            id: memory.id,
            text: String(
              memory.text ?? memory.content ?? memory.value ?? "",
            ).slice(0, 1000),
          }))
          .filter((memory) => !!memory.text.trim())
          .slice(0, 10)
      : [];
  app.get("/api/capabilities", (_req, res) =>
    res.json({
      voiceTranscription: voiceAvailable(config.ai),
      aiProvider: provider(config.ai),
    }),
  );
  const generationLocks = new Set<string>();
  app.post(
    "/api/moments/generate",
    asyncRoute(async (req, res) => {
      const input = z
        .object({
          feeling: z.string().trim().min(1).max(2000),
          environment: z.enum(environments).optional(),
        })
        .strict()
        .parse(req.body);
      const owner = user(req).id;
      if (isUrgent(input.feeling))
        return res.json(
          await generateMoment(config.ai, { ...input, memories: [] }),
        );
      if (generationLocks.has(owner))
        return apiError(
          res,
          409,
          "Your moment is still being prepared. Please wait before trying again.",
          "MOMENT_BUSY",
        );
      const memories = approvedMemories(owner, !!user(req).personalization);
      const savedEnvironment = z
        .enum(environments)
        .safeParse(get(owner, "preferences", "wellness")?.environment);
      generationLocks.add(owner);
      try {
        const result = await generateMoment(config.ai, {
          ...input,
          environment:
            input.environment ??
            (savedEnvironment.success ? savedEnvironment.data : undefined),
          memories,
        });
        const current = currentAccount(req);
        if (!current)
          return apiError(
            res,
            401,
            "Your session has expired. Please log in again.",
            "UNAUTHORIZED",
          );
        if (result.usedMemoryIds.length) {
          const active = approvedMemories(owner, !!current.personalization);
          if (
            result.usedMemoryIds.some(
              (id) =>
                !active.some(
                  (memory) =>
                    memory.id === id &&
                    memory.text ===
                      memories.find((previous) => previous.id === id)?.text,
                ),
            )
          )
            return apiError(
              res,
              409,
              "Your personalization changed while this moment was being prepared. Please try again.",
              "PERSONALIZATION_CHANGED",
            );
        }
        return res.json(result);
      } finally {
        generationLocks.delete(owner);
      }
    }),
  );
  const weeklyLocks = new Set<string>();
  app.post(
    "/api/insights/weekly",
    asyncRoute(async (req, res) => {
      const input = z
        .object({ endDate: calendarDay.optional() })
        .strict()
        .parse(req.body ?? {});
      const owner = user(req).id;
      const endDate = input.endDate || new Date().toISOString().slice(0, 10);
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      if (endDate > tomorrow.toISOString().slice(0, 10))
        return apiError(
          res,
          400,
          "Choose this week or an earlier week.",
          "VALIDATION_ERROR",
        );
      if (weeklyLocks.has(owner))
        return apiError(
          res,
          409,
          "Your weekly reflection is still being prepared.",
          "WEEKLY_BUSY",
        );
      const summary = () =>
        weeklyFacts(
          {
            checkins: list(owner, "checkins"),
            sessions: list(owner, "sessions"),
            reflections: list(owner, "reflections"),
          },
          endDate,
        );
      const initial = summary();
      weeklyLocks.add(owner);
      try {
        const result = await weeklyReflection(config.ai, initial);
        if (!currentAccount(req))
          return apiError(
            res,
            401,
            "Your session has expired. Please log in again.",
            "UNAUTHORIZED",
          );
        if (JSON.stringify(summary()) !== JSON.stringify(initial))
          return apiError(
            res,
            409,
            "Your recorded week changed while this reflection was being prepared. Please try again.",
            "WEEKLY_CHANGED",
          );
        return res.json(result);
      } finally {
        weeklyLocks.delete(owner);
      }
    }),
  );
  const voiceLimit =
    config.rateLimits === false
      ? (_req: Request, _res: Response, next: NextFunction) => next()
      : rateLimit({
          windowMs: 60000,
          limit: 12,
          standardHeaders: "draft-7",
          legacyHeaders: false,
          keyGenerator: (req) => user(req).id,
          message: {
            error: "Please wait a moment before recording again.",
            code: "VOICE_RATE_LIMITED",
          },
        });
  const voiceLocks = new Set<string>();
  app.post(
    "/api/voice/transcribe",
    voiceLimit,
    (req, res, next) => {
      if (!voiceAvailable(config.ai))
        return apiError(
          res,
          503,
          "Voice transcription is not configured yet. You can keep talking with text.",
          "VOICE_NOT_CONFIGURED",
        );
      const type = String(req.headers["content-type"] || "")
        .split(";")[0]
        .trim()
        .toLowerCase();
      if (!audioTypes[type])
        return apiError(
          res,
          415,
          "Choose a supported audio recording.",
          "VOICE_INVALID_AUDIO",
        );
      next();
    },
    express.raw({ type: () => true, limit: "8mb" }),
    asyncRoute(async (req, res) => {
      const owner = user(req).id;
      if (voiceLocks.has(owner))
        return apiError(
          res,
          409,
          "Your recording is still being transcribed.",
          "VOICE_BUSY",
        );
      if (!Buffer.isBuffer(req.body))
        return apiError(
          res,
          400,
          "This recording could not be read. Please record again or use text.",
          "VOICE_INVALID_AUDIO",
        );
      voiceLocks.add(owner);
      try {
        const result = await transcribeAudio(
          config.ai,
          req.body,
          String(req.headers["content-type"]),
        );
        if (!currentAccount(req))
          return apiError(
            res,
            401,
            "Your session has expired. Please log in again.",
            "UNAUTHORIZED",
          );
        return res.json(result);
      } finally {
        voiceLocks.delete(owner);
      }
    }),
  );
  const chatLocks = new Map<string, string | undefined>();
  app.post(
    "/api/chat",
    asyncRoute(async (req, res) => {
      const input = z
        .object({
          text: z.string().trim().min(1).max(4000),
          conversationId: idSchema.optional(),
          requestId: z
            .uuid()
            .transform((value) => value.toLowerCase())
            .optional(),
        })
        .parse(req.body);
      const owner = user(req).id;
      if (input.requestId) {
        const receipt = store.one<ChatReceipt>(
          "SELECT conversation_id,assistant_message_id,source_conversation_id FROM chat_requests WHERE user_id=? AND id=? AND expires_at>?",
          [owner, input.requestId, Date.now()],
        );
        if (receipt) {
          const conversation = get(
            owner,
            "conversations",
            receipt.conversation_id,
          );
          const messages = (conversation?.messages ??
            []) as StoredChatMessage[];
          const index = messages.findIndex(
            (message) => message.id === receipt.assistant_message_id,
          );
          const reply = messages[index];
          const question = messages[index - 1];
          if (!conversation || !reply || !question)
            return apiError(
              res,
              404,
              "This conversation was deleted.",
              "NOT_FOUND",
            );
          if (
            (input.conversationId ?? null) !== receipt.source_conversation_id ||
            input.text !== question.content
          )
            return apiError(
              res,
              409,
              "This retry belongs to a different message. Send your draft as a new message.",
              "CHAT_REQUEST_CONFLICT",
            );
          return res.json({
            conversation,
            reply: reply.content,
            action: reply.action,
            provider: reply.provider,
            support: reply.support,
            safety: reply.safety,
          });
        }
      }
      const urgent = isUrgent(input.text);
      const busy = chatLocks.has(owner);
      if (
        busy &&
        (!urgent ||
          (input.requestId && chatLocks.get(owner) === input.requestId))
      )
        return apiError(
          res,
          409,
          "Please wait for the current reply before sending another message.",
          "CHAT_BUSY",
        );
      const requested = input.conversationId
        ? get(owner, "conversations", input.conversationId)
        : undefined;
      if (input.conversationId && !requested && !urgent)
        return apiError(
          res,
          404,
          "This conversation was not found.",
          "NOT_FOUND",
        );
      const requestedHistory = (requested?.messages ?? []) as Message[];
      const full =
        requestedHistory.length >= 199 ||
        requestedHistory.reduce(
          (length, m) => length + m.content.length,
          input.text.length,
        ) > 80000;
      if (full && !urgent)
        return apiError(
          res,
          400,
          "Please start a new conversation to continue.",
          "CONVERSATION_LIMIT",
        );
      // Explicit distress uses the local support response even if an AI
      // turn is pending or the selected conversation cannot accept new turns.
      const previous = busy || full ? undefined : requested;
      const history = previous ? requestedHistory : [];
      const resetCount = Number(previous?.contextResetMessageCount) || 0;
      const providerHistory = history.slice(
        Math.max(0, Math.min(history.length, resetCount)),
      );
      if (!busy) chatLocks.set(owner, input.requestId);
      try {
        const chatPersonalization = (account: UserRow) =>
          account.personalization
            ? {
                memories: approvedMemories(owner, true),
                context: list(owner, "checkins")
                  .slice(0, 3)
                  .map((record) => ({
                    id: record.id,
                    mood: record.mood,
                    tags: record.tags,
                    date: record.createdAt,
                  })),
              }
            : null;
        const personalization = urgent ? null : chatPersonalization(user(req));
        const memories =
          personalization?.memories.map((memory) => memory.text) || [];
        const context =
          personalization?.context.map(({ mood, tags, date }) => ({
            mood,
            tags,
            date,
          })) ?? [];
        const reply = await getReply(config.ai, {
          text: input.text,
          name: user(req).name,
          history: providerHistory,
          memories,
          context,
        });
        // A revoked session or deleted account cannot receive/persist a late reply.
        const currentUser = currentAccount(req);
        if (!currentUser)
          return apiError(
            res,
            401,
            "Your account is no longer available.",
            "UNAUTHORIZED",
          );
        // Deleted/corrected memories and revoked consent take effect before a
        // pending personalized response can become another active source.
        if (
          personalization &&
          JSON.stringify(chatPersonalization(currentUser)) !==
            JSON.stringify(personalization)
        )
          return apiError(
            res,
            409,
            "Your personalization changed while this reply was being prepared. Please send your message again.",
            "PERSONALIZATION_CHANGED",
          );
        // Metadata can change while the provider is working (for example a
        // history rename). Re-read it so this reply cannot restore an old title.
        const current = previous
          ? get(owner, "conversations", previous.id)
          : undefined;
        if (previous && !current)
          return apiError(
            res,
            404,
            "This conversation was deleted.",
            "NOT_FOUND",
          );
        if (
          current?.conversationInstanceId !== previous?.conversationInstanceId
        )
          return apiError(
            res,
            409,
            "This conversation was replaced while your reply was being prepared. Please start a new conversation.",
            "CONVERSATION_CHANGED",
          );
        if (
          current &&
          (current.contextResetId !== previous?.contextResetId ||
            current.contextResetMessageCount !==
              previous?.contextResetMessageCount)
        )
          return apiError(
            res,
            409,
            "Your conversation context was reset for privacy while this reply was being prepared. Please send your message again.",
            "CONTEXT_CHANGED",
          );
        const now = new Date().toISOString();
        const assistantMessageId = randomUUID();
        const conversation = {
          ...current,
          id: current?.id ?? randomUUID(),
          conversationInstanceId:
            current?.conversationInstanceId ?? randomUUID(),
          title:
            current?.title ??
            (urgent ? "Support right now" : input.text.slice(0, 60)),
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
              id: assistantMessageId,
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
        store.transaction(() => {
          put(owner, "conversations", conversation);
          if (input.requestId) {
            const savedAt = Date.now();
            // Opaque receipts outlive conversation deletion briefly so a lost
            // response cannot bring the deleted chat back on a retry.
            store.run(
              "DELETE FROM chat_requests WHERE user_id=? AND expires_at<=?",
              [owner, savedAt],
            );
            store.run(
              "INSERT INTO chat_requests(user_id,id,conversation_id,assistant_message_id,source_conversation_id,expires_at) VALUES(?,?,?,?,?,?)",
              [
                owner,
                input.requestId,
                conversation.id,
                assistantMessageId,
                input.conversationId ?? null,
                savedAt + CHAT_RETRY_WINDOW_MS,
              ],
            );
          }
        });
        return res.json({ conversation, ...reply });
      } finally {
        if (!busy) chatLocks.delete(owner);
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
      if (message === "VOICE_NOT_CONFIGURED")
        return apiError(
          res,
          503,
          "Voice transcription is not configured yet. You can keep talking with text.",
          "VOICE_NOT_CONFIGURED",
        );
      if (message === "VOICE_INVALID_AUDIO")
        return apiError(
          res,
          400,
          "This recording could not be read. Please record again or use text.",
          "VOICE_INVALID_AUDIO",
        );
      if (message.startsWith("VOICE_"))
        return apiError(
          res,
          502,
          "This recording could not be transcribed. Please try again or use text.",
          "VOICE_UNAVAILABLE",
        );
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
