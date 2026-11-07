import type { HabitDraft } from "./habit-contract.js";

export const habitAiIntents = [
  "suggest",
  "routine",
  "simplify",
  "adjust",
  "restart",
  "reflect",
] as const;

export type HabitAiIntent = (typeof habitAiIntents)[number];

export type HabitAiInput = {
  intent: HabitAiIntent;
  prompt: string;
  habitId?: string;
  includeProgress?: boolean;
  timeZone?: string;
};

export type HabitAiResult = {
  provider: "live" | "offline";
  note: string;
  support?: true;
  suggestion?: HabitDraft;
  habitId?: string;
  revision?: number;
};
