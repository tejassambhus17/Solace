import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { localDay } from "../content";
import {
  journalCalendarDate,
  journalCalendarDays,
  journalCalendarMonth,
  savedJournalByDay,
} from "../journal-calendar";
import { spacing } from "../layout";
import type { Item } from "../store";
import { useTheme } from "../theme";
import { AppText, Button, Icon, IconButton, Row } from "../ui";

const weekdayFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
});
const weekdays = Array.from({ length: 7 }, (_, index) =>
  weekdayFormatter.format(new Date(2024, 0, 7 + index, 12)),
);
const dayFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "full" });
const monthFormatter = new Intl.DateTimeFormat(undefined, {
  month: "long",
  year: "numeric",
});

export function JournalCalendar({
  day,
  records,
  newDraftDay,
  offline,
  onClose,
  onOpenEntry,
  onWrite,
}: {
  day: string;
  records: readonly Item[];
  newDraftDay?: string;
  offline: boolean;
  onClose: () => void;
  onOpenEntry: (id: string) => void;
  onWrite: (day: string) => void;
}) {
  const { colors, resolved } = useTheme();
  const insets = useSafeAreaInsets();
  const { fontScale, width } = useWindowDimensions();
  const [selected, setSelected] = useState(day);
  const [month, setMonth] = useState(() =>
    journalCalendarMonth(journalCalendarDate(day)),
  );
  const saved = useMemo(() => savedJournalByDay(records), [records]);
  const dates = useMemo(() => journalCalendarDays(month), [month]);
  const today = localDay();
  const monthTitle = monthFormatter.format(month);
  const entries = saved.get(selected);
  const selectedTitle = dayFormatter.format(journalCalendarDate(selected));
  const currentMonth = selected.slice(0, 7) === localDay(month).slice(0, 7);
  const canWrite =
    selected <= today && (!newDraftDay || newDraftDay === selected);
  const availableWidth = width - insets.left - insets.right;
  // Seven 44-point columns fit at 320 with smaller outer gutters. Keep
  // horizontal scrolling at large text sizes or when those targets cannot fit.
  const compactLightGrid =
    resolved === "light" &&
    availableWidth >= 318 &&
    availableWidth < 354 &&
    fontScale <= 1.35;
  const gutter = compactLightGrid ? 4 : spacing.compact;
  const cellWidth = Math.max(
    compactLightGrid ? 44 : 48,
    Math.ceil(31 * fontScale),
  );
  const panelWidth = Math.min(460, availableWidth - 2 * gutter);
  const gridWidth = Math.max(panelWidth - 2, cellWidth * 7);

  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.modal,
          {
            paddingTop: insets.top + spacing.compact,
            paddingBottom: insets.bottom + spacing.compact,
            paddingLeft: insets.left + gutter,
            paddingRight: insets.right + gutter,
          },
        ]}
      >
        <Pressable
          accessible={false}
          importantForAccessibility="no"
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.panel,
            {
              width: panelWidth,
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Row style={styles.header}>
            <AppText
              variant="heading"
              accessibilityRole="header"
              style={styles.fill}
            >
              Journal calendar
            </AppText>
            <IconButton
              name="close"
              label="Close journal calendar"
              size={48}
              onPress={onClose}
            />
          </Row>
          <ScrollView
            style={styles.content}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            <Row style={styles.month}>
              <IconButton
                name="chevron-back"
                label="Previous month"
                size={48}
                onPress={() =>
                  setMonth((value) => journalCalendarMonth(value, -1))
                }
              />
              <AppText
                variant="label"
                accessibilityLiveRegion="polite"
                style={[styles.fill, styles.center]}
              >
                {monthTitle}
              </AppText>
              <IconButton
                name="chevron-forward"
                label="Next month"
                size={48}
                onPress={() =>
                  setMonth((value) => journalCalendarMonth(value, 1))
                }
              />
            </Row>
            <ScrollView horizontal directionalLockEnabled nestedScrollEnabled>
              <View style={{ width: gridWidth }}>
                <View accessible={false} style={styles.week}>
                  {weekdays.map((weekday, index) => (
                    <View key={index} style={styles.cell}>
                      <AppText
                        variant="caption"
                        color={colors.muted}
                        style={styles.center}
                      >
                        {weekday}
                      </AppText>
                    </View>
                  ))}
                </View>
                {Array.from({ length: dates.length / 7 }, (_, week) => (
                  <View key={week} style={styles.week}>
                    {dates.slice(week * 7, week * 7 + 7).map((date, index) => {
                      if (!date)
                        return <View key={index} style={styles.cell} />;
                      const count = saved.get(date)?.length ?? 0;
                      const isToday = date === today;
                      const active = date === selected;
                      return (
                        <Pressable
                          key={date}
                          accessibilityRole="button"
                          accessibilityLabel={`${dayFormatter.format(journalCalendarDate(date))}${isToday ? ", today" : ""}${count ? `, ${count} saved ${count === 1 ? "entry" : "entries"}` : ""}`}
                          accessibilityState={{ selected: active }}
                          onPress={() => setSelected(date)}
                          style={({ pressed }) => [
                            styles.cell,
                            styles.date,
                            {
                              backgroundColor: active
                                ? colors.lavenderSurface
                                : "transparent",
                              borderColor: isToday
                                ? colors.accent
                                : "transparent",
                              opacity: pressed ? 0.72 : 1,
                            },
                          ]}
                        >
                          <AppText
                            variant="label"
                            color={active ? colors.lavenderText : colors.text}
                          >
                            {Number(date.slice(-2))}
                          </AppText>
                          <View
                            style={[
                              styles.dot,
                              count > 0 && { backgroundColor: colors.accent },
                            ]}
                          />
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            </ScrollView>
            <View style={[styles.details, { borderTopColor: colors.border }]}>
              {offline && (
                <AppText variant="caption" color={colors.muted}>
                  Showing saved entries available on this device.
                </AppText>
              )}
              {currentMonth ? (
                <>
                  <AppText
                    variant="label"
                    accessibilityRole="header"
                    accessibilityLiveRegion="polite"
                  >
                    {selectedTitle}
                  </AppText>
                  {entries ? (
                    entries.map((entry) => (
                      <Pressable
                        key={entry.id}
                        accessibilityRole="button"
                        onPress={() => onOpenEntry(entry.id!)}
                        style={({ pressed }) => [
                          styles.entry,
                          {
                            backgroundColor: colors.surface2,
                            opacity: pressed ? 0.72 : 1,
                          },
                        ]}
                      >
                        <Icon
                          name="book-outline"
                          size={19}
                          color={colors.lavenderText}
                        />
                        <AppText variant="label" style={styles.fill}>
                          {(typeof entry.title === "string" &&
                            entry.title.trim()) ||
                            "Untitled entry"}
                        </AppText>
                        <Icon
                          name="chevron-forward"
                          size={18}
                          color={colors.muted}
                        />
                      </Pressable>
                    ))
                  ) : (
                    <>
                      <AppText variant="caption" color={colors.muted}>
                        {selected > today
                          ? "You can write for today or an earlier date."
                          : !canWrite
                            ? "Your current draft is safe. Finish it before starting an entry for a different date."
                            : "No saved entries for this day."}
                      </AppText>
                      {canWrite && (
                        <Button
                          title={
                            newDraftDay ? "Continue draft" : "Write an entry"
                          }
                          icon="pencil-outline"
                          onPress={() => onWrite(selected)}
                        />
                      )}
                    </>
                  )}
                </>
              ) : (
                <AppText variant="caption" color={colors.muted}>
                  Choose a date to see its journal entries.
                </AppText>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, alignItems: "center", justifyContent: "center" },
  panel: {
    flexShrink: 1,
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
  },
  header: {
    paddingLeft: spacing.card,
    paddingRight: spacing.compact,
    paddingTop: spacing.compact,
  },
  content: { flexGrow: 0, flexShrink: 1 },
  fill: { flex: 1, minWidth: 0 },
  month: { paddingHorizontal: spacing.compact },
  center: { textAlign: "center" },
  week: { flexDirection: "row", alignItems: "stretch" },
  cell: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  date: { minHeight: 48, borderRadius: 16, borderWidth: 1, gap: 3 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  details: {
    borderTopWidth: 1,
    padding: spacing.card,
    marginTop: spacing.compact,
    gap: spacing.compact,
  },
  entry: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    gap: spacing.compact,
    borderRadius: 12,
    padding: spacing.row,
  },
});
