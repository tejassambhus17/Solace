export type RealtimePeerState =
  "connecting" | "connected" | "disconnected" | "failed";

export type RealtimePeerOptions = {
  signal?: AbortSignal;
  onState: (state: RealtimePeerState) => void;
  onPermissionPrompt?: (pending: boolean) => void;
  onStage?: (stage: "permission" | "audio-mode" | "microphone") => void;
};

export type RealtimeAudioLevels = {
  input?: number;
  output?: number;
};

export type RealtimePeer = {
  offer: string;
  acceptAnswer: (sdp: string) => Promise<void>;
  setMuted: (muted: boolean) => void;
  readAudioLevels: () => Promise<RealtimeAudioLevels>;
  setSpeakerphone?: (enabled: boolean) => Promise<boolean>;
  close: () => void;
};

export class RealtimePeerError extends Error {}

type Setup = {
  assertOpen: () => void;
  cleanup: (release: () => void) => void;
  state: (connection: string, ice: string) => void;
  remoteAudio: () => void;
  fail: () => void;
};
type PlatformPeer = Pick<RealtimePeer, "acceptAnswer" | "setMuted"> & {
  offer: () => Promise<string | undefined>;
  getAudioStats?: () => Promise<AudioStatsReport>;
  setSpeakerphone?: (enabled: boolean) => Promise<void>;
};
type AudioStatsReport = { forEach: (visit: (value: unknown) => void) => void };
type AudioCounter = { energy: number; duration: number };

const setupFailure =
  "Live voice couldn’t connect. You can still type to Solace.";

function audioOnly(sdp: string | undefined): sdp is string {
  if (!sdp || sdp.length > 65536 || !sdp.startsWith("v=0")) return false;
  const media = sdp.match(/^m=.*$/gm);
  return media?.length === 1 && media[0].startsWith("m=audio ");
}

function nonnegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function sampleAudioStats(
  report: AudioStatsReport,
  previous: Map<string, AudioCounter>,
  readInput: boolean,
) {
  const levels: RealtimeAudioLevels = {};
  const counters = new Map<string, AudioCounter>();
  report.forEach((value) => {
    if (!value || typeof value !== "object") return;
    const {
      type,
      kind,
      mediaType,
      id,
      audioLevel,
      totalAudioEnergy,
      totalSamplesDuration,
    } = value as Record<string, unknown>;
    if ((kind ?? mediaType) !== "audio") return;
    const direction =
      type === "media-source" && readInput
        ? "input"
        : type === "inbound-rtp"
          ? "output"
          : undefined;
    if (!direction) return;

    let level = nonnegative(audioLevel) ? audioLevel : undefined;
    if (
      typeof id === "string" &&
      nonnegative(totalAudioEnergy) &&
      nonnegative(totalSamplesDuration)
    ) {
      counters.set(id, {
        energy: totalAudioEnergy,
        duration: totalSamplesDuration,
      });
      const before = previous.get(id);
      if (
        before &&
        totalSamplesDuration > before.duration &&
        totalAudioEnergy >= before.energy
      ) {
        const rms = Math.sqrt(
          (totalAudioEnergy - before.energy) /
            (totalSamplesDuration - before.duration),
        );
        if (Number.isFinite(rms)) level = rms;
      }
    }
    if (level !== undefined)
      levels[direction] = Math.max(levels[direction] ?? 0, Math.min(level, 1));
  });
  return { levels, counters };
}

export async function openRealtimePeer(
  options: RealtimePeerOptions,
  connect: (setup: Setup) => Promise<PlatformPeer>,
): Promise<RealtimePeer> {
  const releases: (() => void)[] = [];
  let closed = false;
  let lastState: RealtimePeerState | undefined;
  let transportReady = false;
  let audioReady = false;
  let muted = false;
  let muteRevision = 0;
  let counters = new Map<string, AudioCounter>();
  let sampling: Promise<RealtimeAudioLevels> | undefined;
  const releaseSafely = (release: () => void) => {
    try {
      release();
    } catch {
      // A disposed native peer can race with app teardown.
    }
  };
  const close = () => {
    if (closed) return;
    closed = true;
    counters.clear();
    options.signal?.removeEventListener("abort", close);
    for (const release of releases.reverse()) releaseSafely(release);
    releases.length = 0;
  };
  const assertOpen = () => {
    if (closed || options.signal?.aborted) {
      const error = new RealtimePeerError("Live voice was cancelled.");
      error.name = "AbortError";
      throw error;
    }
  };
  const emit = (state: RealtimePeerState) => {
    if (closed || state === lastState) return;
    lastState = state;
    if (state === "failed") close();
    options.onState(state);
  };
  const setup: Setup = {
    assertOpen,
    cleanup: (release) => {
      if (closed) releaseSafely(release);
      else releases.push(release);
    },
    state: (connection, ice) => {
      transportReady =
        connection === "connected" &&
        (ice === "connected" || ice === "completed");
      if (
        connection === "failed" ||
        connection === "closed" ||
        ice === "failed" ||
        ice === "closed"
      )
        emit("failed");
      else if (connection === "disconnected" || ice === "disconnected")
        emit("disconnected");
      else if (transportReady && audioReady) emit("connected");
    },
    remoteAudio: () => {
      audioReady = true;
      if (transportReady) emit("connected");
    },
    fail: () => emit("failed"),
  };
  options.signal?.addEventListener("abort", close, { once: true });

  try {
    assertOpen();
    emit("connecting");
    const peer = await connect(setup);
    assertOpen();
    const offer = await peer.offer();
    assertOpen();
    if (!audioOnly(offer)) throw new RealtimePeerError(setupFailure);
    const { setSpeakerphone } = peer;
    async function readAudioLevels(): Promise<RealtimeAudioLevels> {
      if (closed) return {};
      const revision = muteRevision;
      try {
        const report = await peer.getAudioStats?.();
        if (closed) return {};
        if (report) {
          const sample = sampleAudioStats(
            report,
            counters,
            !muted && revision === muteRevision,
          );
          counters = sample.counters;
          if (muted) sample.levels.input = 0;
          return sample.levels;
        }
      } catch {
        counters.clear();
      }
      return !closed && muted ? { input: 0 } : {};
    }
    return {
      offer,
      acceptAnswer: async (answer) => {
        try {
          assertOpen();
          if (!audioOnly(answer)) throw new RealtimePeerError(setupFailure);
          await peer.acceptAnswer(answer);
          assertOpen();
        } catch (error) {
          close();
          throw error instanceof RealtimePeerError
            ? error
            : new RealtimePeerError(setupFailure);
        }
      },
      setMuted: (value) => {
        if (closed || value === muted) return;
        peer.setMuted(value);
        muted = value;
        muteRevision++;
        counters.clear();
      },
      readAudioLevels: () => {
        if (closed) return Promise.resolve({});
        sampling ??= readAudioLevels().finally(() => {
          sampling = undefined;
        });
        return sampling;
      },
      ...(setSpeakerphone && {
        setSpeakerphone: async (enabled: boolean) => {
          if (closed) return false;
          try {
            await setSpeakerphone(enabled);
            return !closed;
          } catch {
            return false;
          }
        },
      }),
      close,
    };
  } catch (error) {
    close();
    throw error instanceof RealtimePeerError
      ? error
      : new RealtimePeerError(setupFailure);
  }
}
