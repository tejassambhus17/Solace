export const ambientTracks = ["rain", "ocean", "forest", "wind"] as const;
export const ambientTimers = [0, 15, 30, 60] as const;

export type AmbientTrack = (typeof ambientTracks)[number];
export type AmbientTimer = (typeof ambientTimers)[number];
export type AmbientMix = {
  volumes: Record<AmbientTrack, number>;
  masterVolume: number;
  timerMinutes: AmbientTimer;
};
