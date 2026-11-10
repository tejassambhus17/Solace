import { interruptAmbientPlayback } from "./audio-focus";
import {
  openRealtimePeer,
  RealtimePeerError,
  type RealtimePeerOptions,
} from "./realtime-rtc-core";

export type {
  RealtimeAudioLevels,
  RealtimePeer,
  RealtimePeerState,
} from "./realtime-rtc-core";

export function realtimePeerAvailable() {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof RTCPeerConnection === "function" &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

export function createRealtimePeer(options: RealtimePeerOptions) {
  return openRealtimePeer(options, async (setup) => {
    if (!realtimePeerAvailable())
      throw new RealtimePeerError(
        "Live voice requires microphone access in a supported browser.",
      );

    let microphone: MediaStream;
    try {
      microphone = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
    } catch (error) {
      if (
        error instanceof DOMException &&
        ["NotAllowedError", "SecurityError"].includes(error.name)
      )
        throw new RealtimePeerError(
          "Allow microphone access to start live voice.",
        );
      throw new RealtimePeerError("No microphone is available for live voice.");
    }
    setup.cleanup(() =>
      microphone.getTracks().forEach((track) => track.stop()),
    );
    setup.assertOpen();
    options.onStage?.("microphone");
    const tracks = microphone.getAudioTracks();
    if (tracks.length !== 1)
      throw new RealtimePeerError("No microphone is available for live voice.");
    tracks[0].addEventListener("ended", setup.fail);
    setup.cleanup(() => tracks[0].removeEventListener("ended", setup.fail));
    interruptAmbientPlayback();

    const peer = new RTCPeerConnection();
    setup.cleanup(() => peer.close());
    const audio = new Audio();
    audio.autoplay = true;
    audio.setAttribute("playsinline", "");
    const state = () =>
      setup.state(peer.connectionState, peer.iceConnectionState);
    const track = (event: RTCTrackEvent) => {
      if (event.track.kind !== "audio") return;
      event.track.addEventListener("ended", setup.fail);
      setup.cleanup(() => event.track.removeEventListener("ended", setup.fail));
      audio.srcObject = event.streams[0] ?? new MediaStream([event.track]);
      void audio.play().catch(setup.fail);
      setup.remoteAudio();
    };
    peer.addEventListener("connectionstatechange", state);
    peer.addEventListener("iceconnectionstatechange", state);
    peer.addEventListener("track", track);
    setup.cleanup(() => {
      peer.removeEventListener("connectionstatechange", state);
      peer.removeEventListener("iceconnectionstatechange", state);
      peer.removeEventListener("track", track);
      audio.pause();
      audio.srcObject = null;
    });
    peer.addTrack(tracks[0], microphone);
    return {
      offer: async () => {
        const offer = await peer.createOffer();
        setup.assertOpen();
        await peer.setLocalDescription(offer);
        return peer.localDescription?.sdp ?? offer.sdp;
      },
      acceptAnswer: (sdp) => peer.setRemoteDescription({ type: "answer", sdp }),
      setMuted: (muted) => {
        tracks[0].enabled = !muted;
      },
      getAudioStats: () => peer.getStats(),
    };
  });
}
