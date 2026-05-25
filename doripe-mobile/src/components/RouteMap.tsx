import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { LayoutChangeEvent, StyleProp, ViewStyle } from "react-native";
import type { Place } from "../domain/types";
import { colors, radius, spacing, typography } from "../theme/tokens";

type RouteMapProps = {
  places: Place[];
  height?: number;
  selectedPlaceIds?: string[];
  showRoute?: boolean;
  style?: StyleProp<ViewStyle>;
  onPinPress?: (place: Place) => void;
};

type MapPoint = {
  place: Place;
  x: number;
  y: number;
};

const DEFAULT_WIDTH = 345;
const MAP_PADDING = 44;

export function RouteMap({
  places,
  height = 300,
  selectedPlaceIds,
  showRoute = false,
  style,
  onPinPress,
}: RouteMapProps) {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const mapPlaces = places.slice(0, 8);
  const selectedSet = useMemo(() => new Set(selectedPlaceIds ?? mapPlaces.map((place) => place.id)), [
    mapPlaces,
    selectedPlaceIds,
  ]);
  const points = useMemo(() => projectPlaces(mapPlaces, width, height), [height, mapPlaces, width]);

  function handleLayout(event: LayoutChangeEvent) {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth > 0 && Math.abs(nextWidth - width) > 1) {
      setWidth(nextWidth);
    }
  }

  return (
    <View
      accessibilityLabel="선택한 장소와 루트가 표시된 지도"
      accessibilityRole="image"
      onLayout={handleLayout}
      style={[styles.shell, { height }, style]}
    >
      <View style={[styles.road, styles.roadOne]} />
      <View style={[styles.road, styles.roadTwo]} />
      <View style={[styles.road, styles.roadThree]} />
      <View style={[styles.road, styles.roadFour]} />

      {showRoute
        ? points.slice(0, -1).map((point, index) => (
            <RouteLine key={`${point.place.id}-${points[index + 1]?.place.id}`} from={point} to={points[index + 1]} />
          ))
        : null}

      {points.map((point, index) => {
        const isSelected = selectedSet.has(point.place.id);
        const pin = (
          <View
            style={[
              styles.node,
              {
                left: point.x - 17,
                top: point.y - 17,
              },
              !isSelected && styles.nodeInactive,
            ]}
          >
            <Text style={styles.nodeNumber}>{index + 1}</Text>
          </View>
        );

        if (!onPinPress) {
          return <View key={point.place.id}>{pin}</View>;
        }

        return (
          <Pressable
            accessibilityLabel={`${point.place.name} 지도 핀`}
            accessibilityRole="button"
            key={point.place.id}
            onPress={() => onPinPress(point.place)}
            style={({ pressed }) => [styles.pinHitArea, pressed && styles.pressed]}
          >
            {pin}
          </Pressable>
        );
      })}

      {mapPlaces.length === 0 ? <Text style={styles.emptyCopy}>선택한 장소가 지도에 표시됩니다.</Text> : null}
    </View>
  );
}

function projectPlaces(places: Place[], width: number, height: number): MapPoint[] {
  if (places.length === 0) return [];

  const minLat = Math.min(...places.map((place) => place.lat));
  const maxLat = Math.max(...places.map((place) => place.lat));
  const minLng = Math.min(...places.map((place) => place.lng));
  const maxLng = Math.max(...places.map((place) => place.lng));
  const latRange = Math.max(maxLat - minLat, 0.003);
  const lngRange = Math.max(maxLng - minLng, 0.003);
  const drawableWidth = Math.max(width - MAP_PADDING * 2, 1);
  const drawableHeight = Math.max(height - MAP_PADDING * 2, 1);

  return places.map((place) => ({
    place,
    x: MAP_PADDING + ((place.lng - minLng) / lngRange) * drawableWidth,
    y: MAP_PADDING + (1 - (place.lat - minLat) / latRange) * drawableHeight,
  }));
}

function RouteLine({ from, to }: { from: MapPoint; to: MapPoint }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const angle = `${Math.atan2(dy, dx)}rad`;
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;

  return (
    <View
      style={[
        styles.routeLine,
        {
          left: midX - distance / 2,
          top: midY - 2.5,
          transform: [{ rotateZ: angle }],
          width: distance,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
    width: "100%",
  },
  road: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    position: "absolute",
  },
  roadOne: {
    height: 16,
    left: -24,
    top: 58,
    transform: [{ rotateZ: "8deg" }],
    width: 240,
  },
  roadTwo: {
    height: 16,
    right: -30,
    top: 86,
    transform: [{ rotateZ: "-5deg" }],
    width: 250,
  },
  roadThree: {
    height: 280,
    left: 82,
    top: -18,
    transform: [{ rotateZ: "6deg" }],
    width: 14,
  },
  roadFour: {
    height: 280,
    right: 132,
    top: -10,
    transform: [{ rotateZ: "-2deg" }],
    width: 12,
  },
  routeLine: {
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
    height: 5,
    position: "absolute",
  },
  pinHitArea: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  node: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: colors.ink,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    position: "absolute",
    width: 34,
  },
  nodeInactive: {
    opacity: 0.38,
  },
  nodeNumber: {
    color: colors.primaryInk,
    fontSize: typography.caption,
    fontWeight: "900",
    lineHeight: 14,
  },
  emptyCopy: {
    color: colors.muted,
    fontSize: typography.body,
    fontWeight: "700",
    left: spacing.lg,
    position: "absolute",
    top: spacing.lg,
  },
  pressed: {
    opacity: 0.72,
  },
});
