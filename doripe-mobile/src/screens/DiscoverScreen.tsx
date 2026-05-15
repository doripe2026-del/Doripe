import { useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { PlaceCard } from "../components/PlaceCard";
import { categories, places } from "../domain/fixtures";
import { getCategoryById, getReadyPlaces } from "../domain/selectors";
import type { SavedPlace } from "../domain/types";
import { addSavedPlace } from "../services/savedPlaces";
import { recordEvent } from "../services/events";
import { readJson, writeJson } from "../services/storage";
import { colors, radius, spacing, typography } from "../theme/tokens";

type DiscoverScreenProps = {
  accessCodeId: string;
};

const SAVED_PLACES_STORAGE_KEY = "doripe.savedPlaces";

export function DiscoverScreen({ accessCodeId }: DiscoverScreenProps) {
  const readyPlaces = useMemo(() => getReadyPlaces(places), []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const currentPlace = readyPlaces[currentIndex];

  function advanceCard() {
    setCurrentIndex((index) => index + 1);
  }

  async function handleSave() {
    if (!currentPlace || submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      const savedPlaces = await readJson<SavedPlace[]>(SAVED_PLACES_STORAGE_KEY, []);
      const nextSavedPlaces = addSavedPlace(
        savedPlaces,
        accessCodeId,
        currentPlace.id,
        new Date().toISOString(),
      );

      await writeJson(SAVED_PLACES_STORAGE_KEY, nextSavedPlaces);
      await recordEvent({
        accessCodeId,
        eventName: "place_saved",
        placeId: currentPlace.id,
      });
      advanceCard();
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  async function handleSkip() {
    if (!currentPlace || submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      await recordEvent({
        accessCodeId,
        eventName: "place_skipped",
        placeId: currentPlace.id,
      });
      advanceCard();
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  const countLabel = `${Math.min(currentIndex + 1, readyPlaces.length)}/${readyPlaces.length}`;
  const categoryName = currentPlace
    ? getCategoryById(categories, currentPlace.categoryId)?.name ?? ""
    : "";

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>Doripe</Text>
          <Text style={styles.subtitle}>오늘의 동네 취향 카드</Text>
        </View>
        <Text style={styles.count}>{countLabel}</Text>
      </View>

      <View style={styles.cardStage}>
        {currentPlace ? (
          <PlaceCard
            place={currentPlace}
            categoryName={categoryName}
            onSave={handleSave}
            onSkip={handleSkip}
            disabled={isSubmitting}
          />
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>오늘 볼 카드는 여기까지예요.</Text>
            <Text style={styles.emptyCopy}>저장함과 루트에서 저장한 장소를 확인해보세요.</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xxl,
  },
  header: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  brand: {
    color: colors.primary,
    fontSize: typography.title,
    fontWeight: "900",
    lineHeight: 46,
  },
  subtitle: {
    color: colors.muted,
    fontSize: typography.caption,
    fontWeight: "800",
    marginTop: spacing.xs,
  },
  count: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: "900",
    paddingBottom: spacing.xs,
  },
  cardStage: {
    flex: 1,
  },
  emptyState: {
    alignItems: "flex-start",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    gap: spacing.md,
    padding: spacing.lg,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: typography.headline,
    fontWeight: "900",
    lineHeight: 36,
  },
  emptyCopy: {
    color: colors.muted,
    fontSize: typography.body,
    fontWeight: "700",
    lineHeight: 24,
  },
});
