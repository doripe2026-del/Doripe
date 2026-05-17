import { useState } from "react";
import { ImageBackground, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type { Place } from "../domain/types";
import { colors, radius, spacing, touch, typography } from "../theme/tokens";

type PlaceCardProps = {
  place: Place;
  categoryName: string;
  onSave: () => void;
  onSkip: () => void;
  disabled?: boolean;
};

const fallbackCoverImageUrl =
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80";

export function PlaceCard({ place, categoryName, onSave, onSkip, disabled = false }: PlaceCardProps) {
  const { height } = useWindowDimensions();
  const [imageFailed, setImageFailed] = useState(false);
  const tags = place.moodTags.slice(0, 3);
  const meta = [place.subArea, categoryName].filter(Boolean).join(" · ");
  const cardHeight = Math.max(420, Math.min(560, height - 196));

  return (
    <View style={[styles.shell, { height: cardHeight }]}>
      <ImageBackground
        source={{ uri: imageFailed ? fallbackCoverImageUrl : place.coverImageUrl }}
        onError={() => setImageFailed(true)}
        resizeMode="cover"
        style={styles.image}
        imageStyle={styles.imageRadius}
      >
        <View style={styles.scrim} />
        <View style={styles.content}>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>{meta}</Text>
          </View>

          <View style={styles.copyBlock}>
            <Text style={styles.name}>{place.name}</Text>
            <Text style={styles.shortCopy}>{place.shortCopy}</Text>
          </View>

          <View style={styles.tags}>
            {tags.map((tag) => (
              <Text key={tag} style={styles.tag}>
                {tag}
              </Text>
            ))}
          </View>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled }}
              accessibilityLabel={`${place.name} 건너뛰기`}
              disabled={disabled}
              onPress={onSkip}
              style={({ pressed }) => [
                styles.actionButton,
                styles.skipButton,
                pressed && !disabled && styles.pressed,
                disabled && styles.disabledButton,
              ]}
            >
              <Text style={[styles.actionText, styles.skipText, disabled && styles.disabledText]}>×</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled }}
              accessibilityLabel={`${place.name} 저장`}
              disabled={disabled}
              onPress={onSave}
              style={({ pressed }) => [
                styles.actionButton,
                styles.saveButton,
                pressed && !disabled && styles.pressed,
                disabled && styles.disabledButton,
              ]}
            >
              <Text style={[styles.actionText, styles.saveText, disabled && styles.disabledText]}>저장</Text>
            </Pressable>
          </View>
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: "100%",
  },
  image: {
    flex: 1,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  imageRadius: {
    borderRadius: radius.lg,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.42)",
  },
  content: {
    flex: 1,
    justifyContent: "flex-end",
    gap: spacing.md,
    padding: spacing.lg,
  },
  metaRow: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(5, 6, 5, 0.64)",
    borderColor: "rgba(33, 247, 130, 0.44)",
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  meta: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: "900",
  },
  copyBlock: {
    gap: spacing.sm,
  },
  name: {
    color: colors.ink,
    fontSize: 40,
    fontWeight: "900",
    lineHeight: 46,
  },
  shortCopy: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: "700",
    lineHeight: 24,
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  tag: {
    backgroundColor: "rgba(247, 255, 247, 0.14)",
    borderColor: "rgba(247, 255, 247, 0.2)",
    borderRadius: radius.pill,
    borderWidth: 1,
    color: colors.ink,
    fontSize: typography.caption,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  actionButton: {
    alignItems: "center",
    borderRadius: radius.pill,
    flex: 1,
    justifyContent: "center",
    minHeight: touch.minimum + 10,
  },
  skipButton: {
    backgroundColor: "rgba(247, 255, 247, 0.12)",
    borderColor: "rgba(247, 255, 247, 0.22)",
    borderWidth: 1,
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  pressed: {
    opacity: 0.72,
  },
  disabledButton: {
    opacity: 0.46,
  },
  actionText: {
    fontSize: typography.body,
    fontWeight: "900",
  },
  skipText: {
    color: colors.ink,
  },
  saveText: {
    color: colors.background,
  },
  disabledText: {
    opacity: 0.78,
  },
});
