import React, {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Image,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { countJournalWords, toggleJournalBullet } from "../journal-writing";
import { spacing } from "../layout";
import { useGuardedBack } from "../navigation-reset";
import { artGradient, useTheme } from "../theme";
import {
  AppText,
  BotanicalBackdrop,
  Icon,
  IconButton,
  Input,
  Row,
} from "../ui";

const heroArtwork = require("../../assets/journal-editor-window.jpg");

export function JournalEditorHeader({
  date,
  gutter,
  back,
  onOpenCalendar,
  onDraftInfo,
  expanded,
}: {
  date: string;
  gutter: number;
  back: () => void;
  onOpenCalendar?: () => void;
  onDraftInfo: () => void;
  expanded: boolean;
}) {
  const { top } = useSafeAreaInsets();
  const goBack = useGuardedBack(back);
  return (
    <View
      style={[
        styles.hero,
        {
          marginHorizontal: -gutter,
          paddingHorizontal: gutter,
          paddingTop: top + 4,
        },
      ]}
    >
      <Image
        source={heroArtwork}
        resizeMode="cover"
        accessible={false}
        accessibilityIgnoresInvertColors
        fadeDuration={0}
        style={styles.heroArt}
      />
      <View
        pointerEvents="none"
        style={[
          styles.heroArt,
          artGradient("linear-gradient(180deg, #130E1D 0%, #130E1D00 24%)"),
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          artGradient(
            "linear-gradient(90deg, #130E1D 0%, #130E1DBB 36%, #130E1D00 83%)",
          ),
        ]}
      />
      <Row style={styles.heroActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={goBack}
          style={({ pressed }) => [
            styles.heroButton,
            pressed && styles.pressed,
          ]}
        >
          <Icon name="chevron-back" size={24} color="#F5EAF3" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            expanded ? "Hide draft information" : "Show draft information"
          }
          accessibilityState={{ expanded }}
          onPress={onDraftInfo}
          style={({ pressed }) => [
            styles.heroButton,
            styles.heroMore,
            pressed && styles.pressed,
          ]}
        >
          <Icon name="ellipsis-horizontal" size={22} color="#F5EAF3" />
        </Pressable>
      </Row>
      <AppText
        variant="title"
        accessibilityRole="header"
        color="#EED8F9"
        style={styles.heroTitle}
      >
        Journal
      </AppText>
      <AppText variant="caption" color="#F5EAF3">
        A safe space for your thoughts
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open journal calendar, ${date}`}
        accessibilityState={{ disabled: !onOpenCalendar }}
        disabled={!onOpenCalendar}
        onPress={onOpenCalendar}
        style={({ pressed }) => [styles.date, pressed && styles.pressed]}
      >
        <Icon name="calendar-outline" size={16} color="#F5C7AA" />
        <AppText variant="caption" color="#FAEFF9" style={styles.dateText}>
          {date}
        </AppText>
        <Icon name="chevron-forward" size={16} color="#F5EAF3" />
      </Pressable>
    </View>
  );
}

export function JournalWritingSurface({
  title,
  text,
  disabled,
  onTitleChange,
  onTextChange,
  onReveal,
}: {
  title: string;
  text: string;
  disabled: boolean;
  onTitleChange: (value: string) => void;
  onTextChange: (value: string) => void;
  onReveal: (y: number) => void;
}) {
  const { colors, resolved } = useTheme();
  const { height } = useWindowDimensions();
  const dark = resolved === "dark";
  const [focused, setFocused] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(() => Keyboard.isVisible());
  const input = useRef<React.ElementRef<typeof TextInput>>(null);
  const selection = useRef<{ start: number; end: number } | null>(null);
  const panelY = useRef(0);
  const focusedRef = useRef(false);
  const deferredText = useDeferredValue(text);
  const words = useMemo(() => countJournalWords(deferredText), [deferredText]);
  const paper = dark ? "#332047" : colors.surface2;
  const ink = dark ? "#F8EDF9" : colors.text;
  const muted = dark ? "#DBC5E6" : colors.muted;
  const border = dark
    ? focused
      ? "#BB8AD4"
      : "#895BA5"
    : focused
      ? colors.accent
      : colors.lavender;
  const writingHeight = keyboardOpen
    ? Math.max(132, Math.min(205, Math.round(height * 0.23)))
    : Math.max(168, Math.min(290, Math.round(height * 0.27)));

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => {
      setKeyboardOpen(true);
      if (focusedRef.current) onReveal(panelY.current);
    });
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardOpen(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, [onReveal]);

  function focus(next: boolean) {
    focusedRef.current = next;
    setFocused(next);
    if (next && Keyboard.isVisible()) onReveal(panelY.current);
  }

  function toggleBullet() {
    const next = toggleJournalBullet(
      text,
      selection.current ?? { start: text.length, end: text.length },
    );
    onTextChange(next.text);
    selection.current = next.selection;
    input.current?.focus();
    requestAnimationFrame(() => {
      const field = input.current as
        | (React.ElementRef<typeof TextInput> & {
            setSelection?: (start: number, end: number) => void;
            setSelectionRange?: (start: number, end: number) => void;
          })
        | null;
      if (Platform.OS === "web")
        field?.setSelectionRange?.(next.selection.start, next.selection.end);
      else field?.setSelection?.(next.selection.start, next.selection.end);
    });
  }

  return (
    <View
      onLayout={({ nativeEvent }) => {
        panelY.current = nativeEvent.layout.y;
      }}
      style={[
        styles.writing,
        dark && styles.writingGlow,
        { backgroundColor: paper, borderColor: border },
      ]}
    >
      <BotanicalBackdrop style={styles.foliage} />
      <Input
        accessibilityLabel="Entry title, optional"
        placeholder="Give this moment a title…"
        placeholderTextColor={muted}
        value={title}
        onFocus={() => focus(true)}
        onBlur={() => focus(false)}
        onChangeText={onTitleChange}
        maxLength={240}
        editable={!disabled}
        style={[styles.titleInput, { color: ink }]}
      />
      <View style={[styles.rule, { backgroundColor: border }]} />
      <Input
        ref={input}
        accessibilityLabel="Journal entry"
        placeholder="What’s on your mind?"
        placeholderTextColor={muted}
        value={text}
        onFocus={() => focus(true)}
        onBlur={() => focus(false)}
        onChangeText={onTextChange}
        onSelectionChange={({ nativeEvent }) => {
          selection.current = nativeEvent.selection;
        }}
        multiline
        scrollEnabled
        textAlignVertical="top"
        editable={!disabled}
        style={[styles.bodyInput, { color: ink, height: writingHeight }]}
      />
      <Row style={styles.writingFooter}>
        <View style={[styles.tool, { borderColor: border }]}>
          <IconButton
            name="list-outline"
            label="Toggle bullet on current line"
            disabled={disabled}
            onPress={toggleBullet}
          />
        </View>
        <AppText variant="caption" color={muted} style={styles.wordCount}>
          {words} {words === 1 ? "word" : "words"}
        </AppText>
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#130E1D",
    paddingBottom: spacing.card,
    gap: 3,
  },
  heroArt: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: "125%",
    aspectRatio: 1170 / 543,
  },
  heroActions: { justifyContent: "space-between", marginLeft: -8 },
  heroButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.72 },
  heroMore: { backgroundColor: "#33253C", borderRadius: 24 },
  heroTitle: { fontStyle: "italic" },
  date: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.compact,
    alignSelf: "flex-start",
    maxWidth: "100%",
    minHeight: 48,
    paddingHorizontal: spacing.row,
    paddingVertical: 5,
    marginTop: spacing.compact,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#61496B",
    backgroundColor: "#292037",
  },
  dateText: { flexShrink: 1 },
  writing: { overflow: "hidden", borderWidth: 1.25, borderRadius: 24 },
  writingGlow: { boxShadow: "0px 0px 11px #A66BCE30" },
  foliage: { width: 155, height: 155, right: -26, top: -24, opacity: 0.13 },
  titleInput: {
    borderWidth: 0,
    backgroundColor: "transparent",
    fontFamily: "CormorantGaramond_600SemiBold",
    fontSize: 27,
    lineHeight: 34,
    fontStyle: "italic",
    minHeight: 48,
    paddingVertical: 8,
  },
  rule: { height: StyleSheet.hairlineWidth, marginHorizontal: spacing.card },
  bodyInput: {
    borderWidth: 0,
    backgroundColor: "transparent",
    paddingVertical: spacing.row,
    lineHeight: 23,
  },
  writingFooter: {
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: spacing.compact,
    paddingHorizontal: spacing.row,
    paddingBottom: spacing.compact,
  },
  tool: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 24 },
  wordCount: { flexShrink: 1, marginLeft: "auto" },
});
