import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Animated,
  FlatList,
  Keyboard,
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
import { StatusBar } from "expo-status-bar";
import { useApp } from "../store";
import { Companion, useReducedMotion } from "../Companion";
import { localDay, recordDay } from "../content";
import { spacing, useScreenGutter } from "../layout";
import { VoiceControls } from "../VoiceControls";
import { useTheme } from "../theme";
import { createChatPractice } from "../chat-practices";
import {
  chatPractices,
  isChatPracticeId,
  type ChatAction,
} from "../../server/src/chat-practice";
import {
  ChatAvatar,
  ChatBubble,
  ChatHeaderButton,
  ChatQuickReplies,
  ChatResetCard,
  ChatScene,
  ChatWelcome,
} from "./ChatDetails";
import {
  AppText,
  Artwork,
  BrandMark,
  LotusMark,
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
  const emailField = useRef<React.ComponentRef<typeof TextInput>>(null);
  const passwordField = useRef<React.ComponentRef<typeof TextInput>>(null);
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
      <Screen adjustKeyboardInsets={false} style={{ flex: 1 }}>
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
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => emailField.current?.focus()}
              />
            </View>
          )}
          <View style={{ gap: 7 }}>
            <AppText variant="label">Email</AppText>
            <Input
              ref={emailField}
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
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => passwordField.current?.focus()}
            />
          </View>
          <View style={{ gap: 7 }}>
            <AppText variant="label">Password</AppText>
            <View style={{ position: "relative" }}>
              <Input
                ref={passwordField}
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

export { TodayScreen } from "./Discover";
export { ExploreScreen } from "./Explore";

type ChatMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  provider?: "offline" | "live";
  support?: boolean;
  safety?: boolean;
  action?: ChatAction;
};

const emptyMessages: ChatMessage[] = [];

export function ChatScreen({
  scrollMemory,
}: {
  scrollMemory: Map<string, number>;
}) {
  const app = useApp();
  const navigationInset = useNavigationInset();
  const { colors, resolved } = useTheme();
  const reduceMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const gutter = useScreenGutter();
  const [headerOpacity] = useState(() => new Animated.Value(1));
  const [showComposerMenu, setShowComposerMenu] = useState(false);
  const dark = resolved === "dark";
  const sceneHeight = Math.min(308, Math.round(width * 0.64));
  const id = typeof app.params?.id === "string" ? app.params.id : undefined;
  const draftKey = id || "new";
  const context = String(app.params?.context || "");
  const input = app.chatDrafts[draftKey] ?? context;
  const [inputFocused, setInputFocused] = useState(false);
  const composerInput = useRef<React.ElementRef<typeof TextInput>>(null);
  const welcomeScroll = useRef<React.ElementRef<typeof ScrollView>>(null);
  const [localPending, setPending] = useState("");
  const pending = localPending || app.chatPending[draftKey] || "";
  const [voiceState, setVoiceState] = useState<
    "idle" | "listening" | "thinking" | "speaking"
  >("idle");
  const inputRef = useRef(input);
  inputRef.current = input;
  const [failure, setFailure] = useState("");
  const sending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    setFailure("");
    setShowComposerMenu(false);
  }, [id]);
  useEffect(() => {
    if (reduceMotion) headerOpacity.setValue(1);
    return () => headerOpacity.stopAnimation();
  }, [headerOpacity, reduceMotion]);
  const conversation = app.data.conversations.find((x) => x.id === id);
  const messages: ChatMessage[] = Array.isArray(conversation?.messages)
    ? conversation.messages
    : emptyMessages;
  const lastAssistant = messages.findLast(
    (message) => message.role === "assistant",
  );
  const lastUser = messages.findLast((message) => message.role === "user");
  const momentContext = {
    feeling: String(lastUser?.content || "").slice(0, 1200),
    conversationId: id,
  };
  const action = lastAssistant?.action;
  const actionKey = lastAssistant?.id ?? String(messages.length);
  const showSupport =
    lastAssistant?.support === true || lastAssistant?.safety === true;
  const voiceBusy = voiceState === "listening" || voiceState === "thinking";
  const activityDisabled = !!pending || voiceBusy;
  const sendDisabled = !input.trim() || activityDisabled;
  const fresh = messages.length === 0 && !pending;
  const recommendation =
    !pending &&
    !showSupport &&
    app.params.dismissedPractice !== actionKey &&
    isChatPracticeId(action?.type)
      ? createChatPractice(action.type)
      : undefined;
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
    setShowComposerMenu(false);
    app.navigate("breathing", {
      durationSec: 120,
      source: "solace-chat",
      conversationId: id,
    });
  }
  function startReflection() {
    setShowComposerMenu(false);
    app.navigate("reflection", { source: "solace-chat", conversationId: id });
  }
  function openMoments() {
    setShowComposerMenu(false);
    app.navigate("moments", momentContext);
  }
  function writeDraft(text: string) {
    inputRef.current = text;
    if (context) app.setParams({ context: "" });
    app.setChatDraft(draftKey, text);
  }
  async function send() {
    const submitted = inputRef.current;
    const text = submitted.trim();
    if (!text || sendDisabled || sending.current) return;
    sending.current = true;
    setShowComposerMenu(false);
    writeDraft(submitted);
    if (fresh && !reduceMotion) {
      headerOpacity.setValue(0.7);
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 160,
        useNativeDriver: Platform.OS !== "web",
        isInteraction: false,
      }).start();
    }
    setPending(text);
    setFailure("");
    try {
      const result = await app.chat(text, id);
      app.setChatDraft(draftKey, "", submitted);
      app.setParams({ id: result.conversation.id, context: "" });
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
  function chatActions(playback: React.ReactNode) {
    if (!showComposerMenu) return null;
    return (
      <View
        style={[
          chatStyles.composerMenu,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <AppText variant="label" style={chatStyles.menuTitle}>
          Chat actions
        </AppText>
        <View style={chatStyles.menuActions}>
          {[
            {
              label: "Guided Breath",
              icon: "leaf-outline",
              action: startReset,
            },
            {
              label: "Solace Moments",
              icon: "sparkles-outline",
              action: openMoments,
            },
            {
              label: "Write a reflection",
              icon: "book-outline",
              action: startReflection,
            },
            {
              label: "Find support",
              icon: "heart-outline",
              action: () => app.navigate("support"),
            },
          ].map(({ label, icon, action }) => (
            <Pressable
              key={label}
              accessibilityRole="button"
              onPress={() => {
                setShowComposerMenu(false);
                action();
              }}
              style={({ pressed }) => [
                chatStyles.menuAction,
                { backgroundColor: pressed ? colors.surface2 : colors.bg },
              ]}
            >
              <Icon name={icon} size={17} color={colors.primary} />
              <AppText variant="caption" style={chatStyles.menuLabel}>
                {label}
              </AppText>
            </Pressable>
          ))}
        </View>
        {!!playback && (
          <Row style={chatStyles.playbackAction}>
            <AppText variant="caption" color={colors.muted}>
              Latest reply
            </AppText>
            {playback}
          </Row>
        )}
      </View>
    );
  }
  const header = (
    <View style={[chatStyles.header, { paddingHorizontal: gutter - 8 }]}>
      <Row style={chatStyles.headerActions}>
        <ChatHeaderButton
          icon="headset-outline"
          label="Start a voice conversation"
          disabled={activityDisabled}
          featured
          scenic={fresh}
          onPress={() => app.navigate("voice-talk", { id })}
        />
        <ChatHeaderButton
          icon="sparkles-outline"
          label="Create a Solace Moment"
          disabled={activityDisabled}
          scenic={fresh}
          onPress={openMoments}
        />
      </Row>
      <View style={chatStyles.headerBrand}>
        <Row style={chatStyles.brandName}>
          {fresh ? (
            <LotusMark size={28} />
          ) : (
            <ChatAvatar size={28} state={pending ? "thinking" : voiceState} />
          )}
          <AppText
            variant="heading"
            accessibilityRole="header"
            color={fresh ? "#FFF7E9" : colors.text}
            style={fresh ? chatStyles.title : chatStyles.compactTitle}
          >
            Solace
          </AppText>
        </Row>
        {fresh && (
          <AppText
            variant="caption"
            color="#F6EDDE"
            style={chatStyles.headerCaption}
          >
            Here to listen
          </AppText>
        )}
      </View>
      <Row style={chatStyles.headerActions}>
        <ChatHeaderButton
          icon="create-outline"
          label="New conversation"
          disabled={activityDisabled}
          scenic={fresh}
          onPress={() => {
            Keyboard.dismiss();
            welcomeScroll.current?.scrollTo({ y: 0, animated: false });
            app.setParams({ id: undefined, context: "" });
            setFailure("");
            setShowComposerMenu(false);
          }}
        />
        <ChatHeaderButton
          icon="time-outline"
          label="Conversation history"
          disabled={activityDisabled}
          scenic={fresh}
          onPress={() => app.navigate("history")}
        />
      </Row>
    </View>
  );
  const transcriptFooter = (
    <View style={chatStyles.transcriptFooter}>
      {!!pending && (
        <>
          <ChatBubble user>{pending}</ChatBubble>
          <Row
            style={[chatStyles.thinking, { backgroundColor: colors.surface }]}
          >
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
          style={{ alignSelf: "flex-start" }}
        />
      )}
      {recommendation && action && (
        <Card style={{ backgroundColor: colors.surface2 }}>
          <Row style={{ gap: spacing.compact, marginBottom: spacing.compact }}>
            <Icon name={chatPractices[action.type].icon} size={18} />
            <AppText variant="caption" color={colors.muted}>
              Suggested Moment · {recommendation.durationSec / 60} min
            </AppText>
          </Row>
          <AppText variant="heading">{recommendation.title}</AppText>
          <AppText color={colors.muted} style={{ marginTop: spacing.compact }}>
            {recommendation.description}
          </AppText>
          <Row
            style={{
              flexWrap: "wrap",
              gap: spacing.compact,
              marginTop: spacing.card,
            }}
          >
            <Button
              title="Open Moment"
              icon="arrow-forward"
              onPress={() => {
                Keyboard.dismiss();
                app.navigate("moment-player", {
                  activity: recommendation,
                  provider: "offline",
                  source: "chat",
                  conversationId: id,
                });
              }}
              disabled={activityDisabled}
              style={{ minHeight: 48 }}
            />
            <Button
              title="Not now"
              variant="ghost"
              onPress={() => app.setParams({ dismissedPractice: actionKey })}
              style={{ minHeight: 48 }}
            />
          </Row>
        </Card>
      )}
    </View>
  );
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "web" ? undefined : "padding"}
    >
      <StatusBar style={dark ? "light" : "dark"} />
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        {fresh ? (
          <ScrollView
            ref={welcomeScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <ChatScene height={sceneHeight}>{header}</ChatScene>
            <View style={[chatStyles.welcome, { paddingHorizontal: gutter }]}>
              <ChatWelcome mood={mood} state={voiceState} />
              <ChatQuickReplies
                disabled={activityDisabled}
                onActivity={startReset}
                onTalk={() => composerInput.current?.focus()}
              />
              <ChatResetCard onPress={startReset} disabled={activityDisabled} />
            </View>
          </ScrollView>
        ) : (
          <>
            <Animated.View
              style={[
                chatStyles.compactHeader,
                { borderBottomColor: colors.border, opacity: headerOpacity },
              ]}
            >
              {header}
            </Animated.View>
            <ChatTranscript
              key={draftKey}
              conversationKey={draftKey}
              footer={transcriptFooter}
              gutter={gutter}
              messages={messages}
              reduceMotion={reduceMotion}
              scrollMemory={scrollMemory}
            />
          </>
        )}
        <View
          style={[
            chatStyles.composer,
            {
              paddingBottom: 10 + navigationInset,
              paddingHorizontal: gutter,
              backgroundColor: colors.bg,
            },
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
            renderComposer={(microphone, playback) => (
              <>
                {chatActions(playback)}
                <Row style={chatStyles.composerRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      showComposerMenu
                        ? "Close chat actions"
                        : "More chat actions"
                    }
                    accessibilityState={{
                      expanded: showComposerMenu,
                      disabled: activityDisabled,
                    }}
                    disabled={activityDisabled}
                    onPress={() => {
                      if (!showComposerMenu) Keyboard.dismiss();
                      setShowComposerMenu((open) => !open);
                    }}
                    style={({ pressed }) => [
                      chatStyles.sendButton,
                      {
                        backgroundColor: dark ? "#25201DF5" : "#FFF8EFF5",
                        borderColor: dark ? "#655348" : "#FFFFFF",
                        opacity: activityDisabled ? 0.5 : pressed ? 0.72 : 1,
                      },
                    ]}
                  >
                    <Icon
                      name={showComposerMenu ? "close" : "add"}
                      color={colors.text}
                      size={24}
                    />
                  </Pressable>
                  <TextInput
                    ref={composerInput}
                    accessibilityLabel="Message Solace"
                    placeholder={width < 360 ? "Message…" : "Message Solace…"}
                    placeholderTextColor={colors.muted}
                    selectionColor={colors.accent}
                    value={input}
                    onChangeText={writeDraft}
                    onFocus={() => {
                      setShowComposerMenu(false);
                      setInputFocused(true);
                    }}
                    onBlur={() => setInputFocused(false)}
                    multiline
                    numberOfLines={Platform.OS === "web" ? 1 : undefined}
                    editable={!pending}
                    maxLength={4000}
                    style={[
                      chatStyles.messageInput,
                      {
                        color: colors.text,
                        backgroundColor: dark ? "#25201DF5" : "#FFF8EFF5",
                        borderColor: inputFocused
                          ? colors.primary
                          : dark
                            ? "#655348"
                            : "#FFFFFF",
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
                        backgroundColor: dark ? colors.primary : "#35533F",
                        borderColor: dark ? "#F4D5B6" : "#A8B998",
                        opacity: sendDisabled ? 0.55 : pressed ? 0.75 : 1,
                      },
                    ]}
                  >
                    <Icon
                      name={failure ? "refresh-outline" : "paper-plane"}
                      color={colors.primaryText}
                      size={22}
                    />
                  </Pressable>
                </Row>
              </>
            )}
          />
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function renderChatMessage({ item }: { item: ChatMessage }) {
  const label =
    item.support || item.safety
      ? "Support guidance"
      : item.provider === "offline"
        ? "Built-in reply"
        : item.provider === "live"
          ? "Live AI reply"
          : undefined;
  return (
    <ChatBubble
      user={item.role === "user"}
      avatar={item.role === "assistant"}
      label={label}
      createdAt={item.createdAt}
    >
      {String(item.content ?? "")}
    </ChatBubble>
  );
}

function MessageSpacing() {
  return <View style={chatStyles.messageSpacing} />;
}

function ChatTranscript({
  conversationKey,
  footer,
  gutter,
  messages,
  reduceMotion,
  scrollMemory,
}: {
  conversationKey: string;
  footer: React.ReactElement;
  gutter: number;
  messages: ChatMessage[];
  reduceMotion: boolean;
  scrollMemory: Map<string, number>;
}) {
  const list = useRef<FlatList<ChatMessage>>(null);
  const restoreOffset = useRef(scrollMemory.get(conversationKey));
  const newestFirst = useMemo(() => [...messages].reverse(), [messages]);
  const messageKey = useCallback(
    (message: ChatMessage, index: number) =>
      message.id ?? `legacy-${messages.length - index - 1}`,
    [messages.length],
  );
  const following = useRef(restoreOffset.current === undefined);
  const [showLatest, setShowLatest] = useState(!following.current);

  function adjustPosition() {
    if (restoreOffset.current !== undefined)
      list.current?.scrollToOffset({
        offset: restoreOffset.current,
        animated: false,
      });
    else if (following.current)
      list.current?.scrollToOffset({ offset: 0, animated: false });
  }

  return (
    <View style={chatStyles.transcript}>
      <FlatList
        ref={list}
        data={newestFirst}
        inverted
        renderItem={renderChatMessage}
        keyExtractor={messageKey}
        ItemSeparatorComponent={MessageSpacing}
        ListHeaderComponent={footer}
        ListHeaderComponentStyle={
          messages.length ? chatStyles.footerSpacing : undefined
        }
        initialNumToRender={12}
        windowSize={7}
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
          autoscrollToTopThreshold: 90,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={32}
        onLayout={adjustPosition}
        onContentSizeChange={adjustPosition}
        onScrollBeginDrag={() => {
          restoreOffset.current = undefined;
        }}
        onScroll={({ nativeEvent }) => {
          const offset = Math.max(0, nativeEvent.contentOffset.y);
          if (restoreOffset.current !== undefined) {
            if (Math.abs(restoreOffset.current - offset) > 2) return;
            restoreOffset.current = undefined;
          }
          following.current = offset < 90;
          if (conversationKey !== "new") {
            if (following.current) scrollMemory.delete(conversationKey);
            else scrollMemory.set(conversationKey, offset);
          }
          setShowLatest(!following.current);
        }}
        contentContainerStyle={[
          chatStyles.conversation,
          { paddingHorizontal: gutter },
        ]}
      />
      {showLatest && (
        <View style={[chatStyles.latest, { right: gutter }]}>
          <Button
            title="Latest messages"
            icon="arrow-down"
            onPress={() => {
              restoreOffset.current = undefined;
              following.current = true;
              scrollMemory.delete(conversationKey);
              setShowLatest(false);
              list.current?.scrollToOffset({
                offset: 0,
                animated: !reduceMotion,
              });
            }}
          />
        </View>
      )}
    </View>
  );
}

const chatStyles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.compact,
    gap: 2,
  },
  headerActions: { gap: 0 },
  headerBrand: { flex: 1, minWidth: 0, alignItems: "center" },
  brandName: { gap: 5, maxWidth: "100%" },
  headerCaption: { fontSize: 11, lineHeight: 16, textAlign: "center" },
  title: {
    flexShrink: 1,
    textAlign: "center",
    fontSize: 29,
    lineHeight: 32,
  },
  compactHeader: { borderBottomWidth: StyleSheet.hairlineWidth },
  compactTitle: { flexShrink: 1, fontSize: 25, lineHeight: 29 },
  welcome: { paddingBottom: spacing.card, gap: spacing.row },
  transcript: { flex: 1 },
  conversation: {
    flexGrow: 1,
    justifyContent: "flex-end",
    paddingVertical: spacing.row,
  },
  transcriptFooter: { gap: spacing.row },
  footerSpacing: { marginBottom: spacing.row },
  messageSpacing: { height: spacing.row },
  latest: { position: "absolute", bottom: spacing.row },
  thinking: {
    alignSelf: "flex-start",
    borderRadius: 16,
    paddingHorizontal: spacing.row,
    paddingVertical: spacing.compact,
  },
  composer: { paddingTop: spacing.compact },
  composerMenu: {
    padding: 12,
    marginBottom: 9,
    borderRadius: 20,
    borderWidth: 1,
    boxShadow: "0 8px 22px #271C131A",
  },
  menuTitle: { marginBottom: 8 },
  menuActions: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  menuAction: {
    flexGrow: 1,
    flexBasis: "46%",
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 6,
  },
  menuLabel: { flexShrink: 1 },
  playbackAction: {
    justifyContent: "space-between",
    paddingLeft: 9,
    marginTop: 4,
  },
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
    boxShadow: "0 5px 14px #271C1314",
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 5px 14px #271C1314",
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
