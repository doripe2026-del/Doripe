import { useCallback, useMemo, useState } from "react";
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppScaffold } from "../components/AppScaffold";
import { BackButton } from "../components/BackButton";
import { Chip } from "../components/Chip";
import { PrimaryButton } from "../components/PrimaryButton";
import { deckPlaces, places } from "../domain/fixtures";
import { getPlacesForDeck } from "../domain/selectors";
import type { Place } from "../domain/types";
import type { MapStackParamList, TabParamList } from "../navigation/AppNavigator";
import { confirmSelectedPlaces, getDeckSession, setSelectedPlaces } from "../services/deckSession";
import { recordEvent } from "../services/events";
import { colors, radius, spacing, typography } from "../theme/tokens";

type PlaceGalleryScreenProps = NativeStackScreenProps<MapStackParamList, "PlaceGallery"> & {
  accessCodeId: string;
};

export function PlaceGalleryScreen({ accessCodeId, navigation, route }: PlaceGalleryScreenProps) {
  const deckPlacesForRoute = useMemo(
    () => getPlacesForDeck(deckPlaces, places, route.params.deckId),
    [route.params.deckId],
  );
  const [selectedPlaceIds, setSelectedPlaceIdsState] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const selectedCount = selectedPlaceIds.length;
  const canConfirm = selectedCount >= 2;

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const deckPlaceIds = new Set(deckPlacesForRoute.map((place) => place.id));

      async function loadSelectedPlaces() {
        try {
          const session = await getDeckSession(accessCodeId);

          if (isActive) {
            const sessionSelectedPlaceIds =
              session?.deckId === route.params.deckId ? session.selectedPlaceIds : [];
            setSelectedPlaceIdsState(
              sessionSelectedPlaceIds.filter((placeId) => deckPlaceIds.has(placeId)),
            );
          }
        } catch (error) {
          if (isActive) {
            setSelectedPlaceIdsState([]);
          }

          if (__DEV__) {
            console.warn("Failed to load deck session", error);
          }
        }

        try {
          await recordEvent({
            accessCodeId,
            eventName: "place_gallery_opened",
          });
        } catch (error) {
          if (__DEV__) {
            console.warn("Failed to record place gallery event", error);
          }
        }
      }

      void loadSelectedPlaces();

      return () => {
        isActive = false;
      };
    }, [accessCodeId, deckPlacesForRoute, route.params.deckId]),
  );

  function togglePlace(placeId: Place["id"]) {
    if (isSubmitting) {
      return;
    }

    setErrorMessage(null);
    setSelectedPlaceIdsState((current) =>
      current.includes(placeId)
        ? current.filter((selectedPlaceId) => selectedPlaceId !== placeId)
        : [...current, placeId],
    );
  }

  async function handleConfirm() {
    if (!canConfirm || isSubmitting) {
      return;
    }

    const now = new Date().toISOString();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await setSelectedPlaces(accessCodeId, selectedPlaceIds, now);
      await confirmSelectedPlaces(accessCodeId, selectedPlaceIds, now);
    } catch (error) {
      setErrorMessage("선택한 장소를 저장하지 못했어요. 잠시 후 다시 시도해주세요.");

      if (__DEV__) {
        console.warn("Failed to confirm selected places", error);
      }

      return;
    } finally {
      setIsSubmitting(false);
    }

    void recordEvent({
      accessCodeId,
      eventName: "place_selection_confirmed",
    }).catch((error) => {
      if (__DEV__) {
        console.warn("Failed to record place selection confirmed event", error);
      }
    });

    navigation.getParent<BottomTabNavigationProp<TabParamList>>()?.navigate("Saved");
  }

  return (
    <AppScaffold horizontalPadding={false}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={styles.screen}
      >
        <View style={styles.headerRow}>
          <BackButton onPress={() => navigation.goBack()} />
          <View style={styles.chipRow}>
            <Chip label={`${selectedCount}개 선택`} active={selectedCount > 0} />
            <Chip label="최소 2곳" active={canConfirm} />
          </View>
        </View>

        <View style={styles.header}>
          <Text style={styles.kicker}>PICK</Text>
          <Text style={styles.title}>방문할 장소를 골라요</Text>
          <Text style={styles.copy}>저장할 장소를 두 곳 이상 선택하면 저장함과 방문 순서에서 볼 수 있어요.</Text>
        </View>

        <View style={styles.list}>
          {deckPlacesForRoute.map((place) => {
            const isSelected = selectedPlaceIds.includes(place.id);

            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected, disabled: isSubmitting }}
                accessibilityLabel={`${place.name} 선택`}
                disabled={isSubmitting}
                key={place.id}
                onPress={() => togglePlace(place.id)}
                style={({ pressed }) => [
                  styles.card,
                  isSelected && styles.selectedCard,
                  pressed && styles.pressed,
                ]}
              >
                <ImageBackground
                  imageStyle={styles.imageRadius}
                  resizeMode="cover"
                  source={{ uri: place.coverImageUrl }}
                  style={styles.image}
                >
                  <View style={styles.imageScrim} />
                  <Text style={styles.placeName}>{place.name}</Text>
                </ImageBackground>

                <View style={styles.cardBody}>
                  <Text style={styles.placeCopy}>{place.shortCopy}</Text>
                  <View style={styles.tagRow}>
                    {[place.subArea, ...place.moodTags.slice(0, 2)].filter(Boolean).map((tag) => (
                      <Chip key={tag} label={tag} active={isSelected} />
                    ))}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
        <PrimaryButton
          disabled={!canConfirm || isSubmitting}
          label={canConfirm ? "선택한 장소로 보기" : "최소 2곳을 골라주세요"}
          onPress={() => void handleConfirm()}
        />
      </View>
    </AppScaffold>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md,
    overflow: "hidden",
  },
  cardBody: {
    gap: spacing.md,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "flex-end",
  },
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xxl + spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  copy: {
    color: colors.muted,
    fontSize: typography.body,
    fontWeight: "700",
    lineHeight: 24,
  },
  footer: {
    backgroundColor: colors.background,
    borderTopColor: colors.line,
    borderTopWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  error: {
    color: colors.danger,
    fontSize: typography.caption,
    fontWeight: "700",
    lineHeight: 20,
    textAlign: "center",
  },
  header: {
    gap: spacing.md,
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  image: {
    height: 164,
    justifyContent: "flex-end",
    padding: spacing.md,
  },
  imageRadius: {
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
  },
  imageScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.24)",
  },
  kicker: {
    color: colors.primaryDark,
    fontSize: typography.caption,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  list: {
    gap: spacing.md,
  },
  placeCopy: {
    color: colors.muted,
    fontSize: typography.body,
    fontWeight: "700",
    lineHeight: 24,
  },
  placeName: {
    color: colors.white,
    fontSize: typography.headline,
    fontWeight: "900",
    lineHeight: 36,
  },
  pressed: {
    opacity: 0.76,
  },
  screen: {
    flex: 1,
  },
  selectedCard: {
    borderColor: colors.primaryDark,
    borderWidth: 2,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  title: {
    color: colors.ink,
    fontSize: typography.title,
    fontWeight: "900",
    lineHeight: 48,
  },
});
