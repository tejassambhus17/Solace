import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  BackHandler,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useReducedMotion } from "../Companion";
import { useTheme } from "../theme";
import { AppText, BrandMark, Button, Icon } from "../ui";

type Illustration = {
  source: ImageSourcePropType;
  aspectRatio?: number;
  alignX?: number;
  alignY?: number;
};
type Slide = {
  title: string;
  description: string;
  detail: string;
  light: Illustration;
  dark: Illustration;
};

const slides: readonly Slide[] = [
  {
    title: "Welcome to Solace",
    description: "Your space to pause, reflect, and feel heard.",
    detail:
      "Solace is an AI wellness companion. For therapy, turn to a qualified professional.",
    light: {
      source: require("../../assets/redesign-today-scene-light.jpg"),
      aspectRatio: 1040 / 518,
      alignX: 0.96,
      alignY: 0.28,
    },
    dark: {
      source: require("../../assets/today-twilight-lotus.jpg"),
      aspectRatio: 1100 / 591,
      alignX: 1,
      alignY: 0.8,
    },
  },
  {
    title: "Talk to your companion",
    description: "Share what’s on your mind through text or voice.",
    detail:
      "When AI services are available, Solace can reply, transcribe voice notes, and suggest activities.",
    light: { source: require("../../assets/redesign-chat-scene-light.jpg") },
    dark: { source: require("../../assets/solace-companion-twilight.jpg") },
  },
  {
    title: "Write in your journal",
    description: "A private place for thoughts, feelings, and reflections.",
    detail:
      "Write freely and revisit saved entries. You decide what to share for an AI reflection.",
    light: {
      source: require("../../assets/redesign-explore-reflect.jpg"),
      aspectRatio: 1,
      alignY: 0.2,
    },
    dark: { source: require("../../assets/solace-journal-twilight.jpg") },
  },
  {
    title: "Explore moments of calm",
    description:
      "Discover breathing, grounding, and guided wellness activities.",
    detail:
      "Find guided practices in Explore or choose a Solace Moment that fits how you feel.",
    light: {
      source: require("../../assets/redesign-explore-feature-light.jpg"),
      aspectRatio: 1040 / 518,
      alignX: 0.98,
      alignY: 0.1,
    },
    dark: {
      source: require("../../assets/redesign-explore-feature-dark.jpg"),
      aspectRatio: 1040 / 518,
      alignX: 0.98,
      alignY: 0.1,
    },
  },
  {
    title: "Grow at your own pace",
    description: "Check in with your mood and follow your personal journey.",
    detail:
      "Revisit reflections, completed activities, and milestones in Journey as they add up.",
    light: { source: require("../../assets/redesign-guided-light.jpg") },
    dark: { source: require("../../assets/redesign-guided-dark.jpg") },
  },
];

const lastStep = slides.length - 1;

function coverIllustration(
  { aspectRatio, alignX = 0.5, alignY = 0.5 }: Illustration,
  frameWidth: number,
  frameHeight: number,
) {
  if (!aspectRatio) return styles.illustration;
  const width = Math.max(frameWidth, frameHeight * aspectRatio);
  const height = width / aspectRatio;
  return {
    position: "absolute" as const,
    width,
    height,
    left: (frameWidth - width) * alignX,
    top: (frameHeight - height) * alignY,
  };
}

export function OnboardingScreen({
  onFinish,
  onBack,
  finishing = false,
  error,
}: {
  onFinish: (action: "skip" | "complete") => void;
  onBack?: () => void;
  finishing?: boolean;
  error?: string;
}) {
  const { colors, resolved } = useTheme();
  const { fontScale } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState(0);
  const currentStep = useRef(0);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const pager = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const target = useRef<number | null>(null);
  const { width, height } = viewport;
  const gutter = width > 0 && width < 350 ? 16 : 22;
  const compact = width < 350 || height < 520;
  const titleSize = compact ? 36 : 44;
  const artWidth = Math.max(1, width - gutter * 2);
  const artHeight = Math.min(
    artWidth,
    360,
    Math.max(
      96,
      Math.ceil(artWidth * 0.33),
      Math.round(height * (fontScale > 1.2 ? 0.35 : compact ? 0.39 : 0.53)),
    ),
  );
  const illustrationInset = Math.max(
    6,
    Math.round(
      (height - artHeight - (compact ? 176 : 198) * fontScale) *
        (compact ? 0.2 : 0.37),
    ),
  );

  const measure = useCallback(({ nativeEvent }: LayoutChangeEvent) => {
    const { width, height } = nativeEvent.layout;
    setViewport((current) =>
      current.width === width && current.height === height
        ? current
        : { width, height },
    );
  }, []);
  const select = useCallback((next: number) => {
    const index = Math.max(0, Math.min(lastStep, next));
    if (currentStep.current !== index) {
      currentStep.current = index;
      setStep(index);
    }
  }, []);
  const move = useCallback(
    (offset: number) => {
      if (!width || finishing) return;
      select(currentStep.current + offset);
      target.current = currentStep.current * width;
      pager.current?.scrollTo({ x: target.current, animated: !reducedMotion });
    },
    [finishing, reducedMotion, select, width],
  );
  const alignPager = useCallback(() => {
    if (!width) return;
    target.current = currentStep.current * width;
    pager.current?.scrollTo({ x: target.current, animated: false });
  }, [width]);
  useLayoutEffect(alignPager, [alignPager]);
  const beginSwipe = useCallback(() => {
    target.current = null;
  }, []);
  const trackPage = useCallback(
    ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!width || finishing) return;
      const { x } = nativeEvent.contentOffset;
      if (target.current !== null) {
        if (Math.abs(target.current - x) <= 1) target.current = null;
        return;
      }
      select(Math.round(x / width));
    },
    [finishing, select, width],
  );
  const goBack = useCallback(() => {
    if (finishing) return true;
    if (currentStep.current > 0) {
      move(-1);
      return true;
    }
    if (!onBack) return false;
    onBack();
    return true;
  }, [finishing, move, onBack]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      goBack,
    );
    return () => subscription.remove();
  }, [goBack]);

  const last = step === lastStep;
  const backDisabled = finishing || (step === 0 && !onBack);
  const progress = `Step ${step + 1} of ${slides.length}`;

  return (
    <SafeAreaView
      testID="onboarding-screen"
      edges={["top", "bottom", "left", "right"]}
      style={[styles.screen, { backgroundColor: colors.bg }]}
    >
      <View style={[styles.header, { paddingHorizontal: gutter }]}>
        <BrandMark size={28} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip"
          accessibilityState={{ disabled: finishing }}
          disabled={finishing}
          onPress={() => onFinish("skip")}
          style={({ pressed }) => [
            styles.skip,
            { opacity: finishing || pressed ? 0.58 : 1 },
          ]}
        >
          <AppText variant="label" color={colors.muted}>
            Skip
          </AppText>
        </Pressable>
      </View>

      <View style={styles.viewport} onLayout={measure}>
        {width > 0 && height > 0 && (
          <ScrollView
            ref={pager}
            testID="onboarding-pager"
            horizontal
            pagingEnabled
            disableIntervalMomentum
            directionalLockEnabled
            scrollEnabled={!finishing}
            bounces={false}
            overScrollMode="never"
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onTouchStart={beginSwipe}
            onScrollBeginDrag={beginSwipe}
            onScroll={trackPage}
            onContentSizeChange={alignPager}
            style={styles.pager}
          >
            {slides.map((slide, index) => (
              <View
                key={slide.title}
                testID={`onboarding-slide-${index + 1}`}
                accessibilityElementsHidden={index !== step}
                importantForAccessibility={
                  index === step ? "auto" : "no-hide-descendants"
                }
                aria-hidden={index !== step}
                style={{ width, height }}
              >
                <ScrollView
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={[
                    styles.slide,
                    {
                      paddingHorizontal: gutter,
                      paddingTop: illustrationInset,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.art,
                      {
                        height: artHeight,
                        backgroundColor: colors.heroSurface,
                      },
                    ]}
                  >
                    <Image
                      source={slide[resolved].source}
                      accessible={false}
                      accessibilityIgnoresInvertColors
                      fadeDuration={0}
                      resizeMode="cover"
                      style={coverIllustration(
                        slide[resolved],
                        artWidth,
                        artHeight,
                      )}
                    />
                  </View>
                  <View style={[styles.copy, compact && styles.compactCopy]}>
                    <AppText
                      variant="display"
                      accessibilityRole="header"
                      style={[
                        styles.title,
                        {
                          fontSize: titleSize,
                          lineHeight: Math.round(
                            titleSize *
                              (Platform.OS === "android" ? 1.22 : 1.13),
                          ),
                        },
                      ]}
                    >
                      {slide.title}
                    </AppText>
                    <AppText style={styles.description}>
                      {slide.description}
                    </AppText>
                    <AppText
                      variant="caption"
                      color={colors.muted}
                      style={styles.detail}
                    >
                      {slide.detail}
                    </AppText>
                  </View>
                </ScrollView>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      <View style={[styles.footer, { paddingHorizontal: gutter }]}>
        <View
          testID="onboarding-progress"
          accessible
          accessibilityLabel="Onboarding progress"
          accessibilityRole="progressbar"
          accessibilityValue={{
            min: 1,
            max: slides.length,
            now: step + 1,
            text: progress,
          }}
          accessibilityLiveRegion="polite"
          aria-valuemin={1}
          aria-valuemax={slides.length}
          aria-valuenow={step + 1}
          aria-valuetext={progress}
          style={styles.progress}
        >
          <View style={styles.segments} aria-hidden>
            {slides.map(({ title }, index) => (
              <View
                key={title}
                style={[
                  styles.segment,
                  {
                    backgroundColor:
                      index <= step ? colors.primary : colors.border,
                  },
                ]}
              />
            ))}
          </View>
          <AppText variant="caption" color={colors.muted} aria-hidden>
            {step + 1} of {slides.length}
          </AppText>
        </View>
        {error && (
          <AppText
            accessibilityRole="alert"
            color={colors.danger}
            style={styles.error}
          >
            {error}
          </AppText>
        )}
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            accessibilityState={{ disabled: backDisabled }}
            disabled={backDisabled}
            onPress={goBack}
            style={({ pressed }) => [
              styles.back,
              {
                borderColor: colors.border,
                opacity: backDisabled ? 0.48 : pressed ? 0.72 : 1,
              },
            ]}
          >
            <Icon name="arrow-back" size={18} />
            <AppText variant="label" style={styles.backLabel}>
              Back
            </AppText>
          </Pressable>
          <Button
            title={last ? "Get started" : "Next"}
            onPress={last ? () => onFinish("complete") : () => move(1)}
            disabled={finishing || !width}
            loading={finishing && last}
            style={styles.primary}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 56,
  },
  skip: {
    minHeight: 44,
    minWidth: 44,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  viewport: { flex: 1, overflow: "hidden" },
  pager: { flex: 1, direction: "ltr" },
  slide: {
    flexGrow: 1,
    paddingBottom: 12,
  },
  art: { width: "100%", overflow: "hidden", borderRadius: 24 },
  illustration: { width: "100%", height: "100%" },
  copy: { alignItems: "center", paddingTop: 19, paddingHorizontal: 3, gap: 7 },
  compactCopy: { paddingTop: 15, gap: 6 },
  title: { textAlign: "center", letterSpacing: -0.85 },
  description: { textAlign: "center", maxWidth: 380 },
  detail: { textAlign: "center", maxWidth: 360, fontSize: 14, lineHeight: 21 },
  footer: { gap: 10, paddingTop: 8, paddingBottom: 12 },
  progress: { flexDirection: "row", alignItems: "center", gap: 13 },
  segments: { flexDirection: "row", flex: 1, gap: 5 },
  segment: { flex: 1, height: 3, borderRadius: 2 },
  error: { fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: "row", gap: 10 },
  back: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  backLabel: { flexShrink: 1 },
  primary: { flex: 1 },
});
