import type { ChatPracticeId } from "../server/src/chat-practice";
import { createTechniquePractice } from "./techniques";

export function createChatPractice(type: ChatPracticeId) {
  return createTechniquePractice(type);
}
