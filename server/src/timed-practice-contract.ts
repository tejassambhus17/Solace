import type { SolaceMoment } from "./moment-contract.js";

export const timedPracticeFocuses = [
  "calm",
  "focus",
  "sleep",
  "energy",
] as const;
export const timedPracticeDurations = [5, 10, 15, 20] as const;
export type TimedPracticeFocus = (typeof timedPracticeFocuses)[number];
export type TimedPracticeDuration = (typeof timedPracticeDurations)[number];

type Stage = readonly [title: string, instruction: string];
type Variant = readonly [
  title: string,
  description: string,
  durations: readonly number[],
];
type PracticeTemplate = Pick<
  SolaceMoment,
  "type" | "environment" | "breathing"
> & {
  stages: readonly Stage[];
  variants: Record<TimedPracticeDuration, Variant>;
};

const templates: Record<TimedPracticeFocus, PracticeTemplate> = {
  calm: {
    type: "breathing",
    environment: "forest",
    breathing: { inhale: 4, hold: 0, exhale: 6 },
    stages: [
      [
        "Arrive & settle",
        "Find a comfortable position and feel the support beneath you. Let your breathing be easy.",
      ],
      [
        "Follow the guidance",
        "If it feels comfortable, follow the petal as it opens and settles. You can breathe naturally whenever you prefer.",
      ],
      [
        "Take a natural breath",
        "Let go of the count and breathe at your own pace. Notice the weight of your hands or feet.",
      ],
      [
        "Return to the rhythm",
        "Try another round with the petal if it feels right. Let each breath stay light and comfortable.",
      ],
      [
        "Notice a quiet detail",
        "Rest your attention on a sound or a point of contact. There is no need to change your breathing.",
      ],
      [
        "Follow a final round",
        "Follow the petal again or stay with your natural breath. Choose the pace that feels easiest.",
      ],
      [
        "Rest with your breath",
        "Let the rhythm go. Feel the support beneath you and give yourself a few unhurried moments.",
      ],
      [
        "Return slowly",
        "Let the rhythm go. Notice the room around you and take your time before moving on.",
      ],
    ],
    variants: {
      5: [
        "Calm Your Mind",
        "Settle in, follow a comfortable breathing rhythm, and return slowly.",
        [60, 150, 90],
      ],
      10: [
        "Find an Easy Rhythm",
        "Try two short guided rounds with a natural breathing break between them.",
        [90, 150, 90, 150, 120],
      ],
      15: [
        "Settle Into a Rhythm",
        "Alternate short breathing rounds with time to notice your surroundings.",
        [90, 150, 120, 150, 120, 150, 120],
      ],
      20: [
        "A Longer Breathing Pause",
        "Move between gentle breathing rounds, quiet observation, and an unhurried return.",
        [120, 150, 150, 150, 150, 150, 180, 150],
      ],
    },
  },
  focus: {
    type: "grounding",
    environment: "forest",
    breathing: null,
    stages: [
      [
        "Find your bearings",
        "Find a comfortable position and notice where you are. Use the senses available to you.",
      ],
      [
        "Look around",
        "Notice a few colors, shapes, or points of light. You can also imagine a familiar space.",
      ],
      [
        "Listen and feel",
        "Notice a sound and a texture, such as your clothes or the surface supporting you.",
      ],
      [
        "Choose an anchor",
        "Pick one sound, texture, or object to return to whenever your attention wanders.",
      ],
      [
        "Notice a different detail",
        "Shift to another available sense and notice a small detail you did not pick up before.",
      ],
      [
        "Return to the anchor",
        "Let your attention come back to the same steady point, without rushing it.",
      ],
      [
        "Take in the whole space",
        "Notice several details together, then choose one to stay with for a little longer.",
      ],
      [
        "Choose your next step",
        "Notice one steady detail and choose one small thing to give your attention to next.",
      ],
    ],
    variants: {
      5: [
        "Come Back to the Room",
        "Notice what’s around you and choose one thing to focus on next.",
        [45, 150, 105],
      ],
      10: [
        "Make Room for Focus",
        "Move through a few senses, then return to one steady anchor.",
        [60, 120, 120, 180, 120],
      ],
      15: [
        "Return to What’s Here",
        "Explore several details before returning to a familiar anchor.",
        [90, 120, 150, 150, 120, 150, 120],
      ],
      20: [
        "Find a Steadier Focus",
        "Take time with different senses, one steady anchor, and the space around you.",
        [90, 150, 150, 180, 150, 180, 150, 150],
      ],
    },
  },
  sleep: {
    type: "rest",
    environment: "twilight",
    breathing: null,
    stages: [
      [
        "Get comfortable",
        "Choose a position that feels supported. Let your eyes rest where you prefer.",
      ],
      [
        "Notice support",
        "Notice where your body touches the chair, floor, or bed. If you like, invite your hands and shoulders to soften.",
      ],
      [
        "Let your hands rest",
        "Let your hands rest in a way that feels easy. Adjust your position whenever you want.",
      ],
      [
        "Soften your attention",
        "Notice one quiet detail in the room and allow it to fade into the background.",
      ],
      [
        "Find a quieter point",
        "Rest your attention on a familiar sound or the feeling of the surface beneath you.",
      ],
      [
        "Make room for stillness",
        "Let each breath come and go on its own. If your attention wanders, come back to the support beneath you.",
      ],
      [
        "Settle a little longer",
        "Stay where you are or make a small adjustment. There is no need to do anything else right now.",
      ],
      [
        "Leave room for rest",
        "Take a moment to decide what feels right next. You can stay here a little longer.",
      ],
    ],
    variants: {
      5: [
        "Sleep Wind Down",
        "Find a comfortable position and make a little space for rest.",
        [90, 120, 90],
      ],
      10: [
        "Settle Into the Evening",
        "Notice the support beneath you, then let your attention soften.",
        [90, 120, 150, 120, 120],
      ],
      15: [
        "Rest at Your Own Pace",
        "Move from physical support to a quiet point of attention and stillness.",
        [90, 120, 150, 150, 120, 150, 120],
      ],
      20: [
        "A Longer Wind Down",
        "Take an unhurried path through comfort, soft attention, and stillness.",
        [120, 120, 150, 150, 150, 180, 180, 150],
      ],
    },
  },
  energy: {
    type: "rest",
    environment: "forest",
    breathing: null,
    stages: [
      [
        "Find a steady position",
        "Choose a position that feels supported. Sitting is fine. Let your breath stay natural.",
      ],
      [
        "Choose a small movement",
        "If it feels comfortable, open and close your hands or roll your shoulders a few times. You can rest instead.",
      ],
      [
        "Take a quiet pause",
        "Stop moving and notice how you feel. Stay with a position that feels steady.",
      ],
      [
        "Try a second gentle round",
        "Repeat a small movement if you want, then rest. Keep your movement within an easy range.",
      ],
      [
        "Notice your posture",
        "See if a small shift makes your position more comfortable. Staying still is fine, too.",
      ],
      [
        "Choose one final movement",
        "Try one more easy movement if it feels right. Stop whenever you prefer.",
      ],
      [
        "Rest between movements",
        "Let your hands or shoulders settle. Notice what feels different without looking for a particular result.",
      ],
      [
        "Settle back",
        "Let the movement stop. Notice how you feel, and choose whether to continue or rest.",
      ],
    ],
    variants: {
      5: [
        "Gentle Movement",
        "Try a few comfortable movements with time to pause afterward.",
        [75, 120, 105],
      ],
      10: [
        "A Gentle Movement Break",
        "Alternate two brief movement rounds with a quiet pause.",
        [90, 120, 120, 120, 150],
      ],
      15: [
        "Move and Reset",
        "Try a few optional movement rounds and notice how each rest feels.",
        [90, 120, 120, 150, 150, 120, 150],
      ],
      20: [
        "A Longer Movement Reset",
        "Alternate brief, optional movement with generous pauses and a quiet finish.",
        [120, 120, 120, 180, 180, 150, 150, 180],
      ],
    },
  },
};

const stageOrder: Record<TimedPracticeDuration, readonly number[]> = {
  5: [0, 1, 7],
  10: [0, 1, 2, 3, 7],
  15: [0, 1, 2, 3, 4, 5, 7],
  20: [0, 1, 2, 3, 4, 5, 6, 7],
};

const practiceId = (
  focus: TimedPracticeFocus,
  minutes: TimedPracticeDuration,
) => `timed-practice-${focus}-${minutes}`;
const practices = new Map<
  string,
  { activity: SolaceMoment; breathingStages: number[] }
>();
for (const focus of timedPracticeFocuses) {
  const template = templates[focus];
  for (const minutes of timedPracticeDurations) {
    const [title, description, durations] = template.variants[minutes];
    const id = practiceId(focus, minutes);
    practices.set(id, {
      activity: {
        version: 1,
        id,
        title,
        description,
        type: template.type,
        environment: template.environment,
        durationSec: minutes * 60,
        steps: stageOrder[minutes].map((stage, index) => ({
          title: template.stages[stage][0],
          instruction: template.stages[stage][1],
          durationSec: durations[index],
        })),
        breathing: template.breathing,
        reflectionPrompts: [],
      },
      breathingStages:
        focus === "calm"
          ? stageOrder[minutes].flatMap((stage, index) =>
              [1, 3, 5].includes(stage) ? [index] : [],
            )
          : [],
    });
  }
}

export function isTimedPracticeFocus(
  value: unknown,
): value is TimedPracticeFocus {
  return timedPracticeFocuses.some((focus) => focus === value);
}

export function isTimedPracticeDuration(
  value: unknown,
): value is TimedPracticeDuration {
  return timedPracticeDurations.some((minutes) => minutes === value);
}

export function getTimedPractice(
  focus: TimedPracticeFocus,
  minutes: TimedPracticeDuration,
): SolaceMoment;
export function getTimedPractice(
  focus: unknown,
  minutes: unknown,
): SolaceMoment | undefined;
export function getTimedPractice(focus: unknown, minutes: unknown) {
  if (!isTimedPracticeFocus(focus) || !isTimedPracticeDuration(minutes)) return;
  return practices.get(practiceId(focus, minutes))?.activity;
}

export function isTimedPracticeId(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("timed-practice-");
}

export function timedPracticeBreathingStage(id: string, step: number) {
  return practices.get(id)?.breathingStages.includes(step);
}

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** The player may change the environment. Every other field must match the registered session. */
export function isCanonicalTimedPractice(
  value: unknown,
): value is SolaceMoment {
  if (!record(value) || !isTimedPracticeId(value.id)) return false;
  const activity = practices.get(value.id)?.activity;
  const steps = value.steps;
  if (
    !activity ||
    Object.keys(value).length !== Object.keys(activity).length ||
    !Object.keys(activity).every((key) => Object.hasOwn(value, key)) ||
    value.version !== activity.version ||
    value.type !== activity.type ||
    value.title !== activity.title ||
    value.description !== activity.description ||
    value.durationSec !== activity.durationSec ||
    (value.environment !== "forest" &&
      value.environment !== "ocean" &&
      value.environment !== "twilight") ||
    !Array.isArray(value.reflectionPrompts) ||
    value.reflectionPrompts.length !== 0 ||
    !Array.isArray(steps) ||
    steps.length !== activity.steps.length ||
    !activity.steps.every((step, index) => {
      const candidate: unknown = steps[index];
      return (
        record(candidate) &&
        Object.keys(candidate).length === 3 &&
        candidate.title === step.title &&
        candidate.instruction === step.instruction &&
        candidate.durationSec === step.durationSec
      );
    })
  )
    return false;

  if (activity.breathing === null) return value.breathing === null;
  return (
    record(value.breathing) &&
    Object.keys(value.breathing).length === 3 &&
    value.breathing.inhale === activity.breathing.inhale &&
    value.breathing.hold === activity.breathing.hold &&
    value.breathing.exhale === activity.breathing.exhale
  );
}
