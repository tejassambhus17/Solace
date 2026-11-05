import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  View,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "../store";
import { Companion } from "../Companion";
import { localDay, recordDay } from "../content";
import { VoiceControls } from "../VoiceControls";
import { useTheme } from "../theme";
import {
  ChatBubble,
  ChatHeaderButton,
  ChatQuickReplies,
  ChatResetCard,
  ChatWelcome,
} from "./ChatDetails";
import {
  AppText,
  Artwork,
  BrandMark,
  BotanicalBackdrop,
  IconButton,
  Button,
  Card,
  Icon,
  Input,
  Row,
  Screen,
  useNavigationInset,
} from "../ui";

const dateLabel = (value: any) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? ""
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};
function confirmAction(title: string, message: string, action: () => void) {
  if (Platform.OS === "web") {
    if (globalThis.confirm(`${title}\n\n${message}`)) action();
  } else
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: action },
    ]);
}
export function AuthScreen() {
  const app = useApp();
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const [page, setPage] = useState<"welcome" | "intro" | "login" | "signup">(
    app.sessionExpired ? "login" : "welcome",
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState("");
  const submitting = useRef(false);
  function changePage(next: "welcome" | "intro" | "login" | "signup") {
    if (submitting.current || app.busy) return;
    setPage(next);
    setNotice("");
    setShowPassword(false);
  }
  async function submit() {
    if (submitting.current || app.busy) return;
    setNotice("");
    if (!email.trim() || !password || (page === "signup" && !name.trim())) {
      setNotice("Please complete each field.");
      return;
    }
    if (page === "signup" && password.length < 8) {
      setNotice("Use at least 8 characters for your password.");
      return;
    }
    submitting.current = true;
    try {
      if (page === "signup")
        await app.signUp(name.trim(), email.trim(), password);
      else await app.signIn(email.trim(), password);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Please try again.");
    } finally {
      submitting.current = false;
    }
  }
  if (page === "welcome")
    return (
      <Screen style={{ flex: 1, paddingTop: 0, paddingBottom: 28 }}>
        <BotanicalBackdrop
          style={{
            top: -20,
            right: -110,
            width: 320,
            height: 280,
            opacity: 0.42,
          }}
        />
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            minHeight: 380,
            paddingTop: 28,
          }}
        >
          <Artwork
            kind="petal"
            size={Math.max(200, Math.min(280, height * 0.33))}
          />
          <AppText
            variant="display"
            style={{ fontSize: 64, lineHeight: 70, marginTop: 5 }}
          >
            Solace
          </AppText>
          <AppText style={{ fontSize: 19, marginTop: 10, textAlign: "center" }}>
            A little space for you.
          </AppText>
          <AppText
            color={colors.muted}
            style={{ textAlign: "center", maxWidth: 270, marginTop: 14 }}
          >
            Your AI companion to check in, talk things through, and find a
            little calm.
          </AppText>
        </View>
        <View style={{ gap: 12, paddingTop: 28 }}>
          <Button
            title="Get started"
            icon="arrow-forward"
            onPress={() => changePage("intro")}
          />
          <Button
            title="Log in"
            variant="secondary"
            onPress={() => changePage("login")}
          />
          <AppText
            variant="caption"
            color={colors.muted}
            style={{ textAlign: "center", marginTop: 8 }}
          >
            Your space, at your pace.
          </AppText>
        </View>
      </Screen>
    );
  if (page === "intro")
    return (
      <Screen title="A little space for you" back={() => changePage("welcome")}>
        <View style={{ alignItems: "center", paddingVertical: 25 }}>
          <Companion size={145} state="idle" />
        </View>
        <AppText variant="display">Care, at your pace.</AppText>
        <AppText
          color={colors.muted}
          style={{ marginTop: 12, marginBottom: 25 }}
        >
          A few small ways to make room for yourself. Choose what feels useful
          and leave the rest.
        </AppText>
        {[
          {
            icon: "chatbubble-ellipses-outline",
            title: "Talk things through",
            text: "Start with your own words. Solace is an AI wellness companion, not a therapist or emergency service.",
          },
          {
            icon: "leaf-outline",
            title: "Make a Moment",
            text: "A feeling becomes a short breathing, grounding or reflection practice, in a space you choose.",
          },
          {
            icon: "lock-closed-outline",
            title: "Keep context on your terms",
            text: "Personalization starts off. You choose which preferences to save and can edit or remove them whenever you like.",
          },
        ].map((item) => (
          <Row
            key={item.title}
            style={{ alignItems: "flex-start", paddingVertical: 16, gap: 15 }}
          >
            <Icon name={item.icon} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <AppText variant="label">{item.title}</AppText>
              <AppText
                variant="caption"
                color={colors.muted}
                style={{ marginTop: 5 }}
              >
                {item.text}
              </AppText>
            </View>
          </Row>
        ))}
        <Button
          title="Create my account"
          icon="arrow-forward"
          onPress={() => changePage("signup")}
          style={{ marginTop: 25 }}
        />
        <Button
          title="I already have an account"
          variant="ghost"
          onPress={() => changePage("login")}
          style={{ marginTop: 8 }}
        />
      </Screen>
    );
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen style={{ flex: 1 }}>
        <BotanicalBackdrop
          variant="footer"
          style={{ bottom: -110, right: -90, opacity: 0.16 }}
        />
        <BotanicalBackdrop
          style={{ top: -40, right: -120, width: 300, height: 300 }}
        />
        <Row style={{ marginLeft: -10, marginBottom: 38 }}>
          <IconButton
            name="arrow-back"
            label="Back to welcome"
            onPress={() => changePage("welcome")}
          />
          <BrandMark />
        </Row>
        <AppText variant="display">
          {page === "signup" ? "Create your space" : "Welcome back"}
        </AppText>
        {app.sessionExpired && (
          <AppText
            accessibilityRole="alert"
            color={colors.muted}
            style={{ marginTop: 12 }}
          >
            Your session expired. Sign in to the same account to resume your
            draft and saved space.
          </AppText>
        )}
        <AppText
          color={colors.muted}
          style={{ marginTop: 10, marginBottom: 30, maxWidth: 290 }}
        >
          {page === "signup"
            ? "A gentle place to begin. Make a little room for yourself."
            : "Log in to continue your Solace experience."}
        </AppText>
        <View style={{ gap: 18 }}>
          {page === "signup" && (
            <View style={{ gap: 7 }}>
              <AppText variant="label">Your name</AppText>
              <Input
                accessibilityLabel="Name"
                placeholder="What should we call you?"
                value={name}
                onChangeText={setName}
                editable={!app.busy}
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
              />
            </View>
          )}
          <View style={{ gap: 7 }}>
            <AppText variant="label">Email</AppText>
            <Input
              accessibilityLabel="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              editable={!app.busy}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
            />
          </View>
          <View style={{ gap: 7 }}>
            <AppText variant="label">Password</AppText>
            <View style={{ position: "relative" }}>
              <Input
                accessibilityLabel="Password"
                placeholder={
                  page === "signup" ? "At least 8 characters" : "Your password"
                }
                value={password}
                onChangeText={setPassword}
                editable={!app.busy}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={
                  page === "signup" ? "new-password" : "current-password"
                }
                textContentType={page === "signup" ? "newPassword" : "password"}
                onSubmitEditing={submit}
                returnKeyType="go"
                style={{ paddingRight: 56 }}
              />
              <View style={{ position: "absolute", right: 5, top: 5 }}>
                <IconButton
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  label={showPassword ? "Hide password" : "Show password"}
                  onPress={() => setShowPassword(!showPassword)}
                />
              </View>
            </View>
          </View>
          {!!notice && (
            <AppText accessibilityRole="alert" color={colors.danger}>
              {notice}
            </AppText>
          )}
          <Button
            title={page === "signup" ? "Create account" : "Log in"}
            icon="arrow-forward"
            onPress={submit}
            loading={app.busy}
            style={{ marginTop: 6 }}
          />
          <Button
            title={
              page === "signup"
                ? "Already have an account? Log in"
                : "Create an account"
            }
            variant="secondary"
            disabled={app.busy}
            onPress={() => changePage(page === "signup" ? "login" : "signup")}
          />
        </View>
        <View
          style={{
            flex: 1,
            minHeight: 90,
            justifyContent: "flex-end",
            paddingTop: 28,
          }}
        >
          <Row style={{ gap: 8, justifyContent: "center", marginBottom: 8 }}>
            <Icon name="lock-closed-outline" size={14} color={colors.muted} />
            <AppText variant="caption" color={colors.muted}>
              A private space for your everyday wellbeing.
            </AppText>
          </Row>
          <AppText
            variant="caption"
            color={colors.muted}
            style={{ textAlign: "center", fontSize: 11, lineHeight: 17 }}
          >
            Solace is an AI wellness companion and is not a substitute for
            professional care.
          </AppText>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

export { TodayScreen, ExploreScreen } from "./Discover";

export function ChatScreen() {
  const app = useApp();
  const navigationInset = useNavigationInset();
  const { colors, resolved } = useTheme();
  const [id, setId] = useState<string | undefined>(app.params?.id);
  const draftKey = id || "new";
  const [input, setInput] = useState(
    app.chatDrafts[draftKey] ?? String(app.params?.context || ""),
  );
  const [inputFocused, setInputFocused] = useState(false);
  const composerInput = useRef<React.ElementRef<typeof TextInput>>(null);
  const [pending, setPending] = useState("");
  const [voiceState, setVoiceState] = useState<
    "idle" | "listening" | "thinking" | "speaking"
  >("idle");
  const inputRef = useRef(input);
  inputRef.current = input;
  const [failure, setFailure] = useState("");
  const sending = useRef(false);
  const scroll = useRef<React.ElementRef<typeof ScrollView>>(null);
  const mounted = useRef(true);
  const nearBottom = useRef(true);
  const [showLatest, setShowLatest] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    nearBottom.current = true;
    setShowLatest(false);
    setId(app.params?.id);
    setInput(
      app.chatDrafts[app.params?.id || "new"] ??
        String(app.params?.context || ""),
    );
    setFailure("");
  }, [app.params?.id, app.params?.context || ""]);
  const conversation = app.data.conversations.find((x) => x.id === id);
  const messages = Array.isArray(conversation?.messages)
    ? conversation.messages
    : [];
  const lastAssistant = [...messages]
    .reverse()
    .find((m: any) => m.role === "assistant");
  const lastUser = [...messages]
    .reverse()
    .find((message: any) => message.role === "user");
  const momentContext = {
    feeling: String(lastUser?.content || "").slice(0, 1200),
    conversationId: id,
  };
  const action = lastAssistant?.action;
  const showSupport =
    lastAssistant?.support === true || lastAssistant?.safety === true;
  const voiceBusy = voiceState === "listening" || voiceState === "thinking";
  const activityDisabled = !!pending || voiceBusy;
  const sendDisabled = !input.trim() || activityDisabled;
  const fresh = messages.length === 0 && !pending;
  const reflection = action?.type === "reflection";
  const offerReset =
    !pending && !showSupport && (fresh || action?.type === "breathing");
  const today = localDay();
  const mood = useMemo(
    () =>
      app.data.checkins
        .filter((record) => recordDay(record) === today)
        .sort((left, right) =>
          String(right.createdAt).localeCompare(String(left.createdAt)),
        )[0]?.mood,
    [app.data.checkins, today],
  );
  function startReset() {
    app.navigate("breathing", {
      durationSec: 60,
      source: "solace-chat",
      conversationId: id,
    });
  }
  function startReflection() {
    app.navigate("reflection", { source: "solace-chat", conversationId: id });
  }
  function writeDraft(text: string) {
    inputRef.current = text;
    setInput(text);
    app.setChatDraft(draftKey, text);
  }
  async function send() {
    const submitted = inputRef.current;
    const text = submitted.trim();
    if (!text || sendDisabled || sending.current) return;
    sending.current = true;
    nearBottom.current = true;
    setShowLatest(false);
    app.setChatDraft(draftKey, submitted);
    setPending(text);
    setFailure("");
    try {
      const result = await app.chat(text, id);
      app.setChatDraft(draftKey, "", submitted);
      if (mounted.current) {
        setInput("");
        setId(result.conversation.id);
        app.setParams({ id: result.conversation.id, context: "" });
      }
    } catch (e) {
      if (mounted.current)
        setFailure(
          e instanceof Error
            ? e.message
            : "Could not send. Your message is kept below; try again.",
        );
    } finally {
      sending.current = false;
      if (mounted.current) setPending("");
    }
  }
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <SafeAreaView
        edges={["top"]}
        style={{ flex: 1, backgroundColor: colors.bg }}
      >
        <Row style={chatStyles.header}>
          <Row style={{ gap: 0 }}>
            <ChatHeaderButton
              icon="headset-outline"
              label="Start a voice conversation"
              disabled={activityDisabled}
              featured
              onPress={() => app.navigate("voice-talk", { id })}
            />
            <ChatHeaderButton
              icon="sparkles-outline"
              label="Create a Solace Moment"
              disabled={activityDisabled}
              onPress={() => app.navigate("moments", momentContext)}
            />
          </Row>
          <AppText
            variant="heading"
            accessibilityRole="header"
            style={chatStyles.title}
          >
            Solace
          </AppText>
          <Row style={{ gap: 0 }}>
            <ChatHeaderButton
              icon="create-outline"
              label="New conversation"
              disabled={activityDisabled}
              onPress={() => {
                setId(undefined);
                app.setParams({ id: undefined, context: "" });
                inputRef.current = app.chatDrafts.new || "";
                setInput(inputRef.current);
                setFailure("");
              }}
            />
            <ChatHeaderButton
              icon="time-outline"
              label="Conversation history"
              disabled={activityDisabled}
              onPress={() => app.navigate("history")}
            />
          </Row>
        </Row>
        <View style={{ flex: 1 }}>
          <ScrollView
            ref={scroll}
            onScroll={({ nativeEvent }) => {
              nearBottom.current =
                nativeEvent.contentSize.height -
                  nativeEvent.layoutMeasurement.height -
                  nativeEvent.contentOffset.y <
                90;
              if (nearBottom.current) setShowLatest(false);
            }}
            scrollEventThrottle={100}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => {
              if ((messages.length || pending) && nearBottom.current)
                scroll.current?.scrollToEnd({ animated: false });
              else if (messages.length) setShowLatest(true);
            }}
            contentContainerStyle={chatStyles.conversation}
          >
            {fresh && <ChatWelcome mood={mood} state={voiceState} />}
            {messages.map((message: any, index: number) => {
              const source =
                message.support || message.safety
                  ? "Support guidance"
                  : message.provider === "offline"
                    ? "Built-in reply"
                    : message.provider === "live"
                      ? "Live AI reply"
                      : undefined;
              return (
                <ChatBubble
                  key={message.id || index}
                  user={message.role === "user"}
                  label={source}
                >
                  <AppText selectable>{message.content}</AppText>
                </ChatBubble>
              );
            })}
            {!!pending && (
              <>
                <ChatBubble user>
                  <AppText>{pending}</AppText>
                </ChatBubble>
                <Row>
                  <Companion size={33} state="thinking" />
                  <AppText
                    accessibilityLiveRegion="polite"
                    variant="caption"
                    color={colors.muted}
                  >
                    Solace is thinking…
                  </AppText>
                </Row>
              </>
            )}
            {showSupport && !pending && (
              <Button
                title="Find human support"
                variant="secondary"
                icon="heart-outline"
                onPress={() => app.navigate("support")}
                style={{ alignSelf: "flex-start", marginBottom: 12 }}
              />
            )}
            {!pending && !showSupport && (offerReset || reflection) && (
              <ChatQuickReplies
                reflection={reflection}
                disabled={activityDisabled}
                onActivity={reflection ? startReflection : startReset}
                onTalk={() => composerInput.current?.focus()}
              />
            )}
            {offerReset && (
              <ChatResetCard onPress={startReset} disabled={activityDisabled} />
            )}
            {reflection && !showSupport && !pending && (
              <Card style={{ backgroundColor: colors.surface2 }}>
                <Row style={{ gap: 7, marginBottom: 7 }}>
                  <Icon name="book-outline" size={16} />
                  <AppText variant="caption">Suggested activity</AppText>
                </Row>
                <AppText
                  variant="heading"
                  style={{ maxWidth: "85%", marginBottom: 12 }}
                >
                  {action.label}
                </AppText>
                <Button
                  title="Start writing"
                  icon="arrow-forward"
                  onPress={startReflection}
                  disabled={activityDisabled}
                  style={{ alignSelf: "flex-start", minHeight: 44 }}
                />
              </Card>
            )}
          </ScrollView>
          {showLatest && (
            <View style={{ position: "absolute", bottom: 12, right: 20 }}>
              <Button
                title="Latest messages"
                icon="arrow-down"
                onPress={() => {
                  nearBottom.current = true;
                  setShowLatest(false);
                  scroll.current?.scrollToEnd({ animated: true });
                }}
                style={{ minHeight: 42 }}
              />
            </View>
          )}
        </View>
        <View
          style={[
            chatStyles.composer,
            { paddingBottom: 10 + navigationInset, backgroundColor: colors.bg },
          ]}
        >
          {!!failure && (
            <AppText
              accessibilityRole="alert"
              color={colors.danger}
              style={{ marginBottom: 10, fontSize: 13 }}
            >
              {failure}
            </AppText>
          )}
          <VoiceControls
            key={`${app.user?.id}-${draftKey}`}
            disabled={!!pending}
            reply={String(lastAssistant?.content || "")}
            onState={setVoiceState}
            onTranscript={(text) => {
              const before = inputRef.current;
              const combined = `${before}${before.trim() ? "\n" : ""}${text}`;
              if (combined.length > 4000) {
                setFailure(
                  "Your draft and transcript exceed 4,000 characters. Shorten your draft first; your full transcript is kept above.",
                );
                return false;
              }
              writeDraft(combined);
              setFailure("");
              return true;
            }}
            renderComposer={(microphone) => (
              <Row style={chatStyles.composerRow}>
                <TextInput
                  ref={composerInput}
                  accessibilityLabel="Message Solace"
                  placeholder="Message Solace…"
                  placeholderTextColor={colors.muted}
                  selectionColor={colors.accent}
                  value={input}
                  onChangeText={writeDraft}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  multiline
                  editable={!pending}
                  maxLength={4000}
                  style={[
                    chatStyles.messageInput,
                    {
                      color: colors.text,
                      backgroundColor: colors.surface,
                      borderColor: inputFocused
                        ? colors.primary
                        : colors.border,
                    },
                  ]}
                />
                {microphone}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    failure ? "Retry message" : "Send message"
                  }
                  accessibilityState={{
                    disabled: sendDisabled,
                    busy: !!pending,
                  }}
                  aria-disabled={sendDisabled}
                  aria-busy={!!pending}
                  onPress={send}
                  disabled={sendDisabled}
                  style={({ pressed }) => [
                    chatStyles.sendButton,
                    {
                      backgroundColor:
                        resolved === "dark"
                          ? colors.primary
                          : colors.sageSurface,
                      opacity: sendDisabled ? 0.55 : pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  <Icon
                    name={failure ? "refresh-outline" : "paper-plane-outline"}
                    color={
                      resolved === "dark" ? colors.primaryText : colors.primary
                    }
                    size={22}
                  />
                </Pressable>
              </Row>
            )}
          />
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const chatStyles = StyleSheet.create({
  header: { paddingHorizontal: 14, paddingTop: 9, paddingBottom: 7, gap: 2 },
  title: {
    flex: 1,
    minWidth: 0,
    textAlign: "center",
    fontSize: 32,
    lineHeight: 36,
  },
  conversation: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 17,
    gap: 12,
  },
  composer: { paddingHorizontal: 16, paddingTop: 7 },
  composerRow: { alignItems: "flex-end", gap: 7 },
  messageInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    maxHeight: 116,
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderWidth: 1,
    borderRadius: 23,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: "top",
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
});

export function HistoryScreen() {
  const app = useApp();
  const { colors } = useTheme();
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(30);
  const [failure, setFailure] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const renamePending = useRef(false);
  const searchIndex = useMemo(
    () =>
      [...app.data.conversations]
        .sort((a, b) =>
          String(b.updatedAt || b.createdAt).localeCompare(
            String(a.updatedAt || a.createdAt),
          ),
        )
        .map((conversation) => ({
          conversation,
          text: [
            conversation.title,
            ...(conversation.messages || []).map(
              (message: any) => message.content,
            ),
          ]
            .join(" ")
            .toLocaleLowerCase(),
        })),
    [app.data.conversations],
  );
  const conversations = useMemo(
    () => searchIndex.map((item) => item.conversation),
    [searchIndex],
  );
  const search = query.trim().toLocaleLowerCase();
  const filtered = useMemo(
    () =>
      searchIndex
        .filter((item) => !search || item.text.includes(search))
        .map((item) => item.conversation),
    [searchIndex, search],
  );
  useEffect(() => {
    setVisibleCount(30);
  }, [search]);
  async function rename(id: string) {
    if (renamePending.current) return;
    const nextTitle = title.trim();
    if (!nextTitle) {
      setFailure("Give this conversation a name before saving.");
      return;
    }
    renamePending.current = true;
    setSaving(true);
    setFailure("");
    try {
      await app.save("conversations", { id, title: nextTitle });
      setEditing(null);
    } catch (e) {
      setFailure(
        e instanceof Error
          ? e.message
          : "Could not rename. Your title is kept; try again.",
      );
    } finally {
      renamePending.current = false;
      setSaving(false);
    }
  }
  return (
    <Screen>
      <Row
        style={{
          justifyContent: "space-between",
          marginBottom: 24,
          marginLeft: -10,
        }}
      >
        <IconButton name="arrow-back" label="Go back" onPress={app.back} />
        <BrandMark />
      </Row>
      <AppText variant="title">Your conversations</AppText>
      <AppText color={colors.muted} style={{ marginTop: 8, marginBottom: 22 }}>
        A private space for your thoughts. Find a conversation, or begin again.
      </AppText>
      <View style={{ position: "relative", marginBottom: 12 }}>
        <Input
          accessibilityLabel="Search conversations"
          placeholder="Search titles and messages"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          returnKeyType="search"
          style={{ paddingLeft: 44, paddingRight: 48 }}
        />
        <View
          pointerEvents="none"
          style={{ position: "absolute", left: 15, top: 17 }}
        >
          <Icon name="search-outline" size={20} color={colors.muted} />
        </View>
        {!!query && (
          <View style={{ position: "absolute", right: 5, top: 5 }}>
            <IconButton
              name="close"
              label="Clear conversation search"
              onPress={() => setQuery("")}
            />
          </View>
        )}
      </View>
      <Button
        title="New conversation"
        icon="add"
        onPress={() => app.navigate("chat")}
        style={{ marginBottom: 24 }}
      />
      {!!failure && (
        <AppText
          accessibilityRole="alert"
          color={colors.danger}
          style={{ marginBottom: 16 }}
        >
          {failure}
        </AppText>
      )}
      {!!conversations.length && (
        <AppText
          variant="caption"
          color={colors.muted}
          accessibilityLiveRegion="polite"
          style={{ marginBottom: 8 }}
        >
          {search
            ? `${filtered.length} ${filtered.length === 1 ? "match" : "matches"}`
            : `${conversations.length} ${conversations.length === 1 ? "conversation" : "conversations"}`}
        </AppText>
      )}
      {filtered.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 32 }}>
          <Icon
            name={search ? "search-outline" : "chatbubbles-outline"}
            size={32}
            color={colors.muted}
          />
          <AppText variant="heading" style={{ marginTop: 14 }}>
            {search ? "No conversations found" : "A fresh beginning"}
          </AppText>
          <AppText
            color={colors.muted}
            style={{ marginTop: 8, textAlign: "center", maxWidth: 280 }}
          >
            {search
              ? "Try a different word from a title or message."
              : "Your conversations will be here whenever you want to return."}
          </AppText>
          {!!search && (
            <Button
              title="Clear search"
              variant="ghost"
              onPress={() => setQuery("")}
              style={{ marginTop: 12 }}
            />
          )}
        </View>
      ) : (
        filtered.slice(0, visibleCount).map((c) => (
          <View
            key={c.id}
            style={{
              paddingVertical: 18,
              borderBottomWidth: 0.75,
              borderBottomColor: colors.border,
            }}
          >
            {editing === c.id ? (
              <View style={{ gap: 12 }}>
                <AppText variant="label">Conversation name</AppText>
                <Input
                  accessibilityLabel="Conversation name"
                  value={title}
                  onChangeText={setTitle}
                  maxLength={160}
                  editable={!saving}
                  autoFocus
                  onSubmitEditing={() => rename(String(c.id))}
                />
                <Row>
                  <Button
                    title="Save name"
                    loading={saving}
                    onPress={() => rename(String(c.id))}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Cancel"
                    variant="secondary"
                    disabled={saving}
                    onPress={() => {
                      setEditing(null);
                      setFailure("");
                    }}
                    style={{ flex: 1 }}
                  />
                </Row>
              </View>
            ) : (
              <>
                <Row style={{ alignItems: "flex-start", gap: 6 }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${c.title || "conversation"}`}
                    onPress={() => app.navigate("chat", { id: c.id })}
                    style={({ pressed }) => ({
                      flex: 1,
                      minHeight: 66,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <AppText
                      variant="heading"
                      numberOfLines={2}
                      style={{ fontSize: 25, lineHeight: 28 }}
                    >
                      {c.title || "A conversation"}
                    </AppText>
                    <AppText
                      variant="caption"
                      color={colors.muted}
                      style={{ marginTop: 5 }}
                    >
                      {dateLabel(c.updatedAt || c.createdAt)} ·{" "}
                      {(c.messages || []).length} messages
                    </AppText>
                    <AppText
                      numberOfLines={2}
                      color={colors.muted}
                      style={{ marginTop: 8, fontSize: 14, lineHeight: 21 }}
                    >
                      {c.messages?.at(-1)?.content ||
                        "Continue your conversation"}
                    </AppText>
                  </Pressable>
                  <View>
                    <IconButton
                      name="pencil-outline"
                      label={`Rename ${c.title || "conversation"}`}
                      disabled={!!deleting}
                      onPress={() => {
                        setEditing(String(c.id));
                        setTitle(c.title || "");
                        setFailure("");
                      }}
                    />
                    <IconButton
                      name="trash-outline"
                      label={`Delete ${c.title || "conversation"}`}
                      disabled={!!deleting}
                      onPress={() =>
                        confirmAction(
                          "Delete conversation?",
                          "This removes the conversation and its linked memories.",
                          () => {
                            setFailure("");
                            setDeleting(String(c.id));
                            app
                              .remove("conversations", String(c.id))
                              .catch((e) =>
                                setFailure(
                                  e.message ||
                                    "Could not delete. Please try again.",
                                ),
                              )
                              .finally(() => setDeleting(null));
                          },
                        )
                      }
                    />
                  </View>
                </Row>
                {deleting === c.id && (
                  <AppText
                    variant="caption"
                    color={colors.muted}
                    accessibilityLiveRegion="polite"
                    style={{ marginTop: 8 }}
                  >
                    Deleting conversation…
                  </AppText>
                )}
              </>
            )}
          </View>
        ))
      )}
      {filtered.length > visibleCount && (
        <View style={{ marginTop: 18 }}>
          <AppText
            variant="caption"
            color={colors.muted}
            style={{ textAlign: "center", marginBottom: 10 }}
          >
            Showing {visibleCount} of {filtered.length}
          </AppText>
          <Button
            title={`Show ${Math.min(30, filtered.length - visibleCount)} more conversations`}
            variant="secondary"
            onPress={() => setVisibleCount((count) => count + 30)}
          />
        </View>
      )}
    </Screen>
  );
}
