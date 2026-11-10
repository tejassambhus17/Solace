const enabled = process.env.EXPO_PUBLIC_SOLACE_VOICE_TIMING === "1";
let startedAt: number | undefined;
const stages = [
  "tap",
  "layout",
  "attempt",
  "permission",
  "audio-mode",
  "microphone",
  "offer",
  "answer",
  "remote-description",
  "media-ready",
  "ready",
  "listening",
  "first-output",
] as const;
export type VoiceTimingStage = (typeof stages)[number];

export function markVoiceTiming(stage: VoiceTimingStage) {
  if (!enabled) return;
  const performance = globalThis.performance;
  if (!performance?.mark) return;
  const name = `solace-voice:${stage}`;
  performance.clearMarks?.(name);
  performance.mark(name);
  if (typeof document === "undefined" && startedAt !== undefined)
    console.info(
      `[solace-voice] ${stage} ${Math.round(performance.now() - startedAt)}ms`,
    );
}

export function beginVoiceTiming() {
  if (!enabled) return;
  startedAt = globalThis.performance?.now();
  for (const stage of stages)
    globalThis.performance?.clearMarks?.(`solace-voice:${stage}`);
  markVoiceTiming("tap");
}
