import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  View,
} from "react-native";
import { useApp } from "../store";
import { useTheme } from "../theme";
import {
  AppText,
  Button,
  Card,
  Icon,
  Input,
  Petal,
  Row,
  Screen,
  SectionTitle,
} from "../ui";
import { todayAffirmation, recordDay, participationProgress } from "../content";

const art = require("../../assets/botanical.png");
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
function Brand() {
  const app = useApp();
  const { colors } = useTheme();
  return (
    <Row style={{ justifyContent: "space-between", marginBottom: 24 }}>
      <Row>
        <Petal size={37} />
        <AppText variant="heading">Solace</AppText>
      </Row>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open profile"
        onPress={() => app.setTab("profile")}
        style={{
          width: 42,
          height: 42,
          borderRadius: 21,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
        }}
      >
        <Icon name="person-outline" size={20} />
      </Pressable>
    </Row>
  );
}
function HeroArt() {
  return (
    <Image
      source={art}
      resizeMode="contain"
      pointerEvents="none"
      style={{
        position: "absolute",
        width: 200,
        height: 200,
        right: -45,
        top: -35,
        opacity: 0.42,
      }}
    />
  );
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
    <Card onPress={onPress} style={{ marginBottom: 10, padding: 15 }}>
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
    </Card>
  );
}

export function AuthScreen() {
  const app = useApp();
  const { colors } = useTheme();
  const [page, setPage] = useState<"welcome" | "login" | "signup">("welcome");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  async function submit() {
    setNotice("");
    if (!email.trim() || !password || (page === "signup" && !name.trim())) {
      setNotice("Please complete each field.");
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
      <Screen>
        <View
          style={{
            minHeight: 620,
            justifyContent: "space-between",
            paddingBottom: 15,
          }}
        >
          <View>
            <Row style={{ marginBottom: 24 }}>
              <Petal size={37} />
              <AppText variant="heading">Solace</AppText>
            </Row>
            <AppText
              variant="display"
              style={{ marginTop: 22, fontSize: 52, lineHeight: 52 }}
            >
              A little space{`\n`}for you.
            </AppText>
            <AppText style={{ marginTop: 18, maxWidth: 340 }}>
              Solace is an AI wellness companion for the moments when you need a
              little calm and clarity.
            </AppText>
          </View>
          <View
            style={{
              alignItems: "center",
              justifyContent: "center",
              minHeight: 225,
            }}
          >
            <HeroArt />
            <Petal size={215} />
          </View>
          <View style={{ gap: 12 }}>
            <Button title="Get started" onPress={() => setPage("signup")} />
            <Button
              title="Log in"
              variant="secondary"
              onPress={() => setPage("login")}
            />
            <AppText
              variant="caption"
              color={colors.muted}
              style={{ textAlign: "center", marginTop: 5 }}
            >
              Your space, at your pace.
            </AppText>
          </View>
        </View>
      </Screen>
    );
  return (
    <Screen>
      <Pressable
        onPress={() => setPage("welcome")}
        accessibilityLabel="Back"
        style={{ alignSelf: "flex-start", marginBottom: 24 }}
      >
        <Icon name="arrow-back" size={24} />
      </Pressable>
      <Row>
        <Petal size={42} />
        <AppText variant="heading">Solace</AppText>
      </Row>
      <AppText variant="title" style={{ marginTop: 30 }}>
        {page === "signup" ? "Create your space" : "Welcome back"}
      </AppText>
      <AppText color={colors.muted} style={{ marginTop: 6, marginBottom: 25 }}>
        {page === "signup"
          ? "A gentle place to begin."
          : "Your space is here when you need it."}
      </AppText>
      <View style={{ gap: 14 }}>
        {page === "signup" && (
          <Input
            accessibilityLabel="Name"
            placeholder="Your name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        )}
        <Input
          accessibilityLabel="Email"
          placeholder="Email address"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Input
          accessibilityLabel="Password"
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        {page === "signup" && (
          <AppText variant="caption" color={colors.muted}>
            Use at least 8 characters for your password.
          </AppText>
        )}
        <AppText variant="caption" color={colors.muted}>
          By continuing, you acknowledge that Solace is an AI wellness companion
          and not a substitute for professional care.
        </AppText>
        {!!notice && <AppText color={colors.danger}>{notice}</AppText>}
        <Button
          title={page === "signup" ? "Create account" : "Log in"}
          onPress={submit}
          loading={app.busy}
        />
        <Button
          title={
            page === "signup"
              ? "Already have an account? Log in"
              : "New here? Create an account"
          }
          variant="ghost"
          onPress={() => {
            setPage(page === "signup" ? "login" : "signup");
            setNotice("");
          }}
        />
      </View>
    </Screen>
  );
}

export function TodayScreen() {
  const app = useApp();
  const { colors } = useTheme();
  const moods = ["Okay", "Calm", "Low", "Stressed", "Great"];
  const tones = [
    colors.peach,
    colors.accent,
    colors.lavender,
    "#D99554",
    "#9AA46B",
  ];
  const first = String(app.user?.name || "there").split(" ")[0];
  return (
    <Screen>
      <View>
        <HeroArt />
        <Brand />
        <AppText
          variant="title"
          style={{ fontSize: 43, lineHeight: 47, marginTop: 6 }}
        >
          Good to see you,{`\n`}
          {first}.
        </AppText>
        <AppText
          color={colors.muted}
          style={{ marginTop: 8, marginBottom: 24, maxWidth: 290 }}
        >
          A quieter, kinder space for your mind.
        </AppText>
      </View>
      <Card style={{ padding: 17, marginBottom: 16 }}>
        <AppText variant="heading">How are you feeling?</AppText>
        <Row style={{ justifyContent: "space-between", gap: 4, marginTop: 15 }}>
          {moods.map((m, i) => (
            <Pressable
              key={m}
              accessibilityRole="button"
              accessibilityLabel={`Check in: ${m}`}
              onPress={() => app.navigate("checkin", { mood: m })}
              style={{
                alignItems: "center",
                paddingVertical: 10,
                flex: 1,
                backgroundColor: colors.bg,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                marginHorizontal: 1,
              }}
            >
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 18,
                  backgroundColor: tones[i],
                  marginBottom: 7,
                }}
              />
              <AppText variant="caption" style={{ fontSize: 10 }}>
                {m}
              </AppText>
            </Pressable>
          ))}
        </Row>
      </Card>
      <Card
        style={{
          backgroundColor: colors.surface2,
          overflow: "hidden",
          marginBottom: 24,
        }}
      >
        <HeroArt />
        <View style={{ maxWidth: "76%" }}>
          <AppText variant="caption" style={{ letterSpacing: 1 }}>
            TODAY'S MOMENT
          </AppText>
          <AppText
            variant="title"
            style={{ fontSize: 34, lineHeight: 36, marginTop: 7 }}
          >
            Take a moment
          </AppText>
          <AppText style={{ marginTop: 7, marginBottom: 18 }}>
            A short, calming reset to find a little more ease.
          </AppText>
          <Button
            title="Start a Solace Moment"
            icon="arrow-forward"
            onPress={() => app.navigate("breathing")}
          />
        </View>
        <View style={{ position: "absolute", right: 8, bottom: 12 }}>
          <Petal size={85} />
        </View>
      </Card>
      <SectionTitle
        title="A little support"
        subtitle="Choose what feels right for you."
      />
      <MenuCard
        title="Talk with Solace"
        description="A thoughtful space to talk it through."
        icon="chatbubble-ellipses-outline"
        onPress={() => app.setTab("chat")}
      />
      <MenuCard
        title="Check-ins"
        description="Reflect on your mood and wellbeing."
        icon="clipboard-outline"
        onPress={() => app.navigate("assessments")}
      />
      <MenuCard
        title="Resources"
        description="Gentle tools and guided support."
        icon="book-outline"
        onPress={() => app.navigate("resources")}
      />
      <MenuCard
        title="Your wellness plan"
        description="Small steps for the days ahead."
        icon="calendar-outline"
        onPress={() => app.navigate("plan")}
      />
      <Card style={{ marginTop: 16, backgroundColor: colors.surface }}>
        <AppText
          variant="caption"
          color={colors.muted}
          style={{ letterSpacing: 1 }}
        >
          A THOUGHT FOR TODAY
        </AppText>
        <AppText variant="heading" style={{ marginTop: 8 }}>
          {todayAffirmation()}
        </AppText>
        <Pressable
          onPress={() => app.navigate("affirmation")}
          style={{ marginTop: 10 }}
        >
          <AppText variant="label">More affirmations →</AppText>
        </Pressable>
      </Card>
    </Screen>
  );
}

export function ChatScreen() {
  const app = useApp();
  const { colors } = useTheme();
  const [id, setId] = useState<string | undefined>(app.params?.id);
  const [input, setInput] = useState(String(app.params?.context || ""));
  const [pending, setPending] = useState("");
  const [failure, setFailure] = useState("");
  const [action, setAction] = useState<any>(null);
  const [provider, setProvider] = useState<string>("");
  useEffect(() => {
    setId(app.params?.id);
    setInput(String(app.params?.context || ""));
    setFailure("");
    setAction(null);
    setProvider("");
  }, [app.params?.id, app.params?.context]);
  const conversation = app.data.conversations.find((x) => x.id === id);
  const messages = Array.isArray(conversation?.messages)
    ? conversation?.messages
    : [];
  const lastAssistant = [...messages]
    .reverse()
    .find((m: any) => m.role === "assistant");
  const visibleAction = action || lastAssistant?.action;
  const visibleProvider = provider || lastAssistant?.provider;
  async function send() {
    const text = input.trim();
    if (!text || pending) return;
    setInput("");
    setPending(text);
    setFailure("");
    try {
      const result = await app.chat(text, id);
      setId(result.conversation.id);
      app.setParams({ id: result.conversation.id, context: "" });
      setAction(result.action || null);
      setProvider(result.provider || "");
    } catch (e) {
      setInput(text);
      setFailure(
        e instanceof Error ? e.message : "Could not send. Please try again.",
      );
    } finally {
      setPending("");
    }
  }
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen>
        <Row style={{ justifyContent: "space-between", marginBottom: 22 }}>
          <Row>
            <Petal size={36} />
            <AppText variant="heading">Solace</AppText>
          </Row>
          <Row>
            <Pressable
              accessibilityLabel="New conversation"
              accessibilityRole="button"
              onPress={() => {
                setId(undefined);
                app.setParams({ id: undefined, context: "" });
                setInput("");
                setAction(null);
                setProvider("");
              }}
              style={{ padding: 9 }}
            >
              <Icon name="add-circle-outline" size={24} />
            </Pressable>
            <Pressable
              accessibilityLabel="Conversation history"
              accessibilityRole="button"
              onPress={() => app.navigate("history")}
              style={{ padding: 9 }}
            >
              <Icon name="time-outline" size={24} />
            </Pressable>
          </Row>
        </Row>
        <AppText variant="title">Let's talk.</AppText>
        <AppText
          color={colors.muted}
          style={{ marginTop: 5, marginBottom: 20 }}
        >
          A little space for whatever is on your mind.
        </AppText>
        {messages.length === 0 && (
          <>
            <Row style={{ alignItems: "flex-start", marginBottom: 14 }}>
              <Petal size={40} />
              <Card style={{ flex: 1 }}>
                <AppText>
                  Hi there. I'm Solace. I'm here to listen and help you find a
                  little calm, whenever you need it.
                </AppText>
              </Card>
            </Row>
            <Card
              style={{ marginBottom: 14, backgroundColor: colors.surface2 }}
            >
              <AppText variant="heading">What would help right now?</AppText>
              <Row style={{ marginTop: 12, flexWrap: "wrap" }}>
                <Button
                  title="Talk it through"
                  variant="secondary"
                  onPress={() =>
                    setInput("I would like to talk about how I am feeling.")
                  }
                  style={{ flex: 1 }}
                />
                <Button
                  title="Take a pause"
                  variant="secondary"
                  onPress={() => app.navigate("breathing")}
                  style={{ flex: 1 }}
                />
              </Row>
            </Card>
          </>
        )}
        {messages.map((m: any, index: number) => (
          <View
            key={m.id || index}
            style={{
              alignItems: m.role === "user" ? "flex-end" : "flex-start",
              marginBottom: 10,
            }}
          >
            <Card
              style={{
                maxWidth: "90%",
                backgroundColor:
                  m.role === "user" ? colors.surface2 : colors.surface,
                borderBottomRightRadius: m.role === "user" ? 7 : 25,
                borderBottomLeftRadius: m.role === "assistant" ? 7 : 25,
              }}
            >
              <AppText>{m.content}</AppText>
            </Card>
          </View>
        ))}
        {!!pending && (
          <Card
            style={{
              alignSelf: "flex-end",
              marginBottom: 10,
              backgroundColor: colors.surface2,
            }}
          >
            <AppText>{pending}</AppText>
          </Card>
        )}
        {!!pending && (
          <AppText color={colors.muted} style={{ marginBottom: 14 }}>
            Solace is thinking…
          </AppText>
        )}
        {visibleProvider === "offline" && (
          <AppText
            variant="caption"
            color={colors.muted}
            style={{ marginBottom: 12 }}
          >
            This message uses built-in support guidance rather than live AI.
          </AppText>
        )}
        {!!visibleAction && (
          <Card style={{ marginBottom: 14, backgroundColor: colors.surface2 }}>
            <AppText variant="caption">A GENTLE SUGGESTION</AppText>
            <AppText variant="heading" style={{ marginVertical: 8 }}>
              {visibleAction.label}
            </AppText>
            <Button
              title="Begin"
              onPress={() =>
                app.navigate(
                  visibleAction.type === "reflection"
                    ? "reflection"
                    : "breathing",
                  { source: "chat", conversationId: id },
                )
              }
            />
          </Card>
        )}
        {!!failure && (
          <AppText color={colors.danger} style={{ marginVertical: 8 }}>
            {failure}
          </AppText>
        )}
        <Row style={{ alignItems: "flex-end", marginTop: 8 }}>
          <Input
            accessibilityLabel="Message Solace"
            placeholder="Message Solace..."
            value={input}
            onChangeText={setInput}
            multiline
            style={{ flex: 1, minHeight: 52, maxHeight: 130 }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send message"
            onPress={send}
            disabled={!input.trim() || !!pending}
            style={{
              height: 50,
              width: 50,
              borderRadius: 25,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.primary,
              opacity: input.trim() ? 1 : 0.6,
            }}
          >
            <Icon name="send-outline" color={colors.primaryText} />
          </Pressable>
        </Row>
        <Pressable
          onPress={() => app.navigate("support")}
          style={{ alignSelf: "center", padding: 12 }}
        >
          <AppText variant="caption" color={colors.muted}>
            Need human support?
          </AppText>
        </Pressable>
      </Screen>
    </KeyboardAvoidingView>
  );
}

export function HistoryScreen() {
  const app = useApp();
  const { colors } = useTheme();
  const conversations = [...app.data.conversations].sort((a, b) =>
    String(b.updatedAt || b.createdAt).localeCompare(
      String(a.updatedAt || a.createdAt),
    ),
  );
  return (
    <Screen>
      <Row style={{ marginBottom: 20 }}>
        <Pressable
          onPress={app.back}
          accessibilityLabel="Go back"
          style={{ padding: 8 }}
        >
          <Icon name="arrow-back" />
        </Pressable>
        <Petal size={32} />
        <AppText variant="heading">Solace</AppText>
      </Row>
      <AppText variant="title">Your conversations</AppText>
      <AppText color={colors.muted} style={{ marginVertical: 12 }}>
        A private space for your thoughts and moments with Solace.
      </AppText>
      <Button
        title="New conversation"
        icon="add"
        onPress={() => app.navigate("chat")}
        style={{ marginVertical: 14 }}
      />
      {conversations.length === 0 ? (
        <Card>
          <AppText>
            No conversations yet. Start one whenever you're ready.
          </AppText>
        </Card>
      ) : (
        conversations.map((c) => (
          <Card key={c.id} style={{ marginBottom: 10 }}>
            <Row>
              <Pressable
                accessibilityRole="button"
                onPress={() => app.navigate("chat", { id: c.id })}
                style={{ flex: 1 }}
              >
                <AppText variant="heading" style={{ fontSize: 24 }}>
                  {c.title || "A conversation"}
                </AppText>
                <AppText
                  variant="caption"
                  color={colors.muted}
                  style={{ marginTop: 3 }}
                >
                  {dateLabel(c.updatedAt || c.createdAt)}
                </AppText>
                <AppText numberOfLines={2} style={{ marginTop: 6 }}>
                  {c.messages?.at(-1)?.content || "Continue your conversation"}
                </AppText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete ${c.title || "conversation"}`}
                onPress={() =>
                  confirmAction(
                    "Delete conversation?",
                    "This removes the conversation and its linked memories.",
                    () => {
                      app
                        .remove("conversations", String(c.id))
                        .catch((e) =>
                          Alert.alert("Unable to delete", e.message),
                        );
                    },
                  )
                }
                style={{ padding: 10 }}
              >
                <Icon name="trash-outline" size={20} color={colors.muted} />
              </Pressable>
            </Row>
          </Card>
        ))
      )}
    </Screen>
  );
}

export function JourneyScreen() {
  const app = useApp();
  const { colors } = useTheme();
  const progress = participationProgress(app.data);
  const checkins = [...app.data.checkins].sort((a, b) =>
    String(b.createdAt).localeCompare(String(a.createdAt)),
  );
  const sessions = [...app.data.sessions].sort((a, b) =>
    String(b.createdAt).localeCompare(String(a.createdAt)),
  );
  const count = progress.checkinsThisWeek;
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
      <HeroArt />
      <Brand />
      <AppText variant="title">Your journey</AppText>
      <AppText
        color={colors.muted}
        style={{ marginVertical: 8, marginBottom: 20 }}
      >
        A gentle look at your check-ins and the moments you've taken for
        yourself.
      </AppText>
      <Row style={{ marginBottom: 16 }}>
        <Card
          style={{ flex: 1, backgroundColor: colors.surface2, padding: 14 }}
        >
          <Icon name="leaf-outline" />
          <AppText variant="heading" style={{ marginTop: 4 }}>
            {count} check-ins
          </AppText>
          <AppText variant="caption">in the last 7 days</AppText>
        </Card>
        <Card style={{ flex: 1, padding: 14 }}>
          <Icon name="flower-outline" />
          <AppText variant="heading" style={{ marginTop: 4 }}>
            {progress.completedMoments} moments
          </AppText>
          <AppText variant="caption">completed</AppText>
        </Card>
      </Row>
      <Card style={{ marginBottom: 22, padding: 16 }}>
        <AppText variant="heading">Your last 7 days</AppText>
        <AppText variant="caption" color={colors.muted}>
          Your check-ins, at a glance.
        </AppText>
        <Row style={{ justifyContent: "space-between", gap: 1, marginTop: 14 }}>
          {days.map((d, i) => (
            <View key={i} style={{ alignItems: "center", flex: 1 }}>
              <View
                style={{
                  width: 25,
                  height: 25,
                  borderRadius: 16,
                  backgroundColor: d.record ? colors.accent : colors.border,
                  marginBottom: 5,
                }}
              />
              <AppText variant="caption" style={{ fontSize: 10 }}>
                {d.label}
              </AppText>
              <AppText
                variant="caption"
                color={colors.muted}
                style={{ fontSize: 9 }}
              >
                {d.record?.mood || "—"}
              </AppText>
            </View>
          ))}
        </Row>
      </Card>
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
              name={m.earned ? "checkmark-circle-outline" : "flower-outline"}
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
          <AppText color={colors.muted}>
            Your completed moments will appear here.
          </AppText>
        </Card>
      )}
      <MenuCard
        title="Reflections"
        description={`${app.data.reflections.length} saved reflections`}
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
        description={`${app.data.assessments.length} completed check-ins`}
        icon="clipboard-outline"
        onPress={() => app.navigate("assessments")}
      />
      <MenuCard
        title="Your wellness plan"
        description="Small steps, at your own pace."
        icon="calendar-outline"
        onPress={() => app.navigate("plan")}
      />
      <MenuCard
        title="Daily challenge"
        description="Try a small, gentle action."
        icon="sparkles-outline"
        onPress={() => app.navigate("challenge")}
      />
    </Screen>
  );
}
