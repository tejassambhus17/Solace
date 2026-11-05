export type MomentEnvironment = "forest" | "ocean" | "twilight";
export type SolaceMoment = {
  version: 1;
  id: string;
  type: "breathing" | "grounding" | "reflection" | "rest";
  title: string;
  description: string;
  durationSec: number;
  steps: { title: string; instruction: string; durationSec: number }[];
  breathing: { inhale: number; hold: number; exhale: number } | null;
  reflectionPrompts: string[];
  environment: MomentEnvironment;
};

export type MomentResult = {
  activity: SolaceMoment | null;
  provider: "live" | "offline";
  explanation: string;
  usedMemoryIds: string[];
  support?: boolean;
  message?: string;
};
