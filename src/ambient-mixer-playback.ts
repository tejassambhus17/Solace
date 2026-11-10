import type { AudioSource, AudioStatus } from "expo-audio";
import {
  ambientTracks,
  type AmbientMix,
  type AmbientTrack,
} from "../server/src/ambient-contract";

type MixerPlayer = {
  loop: boolean;
  volume: number;
  replace: (source: AudioSource) => void;
  play: () => void;
  pause: () => void;
};

export type MixerPlayback = {
  phase: "paused" | "starting" | "playing";
  failed: readonly AmbientTrack[];
};

type Layer = {
  attached: boolean;
  level: number | null;
  phase: "idle" | "starting" | "playing" | "failed";
  timeout?: ReturnType<typeof setTimeout>;
};

export const ambientStartupTimeoutMs = 6500;
const interruptionGraceMs = 2000;

// Calibrated against the bundled WAVs. Even summing their separate source
// peaks at full master and track volumes stays below full scale.
const trim: Record<AmbientTrack, number> = {
  rain: 0.42,
  ocean: 0.77,
  forest: 0.74,
  wind: 1,
};

export function ambientTrackLevel(track: AmbientTrack, mix: AmbientMix) {
  return (mix.volumes[track] * mix.masterVolume * trim[track]) / 10000;
}

export function createAmbientMixerPlayback(
  players: Record<AmbientTrack, MixerPlayer>,
  sources: Record<AmbientTrack, AudioSource>,
  onChange: (state: MixerPlayback) => void,
) {
  const layer = (): Layer => ({ attached: false, level: null, phase: "idle" });
  const layers = {
    rain: layer(),
    ocean: layer(),
    forest: layer(),
    wind: layer(),
  };
  let playback: MixerPlayback = { phase: "paused", failed: [] };

  function publish() {
    const phase = ambientTracks.some(
      (track) => layers[track].phase === "playing",
    )
      ? "playing"
      : ambientTracks.some((track) => layers[track].phase === "starting")
        ? "starting"
        : "paused";
    const failed = ambientTracks.filter(
      (track) => layers[track].phase === "failed",
    );
    if (
      phase !== playback.phase ||
      failed.length !== playback.failed.length ||
      failed.some((track, index) => track !== playback.failed[index])
    ) {
      playback = { phase, failed };
      onChange(playback);
    }
  }

  function clearWatchdog(state: Layer) {
    clearTimeout(state.timeout);
    state.timeout = undefined;
  }

  function pauseLayer(track: AmbientTrack) {
    try {
      players[track].pause();
    } catch {
      // Expo owns player disposal. It may already have released on unmount.
    }
  }

  function fail(track: AmbientTrack) {
    const state = layers[track];
    clearWatchdog(state);
    state.phase = "failed";
    state.attached = false;
    state.level = null;
    pauseLayer(track);
    publish();
  }

  function armWatchdog(track: AmbientTrack, delay: number) {
    const state = layers[track];
    state.timeout ??= setTimeout(() => fail(track), delay);
  }

  return {
    get active() {
      return playback.phase !== "paused";
    },
    update(mix: AmbientMix) {
      for (const track of ambientTracks) {
        const state = layers[track];
        const player = players[track];
        const level = ambientTrackLevel(track, mix);
        if (level === 0) {
          const wasActive =
            state.phase === "starting" || state.phase === "playing";
          clearWatchdog(state);
          state.phase = "idle";
          if (wasActive) pauseLayer(track);
          continue;
        }
        if (state.phase === "failed") continue;
        try {
          if (!state.attached) {
            player.replace(sources[track]);
            player.loop = true;
            state.level = null;
            state.attached = true;
          }
          if (state.level !== level) {
            player.volume = level;
            state.level = level;
          }
          if (state.phase === "idle") {
            state.phase = "starting";
            armWatchdog(track, ambientStartupTimeoutMs);
            player.play();
          }
        } catch {
          fail(track);
        }
      }
      publish();
    },
    receive(
      track: AmbientTrack,
      status: Pick<
        AudioStatus,
        | "error"
        | "isBuffering"
        | "isLoaded"
        | "mediaServicesDidReset"
        | "playing"
      >,
      webPlayPending = false,
    ) {
      const state = layers[track];
      if (state.phase !== "starting" && state.phase !== "playing") return;
      if (status.error || status.mediaServicesDidReset) {
        fail(track);
      } else if (status.playing && status.isLoaded && !status.isBuffering) {
        clearWatchdog(state);
        state.phase = "playing";
        publish();
      } else if (state.phase === "playing" && !webPlayPending) {
        // Native loop boundaries and brief audio-focus loss can report a
        // transient pause. Give that layer a chance to recover on its own.
        armWatchdog(
          track,
          status.isBuffering ? ambientStartupTimeoutMs : interruptionGraceMs,
        );
      }
    },
    pause(rewind = false) {
      for (const track of ambientTracks) {
        const state = layers[track];
        const wasActive =
          state.phase === "starting" || state.phase === "playing";
        const hadSource = state.attached || state.phase === "failed";
        clearWatchdog(state);
        state.phase = "idle";
        if (wasActive) pauseLayer(track);
        if (rewind && hadSource) {
          state.attached = false;
          state.level = null;
          try {
            players[track].replace(null);
          } catch {
            // The next Play will attempt to attach a clean source.
          }
        }
      }
      publish();
    },
  };
}
