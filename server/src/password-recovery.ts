import { randomBytes } from "node:crypto";
import { Router, type RequestHandler } from "express";
import { createTransport } from "nodemailer";
import { z } from "zod";
import { hashPassword, tokenHash } from "./auth.js";
import type { Store } from "./database.js";

export type RecoveryMailer = (email: string, code: string) => Promise<void>;

const codeLifetime = 10 * 60 * 1000;
const resendDelay = 60 * 1000;
const emailInput = z.string().trim().toLowerCase().max(200).email();
const requestInput = z.object({ email: emailInput });
const resetInput = requestInput.extend({
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{16}$/),
  password: z.string().min(8).max(128),
});

export function recoveryMailerFromEnv(
  env: Record<string, string | undefined>,
): RecoveryMailer | undefined {
  const host = env.SMTP_HOST?.trim();
  const from = emailInput.safeParse(env.SMTP_FROM?.trim());
  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASSWORD;
  const port = Number(env.SMTP_PORT || "587");
  if (
    !host ||
    !from.success ||
    !user ||
    !pass ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  )
    return undefined;
  const transport = createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user, pass },
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 15_000,
  });
  return async (email, code) => {
    await transport.sendMail({
      from: { name: "Solace", address: from.data },
      to: email,
      subject: "Your Solace password reset code",
      text: `Your Solace password reset code is ${code}. Enter it in Solace within 10 minutes. If you did not request this code, you can ignore this message.`,
    });
  };
}

export function createPasswordRecoveryRoutes(
  store: Store,
  authLimit: RequestHandler,
  mailer?: RecoveryMailer,
) {
  const router = Router();
  if (mailer) {
    store.run(`CREATE TABLE IF NOT EXISTS password_reset_codes (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      hash TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )`);
  }
  const requireMailer: RequestHandler = (_req, res, next) => {
    if (mailer) next();
    else
      res.status(503).json({
        code: "RECOVERY_UNAVAILABLE",
        error: "Password recovery is temporarily unavailable.",
      });
  };
  async function sendCode(email: string) {
    const account = store.one<{ id: string }>(
      "SELECT id FROM users WHERE email=? AND password<>''",
      [email],
    );
    const now = Date.now();
    if (
      account &&
      !store.one(
        "SELECT 1 FROM password_reset_codes WHERE user_id=? AND created_at>?",
        [account.id, now - resendDelay],
      )
    ) {
      const code = randomBytes(12).toString("base64url");
      const digest = tokenHash(code);
      store.transaction(() => {
        store.run("DELETE FROM password_reset_codes WHERE expires_at<=?", [
          now,
        ]);
        store.run(
          `INSERT INTO password_reset_codes(user_id,hash,created_at,expires_at) VALUES(?,?,?,?)
          ON CONFLICT(user_id) DO UPDATE SET hash=excluded.hash,created_at=excluded.created_at,expires_at=excluded.expires_at`,
          [account.id, digest, now, now + codeLifetime],
        );
      });
      try {
        await mailer!(email, code);
      } catch {
        store.transaction(() =>
          store.run(
            "DELETE FROM password_reset_codes WHERE user_id=? AND hash=?",
            [account.id, digest],
          ),
        );
      }
    }
  }
  router.post("/request", authLimit, requireMailer, (req, res) => {
    const { email } = requestInput.parse(req.body);
    res.status(202).json({ requested: true });
    // A response must never disclose whether the account exists or mail was delivered.
    setImmediate(() => void sendCode(email).catch(() => {}));
  });
  router.post("/reset", authLimit, requireMailer, (req, res, next) => {
    const { email, code, password } = resetInput.parse(req.body);
    const digest = tokenHash(code);
    const find = () =>
      store.one<{ id: string }>(
        `SELECT u.id FROM users u
      JOIN password_reset_codes r ON r.user_id=u.id WHERE u.email=? AND r.hash=? AND r.expires_at>?`,
        [email, digest, Date.now()],
      );
    const invalid = () =>
      res.status(400).json({
        code: "RECOVERY_CODE_INVALID",
        error:
          "That code is invalid or has expired. Request a new code and try again.",
      });
    const account = find();
    if (!account) {
      invalid();
      return;
    }
    void hashPassword(password)
      .then((hashed) => {
        const updated = store.transaction(() => {
          if (find()?.id !== account.id) return false;
          store.run("UPDATE users SET password=? WHERE id=?", [
            hashed,
            account.id,
          ]);
          store.run("DELETE FROM password_reset_codes WHERE user_id=?", [
            account.id,
          ]);
          store.run("DELETE FROM tokens WHERE user_id=?", [account.id]);
          return true;
        });
        if (!updated) {
          invalid();
          return;
        }
        res.json({ reset: true });
      })
      .catch(next);
  });
  return router;
}
