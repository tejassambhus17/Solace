import type { MomentResult, SolaceMoment } from "../server/src/moment-contract";

export type { MomentEnvironment } from "../server/src/moment-contract";
export type GeneratedMoment = MomentResult;

export type MomentClock = { elapsedMs: number; runningSince: number | null };
export const emptyClock = (): MomentClock => ({
  elapsedMs: 0,
  runningSince: null,
});

export function newMomentSessionId() {
  return `moment-session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** A monotonic active clock. Pauses never accrue time or unlock completion. */
export function elapsedMomentMs(
  clock: MomentClock,
  now: number,
  durationSec: number,
) {
  const running =
    clock.runningSince === null ? 0 : Math.max(0, now - clock.runningSince);
  return Math.min(durationSec * 1000, Math.max(0, clock.elapsedMs + running));
}

export function resumeMoment(clock: MomentClock, now: number): MomentClock {
  return clock.runningSince === null ? { ...clock, runningSince: now } : clock;
}

export function pauseMoment(
  clock: MomentClock,
  now: number,
  durationSec: number,
): MomentClock {
  return {
    elapsedMs: elapsedMomentMs(clock, now, durationSec),
    runningSince: null,
  };
}

export function momentPosition(activity: SolaceMoment, elapsedMs: number) {
  const elapsedSec = Math.max(
    0,
    Math.min(activity.durationSec, elapsedMs / 1000),
  );
  let start = 0;
  for (let index = 0; index < activity.steps.length; index++) {
    const step = activity.steps[index];
    const end = start + step.durationSec;
    if (elapsedSec < end || index === activity.steps.length - 1) {
      return {
        index,
        step,
        stepElapsed: Math.max(0, elapsedSec - start),
        stepRemaining: Math.max(0, Math.ceil(end - elapsedSec)),
        complete: elapsedSec >= activity.durationSec,
      };
    }
    start = end;
  }
  throw new Error("This Moment has no guidance steps.");
}

export function breathingPosition(
  elapsedSec: number,
  pattern: { inhale: number; hold: number; exhale: number },
) {
  const cycle = pattern.inhale + pattern.hold + pattern.exhale;
  const position = Math.max(0, elapsedSec) % cycle;
  if (position < pattern.inhale)
    return {
      phase: "Breathe in",
      remaining: Math.ceil(pattern.inhale - position),
      progress: position / pattern.inhale,
    };
  if (position < pattern.inhale + pattern.hold)
    return {
      phase: "Rest gently",
      remaining: Math.ceil(pattern.inhale + pattern.hold - position),
      progress: 1,
    };
  return {
    phase: "Breathe out",
    remaining: Math.ceil(cycle - position),
    progress: 1 - (position - pattern.inhale - pattern.hold) / pattern.exhale,
  };
}

export function momentBreathingPosition(
  activity: SolaceMoment,
  position: ReturnType<typeof momentPosition>,
  elapsedMs: number,
  builtIn: boolean,
) {
  if (!activity.breathing || position.complete) return null;
  // The three-step built-in breathing practices use the first and last steps
  // to arrive and return at a natural pace. The petal guides the middle step.
  if (builtIn && activity.steps.length === 3)
    return position.index === 1
      ? breathingPosition(position.stepElapsed, activity.breathing)
      : null;
  return breathingPosition(elapsedMs / 1000, activity.breathing);
}

const boundedText = (value: unknown, maximum: number) =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value.length <= maximum;
const integer = (value: unknown, minimum: number, maximum: number) =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= minimum &&
  value <= maximum;

/** Defense at the navigation boundary, before a timer or instruction is shown.
 * The authoritative generated-data schema lives on the API. */
export function isPlayableMoment(value: unknown): value is SolaceMoment {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, any>;
  if (
    v.version !== 1 ||
    !boundedText(v.id, 100) ||
    !["breathing", "grounding", "reflection", "rest"].includes(v.type) ||
    !boundedText(v.title, 100) ||
    !boundedText(v.description, 400) ||
    !integer(v.durationSec, 30, 600) ||
    !["forest", "ocean", "twilight"].includes(v.environment) ||
    !Array.isArray(v.steps) ||
    v.steps.length < 1 ||
    v.steps.length > 8 ||
    !Array.isArray(v.reflectionPrompts) ||
    v.reflectionPrompts.length > 3
  )
    return false;
  if (
    !v.steps.every(
      (step: any) =>
        step &&
        boundedText(step.title, 80) &&
        boundedText(step.instruction, 500) &&
        integer(step.durationSec, 5, 300),
    ) ||
    v.steps.reduce((sum: number, step: any) => sum + step.durationSec, 0) !==
      v.durationSec ||
    !v.reflectionPrompts.every((prompt: unknown) => boundedText(prompt, 240))
  )
    return false;
  if ((v.type === "breathing") !== (v.breathing !== null)) return false;
  if (
    v.breathing !== null &&
    (!v.breathing ||
      !integer(v.breathing.inhale, 2, 6) ||
      !integer(v.breathing.hold, 0, 4) ||
      !integer(v.breathing.exhale, 2, 8))
  )
    return false;
  return true;
}

export const momentClockText = (seconds: number) =>
  `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.floor(Math.max(0, seconds) % 60)).padStart(2, "0")}`;
