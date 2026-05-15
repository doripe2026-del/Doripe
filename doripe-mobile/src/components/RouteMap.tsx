import { StyleSheet, Text, View } from "react-native";
import type { Place } from "../domain/types";
import { colors, radius, spacing, typography } from "../theme/tokens";

type RouteMapProps = {
  places: Place[];
};

export function RouteMap({ places }: RouteMapProps) {
  if (places.length === 0) {
    return (
      <View style={[styles.shell, styles.emptyShell]}>
        <Text style={styles.emptyCopy}>저장한 장소가 지도에 표시됩니다.</Text>
      </View>
    );
  }

  return (
    <View accessibilityRole="image" accessibilityLabel="저장한 장소를 연결한 루트 미리보기" style={styles.shell}>
      <View style={styles.gridLayer}>
        <View style={[styles.gridLine, styles.gridLineTop]} />
        <View style={[styles.gridLine, styles.gridLineMiddle]} />
        <View style={[styles.gridLine, styles.gridLineBottom]} />
      </View>

      <View style={styles.routeLayer}>
        <View style={styles.routeLine} />
        {places.map((place, index) => (
          <View key={place.id} style={styles.pinRow}>
            <View style={styles.pin}>
              <Text style={styles.pinNumber}>{index + 1}</Text>
            </View>
            <View style={styles.pinCopy}>
              <Text style={styles.placeName} numberOfLines={1}>
                {place.name}
              </Text>
              <Text style={styles.placeMeta} numberOfLines={1}>
                {place.subArea}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: "#07100B",
    borderColor: "rgba(33, 247, 130, 0.24)",
    borderRadius: radius.lg,
    borderWidth: 1,
    minHeight: 260,
    overflow: "hidden",
    padding: spacing.lg,
  },
  emptyShell: {
    justifyContent: "center",
  },
  emptyCopy: {
    color: colors.muted,
    fontSize: typography.body,
    fontWeight: "800",
    lineHeight: 24,
  },
  gridLayer: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.44,
  },
  gridLine: {
    backgroundColor: "rgba(247, 255, 247, 0.05)",
    height: 1,
    left: 0,
    position: "absolute",
    right: 0,
  },
  gridLineTop: {
    top: 58,
  },
  gridLineMiddle: {
    top: 132,
  },
  gridLineBottom: {
    top: 206,
  },
  routeLayer: {
    gap: spacing.md,
  },
  routeLine: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    bottom: spacing.xl,
    left: spacing.lg + 15,
    opacity: 0.88,
    position: "absolute",
    top: spacing.xl,
    width: 4,
  },
  pinRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 58,
  },
  pin: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: "rgba(247, 255, 247, 0.7)",
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  pinNumber: {
    color: colors.background,
    fontSize: typography.caption,
    fontWeight: "900",
  },
  pinCopy: {
    backgroundColor: "rgba(16, 19, 16, 0.82)",
    borderColor: "rgba(247, 255, 247, 0.08)",
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  placeName: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: "900",
  },
  placeMeta: {
    color: colors.muted,
    fontSize: typography.caption,
    fontWeight: "700",
  },
});
