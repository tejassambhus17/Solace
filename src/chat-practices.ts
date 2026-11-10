import type { ChatPracticeId } from "../server/src/chat-practice";
import { createTechniquePractice } from "./techniques";

export function createChatPractice(type: ChatPracticeId) {
  return createTechniquePractice(type);
}

const conversationTopics: Record<ChatPracticeId, [RegExp, string]> = {
  breathing: [/\bbreath(?:ing|s)?\b/i, "breathing"],
  grounding: [/\bgrounding\b/i, "grounding"],
  reflection: [/\b(?:reflect(?:ion|ing)?|journal(?:ing)?)\b/i, "reflection"],
  "wind-down": [/\b(?:bedtime|before bed|going to bed)\b/i, "bedtime"],
  focus: [/\b(?:focus(?:ing)?|concentrat(?:e|ing|ion))\b/i, "focus"],
  gratitude: [/\b(?:gratitude|grateful|thankful)\b/i, "gratitude"],
};

export function shortChatPracticeReason(
  practice: ChatPracticeId,
  explanation: {
    basis: "conversation" | "general" | "personalized";
    reason: string;
  },
  precedingUserText: string,
) {
  if (explanation.basis !== "conversation") return explanation.reason;
  const [pattern, topic] = conversationTopics[practice];
  return pattern.test(precedingUserText)
    ? `You brought up ${topic}.`
    : "Based on what you shared in this conversation.";
}
