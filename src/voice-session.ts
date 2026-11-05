export type VoiceState =
  "idle" | "preparing" | "listening" | "transcribing" | "cancelling";
export const MAX_VOICE_BYTES = 8 * 1024 * 1024;

export type VoiceIO = {
  permission: () => Promise<boolean>;
  start: () => Promise<void>;
  stop: () => Promise<ArrayBuffer>;
  cancel: () => Promise<void>;
  transcribe: (audio: ArrayBuffer) => Promise<string>;
  transcript: (text: string) => void;
  changed: (state: VoiceState, error: string) => void;
};

/** A turn is scoped to its mounted account/conversation. No automatic send. */
export class VoiceTurn {
  private version = 0;
  private disposed = false;
  private audio: ArrayBuffer | null = null;
  private starting: Promise<void> | null = null;
  private stopping: Promise<ArrayBuffer> | null = null;
  private cancelling: Promise<void> | null = null;
  state: VoiceState = "idle";
  constructor(private io: VoiceIO) {}
  private publish(state: VoiceState, error = "") {
    if (this.disposed) return;
    this.state = state;
    this.io.changed(state, error);
  }
  private current(version: number) {
    return !this.disposed && this.version === version;
  }
  async start() {
    if (this.disposed || this.state !== "idle") return;
    const version = ++this.version;
    this.audio = null;
    this.publish("preparing");
    try {
      if (!(await this.io.permission())) {
        if (this.current(version))
          this.publish(
            "idle",
            "Microphone access is off. Allow it in device settings, or type your message.",
          );
        return;
      }
      if (!this.current(version)) return;
      const starting = this.io.start();
      this.starting = starting;
      try {
        await starting;
      } finally {
        if (this.starting === starting) this.starting = null;
      }
      // cancel() owns cleanup and waits for start to settle before releasing
      // the recorder. A stale start must never cancel a newer recording.
      if (!this.current(version)) return;
      this.publish("listening");
    } catch {
      if (this.current(version)) {
        await this.cancel();
        if (this.current(version + 1))
          this.publish(
            "idle",
            "Recording could not start. Try again, or type your message.",
          );
      }
    }
  }
  async stop() {
    if (this.disposed || this.state !== "listening") return;
    const version = this.version;
    this.publish("transcribing");
    try {
      const stopping = this.io.stop();
      this.stopping = stopping;
      let audio: ArrayBuffer;
      try {
        audio = await stopping;
      } finally {
        if (this.stopping === stopping) this.stopping = null;
      }
      if (!this.current(version)) return;
      if (audio.byteLength < 45 || audio.byteLength > MAX_VOICE_BYTES)
        throw new Error(
          "The recording was empty or too large. Record a shorter message, up to one minute.",
        );
      this.audio = audio;
      await this.convert(version);
    } catch (error) {
      if (this.current(version)) {
        await this.cancel();
        if (this.current(version + 1))
          this.publish(
            "idle",
            error instanceof Error
              ? error.message
              : "Could not read the recording. Please try again.",
          );
      }
    }
  }
  async retry() {
    if (this.disposed || this.state !== "idle" || !this.audio) return;
    this.publish("transcribing");
    await this.convert(this.version);
  }
  private async convert(version: number) {
    try {
      const text = (await this.io.transcribe(this.audio!)).trim();
      if (!this.current(version)) return;
      if (!text || text.length > 4000)
        throw new Error(
          "We couldn't make out a message. Please try a shorter recording or type instead.",
        );
      this.audio = null;
      this.io.transcript(text);
      this.publish("idle");
    } catch (error) {
      if (this.current(version))
        this.publish(
          "idle",
          error instanceof Error
            ? error.message
            : "Transcription failed. Retry, or type your message.",
        );
    }
  }
  get canRetry() {
    return !!this.audio && this.state === "idle";
  }
  cancel(): Promise<void> {
    if (this.cancelling) return this.cancelling;
    const version = ++this.version;
    this.audio = null;
    this.publish("cancelling");
    const starting = this.starting;
    const stopping = this.stopping;
    this.cancelling = (async () => {
      await Promise.allSettled([starting, stopping]);
      await this.io.cancel().catch(() => {});
      if (this.current(version)) this.publish("idle");
    })().finally(() => {
      this.cancelling = null;
    });
    return this.cancelling;
  }
  dispose() {
    this.disposed = true;
    void this.cancel();
  }
}

export function voiceContentType(platform: string, uri = "") {
  if (/\.wav(?:$|\?)/i.test(uri)) return "audio/wav";
  return platform === "web" ? "audio/webm" : "audio/mp4";
}
