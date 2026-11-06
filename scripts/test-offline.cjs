const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const moduleUnderTest = { exports: {} };
new Function(
  "module",
  "exports",
  ts.transpileModule(
    fs.readFileSync(path.join(__dirname, "../src/offline.ts"), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    },
  ).outputText,
)(moduleUnderTest, moduleUnderTest.exports);
const { createOfflineVault, matchesPending, writingRecord } =
  moduleUnderTest.exports;
function protectedStorage() {
  const values = new Map();
  return {
    values,
    fail: null,
    async get(key) {
      return values.get(key) ?? null;
    },
    async set(key, value) {
      if (this.fail?.(key, value)) throw Error("Device storage unavailable");
      assert.ok(
        Buffer.byteLength(value, "utf8") <= 2000,
        "SecureStore entries must stay below platform size limits",
      );
      values.set(key, value);
    },
    async remove(key) {
      if (this.fail?.(key)) throw Error("Device storage unavailable");
      values.delete(key);
    },
  };
}
const entry = (id = "entry-one", text = "Private writing") => ({
  id,
  collection: "reflections",
  createdAt: "2026-11-05T12:00:00.000Z",
  record: { id, text, need: "Rest", createdAt: "2026-11-05T12:00:00.000Z" },
});

test("a new native vault restores Unicode writing and drafts in bounded SecureStore chunks", async () => {
  const storage = protectedStorage();
  const vault = createOfflineVault(storage);
  const text = "A gentle moment 🌺 एक शांत क्षण ".repeat(130);
  await vault.update("account-a", () => ({
    pending: [entry("long-entry", text)],
    drafts: { "checkin:new": { mood: "Okay", tags: "[]", note: text } },
  }));
  const restored = await createOfflineVault(storage).read("account-a");
  assert.equal(restored.pending[0].record.text, text);
  assert.equal(restored.drafts["checkin:new"].note, text);
  assert.ok(storage.values.size > 3);
  assert.equal(vault.durable, true);
});

test("account partitions never expose another account's writing", async () => {
  const storage = protectedStorage();
  const vault = createOfflineVault(storage);
  await vault.update("account-a", (current) => ({
    ...current,
    pending: [entry()],
  }));
  assert.deepEqual(await vault.read("account-b"), { pending: [], drafts: {} });
  await vault.update("account-b", (current) => ({
    ...current,
    pending: [entry("entry-b", "Different account")],
  }));
  await vault.clear("account-b");
  assert.equal(
    (await createOfflineVault(storage).read("account-a")).pending[0].record
      .text,
    "Private writing",
  );
});

test("a weekly reflection keeps its selected dates and protected draft during an offline retry", async () => {
  const storage = protectedStorage();
  const vault = createOfflineVault(storage);
  const weeklyPeriod = { start: "2026-11-02", end: "2026-11-08" };
  const weekKey = "reflection:weekly:2026-11-08";
  const editingKey = "reflection:edit:entry-one";
  const pending = entry();
  pending.record = writingRecord("reflections", {
    ...pending.record,
    weeklyPeriod,
    weeklyProvider: "offline",
  });
  await vault.update("account-a", () => ({
    pending: [pending],
    drafts: {
      [weekKey]: { text: "My revised week", weeklyProvider: "offline" },
      [editingKey]: { text: "My saved entry edit" },
    },
  }));
  const restored = await createOfflineVault(storage).read("account-a");
  assert.deepEqual(restored.pending[0].record.weeklyPeriod, weeklyPeriod);
  assert.equal(restored.pending[0].record.weeklyProvider, "offline");
  assert.equal(restored.drafts[weekKey].text, "My revised week");
  assert.equal(restored.drafts[editingKey].text, "My saved entry edit");
  assert.equal(matchesPending(restored.pending[0], pending.record), true);
  assert.deepEqual(await vault.read("account-b"), { pending: [], drafts: {} });
});

test("interrupted staging preserves the previous committed generation", async () => {
  const storage = protectedStorage();
  const vault = createOfflineVault(storage);
  await vault.update("account-a", (current) => ({
    ...current,
    pending: [entry()],
  }));
  storage.fail = (key) => key.endsWith(".0.2");
  await assert.rejects(
    vault.update("account-a", (current) => ({
      ...current,
      pending: [entry("long-entry", "🌺".repeat(2000))],
    })),
    /unavailable/,
  );
  storage.fail = null;
  assert.equal(
    (await createOfflineVault(storage).read("account-a")).pending[0].id,
    "entry-one",
  );
  await vault.update("account-a", () => ({ pending: [], drafts: {} }));
  await vault.clear("account-a");
  assert.equal(
    storage.values.size,
    0,
    "shorter saves and logout must erase staged surplus chunks",
  );
});

test("erasure is retryable after partial failure even when the old payload cannot be decoded", async () => {
  const storage = protectedStorage();
  const vault = createOfflineVault(storage);
  await vault.update("account-a", (current) => ({
    ...current,
    pending: [entry("entry-one", "🌺".repeat(2000))],
  }));
  storage.fail = (key) => key.endsWith(".1.2");
  await assert.rejects(vault.clear("account-a"), /unavailable/);
  storage.fail = null;
  const restarted = createOfflineVault(storage);
  await assert.rejects(restarted.read("account-a"), /could not be read/);
  await restarted.clear("account-a");
  assert.equal(storage.values.size, 0);
});

test("concurrent draft and queue updates are serialized without overwriting each other", async () => {
  const vault = createOfflineVault(protectedStorage());
  await Promise.all([
    vault.update("account-a", (current) => ({
      ...current,
      drafts: { "reflection:new": { text: "Draft", need: "" } },
    })),
    vault.update("account-a", (current) => ({
      ...current,
      pending: [entry()],
    })),
  ]);
  const state = await vault.read("account-a");
  assert.equal(state.pending.length, 1);
  assert.equal(state.drafts["reflection:new"].text, "Draft");
});

test("the vault excludes chat, full snapshots, arbitrary draft fields and oversized queues", async () => {
  const vault = createOfflineVault();
  await vault.update("account-a", () => ({
    pending: [
      {
        ...entry(),
        record: {
          ...entry().record,
          conversation: "Never persist",
          providerSecret: "Never persist",
        },
      },
    ],
    drafts: {
      "reflection:new": { text: "Keep this", chat: "Never persist" },
      "chat:new": { text: "Never persist" },
    },
    conversations: [{ text: "Never persist" }],
  }));
  const saved = JSON.stringify(await vault.read("account-a"));
  assert.ok(!saved.includes("Never persist"));
  await assert.rejects(
    vault.update("account-a", (current) => ({
      ...current,
      pending: Array.from({ length: 11 }, (_, i) => entry(`entry-${i}`)),
    })),
    /10 waiting/,
  );
  await assert.rejects(
    vault.update("account-a", (current) => ({
      ...current,
      pending: [entry("huge", "🌺".repeat(25000))],
    })),
    /storage is full/,
  );
  assert.equal((await vault.read("account-a")).pending.length, 1);
});

test("web protection is memory only and a new page lifetime has no health writing", async () => {
  const vault = createOfflineVault();
  await vault.update("account-a", (current) => ({
    ...current,
    pending: [entry()],
  }));
  assert.equal(vault.durable, false);
  assert.equal((await vault.read("account-a")).pending.length, 1);
  assert.equal(
    (await createOfflineVault().read("account-a")).pending.length,
    0,
  );
});

test("response-lost retries acknowledge only equal owned records", () => {
  const pending = entry();
  assert.equal(
    matchesPending(pending, {
      ...pending.record,
      updatedAt: "server timestamp",
    }),
    true,
  );
  assert.equal(
    matchesPending(pending, {
      ...pending.record,
      text: "A different entry with the same ID",
    }),
    false,
  );
  assert.deepEqual(
    writingRecord("checkins", {
      id: "one",
      mood: "Okay",
      localOnly: true,
      messages: [],
    }),
    { id: "one", mood: "Okay" },
  );
});
