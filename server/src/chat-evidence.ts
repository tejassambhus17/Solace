import type { ChatPracticeId } from "./chat-practice.js";

export const chatEvidenceKinds = [
  "checkin",
  "helpful-moment",
  "approved-preference",
] as const;
type ChatEvidenceKind = (typeof chatEvidenceKinds)[number];
type EvidenceRecord = Readonly<Record<string, unknown>>;
type EvidenceSources = {
  checkins: readonly EvidenceRecord[];
  sessions: readonly EvidenceRecord[];
  memories: readonly EvidenceRecord[];
};

export type ChatEvidence = {
  kind: ChatEvidenceKind;
  id: string;
  revision: string;
};

export type ChatExplanation =
  | { basis: "general" | "conversation" }
  | { basis: "personalized"; evidence: ChatEvidence };

export type AvailableChatEvidence = ChatEvidence & { practice: ChatPracticeId };

const moodPractice = new Map<string, ChatPracticeId>([
  ["stressed", "breathing"],
  ["low", "reflection"],
  ["calm", "reflection"],
  ["okay", "focus"],
  ["great", "gratitude"],
]);

function preferredPractice(record: EvidenceRecord): ChatPracticeId | undefined {
  if (
    record.approved !== true ||
    (record.category &&
      record.category !== "preference" &&
      record.category !== "activity")
  )
    return;
  const preference = record.text ?? record.content ?? record.value;
  if (
    typeof preference !== "string" ||
    /\b(?:not|never|avoid|dislike|hate|don['’]t|without)\b/i.test(preference)
  )
    return;
  const options = [
    [/\b(?:breathwork|breathing|breath exercises)\b/i, "breathing"],
    [/\b(?:grounding|five senses)\b/i, "grounding"],
    [/\b(?:reflection|journaling|journal)\b/i, "reflection"],
    [/\b(?:wind.down|bedtime|guided rest|rest moments?)\b/i, "wind-down"],
    [/\b(?:focus practice|focus pause|focus moments?)\b/i, "focus"],
    [/\b(?:gratitude|appreciation)\b/i, "gratitude"],
  ] as const;
  const matches = options.filter(([pattern]) => pattern.test(preference));
  return matches.length === 1 ? matches[0][1] : undefined;
}

function helpfulPractice(record: EvidenceRecord): ChatPracticeId | undefined {
  if (record.completed !== true || record.feedback !== "Helped") return;
  const activityId = (record.activity as { id?: unknown } | undefined)?.id;
  if (activityId === "chat-focus" && record.type === "grounding")
    return "focus";
  if (activityId === "chat-gratitude" && record.type === "reflection")
    return "gratitude";
  switch (record.type) {
    case "breathing":
    case "grounding":
    case "reflection":
      return record.type;
    case "rest":
      return "wind-down";
  }
}

const revisionOf = (record: EvidenceRecord) =>
  record.updatedAt ?? record.createdAt;

function evidencePractice(
  kind: ChatEvidenceKind,
  record: EvidenceRecord,
  memories: readonly EvidenceRecord[],
) {
  if (kind === "checkin")
    return typeof record.mood === "string"
      ? moodPractice.get(record.mood.toLowerCase())
      : undefined;
  if (kind === "helpful-moment") {
    const practice = helpfulPractice(record);
    if (!practice) return;
    const savedPreference =
      practice === "focus"
        ? "grounding"
        : practice === "gratitude"
          ? "reflection"
          : practice;
    // The rating is private unless the account also approved a linked
    // preference through the Moment's Remember what helped action.
    return memories.some((memory) => {
      if (memory.sourceType !== "session" || memory.sourceId !== record.id)
        return false;
      const preference = preferredPractice(memory);
      return preference === savedPreference || preference === practice;
    })
      ? practice
      : undefined;
  }
  return preferredPractice(record);
}

const collections = {
  checkin: "checkins",
  "helpful-moment": "sessions",
  "approved-preference": "memories",
} as const;

export function availableChatEvidence(
  sources: EvidenceSources,
  now = Date.now(),
) {
  const evidence: AvailableChatEvidence[] = [];
  for (const kind of chatEvidenceKinds) {
    const practices = new Set<ChatPracticeId>();
    for (const record of sources[collections[kind]]) {
      const created =
        typeof record.createdAt === "string"
          ? Date.parse(record.createdAt)
          : NaN;
      if (
        !Number.isFinite(created) ||
        created > now ||
        (kind === "checkin" && now - created > 7 * 86_400_000)
      )
        continue;
      const practice = evidencePractice(kind, record, sources.memories);
      const revision = revisionOf(record);
      if (
        !practice ||
        practices.has(practice) ||
        typeof record.id !== "string" ||
        typeof revision !== "string"
      )
        continue;
      practices.add(practice);
      evidence.push({ kind, practice, id: record.id, revision });
      // Only the most recent eligible check-in can inform a new recommendation.
      if (kind === "checkin") break;
    }
  }
  return evidence;
}

const reasons: Record<ChatEvidenceKind, string> = {
  checkin: "A mood check-in you saved matched this practice.",
  "helpful-moment":
    "You marked this kind of Moment as helpful and approved a preference linked to it.",
  "approved-preference":
    "An activity preference you approved matched this practice.",
};

export function describeChatExplanation(
  explanation: ChatExplanation | undefined,
  practice: ChatPracticeId,
  consent: boolean,
  sources: EvidenceSources,
) {
  if (explanation?.basis === "personalized" && consent) {
    const { kind, id, revision } = explanation.evidence;
    const collection = collections[kind];
    const record =
      collection && sources[collection].find((item) => item.id === id);
    if (
      record &&
      revisionOf(record) === revision &&
      evidencePractice(kind, record, sources.memories) === practice
    )
      return { basis: "personalized" as const, reason: reasons[kind] };
  }
  if (explanation?.basis === "conversation")
    return {
      basis: "conversation" as const,
      reason:
        "Solace offered this practice in response to the conversation you’re having.",
    };
  return {
    basis: "general" as const,
    reason: "This is a general practice you can try if it feels useful.",
  };
}
