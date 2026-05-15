import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Place } from "../domain/types";
import { colors, radius, spacing, touch, typography } from "../theme/tokens";

type SegmentListProps = {
  places: Place[];
  onOpenSegment: (from: Place, to: Place) => void;
};

export function SegmentList({ places, onOpenSegment }: SegmentListProps) {
  if (places.length < 2) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyCopy}>장소를 2개 이상 저장하면 루트가 생겨요.</Text>
      </View>
    );
  }

  const segments = places.slice(0, -1).map((from, index) => ({
    from,
    to: places[index + 1],
  }));

  return (
    <View style={styles.list}>
      {segments.map(({ from, to }, index) => (
        <View key={`${from.id}-${to.id}`} style={styles.row}>
          <View style={styles.segmentCopy}>
            <Text style={styles.segmentLabel}>{index + 1}구간</Text>
            <Text style={styles.segmentNames}>
              {from.name} → {to.name}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${index + 1}구간 길찾기 열기`}
            accessibilityHint={`${from.name}에서 ${to.name}까지 네이버 지도 길찾기를 엽니다.`}
            onPress={() => onOpenSegment(from, to)}
            style={({ pressed }) => [styles.openButton, pressed && styles.pressed]}
          >
            <Text style={styles.openButtonText}>길찾기 열기</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyState: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 120,
    padding: spacing.lg,
  },
  emptyCopy: {
    color: colors.muted,
    fontSize: typography.body,
    fontWeight: "800",
    lineHeight: 24,
  },
  list: {
    gap: spacing.md,
  },
  row: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
  },
  segmentCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  segmentLabel: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: "900",
  },
  segmentNames: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: "900",
    lineHeight: 23,
  },
  openButton: {
    alignItems: "center",
    backgroundColor: "rgba(33, 247, 130, 0.12)",
    borderColor: "rgba(33, 247, 130, 0.46)",
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: touch.minimum,
    paddingHorizontal: spacing.md,
  },
  openButtonText: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.72,
  },
});
