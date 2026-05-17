import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppScaffold } from "../components/AppScaffold";
import { BackButton } from "../components/BackButton";
import { PlaceCard } from "../components/PlaceCard";
import { StateMessage } from "../components/StateMessage";
import { categories, deckPlaces, places } from "../domain/fixtures";
import { getCategoryById, getPlacesForDeck } from "../domain/selectors";
import type { MapStackParamList } from "../navigation/AppNavigator";
import { addSelectedPlace, addSkippedPlace } from "../services/deckSession";
import { recordEvent } from "../services/events";
import { colors, spacing, typography } from "../theme/tokens";

type DiscoverScreenProps = NativeStackScreenProps<MapStackParamList, "Discover"> & {
  accessCodeId: string;
};

export function DiscoverScreen({ accessCodeId, navigation, route }: DiscoverScreenProps) {
  const deckReadyPlaces = useMemo(
    () => getPlacesForDeck(deckPlaces, places, route.params.deckId),
    [route.params.deckId],
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const finishedRecordedRef = useRef(false);
  const currentPlace = deckReadyPlaces[currentIndex];

  useEffect(() => {
    setCurrentIndex(0);
    finishedRecordedRef.current = false;
  }, [route.params.deckId]);

  useEffect(() => {
    if (
      deckReadyPlaces.length === 0 ||
      currentIndex < deckReadyPlaces.length ||
      finishedRecordedRef.current
    ) {
      return;
    }

    finishedRecordedRef.current = true;
    void recordEvent({
      accessCodeId,
      eventName: "deck_finished",
    }).catch((error) => {
      if (__DEV__) {
        console.warn("Failed to record deck finished event", error);
      }
    });
  }, [accessCodeId, currentIndex, deckReadyPlaces.length]);

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
      await addSelectedPlace(accessCodeId, currentPlace.id, new Date().toISOString());
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
      await addSkippedPlace(accessCodeId, currentPlace.id, new Date().toISOString());
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

  const countLabel = `${Math.min(currentIndex + 1, deckReadyPlaces.length)}/${deckReadyPlaces.length}`;
  const categoryName = currentPlace
    ? getCategoryById(categories, currentPlace.categoryId)?.name ?? ""
    : "";

  return (
    <AppScaffold>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={styles.headerCopy}>
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
          <View style={styles.finishedState}>
            <StateMessage
              title="이 덱의 카드를 모두 봤어요."
              copy="마음에 든 장소를 한 번 더 보고 방문할 곳을 골라볼까요?"
              actionLabel="고른 장소 보기"
              onAction={() =>
                navigation.navigate("PlaceGallery", {
                  regionId: route.params.regionId,
                  deckId: route.params.deckId,
                })
              }
            />
          </View>
        )}
      </View>
    </AppScaffold>
  );
}

const styles = StyleSheet.create({
  brand: {
    color: colors.primary,
    fontSize: typography.title,
    fontWeight: "900",
    lineHeight: 46,
  },
  cardStage: {
    flex: 1,
  },
  count: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: "900",
  },
  finishedState: {
    alignItems: "stretch",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 24,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    paddingBottom: spacing.md,
  },
  headerCopy: {
    flex: 1,
  },
  subtitle: {
    color: colors.muted,
    fontSize: typography.caption,
    fontWeight: "800",
    marginTop: spacing.xs,
  },
});
