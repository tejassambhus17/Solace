import {
  randomBytes,
  scrypt as derive,
  createHash,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(derive);
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(password: string, hash: string) {
  const [salt, stored] = hash.split(":");
  if (!salt || !stored) return false;
  const key = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(stored, "hex");
  return expected.length === key.length && timingSafeEqual(expected, key);
}
export const newToken = () => randomBytes(32).toString("base64url");
export const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export type UserRow = {
  id: string;
  email: string;
  name: string;
  password: string;
  created_at: string;
  personalization: number;
  avatar: string | null;
};
export const publicUser = (row: UserRow) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  createdAt: row.created_at,
  personalization: !!row.personalization,
  avatar: row.avatar ?? null,
});
