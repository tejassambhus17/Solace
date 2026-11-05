/** Only check-ins and journal writing belong in this device vault. Chat and
 * account snapshots deliberately never pass through it. Native callers supply
 * SecureStore; the web caller supplies no storage and stays in memory. */
export type WritingCollection = "checkins" | "reflections";
export type WritingRecord = Record<string, any> & { id: string };
export type PendingWrite = {
  id: string;
  collection: WritingCollection;
  createdAt: string;
  record: WritingRecord;
};
export type ProtectedDrafts = Record<string, Record<string, string>>;
export type OfflineSnapshot = {
  pending: PendingWrite[];
  drafts: ProtectedDrafts;
};
export type VaultStorage = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  remove: (key: string) => Promise<void>;
};
const MAX_BYTES = 96000;
const CHUNK_BYTES = 1500;
const MAX_PENDING = 10;
const draftFields: Record<string, string[]> = {
  "checkin:new": ["mood", "tags", "note"],
  "reflection:new": ["text", "need"],
};
const recordFields: Record<WritingCollection, string[]> = {
  checkins: ["id", "mood", "tags", "note", "day", "createdAt"],
  reflections: [
    "id",
    "text",
    "need",
    "day",
    "createdAt",
    "sourceConversationId",
  ],
};
const fresh = (): OfflineSnapshot => ({ pending: [], drafts: {} });
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const byteSize = (value: string) => {
  let size = 0;
  for (const point of value) {
    const code = point.codePointAt(0)!;
    size += code < 128 ? 1 : code < 2048 ? 2 : code < 65536 ? 3 : 4;
  }
  return size;
};
export const isProtectedDraft = (key: string) => key in draftFields;
export function writingRecord(
  collection: WritingCollection,
  record: WritingRecord,
): WritingRecord {
  return Object.fromEntries(
    recordFields[collection]
      .filter((key) => record[key] !== undefined)
      .map((key) => [key, record[key]]),
  ) as WritingRecord;
}
/** A conflict is acknowledged only when the owned server record contains the
 * exact submitted fields. An ID collision must never silently replace writing. */
export function matchesPending(
  pending: PendingWrite,
  remote: Record<string, any>,
) {
  return Object.entries(pending.record).every(
    ([key, value]) => JSON.stringify(remote[key]) === JSON.stringify(value),
  );
}
export const isRecoverableConnectionError = (error: unknown) =>
  (error as { connection?: boolean })?.connection === true;

function checked(value: OfflineSnapshot): OfflineSnapshot {
  if (!Array.isArray(value?.pending) || !value?.drafts)
    throw new Error("Protected writing could not be read. Please try again.");
  if (value.pending.length > MAX_PENDING)
    throw new Error(
      "Your device has 10 waiting entries. Sync or remove one before saving another.",
    );
  const next = fresh();
  for (const entry of value.pending) {
    if (
      !["checkins", "reflections"].includes(entry.collection) ||
      typeof entry.id !== "string" ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(entry.id) ||
      entry.record?.id !== entry.id ||
      typeof entry.createdAt !== "string"
    )
      throw new Error("Protected writing could not be read. Please try again.");
    next.pending.push({
      ...entry,
      record: writingRecord(entry.collection, entry.record),
    });
  }
  for (const [key, fields] of Object.entries(draftFields)) {
    if (!value.drafts[key]) continue;
    next.drafts[key] = {};
    for (const field of fields) {
      const text = value.drafts[key][field];
      if (typeof text === "string") next.drafts[key][field] = text;
    }
  }
  if (byteSize(JSON.stringify(next)) > MAX_BYTES)
    throw new Error(
      "Protected device storage is full. Keep this screen open and sync waiting entries before saving more writing.",
    );
  return next;
}
type Manifest = {
  version: 1;
  account: string;
  active: 0 | 1;
  counts: [number, number];
};
function chunks(text: string) {
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const point of text) {
    const count = byteSize(point);
    if (bytes + count > CHUNK_BYTES) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += point;
    bytes += count;
  }
  if (current) parts.push(current);
  return parts;
}

export function createOfflineVault(storage?: VaultStorage) {
  const cache = new Map<string, OfflineSnapshot>();
  const manifests = new Map<string, Manifest>();
  let lane = Promise.resolve();
  const run = <T>(job: () => Promise<T>): Promise<T> => {
    const result = lane.catch(() => {}).then(job);
    lane = result.then(
      () => {},
      () => {},
    );
    return result;
  };
  const prefix = (account: string) => {
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(account))
      throw new Error("Please sign in again to protect your writing.");
    return `solace.writing.v1.${account}`;
  };
  const read = async (account: string): Promise<OfflineSnapshot> => {
    const base = prefix(account);
    if (cache.has(account)) return copy(cache.get(account)!);
    let snapshot = fresh();
    if (storage) {
      const raw = await storage.get(`${base}.index`);
      if (raw) {
        const manifest = JSON.parse(raw) as Manifest;
        if (
          manifest.version !== 1 ||
          manifest.account !== account ||
          ![0, 1].includes(manifest.active) ||
          !Array.isArray(manifest.counts) ||
          manifest.counts.length !== 2 ||
          manifest.counts.some((n) => !Number.isInteger(n) || n < 0 || n > 65)
        )
          throw new Error(
            "Protected writing could not be read. Please try again.",
          );
        manifests.set(account, manifest);
        const count = manifest.counts[manifest.active];
        if (count) {
          const parts: string[] = [];
          for (let i = 0; i < count; i++) {
            const part = await storage.get(`${base}.${manifest.active}.${i}`);
            if (part === null)
              throw new Error(
                "Protected writing could not be read. Please try again.",
              );
            parts.push(part);
          }
          snapshot = checked(JSON.parse(parts.join("")));
        }
      }
    }
    cache.set(account, snapshot);
    return copy(snapshot);
  };
  return {
    durable: !!storage,
    read: (account: string) => run(() => read(account)),
    update: (
      account: string,
      change: (current: OfflineSnapshot) => OfflineSnapshot,
    ) =>
      run(async () => {
        const next = checked(change(await read(account)));
        if (storage) {
          const base = prefix(account);
          const previous =
            manifests.get(account) ||
            ({ version: 1, account, active: 0, counts: [0, 0] } as Manifest);
          const target = previous.active === 0 ? 1 : 0;
          const parts = chunks(JSON.stringify(next));
          const staging: Manifest = {
            ...previous,
            counts: [...previous.counts],
          };
          staging.counts[target] = Math.max(
            parts.length,
            previous.counts[target],
          );
          // Record the inactive slot's extent before writing it. A crash leaves
          // the old active generation readable and every staged key erasable.
          await storage.set(`${base}.index`, JSON.stringify(staging));
          manifests.set(account, staging);
          for (let i = 0; i < staging.counts[target]; i++)
            await storage.set(`${base}.${target}.${i}`, parts[i] || "");
          const committed: Manifest = {
            ...staging,
            active: target,
            counts: [...staging.counts],
          };
          await storage.set(`${base}.index`, JSON.stringify(committed));
          manifests.set(account, committed);
          // Only the pointer above commits a save. Cleanup failure must not turn
          // a committed save into a false failure; logout retries all known keys.
          for (let i = 0; i < staging.counts[previous.active]; i++)
            await storage
              .remove(`${base}.${previous.active}.${i}`)
              .catch(() => {});
        }
        cache.set(account, next);
        return copy(next);
      }),
    clear: (account: string) =>
      run(async () => {
        const base = prefix(account);
        if (storage) {
          // Erasure must work even when a damaged payload cannot be restored.
          // The fixed bounded keyspace also covers an interrupted first write.
          for (const slot of [0, 1] as const)
            for (let i = 0; i < 65; i++)
              await storage.remove(`${base}.${slot}.${i}`);
          await storage.remove(`${base}.index`);
        }
        cache.delete(account);
        manifests.delete(account);
      }),
  };
}
