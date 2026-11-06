import {
  chatPractices,
  type ChatPracticeId,
} from "../server/src/chat-practice";
import type { SolaceMoment } from "../server/src/moment-contract";
import { createExplorePractice, type PracticeFocus } from "./explore-practices";

export const techniqueCategories = [
  "All",
  "Stress",
  "Worry",
  "Grounding",
  "Relaxation",
  "Sleep",
  "Focus",
  "Difficult emotions",
] as const;
export type TechniqueCategory = (typeof techniqueCategories)[number];
export type TechniqueId = ChatPracticeId | "box-breathing" | "body-relaxation";

type TechniqueRecipe = {
  title: string;
  description: string;
  label: string;
  artwork: "breathe" | "ground" | "reflect" | "sleep";
  categories: readonly Exclude<TechniqueCategory, "All">[];
  focus: PracticeFocus;
  selfPaced?: boolean;
  guidance?: readonly [title: string, instruction: string, seconds: number][];
  breathing?: SolaceMoment["breathing"];
  prompt?: string;
};

const recipes: Record<TechniqueId, TechniqueRecipe> = {
  "box-breathing": {
    title: "Box breathing",
    description: "Follow four equal counts in a gentle breathing rhythm.",
    label: "Breathing",
    artwork: "breathe",
    categories: ["Stress", "Focus"],
    focus: "breathe",
    breathing: { inhale: 4, hold: 4, exhale: 4, rest: 4 },
    guidance: [
      [
        "Find support",
        "Sit comfortably and let your breathing stay easy as you get ready.",
        20,
      ],
      [
        "Follow the four phases",
        "If comfortable, breathe in, pause, breathe out, and pause again for four counts each. Let your breathing return to its natural rhythm any time.",
        144,
      ],
      [
        "Return to your rhythm",
        "Let the count go and take a moment to notice your surroundings.",
        16,
      ],
    ],
  },
  breathing: {
    title: "Slow breathing",
    description: "Settle into an easy rhythm with a gently lengthened exhale.",
    label: "Breathing",
    artwork: "breathe",
    categories: ["Stress", "Worry", "Relaxation"],
    focus: "breathe",
  },
  grounding: {
    title: "Five-senses grounding",
    description: "Notice what is around you, one sense at a time.",
    label: "Grounding",
    artwork: "ground",
    categories: ["Stress", "Worry", "Grounding", "Difficult emotions"],
    focus: "ground",
    selfPaced: true,
    guidance: [
      [
        "Notice five things you see",
        "Let your eyes settle on five colors, shapes, or objects. Use any sense that is comfortable for you.",
        40,
      ],
      [
        "Notice four things you feel",
        "Notice four textures or points of contact, such as the surface under you or the fabric of your clothes.",
        40,
      ],
      [
        "Notice three sounds",
        "Listen for three nearby or distant sounds. Take as long as you need.",
        40,
      ],
      [
        "Notice two scents",
        "If you can, notice two familiar scents. You can think of scents you like or move on whenever you prefer.",
        30,
      ],
      [
        "Notice one taste",
        "Notice a taste that is already there, or imagine one. Then take a moment to look around again.",
        30,
      ],
    ],
  },
  "body-relaxation": {
    title: "Gentle body relaxation",
    description:
      "Notice areas of tension and soften where it feels comfortable.",
    label: "Relaxation",
    artwork: "sleep",
    categories: ["Stress", "Relaxation", "Sleep"],
    focus: "rest",
    guidance: [
      [
        "Find a supported position",
        "Sit or lie down somewhere comfortable. Let your eyes rest wherever you prefer.",
        30,
      ],
      [
        "Check in with your upper body",
        "Notice your hands, shoulders, and jaw. Let any area soften that feels ready to, without trying to change the rest.",
        60,
      ],
      [
        "Notice the weight of your body",
        "Bring attention to your legs and feet. Notice the surface supporting them and breathe naturally.",
        60,
      ],
      [
        "Take your time returning",
        "Notice the whole body and make any small adjustment that would feel good before you finish.",
        30,
      ],
    ],
  },
  reflection: {
    title: "Short reflection",
    description:
      "Make room for one thought you would like to understand or keep.",
    label: "Reflection",
    artwork: "reflect",
    categories: ["Worry", "Focus", "Difficult emotions"],
    focus: "reflect",
    selfPaced: true,
  },
  "wind-down": {
    title: "Sleep wind-down",
    description: "Give yourself a quiet transition at the end of the day.",
    label: "Rest",
    artwork: "sleep",
    categories: ["Relaxation", "Sleep"],
    focus: "rest",
  },
  focus: {
    title: "Focus reset",
    description:
      "Bring your attention to one detail and choose one small next step.",
    label: "Grounding",
    artwork: "ground",
    categories: ["Focus", "Grounding"],
    focus: "ground",
    selfPaced: true,
    guidance: [
      [
        "Get settled",
        "Find a comfortable position and take a few easy breaths.",
        36,
      ],
      [
        "Choose one anchor",
        "Rest your attention on a sound, shape, or point of contact. When your mind wanders, return to that detail at your own pace.",
        90,
      ],
      [
        "Choose one next step",
        "If it helps, choose one small thing you would like to do when this pause ends.",
        54,
      ],
    ],
  },
  gratitude: {
    title: "Gratitude pause",
    description:
      "Take a quiet moment to appreciate something that mattered to you.",
    label: "Reflection",
    artwork: "reflect",
    categories: ["Relaxation", "Difficult emotions"],
    focus: "reflect",
    selfPaced: true,
    guidance: [
      [
        "Make space",
        "Pause somewhere comfortable and let your attention settle.",
        36,
      ],
      [
        "Notice one good thing",
        "Think of something you appreciated today. It can be as small as a quiet minute. If nothing comes to mind, you can simply rest.",
        90,
      ],
      [
        "Take what fits",
        "Name what mattered about it, silently or in a few words of your own.",
        54,
      ],
    ],
    prompt: "What did you appreciate, and what made it matter to you?",
  },
};

export function isTechniqueId(value: unknown): value is TechniqueId {
  return typeof value === "string" && Object.hasOwn(recipes, value);
}

export function createTechniquePractice(id: TechniqueId): SolaceMoment {
  const recipe = recipes[id];
  const base = createExplorePractice(recipe.focus, 3);
  return {
    ...base,
    id: `${Object.hasOwn(chatPractices, id) ? "chat" : "technique"}-${id}`,
    title: recipe.title,
    description: recipe.description,
    breathing: recipe.breathing ?? base.breathing,
    steps:
      recipe.guidance?.map(([title, instruction, durationSec]) => ({
        title,
        instruction,
        durationSec,
      })) ?? base.steps,
    reflectionPrompts: recipe.prompt ? [recipe.prompt] : base.reflectionPrompts,
  };
}

export type Technique = Pick<
  TechniqueRecipe,
  "title" | "description" | "label" | "artwork" | "categories"
> & {
  id: TechniqueId;
  selfPaced: boolean;
  activity: SolaceMoment;
};

export function getTechnique(value: unknown): Technique | undefined {
  if (!isTechniqueId(value)) return undefined;
  const { title, description, label, artwork, categories, selfPaced } =
    recipes[value];
  return {
    id: value,
    title,
    description,
    label,
    artwork,
    categories,
    selfPaced: selfPaced ?? false,
    activity: createTechniquePractice(value),
  };
}

export function listTechniques(category: TechniqueCategory): Technique[] {
  return Object.keys(recipes)
    .filter(isTechniqueId)
    .map((id) => getTechnique(id)!)
    .filter(
      (technique) =>
        category === "All" || technique.categories.includes(category),
    );
}
