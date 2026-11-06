import React, { useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Companion, type CompanionState } from "../Companion";
import { VoiceControls } from "../VoiceControls";
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

const MESSAGE_LIMIT = 4000;
type TalkState = Extract<
  CompanionState,
  "idle" | "listening" | "thinking" | "speaking"
>;

const stageText: Record<TalkState, string> = {
  idle: "Talk to Solace",
  listening: "Solace is listening",
  thinking: "Preparing your voice turn",
  speaking: "Solace is speaking",
};

export function VoiceTalkScreen() {
  const app = useApp();
  const { colors, resolved } = useTheme();
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
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState("");
  const [voiceState, setVoiceState] = useState<TalkState>("idle");
  const [autoReadId, setAutoReadId] = useState<string>();
  const mounted = useRef(false);
  const sending = useRef(false);
  const scroll = useRef<React.ElementRef<typeof ScrollView>>(null);
  const close = useRef(() => {});
  const currentId = useRef(id);
  currentId.current = id;
  const conversation = app.data.conversations.find(
    (record) => record.id === id,
  );
  const newestMessages = Array.isArray(conversation?.messages)
    ? [...conversation.messages].reverse()
    : [];
  const latestReply = newestMessages.find(
    (message) => message.role === "assistant",
  );
  const latestMessage = newestMessages.find(
    (message) => message.role === "user",
  );
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
  const isRecordingOrTranscribing =
    voiceState === "listening" || voiceState === "thinking";
  const canSend = !!draft.trim() && !pending && !isRecordingOrTranscribing;

  close.current = () => {
    if (sending.current) return;
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

  function writeDraft(text: string) {
    draftRef.current = text;
    setDraft(text);
    app.setChatDraft(draftKey, text);
  }

  function useTranscript(text: string) {
    const existing = draftRef.current.trimEnd();
    const next = existing ? `${existing}\n${text}` : text;
    if (next.length > MESSAGE_LIMIT) {
      setFailure("Shorten the draft to make room for this transcript.");
      return false;
    }
    setFailure("");
    setRecordedDraft(true);
    writeDraft(next);
    return true;
  }

  async function send() {
    const savedDraft = draftRef.current;
    const text = savedDraft.trim();
    if (!text || sending.current || isRecordingOrTranscribing) return;
    sending.current = true;
    setPending(true);
    setFailure("");
    Keyboard.dismiss();
    try {
      const result = await app.chat(text, id);
      app.setChatDraft(draftKey, "", savedDraft);
      if (!mounted.current) return;
      const nextId = result.conversation.id;
      const assistant = [...result.conversation.messages]
        .reverse()
        .find((message: { role: string }) => message.role === "assistant");
      currentId.current = nextId;
      draftRef.current = "";
      setDraft("");
      setRecordedDraft(false);
      setId(nextId);
      app.setParams({ id: nextId, openedNewChat: beganOnNewChat.current });
      if (
        typeof assistant?.id === "string" &&
        !assistant.support &&
        !assistant.safety
      )
        setAutoReadId(assistant.id);
    } catch (error) {
      if (mounted.current)
        setFailure(
          error instanceof Error
            ? error.message
            : "Couldn’t send your message. Your draft is ready to retry.",
        );
    } finally {
      sending.current = false;
      if (mounted.current) setPending(false);
    }
  }

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "web" ? undefined : "padding"}
        style={{ flex: 1 }}
      >
        <Row
          style={{
            paddingHorizontal: 16,
            paddingVertical: 5,
            justifyContent: "space-between",
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <IconButton
            name="arrow-back"
            label="Back to chat"
            disabled={pending}
            onPress={() => close.current()}
          />
          <AppText
            variant="heading"
            accessibilityRole="header"
            style={{ flex: 1, textAlign: "center" }}
          >
            Voice talk
          </AppText>
          <View style={{ width: 44 }} />
        </Row>
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 22, paddingBottom: 32, gap: 20 }}
        >
          <View
            style={{
              overflow: "hidden",
              borderRadius: 24,
              borderWidth: 1,
              borderColor: colors.heroBorder,
              backgroundColor:
                resolved === "light" ? colors.peachSurface : colors.heroSurface,
              paddingHorizontal: 18,
              paddingTop: 12,
              paddingBottom: 22,
              alignItems: "center",
            }}
          >
            <BotanicalBackdrop style={{ right: -54, top: -60, opacity: 0.2 }} />
            <Companion size={110} state={pending ? "thinking" : voiceState} />
            <AppText
              variant="title"
              accessibilityRole="header"
              accessibilityLiveRegion="polite"
              style={{
                textAlign: "center",
                fontSize: 34,
                lineHeight: 36,
                marginTop: 3,
              }}
            >
              {pending ? "Solace is replying" : stageText[voiceState]}
            </AppText>
            <AppText
              variant="caption"
              color={resolved === "light" ? colors.peachText : colors.muted}
              style={{ textAlign: "center", marginTop: 8, maxWidth: 270 }}
            >
              Record a short message, review the words, then send. Replies can
              play aloud.
            </AppText>
          </View>
          <VoiceControls
            variant="talk"
            disabled={pending}
            reply={replyText}
            autoReadKey={
              autoReadId === latestReply?.id && !needsSupport
                ? autoReadId
                : undefined
            }
            onTranscript={useTranscript}
            onState={setVoiceState}
            renderComposer={(microphone, playback) => (
              <View style={{ gap: 14 }}>
                <View style={{ alignItems: "center", paddingBottom: 3 }}>
                  {microphone}
                  {!!playback && (
                    <View style={{ position: "absolute", right: 0, top: 13 }}>
                      {playback}
                    </View>
                  )}
                  {voiceState === "idle" && !pending && (
                    <AppText
                      variant="caption"
                      color={colors.muted}
                      style={{ marginTop: 5 }}
                    >
                      Record a message
                    </AppText>
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
                    editable={!pending && !isRecordingOrTranscribing}
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
                      {failure}
                    </AppText>
                  )}
                </View>
                <Button
                  title="Send message"
                  icon="paper-plane-outline"
                  disabled={!canSend}
                  loading={pending}
                  onPress={() => void send()}
                />
                {!!replyText && (
                  <View
                    style={{
                      gap: 10,
                      padding: 16,
                      borderRadius: 18,
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    {!!latestMessage?.content && (
                      <AppText
                        variant="caption"
                        color={colors.muted}
                        selectable
                      >
                        You: {String(latestMessage.content)}
                      </AppText>
                    )}
                    <AppText variant="label">{replyLabel}</AppText>
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
                  </View>
                )}
              </View>
            )}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
