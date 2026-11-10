import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, Switch, View } from "react-native";
import { ENVIRONMENTS } from "../Environment";
import { spacing } from "../layout";
import type { MomentEnvironment } from "../moments";
import { webRadioProps } from "../radio-keyboard";
import { useApp } from "../store";
import { switchColors } from "../switch-colors";
import { useTheme } from "../theme";
import { AppText, Button, Card, Icon, NestedHeader, Screen } from "../ui";

export function AmbientSoundPreferences() {
  const app = useApp();
  const { colors } = useTheme();
  const saved = app.data.preferences.find(({ id }) => id === "wellness");
  const savedEnabled = saved?.ambientEnabled === true;
  const savedEnvironment = ENVIRONMENTS.find(
    ({ id }) => id === saved?.environment,
  )?.id;
  const [enabled, setEnabled] = useState(savedEnabled);
  const [environment, setEnvironment] = useState<MomentEnvironment | undefined>(
    savedEnvironment,
  );
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    message: string;
    error?: boolean;
  }>();
  const saveLock = useRef(false);
  const dirty = enabled !== savedEnabled || environment !== savedEnvironment;

  async function save() {
    if (!dirty || saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    setFeedback(undefined);
    try {
      await app.save("preferences", {
        id: "wellness",
        ...(enabled !== savedEnabled ? { ambientEnabled: enabled } : {}),
        ...(environment && environment !== savedEnvironment
          ? { environment }
          : {}),
      });
      setFeedback({ message: "Ambient sound preferences saved." });
    } catch (error) {
      if ((error as { status?: number }).status === 409)
        await app.refresh().catch(() => {});
      setFeedback({
        message: "Couldn’t save your sound preferences. Please try again.",
        error: true,
      });
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  return (
    <Screen variant="nested">
      <NestedHeader
        title="Ambient sound"
        subtitle="Choose a starting sound for practices and Solace Moments."
        onBack={app.back}
        ariaLabel="Back to Appearance & preferences"
      />
      <View style={styles.groups}>
        <Card style={styles.toggleRow}>
          <View style={styles.copy}>
            <AppText variant="label">Start with ambient sound</AppText>
            <AppText variant="caption" color={colors.muted}>
              Play as the practice begins.
            </AppText>
          </View>
          <View style={styles.switchControl}>
            <Switch
              accessibilityLabel="Start with ambient sound"
              value={enabled}
              disabled={saving}
              {...switchColors(colors, enabled)}
              onValueChange={(value) => {
                setEnabled(value);
                setFeedback(undefined);
              }}
            />
          </View>
        </Card>
        <View style={styles.section}>
          <AppText accessibilityRole="header" variant="heading">
            Preferred sound
          </AppText>
          <AppText variant="caption" color={colors.muted}>
            Until you choose a sound, each practice uses the one that matches
            its scene.
          </AppText>
          <Card style={styles.options}>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="Preferred sound"
            >
              {ENVIRONMENTS.map(({ id, title, sound, icon }, index) => {
                const selected = environment === id;
                return (
                  <Pressable
                    key={id}
                    accessibilityRole="radio"
                    accessibilityLabel={title}
                    accessibilityHint={sound}
                    accessibilityState={{ checked: selected, disabled: saving }}
                    aria-checked={selected}
                    {...webRadioProps(
                      selected || (!environment && index === 0),
                    )}
                    disabled={saving}
                    onPress={() => {
                      setEnvironment(id);
                      setFeedback(undefined);
                    }}
                    style={({ pressed }) => [
                      styles.option,
                      index > 0 && {
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderColor: colors.border,
                      },
                      selected && { backgroundColor: colors.lavenderSurface },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Icon name={icon} size={20} color={colors.lavenderText} />
                    <View style={styles.copy}>
                      <AppText variant="label">{title}</AppText>
                      <AppText variant="caption" color={colors.muted}>
                        {sound}
                      </AppText>
                    </View>
                    <Icon
                      name={
                        selected
                          ? "radio-button-on-outline"
                          : "radio-button-off-outline"
                      }
                      size={22}
                      color={selected ? colors.lavenderText : colors.muted}
                    />
                  </Pressable>
                );
              })}
            </View>
          </Card>
        </View>
        <View style={styles.section}>
          <Button
            title="Save sound preferences"
            disabled={!dirty}
            loading={saving}
            onPress={() => void save()}
          />
          {feedback && (
            <AppText
              variant="caption"
              color={feedback.error ? colors.danger : colors.muted}
              accessibilityRole={feedback.error ? "alert" : undefined}
              accessibilityLiveRegion="polite"
            >
              {feedback.message}
            </AppText>
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  groups: { gap: spacing.card },
  section: { gap: spacing.compact },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: spacing.row },
  switchControl: { minHeight: 48, flexShrink: 0, justifyContent: "center" },
  options: { padding: 0, overflow: "hidden" },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.row,
    minHeight: 56,
    paddingVertical: spacing.compact,
    paddingHorizontal: spacing.card,
  },
});
