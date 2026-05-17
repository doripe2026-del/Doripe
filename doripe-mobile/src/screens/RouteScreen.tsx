import { useCallback, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { RouteMap } from "../components/RouteMap";
import { places } from "../domain/fixtures";
import { getPlaceById } from "../domain/selectors";
import type { Place, SavedPlace } from "../domain/types";
import { recordEvent } from "../services/events";
import { getSavedPlaceIds } from "../services/savedPlaces";
import { readJson } from "../services/storage";
import { colors, radius, spacing, touch, typography } from "../theme/tokens";
import { buildNaverDirectionsUrl } from "../utils/naverLinks";

type RouteScreenProps = {
  accessCodeId: string;
};

const SAVED_PLACES_STORAGE_KEY = "doripe.savedPlaces";

export function RouteScreen({ accessCodeId }: RouteScreenProps) {
  const [routePlaces, setRoutePlaces] = useState<Place[]>([]);
  const segments = routePlaces.slice(0, -1).map((from, index) => ({
    from,
    to: routePlaces[index + 1],
  }));

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadRoutePlaces() {
        try {
          const storedSavedPlaces = await readJson<SavedPlace[]>(SAVED_PLACES_STORAGE_KEY, []);
          const savedPlaceIds = getSavedPlaceIds(storedSavedPlaces, accessCodeId);
          const resolvedPlaces = savedPlaceIds
            .map((placeId) => getPlaceById(places, placeId))
            .filter((place): place is Place => Boolean(place));

          if (isActive) {
            setRoutePlaces(resolvedPlaces);
          }
        } catch (error) {
          if (isActive) {
            setRoutePlaces([]);
          }

          if (__DEV__) {
            console.warn("Failed to load route places", error);
          }

          return;
        }

        try {
          await recordEvent({
            accessCodeId,
            eventName: "route_opened",
          });
        } catch (error) {
          if (__DEV__) {
            console.warn("Failed to record route opened event", error);
          }
        }
      }

      void loadRoutePlaces();

      return () => {
        isActive = false;
      };
    }, [accessCodeId]),
  );

  async function handleOpenSegment(from: Place, to: Place) {
    const directionsUrl = buildNaverDirectionsUrl({
      fromName: from.name,
      fromLat: from.lat,
      fromLng: from.lng,
      toName: to.name,
      toLat: to.lat,
      toLng: to.lng,
    });

    try {
      await recordEvent({
        accessCodeId,
        eventName: "route_segment_clicked",
        segmentFromPlaceId: from.id,
        segmentToPlaceId: to.id,
      });
    } catch (error) {
      if (__DEV__) {
        console.warn("Failed to record route segment event", error);
      }
    }

    try {
      await Linking.openURL(directionsUrl);
    } catch (error) {
      if (__DEV__) {
        console.warn("Failed to open route segment", error);
      }
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      style={styles.screen}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.kicker}>ROUTE</Text>
        <Text style={styles.title}>방문 순서</Text>
        <Text style={styles.copy}>저장한 장소를 방문하기 좋은 순서로 연결해요.</Text>
      </View>

      <RouteMap places={routePlaces} />
      {routePlaces.length < 2 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyCopy}>저장한 장소가 2곳 이상이면 방문 순서를 볼 수 있어요.</Text>
        </View>
      ) : (
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
                accessibilityLabel={`${index + 1}구간 네이버 열기`}
                accessibilityHint={`${from.name}에서 ${to.name}까지 네이버 지도를 엽니다.`}
                onPress={() => handleOpenSegment(from, to)}
                style={({ pressed }) => [styles.openButton, pressed && styles.pressed]}
              >
                <Text style={styles.openButtonText}>네이버 열기</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xxl,
  },
  header: {
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  kicker: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  title: {
    color: colors.ink,
    fontSize: typography.title,
    fontWeight: "900",
    lineHeight: 48,
  },
  copy: {
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: 24,
  },
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
