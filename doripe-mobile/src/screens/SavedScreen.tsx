import { useCallback, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { places } from "../domain/fixtures";
import { getPlaceById } from "../domain/selectors";
import type { Place, SavedPlace } from "../domain/types";
import { recordEvent } from "../services/events";
import { getSavedPlaceIds } from "../services/savedPlaces";
import { readJson } from "../services/storage";
import { colors, radius, spacing, touch, typography } from "../theme/tokens";
import { buildNaverPlaceUrl } from "../utils/naverLinks";

type SavedScreenProps = {
  accessCodeId: string;
};

const SAVED_PLACES_STORAGE_KEY = "doripe.savedPlaces";

export function SavedScreen({ accessCodeId }: SavedScreenProps) {
  const [savedPlaces, setSavedPlaces] = useState<Place[]>([]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadSavedPlaces() {
        try {
          const storedSavedPlaces = await readJson<SavedPlace[]>(SAVED_PLACES_STORAGE_KEY, []);
          const savedPlaceIds = getSavedPlaceIds(storedSavedPlaces, accessCodeId);
          const resolvedPlaces = savedPlaceIds
            .map((placeId) => getPlaceById(places, placeId))
            .filter((place): place is Place => Boolean(place));

          if (isActive) {
            setSavedPlaces(resolvedPlaces);
          }

          await recordEvent({
            accessCodeId,
            eventName: "saved_list_opened",
          });
        } catch (error) {
          if (isActive) {
            setSavedPlaces([]);
          }

          if (__DEV__) {
            console.warn("Failed to load saved places", error);
          }
        }
      }

      void loadSavedPlaces();

      return () => {
        isActive = false;
      };
    }, [accessCodeId]),
  );

  function openNaverPlace(naverPlaceUrl: string) {
    void Linking.openURL(buildNaverPlaceUrl(naverPlaceUrl));
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      style={styles.screen}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.kicker}>SAVED</Text>
        <Text style={styles.title}>저장함</Text>
      </View>

      {savedPlaces.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyCopy}>마음에 드는 장소를 저장하면 여기에 모여요.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {savedPlaces.map((item, index) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.order}>{String(index + 1).padStart(2, "0")}</Text>
                <View style={styles.placeCopy}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.shortCopy}>{item.shortCopy}</Text>
                </View>
              </View>

              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`${item.name} 네이버지도에서 보기`}
                onPress={() => openNaverPlace(item.naverPlaceUrl)}
                style={({ pressed }) => [styles.mapLink, pressed && styles.pressed]}
              >
                <Text style={styles.mapLinkText}>네이버지도에서 보기</Text>
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
    gap: spacing.xs,
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
  emptyState: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    minHeight: 180,
    justifyContent: "center",
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
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  cardTop: {
    flexDirection: "row",
    gap: spacing.md,
  },
  order: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: "900",
    lineHeight: 22,
    minWidth: 28,
  },
  placeCopy: {
    flex: 1,
    gap: spacing.sm,
  },
  name: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 28,
  },
  shortCopy: {
    color: colors.muted,
    fontSize: typography.body,
    fontWeight: "700",
    lineHeight: 24,
  },
  mapLink: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(33, 247, 130, 0.12)",
    borderColor: "rgba(33, 247, 130, 0.42)",
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: touch.minimum,
    paddingHorizontal: spacing.md,
  },
  mapLinkText: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.72,
  },
});
