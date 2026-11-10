import React, { useRef, useState } from "react";
import { Platform, StyleSheet, Switch, View } from "react-native";
import { checkinRecommendation } from "../checkin-recommendation";
import { spacing } from "../layout";
import { isRecordId, routes } from "../routes";
import { useApp, type Item } from "../store";
import { techniqueArtwork } from "../technique-artwork";
import { useTheme } from "../theme";
import { AppText, Button, Card, moodPetals, Row } from "../ui";
import { SolaceRecommendationCard } from "./SolaceRecommendationCard";

export function CheckinNextStep({ checkin }: { checkin: Item }) {
  const app = useApp();
  const { colors } = useTheme();
  const [reviewing, setReviewing] = useState(false);
  const [includeNote, setIncludeNote] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const opening = useRef(false);
  const openingChat = useRef(false);
  const petal = moodPetals.find(({ mood }) => mood === checkin.mood);
  const [recommendation] = useState(() =>
    checkinRecommendation(checkin.mood, app.data, app.user),
  );

  const note = typeof checkin.note === "string" ? checkin.note.trim() : "";
  const moodMessage = petal
    ? `I’m feeling ${petal.mood.toLowerCase()} today.`
    : "I’d like to talk about my check-in.";
  const preview =
    includeNote && note ? `${moodMessage}\n\n${note}` : moodMessage;
  const existing = app.chatDrafts.new ?? "";
  const hasDraft = Boolean(existing.trim());
  const next = hasDraft ? `${existing}\n\n${preview}` : preview;
  const tooLong = next.length > 4000;
  const pending = Boolean(app.chatPending.new);

  function openCompanion(addCheckin: boolean) {
    if (openingChat.current || (addCheckin && (tooLong || pending))) return;
    openingChat.current = true;
    if (addCheckin) app.setChatDraft("new", next);
    app.navigate(
      routes.companion,
      addCheckin && isRecordId(checkin.id)
        ? { originCheckinId: checkin.id }
        : {},
    );
  }

  if (reviewing) {
    return (
      <View style={styles.actions}>
        <Card style={styles.card}>
          <AppText accessibilityRole="header" variant="heading">
            Review your check-in
          </AppText>
          <AppText color={colors.muted}>
            You can edit this in Companion. Solace receives it only when you tap
            Send.
          </AppText>
          {note !== "" && (
            <Row style={styles.noteRow}>
              <AppText variant="label" style={styles.flex}>
                Include my note
              </AppText>
              <Switch
                accessibilityLabel="Include my note"
                value={includeNote}
                onValueChange={setIncludeNote}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={includeNote ? colors.primaryText : colors.muted}
                {...(Platform.OS === "web" && {
                  activeThumbColor: colors.primaryText,
                })}
              />
            </Row>
          )}
          <AppText
            style={[
              styles.preview,
              { backgroundColor: colors.lavenderSurface },
            ]}
          >
            {preview}
          </AppText>
          {(hasDraft || pending) && (
            <AppText variant="caption" color={colors.muted}>
              {pending
                ? "Companion is replying. You can open it to follow the conversation."
                : "You already have an unsent draft. You can add this check-in to it or open it as it is."}
            </AppText>
          )}
          {tooLong && (
            <AppText variant="caption" color={colors.danger}>
              {hasDraft
                ? "This would exceed the message limit. Open your draft to make room, or leave the note out."
                : "This note is too long for one message. Leave it out to continue with just your mood."}
            </AppText>
          )}
          <Button
            title={hasDraft ? "Add to my draft" : "Continue to Companion"}
            disabled={tooLong || pending}
            onPress={() => openCompanion(true)}
          />
          {(hasDraft || pending) && (
            <Button
              title={pending ? "Open Companion" : "Open my draft"}
              variant="secondary"
              onPress={() => openCompanion(false)}
            />
          )}
        </Card>
        <Button
          title="Back to next steps"
          variant="ghost"
          onPress={() => {
            openingChat.current = false;
            setIncludeNote(false);
            setReviewing(false);
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.actions}>
      {recommendation && !dismissed && (
        <SolaceRecommendationCard
          title={recommendation.title}
          description={recommendation.description}
          durationSec={recommendation.durationSec}
          selfPaced={recommendation.selfPaced}
          artwork={techniqueArtwork[recommendation.artwork]}
          reason={recommendation.reason}
          startLabel={recommendation.startLabel}
          onStart={() => {
            if (opening.current) return;
            opening.current = true;
            setDismissed(true);
            app.navigate(recommendation.route, {
              ...recommendation.params,
              source: "today",
              ...(isRecordId(checkin.id) && { originCheckinId: checkin.id }),
              startOnArrival: true,
            });
          }}
          onDismiss={() => setDismissed(true)}
        />
      )}
      <Button
        title="Talk with Solace"
        variant="secondary"
        icon="chatbubble-ellipses-outline"
        onPress={() => setReviewing(true)}
      />
      <Button
        title="Write a reflection"
        variant="secondary"
        icon="pencil-outline"
        onPress={() => app.navigate("reflection")}
      />
      <Button
        title="Back to Today"
        variant="ghost"
        onPress={() => app.navigate(routes.today)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.row },
  card: { gap: spacing.row },
  flex: { flex: 1 },
  noteRow: { minHeight: 48 },
  preview: { padding: spacing.row, borderRadius: 14 },
});
