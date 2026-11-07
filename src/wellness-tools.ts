import type { ImageSourcePropType } from "react-native";
import { createExplorePractice } from "./explore-practices";
import { routes } from "./routes";

type ExploreCategory = "breathe" | "reflect" | "sleep" | "focus" | "move";
type ToolFilter = "relax" | "move" | "grow";

export type WellnessToolDestination = {
  route: string;
  params?: Record<string, unknown>;
};

export type WellnessTool = {
  title: string;
  detail: string;
  icon: string;
  categories: ExploreCategory[];
  destination: WellnessToolDestination;
  artwork: ImageSourcePropType;
  flipArtwork?: boolean;
  tone: "sage" | "lavender" | "peach";
};

const ridge = require("../assets/today-explore-guided.jpg");
const forest = require("../assets/today-explore-toolkit.jpg");
const dawn = require("../assets/today-explore-checkins.jpg");

const tools = {
  ambient: {
    title: "Ambient Sound Mixer",
    detail: "Layer rain, waves, forest air, and soft wind.",
    icon: "musical-notes-outline",
    categories: ["sleep", "focus"],
    destination: { route: "ambient-mixer" },
    artwork: ridge,
    tone: "lavender",
  },
  moments: {
    title: "Solace Moments",
    detail: "Choose a guided activity for how you feel.",
    icon: "sparkles-outline",
    categories: ["breathe", "reflect", "focus"],
    destination: { route: "moments" },
    artwork: require("../assets/today-twilight-lotus.jpg"),
    flipArtwork: true,
    tone: "peach",
  },
  movement: {
    title: "Gentle Movement",
    detail: "A three-minute movement practice at your own pace.",
    icon: "body-outline",
    categories: ["move"],
    destination: {
      route: routes.momentPlayer,
      params: {
        activity: createExplorePractice("move", 3),
        provider: "offline",
        source: "explore",
      },
    },
    artwork: require("../assets/profile-mountains-light.jpg"),
    tone: "sage",
  },
  guides: {
    title: "Guides & Resources",
    detail: "Browse sleep, stress, connection, and other guides.",
    icon: "book-outline",
    categories: ["focus"],
    destination: { route: "resources" },
    artwork: require("../assets/redesign-explore-ground.jpg"),
    tone: "sage",
  },
  sleep: {
    title: "Sleep Wind-Down Guide",
    detail: "Four gentle steps to try at your own pace.",
    icon: "moon-outline",
    categories: ["sleep"],
    destination: { route: "sleep" },
    artwork: require("../assets/redesign-explore-sleep.jpg"),
    tone: "lavender",
  },
  senses: {
    title: "Five-Senses Exercise",
    detail: "Go one sense at a time without a timer.",
    icon: "hand-left-outline",
    categories: ["focus"],
    destination: { route: "grounding" },
    artwork: forest,
    tone: "sage",
  },
  assessments: {
    title: "Reflective Check-Ins",
    detail: "Short mood, worry, and self-compassion questionnaires.",
    icon: "clipboard-outline",
    categories: ["reflect"],
    destination: { route: "assessments" },
    artwork: require("../assets/journal-thumbnail-dark.jpg"),
    tone: "lavender",
  },
  affirmation: {
    title: "Daily Affirmation",
    detail: "A kind thought to keep close.",
    icon: "heart-outline",
    categories: ["reflect"],
    destination: { route: "affirmation" },
    artwork: require("../assets/today-pause-light.jpg"),
    tone: "peach",
  },
  challenge: {
    title: "Daily Challenge",
    detail: "One small, gentle action for today.",
    icon: "sunny-outline",
    categories: ["focus"],
    destination: { route: "challenge" },
    artwork: dawn,
    tone: "peach",
  },
  breathing: {
    title: "Breathing Exercise",
    detail: "Settle into an easy rhythm with a guided breath.",
    icon: "cloud-outline",
    categories: ["breathe"],
    destination: { route: routes.technique, params: { id: "breathing" } },
    artwork: require("../assets/redesign-explore-breathe.jpg"),
    tone: "sage",
  },
  gratitude: {
    title: "Gratitude Journal",
    detail: "Make space to notice something you appreciate.",
    icon: "book-outline",
    categories: ["reflect"],
    destination: {
      route: routes.journalEditor,
      params: {
        prompt: "What is one small thing you appreciated today, and why?",
      },
    },
    artwork: require("../assets/redesign-explore-reflect.jpg"),
    tone: "peach",
  },
  mood: {
    title: "Mood Check-in",
    detail: "Pause and note how you feel today.",
    icon: "happy-outline",
    categories: ["reflect"],
    destination: { route: "checkin" },
    artwork: ridge,
    tone: "lavender",
  },
} satisfies Record<string, WellnessTool>;

// Keep the original Explore catalog order and search metadata.
export const exploreWellnessTools: WellnessTool[] = [
  tools.ambient,
  tools.moments,
  tools.movement,
  tools.guides,
  tools.sleep,
  tools.senses,
  tools.assessments,
  tools.affirmation,
  tools.challenge,
];

export const wellnessToolGroups: readonly {
  title: string;
  icon: string;
  filter: ToolFilter;
  tools: readonly WellnessTool[];
}[] = [
  {
    title: "Relax & Unwind",
    icon: "headset-outline",
    filter: "relax",
    tools: [tools.ambient, tools.moments],
  },
  {
    title: "Calm & Restore",
    icon: "cloud-outline",
    filter: "relax",
    tools: [tools.breathing, tools.sleep, tools.senses],
  },
  {
    title: "Move & Energize",
    icon: "walk-outline",
    filter: "move",
    tools: [tools.movement],
  },
  {
    title: "Grow & Reflect",
    icon: "leaf-outline",
    filter: "grow",
    tools: [tools.affirmation, tools.gratitude, tools.mood, tools.assessments],
  },
  {
    title: "Keep the Momentum",
    icon: "locate-outline",
    filter: "grow",
    tools: [tools.challenge, tools.guides],
  },
];

export const wellnessToolArrivalRoutes = new Set([
  routes.exploreCatalog,
  ...Object.values(tools).map(({ destination }) => destination.route),
]);
