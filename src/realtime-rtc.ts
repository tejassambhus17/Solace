import { AppState, NativeModules, Platform } from "react-native";
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
    (Platform.OS === "ios" || Platform.OS === "android") &&
    typeof NativeModules.WebRTCModule?.peerConnectionInit === "function"
  );
}

// A quick reconnect must set the audio mode after the previous call releases it.
let audioModeQueue = Promise.resolve();
function setRealtimeAudioMode(
  setAudioModeAsync: typeof import("expo-audio").setAudioModeAsync,
  recording: boolean,
  assertForeground?: () => void,
  speakerphone = true,
) {
  const change = audioModeQueue.then(() => {
    assertForeground?.();
    return setAudioModeAsync({
      allowsRecording: recording,
      allowsBackgroundRecording: false,
      playsInSilentMode: true,
      interruptionMode: "doNotMix",
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: !speakerphone,
    });
  });
  audioModeQueue = change.catch(() => {});
  return change;
}

export function createRealtimePeer(options: RealtimePeerOptions) {
  return openRealtimePeer(options, async (setup) => {
    if (!realtimePeerAvailable())
      throw new RealtimePeerError(
        "Live voice isn’t available in this app build.",
      );
    const { AudioModule, setAudioModeAsync } =
      require("expo-audio") as typeof import("expo-audio");

    const foreground = () => AppState.currentState === "active";
    const assertForeground = () => {
      setup.assertOpen();
      if (!foreground())
        throw new RealtimePeerError("Return to Solace to start live voice.");
    };
    assertForeground();
    let permission = await AudioModule.getRecordingPermissionsAsync();
    assertForeground();
    if (!permission.granted && permission.canAskAgain) {
      options.onPermissionPrompt?.(true);
      try {
        permission = await AudioModule.requestRecordingPermissionsAsync();
        setup.assertOpen();
        if (permission.granted && !foreground()) {
          // Android can resolve permission before the activity finishes resuming.
          await new Promise<void>((resolve) => {
            const listener = AppState.addEventListener("change", (state) => {
              if (state === "active") finish();
            });
            const timer = setTimeout(finish, 1200);
            function finish() {
              clearTimeout(timer);
              listener.remove();
              resolve();
            }
            setup.cleanup(finish);
          });
        }
      } finally {
        options.onPermissionPrompt?.(false);
      }
    }
    if (!permission.granted)
      throw new RealtimePeerError(
        "Allow microphone access to start live voice.",
      );
    assertForeground();
    options.onStage?.("permission");

    const webrtc =
      require("react-native-webrtc") as typeof import("react-native-webrtc");
    interruptAmbientPlayback();
    const configured = setRealtimeAudioMode(
      setAudioModeAsync,
      true,
      assertForeground,
    );
    setup.cleanup(() => {
      void setRealtimeAudioMode(setAudioModeAsync, false).catch(() => {});
    });
    await configured;
    assertForeground();
    options.onStage?.("audio-mode");

    const microphone = await webrtc.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    setup.cleanup(() => {
      microphone.getTracks().forEach((track) => track.stop());
      microphone.release();
    });
    assertForeground();
    options.onStage?.("microphone");
    const tracks = microphone.getAudioTracks();
    if (tracks.length !== 1)
      throw new RealtimePeerError("No microphone is available for live voice.");
    tracks[0].addEventListener("ended", setup.fail);
    setup.cleanup(() => tracks[0].removeEventListener("ended", setup.fail));

    const peer = new webrtc.RTCPeerConnection();
    setup.cleanup(() => peer.close());
    const state = () =>
      setup.state(peer.connectionState, peer.iceConnectionState);
    peer.addEventListener("connectionstatechange", state);
    peer.addEventListener("iceconnectionstatechange", state);
    const remoteTrack = ({
      track,
    }: {
      track: InstanceType<typeof webrtc.MediaStreamTrack> | null;
    }) => {
      if (track?.kind !== "audio") return;
      track.addEventListener("ended", setup.fail);
      setup.cleanup(() => track.removeEventListener("ended", setup.fail));
      setup.remoteAudio();
    };
    peer.addEventListener("track", remoteTrack);
    setup.cleanup(() => {
      peer.removeEventListener("connectionstatechange", state);
      peer.removeEventListener("iceconnectionstatechange", state);
      peer.removeEventListener("track", remoteTrack);
    });
    peer.addTrack(tracks[0], microphone);
    return {
      offer: async () => {
        const offer = await peer.createOffer();
        setup.assertOpen();
        await peer.setLocalDescription(offer);
        return peer.localDescription?.sdp ?? offer.sdp;
      },
      acceptAnswer: (sdp) =>
        peer.setRemoteDescription(
          new webrtc.RTCSessionDescription({ type: "answer", sdp }),
        ),
      setMuted: (muted) => {
        tracks[0].enabled = !muted;
      },
      getAudioStats: () => peer.getStats(),
      setSpeakerphone: (enabled) =>
        setRealtimeAudioMode(
          setAudioModeAsync,
          true,
          assertForeground,
          enabled,
        ),
    };
  });
}
