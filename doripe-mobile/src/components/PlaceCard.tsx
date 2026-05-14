import { ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";
import type { Place } from "../domain/types";
import { colors, radius, spacing, touch, typography } from "../theme/tokens";

type PlaceCardProps = {
  place: Place;
  categoryName: string;
  onSave: () => void;
  onSkip: () => void;
};

export function PlaceCard({ place, categoryName, onSave, onSkip }: PlaceCardProps) {
  const tags = place.moodTags.slice(0, 3);
  const meta = [place.subArea, categoryName].filter(Boolean).join(" · ");

  return (
    <View style={styles.shell}>
      <ImageBackground
        source={{ uri: place.coverImageUrl }}
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
              accessibilityLabel={`${place.name} 스킵`}
              onPress={onSkip}
              style={({ pressed }) => [styles.actionButton, styles.skipButton, pressed && styles.pressed]}
            >
              <Text style={[styles.actionText, styles.skipText]}>스킵</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${place.name} 저장`}
              onPress={onSave}
              style={({ pressed }) => [styles.actionButton, styles.saveButton, pressed && styles.pressed]}
            >
              <Text style={[styles.actionText, styles.saveText]}>저장</Text>
            </Pressable>
          </View>
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    minHeight: 560,
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
});
