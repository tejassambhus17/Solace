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
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import Constants from "expo-constants";
import { playHaptic } from "../haptics";
import { spacing } from "../layout";
import { EditorialSection, SceneIntro } from "../NestedDesign";
import { useTabResetGuard } from "../navigation-reset";
import { artGradient, darkColors, lightColors, useTheme } from "../theme";
import { useReminderDelivery } from "../useReminderPermission";
import { reminderClockLabel } from "../reminder-time";
import { isMatchingReminder, saveReminder } from "../save-reminder";
import { switchColors } from "../switch-colors";
import { webRadioProps } from "../radio-keyboard";
import { habitReminderInput } from "../habit-reminders";
import { useApp } from "../store";
import { routes } from "../routes";
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
  NestedHeader,
  NestedState,
  SectionTitle,
  LotusMark,
  coverImageStyle,
} from "../ui";
import {
  cancelReminders,
  restoreDeviceReminders,
  readReminderDelivery,
  testNotification,
  deviceReminderIds,
  rememberDeviceSchedule,
} from "../notifications";
import ProfileHome from "./ProfileHome";
import { DeviceLockSettingsCard } from "./DeviceLock";
import { GoogleAccountLink } from "./GoogleAccountLink";
import { ReminderTimePicker } from "./ReminderTimePicker";

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const defaultReminderDays = [1, 2, 3, 4, 5];
const defaultReminderTime = { hour: 20, minute: 0 };

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
const appearances = [
  { id: "light", title: "Light", icon: "sunny-outline" },
  { id: "dark", title: "Dark", icon: "moon-outline" },
  { id: "system", title: "System", icon: "phone-portrait-outline" },
] as const;

const profileScenes = {
  portrait: {
    light: require("../../assets/profile-mountains-light.jpg"),
    dark: require("../../assets/profile-mountains-dark.jpg"),
  },
  about: {
    light: require("../../assets/profile-footer-light.jpg"),
    dark: require("../../assets/profile-footer-dark.jpg"),
  },
};

type ProfileTone = "lavender" | "peach" | "sage";

function ProfilePortraitScene() {
  const { colors, resolved } = useTheme();
  const dark = resolved === "dark";
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
    >
      <Image
        source={profileScenes.portrait[resolved]}
        style={coverImageStyle}
        resizeMode="cover"
        resizeMethod={dark ? "resize" : "auto"}
        fadeDuration={0}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          artGradient(
            dark
              ? "linear-gradient(90deg, #191422 0%, #191422E6 53%, #19142265 100%)"
              : `linear-gradient(90deg, ${colors.surface} 0%, ${colors.surface}F5 32%, ${colors.surface}C7 55%, ${colors.surface}16 96%)`,
          ),
        ]}
      />
    </View>
  );
}

function ThemePreview({ mode }: { mode: (typeof appearances)[number]["id"] }) {
  const { resolved } = useTheme();
  // The miniature is decorative. Keep its established colors on dark screens.
  const daylight =
    resolved === "dark"
      ? {
          bg: "#FBF0E8",
          surface: "#FFF8F2",
          border: "#E6DACE",
          muted: "#626B5D",
          accent: "#805897",
          lavenderAction: "#EAD8F5",
        }
      : lightColors;
  const palettes =
    mode === "system"
      ? [daylight, darkColors]
      : [mode === "dark" ? darkColors : daylight];
  return (
    <View
      style={styles.themePreview}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
    >
      {palettes.map((palette) => (
        <View
          key={palette.bg}
          style={[styles.themeMiniature, { backgroundColor: palette.bg }]}
        >
          <Row style={styles.themeMiniHeader}>
            <View
              style={[styles.themeMiniDot, { backgroundColor: palette.accent }]}
            />
            <View
              style={[styles.themeMiniLine, { backgroundColor: palette.muted }]}
            />
          </Row>
          <View
            style={[
              styles.themeMiniCard,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            <View
              style={[
                styles.themeMiniPill,
                { backgroundColor: palette.lavenderAction },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

function ProfileIcon({
  name,
  tone = "lavender",
}: {
  name: string;
  tone?: ProfileTone;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.iconPlate, { backgroundColor: colors[`${tone}Surface`] }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
    >
      <Icon name={name} size={19} color={colors[`${tone}Text`]} />
    </View>
  );
}

function ProfileCardHeading({
  title,
  icon,
  tone,
  subtitle,
}: {
  title: string;
  icon: string;
  tone?: ProfileTone;
  subtitle?: string;
}) {
  const { colors } = useTheme();
  return (
    <Row style={styles.groupHeading}>
      <ProfileIcon name={icon} tone={tone} />
      <View style={[styles.copy, styles.rowCopy]}>
        <AppText accessibilityRole="header" variant="heading">
          {title}
        </AppText>
        {subtitle && (
          <AppText variant="caption" color={colors.muted}>
            {subtitle}
          </AppText>
        )}
      </View>
    </Row>
  );
}

function ProfileSwitchRow({
  title,
  description,
  value,
  onValueChange,
  disabled,
  label = title,
}: {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  const { colors } = useTheme();
  return (
    <Row style={styles.switchRow}>
      <View style={[styles.copy, styles.rowCopy]}>
        <AppText variant="label">{title}</AppText>
        <AppText variant="caption" color={colors.muted}>
          {description}
        </AppText>
      </View>
      <View style={styles.switchControl}>
        <Switch
          accessibilityLabel={label}
          accessibilityHint={description}
          value={value}
          disabled={disabled}
          onValueChange={onValueChange}
          {...switchColors(colors, value)}
        />
      </View>
    </Row>
  );
}

function ProfileDivider() {
  const { colors } = useTheme();
  return <View style={[styles.rule, { backgroundColor: colors.border }]} />;
}

function ProfileStatusTag({
  label,
  active,
}: {
  label: string;
  active: boolean;
}) {
  const { colors } = useTheme();
  return (
    <AppText
      variant="caption"
      color={active ? colors.sageText : colors.muted}
      style={[
        styles.statusTag,
        { backgroundColor: active ? colors.sageSurface : colors.surface2 },
      ]}
    >
      {label}
    </AppText>
  );
}

function MenuRow({
  title,
  subtitle,
  icon,
  onPress,
  tone = "lavender",
  label,
  external = false,
  disabled = false,
}: {
  title: string;
  subtitle?: string;
  icon: string;
  onPress: () => void;
  tone?: ProfileTone;
  label?: string;
  external?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole={external ? "link" : "button"}
      accessibilityLabel={label || title}
      accessibilityHint={subtitle}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuRow,
        (pressed || disabled) && { opacity: 0.68 },
      ]}
    >
      <Row style={styles.groupHeading}>
        <ProfileIcon name={icon} tone={tone} />
        <View style={[styles.copy, styles.rowCopy]}>
          <AppText variant="label">{title}</AppText>
          {subtitle && (
            <AppText variant="caption" color={colors.muted}>
              {subtitle}
            </AppText>
          )}
        </View>
        <Icon
          name={external ? "open-outline" : "chevron-forward"}
          size={18}
          color={colors.muted}
        />
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
  const { fontScale, width } = useWindowDimensions();
  const stackAppearance = width < 310 || fontScale >= 1.3;
  const choiceColors = (selected: boolean, dimmed: boolean) => ({
    borderColor: selected ? colors.accent : colors.border,
    backgroundColor: selected ? colors.tabActiveSurface : colors.surface,
    opacity: dimmed ? 0.72 : 1,
  });
  const privacyOnly = name === "account" && app.params?.section === "privacy";
  const routeIdentity = privacyOnly ? "privacy" : name;
  const [message, setMessageState] = useState("");
  const [error, setErrorState] = useState("");
  const mounted = useRef(true);
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
  const [savedAccountName, setSavedAccountName] = useState(
    app.user?.name || "",
  );
  const [accountName, setAccountName] = useState(savedAccountName);
  const [deleteAccount, setDeleteAccount] = useState(false);
  const [photoAction, setPhotoAction] = useState("");
  const [failedAvatar, setFailedAvatar] = useState<string>();
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [discardWriteId, setDiscardWriteId] = useState<string | null>(null);
  const accountIdentity = useRef(app.user?.id);
  accountIdentity.current = app.user?.id;
  const [reminderType, setReminderType] = useState("checkin");
  const [reminderTitle, setReminderTitle] = useState("");
  const [time, setTime] = useState(defaultReminderTime);
  const [
    { permission: reminderPermission, scheduled },
    refreshReminderPermission,
  ] = useReminderDelivery(name === "reminders", String(app.user?.id ?? ""));
  const [selectedDays, setDays] = useState(defaultReminderDays);
  const [enabled, setEnabled] = useState(true);
  const [reminderId, setReminderId] = useState<string | null>(null);
  const reminderCreateAttempt = useRef<{ id: string; fingerprint: string }>(
    null,
  );
  const [reminderStatusLocation, setReminderStatusLocation] = useState<
    "form" | "list"
  >("form");
  const reminderScroll = useRef<React.ElementRef<typeof ScrollView>>(null);
  const memoryScroll = useRef<React.ElementRef<typeof ScrollView>>(null);
  const memoryEditorTop = useRef(0);
  const reducedMotion = useReducedMotion();
  const [country, setCountry] = useState("");
  const savedReminder =
    name === "reminders" && reminderId
      ? app.data.reminders.find((reminder) => reminder.id === reminderId)
      : undefined;
  const savedReminderDays: number[] =
    savedReminder?.days ?? defaultReminderDays;
  const reminderDirty =
    name === "reminders" &&
    (reminderType !== (savedReminder?.type ?? "checkin") ||
      (reminderType === "custom" &&
        reminderTitle.trim() !== (savedReminder?.title ?? "")) ||
      time.hour !== (savedReminder?.hour ?? defaultReminderTime.hour) ||
      time.minute !== (savedReminder?.minute ?? defaultReminderTime.minute) ||
      enabled !== (savedReminder?.enabled ?? true) ||
      selectedDays.length !== savedReminderDays.length ||
      savedReminderDays.some((day) => !selectedDays.includes(day)));
  const savedMemory =
    name === "memory" && editing
      ? app.data.memories.find((item) => item.id === editing)
      : undefined;
  const memoryDirty =
    name === "memory" &&
    (preference.trim() !==
      (savedMemory?.text || savedMemory?.content || savedMemory?.value || "") ||
      (!!savedMemory &&
        memoryCategory !== (savedMemory.category || "preference")));
  const accountDirty =
    name === "account" &&
    !privacyOnly &&
    accountName.trim() !== savedAccountName;
  useTabResetGuard(reminderDirty || memoryDirty || accountDirty);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

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
      if (name === "reminders") refreshReminderPermission();
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
        setFailedAvatar(undefined);
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
  const heading = (title: string, subtitle?: string, eyebrow = "Profile") => (
    <NestedHeader
      title={title}
      onBack={app.back}
      subtitle={subtitle}
      eyebrow={eyebrow}
    />
  );
  function resetReminder() {
    reminderCreateAttempt.current = null;
    setReminderId(null);
    setReminderType("checkin");
    setReminderTitle("");
    setTime(defaultReminderTime);
    setDays(defaultReminderDays);
    setEnabled(true);
  }

  if (name === "profile") return <ProfileHome />;

  if (name === "settings")
    return (
      <Screen key={routeIdentity} variant="nested">
        {heading(
          "Appearance & preferences",
          "Make Solace feel comfortable for you.",
        )}
        <View style={styles.editorialGroups}>
          <View style={styles.group}>
            <SectionTitle
              title="Appearance"
              subtitle="Pick a theme or follow your device settings."
            />
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="Appearance theme"
              style={[
                styles.themeOptions,
                stackAppearance && styles.stackedThemeOptions,
              ]}
            >
              {appearances.map(({ id, title, icon }) => (
                <Pressable
                  key={id}
                  accessibilityRole="radio"
                  accessibilityLabel={`${title} appearance`}
                  accessibilityState={{ checked: mode === id }}
                  aria-checked={mode === id}
                  {...webRadioProps(mode === id)}
                  onPress={() => setMode(id)}
                  style={({ pressed }) => [
                    styles.themeOption,
                    stackAppearance && styles.stackedThemeOption,
                    choiceColors(mode === id, pressed),
                  ]}
                >
                  <View
                    style={
                      stackAppearance
                        ? styles.compactThemePreview
                        : styles.fullThemePreview
                    }
                  >
                    <ThemePreview mode={id} />
                  </View>
                  <View
                    style={stackAppearance ? styles.copy : styles.themeLabelRow}
                  >
                    <Row style={styles.themeLabelRow}>
                      <Icon
                        name={icon}
                        size={16}
                        color={
                          mode === id ? colors.tabActiveText : colors.muted
                        }
                      />
                      <AppText
                        variant="label"
                        color={mode === id ? colors.tabActiveText : colors.text}
                        style={styles.themeLabel}
                      >
                        {title}
                      </AppText>
                    </Row>
                  </View>
                  {mode === id && (
                    <View
                      style={stackAppearance ? undefined : styles.themeCheck}
                    >
                      <Icon
                        name="checkmark-circle"
                        size={17}
                        color={colors.accent}
                      />
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          </View>
          <Card style={styles.group}>
            <ProfileCardHeading
              title="Sound and accessibility"
              icon="options-outline"
            />
            <MenuRow
              title="Ambient sound"
              subtitle="Set the starting sound for your practices."
              label="Open Ambient sound preferences"
              icon="volume-medium-outline"
              tone="peach"
              onPress={() => app.navigate(routes.ambientSoundPreferences)}
            />
            <ProfileDivider />
            <Row style={styles.settingRow}>
              <ProfileIcon name="accessibility-outline" tone="sage" />
              <View style={[styles.copy, styles.rowCopy]}>
                <AppText variant="label">Device accessibility</AppText>
                <AppText variant="caption" color={colors.muted}>
                  Use device settings to adjust text size, Reduce Motion, and
                  system haptics.
                </AppText>
              </View>
            </Row>
            {(Platform.OS === "ios" || Platform.OS === "android") && (
              <>
                <ProfileDivider />
                <MenuRow
                  title="Test haptic feedback"
                  subtitle="Uses your device’s system haptics setting."
                  icon="pulse-outline"
                  onPress={() => void playHaptic("confirmation")}
                />
              </>
            )}
          </Card>
          <DeviceLockSettingsCard />
          <Card style={styles.group}>
            <ProfileCardHeading
              title="Personalize Solace"
              icon="sparkles-outline"
              tone="peach"
            />
            <ProfileSwitchRow
              title="Use approved preferences"
              description="When enabled, Solace can use recent check-ins and the preferences you explicitly save."
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
            />
            {status}
          </Card>
        </View>
      </Screen>
    );

  if (name === "about")
    return (
      <Screen key={routeIdentity} variant="nested">
        {heading("About Solace")}
        <SceneIntro
          image={profileScenes.about[resolved]}
          title="Solace"
          description="Check in, talk, and take one small step toward everyday wellbeing."
          meta={
            Constants.expoConfig?.version
              ? `Version ${Constants.expoConfig.version}`
              : undefined
          }
        >
          <View
            style={[
              styles.aboutMark,
              resolved === "light" && styles.daylightAboutMark,
            ]}
            pointerEvents="none"
            aria-hidden
          >
            <LotusMark size={52} />
          </View>
        </SceneIntro>
        <View style={styles.editorialGroups}>
          <EditorialSection
            title="What you can do"
            description="Check in with how you feel, try a guided practice, write a reflection, or build a habit."
          />
          <View style={styles.chapter}>
            <EditorialSection
              title="Wellness and safety"
              description="Solace is an AI wellness companion for everyday reflection and self-care. It cannot provide diagnosis, treatment, or emergency care."
            />
            <AppText color={colors.muted}>
              If you are in immediate danger, contact your local emergency
              services or go to the nearest emergency department.
            </AppText>
            <ProfileDivider />
            <MenuRow
              title="Find human support"
              subtitle="See urgent guidance and directories."
              icon="heart-outline"
              tone="peach"
              onPress={() => app.navigate("support")}
            />
          </View>
          <View style={styles.chapter}>
            <EditorialSection
              title="How conversations work"
              description="Your messages are processed by the server. When live AI is configured, your conversation and relevant consented context are sent to OpenAI. Share only what you want processed."
            />
            <ProfileDivider />
            <MenuRow
              title="Privacy & data"
              icon="lock-closed-outline"
              tone="sage"
              onPress={() => app.navigate("account", { section: "privacy" })}
            />
          </View>
          <Card style={styles.group}>
            <MenuRow
              title="Replay introduction"
              subtitle="Revisit the Solace welcome and setup screens."
              icon="play-circle-outline"
              onPress={() => app.navigate(routes.onboarding)}
            />
          </Card>
        </View>
      </Screen>
    );

  if (name === "memory") {
    const scrollToMemoryEditor = () =>
      memoryScroll.current?.scrollTo({
        y: Math.max(0, memoryEditorTop.current - spacing.row),
        animated: !reducedMotion,
      });
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
      <Screen key={routeIdentity} variant="nested" scrollRef={memoryScroll}>
        {heading(
          "What Solace remembers",
          "Review, correct, or remove preferences you’ve chosen to save.",
        )}
        <Card
          style={[
            styles.group,
            styles.beforeSection,
            { backgroundColor: colors.lavenderSurface },
          ]}
        >
          <Row style={styles.cardMetadata}>
            <AppText
              accessibilityRole="header"
              variant="heading"
              style={styles.copy}
            >
              You choose what Solace uses
            </AppText>
            <Icon
              name="shield-checkmark-outline"
              color={colors.lavenderText}
              size={24}
            />
          </Row>
          <ProfileSwitchRow
            title="Use my approved preferences"
            label="Personalization"
            description={
              app.user?.personalization
                ? "Approved preferences may shape conversations and Moments. Suggestions name the preferences they use."
                : "Saved preferences stay available to manage while personalization is off."
            }
            value={!!app.user?.personalization}
            disabled={pending}
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
          <ProfileDivider />
          <AppText variant="caption" color={colors.muted}>
            Editing or removing a preference, or turning personalization off,
            resets the context used for future AI replies. Your saved history
            stays visible.
          </AppText>
        </Card>
        <EditorialSection
          title="Saved preferences"
          description={`${app.data.memories.length} ${app.data.memories.length === 1 ? "preference" : "preferences"} you control`}
        />
        {app.data.memories.length === 0 && (
          <Row style={styles.memoryEmpty}>
            <ProfileIcon name="leaf-outline" tone="sage" />
            <View style={[styles.copy, styles.rowCopy]}>
              <AppText variant="label">No saved preferences yet</AppText>
              <AppText variant="caption" color={colors.muted}>
                Try a simple preference, such as short breathing sessions.
              </AppText>
            </View>
          </Row>
        )}
        <Button
          title={editing ? "Go to current edit" : "Add a preference"}
          icon="create-outline"
          variant="secondary"
          onPress={scrollToMemoryEditor}
        />
        <View style={styles.memoryList}>
          {app.data.memories.map((item) => {
            const source = sourceFor(item);
            return (
              <View
                key={item.id}
                style={[styles.memoryEntry, { borderColor: colors.border }]}
              >
                <Row style={styles.cardMetadata}>
                  <AppText variant="label" color={colors.lavenderText}>
                    {memoryCategories.find(
                      ([value]) => value === item.category,
                    )?.[1] || "Preference"}
                  </AppText>
                  <ProfileStatusTag
                    active={
                      item.approved !== false && !!app.user?.personalization
                    }
                    label={
                      item.approved === false
                        ? "Not approved · not used"
                        : app.user?.personalization
                          ? "Approved"
                          : "Saved · personalization off"
                    }
                  />
                </Row>
                <AppText style={styles.memoryText}>
                  {item.text || item.content || item.value}
                </AppText>
                <AppText variant="caption" color={colors.muted}>
                  {source?.label ||
                    (item.sourceType || item.sourceConversationId
                      ? "Source no longer available"
                      : "Added directly by you")}
                </AppText>
                <Row style={styles.actionRow}>
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
                      scrollToMemoryEditor();
                    }}
                  />
                  <Button
                    title="Forget"
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
                          await app.save("memories", {
                            ...item,
                            approved: true,
                          });
                          setMessage(
                            "Preference approved. It is used only when personalization is enabled.",
                          );
                        })
                      }
                    />
                  )}
                </Row>
                {deleteId === item.id && (
                  <View
                    style={[
                      styles.confirmation,
                      { borderColor: colors.border },
                    ]}
                  >
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
        </View>
        <View
          style={styles.afterSection}
          onLayout={({ nativeEvent }) => {
            memoryEditorTop.current = nativeEvent.layout.y;
          }}
        >
          <Card style={styles.group}>
            <ProfileCardHeading
              title={editing ? "Correct this preference" : "Add a preference"}
              icon="create-outline"
              subtitle="Keep it general. Share only the context you want processed."
            />
            <Row style={styles.choiceRow}>
              {memoryCategories.map(([category, label]) => (
                <Pressable
                  key={category}
                  accessibilityRole="button"
                  accessibilityLabel={`Memory category: ${label}`}
                  accessibilityState={{ selected: memoryCategory === category }}
                  disabled={pending}
                  onPress={() => setMemoryCategory(category)}
                  style={({ pressed }) => [
                    styles.choice,
                    choiceColors(
                      memoryCategory === category,
                      pending || pressed,
                    ),
                  ]}
                >
                  <AppText
                    variant="caption"
                    color={
                      memoryCategory === category
                        ? colors.tabActiveText
                        : colors.text
                    }
                  >
                    {label}
                  </AppText>
                </Pressable>
              ))}
            </Row>
            {!!memorySource.sourceId && (
              <AppText variant="caption" color={colors.muted}>
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
            />
            <AppText variant="caption" color={colors.muted}>
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
          </Card>
        </View>
        {app.data.memories.length > 0 && (
          <Card style={[styles.group, styles.afterSection]}>
            {!clearMemories ? (
              <Button
                title="Clear all saved preferences…"
                variant="ghost"
                disabled={pending}
                onPress={() => setClearMemories(true)}
              />
            ) : (
              <View style={styles.group}>
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
          </Card>
        )}
        {status}
      </Screen>
    );
  }

  if (name === "reminders")
    return (
      <Screen key={routeIdentity} variant="nested" scrollRef={reminderScroll}>
        {heading(
          reminderId ? "Edit reminder" : "Gentle reminders",
          "Choose when a small pause fits your day. Lock screen previews use a generic message.",
        )}
        <Card
          style={[
            styles.group,
            styles.beforeSection,
            { backgroundColor: colors.lavenderSurface },
          ]}
        >
          <View style={styles.fieldGroup}>
            <AppText variant="label" color={colors.lavenderText}>
              Time in your device’s time zone
            </AppText>
            <ReminderTimePicker
              value={time}
              onChange={setTime}
              disabled={pending}
              reducedMotion={reducedMotion}
            />
          </View>
          <ProfileDivider />
          <ProfileSwitchRow
            title="Enable reminder"
            description={
              Platform.OS === "web"
                ? "Save a schedule for the mobile app."
                : "Use this schedule on the current device."
            }
            value={enabled}
            disabled={pending}
            onValueChange={setEnabled}
          />
        </Card>
        <View style={styles.editorialGroups}>
          <View style={styles.fieldGroup}>
            <AppText variant="heading" accessibilityRole="header">
              Reminder type
            </AppText>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="Reminder type"
              style={styles.choiceRow}
            >
              {kinds.map(([key, label]) => (
                <Pressable
                  key={key}
                  accessibilityRole="radio"
                  accessibilityLabel={label}
                  accessibilityState={{
                    checked: reminderType === key,
                    disabled: pending,
                  }}
                  aria-checked={reminderType === key}
                  {...webRadioProps(reminderType === key)}
                  disabled={pending}
                  onPress={() => setReminderType(key)}
                  style={({ pressed }) => [
                    styles.choice,
                    choiceColors(reminderType === key, pending || pressed),
                  ]}
                >
                  <AppText
                    variant="label"
                    color={
                      reminderType === key ? colors.tabActiveText : colors.text
                    }
                  >
                    {label}
                  </AppText>
                </Pressable>
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
              />
            )}
          </View>
          <View style={styles.fieldGroup}>
            <AppText variant="heading" accessibilityRole="header">
              Repeat on
            </AppText>
            <View style={styles.choiceRow}>
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
                  style={({ pressed }) => [
                    styles.choice,
                    styles.dayChoice,
                    (width < 400 || fontScale >= 1.25) && styles.dayGridChoice,
                    choiceColors(selectedDays.includes(i), pending || pressed),
                  ]}
                >
                  <AppText
                    color={
                      selectedDays.includes(i)
                        ? colors.tabActiveText
                        : colors.text
                    }
                    variant="caption"
                  >
                    {d}
                  </AppText>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
        {Platform.OS === "web" && (
          <Notice text="This web preview saves preferences. Notification scheduling and delivery require the Android or iOS app." />
        )}
        {reminderPermission === "blocked" && (
          <Card style={[styles.group, styles.listItem]}>
            <ProfileCardHeading
              title="Notifications are blocked"
              icon="notifications-off-outline"
              tone="peach"
              subtitle="Your saved schedules are kept. Enable notifications in your device settings to receive them."
            />
            <Button
              title="Open notification settings"
              variant="secondary"
              disabled={pending}
              onPress={() => perform(() => Linking.openSettings())}
            />
          </Card>
        )}
        {reminderPermission === "allowed" &&
          app.data.reminders.some(
            (record) => record.enabled && !scheduled.has(String(record.id)),
          ) && (
            <Card style={[styles.group, styles.listItem]}>
              <ProfileCardHeading
                title="Restore device alerts"
                icon="notifications-outline"
                tone="peach"
                subtitle="Some saved reminders are missing device alerts."
              />
              <Button
                title="Restore saved alerts"
                variant="secondary"
                disabled={pending}
                onPress={() => {
                  setReminderStatusLocation("form");
                  return perform(async () => {
                    const owner = String(app.user?.id ?? "");
                    if (!owner)
                      throw new Error("Sign in before restoring reminders.");
                    await restoreDeviceReminders(owner, [
                      ...app.data.reminders,
                      ...app.data.habits.flatMap((habit) => {
                        const reminder = habitReminderInput(habit);
                        return reminder ? [reminder] : [];
                      }),
                    ]);
                    const { permission, scheduled: restored } =
                      await readReminderDelivery(owner);
                    if (
                      permission !== "allowed" ||
                      app.data.reminders.some(
                        (record) =>
                          record.enabled && !restored.has(String(record.id)),
                      )
                    )
                      throw new Error(
                        "Solace couldn’t verify all device alerts. Check notification settings and try again.",
                      );
                    setMessage("Saved alerts restored on this device.");
                  });
                }}
              />
            </Card>
          )}
        <View style={styles.fieldGroup}>
          <Button
            title={reminderId ? "Update reminder" : "Save reminder"}
            loading={pending}
            onPress={() => {
              setReminderStatusLocation("form");
              return perform(async () => {
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
                  ...time,
                  days: [...selectedDays].sort((a, b) => a - b),
                  enabled,
                };
                const duplicate = app.data.reminders.some(
                  (reminder) =>
                    reminder.id !== reminderId &&
                    isMatchingReminder(reminder, record),
                );
                if (duplicate) {
                  setMessage("This reminder is already saved.");
                  return;
                }
                let id = reminderId;
                if (!id) {
                  // The API may have committed before the response was lost.
                  // Reuse the identity while retrying the same preferences.
                  const fingerprint = JSON.stringify(record);
                  if (
                    reminderCreateAttempt.current?.fingerprint !== fingerprint
                  )
                    reminderCreateAttempt.current = {
                      id: `reminder-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`,
                      fingerprint,
                    };
                  id = reminderCreateAttempt.current.id;
                }
                const { message } = await saveReminder({
                  owner: String(app.user?.id ?? ""),
                  id,
                  record,
                  editing: reminderId !== null,
                  save: (value) => app.save("reminders", value),
                });
                resetReminder();
                setMessage(message);
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
            title="Schedule a test notification"
            variant="ghost"
            disabled={pending || Platform.OS === "web"}
            onPress={() => {
              setReminderStatusLocation("form");
              return perform(async () => {
                await testNotification();
                setMessage(
                  Platform.OS === "android"
                    ? "Test scheduled for about 10 seconds from now. Android may deliver it later. Leave Solace normally and tap the alert when it arrives."
                    : "Test scheduled. Leave Solace normally and tap the alert when it arrives.",
                );
              });
            }}
          />
        </View>
        {reminderStatusLocation === "form" && status}
        <View style={styles.afterSection}>
          <SectionTitle title="Your reminders" />
          {reminderStatusLocation === "list" && status}
          {!app.data.reminders.length && (
            <NestedState
              title="No reminders saved yet"
              description="Save a schedule above when you’re ready for a regular pause."
              icon="notifications-outline"
            />
          )}
          {app.data.reminders.map((r) => {
            const isScheduled = r.enabled && scheduled.has(String(r.id));
            return (
              <View
                key={r.id}
                style={[styles.reminderEntry, { borderColor: colors.border }]}
              >
                <Row style={styles.cardMetadata}>
                  <AppText variant="heading" style={styles.clockValue}>
                    {reminderClockLabel({ hour: r.hour, minute: r.minute })}
                  </AppText>
                  <ProfileStatusTag
                    active={isScheduled}
                    label={
                      !r.enabled
                        ? "Disabled"
                        : isScheduled
                          ? "Enabled"
                          : reminderPermission === "blocked"
                            ? "Saved · Notifications blocked"
                            : reminderPermission === "allowed"
                              ? "Saved · Alert not scheduled"
                              : "Saved preference"
                    }
                  />
                </Row>
                <AppText variant="label">{r.title}</AppText>
                <AppText variant="caption" color={colors.muted}>
                  {r.days.map((d: number) => days[d]).join(", ")}
                </AppText>
                <Row style={styles.actionRow}>
                  <Button
                    title="Edit"
                    variant="ghost"
                    disabled={pending}
                    onPress={() => {
                      setReminderId(r.id!);
                      setReminderType(r.type);
                      setReminderTitle(r.title);
                      setTime({ hour: r.hour, minute: r.minute });
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
                  <View
                    style={[
                      styles.confirmation,
                      { borderColor: colors.border },
                    ]}
                  >
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
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </Screen>
    );

  if (name === "account")
    return (
      <Screen key={routeIdentity} variant="nested">
        {privacyOnly
          ? heading(
              "Privacy & data",
              "Manage your account and the information you’ve saved.",
            )
          : heading(
              "Your account",
              "Edit how you appear in Solace and manage your sign-in.",
            )}
        <View style={styles.editorialGroups}>
          {!privacyOnly && (
            <View
              style={[
                styles.portrait,
                {
                  backgroundColor: colors.lavenderSurface,
                  borderColor: colors.border,
                },
              ]}
            >
              <ProfilePortraitScene />
              <Row
                style={[
                  styles.portraitRow,
                  fontScale >= 1.3 && styles.stackedPortrait,
                ]}
              >
                <View
                  style={[
                    styles.profileAvatar,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.lavender,
                    },
                  ]}
                >
                  {app.user?.avatar && failedAvatar !== app.user.avatar ? (
                    <Image
                      accessibilityLabel="Your current profile photo"
                      source={{ uri: app.user.avatar }}
                      resizeMode="cover"
                      style={styles.profilePhoto}
                      onError={() =>
                        setFailedAvatar(app.user?.avatar || undefined)
                      }
                    />
                  ) : (
                    <Icon
                      name="person-outline"
                      size={32}
                      color={colors.lavenderText}
                    />
                  )}
                </View>
                <View style={[styles.portraitCopy, styles.rowCopy]}>
                  <AppText variant="title" accessibilityRole="header">
                    {app.user?.name || "Your profile"}
                  </AppText>
                  <AppText variant="caption" color={colors.muted}>
                    Your Solace profile
                  </AppText>
                </View>
              </Row>
              <Row style={styles.actionRow}>
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
                  loading={
                    photoAction === "choosing" || photoAction === "saving"
                  }
                  onPress={changePhoto}
                  style={{ backgroundColor: colors.surface }}
                />
                {!!app.user?.avatar && (
                  <Button
                    title="Remove photo"
                    variant="secondary"
                    disabled={pending}
                    loading={photoAction === "removing"}
                    style={{ backgroundColor: colors.surface }}
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
              </Row>
            </View>
          )}
          {!privacyOnly && (
            <View style={styles.chapter}>
              <EditorialSection title="Personal details" />
              <View style={styles.fieldGroup}>
                <AppText variant="label">Name</AppText>
                <Input
                  accessibilityLabel="Your name"
                  value={accountName}
                  onChangeText={setAccountName}
                  editable={!pending}
                  maxLength={80}
                />
              </View>
              <View style={styles.fieldGroup}>
                <AppText variant="label">Email</AppText>
                <AppText variant="caption" color={colors.muted}>
                  {app.user?.email}
                </AppText>
              </View>
              <Button
                title="Save name"
                disabled={
                  pending ||
                  !accountName.trim() ||
                  accountName.trim() === savedAccountName
                }
                onPress={() =>
                  perform(async () => {
                    const name = accountName.trim();
                    await app.updateUser({ name });
                    setSavedAccountName(name);
                    setMessage("Name updated.");
                  })
                }
              />
              {accountDirty && (
                <Button
                  title="Reset name"
                  variant="ghost"
                  disabled={pending}
                  onPress={() => setAccountName(savedAccountName)}
                />
              )}
            </View>
          )}
          {!privacyOnly && status}
          {!privacyOnly && <GoogleAccountLink />}
          {privacyOnly && !!app.pendingWrites.length && (
            <Card
              style={[
                styles.group,
                {
                  backgroundColor: colors.peachSurface,
                  borderColor: colors.border,
                },
              ]}
            >
              <ProfileCardHeading
                title="Writing to sync"
                icon="cloud-upload-outline"
                tone="peach"
              />
              <AppText
                color={colors.peachText}
                style={{ fontSize: 14, lineHeight: 22 }}
              >
                {app.draftProtection === "device"
                  ? "Your writing is saved securely on this device. It will sync to your account when the connection returns."
                  : "Your writing is kept for this browser session only. Keep this tab open and retry before leaving."}
              </AppText>
              <AppText color={colors.peachText} variant="caption">
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
              />
              {app.pendingWrites.map((entry) => (
                <View
                  key={entry.id}
                  style={{
                    borderTopWidth: 0.75,
                    borderTopColor: colors.border,
                    paddingTop: spacing.row,
                  }}
                >
                  <AppText color={colors.peachText} variant="label">
                    {entry.collection === "checkins"
                      ? "Check-in"
                      : "Reflection"}{" "}
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
          {privacyOnly && (
            <View
              style={[
                styles.privacyLead,
                {
                  backgroundColor: colors.lavenderSurface,
                  borderColor: colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.privacySeal,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Icon
                  name="shield-checkmark-outline"
                  size={33}
                  color={colors.lavenderText}
                />
              </View>
              <AppText variant="heading" accessibilityRole="header">
                Export a copy
              </AppText>
              <AppText color={colors.muted}>
                Download a JSON copy of the information saved to your account.
              </AppText>
              <Button
                title="Export my data"
                icon="download-outline"
                disabled={pending}
                style={styles.privacyAction}
                onPress={() =>
                  perform(async () => {
                    const owner = accountIdentity.current;
                    const canContinue = () =>
                      mounted.current &&
                      currentRoute.current === routeIdentity &&
                      accountIdentity.current === owner;
                    const value = await app.exportData();
                    if (!canContinue()) return;
                    const json = JSON.stringify(value, null, 2);
                    if (Platform.OS === "web") {
                      const blob = new Blob([json], {
                        type: "application/json",
                      });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement("a");
                      link.href = url;
                      link.download = "solace-data.json";
                      link.click();
                      setTimeout(() => URL.revokeObjectURL(url), 0);
                      setMessage("Data export prepared.");
                    } else if (Platform.OS === "android") {
                      const { StorageAccessFramework: storage } =
                        await import("expo-file-system/legacy");
                      const access =
                        await storage.requestDirectoryPermissionsAsync();
                      if (!access.granted || !canContinue()) return;
                      const uri = await storage.createFileAsync(
                        access.directoryUri,
                        "solace-data.json",
                        "application/json",
                      );
                      try {
                        if (!canContinue()) {
                          await storage.deleteAsync(uri, { idempotent: true });
                          return;
                        }
                        await storage.writeAsStringAsync(uri, json);
                      } catch (error) {
                        await storage
                          .deleteAsync(uri, { idempotent: true })
                          .catch(() => {});
                        throw error;
                      }
                      setMessage(
                        "Saved solace-data.json to the selected folder.",
                      );
                    } else if (Platform.OS === "ios") {
                      const {
                        cacheDirectory,
                        deleteAsync,
                        makeDirectoryAsync,
                        writeAsStringAsync,
                      } = await import("expo-file-system/legacy");
                      if (!cacheDirectory)
                        throw new Error(
                          "Couldn’t prepare an export file on this device.",
                        );
                      const folder = `${cacheDirectory}solace-export-${Date.now()}-${Math.random().toString(36).slice(2)}/`;
                      const url = `${folder}solace-data.json`;
                      try {
                        await makeDirectoryAsync(folder);
                        await writeAsStringAsync(url, json);
                        if (!canContinue()) return;
                        const result = await Share.share(
                          { url },
                          { subject: "My Solace data" },
                        );
                        if (result.action === Share.sharedAction)
                          setMessage("Solace data file shared.");
                      } finally {
                        await deleteAsync(folder, { idempotent: true }).catch(
                          () => {},
                        );
                      }
                    } else
                      throw new Error(
                        "File export is unavailable on this device.",
                      );
                  })
                }
              />
              {status}
            </View>
          )}
          {!privacyOnly && (
            <Card style={styles.group}>
              <ProfileCardHeading
                title="Account and device"
                icon="lock-closed-outline"
              />
              <MenuRow
                title="Privacy & data"
                subtitle={
                  accountDirty
                    ? "Save or reset your name above before opening Privacy & data."
                    : "Review syncing, export your data, or delete your account."
                }
                icon="shield-checkmark-outline"
                onPress={() => app.navigate("account", { section: "privacy" })}
                disabled={pending || accountDirty}
              />
              <ProfileDivider />
              <Button
                title="Log out"
                variant="ghost"
                icon="log-out-outline"
                disabled={
                  pending ||
                  app.syncingWrites ||
                  (logoutConfirm && !!app.pendingWrites.length)
                }
                onPress={() =>
                  app.pendingWrites.length && !logoutConfirm
                    ? setLogoutConfirm(true)
                    : perform(app.signOut)
                }
              />
              {logoutConfirm && !!app.pendingWrites.length && (
                <View
                  style={[styles.confirmation, { borderColor: colors.border }]}
                >
                  <AppText>
                    Logging out removes unsynced writing and drafts from this
                    device. Sync your writing first, or choose to log out and
                    discard it.
                  </AppText>
                  <MenuRow
                    title="Review writing to sync"
                    icon="cloud-upload-outline"
                    onPress={() =>
                      app.navigate("account", { section: "privacy" })
                    }
                    disabled={pending || accountDirty}
                  />
                  <Button
                    title="Stay signed in"
                    variant="secondary"
                    disabled={pending}
                    onPress={() => setLogoutConfirm(false)}
                  />
                  <Button
                    title="Discard unsynced writing and log out"
                    variant="ghost"
                    disabled={pending || app.syncingWrites}
                    onPress={() => perform(app.signOut)}
                  />
                </View>
              )}
            </Card>
          )}
          {privacyOnly && (
            <Card
              style={[styles.group, { backgroundColor: colors.peachSurface }]}
            >
              <ProfileCardHeading
                title="Delete account"
                icon="warning-outline"
                tone="peach"
              />
              <AppText color={colors.muted}>
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
                <View
                  style={[styles.confirmation, { borderColor: colors.border }]}
                >
                  <AppText>
                    This cannot be undone. Drafts and unsynced entries are
                    removed from this device first, even if online deletion
                    needs a retry. Delete all your Solace data?
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
                    onPress={() => perform(app.deleteAccount)}
                  />
                </View>
              )}
            </Card>
          )}
        </View>
      </Screen>
    );

  return (
    <Screen key={routeIdentity} variant="nested">
      {heading(
        "Find support",
        "Connect with human help when you need more than an app.",
      )}
      <View style={styles.editorialGroups}>
        <Card style={[styles.group, { backgroundColor: colors.peachSurface }]}>
          <ProfileCardHeading
            title="If you are in immediate danger"
            icon="alert-circle-outline"
            tone="peach"
          />
          <AppText>
            Contact your local emergency services or go to the nearest emergency
            department. If possible, reach someone you trust and ask them to
            stay with you.
          </AppText>
        </Card>
        <View>
          <EditorialSection
            title="Support directories"
            description="Choose the type of human support you want to find."
          />
          <Card style={styles.group}>
            <MenuRow
              title="Find local support resources"
              subtitle="Choose your country on Find A Helpline"
              icon="globe-outline"
              tone="sage"
              external
              disabled={pending}
              onPress={() =>
                perform(async () => {
                  await Linking.openURL("https://findahelpline.com/");
                })
              }
            />
            <ProfileDivider />
            <MenuRow
              title="Find professional care"
              subtitle="Open a professional directory and select your country; coverage varies"
              icon="people-outline"
              external
              disabled={pending}
              onPress={() =>
                perform(async () => {
                  await Linking.openURL(
                    "https://www.psychologytoday.com/country-selector",
                  );
                })
              }
            />
          </Card>
        </View>
        <View style={styles.chapter}>
          <EditorialSection title="Finding the right location" />
          <View style={styles.fieldGroup}>
            <AppText variant="label">Your country or region (optional)</AppText>
            <Input
              accessibilityLabel="Country or region"
              value={country}
              onChangeText={setCountry}
              placeholder="For example: India"
              maxLength={80}
            />
            <AppText variant="caption" color={colors.muted}>
              {country
                ? "Use the directory’s country selector for " +
                  country +
                  ". Your location is not shared automatically."
                : "Select your country in the directory. Your location is not detected or shared automatically."}
            </AppText>
          </View>
          <ProfileDivider />
          <AppText variant="caption" color={colors.muted}>
            Solace offers everyday reflection and self-care. It cannot provide
            emergency care, diagnosis or treatment.
          </AppText>
        </View>
        {status}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  editorialGroups: { gap: spacing.section },
  group: { gap: spacing.row },
  chapter: { gap: spacing.compact },
  groupHeading: { gap: spacing.row },
  copy: { flex: 1, minWidth: 0 },
  rowCopy: { gap: 4 },
  fieldGroup: { gap: spacing.compact },
  switchRow: { gap: spacing.row, minHeight: 48 },
  switchControl: { flexShrink: 0, minHeight: 48, justifyContent: "center" },
  cardMetadata: {
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: spacing.compact,
  },
  statusTag: {
    maxWidth: "100%",
    borderRadius: spacing.card,
    paddingHorizontal: spacing.compact,
    paddingVertical: 4,
  },
  clockValue: { fontVariant: ["tabular-nums"] },
  actionRow: { flexWrap: "wrap", gap: spacing.compact },
  aboutMark: { position: "absolute", left: 20, top: 26 },
  // SceneIntro has a separate photograph above its light-theme reading panel.
  daylightAboutMark: { top: -102 },
  memoryEmpty: { alignItems: "flex-start", paddingBottom: spacing.row },
  memoryList: { marginTop: spacing.row },
  memoryEntry: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.card,
    gap: spacing.compact,
  },
  memoryText: { fontSize: 16, lineHeight: 25 },
  reminderEntry: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.card,
    gap: 4,
  },
  iconPlate: {
    width: 36,
    height: 36,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  themeOptions: { flexDirection: "row", gap: spacing.compact },
  stackedThemeOptions: { flexDirection: "column" },
  themeOption: {
    flex: 1,
    minWidth: 0,
    minHeight: 76,
    borderRadius: spacing.card,
    borderWidth: 1,
    gap: spacing.compact,
    padding: spacing.compact,
    alignItems: "center",
    justifyContent: "center",
  },
  stackedThemeOption: {
    flex: 0,
    flexDirection: "row",
    minHeight: 48,
    gap: spacing.row,
    paddingHorizontal: spacing.row,
  },
  themeLabel: { textAlign: "center", flexShrink: 1 },
  themeLabelRow: { gap: 4, maxWidth: "100%", justifyContent: "center" },
  themeCheck: { position: "absolute", top: 5, right: 5 },
  fullThemePreview: { alignSelf: "stretch" },
  compactThemePreview: { width: 74 },
  themePreview: {
    borderRadius: 9,
    overflow: "hidden",
    flexDirection: "row",
    minHeight: 58,
  },
  themeMiniature: {
    flex: 1,
    minWidth: 0,
    padding: 5,
    gap: 5,
    justifyContent: "center",
  },
  themeMiniHeader: { gap: 3 },
  themeMiniDot: { width: 6, height: 6, borderRadius: 3 },
  themeMiniLine: {
    height: 2,
    width: 16,
    borderRadius: 2,
    flexShrink: 1,
    opacity: 0.65,
  },
  themeMiniCard: {
    minHeight: 24,
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 3,
    justifyContent: "flex-end",
    paddingBottom: 4,
  },
  themeMiniPill: { height: 4, borderRadius: 3, width: "72%" },
  menuRow: { minHeight: 48, paddingVertical: 4, justifyContent: "center" },
  settingRow: {
    minHeight: 48,
    gap: spacing.row,
  },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.compact },
  choice: {
    maxWidth: "100%",
    minHeight: 48,
    borderRadius: spacing.section,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.row,
  },
  dayChoice: {
    minWidth: 48,
    alignItems: "center",
    paddingHorizontal: spacing.compact,
  },
  dayGridChoice: { flexBasis: "22%" },
  beforeSection: { marginBottom: spacing.section },
  afterSection: { marginTop: spacing.section },
  listItem: { marginBottom: spacing.row },
  confirmation: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.row,
    gap: spacing.row,
  },
  rule: { height: StyleSheet.hairlineWidth },
  portrait: {
    borderRadius: spacing.section,
    borderWidth: 1,
    overflow: "hidden",
    padding: spacing.card,
    gap: spacing.card,
    minHeight: 158,
    justifyContent: "center",
  },
  portraitRow: { gap: spacing.row },
  portraitCopy: { flexShrink: 1, minWidth: 0 },
  stackedPortrait: { flexDirection: "column", alignItems: "flex-start" },
  profileAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1,
    flexShrink: 0,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  profilePhoto: { width: "100%", height: "100%" },
  privacyLead: {
    borderRadius: spacing.section,
    borderWidth: 1,
    padding: spacing.section,
    gap: spacing.compact,
  },
  privacySeal: {
    width: 54,
    height: 54,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  privacyAction: { marginTop: spacing.compact },
});
