import {
  chatPractices,
  type ChatPracticeId,
} from "../server/src/chat-practice";
import { createExplorePractice, type PracticeFocus } from "./explore-practices";

const practiceFocus: Record<ChatPracticeId, PracticeFocus> = {
  breathing: "breathe",
  grounding: "ground",
  reflection: "reflect",
  "wind-down": "rest",
  focus: "ground",
  gratitude: "reflect",
};

export function createChatPractice(type: ChatPracticeId) {
  const activity = createExplorePractice(practiceFocus[type], 3);
  const base = {
    ...activity,
    id: `chat-${type}`,
    title: chatPractices[type].title,
  };
  if (type === "focus")
    return {
      ...base,
      description:
        "Bring your attention back to one detail and choose one small next step.",
      steps: [
        activity.steps[0],
        {
          ...activity.steps[1],
          title: "Choose one anchor",
          instruction:
            "Rest your attention on one sound, shape, or point of contact. When your mind wanders, return to that detail at your own pace.",
        },
        {
          ...activity.steps[2],
          title: "Choose one next step",
          instruction:
            "If it helps, choose one small thing you would like to do when this pause ends.",
        },
      ],
    };
  if (type === "gratitude")
    return {
      ...base,
      description:
        "Take a quiet moment to appreciate something that mattered to you.",
      steps: [
        activity.steps[0],
        {
          ...activity.steps[1],
          title: "Notice one good thing",
          instruction:
            "Bring to mind something you appreciated today. It can be as small as a quiet minute. If nothing comes to mind, you can simply rest.",
        },
        activity.steps[2],
      ],
      reflectionPrompts: [
        "What did you appreciate, and what made it matter to you?",
      ],
    };
  return base;
}
