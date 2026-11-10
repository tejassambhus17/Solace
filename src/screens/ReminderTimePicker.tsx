import React, { useRef, useState } from "react";
import {
  AccessibilityInfo,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "../layout";
import { webRadioProps } from "../radio-keyboard";
import {
  fromReminderClock12,
  reminderClockLabel,
  toReminderClock12,
  type ReminderClockTime,
} from "../reminder-time";
import { useTheme } from "../theme";
import { AppText, Button, Icon, Row } from "../ui";

const columns = [
  {
    key: "hour",
    title: "Hour",
    values: Array.from({ length: 12 }, (_, index) => String(index + 1)),
    first: 1,
  },
  {
    key: "minute",
    title: "Minute",
    values: Array.from({ length: 60 }, (_, index) =>
      String(index).padStart(2, "0"),
    ),
    first: 0,
  },
  { key: "period", title: "AM/PM", values: ["AM", "PM"], first: 0 },
] as const;
const native = Platform.OS !== "web";
const webWheelStyle = { scrollSnapType: "y mandatory" } as ViewStyle;
const webOptionStyle = { scrollSnapAlign: "center" } as ViewStyle;

function ClockColumn({
  column,
  value,
  onChange,
  rowHeight,
}: {
  column: (typeof columns)[number];
  value: number;
  onChange: (value: number) => void;
  rowHeight: number;
}) {
  const { colors, resolved } = useTheme();
  const { values, first, title } = column;
  const selected = value - first;
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const positioned = useRef(false);
  const current = useRef(selected);
  const initialOffset = useRef({ x: 0, y: selected * rowHeight });

  function choose(index: number) {
    current.current = index;
    onChange(index + first);
    scroll.current?.scrollTo({ y: index * rowHeight, animated: false });
  }

  function syncScroll({
    nativeEvent,
  }: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.max(
      0,
      Math.min(
        values.length - 1,
        Math.round(nativeEvent.contentOffset.y / rowHeight),
      ),
    );
    if (current.current === index) return;
    current.current = index;
    onChange(index + first);
  }

  return (
    <View style={styles.column}>
      <View
        accessible={native}
        accessibilityRole={native ? "adjustable" : "radiogroup"}
        accessibilityLabel={title}
        accessibilityValue={
          native
            ? {
                min: first,
                max: first + values.length - 1,
                now: value,
                text: values[selected],
              }
            : undefined
        }
        accessibilityActions={
          native ? [{ name: "increment" }, { name: "decrement" }] : undefined
        }
        onAccessibilityAction={({ nativeEvent }) => {
          const step = nativeEvent.actionName === "increment" ? 1 : -1;
          choose(Math.max(0, Math.min(values.length - 1, selected + step)));
        }}
      >
        <ScrollView
          ref={scroll}
          accessibilityElementsHidden={native}
          importantForAccessibility={native ? "no-hide-descendants" : "auto"}
          style={[{ height: rowHeight * 3 }, !native && webWheelStyle]}
          contentOffset={native ? initialOffset.current : undefined}
          contentContainerStyle={{ paddingVertical: rowHeight }}
          onContentSizeChange={() => {
            if (positioned.current) return;
            positioned.current = true;
            scroll.current?.scrollTo({
              y: current.current * rowHeight,
              animated: false,
            });
          }}
          onScroll={syncScroll}
          onMomentumScrollEnd={syncScroll}
          scrollEventThrottle={32}
          showsVerticalScrollIndicator={false}
          automaticallyAdjustContentInsets={false}
          bounces={false}
          overScrollMode="never"
          nestedScrollEnabled
          snapToInterval={rowHeight}
          snapToAlignment="start"
          decelerationRate="fast"
        >
          {values.map((label, index) => (
            <Pressable
              key={label}
              accessibilityRole="radio"
              accessibilityState={{ selected: selected === index }}
              aria-checked={selected === index}
              {...webRadioProps(selected === index)}
              onPress={() => choose(index)}
              style={({ pressed }) => [
                styles.option,
                !native && webOptionStyle,
                {
                  height: rowHeight,
                  backgroundColor:
                    selected === index
                      ? colors.tabActiveSurface
                      : pressed
                        ? colors.surface2
                        : "transparent",
                },
              ]}
            >
              <AppText
                variant="label"
                color={selected === index ? colors.tabActiveText : colors.muted}
                style={[
                  styles.number,
                  selected === index &&
                    resolved === "light" &&
                    styles.daylightSelection,
                ]}
              >
                {label}
              </AppText>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

export function ReminderTimePicker({
  value,
  onChange,
  disabled,
  reducedMotion,
}: {
  value: ReminderClockTime;
  onChange: (value: ReminderClockTime) => void;
  disabled: boolean;
  reducedMotion: boolean;
}) {
  const { colors, resolved } = useTheme();
  const dark = resolved === "dark";
  const { bottom, left, right, top } = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => toReminderClock12(value));
  const trigger = useRef<React.ComponentRef<typeof View>>(null);
  const closeButton = useRef<React.ComponentRef<typeof View>>(null);
  const close = () => setOpen(false);
  const timeLabel = reminderClockLabel(value);
  const draftTime = fromReminderClock12(draft);
  const rowHeight = Math.max(48, Math.ceil(fontScale * 22 + spacing.row));

  return (
    <>
      <Pressable
        ref={trigger}
        accessibilityRole="button"
        accessibilityLabel="Reminder time"
        accessibilityHint="Opens hours, minutes, and AM or PM"
        accessibilityValue={{ text: timeLabel }}
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={() => {
          Keyboard.dismiss();
          setDraft(toReminderClock12(value));
          setOpen(true);
        }}
        style={({ pressed }) => [
          styles.trigger,
          {
            backgroundColor: pressed
              ? colors.tabActiveSurface
              : dark
                ? colors.surface
                : colors.surface2,
            borderColor: colors.border,
            opacity: disabled ? 0.6 : 1,
          },
        ]}
      >
        <AppText
          variant="label"
          color={colors.text}
          style={[styles.flexText, styles.number, styles.clockDisplay]}
        >
          {timeLabel}
        </AppText>
        <View
          style={[styles.editMark, { backgroundColor: colors.lavenderSurface }]}
        >
          <Icon name="time-outline" size={20} color={colors.lavenderText} />
        </View>
      </Pressable>
      <Modal
        visible={open}
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        animationType={reducedMotion ? "none" : "fade"}
        onRequestClose={close}
        onShow={() => {
          if (native && closeButton.current)
            AccessibilityInfo.sendAccessibilityEvent(
              closeButton.current,
              "focus",
            );
        }}
        onDismiss={() => {
          if (Platform.OS === "ios" && trigger.current)
            AccessibilityInfo.sendAccessibilityEvent(trigger.current, "focus");
        }}
      >
        <View
          style={[
            styles.backdrop,
            {
              backgroundColor: colors.overlay,
              paddingTop: top + spacing.card,
              paddingBottom: bottom + spacing.card,
              paddingLeft: left + spacing.card,
              paddingRight: right + spacing.card,
            },
          ]}
        >
          <Pressable
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            aria-hidden
            tabIndex={-1}
            onPress={close}
            style={StyleSheet.absoluteFill}
          />
          <View
            accessibilityViewIsModal
            style={[
              styles.sheet,
              {
                backgroundColor:
                  resolved === "dark" ? colors.lavenderSurface : colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <ScrollView
              nestedScrollEnabled
              bounces={false}
              contentContainerStyle={styles.sheetContent}
            >
              <Row>
                <AppText
                  variant="heading"
                  accessibilityRole="header"
                  style={styles.flexText}
                >
                  Set reminder time
                </AppText>
                <Pressable
                  ref={closeButton}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel time selection"
                  onPress={close}
                  style={({ pressed }) => [
                    styles.close,
                    {
                      borderColor: colors.border,
                      backgroundColor: pressed
                        ? colors.surface2
                        : colors.surface,
                    },
                  ]}
                >
                  <Icon name="close-outline" size={21} />
                </Pressable>
              </Row>
              <View
                style={[
                  styles.readout,
                  { borderColor: colors.border },
                  !dark && [
                    styles.daylightReadout,
                    { backgroundColor: colors.surface2 },
                  ],
                ]}
              >
                <AppText
                  variant="label"
                  color={colors.lavenderText}
                  style={[styles.number, styles.clockDisplay]}
                >
                  {reminderClockLabel(draftTime)}
                </AppText>
                <AppText variant="caption" color={colors.muted}>
                  Local time
                </AppText>
              </View>
              <View style={styles.columns} aria-hidden>
                {columns.map(({ key, title }) => (
                  <AppText
                    key={key}
                    variant="caption"
                    color={colors.muted}
                    style={[styles.column, styles.columnLabel]}
                    importantForAccessibility="no"
                  >
                    {title}
                  </AppText>
                ))}
              </View>
              <View style={styles.columns}>
                <View
                  pointerEvents="none"
                  aria-hidden
                  style={[
                    styles.wheelBand,
                    {
                      top: rowHeight,
                      height: rowHeight,
                      backgroundColor: colors.tabActiveSurface,
                    },
                  ]}
                />
                {open &&
                  columns.map((column) => (
                    <ClockColumn
                      key={`${column.key}-${rowHeight}`}
                      column={column}
                      value={draft[column.key]}
                      rowHeight={rowHeight}
                      onChange={(next) =>
                        setDraft((current) => ({
                          ...current,
                          [column.key]: next,
                        }))
                      }
                    />
                  ))}
              </View>
              <Button
                title="Set time"
                onPress={() => {
                  onChange(draftTime);
                  close();
                }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 72,
    borderRadius: spacing.card,
    borderWidth: 1,
    gap: spacing.row,
    paddingHorizontal: spacing.row,
    paddingVertical: spacing.compact,
  },
  flexText: { flex: 1, minWidth: 0 },
  number: { fontVariant: ["tabular-nums"] },
  clockDisplay: { fontSize: 31, lineHeight: 42, letterSpacing: -0.6 },
  daylightSelection: { fontSize: 17, lineHeight: 23 },
  editMark: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  readout: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: spacing.row,
  },
  daylightReadout: {
    paddingTop: spacing.row,
    borderWidth: 1,
    borderRadius: 14,
  },
  backdrop: { flex: 1, justifyContent: "center", alignItems: "center" },
  sheet: {
    flexShrink: 1,
    width: "100%",
    maxWidth: 420,
    borderRadius: spacing.section,
    borderWidth: 1,
  },
  sheetContent: { padding: spacing.card, gap: spacing.row },
  close: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  columns: { flexDirection: "row", gap: spacing.compact },
  wheelBand: {
    position: "absolute",
    left: 0,
    right: 0,
    borderRadius: spacing.row,
  },
  column: { flex: 1, minWidth: 0 },
  columnLabel: { textAlign: "center" },
  option: {
    borderRadius: spacing.row,
    alignItems: "center",
    justifyContent: "center",
  },
});
