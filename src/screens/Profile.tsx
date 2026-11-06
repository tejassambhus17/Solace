import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Switch,
  Pressable,
  Platform,
  ScrollView,
  Linking,
  Share,
  Image,
} from "react-native";
import Constants from "expo-constants";
import { useTheme } from "../theme";
import { useApp } from "../store";
import { chooseProfilePhoto } from "../photos";
import { useReducedMotion } from "../Companion";
import {
  Screen,
  AppText,
  Card,
  Button,
  Input,
  Row,
  Icon,
  SectionTitle,
} from "../ui";
import {
  scheduleReminder,
  cancelReminders,
  cancelAllReminders,
  testNotification,
  deviceReminderIds,
  rememberDeviceSchedule,
} from "../notifications";
import ProfileHome from "./ProfileHome";

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const memoryCategories = [
  ["preference", "Preference"],
  ["activity", "Activities"],
  ["goal", "Wellness goal"],
  ["context", "Approved context"],
] as const;
const kinds = [
  ["checkin", "Check-in"],
  ["affirmation", "Affirmation"],
  ["breathing", "Breathing"],
  ["selfcare", "Self-care"],
  ["custom", "Custom"],
];
function MenuRow({
  title,
  subtitle,
  icon,
  onPress,
  tone = "lavender",
}: {
  title: string;
  subtitle?: string;
  icon: string;
  onPress: () => void;
  tone?: "lavender" | "peach" | "sage";
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: 18,
        borderBottomWidth: 0.75,
        borderBottomColor: colors.border,
        opacity: pressed ? 0.65 : 1,
      })}
    >
      <Row>
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 23,
            backgroundColor: colors[`${tone}Surface`],
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={icon} size={22} color={colors[`${tone}Text`]} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="heading" style={{ fontSize: 25, lineHeight: 28 }}>
            {title}
          </AppText>
          {subtitle && (
            <AppText
              variant="caption"
              color={colors.muted}
              style={{ marginTop: 4, fontSize: 13, lineHeight: 19 }}
            >
              {subtitle}
            </AppText>
          )}
        </View>
        <Icon name="chevron-forward" size={18} color={colors.muted} />
      </Row>
    </Pressable>
  );
}
function Notice({ text, error = false }: { text: string; error?: boolean }) {
  const { colors } = useTheme();
  return text ? (
    <AppText
      accessibilityLiveRegion="polite"
      color={error ? colors.danger : colors.muted}
      style={{ marginVertical: 12 }}
    >
      {text}
    </AppText>
  ) : null;
}

export default function ProfileScreen({ name }: { name: string }) {
  const app = useApp();
  const { colors, mode, setMode, resolved } = useTheme();
  const privacyOnly = name === "account" && app.params?.section === "privacy";
  const routeIdentity = privacyOnly ? "privacy" : name;
  const [message, setMessageState] = useState("");
  const [error, setErrorState] = useState("");
  const currentRoute = useRef(routeIdentity);
  currentRoute.current = routeIdentity;
  const operationLock = useRef(false);
  // Late responses from a screen we left must not announce success on another screen.
  const setMessage = (value: string) => {
    if (currentRoute.current === routeIdentity) setMessageState(value);
  };
  const setError = (value: string) => {
    if (currentRoute.current === routeIdentity) setErrorState(value);
  };
  const [pending, setPending] = useState(false);
  const [preference, setPreference] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [memoryCategory, setMemoryCategory] = useState("preference");
  const [memorySource, setMemorySource] = useState<{
    sourceType?: "session" | "conversation";
    sourceId?: string;
    sourceConversationId?: string;
  }>({});
  const [clearMemories, setClearMemories] = useState(false);
  const prefillIdentity = useRef("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [accountName, setAccountName] = useState(app.user?.name || "");
  const [deleteAccount, setDeleteAccount] = useState(false);
  const [photoAction, setPhotoAction] = useState("");
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [discardWriteId, setDiscardWriteId] = useState<string | null>(null);
  const accountIdentity = useRef(app.user?.id);
  accountIdentity.current = app.user?.id;
  const [reminderType, setReminderType] = useState("checkin");
  const [reminderTitle, setReminderTitle] = useState("");
  const [time, setTime] = useState("2000");
  const [selectedDays, setDays] = useState([1, 2, 3, 4, 5]);
  const [enabled, setEnabled] = useState(true);
  const [reminderId, setReminderId] = useState<string | null>(null);
  const [reminderStatusLocation, setReminderStatusLocation] = useState<
    "form" | "list"
  >("form");
  const reminderScroll = useRef<React.ElementRef<typeof ScrollView>>(null);
  const reducedMotion = useReducedMotion();
  const [country, setCountry] = useState("");
  useEffect(() => {
    setMessage("");
    setError("");
    setDeleteId(null);
    setClearMemories(false);
    setDeleteAccount(false);
    setLogoutConfirm(false);
    setDiscardWriteId(null);
  }, [routeIdentity]);
  useEffect(() => {
    const suggested = app.params?.suggestedPreference;
    const sourceType = app.params?.sourceType;
    const sourceId = app.params?.sourceId;
    if (name !== "memory" || typeof suggested !== "string" || !suggested.trim())
      return;
    const identity = `${app.user?.id}:${sourceType}:${sourceId}:${suggested}`;
    if (prefillIdentity.current === identity) return;
    prefillIdentity.current = identity;
    setEditing(null);
    setPreference(suggested.slice(0, 500));
    setMemoryCategory("activity");
    setMemorySource(
      (sourceType === "session" || sourceType === "conversation") &&
        typeof sourceId === "string"
        ? { sourceType, sourceId }
        : {},
    );
  }, [
    name,
    app.params?.suggestedPreference,
    app.params?.sourceType,
    app.params?.sourceId,
    app.user?.id,
  ]);
  async function perform(work: () => Promise<void>) {
    if (operationLock.current) return;
    operationLock.current = true;
    setPending(true);
    setError("");
    setMessage("");
    try {
      await work();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save. Please try again.",
      );
    } finally {
      operationLock.current = false;
      setPending(false);
    }
  }
  async function changePhoto() {
    const owner = app.user?.id;
    await perform(async () => {
      setPhotoAction("choosing");
      try {
        const avatar = await chooseProfilePhoto();
        if (!avatar) return;
        if (
          currentRoute.current !== "account" ||
          accountIdentity.current !== owner
        )
          return;
        setPhotoAction("saving");
        await app.updateUser({ avatar });
        setMessage("Profile photo updated.");
      } finally {
        setPhotoAction("");
      }
    });
  }
  const status = (
    <>
      <Notice text={error} error />
      <Notice text={message} />
    </>
  );
  const heading = (title: string, subtitle?: string) => (
    <View style={{ marginBottom: 22 }}>
      <AppText variant="display">{title}</AppText>
      {subtitle && (
        <AppText color={colors.muted} style={{ marginTop: 10 }}>
          {subtitle}
        </AppText>
      )}
    </View>
  );
  function resetReminder() {
    setReminderId(null);
    setReminderType("checkin");
    setReminderTitle("");
    setTime("2000");
    setDays([1, 2, 3, 4, 5]);
    setEnabled(true);
  }

  if (name === "profile") return <ProfileHome />;

  if (name === "settings")
    return (
      <Screen title="Settings" back={app.back}>
        {heading(
          "Make it yours",
          "Choose how Solace looks and what it remembers.",
        )}
        <SectionTitle title="Appearance" />
        <Row style={{ marginBottom: 25 }}>
          {(["light", "dark", "system"] as const).map((v) => (
            <Pressable
              key={v}
              accessibilityRole="radio"
              accessibilityLabel={`${v.charAt(0).toUpperCase() + v.slice(1)} appearance`}
              accessibilityState={{ checked: mode === v }}
              aria-checked={mode === v}
              onPress={() => setMode(v)}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 70,
                paddingHorizontal: 8,
                paddingVertical: 12,
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: mode === v ? colors.primary : colors.border,
                backgroundColor: mode === v ? colors.primary : colors.surface,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Icon
                name={
                  v === "light"
                    ? "sunny-outline"
                    : v === "dark"
                      ? "moon-outline"
                      : "phone-portrait-outline"
                }
                size={21}
                color={mode === v ? colors.primaryText : colors.text}
              />
              <AppText
                variant="label"
                color={mode === v ? colors.primaryText : colors.text}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </AppText>
            </Pressable>
          ))}
        </Row>
        <Card style={{ marginBottom: 16 }}>
          <AppText variant="heading">Sound and accessibility</AppText>
          <AppText color={colors.muted} style={{ marginTop: 7 }}>
            Ambient sound is optional in each Solace Moment. Use your device
            settings to adjust text size, Reduce Motion, and system haptics.
          </AppText>
          <Button
            title="Open Solace Moments"
            variant="ghost"
            icon="sparkles-outline"
            onPress={() => app.navigate("moments")}
            style={{ marginTop: 7 }}
          />
        </Card>
        <Card style={{ marginBottom: 16 }}>
          <Row>
            <View style={{ flex: 1 }}>
              <AppText variant="label">Use approved preferences</AppText>
              <AppText variant="caption">
                When enabled, Solace can use recent check-ins and the
                preferences you explicitly save.
              </AppText>
            </View>
            <Switch
              accessibilityLabel="Use approved preferences"
              value={!!app.user?.personalization}
              disabled={pending}
              onValueChange={(value) =>
                perform(async () => {
                  await app.updateUser({ personalization: value });
                  setMessage(
                    value
                      ? "Personalization enabled."
                      : "Personalization disabled. Saved preferences remain available to manage.",
                  );
                })
              }
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={
                app.user?.personalization ? colors.primaryText : colors.muted
              }
              ios_backgroundColor={colors.surface2}
            />
          </Row>
        </Card>
        <MenuRow
          title="Manage memories"
          subtitle="Review or delete each preference"
          icon="leaf-outline"
          onPress={() => app.navigate("memory")}
        />
        <MenuRow
          title="Reminders"
          icon="notifications-outline"
          onPress={() => app.navigate("reminders")}
        />
        <MenuRow
          title="Privacy & data"
          subtitle="Export data or delete your account"
          icon="shield-checkmark-outline"
          onPress={() => app.navigate("account", { section: "privacy" })}
        />
        <MenuRow
          title="About Solace"
          subtitle="Learn more about the app, purpose, and safety"
          icon="information-circle-outline"
          onPress={() => app.navigate("about")}
        />
        {status}
      </Screen>
    );

  if (name === "about")
    return (
      <Screen title="About Solace" back={app.back}>
        {heading(
          "A calmer place to pause",
          "Check in, talk, and take one small step toward everyday wellbeing.",
        )}
        {Constants.expoConfig?.version && (
          <AppText
            color={colors.muted}
            variant="caption"
            style={{ marginBottom: 14 }}
          >
            Version {Constants.expoConfig.version}
          </AppText>
        )}
        <Card style={{ marginBottom: 14 }}>
          <AppText variant="heading">Wellness and safety</AppText>
          <AppText style={{ marginTop: 8 }}>
            Solace is an AI wellness companion for everyday reflection and
            self-care. It is not a medical or emergency service and cannot
            provide diagnosis, treatment, or emergency care.
          </AppText>
          <AppText color={colors.muted} style={{ marginTop: 10 }}>
            If you are in immediate danger, contact your local emergency
            services or go to the nearest emergency department.
          </AppText>
          <Button
            title="Find human support"
            variant="secondary"
            icon="heart-outline"
            onPress={() => app.navigate("support")}
            style={{ marginTop: 14 }}
          />
        </Card>
        <Card>
          <AppText variant="heading">How conversations work</AppText>
          <AppText color={colors.muted} style={{ marginTop: 8 }}>
            Your messages are processed by the server. When live AI is
            configured, your conversation and relevant consented context are
            sent to the configured provider. Avoid sharing information you do
            not want processed.
          </AppText>
          <Button
            title="Privacy & data"
            variant="ghost"
            icon="lock-closed-outline"
            onPress={() => app.navigate("account", { section: "privacy" })}
            style={{ marginTop: 8 }}
          />
        </Card>
      </Screen>
    );

  if (name === "memory") {
    const sourceFor = (item: Record<string, any>) => {
      const session =
        item.sourceType === "session"
          ? app.data.sessions.find((record) => record.id === item.sourceId)
          : undefined;
      const conversation =
        item.sourceType === "conversation" || item.sourceConversationId
          ? app.data.conversations.find(
              (record) =>
                record.id === (item.sourceConversationId || item.sourceId),
            )
          : undefined;
      return session
        ? {
            label: `Saved after ${session.title || session.activity?.title || "a Moment"}`,
            route: "session-detail",
            id: session.id,
          }
        : conversation
          ? {
              label: `From ${conversation.title || "a conversation you approved"}`,
              route: "chat",
              id: conversation.id,
            }
          : null;
    };
    return (
      <Screen title="What Solace remembers" back={app.back}>
        {heading(
          "A little context. Your choice.",
          "Only preferences you explicitly save belong here. You can correct them, remove them, or turn personalization off.",
        )}
        <Card style={{ marginBottom: 22 }}>
          <Row>
            <View style={{ flex: 1 }}>
              <AppText variant="label">Use my approved preferences</AppText>
              <AppText
                variant="caption"
                color={colors.muted}
                style={{ marginTop: 5 }}
              >
                {app.user?.personalization
                  ? "Approved preferences may shape conversations and Moments. Suggestions name the preferences they use."
                  : "Personalization is off. Saved preferences are kept for you but excluded from new personalized suggestions."}
              </AppText>
            </View>
            <Switch
              value={!!app.user?.personalization}
              accessibilityLabel="Personalization"
              disabled={pending}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={
                app.user?.personalization ? colors.primaryText : colors.muted
              }
              ios_backgroundColor={colors.surface2}
              onValueChange={(value) =>
                perform(async () => {
                  await app.updateUser({ personalization: value });
                  setMessage(
                    value
                      ? "Personalization enabled. Only approved context is used."
                      : "Personalization disabled for new suggestions and conversations.",
                  );
                })
              }
            />
          </Row>
          <AppText
            variant="caption"
            color={colors.muted}
            style={{ marginTop: 14 }}
          >
            Editing or removing a preference, or turning personalization off,
            resets the context used for future AI replies. Your saved history
            stays visible.
          </AppText>
        </Card>
        <SectionTitle
          title="Saved preferences"
          subtitle={`${app.data.memories.length} ${app.data.memories.length === 1 ? "preference" : "preferences"} you control`}
        />
        {app.data.memories.length === 0 && (
          <View style={{ paddingVertical: 16, gap: 8 }}>
            <Icon name="leaf-outline" color={colors.muted} size={29} />
            <AppText>No saved preferences yet.</AppText>
            <AppText color={colors.muted}>
              Try a simple preference, such as short breathing sessions or a
              quieter environment. Solace never invents memories.
            </AppText>
          </View>
        )}
        {app.data.memories.map((item) => {
          const source = sourceFor(item);
          return (
            <View
              key={item.id}
              style={{
                paddingVertical: 18,
                borderBottomWidth: 0.75,
                borderBottomColor: colors.border,
              }}
            >
              <Row
                style={{
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                  gap: 6,
                }}
              >
                <AppText variant="caption" color={colors.muted}>
                  {memoryCategories.find(
                    ([value]) => value === item.category,
                  )?.[1] || "Preference"}
                </AppText>
                <AppText variant="caption" color={colors.muted}>
                  {item.approved === false
                    ? "Not approved · not used"
                    : app.user?.personalization
                      ? "Approved"
                      : "Saved · personalization off"}
                </AppText>
              </Row>
              <AppText style={{ marginTop: 7 }}>
                {item.text || item.content || item.value}
              </AppText>
              <AppText
                variant="caption"
                color={colors.muted}
                style={{ marginTop: 8 }}
              >
                {source?.label ||
                  (item.sourceType || item.sourceConversationId
                    ? "Source no longer available"
                    : "Added directly by you")}
              </AppText>
              <Row style={{ marginTop: 8, flexWrap: "wrap", gap: 5 }}>
                <Button
                  title="Edit"
                  variant="ghost"
                  disabled={pending}
                  onPress={() => {
                    setEditing(item.id!);
                    setPreference(
                      item.text || item.content || item.value || "",
                    );
                    setMemoryCategory(item.category || "preference");
                    setMemorySource({
                      ...(item.sourceType
                        ? { sourceType: item.sourceType }
                        : {}),
                      ...(item.sourceId ? { sourceId: item.sourceId } : {}),
                      ...(item.sourceConversationId
                        ? { sourceConversationId: item.sourceConversationId }
                        : {}),
                    });
                  }}
                />
                <Button
                  title="Delete"
                  variant="ghost"
                  disabled={pending}
                  onPress={() => setDeleteId(item.id!)}
                />
                {source && (
                  <Button
                    title="View source"
                    variant="ghost"
                    disabled={pending}
                    onPress={() =>
                      app.navigate(source.route, { id: source.id })
                    }
                  />
                )}
                {item.approved === false && (
                  <Button
                    title="Approve"
                    variant="ghost"
                    disabled={pending}
                    onPress={() =>
                      perform(async () => {
                        await app.save("memories", { ...item, approved: true });
                        setMessage(
                          "Preference approved. It is used only when personalization is enabled.",
                        );
                      })
                    }
                  />
                )}
              </Row>
              {deleteId === item.id && (
                <View style={{ marginTop: 12, gap: 10 }}>
                  <AppText>
                    Remove this saved preference from future personalization?
                    The source activity or conversation stays in your history.
                  </AppText>
                  <Row style={{ flexWrap: "wrap" }}>
                    <Button
                      title="Keep"
                      variant="secondary"
                      disabled={pending}
                      onPress={() => setDeleteId(null)}
                    />
                    <Button
                      title="Remove preference"
                      disabled={pending}
                      onPress={() =>
                        perform(async () => {
                          await app.remove("memories", item.id!);
                          setDeleteId(null);
                          if (editing === item.id) {
                            setEditing(null);
                            setPreference("");
                            setMemorySource({});
                          }
                          setMessage(
                            "Preference removed from active personalization. Previously saved conversations and Moment instructions remain in your history.",
                          );
                        })
                      }
                    />
                  </Row>
                </View>
              )}
            </View>
          );
        })}
        <View style={{ marginTop: 28 }}>
          <SectionTitle
            title={editing ? "Correct this preference" : "Add a preference"}
            subtitle="Keep it general. Share only the context you want processed."
          />
          <Row style={{ flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {memoryCategories.map(([category, label]) => (
              <Pressable
                key={category}
                accessibilityRole="button"
                accessibilityLabel={`Memory category: ${label}`}
                accessibilityState={{ selected: memoryCategory === category }}
                disabled={pending}
                onPress={() => setMemoryCategory(category)}
                style={{
                  minHeight: 44,
                  borderRadius: 22,
                  justifyContent: "center",
                  paddingHorizontal: 14,
                  backgroundColor:
                    memoryCategory === category
                      ? colors.primary
                      : colors.surface2,
                }}
              >
                <AppText
                  variant="caption"
                  color={
                    memoryCategory === category
                      ? colors.primaryText
                      : colors.text
                  }
                >
                  {label}
                </AppText>
              </Pressable>
            ))}
          </Row>
          {!!memorySource.sourceId && (
            <AppText
              variant="caption"
              color={colors.muted}
              style={{ marginBottom: 10 }}
            >
              Linked to the{" "}
              {memorySource.sourceType === "session"
                ? "Moment"
                : "conversation"}{" "}
              you chose. Review the wording before saving.
            </AppText>
          )}
          <Input
            accessibilityLabel="Preference"
            placeholder="For example: I prefer short grounding exercises"
            multiline
            value={preference}
            onChangeText={setPreference}
            maxLength={500}
            editable={!pending}
            style={{ marginBottom: 12 }}
          />
          <AppText
            variant="caption"
            color={colors.muted}
            style={{ marginBottom: 14 }}
          >
            Saving explicitly approves this preference. It influences
            suggestions only while personalization is enabled.
          </AppText>
          <Button
            title={editing ? "Save changes" : "Save preference"}
            disabled={!preference.trim() || pending}
            onPress={() =>
              perform(async () => {
                const existing = editing
                  ? app.data.memories.find((item) => item.id === editing)
                  : undefined;
                await app.save("memories", {
                  ...existing,
                  ...memorySource,
                  ...(editing ? { id: editing } : {}),
                  text: preference.trim(),
                  category: memoryCategory,
                  approved: true,
                });
                setEditing(null);
                setPreference("");
                setMemorySource({});
                setMemoryCategory("preference");
                setMessage(
                  "Preference saved. You can change or remove it whenever you like.",
                );
              })
            }
          />
          {(editing || memorySource.sourceId) && (
            <Button
              title={editing ? "Cancel edit" : "Clear suggestion"}
              variant="ghost"
              disabled={pending}
              onPress={() => {
                setEditing(null);
                setPreference("");
                setMemorySource({});
                setMemoryCategory("preference");
              }}
            />
          )}
        </View>
        {app.data.memories.length > 0 && (
          <View
            style={{
              marginTop: 30,
              paddingTop: 20,
              borderTopWidth: 0.75,
              borderTopColor: colors.border,
            }}
          >
            {!clearMemories ? (
              <Button
                title="Clear all saved preferences…"
                variant="ghost"
                disabled={pending}
                onPress={() => setClearMemories(true)}
              />
            ) : (
              <View style={{ gap: 13 }}>
                <AppText variant="label">Clear all saved preferences?</AppText>
                <AppText>
                  They will be removed from active personalization. Your
                  conversation and activity history stays saved. This cannot be
                  undone.
                </AppText>
                <Row style={{ flexWrap: "wrap" }}>
                  <Button
                    title="Keep preferences"
                    variant="secondary"
                    disabled={pending}
                    onPress={() => setClearMemories(false)}
                  />
                  <Button
                    title="Clear preferences"
                    disabled={pending}
                    onPress={() =>
                      perform(async () => {
                        const ids = app.data.memories.map((item) => item.id!);
                        try {
                          for (const id of ids)
                            await app.remove("memories", id);
                        } catch {
                          throw new Error(
                            "Some preferences could not be removed. Successfully removed preferences stay removed. Review the remaining list and try again.",
                          );
                        }
                        setClearMemories(false);
                        setEditing(null);
                        setPreference("");
                        setMemorySource({});
                        setMessage(
                          "All saved preferences were removed from active personalization. Previously saved conversations and activities remain in your history.",
                        );
                      })
                    }
                  />
                </Row>
              </View>
            )}
          </View>
        )}
        {status}
      </Screen>
    );
  }

  if (name === "reminders")
    return (
      <Screen
        title="Gentle reminders"
        back={app.back}
        scrollRef={reminderScroll}
      >
        {heading(
          reminderId ? "Edit reminder" : "A moment, on your terms",
          "Choose when a small pause fits your day. Lock screen previews use a generic message.",
        )}
        <Card style={{ marginBottom: 18 }}>
          <Row>
            <View style={{ flex: 1 }}>
              <AppText variant="label">Enable reminder</AppText>
              <AppText variant="caption">
                {Platform.OS === "web"
                  ? "Save a schedule for the mobile app."
                  : "Use the schedule below on this device."}
              </AppText>
            </View>
            <Switch
              accessibilityLabel="Enable reminder"
              value={enabled}
              disabled={pending}
              onValueChange={setEnabled}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={enabled ? colors.primaryText : colors.muted}
              ios_backgroundColor={colors.surface2}
            />
          </Row>
        </Card>
        <SectionTitle title="Reminder type" />
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 18,
          }}
        >
          {kinds.map(([key, label]) => (
            <Button
              key={key}
              title={label}
              variant={reminderType === key ? "primary" : "secondary"}
              disabled={pending}
              onPress={() => setReminderType(key)}
            />
          ))}
        </View>
        {reminderType === "custom" && (
          <Input
            accessibilityLabel="Custom reminder title"
            placeholder="What would you like to remember?"
            value={reminderTitle}
            editable={!pending}
            onChangeText={setReminderTitle}
            maxLength={100}
            style={{ marginBottom: 15 }}
          />
        )}
        <AppText variant="label">Time in your device’s time zone</AppText>
        <AppText
          variant="caption"
          color={colors.muted}
          style={{ marginTop: 4 }}
        >
          Use four digits in 24-hour time, such as 0830 or 2000.
        </AppText>
        <Input
          accessibilityLabel="Reminder time, four digits in 24-hour time"
          placeholder="2000"
          value={time}
          editable={!pending}
          onChangeText={(value) =>
            setTime(value.replace(/\D/g, "").slice(0, 4))
          }
          keyboardType="number-pad"
          maxLength={5}
          style={{ marginTop: 8, marginBottom: 18 }}
        />
        <SectionTitle title="Repeat on" />
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 7,
            marginBottom: 18,
          }}
        >
          {days.map((d, i) => (
            <Pressable
              key={d}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selectedDays.includes(i) }}
              aria-checked={selectedDays.includes(i)}
              accessibilityLabel={d}
              disabled={pending}
              onPress={() =>
                setDays((previous) =>
                  previous.includes(i)
                    ? previous.filter((x) => x !== i)
                    : [...previous, i],
                )
              }
              style={{
                minWidth: 44,
                minHeight: 48,
                padding: 10,
                borderRadius: 15,
                backgroundColor: selectedDays.includes(i)
                  ? colors.primary
                  : colors.surface2,
                justifyContent: "center",
              }}
            >
              <AppText
                color={
                  selectedDays.includes(i) ? colors.primaryText : colors.text
                }
                variant="caption"
              >
                {d}
              </AppText>
            </Pressable>
          ))}
        </View>
        {Platform.OS === "web" && (
          <Notice text="This web preview saves preferences. Notification scheduling and delivery require the Android or iOS app." />
        )}
        <Button
          title={reminderId ? "Update reminder" : "Save reminder"}
          loading={pending}
          onPress={() => {
            setReminderStatusLocation("form");
            return perform(async () => {
              if (!/^([01]\d|2[0-3])[0-5]\d$/.test(time))
                throw new Error(
                  "Enter four digits in 24-hour time, such as 0830 or 2000.",
                );
              if (!selectedDays.length)
                throw new Error("Choose at least one day.");
              if (reminderType === "custom" && !reminderTitle.trim())
                throw new Error("Add a title for your custom reminder.");
              const record = {
                type: reminderType,
                title:
                  reminderType === "custom"
                    ? reminderTitle.trim()
                    : kinds.find((k) => k[0] === reminderType)![1],
                hour: Number(time.slice(0, 2)),
                minute: Number(time.slice(2)),
                days: [...selectedDays].sort((a, b) => a - b),
                enabled,
              };
              const owner = String(app.user?.id);
              const previousIds =
                reminderId && Platform.OS !== "web"
                  ? await deviceReminderIds(owner, reminderId)
                  : [];
              const result = await scheduleReminder(record);
              let saved;
              try {
                saved = await app.save("reminders", {
                  ...(reminderId ? { id: reminderId } : {}),
                  ...record,
                  notificationIds: result.ids,
                  permission: result.permission,
                });
              } catch (e) {
                try {
                  await cancelReminders(result.ids);
                } catch {
                  throw new Error(
                    "Solace couldn’t confirm the save or cancel the new device alerts. Restart Solace to refresh your reminder schedule.",
                  );
                }
                throw e;
              }
              resetReminder();
              if (Platform.OS !== "web") {
                const id = String(saved.id);
                try {
                  await rememberDeviceSchedule(owner, id, [
                    ...previousIds,
                    ...result.ids,
                  ]);
                  if (previousIds.length) {
                    await cancelReminders(previousIds);
                    await rememberDeviceSchedule(owner, id, result.ids);
                  }
                } catch {
                  setMessage(
                    "Preferences saved. Solace couldn’t verify the device schedule. Restart Solace to refresh your alerts.",
                  );
                  return;
                }
              }
              setMessage(
                Platform.OS === "web"
                  ? "Preferences saved. Open the mobile app to schedule delivery."
                  : enabled
                    ? "Reminder scheduled on this device."
                    : "Reminder disabled.",
              );
            });
          }}
        />
        {reminderId && (
          <Button
            title="Cancel editing"
            variant="ghost"
            disabled={pending}
            onPress={() => {
              resetReminder();
              setError("");
              setMessage("");
            }}
          />
        )}
        <Button
          title="Send a test in 10 seconds"
          variant="ghost"
          disabled={pending || Platform.OS === "web"}
          onPress={() => {
            setReminderStatusLocation("form");
            return perform(async () => {
              await testNotification();
              setMessage(
                "Test scheduled. Close the app normally and tap the notification when it arrives.",
              );
            });
          }}
        />
        {reminderStatusLocation === "form" && status}
        <View style={{ marginTop: 16 }}>
          <SectionTitle title="Your reminders" />
          {reminderStatusLocation === "list" && status}
          {!app.data.reminders.length && (
            <AppText color={colors.muted}>No reminders saved yet.</AppText>
          )}
          {app.data.reminders.map((r) => (
            <Card key={r.id} style={{ marginBottom: 10 }}>
              <AppText variant="label">
                {r.title} · {String(r.hour).padStart(2, "0")}:
                {String(r.minute).padStart(2, "0")}
              </AppText>
              <AppText variant="caption">
                {r.days.map((d: number) => days[d]).join(", ")} ·{" "}
                {r.enabled ? "Enabled" : "Disabled"}
                {Platform.OS === "web" ? " · Preferences only" : ""}
              </AppText>
              <Row>
                <Button
                  title="Edit"
                  variant="ghost"
                  disabled={pending}
                  onPress={() => {
                    setReminderId(r.id!);
                    setReminderType(r.type);
                    setReminderTitle(r.title);
                    setTime(
                      `${String(r.hour).padStart(2, "0")}${String(r.minute).padStart(2, "0")}`,
                    );
                    setDays(r.days);
                    setEnabled(r.enabled);
                    setDeleteId(null);
                    setReminderStatusLocation("form");
                    setMessage("");
                    setError("");
                    reminderScroll.current?.scrollTo({
                      y: 0,
                      animated: !reducedMotion,
                    });
                  }}
                />
                <Button
                  title="Delete"
                  variant="ghost"
                  disabled={pending}
                  onPress={() => setDeleteId(r.id!)}
                />
              </Row>
              {deleteId === r.id && (
                <>
                  <AppText variant="caption" color={colors.muted}>
                    Delete this reminder and its schedule?
                  </AppText>
                  <Row style={{ flexWrap: "wrap" }}>
                    <Button
                      title="Keep reminder"
                      variant="ghost"
                      disabled={pending}
                      onPress={() => setDeleteId(null)}
                    />
                    <Button
                      title="Delete reminder"
                      variant="secondary"
                      loading={pending}
                      onPress={() => {
                        setReminderStatusLocation("list");
                        return perform(async () => {
                          const owner = String(app.user?.id);
                          const id = String(r.id);
                          const ids =
                            Platform.OS === "web"
                              ? []
                              : await deviceReminderIds(owner, id);
                          await app.remove("reminders", id);
                          if (reminderId === id) resetReminder();
                          setDeleteId(null);
                          if (Platform.OS !== "web") {
                            try {
                              await cancelReminders(ids);
                              await rememberDeviceSchedule(owner, id, []);
                            } catch {
                              setMessage(
                                "Reminder removed from your account. Restart Solace to refresh alerts on this device.",
                              );
                              return;
                            }
                          }
                          setMessage("Reminder removed.");
                        });
                      }}
                    />
                  </Row>
                </>
              )}
            </Card>
          ))}
        </View>
      </Screen>
    );

  if (name === "account")
    return (
      <Screen
        title={privacyOnly ? "Privacy & data" : "Your account"}
        back={app.back}
      >
        {privacyOnly
          ? heading(
              "Your data",
              "Export your information or manage your account.",
            )
          : heading(
              "Your information",
              "Manage your account and the data you have saved.",
            )}
        {!privacyOnly && (
          <>
            <Row
              style={{ alignItems: "flex-start", gap: 18, marginBottom: 22 }}
            >
              <View
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 44,
                  overflow: "hidden",
                  backgroundColor:
                    resolved === "dark"
                      ? colors.surface2
                      : colors.lavenderSurface,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {app.user?.avatar ? (
                  <Image
                    accessibilityLabel="Your current profile photo"
                    source={{ uri: app.user.avatar }}
                    resizeMode="cover"
                    style={{ width: 88, height: 88 }}
                  />
                ) : (
                  <Icon
                    name="person-outline"
                    size={32}
                    color={colors.lavenderText}
                  />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="heading">Profile photo</AppText>
                <AppText
                  variant="caption"
                  color={colors.muted}
                  style={{ marginTop: 5 }}
                >
                  Optional. Choose a photo to make this space yours.
                </AppText>
              </View>
            </Row>
            <Button
              title={
                photoAction === "saving"
                  ? "Saving photo…"
                  : app.user?.avatar
                    ? "Change photo"
                    : "Add profile photo"
              }
              variant="secondary"
              icon="image-outline"
              disabled={pending}
              loading={photoAction === "choosing" || photoAction === "saving"}
              onPress={changePhoto}
            />
            {!!app.user?.avatar && (
              <Button
                title="Remove photo"
                variant="ghost"
                disabled={pending}
                loading={photoAction === "removing"}
                onPress={() =>
                  perform(async () => {
                    setPhotoAction("removing");
                    try {
                      await app.updateUser({ avatar: null });
                      setMessage("Profile photo removed.");
                    } finally {
                      setPhotoAction("");
                    }
                  })
                }
              />
            )}
            <View style={{ height: 22 }} />
            <AppText variant="label">Name</AppText>
            <Input
              accessibilityLabel="Your name"
              value={accountName}
              onChangeText={setAccountName}
              editable={!pending}
              maxLength={80}
              style={{ marginTop: 8, marginBottom: 12 }}
            />
            <AppText color={colors.muted} style={{ marginBottom: 20 }}>
              {app.user?.email}
            </AppText>
            <Button
              title="Save name"
              disabled={pending || !accountName.trim()}
              onPress={() =>
                perform(async () => {
                  await app.updateUser({ name: accountName.trim() });
                  setMessage("Name updated.");
                })
              }
            />
          </>
        )}
        {status}
        {!!app.pendingWrites.length && (
          <Card
            style={{
              marginTop: 28,
              backgroundColor: colors.peachSurface,
              borderColor: colors.peachSurface,
            }}
          >
            <Row style={{ marginBottom: 10 }}>
              <Icon name="cloud-upload-outline" color={colors.peachText} />
              <AppText variant="heading" color={colors.peachText}>
                Writing to sync
              </AppText>
            </Row>
            <AppText
              color={colors.peachText}
              style={{ fontSize: 14, lineHeight: 22 }}
            >
              {app.draftProtection === "device"
                ? "Your writing is saved securely on this device. It will sync to your account when the connection returns."
                : "Your writing is kept for this browser session only. Keep this tab open and retry before leaving."}
            </AppText>
            <AppText
              color={colors.peachText}
              variant="caption"
              style={{ marginTop: 10 }}
            >
              Sync before exporting to include these entries in your account
              export.
            </AppText>
            {!!app.offlineError && <Notice text={app.offlineError} error />}
            <Button
              title={app.syncingWrites ? "Syncing writing…" : "Retry sync"}
              disabled={pending || app.syncingWrites}
              onPress={() =>
                perform(async () => {
                  await app.flushPendingWrites();
                })
              }
              style={{ marginTop: 16 }}
            />
            {app.pendingWrites.map((entry) => (
              <View
                key={entry.id}
                style={{
                  marginTop: 16,
                  borderTopWidth: 0.75,
                  borderTopColor: colors.peachText,
                  paddingTop: 10,
                }}
              >
                <AppText color={colors.peachText} variant="label">
                  {entry.collection === "checkins" ? "Check-in" : "Reflection"}{" "}
                  ·{" "}
                  {new Date(entry.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </AppText>
                {discardWriteId === entry.id ? (
                  <>
                    <AppText
                      color={colors.peachText}
                      variant="caption"
                      style={{ marginTop: 8 }}
                    >
                      Delete this unsynced entry from this device? This cannot
                      be undone.
                    </AppText>
                    <Button
                      title="Keep entry"
                      variant="ghost"
                      disabled={pending || app.syncingWrites}
                      onPress={() => setDiscardWriteId(null)}
                    />
                    <Button
                      title="Delete unsynced entry"
                      variant="secondary"
                      disabled={pending || app.syncingWrites}
                      onPress={() =>
                        perform(async () => {
                          await app.discardPendingWrite(entry.id);
                          setDiscardWriteId(null);
                        })
                      }
                    />
                  </>
                ) : (
                  <Button
                    title="Delete unsynced entry…"
                    variant="ghost"
                    disabled={pending || app.syncingWrites}
                    onPress={() => setDiscardWriteId(entry.id)}
                  />
                )}
              </View>
            ))}
          </Card>
        )}
        <View style={{ height: 20 }} />
        <Button
          title="Export my data"
          variant="secondary"
          disabled={pending}
          onPress={() =>
            perform(async () => {
              const value = await app.exportData();
              const json = JSON.stringify(value, null, 2);
              if (Platform.OS === "web") {
                const blob = new Blob([json], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = "solace-data.json";
                link.click();
                URL.revokeObjectURL(url);
              } else
                await Share.share({ message: json, title: "My Solace data" });
              setMessage("Data export prepared.");
            })
          }
        />
        <Button
          title="Log out"
          variant="ghost"
          disabled={
            pending ||
            app.syncingWrites ||
            (logoutConfirm && !!app.pendingWrites.length)
          }
          onPress={() =>
            app.pendingWrites.length && !logoutConfirm
              ? setLogoutConfirm(true)
              : perform(async () => {
                  await cancelAllReminders();
                  await app.signOut();
                })
          }
        />
        {logoutConfirm && !!app.pendingWrites.length && (
          <Card style={{ marginTop: 12 }}>
            <AppText>
              Logging out removes unsynced writing and drafts from this device.
              Sync your writing first, or choose to log out and discard it.
            </AppText>
            <Button
              title="Stay signed in"
              variant="secondary"
              disabled={pending}
              onPress={() => setLogoutConfirm(false)}
              style={{ marginTop: 12 }}
            />
            <Button
              title="Discard unsynced writing and log out"
              variant="ghost"
              disabled={pending || app.syncingWrites}
              onPress={() =>
                perform(async () => {
                  await cancelAllReminders();
                  await app.signOut();
                })
              }
            />
          </Card>
        )}
        <View style={{ marginTop: 35 }}>
          <AppText variant="heading" color={colors.danger}>
            Delete account
          </AppText>
          <AppText style={{ marginVertical: 12 }}>
            Permanently delete your account, conversations, preferences,
            activity records, and writing on this device.
          </AppText>
          {!deleteAccount ? (
            <Button
              title="Delete my account…"
              variant="secondary"
              disabled={pending}
              onPress={() => setDeleteAccount(true)}
            />
          ) : (
            <Card>
              <AppText>
                This cannot be undone. Drafts and unsynced entries are removed
                from this device first, even if online deletion needs a retry.
                Delete all your Solace data?
              </AppText>
              <Button
                title="Keep my account"
                variant="ghost"
                disabled={pending}
                onPress={() => setDeleteAccount(false)}
              />
              <Button
                title="Permanently delete account"
                loading={pending}
                onPress={() =>
                  perform(async () => {
                    await cancelAllReminders();
                    await app.deleteAccount();
                  })
                }
              />
            </Card>
          )}
        </View>
      </Screen>
    );

  return (
    <Screen title="Find support" back={app.back}>
      {heading(
        "You deserve support",
        "Connect with human help when you need more than an app.",
      )}
      <Card style={{ marginBottom: 16 }}>
        <AppText>
          Solace offers everyday reflection and self-care. It cannot provide
          emergency care, diagnosis or treatment.
        </AppText>
      </Card>
      <AppText variant="label">Your country or region (optional)</AppText>
      <Input
        accessibilityLabel="Country or region"
        value={country}
        onChangeText={setCountry}
        placeholder="For example: India"
        maxLength={80}
        style={{ marginVertical: 12 }}
      />
      <MenuRow
        title="Find local support resources"
        subtitle="Choose your country on Find A Helpline"
        icon="globe-outline"
        onPress={() =>
          perform(async () => {
            await Linking.openURL("https://findahelpline.com/");
          })
        }
      />
      <MenuRow
        title="Find professional care"
        subtitle="Open a professional directory and select your country; coverage varies"
        icon="people-outline"
        onPress={() =>
          perform(async () => {
            await Linking.openURL(
              "https://www.psychologytoday.com/country-selector",
            );
          })
        }
      />
      <Card>
        <AppText variant="heading">If you are in immediate danger</AppText>
        <AppText style={{ marginTop: 10 }}>
          Contact your local emergency services or go to the nearest emergency
          department. If possible, reach someone you trust and ask them to stay
          with you.
        </AppText>
      </Card>
      <Notice
        text={
          country
            ? `Use the directory’s country selector for ${country}. Your location is not shared automatically.`
            : "Location is not detected or shared automatically."
        }
      />
      {status}
    </Screen>
  );
}
