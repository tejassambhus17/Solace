import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  journalRevision,
  journalShareableText,
  type JournalAction,
  type JournalReflectionResult,
  type JournalSelection,
} from "../../server/src/journal-contract";
import { useReducedMotion } from "../Companion";
import { journalExcerpts } from "../journal-excerpts";
import { spacing } from "../layout";
import { isRecordId, routes } from "../routes";
import { newChatRequestId, useApp } from "../store";
import { useTheme } from "../theme";
import {
  AppText,
  BotanicalBackdrop,
  Button,
  Card,
  Icon,
  IconButton,
  Row,
  Screen,
} from "../ui";

const actions: { id: JournalAction; label: string; icon: string }[] = [
  { id: "reflect", label: "Reflect on this", icon: "sparkles-outline" },
  { id: "understand", label: "Understand my thoughts", icon: "bulb-outline" },
  { id: "question", label: "Ask me a question", icon: "help-circle-outline" },
  { id: "grounding", label: "Suggest grounding", icon: "leaf-outline" },
];

type ShareAction = JournalAction | "discuss";
type Consent = {
  action: ShareAction;
  entryId: string;
  index: number;
  selection: JournalSelection;
};

export function JournalReflectionScreen({
  focused = true,
}: {
  focused?: boolean;
}) {
  const app = useApp();
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const { bottom } = useSafeAreaInsets();
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const id = isRecordId(app.params.id) ? app.params.id : undefined;
  const discussOnly = app.params.intent === "discuss";
  const entry = id
    ? app.data.reflections.find((item) => item.id === id && !item.localOnly)
    : undefined;
  const body = entry ? journalShareableText(entry) : "";
  const revision = entry ? journalRevision(entry) : "";
  const sections = useMemo(() => journalExcerpts(body), [body]);
  const [section, setSection] = useState(0);
  const [consent, setConsent] = useState<Consent>();
  const [pending, setPending] = useState<ShareAction>();
  const [result, setResult] = useState<JournalReflectionResult>();
  const lastShownResult = useRef<JournalReflectionResult | undefined>(
    undefined,
  );
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const retry = useRef<{ selection: string; id: string } | undefined>(
    undefined,
  );
  const excerptIndex = Math.min(section, sections.length - 1);
  const excerpt = sections[excerptIndex];
  const activeConsent =
    consent?.entryId === id && consent?.selection.revision === revision
      ? consent
      : undefined;

  useEffect(() => {
    setSection(0);
    setResult(undefined);
    setError("");
    retry.current = undefined;
  }, [id, revision]);

  useEffect(() => {
    setConsent(undefined);
    setPending(undefined);
    return () => {
      request.current?.abort();
      request.current = null;
    };
  }, [focused, id, revision, app.user?.id]);

  const selectSection = (next: number) => {
    setSection(next);
    setResult(undefined);
    setError("");
  };

  function reviewShare(action: ShareAction) {
    if (!id || !excerpt || !focused || request.current) return;
    setConsent({
      action,
      entryId: id,
      index: excerptIndex,
      selection: { ...excerpt, revision },
    });
  }

  async function share() {
    if (!activeConsent || !focused || request.current) return;
    const controller = new AbortController();
    const { action, entryId, selection } = activeConsent;
    request.current = controller;
    setConsent(undefined);
    setPending(action);
    setResult(undefined);
    setError("");
    try {
      if (action === "discuss") {
        const key = JSON.stringify(selection);
        if (retry.current?.selection !== key)
          retry.current = { selection: key, id: newChatRequestId() };
        const response = await app.discussJournal(
          entryId,
          selection,
          retry.current.id,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        app.navigate(routes.companion, {
          id: response.conversation.id,
          fromJournal: entryId,
        });
      } else {
        const reflection = await app.reflectJournal(
          entryId,
          selection,
          action,
          controller.signal,
        );
        if (!controller.signal.aborted) setResult(reflection);
      }
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(
          failure instanceof Error
            ? failure.message
            : "Solace could not respond. Please try again.",
        );
    } finally {
      if (!controller.signal.aborted) setPending(undefined);
      if (request.current === controller) request.current = null;
    }
  }

  return (
    <Screen
      title={discussOnly ? "Discuss with Solace" : "Reflect with Solace"}
      back={app.back}
      style={styles.screen}
      scrollRef={scroll}
    >
      <BotanicalBackdrop />
      {!entry || !excerpt ? (
        <Card style={styles.section}>
          <AppText variant="heading">Choose a saved journal entry</AppText>
          <AppText color={colors.muted}>
            Once your writing is saved, you can choose an excerpt to share here.
          </AppText>
          <Button
            title="Back to Journal"
            variant="secondary"
            onPress={app.back}
          />
        </Card>
      ) : (
        <>
          <View style={styles.section}>
            <AppText variant="heading" accessibilityRole="header">
              Choose what to share
            </AppText>
            <AppText color={colors.muted}>
              Review the excerpt before asking for support. Your other writing
              stays private.
            </AppText>
            <Card
              style={[
                styles.excerpt,
                { backgroundColor: colors.lavenderSurface },
              ]}
            >
              <Row style={styles.privacy}>
                <Icon
                  name="lock-closed-outline"
                  color={colors.lavenderText}
                  size={16}
                />
                <AppText
                  variant="label"
                  color={colors.lavenderText}
                  style={styles.flex}
                >
                  {typeof entry.title === "string" && entry.title.trim()
                    ? entry.title
                    : "Journal excerpt"}
                </AppText>
              </Row>
              {sections.length > 1 && (
                <Row style={styles.pagination}>
                  <IconButton
                    name="chevron-back"
                    label="Previous excerpt"
                    disabled={excerptIndex === 0 || !!pending}
                    onPress={() => selectSection(excerptIndex - 1)}
                  />
                  <AppText
                    variant="caption"
                    color={colors.lavenderText}
                    style={styles.excerptCount}
                    accessibilityLiveRegion="polite"
                  >
                    Excerpt {excerptIndex + 1} of {sections.length}
                  </AppText>
                  <IconButton
                    name="chevron-forward"
                    label="Next excerpt"
                    disabled={excerptIndex >= sections.length - 1 || !!pending}
                    onPress={() => selectSection(excerptIndex + 1)}
                  />
                </Row>
              )}
              <AppText selectable>
                {body.slice(excerpt.start, excerpt.end).trim()}
              </AppText>
            </Card>
          </View>
          {(!!pending || !!error) && (
            <View
              key={pending ? "pending" : "error"}
              style={styles.section}
              onLayout={({ nativeEvent }) => {
                if (focused)
                  scroll.current?.scrollTo({
                    y: Math.max(0, nativeEvent.layout.y - spacing.card),
                    animated: !reducedMotion,
                  });
              }}
            >
              {pending ? (
                <>
                  <Row>
                    <ActivityIndicator color={colors.lavenderText} />
                    <AppText
                      accessibilityLiveRegion="polite"
                      color={colors.muted}
                      style={styles.flex}
                    >
                      {pending === "discuss"
                        ? "Opening a conversation…"
                        : "Preparing your reflection…"}
                    </AppText>
                  </Row>
                  <Button
                    title="Cancel request"
                    variant="secondary"
                    onPress={() => {
                      request.current?.abort();
                      request.current = null;
                      setPending(undefined);
                    }}
                  />
                </>
              ) : (
                <AppText accessibilityRole="alert" color={colors.danger}>
                  {error}
                </AppText>
              )}
            </View>
          )}
          {!pending && (
            <View style={styles.section}>
              {!discussOnly && (
                <AppText variant="heading" accessibilityRole="header">
                  How can Solace help?
                </AppText>
              )}
              {!discussOnly &&
                actions.map(({ id: action, label, icon }) => (
                  <Pressable
                    key={action}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    onPress={() => reviewShare(action)}
                    style={({ pressed }) => [
                      styles.action,
                      {
                        borderColor: colors.border,
                        backgroundColor: pressed
                          ? colors.surface2
                          : "transparent",
                      },
                    ]}
                  >
                    <Icon name={icon} size={20} color={colors.lavenderText} />
                    <AppText variant="label" style={styles.flex}>
                      {label}
                    </AppText>
                    <Icon
                      name="chevron-forward-outline"
                      size={17}
                      color={colors.muted}
                    />
                  </Pressable>
                ))}
              <Button
                title="Discuss with Solace"
                icon="chatbubble-outline"
                onPress={() => reviewShare("discuss")}
              />
            </View>
          )}
          {result && (
            <View
              onLayout={({ nativeEvent }) => {
                if (!focused || lastShownResult.current === result) return;
                lastShownResult.current = result;
                scroll.current?.scrollTo({
                  y: Math.max(0, nativeEvent.layout.y - spacing.card),
                  animated: !reducedMotion,
                });
              }}
            >
              <Card style={styles.section}>
                <AppText variant="heading" accessibilityRole="header">
                  {result.provider === "live"
                    ? "A reflection from Solace"
                    : "Support right now"}
                </AppText>
                <AppText accessibilityLiveRegion="polite" selectable>
                  {result.reflection}
                </AppText>
                {result.provider === "live" && result.practice && (
                  <Button
                    title="Open grounding practice"
                    icon="leaf-outline"
                    variant="secondary"
                    onPress={() =>
                      app.navigate(routes.technique, {
                        id: result.practice,
                        source: "journal",
                      })
                    }
                  />
                )}
                {result.provider === "offline" && (
                  <Button
                    title="Find support"
                    variant="secondary"
                    onPress={() => app.navigate(routes.support)}
                  />
                )}
              </Card>
            </View>
          )}
        </>
      )}
      <Modal
        transparent
        visible={focused && !!activeConsent}
        onRequestClose={() => setConsent(undefined)}
        animationType={reducedMotion ? "none" : "fade"}
      >
        <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
          <Pressable
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            onPress={() => setConsent(undefined)}
            style={StyleSheet.absoluteFill}
          />
          <View
            accessibilityViewIsModal
            style={[styles.sheet, { backgroundColor: colors.surface }]}
          >
            <ScrollView
              contentContainerStyle={[
                styles.section,
                {
                  padding: spacing.section,
                  paddingBottom: spacing.section + bottom,
                },
              ]}
            >
              <AppText variant="heading" accessibilityRole="header">
                Share this excerpt?
              </AppText>
              <AppText color={colors.muted}>
                Solace sends only this excerpt to its configured AI service.
                Your journal and AI memory stay separate.
              </AppText>
              {activeConsent && (
                <View
                  style={[
                    styles.consentExcerpt,
                    {
                      backgroundColor: colors.lavenderSurface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <AppText variant="label" color={colors.lavenderText}>
                    {sections.length > 1
                      ? `Excerpt ${activeConsent.index + 1} of ${sections.length}`
                      : "Selected excerpt"}
                  </AppText>
                  <AppText variant="caption" numberOfLines={3}>
                    {body
                      .slice(
                        activeConsent.selection.start,
                        activeConsent.selection.end,
                      )
                      .trim()}
                  </AppText>
                </View>
              )}
              <AppText color={colors.muted}>
                {activeConsent?.action === "discuss"
                  ? "A separate conversation and its replies are saved in chat history. Delete that conversation to remove its replies."
                  : "Read the AI reflection here alongside your original entry."}
              </AppText>
              <Button
                title={
                  activeConsent?.action === "discuss"
                    ? "Share and open Companion"
                    : "Share and continue"
                }
                onPress={() => void share()}
              />
              <Button
                title="Keep private"
                variant="secondary"
                onPress={() => setConsent(undefined)}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.section },
  section: { gap: spacing.row },
  excerpt: { gap: spacing.row },
  privacy: { gap: spacing.compact },
  flex: { flex: 1 },
  pagination: { justifyContent: "space-between" },
  excerptCount: { flex: 1, textAlign: "center" },
  consentExcerpt: {
    borderWidth: 1,
    borderRadius: 14,
    padding: spacing.row,
    gap: 4,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.row,
    paddingVertical: spacing.row,
    paddingHorizontal: spacing.card,
    borderWidth: 1,
    borderRadius: 16,
    minHeight: 48,
  },
  backdrop: { flex: 1, justifyContent: "flex-end", alignItems: "center" },
  sheet: {
    width: "100%",
    maxWidth: 600,
    maxHeight: "86%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
});
