import initSqlJs, {
  type Database,
  type SqlValue,
  type SqlJsStatic,
} from "sql.js";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

export class Store {
  private constructor(
    public db: Database,
    private readonly SQL: SqlJsStatic,
    private readonly file?: string,
  ) {}
  static async open(file?: string) {
    const SQL = await initSqlJs();
    const target = file && file !== ":memory:" ? resolve(file) : undefined;
    const db = new SQL.Database(
      target && existsSync(target) ? readFileSync(target) : undefined,
    );
    db.run("PRAGMA foreign_keys = ON");
    db.run(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password TEXT NOT NULL, created_at TEXT NOT NULL, personalization INTEGER NOT NULL DEFAULT 0, avatar TEXT);
      CREATE TABLE IF NOT EXISTS tokens (hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS google_identities (subject TEXT PRIMARY KEY, user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE);
      CREATE TABLE IF NOT EXISTS records (id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, collection TEXT NOT NULL, json TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(user_id, collection, id));
      CREATE INDEX IF NOT EXISTS records_owner ON records(user_id, collection, created_at);
      CREATE TABLE IF NOT EXISTS chat_requests (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        assistant_message_id TEXT NOT NULL,
        source_conversation_id TEXT,
        expires_at INTEGER NOT NULL,
        PRIMARY KEY(user_id, id)
      );`);
    const store = new Store(db, SQL, target);
    // Existing installations keep their accounts and records when upgrading.
    if (
      !store
        .all<{ name: string }>("PRAGMA table_info(users)")
        .some((column) => column.name === "avatar")
    )
      store.run("ALTER TABLE users ADD COLUMN avatar TEXT");
    store.run("DELETE FROM chat_requests WHERE expires_at <= ?", [Date.now()]);
    store.persist();
    return store;
  }
  run(sql: string, params: SqlValue[] = []) {
    this.db.run(sql, params);
  }
  all<T = Record<string, unknown>>(sql: string, params: SqlValue[] = []): T[] {
    const statement = this.db.prepare(sql);
    try {
      statement.bind(params);
      const result: T[] = [];
      while (statement.step()) result.push(statement.getAsObject() as T);
      return result;
    } finally {
      statement.free();
    }
  }
  one<T = Record<string, unknown>>(
    sql: string,
    params: SqlValue[] = [],
  ): T | undefined {
    return this.all<T>(sql, params)[0];
  }
  transaction<T>(fn: () => T): T {
    // The file is the durable source of truth. Restore RAM as well as SQL state
    // when disk persistence fails after COMMIT, so retries cannot see a ghost save.
    const snapshot = this.db.export();
    this.db.run("BEGIN IMMEDIATE");
    try {
      const value = fn();
      this.db.run("COMMIT");
      this.persist();
      return value;
    } catch (error) {
      this.db.close();
      this.db = new this.SQL.Database(snapshot);
      this.db.run("PRAGMA foreign_keys = ON");
      throw error;
    }
  }
  persist() {
    if (!this.file) return;
    mkdirSync(dirname(this.file), { recursive: true });
    const temporary = this.file + ".tmp";
    writeFileSync(temporary, this.db.export(), { mode: 0o600 });
    renameSync(temporary, this.file);
  }
  close() {
    this.persist();
    this.db.close();
  }
}
