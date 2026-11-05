import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Switch,
  Pressable,
  Platform,
  Linking,
  Share,
} from "react-native";
import { useTheme } from "../theme";
import { useApp } from "../store";
import {
  Screen,
  AppText,
  Card,
  Button,
  Input,
  Row,
  Icon,
  Petal,
  SectionTitle,
  BrandMark,
  BotanicalBackdrop,
  Artwork,
} from "../ui";
import {
  scheduleReminder,
  cancelReminders,
  cancelAllReminders,
  testNotification,
  deviceReminderIds,
  rememberDeviceSchedule,
} from "../notifications";

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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
}: {
  title: string;
  subtitle?: string;
  icon: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Card onPress={onPress} style={{ marginBottom: 12, padding: 18 }}>
      <Row>
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 23,
            backgroundColor: colors.surface2,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={icon} size={23} />
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
    </Card>
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
  const { colors, mode, setMode } = useTheme();
  const [message, setMessageState] = useState("");
  const [error, setErrorState] = useState("");
  const currentRoute = useRef(name);
  currentRoute.current = name;
  const operationLock = useRef(false);
  // Late responses from a screen we left must not announce success on another screen.
  const setMessage = (value: string) => {
    if (currentRoute.current === name) setMessageState(value);
  };
  const setError = (value: string) => {
    if (currentRoute.current === name) setErrorState(value);
  };
  const [pending, setPending] = useState(false);
  const [preference, setPreference] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [accountName, setAccountName] = useState(app.user?.name || "");
  const [deleteAccount, setDeleteAccount] = useState(false);
  const [reminderType, setReminderType] = useState("checkin");
  const [reminderTitle, setReminderTitle] = useState("");
  const [time, setTime] = useState("20:00");
  const [selectedDays, setDays] = useState([1, 2, 3, 4, 5]);
  const [enabled, setEnabled] = useState(true);
  const [reminderId, setReminderId] = useState<string | null>(null);
  const [country, setCountry] = useState("");
  useEffect(() => {
    setMessage("");
    setError("");
    setDeleteId(null);
    setDeleteAccount(false);
  }, [name]);
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

  if (name === "profile")
    return (
      <Screen>
        <View>
          <BotanicalBackdrop style={{ right: -90, top: -60, opacity: 0.23 }} />
          <Row style={{ marginBottom: 30 }}>
            <BrandMark />
          </Row>
          <Row style={{ marginBottom: 32, gap: 18 }}>
            <View
              style={{
                width: 96,
                height: 112,
                borderRadius: 48,
                overflow: "hidden",
                backgroundColor: colors.surface2,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Artwork
                kind="petal"
                size={130}
                style={{ position: "absolute", left: -17, top: -4 }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="display">
                {app.user?.name || "Your space"}
              </AppText>
              <AppText
                color={colors.muted}
                style={{ marginTop: 7, fontSize: 14, lineHeight: 22 }}
              >
                A space for your preferences, reminders, and your Solace
                experience.
              </AppText>
            </View>
          </Row>
        </View>
        <MenuRow
          title="Your account"
          subtitle={app.user?.email}
          icon="person-outline"
          onPress={() => app.navigate("account")}
        />
        <MenuRow
          title="Your toolkit"
          subtitle={`${app.data.favorites.length} saved ${app.data.favorites.length === 1 ? "practice or guide" : "practices and guides"}`}
          icon="bookmark-outline"
          onPress={() => app.navigate("toolkit")}
        />
        <MenuRow
          title="Gentle reminders"
          subtitle="A nudge, on your terms"
          icon="notifications-outline"
          onPress={() => app.navigate("reminders")}
        />
        <MenuRow
          title="What Solace remembers"
          subtitle="Inspect and manage approved preferences"
          icon="leaf-outline"
          onPress={() => app.navigate("memory")}
        />
        <MenuRow
          title="Settings"
          subtitle="Appearance, privacy and personalization"
          icon="options-outline"
          onPress={() => app.navigate("settings")}
        />
        <MenuRow
          title="Find human support"
          subtitle="Directories and local support resources"
          icon="heart-outline"
          onPress={() => app.navigate("support")}
        />
        <View
          style={{
            marginTop: 20,
            paddingTop: 22,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Row>
            <Petal size={42} />
            <AppText variant="heading">Your pace is enough.</AppText>
          </Row>
          <AppText
            variant="caption"
            color={colors.muted}
            style={{ marginTop: 10, lineHeight: 20 }}
          >
            Solace is an AI wellness companion. It is not a medical or emergency
            service.
          </AppText>
        </View>
      </Screen>
    );

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
          onPress={() => app.navigate("account")}
        />
        <Card>
          <AppText variant="heading">About Solace</AppText>
          <AppText style={{ marginTop: 8 }}>
            A calmer place to check in, talk, and take a small step. Version
            1.0.0.
          </AppText>
          <AppText variant="caption" style={{ marginTop: 12 }}>
            Your messages are processed by the server. When live AI is
            configured, your conversation and relevant consented context are
            sent to the configured provider. Avoid sharing information you do
            not want processed.
          </AppText>
        </Card>
        {status}
      </Screen>
    );

  if (name === "memory")
    return (
      <Screen title="What Solace remembers" back={app.back}>
        {heading(
          "You are in control",
          "Save what you want Solace to remember. When enabled, approved preferences and recent check-ins provide context.",
        )}
        <Card style={{ marginBottom: 20 }}>
          <Row>
            <View style={{ flex: 1 }}>
              <AppText variant="label">Use my approved preferences</AppText>
              <AppText variant="caption">
                You can turn this off at any time.
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
              onValueChange={(v) =>
                perform(async () => {
                  await app.updateUser({ personalization: v });
                })
              }
            />
          </Row>
        </Card>
        <SectionTitle title="Approved preferences" />
        {app.data.memories.length === 0 && (
          <Card>
            <AppText>
              No preferences saved yet. You can add one below, or save a useful
              preference after a Moment.
            </AppText>
          </Card>
        )}
        {app.data.memories.map((item) => (
          <Card key={item.id} style={{ marginBottom: 10 }}>
            <AppText>{item.text}</AppText>
            <Row style={{ marginTop: 10 }}>
              <Button
                title="Edit"
                variant="ghost"
                disabled={pending}
                onPress={() => {
                  setEditing(item.id!);
                  setPreference(item.text);
                }}
              />
              <Button
                title="Delete"
                variant="ghost"
                disabled={pending}
                onPress={() => setDeleteId(item.id!)}
              />
            </Row>
            {deleteId === item.id && (
              <View>
                <AppText>
                  Remove this preference from future conversations?
                </AppText>
                <Row style={{ marginTop: 10 }}>
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
                      })
                    }
                  />
                </Row>
              </View>
            )}
          </Card>
        ))}
        <View style={{ marginTop: 20 }}>
          <AppText variant="label">
            {editing ? "Edit preference" : "Add a preference"}
          </AppText>
          <Input
            accessibilityLabel="Preference"
            placeholder="For example: I prefer short grounding exercises"
            multiline
            value={preference}
            onChangeText={setPreference}
            maxLength={500}
            style={{ marginVertical: 12 }}
          />
          <Button
            title={editing ? "Save changes" : "Save preference"}
            disabled={!preference.trim() || pending}
            onPress={() =>
              perform(async () => {
                await app.save("memories", {
                  ...(editing ? { id: editing } : {}),
                  text: preference.trim(),
                });
                setEditing(null);
                setPreference("");
                setMessage("Preference saved.");
              })
            }
          />
          {editing && (
            <Button
              title="Cancel edit"
              variant="ghost"
              onPress={() => {
                setEditing(null);
                setPreference("");
              }}
            />
          )}
        </View>
        {status}
      </Screen>
    );

  if (name === "reminders")
    return (
      <Screen title="Gentle reminders" back={app.back}>
        {heading(
          "A moment, on your terms",
          "Choose when a small pause would fit your day.",
        )}
        <Card style={{ marginBottom: 18 }}>
          <Row>
            <View style={{ flex: 1 }}>
              <AppText variant="label">Enable reminder</AppText>
              <AppText variant="caption">
                Your notification preview stays private.
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
        <AppText variant="label">Time (24-hour, your device timezone)</AppText>
        <Input
          accessibilityLabel="Reminder time HH colon MM"
          placeholder="20:00"
          value={time}
          editable={!pending}
          onChangeText={setTime}
          keyboardType="numbers-and-punctuation"
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
        <Card style={{ marginBottom: 18 }}>
          <Row>
            <Petal size={40} />
            <View>
              <AppText variant="label">A moment for yourself</AppText>
              <AppText variant="caption">
                Your Solace reminder is ready.
              </AppText>
            </View>
          </Row>
        </Card>
        {Platform.OS === "web" && (
          <Notice text="This web preview saves preferences. Notification scheduling and delivery require the Android or iOS app." />
        )}
        <Button
          title={reminderId ? "Update reminder" : "Save reminder"}
          loading={pending}
          onPress={() =>
            perform(async () => {
              if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
                throw new Error(
                  "Enter a valid 24-hour time, such as 08:30 or 20:00.",
                );
              if (!selectedDays.length)
                throw new Error("Choose at least one day.");
              if (reminderType === "custom" && !reminderTitle.trim())
                throw new Error("Add a title for your custom reminder.");
              const [hour, minute] = time.split(":").map(Number);
              const record = {
                type: reminderType,
                title:
                  reminderType === "custom"
                    ? reminderTitle.trim()
                    : kinds.find((k) => k[0] === reminderType)![1],
                hour,
                minute,
                days: selectedDays,
                enabled,
              };
              const previousIds = reminderId
                ? await deviceReminderIds(String(app.user?.id), reminderId)
                : [];
              const result = await scheduleReminder(record);
              try {
                const saved = await app.save("reminders", {
                  ...(reminderId ? { id: reminderId } : {}),
                  ...record,
                  notificationIds: result.ids,
                  permission: result.permission,
                });
                await rememberDeviceSchedule(
                  String(app.user?.id),
                  String(saved.id),
                  result.ids,
                );
              } catch (e) {
                await cancelReminders(result.ids);
                throw e;
              }
              await cancelReminders(previousIds);
              setReminderId(null);
              setMessage(
                Platform.OS === "web"
                  ? "Preferences saved. Open the mobile app to schedule delivery."
                  : enabled
                    ? "Reminder scheduled on this device."
                    : "Reminder disabled.",
              );
            })
          }
        />
        <Button
          title="Send a test in 10 seconds"
          variant="ghost"
          disabled={pending || Platform.OS === "web"}
          onPress={() =>
            perform(async () => {
              await testNotification();
              setMessage(
                "Test scheduled. Close the app normally and tap the notification when it arrives.",
              );
            })
          }
        />
        {status}
        <View style={{ marginTop: 16 }}>
          <SectionTitle title="Your reminders" />
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
                {r.permission === "web-preview" ? " · Preferences only" : ""}
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
                      `${String(r.hour).padStart(2, "0")}:${String(r.minute).padStart(2, "0")}`,
                    );
                    setDays(r.days);
                    setEnabled(r.enabled);
                    setMessage(
                      "Editing reminder. Change the fields above, then save.",
                    );
                  }}
                />
                <Button
                  title="Delete"
                  variant="ghost"
                  disabled={pending}
                  onPress={() =>
                    perform(async () => {
                      await cancelReminders(
                        await deviceReminderIds(
                          String(app.user?.id),
                          String(r.id),
                        ),
                      );
                      await app.remove("reminders", r.id!);
                      if (reminderId === r.id) setReminderId(null);
                      setMessage("Reminder removed.");
                    })
                  }
                />
              </Row>
            </Card>
          ))}
        </View>
      </Screen>
    );

  if (name === "account")
    return (
      <Screen title="Your account" back={app.back}>
        {heading(
          "Your information",
          "Manage your account and the data you have saved.",
        )}
        <AppText variant="label">Name</AppText>
        <Input
          accessibilityLabel="Your name"
          value={accountName}
          onChangeText={setAccountName}
          maxLength={80}
          style={{ marginTop: 8, marginBottom: 12 }}
        />
        <AppText color={colors.muted} style={{ marginBottom: 20 }}>
          {app.user?.email}
        </AppText>
        <Button
          title="Save name"
          disabled={!accountName.trim()}
          loading={pending}
          onPress={() =>
            perform(async () => {
              await app.updateUser({ name: accountName.trim() });
              setMessage("Name updated.");
            })
          }
        />
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
          disabled={pending}
          onPress={() =>
            perform(async () => {
              await cancelAllReminders();
              await app.signOut();
            })
          }
        />
        <View style={{ marginTop: 35 }}>
          <AppText variant="heading" color={colors.danger}>
            Delete account
          </AppText>
          <AppText style={{ marginVertical: 12 }}>
            Permanently delete your account, conversations, preferences and
            activity records.
          </AppText>
          {!deleteAccount ? (
            <Button
              title="Delete my account…"
              variant="secondary"
              onPress={() => setDeleteAccount(true)}
            />
          ) : (
            <Card>
              <AppText>
                This cannot be undone. Delete all your Solace data?
              </AppText>
              <Button
                title="Keep my account"
                variant="ghost"
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
        {status}
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
