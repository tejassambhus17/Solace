import type { SolaceMoment } from "../server/src/moment-contract";

export const practiceDurations = [3, 5, 10] as const;
type PracticeDuration = (typeof practiceDurations)[number];

type PracticeTemplate = Omit<
  SolaceMoment,
  "version" | "id" | "durationSec" | "steps"
> & {
  label: string;
  icon: string;
  steps: [string, string][];
};

export const practiceFocuses = {
  breathe: {
    label: "Breathe",
    icon: "cloud-outline",
    type: "breathing",
    title: "Calm Your Mind",
    description:
      "A guided pause to slow down and settle into a comfortable rhythm.",
    environment: "forest",
    breathing: { inhale: 4, hold: 0, exhale: 6 },
    reflectionPrompts: [],
    steps: [
      [
        "Arrive",
        "Find a comfortable position and feel the support beneath you. Let your breathing be easy.",
      ],
      [
        "Follow softly",
        "If it feels comfortable, follow the petal as it opens and settles. You can breathe naturally whenever you prefer.",
      ],
      [
        "Return slowly",
        "Let the rhythm go. Notice the room around you and take your time before moving on.",
      ],
    ],
  },
  ground: {
    label: "Ground",
    icon: "hand-left-outline",
    type: "grounding",
    title: "Come Back to the Room",
    description: "Use the senses available to you to notice where you are.",
    environment: "forest",
    breathing: null,
    reflectionPrompts: [],
    steps: [
      [
        "Look around",
        "Notice a few colors, shapes, or points of light. You can also imagine a familiar space.",
      ],
      [
        "Listen and feel",
        "Notice a sound and a texture, such as your clothes or the surface supporting you. Choose any sense that feels comfortable.",
      ],
      [
        "Notice one detail",
        "If you like, notice a scent or taste. Return your attention to one detail you can take with you.",
      ],
    ],
  },
  reflect: {
    label: "Reflect",
    icon: "pencil-outline",
    type: "reflection",
    title: "A Moment to Reflect",
    description: "Make time for one thought you want to notice or keep.",
    environment: "ocean",
    breathing: null,
    reflectionPrompts: [
      "What stood out today, and what would you like to carry forward?",
    ],
    steps: [
      [
        "Make space",
        "Find a comfortable place to pause. You can reflect silently, write on paper, or make a note afterward.",
      ],
      [
        "Consider one moment",
        "Think of something that stood out today. Give yourself time to notice what mattered about it.",
      ],
      [
        "Keep what fits",
        "Choose a word or thought to carry forward. You can leave the rest here.",
      ],
    ],
  },
  rest: {
    label: "Relax",
    icon: "moon-outline",
    type: "rest",
    title: "A Quieter Pace",
    description: "Set aside a few minutes to rest in a way that suits you.",
    environment: "twilight",
    breathing: null,
    reflectionPrompts: [],
    steps: [
      [
        "Get comfortable",
        "Choose a position that feels supported. Let your eyes rest where you prefer.",
      ],
      [
        "Notice support",
        "Notice where your body touches the chair, floor, or bed. If you like, invite your hands and shoulders to soften.",
      ],
      [
        "Leave room",
        "Take a moment to decide what feels right next. You can stay here a little longer.",
      ],
    ],
  },
  move: {
    label: "Move",
    icon: "body-outline",
    type: "rest",
    title: "Gentle Movement",
    description:
      "Take a little time to move in ways that feel comfortable to you.",
    environment: "forest",
    breathing: null,
    reflectionPrompts: [],
    steps: [
      [
        "Find a steady position",
        "Sit or stand somewhere comfortable. Notice where your feet or body meet a steady surface.",
      ],
      [
        "Choose a small movement",
        "If you like, gently open and close your hands or roll your shoulders. Stay within a comfortable range and rest whenever you want.",
      ],
      [
        "Settle back",
        "Let the movement stop. Notice how you feel, and choose whether to continue or rest.",
      ],
    ],
  },
} satisfies Record<string, PracticeTemplate>;

export type PracticeFocus = keyof typeof practiceFocuses;

export function createExplorePractice(
  focus: PracticeFocus,
  minutes: PracticeDuration,
): SolaceMoment {
  const {
    title,
    description,
    environment,
    type,
    breathing,
    reflectionPrompts,
    steps,
  } = practiceFocuses[focus];
  const durationSec = minutes * 60;
  const durations = [durationSec / 5, durationSec / 2, (durationSec * 3) / 10];
  return {
    version: 1,
    id: `explore-${focus}-${minutes}`,
    type,
    title,
    description,
    durationSec,
    environment,
    breathing,
    reflectionPrompts,
    steps: steps.map(([stepTitle, instruction], index) => ({
      title: stepTitle,
      instruction,
      durationSec: durations[index],
    })),
  };
}
