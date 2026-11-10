import React, { useRef, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Companion } from "../Companion";
import { spacing } from "../layout";
import {
  emotionalRecheckChoices,
  emotionalRecheckLabel,
  type EmotionalRecheckResponse,
} from "../practice-follow-up";
import { webRadioProps } from "../radio-keyboard";
import { isRecordId } from "../routes";
import { useApp, type Item } from "../store";
import { useTheme } from "../theme";
import { AppText, Button, Card, coverImageStyle, Icon } from "../ui";

const scenes = {
  light: require("../../assets/voice-companion-dawn.jpg"),
  dark: require("../../assets/voice-companion-night.jpg"),
};

export function PracticeCompletion({ session }: { session: Item }) {
  const app = useApp();
  const { colors, resolved } = useTheme();
  const current =
    app.data.sessions.find(({ id }) => id === session.id) ?? session;
  const savedLabel = emotionalRecheckLabel(current.emotionalRecheck?.response);
  const [response, setResponse] = useState<EmotionalRecheckResponse>();
  const [confirmed, setConfirmed] = useState<string>();
  const [skipped, setSkipped] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submission = useRef<Item | undefined>(undefined);
  const locked = useRef(false);
  const id = isRecordId(current.id) ? current.id : undefined;
  const saved = savedLabel ?? confirmed;
  const seconds = Math.max(
    0,
    Math.floor(
      Number(
        current.durationSec ?? current.durationSeconds ?? current.duration,
      ) || 0,
    ),
  );
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  const duration = minutes
    ? `${minutes} min${remainder ? ` ${remainder} sec` : ""}`
    : `${seconds} sec`;
  const canRecheck =
    id &&
    current.completed === true &&
    current.type !== "resource" &&
    seconds > 0;

  async function saveRecheck() {
    if (!canRecheck || !response || locked.current || saved) return;
    locked.current = true;
    setSaving(true);
    setError("");
    submission.current ??= {
      id,
      emotionalRecheck: { response, recordedAt: new Date().toISOString() },
    };
    try {
      const updated = await app.save("sessions", submission.current);
      const label = emotionalRecheckLabel(updated.emotionalRecheck?.response);
      if (!label) throw new Error("The response couldn’t be confirmed.");
      setConfirmed(label);
    } catch {
      setError("Your practice is saved. Try again to confirm this response.");
    } finally {
      locked.current = false;
      setSaving(false);
    }
  }

  return (
    <Card
      style={[
        styles.card,
        {
          backgroundColor: colors.lavenderSurface,
          borderColor: colors.heroBorder,
        },
      ]}
    >
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <AppText variant="caption" color={colors.lavenderText}>
            Saved to Journey
          </AppText>
          <AppText accessibilityRole="header" variant="heading">
            {current.title || "Practice complete"}
          </AppText>
          <AppText color={colors.muted}>{duration} of active time</AppText>
        </View>
        <View
          aria-hidden
          style={[styles.scene, { backgroundColor: colors.surface }]}
        >
          <Image
            source={scenes[resolved ?? "light"]}
            resizeMode="cover"
            accessible={false}
            style={coverImageStyle}
          />
          <Companion state="idle" size={55} />
        </View>
      </View>
      {saved ? (
        <AppText accessibilityLiveRegion="polite" color={colors.sageText}>
          Response saved · {saved}
        </AppText>
      ) : canRecheck && !skipped ? (
        <View style={styles.questions}>
          <AppText accessibilityRole="header" variant="heading">
            How do you feel after this moment?
          </AppText>
          <AppText variant="caption" color={colors.muted}>
            Optional. Whatever you notice is welcome.
          </AppText>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="How you feel after practice"
            style={styles.choices}
          >
            {emotionalRecheckChoices.map((choice, index) => {
              const selected = response === choice.id;
              const disabled = !!submission.current;
              const ink = selected ? colors.lavenderActionText : colors.text;
              return (
                <Pressable
                  key={choice.id}
                  accessibilityRole="radio"
                  accessibilityLabel={choice.label}
                  accessibilityState={{ checked: selected, disabled }}
                  aria-checked={selected}
                  {...webRadioProps(selected || (!response && index === 0))}
                  disabled={disabled}
                  onPress={() => setResponse(choice.id)}
                  style={({ pressed }) => [
                    styles.choice,
                    {
                      borderColor: selected ? colors.accent : colors.border,
                      backgroundColor: selected
                        ? colors.lavenderAction
                        : colors.surface,
                      opacity: pressed ? 0.82 : 1,
                    },
                  ]}
                >
                  <Icon name={choice.icon} size={19} color={ink} />
                  <AppText style={styles.choiceText} color={ink}>
                    {choice.label}
                  </AppText>
                  <Icon
                    name={selected ? "checkmark-circle" : "ellipse-outline"}
                    size={18}
                    color={selected ? colors.lavenderActionText : colors.muted}
                  />
                </Pressable>
              );
            })}
          </View>
          {!!error && (
            <AppText accessibilityRole="alert" color={colors.danger}>
              {error}
            </AppText>
          )}
          <View style={styles.actions}>
            <Button
              title={error ? "Retry response" : "Continue"}
              onPress={() => void saveRecheck()}
              disabled={!response || saving}
              loading={saving}
            />
            <Button
              title="Skip"
              variant="ghost"
              disabled={saving}
              onPress={() => setSkipped(true)}
            />
          </View>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.card, marginBottom: spacing.row },
  headingRow: { flexDirection: "row", alignItems: "center", gap: spacing.row },
  headingCopy: { flex: 1, minWidth: 0, gap: 4 },
  scene: {
    width: 76,
    height: 78,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  questions: { gap: 6 },
  choices: { gap: 8, marginTop: spacing.compact },
  choice: {
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  choiceText: { flex: 1 },
  actions: { marginTop: spacing.compact, gap: 3 },
});
