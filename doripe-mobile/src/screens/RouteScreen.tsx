import { useCallback, useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { RouteMap } from "../components/RouteMap";
import { SegmentList } from "../components/SegmentList";
import { places } from "../domain/fixtures";
import { getPlaceById } from "../domain/selectors";
import type { Place, SavedPlace } from "../domain/types";
import { recordEvent } from "../services/events";
import { getSavedPlaceIds } from "../services/savedPlaces";
import { readJson } from "../services/storage";
import { colors, spacing, typography } from "../theme/tokens";
import { buildNaverDirectionsUrl } from "../utils/naverLinks";

type RouteScreenProps = {
  accessCodeId: string;
};

const SAVED_PLACES_STORAGE_KEY = "doripe.savedPlaces";

export function RouteScreen({ accessCodeId }: RouteScreenProps) {
  const [routePlaces, setRoutePlaces] = useState<Place[]>([]);

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

          await recordEvent({
            accessCodeId,
            eventName: "route_opened",
          });
        } catch (error) {
          if (isActive) {
            setRoutePlaces([]);
          }

          if (__DEV__) {
            console.warn("Failed to load route places", error);
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
    try {
      await recordEvent({
        accessCodeId,
        eventName: "route_segment_clicked",
        segmentFromPlaceId: from.id,
        segmentToPlaceId: to.id,
      });

      await Linking.openURL(
        buildNaverDirectionsUrl({
          fromName: from.name,
          fromLat: from.lat,
          fromLng: from.lng,
          toName: to.name,
          toLat: to.lat,
          toLng: to.lng,
        }),
      );
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
        <Text style={styles.title}>루트</Text>
        <Text style={styles.copy}>저장한 장소를 방문하기 좋은 순서로 연결해요.</Text>
      </View>

      <RouteMap places={routePlaces} />
      <SegmentList places={routePlaces} onOpenSegment={handleOpenSegment} />
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
});
