import { isRecordId } from "./routes";

// The existing check-in API accepts client IDs. A reserved ID ties a response
// to its practice without creating a second mood record on retries.
export function practiceFollowUpId(sessionId: unknown) {
  if (!isRecordId(sessionId) || !sessionId.startsWith("moment-session-"))
    return undefined;
  const id = `after-${sessionId}`;
  return isRecordId(id) ? id : undefined;
}

export const isPracticeFollowUpId = (id: unknown) =>
  typeof id === "string" &&
  practiceFollowUpId(id.slice("after-".length)) === id;

export const emotionalRecheckChoices = [
  { id: "more-settled", label: "More settled", icon: "leaf-outline" },
  { id: "about-the-same", label: "About the same", icon: "remove-outline" },
  { id: "less-settled", label: "Less settled", icon: "water-outline" },
] as const;

export type EmotionalRecheckResponse =
  (typeof emotionalRecheckChoices)[number]["id"];

export function emotionalRecheckLabel(response: unknown) {
  return emotionalRecheckChoices.find(({ id }) => id === response)?.label;
}

export function practiceOrigins(
  params: { originCheckinId?: unknown; originActionId?: unknown },
  checkins: readonly { id?: string; localOnly?: boolean }[] | undefined,
) {
  return {
    ...(isRecordId(params.originCheckinId) &&
    checkins?.some(
      (record) =>
        record.id === params.originCheckinId && record.localOnly !== true,
    )
      ? { originCheckinId: params.originCheckinId }
      : {}),
    ...(isRecordId(params.originActionId)
      ? { originActionId: params.originActionId }
      : {}),
  };
}
