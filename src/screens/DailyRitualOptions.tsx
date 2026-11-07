import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import {
  ritualActivities,
  ritualDurations,
  type DailyRitualSettings,
  type RitualActivity,
  type RitualDuration,
} from "../../server/src/ritual-contract";
import { spacing } from "../layout";
import { useApp } from "../store";
import { useTheme } from "../theme";
import { AppText, Button, Icon, Row } from "../ui";

const activityLabels: Record<RitualActivity, string> = {
  breathing: "Breathing",
  grounding: "Grounding",
  reflection: "Reflection",
  rest: "Rest",
};

function RitualOption({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        {
          backgroundColor: selected ? colors.sageSurface : colors.surface,
          borderColor: selected ? colors.sageText : colors.border,
          opacity: pressed || disabled ? 0.65 : 1,
        },
      ]}
    >
      <AppText variant="label" color={selected ? colors.sageText : colors.text}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function DailyRitualOptions({
  heading,
  children,
  reasonAction,
  settings,
  canSkip,
}: {
  heading: React.ReactNode;
  children: React.ReactNode;
  reasonAction?: React.ReactNode;
  settings: DailyRitualSettings;
  canSkip: boolean;
}) {
  const app = useApp();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [activity, setActivity] = useState<RitualActivity>();
  const [duration, setDuration] = useState<RitualDuration>();
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState("");
  const lock = useRef(false);
  const dirty =
    activity !== settings.activity || duration !== settings.durationMinutes;

  async function save(changes: Partial<DailyRitualSettings>, close = false) {
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setFailure("");
    try {
      await app.save("preferences", {
        id: "wellness",
        dailyRitual: { ...settings, ...changes },
      });
      if (close) setOpen(false);
    } catch (error) {
      // Refresh once after a competing create or a lost create response.
      // A second explicit attempt can then PATCH the existing record.
      if ((error as { status?: number }).status === 409)
        await app.refresh().catch(() => {});
      setFailure("Couldn’t save your daily pause settings. Please try again.");
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }

  return (
    <View style={styles.layout}>
      <Row style={styles.header}>
        {heading}
        {settings.enabled && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Customize daily pause"
            accessibilityState={{ expanded: open, disabled: saving }}
            disabled={saving}
            onPress={() => {
              if (!open) {
                setActivity(settings.activity);
                setDuration(settings.durationMinutes);
              }
              setOpen(!open);
            }}
            style={({ pressed }) => [
              styles.textAction,
              styles.customize,
              pressed && styles.pressed,
            ]}
          >
            <AppText
              variant="label"
              color={colors.lavenderText}
              style={styles.actionLabel}
            >
              Customize
            </AppText>
            <Icon
              name={open ? "chevron-up" : "chevron-down"}
              size={15}
              color={colors.lavenderText}
            />
          </Pressable>
        )}
      </Row>
      {children}
      {settings.enabled ? (
        (reasonAction || canSkip) && (
          <Row style={styles.supportActions}>
            {reasonAction}
            {canSkip && (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: saving }}
                disabled={saving}
                onPress={() =>
                  void save({ skipPractice: !settings.skipPractice })
                }
                style={({ pressed }) => [
                  styles.textAction,
                  pressed && styles.pressed,
                ]}
              >
                <AppText
                  variant="caption"
                  color={colors.muted}
                  style={styles.actionLabel}
                >
                  {settings.skipPractice
                    ? "Include a Moment today"
                    : "Skip today’s Moment"}
                </AppText>
              </Pressable>
            )}
          </Row>
        )
      ) : (
        <Button
          title="Turn on daily pause"
          variant="secondary"
          loading={saving}
          onPress={() => void save({ enabled: true })}
        />
      )}
      {open && settings.enabled && (
        <View style={[styles.choices, { borderColor: colors.heroBorder }]}>
          <AppText variant="caption" color={colors.muted}>
            Daily Pause builds its suggestion on this device. With
            personalization on, it can use your active Journey goal and activity
            preferences you choose to remember.
          </AppText>
          <AppText variant="label">Today’s activity</AppText>
          <Row style={styles.wrap}>
            <RitualOption
              label="Suggested"
              selected={!activity}
              disabled={saving}
              onPress={() => setActivity(undefined)}
            />
            {ritualActivities.map((item) => (
              <RitualOption
                key={item}
                label={activityLabels[item]}
                selected={activity === item}
                disabled={saving}
                onPress={() => setActivity(item)}
              />
            ))}
          </Row>
          <AppText variant="label">Today’s duration</AppText>
          <Row style={styles.wrap}>
            <RitualOption
              label="Suggested"
              selected={!duration}
              disabled={saving}
              onPress={() => setDuration(undefined)}
            />
            {ritualDurations.map((minutes) => (
              <RitualOption
                key={minutes}
                label={`${minutes} min`}
                selected={duration === minutes}
                disabled={saving}
                onPress={() => setDuration(minutes)}
              />
            ))}
          </Row>
          <Button
            title="Save today’s choices"
            variant="secondary"
            disabled={!dirty}
            loading={saving}
            onPress={() =>
              void save(
                { activity, durationMinutes: duration, skipPractice: false },
                true,
              )
            }
          />
          <Button
            title="Turn off daily pause"
            variant="ghost"
            disabled={saving}
            onPress={() => void save({ enabled: false }, true)}
          />
        </View>
      )}
      {!!failure && (
        <AppText
          variant="caption"
          color={colors.danger}
          accessibilityRole="alert"
        >
          {failure}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  layout: { gap: spacing.compact },
  header: { gap: spacing.compact },
  supportActions: {
    flexWrap: "wrap",
    justifyContent: "space-between",
    columnGap: spacing.row,
    rowGap: 0,
  },
  wrap: { flexWrap: "wrap", gap: spacing.compact },
  option: {
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: spacing.row,
    paddingVertical: spacing.compact,
  },
  textAction: {
    flexDirection: "row",
    gap: 4,
    minHeight: 48,
    alignItems: "center",
    maxWidth: "100%",
    paddingVertical: 4,
  },
  customize: { maxWidth: "43%", minWidth: 48, justifyContent: "flex-end" },
  actionLabel: { flexShrink: 1, fontSize: 12, lineHeight: 17 },
  pressed: { opacity: 0.7 },
  choices: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.row,
    gap: spacing.row,
  },
});
