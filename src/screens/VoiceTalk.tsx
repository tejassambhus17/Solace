import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  BackHandler,
  Keyboard,
  Platform,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Companion, useReducedMotion } from "../Companion";
import { VoiceControls } from "../VoiceControls";
import type { VoiceControlStage } from "../VoiceControlsImpl";
import { spacing, useScreenGutter } from "../layout";
import { useApp } from "../store";
import { useTheme } from "../theme";
import {
  AppText,
  BotanicalBackdrop,
  Button,
  IconButton,
  Input,
  Row,
} from "../ui";
import { companionSendError } from "./ChatDetails";

const MESSAGE_LIMIT = 4000;
const METER_BARS = 13;
const stages: Record<
  VoiceControlStage | "replying",
  [title: string, detail: string]
> = {
  idle: [
    "Talk to Solace",
    "Record a short message, review the words, then send.",
  ],
  preparing: [
    "Starting microphone",
    "Allow microphone access to start recording.",
  ],
  listening: [
    "Solace is listening",
    "Stop to transcribe, or discard the recording.",
  ],
  transcribing: [
    "Transcribing your recording",
    "Your words will appear in an editable draft.",
  ],
  cancelling: [
    "Discarding recording",
    "You can record again or type your message.",
  ],
  review: ["Review transcript", "Check the words before you send."],
  replying: [
    "Solace is replying",
    "Your draft is kept while you wait for a reply.",
  ],
  "starting-playback": ["Preparing spoken reply", "Audio is getting ready."],
  speaking: [
    "Solace is speaking",
    "You can mute or stop playback at any time.",
  ],
};

export function VoiceTalkScreen() {
  const app = useApp();
  const { colors, resolved } = useTheme();
  const gutter = useScreenGutter();
  const compact = useWindowDimensions().width < 360;
  const reduceMotion = useReducedMotion();
  const initialId =
    typeof app.params.id === "string" ? app.params.id : undefined;
  const [id, setId] = useState(initialId);
  const beganOnNewChat = useRef(
    !initialId || app.params.openedNewChat === true,
  );
  const draftKey = id || "new";
  const [draft, setDraft] = useState(app.chatDrafts[draftKey] || "");
  const draftRef = useRef(draft);
  const [recordedDraft, setRecordedDraft] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const pending = sendingMessage || !!app.chatPending[draftKey];
  const [failure, setFailure] = useState<{
    message: string;
    retryText?: string;
  }>();
  const [voiceStage, setVoiceStage] = useState<VoiceControlStage>("idle");
  const [muted, setMuted] = useState(false);
  const [meter] = useState(() => new Animated.Value(0));
  const [bars] = useState(() =>
    Array.from({ length: METER_BARS }, () => new Animated.Value(-1)),
  );
  const samples = useRef<number[]>([]);
  const barStyles = useMemo(
    () =>
      bars.map((value) => ({
        opacity: value.interpolate({
          inputRange: [-1, 0],
          outputRange: [0, 1],
          extrapolate: "clamp",
        }),
        transform: [
          {
            scaleY: value.interpolate({
              inputRange: [0, 1],
              outputRange: [2 / 21, 1],
              extrapolate: "clamp",
            }),
          },
        ],
      })),
    [bars],
  );
  const updateMeter = useCallback(
    (level: number | null) => {
      if (level === null || reduceMotion) {
        if (samples.current.length) {
          samples.current = [];
          bars.forEach((bar) => bar.setValue(-1));
          meter.setValue(0);
        }
        return;
      }
      samples.current = [...samples.current.slice(-(METER_BARS - 1)), level];
      const emptyBars = METER_BARS - samples.current.length;
      bars.forEach((bar, index) =>
        bar.setValue(samples.current[index - emptyBars] ?? -1),
      );
      Animated.timing(meter, {
        toValue: level,
        duration: 110,
        useNativeDriver: Platform.OS !== "web",
        isInteraction: false,
      }).start();
    },
    [bars, meter, reduceMotion],
  );
  const [autoReadId, setAutoReadId] = useState<string>();
  const [revealReplyId, setRevealReplyId] = useState<string>();
  const [replyLayout, setReplyLayout] = useState<{
    id?: string;
    top: number;
  }>();
  const [expandedMessage, setExpandedMessage] = useState<string>();
  const revealedReply = useRef<string | undefined>(undefined);
  const mounted = useRef(false);
  const sending = useRef(false);
  const scroll = useRef<React.ElementRef<typeof ScrollView>>(null);
  const close = useRef(() => {});
  const currentId = useRef(id);
  currentId.current = id;
  const conversation = app.data.conversations.find(
    (record) => record.id === id,
  );
  const messages = Array.isArray(conversation?.messages)
    ? conversation.messages
    : [];
  const latestReply = messages.findLast(
    (message) => message.role === "assistant",
  );
  const latestMessage = messages.findLast((message) => message.role === "user");
  const lastMessage =
    typeof latestMessage?.content === "string" ? latestMessage.content : "";
  const longMessage =
    lastMessage.length > 120 || /\n[\s\S]*\n/.test(lastMessage);
  const messageKey = latestMessage?.id ?? `legacy-${messages.length}`;
  const messageExpanded = expandedMessage === messageKey;
  const replyText =
    typeof latestReply?.content === "string" ? latestReply.content : "";
  const needsSupport =
    latestReply?.support === true || latestReply?.safety === true;
  const replyLabel = needsSupport
    ? "Support guidance"
    : latestReply?.provider === "offline"
      ? "Built-in reply"
      : latestReply?.provider === "live"
        ? "AI reply"
        : "Solace reply";
  const recordingBusy = [
    "preparing",
    "listening",
    "transcribing",
    "cancelling",
  ].includes(voiceStage);
  const canSend =
    !!draft.trim() && !pending && !recordingBusy && voiceStage !== "review";
  const canRetry = !!failure?.retryText && failure.retryText === draft.trim();
  const stage = pending
    ? "replying"
    : voiceStage === "idle" && recordedDraft && draft.trim()
      ? "review"
      : voiceStage;
  const [stageTitle, stageDetail] = stages[stage];
  const companionState =
    stage === "listening" || stage === "speaking"
      ? stage
      : recordingBusy || pending || stage === "starting-playback"
        ? "thinking"
        : "idle";

  close.current = () => {
    if (beganOnNewChat.current && currentId.current)
      app.navigate("chat", { id: currentId.current });
    else if (app.canGoBack) app.back();
    else app.navigate("chat", { id: currentId.current });
  };
  useEffect(() => {
    mounted.current = true;
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      close.current();
      return true;
    });
    return () => {
      mounted.current = false;
      back.remove();
    };
  }, []);
  useEffect(() => () => meter.stopAnimation(), [meter]);
  useEffect(() => {
    if (
      !revealReplyId ||
      replyLayout?.id !== revealReplyId ||
      revealedReply.current === revealReplyId
    )
      return;
    revealedReply.current = revealReplyId;
    scroll.current?.scrollTo({
      y: Math.max(0, replyLayout.top - spacing.row),
      animated: !reduceMotion,
    });
  }, [revealReplyId, replyLayout, reduceMotion]);

  function writeDraft(text: string) {
    draftRef.current = text;
    if (failure && failure.retryText !== text.trim()) setFailure(undefined);
    setDraft(text);
    app.setChatDraft(draftKey, text);
  }

  function useTranscript(text: string) {
    const existing = draftRef.current.trimEnd();
    const next = existing ? `${existing}\n${text}` : text;
    if (next.length > MESSAGE_LIMIT) {
      setFailure({
        message: "Shorten the draft to make room for this transcript.",
      });
      return false;
    }
    setFailure(undefined);
    setRecordedDraft(true);
    writeDraft(next);
    return true;
  }

  async function send() {
    const savedDraft = draftRef.current;
    const text = savedDraft.trim();
    if (!text || !canSend || sending.current) return;
    sending.current = true;
    setSendingMessage(true);
    setFailure(undefined);
    Keyboard.dismiss();
    try {
      const result = await app.chat(text, id);
      app.setChatDraft(draftKey, "", savedDraft);
      if (!mounted.current) return;
      const nextId = result.conversation.id;
      const assistant = result.conversation.messages.findLast(
        (message: { role: string }) => message.role === "assistant",
      );
      currentId.current = nextId;
      draftRef.current = "";
      setDraft("");
      setRecordedDraft(false);
      setId(nextId);
      app.setParams({ id: nextId, openedNewChat: beganOnNewChat.current });
      if (typeof assistant?.id === "string") setRevealReplyId(assistant.id);
      if (
        typeof assistant?.id === "string" &&
        !assistant.support &&
        !assistant.safety
      )
        setAutoReadId(assistant.id);
    } catch (error) {
      if (mounted.current)
        setFailure({
          message: companionSendError(error),
          retryText: text,
        });
    } finally {
      sending.current = false;
      if (mounted.current) setSendingMessage(false);
    }
  }

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <Row
        style={{
          paddingHorizontal: gutter,
          paddingVertical: 5,
          justifyContent: "space-between",
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <IconButton
          name="arrow-back"
          label="End voice talk and return to chat"
          size={48}
          onPress={() => close.current()}
        />
        <AppText
          variant="heading"
          accessibilityRole="header"
          style={{ flex: 1, textAlign: "center" }}
        >
          Voice talk
        </AppText>
        <IconButton
          name={muted ? "volume-mute-outline" : "volume-medium-outline"}
          label={muted ? "Unmute spoken replies" : "Mute spoken replies"}
          size={48}
          onPress={() => setMuted((current) => !current)}
        />
      </Row>
      <ScrollView
        ref={scroll}
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: gutter,
          paddingTop: spacing.screenTop,
          paddingBottom: spacing.bottom,
          gap: spacing.card,
        }}
      >
        <View
          style={{
            overflow: "hidden",
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.heroBorder,
            backgroundColor:
              resolved === "light" ? colors.peachSurface : colors.heroSurface,
            paddingHorizontal: spacing.card,
            paddingTop: spacing.compact,
            paddingBottom: spacing.card,
            alignItems: "center",
          }}
        >
          <BotanicalBackdrop style={{ right: -54, top: -60, opacity: 0.2 }} />
          <Companion
            size={compact ? 76 : 96}
            state={companionState}
            soundMotion={meter}
          />
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              flexDirection: "row",
              height: 25,
              alignItems: "center",
              gap: 3,
            }}
          >
            {voiceStage === "listening" &&
              !reduceMotion &&
              barStyles.map((motion, index) => (
                <Animated.View
                  key={index}
                  style={[
                    {
                      width: 3,
                      height: 21,
                      borderRadius: 2,
                      backgroundColor: colors.lavenderText,
                    },
                    motion,
                  ]}
                />
              ))}
          </View>
          <AppText
            variant="title"
            accessibilityRole="header"
            accessibilityLiveRegion="polite"
            style={{
              textAlign: "center",
              fontSize: compact ? 30 : 34,
              lineHeight: compact ? 34 : 38,
              marginTop: 3,
            }}
          >
            {stageTitle}
          </AppText>
          <AppText
            variant="caption"
            color={resolved === "light" ? colors.peachText : colors.muted}
            style={{ textAlign: "center", marginTop: 8, maxWidth: 270 }}
          >
            {stageDetail} {muted && "Spoken replies are muted."}
          </AppText>
        </View>
        <VoiceControls
          variant="talk"
          disabled={pending}
          muted={muted}
          reply={replyText}
          autoReadKey={
            autoReadId === latestReply?.id && !needsSupport
              ? autoReadId
              : undefined
          }
          onTranscript={useTranscript}
          onStage={setVoiceStage}
          onMeter={updateMeter}
          renderComposer={(microphone, playback) => (
            <View style={{ gap: spacing.row }}>
              <View style={{ alignItems: "center", paddingBottom: 3 }}>
                {microphone}
                {!!playback && (
                  <View style={{ position: "absolute", right: 0, top: 13 }}>
                    {playback}
                  </View>
                )}
              </View>
              <View style={{ gap: 7 }}>
                <AppText variant="label">
                  {recordedDraft ? "Review your transcript" : "Your message"}
                </AppText>
                <Input
                  accessibilityLabel={
                    recordedDraft ? "Review your transcript" : "Your message"
                  }
                  placeholder="Type your message here"
                  value={draft}
                  editable={!pending && !recordingBusy}
                  multiline
                  maxLength={MESSAGE_LIMIT}
                  onChangeText={writeDraft}
                  onFocus={() => {
                    if (!replyText)
                      scroll.current?.scrollToEnd({ animated: false });
                  }}
                  style={{ minHeight: 82, borderRadius: 16 }}
                />
                {!!failure && (
                  <AppText
                    variant="caption"
                    accessibilityRole="alert"
                    color={colors.danger}
                  >
                    {failure.message} {canRetry && "Your draft is still here."}
                  </AppText>
                )}
              </View>
              <Button
                title={canRetry ? "Retry message" : "Send message"}
                icon={canRetry ? "refresh-outline" : "paper-plane-outline"}
                disabled={!canSend}
                loading={pending}
                onPress={() => void send()}
              />
            </View>
          )}
        />
        {!!replyText && (
          <View
            key={latestReply?.id ?? "reply"}
            onLayout={({ nativeEvent }) =>
              setReplyLayout({ id: latestReply?.id, top: nativeEvent.layout.y })
            }
            style={{
              gap: 10,
              padding: 16,
              borderRadius: 18,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Row style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
              <AppText variant="label" accessibilityRole="header">
                {replyLabel}
              </AppText>
              {(stage === "starting-playback" || stage === "speaking") && (
                <AppText variant="caption" color={colors.muted}>
                  {stage === "speaking" ? "Reading aloud" : "Preparing audio…"}
                </AppText>
              )}
            </Row>
            <AppText accessibilityLiveRegion="polite" selectable>
              {replyText}
            </AppText>
            {needsSupport && (
              <Button
                title="Find human support"
                variant="secondary"
                icon="heart-outline"
                onPress={() => app.navigate("support")}
              />
            )}
            {!!lastMessage && (
              <View style={{ gap: 4 }}>
                <AppText
                  variant="caption"
                  color={colors.muted}
                  selectable
                  numberOfLines={
                    longMessage && !messageExpanded ? 3 : undefined
                  }
                >
                  You: {lastMessage}
                </AppText>
                {longMessage && (
                  <Button
                    title={messageExpanded ? "Show less" : "Show full message"}
                    variant="ghost"
                    onPress={() =>
                      setExpandedMessage(
                        messageExpanded ? undefined : messageKey,
                      )
                    }
                    style={{ alignSelf: "flex-start", minHeight: 44 }}
                  />
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
