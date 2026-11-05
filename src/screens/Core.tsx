import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  View,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "../store";
import { useTheme } from "../theme";
import {
  AppText,
  Artwork,
  BrandMark,
  BotanicalBackdrop,
  IconButton,
  MoodStone,
  Button,
  Card,
  Icon,
  Input,
  Petal,
  Row,
  Screen,
  SectionTitle,
  useNavigationInset,
} from "../ui";
import { recordDay, participationProgress } from "../content";
import { weeklyReview } from "../insights";

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
function MenuCard({
  title,
  description,
  icon,
  onPress,
}: {
  title: string;
  description: string;
  icon: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: 17,
        borderBottomWidth: 0.75,
        borderBottomColor: colors.border,
        opacity: pressed ? 0.65 : 1,
      })}
    >
      <Row>
        <View
          style={{
            height: 42,
            width: 42,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.surface2,
          }}
        >
          <Icon name={icon} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="heading" style={{ fontSize: 22, lineHeight: 25 }}>
            {title}
          </AppText>
          <AppText variant="caption" color={colors.muted}>
            {description}
          </AppText>
        </View>
        <Icon name="chevron-forward" size={18} color={colors.muted} />
      </Row>
    </Pressable>
  );
}

export function AuthScreen() {
  const app = useApp();
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const [page, setPage] = useState<"welcome" | "login" | "signup">(
    app.sessionExpired ? "login" : "welcome",
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState("");
  function changePage(next: "welcome" | "login" | "signup") {
    setPage(next);
    setNotice("");
  }
  async function submit() {
    if (app.busy) return;
    setNotice("");
    if (!email.trim() || !password || (page === "signup" && !name.trim())) {
      setNotice("Please complete each field.");
      return;
    }
    if (page === "signup" && password.length < 8) {
      setNotice("Use at least 8 characters for your password.");
      return;
    }
    try {
      if (page === "signup")
        await app.signUp(name.trim(), email.trim(), password);
      else await app.signIn(email.trim(), password);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Please try again.");
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
            onPress={() => changePage("signup")}
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
  const { colors } = useTheme();
  const [id, setId] = useState<string | undefined>(app.params?.id);
  const draftKey = id || "new";
  const [input, setInput] = useState(
    app.chatDrafts[draftKey] ?? String(app.params?.context || ""),
  );
  const [pending, setPending] = useState("");
  const [failure, setFailure] = useState("");
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
  const action = lastAssistant?.action;
  function writeDraft(text: string) {
    setInput(text);
    app.setChatDraft(draftKey, text);
  }
  async function send() {
    const text = input.trim();
    if (!text || pending) return;
    nearBottom.current = true;
    setShowLatest(false);
    app.setChatDraft(draftKey, input);
    setPending(text);
    setFailure("");
    try {
      const result = await app.chat(text, id);
      app.setChatDraft(draftKey, "", input);
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
        <Row
          style={{
            paddingHorizontal: 24,
            paddingTop: 12,
            paddingBottom: 14,
            borderBottomWidth: 0.75,
            borderBottomColor: colors.border,
            justifyContent: "space-between",
          }}
        >
          <BrandMark />
          <Row style={{ gap: 0 }}>
            <IconButton
              name="create-outline"
              label="New conversation"
              disabled={!!pending}
              onPress={() => {
                setId(undefined);
                app.setParams({ id: undefined, context: "" });
                setInput(app.chatDrafts.new || "");
                setFailure("");
              }}
            />
            <IconButton
              name="time-outline"
              label="Conversation history"
              disabled={!!pending}
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
            contentContainerStyle={{
              paddingHorizontal: 24,
              paddingTop: 24,
              paddingBottom: 16,
              flexGrow: 1,
            }}
          >
            {messages.length === 0 && !pending && (
              <>
                <View
                  style={{
                    alignItems: "center",
                    paddingTop: 22,
                    paddingBottom: 30,
                  }}
                >
                  <Artwork kind="petal" size={108} />
                  <AppText variant="title" style={{ marginTop: 16 }}>
                    A little space to talk.
                  </AppText>
                  <AppText
                    color={colors.muted}
                    style={{ textAlign: "center", maxWidth: 275, marginTop: 9 }}
                  >
                    You don't have to have the right words. Start wherever you
                    are.
                  </AppText>
                </View>
                <Card
                  style={{
                    borderBottomLeftRadius: 6,
                    maxWidth: "94%",
                    marginBottom: 22,
                  }}
                >
                  <AppText>
                    Hi there. I'm Solace. I'm here to listen and help you find a
                    little calm, whenever you need it.
                  </AppText>
                </Card>
                <View style={{ gap: 9 }}>
                  {[
                    "I've been feeling overwhelmed",
                    "I'd like to reflect on my day",
                  ].map((text) => (
                    <Pressable
                      key={text}
                      accessibilityRole="button"
                      onPress={() => writeDraft(text)}
                      style={({ pressed }) => ({
                        paddingVertical: 13,
                        paddingHorizontal: 17,
                        borderWidth: 0.75,
                        borderColor: colors.border,
                        borderRadius: 22,
                        alignSelf: "flex-start",
                        backgroundColor: pressed
                          ? colors.surface2
                          : colors.surface,
                      })}
                    >
                      <Row style={{ gap: 9 }}>
                        <Icon name="leaf-outline" size={16} />
                        <AppText style={{ fontSize: 13 }}>{text}</AppText>
                      </Row>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
            {messages.map((m: any, index: number) => (
              <View
                key={m.id || index}
                style={{
                  alignItems: m.role === "user" ? "flex-end" : "flex-start",
                  marginBottom: 14,
                }}
              >
                <View
                  style={{
                    maxWidth: "92%",
                    backgroundColor:
                      m.role === "user" ? colors.surface2 : colors.surface,
                    borderRadius: 24,
                    borderBottomRightRadius: m.role === "user" ? 6 : 24,
                    borderBottomLeftRadius: m.role === "assistant" ? 6 : 24,
                    padding: 17,
                    borderWidth: 0.5,
                    borderColor: colors.border,
                  }}
                >
                  <AppText selectable>{m.content}</AppText>
                </View>
              </View>
            ))}
            {!!pending && (
              <>
                <View
                  style={{
                    alignSelf: "flex-end",
                    maxWidth: "92%",
                    backgroundColor: colors.surface2,
                    padding: 17,
                    borderRadius: 24,
                    borderBottomRightRadius: 6,
                  }}
                >
                  <AppText>{pending}</AppText>
                </View>
                <Row style={{ marginTop: 16, marginBottom: 10 }}>
                  <Petal size={26} />
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
            {!!action && !pending && (
              <Card
                style={{
                  marginTop: 8,
                  overflow: "hidden",
                  padding: 20,
                  backgroundColor: colors.surface2,
                }}
              >
                <BotanicalBackdrop
                  style={{ right: -80, top: -45, opacity: 0.2 }}
                />
                <Row style={{ gap: 7, marginBottom: 7 }}>
                  <Icon name="leaf-outline" size={16} />
                  <AppText variant="caption">Suggested activity</AppText>
                </Row>
                <AppText
                  variant="heading"
                  style={{ maxWidth: "85%", marginBottom: 12 }}
                >
                  {action.label}
                </AppText>
                <Button
                  title="Start now"
                  icon="arrow-forward"
                  onPress={() =>
                    app.navigate(
                      action.type === "reflection" ? "reflection" : "breathing",
                      { source: "chat", conversationId: id },
                    )
                  }
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
          style={{
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 4 + navigationInset,
            borderTopWidth: 0.75,
            borderTopColor: colors.border,
            backgroundColor: colors.bg,
          }}
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
          <Row style={{ alignItems: "flex-end", gap: 9 }}>
            <Input
              accessibilityLabel="Message Solace"
              placeholder="Message Solace…"
              value={input}
              onChangeText={writeDraft}
              multiline
              editable={!pending}
              maxLength={4000}
              style={{
                flex: 1,
                minHeight: 50,
                maxHeight: 120,
                borderRadius: 25,
                paddingTop: 14,
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={failure ? "Retry message" : "Send message"}
              accessibilityState={{
                disabled: !input.trim() || !!pending,
                busy: !!pending,
              }}
              aria-disabled={!input.trim() || !!pending}
              aria-busy={!!pending}
              onPress={send}
              disabled={!input.trim() || !!pending}
              style={({ pressed }) => ({
                height: 50,
                width: 50,
                borderRadius: 25,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.primary,
                opacity: !input.trim() || pending ? 0.45 : pressed ? 0.75 : 1,
              })}
            >
              <Icon
                name={failure ? "refresh-outline" : "arrow-up"}
                color={colors.primaryText}
                size={23}
              />
            </Pressable>
          </Row>
          <Row style={{ justifyContent: "space-between", gap: 3 }}>
            <AppText
              variant="caption"
              color={colors.muted}
              style={{ fontSize: 10 }}
            >
              {lastAssistant?.provider === "offline"
                ? "Built-in companion · Live AI is off"
                : lastAssistant?.provider === "live"
                  ? "Live AI companion"
                  : "AI wellness companion"}
            </AppText>
            <Pressable
              accessibilityRole="button"
              onPress={() => app.navigate("support")}
              style={{ minHeight: 40, justifyContent: "center" }}
            >
              <AppText
                variant="caption"
                color={colors.muted}
                style={{ fontSize: 11 }}
              >
                Human support
              </AppText>
            </Pressable>
          </Row>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

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

export function JourneyScreen() {
  const app = useApp();
  const [showMilestones, setShowMilestones] = useState(false);
  const { colors } = useTheme();
  const progress = useMemo(() => participationProgress(app.data), [app.data]);
  const week = useMemo(() => weeklyReview(app.data), [app.data]);
  const checkins = [...app.data.checkins].sort((a, b) =>
    String(b.createdAt).localeCompare(String(a.createdAt)),
  );
  const sessions = [...app.data.sessions].sort((a, b) =>
    String(b.createdAt).localeCompare(String(a.createdAt)),
  );
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    let day = new Date(today);
    day.setDate(today.getDate() - 6 + i);
    const key = [
      day.getFullYear(),
      String(day.getMonth() + 1).padStart(2, "0"),
      String(day.getDate()).padStart(2, "0"),
    ].join("-");
    return {
      label: day.toLocaleDateString(undefined, { weekday: "short" }),
      record: checkins.find((x) => recordDay(x) === key),
    };
  });
  return (
    <Screen>
      <AppText variant="title">Your journey</AppText>
      <AppText
        color={colors.muted}
        style={{ marginVertical: 8, marginBottom: 20 }}
      >
        A gentle look at your check-ins and the moments you've taken for
        yourself.
      </AppText>
      <Card style={{ marginBottom: 22, padding: 16 }}>
        <AppText variant="heading">Your last 7 days</AppText>
        <AppText variant="caption" color={colors.muted}>
          Your check-ins, at a glance.
        </AppText>
        <Row style={{ justifyContent: "space-between", gap: 1, marginTop: 14 }}>
          {days.map((d, i) => (
            <View key={i} style={{ alignItems: "center", flex: 1 }}>
              <MoodStone mood={d.record?.mood || ""} size={26} />
              <AppText variant="caption" style={{ fontSize: 10 }}>
                {d.label}
              </AppText>
              <AppText
                variant="caption"
                color={colors.muted}
                style={{ fontSize: 10 }}
              >
                {d.record?.mood || "—"}
              </AppText>
            </View>
          ))}
        </Row>
      </Card>
      <View style={{ marginTop: 4, marginBottom: 28 }}>
        <SectionTitle
          title="Your week, gently"
          subtitle="A small review of the last seven days."
        />
        <AppText style={{ lineHeight: 24 }}>
          {week.daysCheckedIn} {week.daysCheckedIn === 1 ? "day" : "days"}{" "}
          checked in · {week.completedMoments} completed{" "}
          {week.completedMoments === 1 ? "moment" : "moments"} ·{" "}
          {week.reflectionCount}{" "}
          {week.reflectionCount === 1 ? "reflection" : "reflections"}
        </AppText>
        <Row style={{ flexWrap: "wrap", gap: 8, marginTop: 15 }}>
          {week.moods
            .filter((mood) => mood.count > 0)
            .map((mood) => (
              <Row key={mood.mood} style={{ gap: 5, paddingRight: 8 }}>
                <MoodStone mood={mood.mood} size={19} />
                <AppText variant="caption">
                  {mood.mood} · {mood.count}
                </AppText>
              </Row>
            ))}
        </Row>
        <AppText color={colors.muted} style={{ marginTop: 14, fontSize: 14 }}>
          {week.supportiveMoments
            ? `You marked ${week.supportiveMoments} completed ${week.supportiveMoments === 1 ? "moment" : "moments"} as helpful or a little helpful.`
            : "Your feedback can help you notice which moments feel useful."}
        </AppText>
        <Button
          title="Reflect on your week"
          variant="secondary"
          icon="create-outline"
          onPress={() =>
            app.navigate("reflection", { prompt: week.suggestedPrompt })
          }
          style={{ marginTop: 18 }}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: showMilestones }}
        onPress={() => setShowMilestones((value) => !value)}
        style={{
          paddingVertical: 16,
          marginBottom: 20,
          borderTopWidth: 0.75,
          borderBottomWidth: 0.75,
          borderColor: colors.border,
        }}
      >
        <Row style={{ justifyContent: "space-between" }}>
          <View>
            <AppText variant="label">Activity milestones</AppText>
            <AppText variant="caption" color={colors.muted}>
              Your participation, at your pace.
            </AppText>
          </View>
          <Icon
            name={showMilestones ? "chevron-up" : "chevron-down"}
            color={colors.muted}
            size={19}
          />
        </Row>
      </Pressable>
      {showMilestones && (
        <>
          <SectionTitle title="Small milestones" />
          <Row style={{ marginBottom: 20, alignItems: "stretch" }}>
            {[
              {
                title: "A small beginning",
                earned: progress.checkedDays >= 1,
                detail: "Your first check-in",
              },
              {
                title: "Finding a rhythm",
                earned: progress.checkedDays >= 3,
                detail: "Check in on 3 days",
              },
            ].map((m) => (
              <Card key={m.title} style={{ flex: 1, padding: 12 }}>
                <Icon
                  name={
                    m.earned ? "checkmark-circle-outline" : "flower-outline"
                  }
                />
                <AppText variant="label" style={{ marginTop: 6 }}>
                  {m.title}
                </AppText>
                <AppText variant="caption">
                  {m.earned ? "Earned · " : "Next step · "}
                  {m.detail}
                </AppText>
              </Card>
            ))}
          </Row>
          <Card style={{ marginBottom: 22, backgroundColor: colors.surface2 }}>
            <Row style={{ justifyContent: "space-between" }}>
              <View>
                <AppText variant="heading">Activity progress</AppText>
                <AppText variant="caption" color={colors.muted}>
                  A record of the time you made for yourself
                </AppText>
              </View>
              <Icon name="sparkles-outline" />
            </Row>
            <Row style={{ justifyContent: "space-between", marginTop: 14 }}>
              <AppText variant="label">
                Level {progress.level} · {progress.xp} XP
              </AppText>
              <AppText variant="caption">
                {progress.streak} day check-in streak
              </AppText>
            </Row>
            <View
              style={{
                height: 6,
                borderRadius: 3,
                backgroundColor: colors.border,
                marginTop: 12,
              }}
            >
              <View
                style={{
                  height: 6,
                  borderRadius: 3,
                  width: `${progress.xpInLevel}%`,
                  backgroundColor: colors.primary,
                }}
              />
            </View>
          </Card>
        </>
      )}
      <SectionTitle title="Recent moments" />
      {sessions.length ? (
        sessions.slice(0, 4).map((s) => (
          <Card
            key={s.id}
            onPress={() => app.navigate("session-detail", { id: s.id })}
            style={{ marginBottom: 9, padding: 14 }}
          >
            <Row>
              <Petal size={48} />
              <View style={{ flex: 1 }}>
                <AppText
                  variant="heading"
                  style={{ fontSize: 22, lineHeight: 25 }}
                >
                  {s.title || "A moment for you"}
                </AppText>
                <AppText variant="caption" color={colors.muted}>
                  {dateLabel(s.createdAt)}
                  {s.feedback ? ` · ${s.feedback}` : ""}
                </AppText>
              </View>
            </Row>
          </Card>
        ))
      ) : (
        <Card style={{ marginBottom: 12 }}>
          <Petal size={56} />
          <AppText variant="heading" style={{ marginTop: 8 }}>
            A little time for yourself
          </AppText>
          <AppText
            color={colors.muted}
            style={{ marginTop: 5, marginBottom: 16 }}
          >
            Your completed moments and reflections will grow here, one small
            step at a time.
          </AppText>
          <Button
            title="Take your first moment"
            onPress={() => app.navigate("breathing")}
          />
        </Card>
      )}
      <MenuCard
        title="Reflections"
        description={`${app.data.reflections.length} saved ${app.data.reflections.length === 1 ? "reflection" : "reflections"}`}
        icon="create-outline"
        onPress={() => app.navigate("reflections")}
      />
      <MenuCard
        title="Saved affirmations"
        description="Kind words you've kept."
        icon="heart-outline"
        onPress={() => app.navigate("saved-affirmations")}
      />
      <MenuCard
        title="Assessments"
        description={`${app.data.assessments.length} completed ${app.data.assessments.length === 1 ? "check-in" : "check-ins"}`}
        icon="clipboard-outline"
        onPress={() => app.navigate("assessments")}
      />
    </Screen>
  );
}
