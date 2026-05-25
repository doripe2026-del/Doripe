import { useState } from "react";
import { ImageBackground, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type { Place } from "../domain/types";
import { colors, radius, spacing, touch, typography } from "../theme/tokens";
import { Chip } from "./Chip";

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
  const cardHeight = Math.max(560, Math.min(642, height - 210));
  const tags = Array.from(new Set([categoryName, ...place.moodTags].filter(Boolean))).slice(0, 3);

  return (
    <View style={styles.shell}>
      <ImageBackground
        imageStyle={styles.imageRadius}
        onError={() => setImageFailed(true)}
        resizeMode="cover"
        source={{ uri: imageFailed ? fallbackCoverImageUrl : place.coverImageUrl }}
        style={[styles.card, { height: cardHeight }]}
      >
        <View style={styles.bottomScrim} />
        <View style={styles.copyArea}>
          <View style={styles.tags}>
            {tags.map((tag) => (
              <Chip key={tag} label={tag} />
            ))}
          </View>
          <Text style={styles.name}>{place.name}</Text>
          <Text style={styles.shortCopy}>{place.shortCopy}</Text>
          <Chip label="리뷰 295" style={styles.reviewChip} />
        </View>
      </ImageBackground>

      <View style={styles.actions}>
        <Pressable
          accessibilityLabel={`${place.name} 건너뛰기`}
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={onSkip}
          style={({ pressed }) => [
            styles.actionButton,
            styles.skipButton,
            pressed && !disabled && styles.pressed,
            disabled && styles.disabledButton,
          ]}
        >
          <Text style={styles.skipText}>×</Text>
        </Pressable>
        <Pressable
          accessibilityLabel={`${place.name} 저장`}
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={onSave}
          style={({ pressed }) => [
            styles.actionButton,
            styles.saveButton,
            pressed && !disabled && styles.pressed,
            disabled && styles.disabledButton,
          ]}
        >
          <Text style={styles.saveText}>저장</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    gap: 2,
    width: "100%",
  },
  card: {
    justifyContent: "flex-end",
    overflow: "hidden",
    width: "100%",
  },
  imageRadius: {
    borderRadius: radius.xl,
  },
  bottomScrim: {
    backgroundColor: "rgba(5, 12, 7, 0.88)",
    bottom: 0,
    height: 258,
    left: 0,
    position: "absolute",
    right: 0,
  },
  copyArea: {
    gap: spacing.md,
    paddingBottom: 22,
    paddingHorizontal: 20,
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  name: {
    color: colors.white,
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 38,
  },
  shortCopy: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 22,
    maxWidth: 285,
  },
  reviewChip: {
    alignSelf: "flex-start",
  },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
    height: 52,
  },
  actionButton: {
    alignItems: "center",
    borderRadius: radius.md,
    flex: 1,
    justifyContent: "center",
    minHeight: touch.minimum,
  },
  skipButton: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  skipText: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 32,
  },
  saveText: {
    color: colors.primaryInk,
    fontSize: typography.body,
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.72,
  },
  disabledButton: {
    opacity: 0.5,
  },
});
