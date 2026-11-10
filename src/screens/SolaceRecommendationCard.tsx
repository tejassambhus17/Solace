import React, { useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
} from "react-native";
import { spacing } from "../layout";
import { useTheme } from "../theme";
import { AppText, Button, Icon } from "../ui";

export function SolaceRecommendationCard({
  title,
  description,
  durationSec,
  selfPaced,
  artwork,
  reason,
  error,
  startLabel = "Start practice",
  disabled,
  onStart,
  onDismiss,
  onExplain,
}: {
  title: string;
  description: string;
  durationSec: number;
  selfPaced?: boolean;
  artwork?: ImageSourcePropType;
  reason?: string;
  error?: string;
  startLabel?: string;
  disabled?: boolean;
  onStart: () => void;
  onDismiss?: () => void;
  onExplain?: () => void;
}) {
  const { colors } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const [failedArtwork, setFailedArtwork] = useState<ImageSourcePropType>();
  const compact = width < 360;
  const showArtwork =
    artwork && artwork !== failedArtwork && width >= 320 && fontScale < 1.4;
  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;
  const duration = [
    minutes ? `${minutes} min` : "",
    seconds ? `${seconds} sec` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.heroBorder },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.tag}>
          <Icon name="sparkles-outline" size={15} color={colors.lavenderText} />
          <AppText
            variant="caption"
            color={colors.lavenderText}
            style={styles.shrink}
          >
            Picked for you
          </AppText>
        </View>
        <AppText variant="caption" color={colors.muted} style={styles.duration}>
          {selfPaced ? `About ${duration}` : duration}
        </AppText>
      </View>
      <View style={styles.summary}>
        <View style={styles.copy}>
          <AppText accessibilityRole="header" variant="heading">
            {title}
          </AppText>
          <AppText variant="caption" color={colors.muted}>
            {description}
          </AppText>
        </View>
        {showArtwork ? (
          <Image
            source={artwork}
            resizeMode="cover"
            accessible={false}
            importantForAccessibility="no"
            onError={() => setFailedArtwork(artwork)}
            style={[styles.artwork, compact && styles.compactArtwork]}
          />
        ) : null}
      </View>
      {(!!reason || !!onExplain) && (
        <View style={[styles.reason, { borderTopColor: colors.border }]}>
          <AppText
            variant="caption"
            color={colors.muted}
            style={styles.reasonCopy}
          >
            {reason}
          </AppText>
          {onExplain && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Why Solace suggested this"
              onPress={onExplain}
              style={({ pressed }) => [styles.info, pressed && styles.pressed]}
            >
              <Icon
                name="information-circle-outline"
                size={21}
                color={colors.lavenderText}
              />
            </Pressable>
          )}
        </View>
      )}
      {!!error && (
        <AppText
          variant="caption"
          color={colors.danger}
          accessibilityRole="alert"
        >
          {error}
        </AppText>
      )}
      <View style={styles.actions}>
        <Button
          title={startLabel}
          icon="play"
          onPress={onStart}
          disabled={disabled}
          style={styles.action}
        />
        {onDismiss && (
          <Button
            title="Not now"
            variant="ghost"
            disabled={disabled}
            onPress={onDismiss}
            style={styles.action}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.row,
    gap: spacing.compact,
    borderRadius: 16,
    borderWidth: 1,
  },
  header: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    columnGap: spacing.row,
    rowGap: 2,
  },
  tag: { flexDirection: "row", alignItems: "center", flexShrink: 1, gap: 6 },
  shrink: { flexShrink: 1 },
  duration: { flexShrink: 1, fontVariant: ["tabular-nums"] },
  summary: { flexDirection: "row", alignItems: "center", gap: spacing.row },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  artwork: { width: 82, height: 72, borderRadius: 10 },
  compactArtwork: { width: 62, height: 64 },
  reason: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  reasonCopy: { flex: 1, minWidth: 0, paddingVertical: 5 },
  info: {
    width: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.65 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.compact },
  action: { minHeight: 48, maxWidth: "100%", paddingHorizontal: 14 },
});
