import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppScaffold } from "../components/AppScaffold";
import { BackButton } from "../components/BackButton";
import { Chip } from "../components/Chip";
import { GradientCard } from "../components/GradientCard";
import { StateMessage } from "../components/StateMessage";
import { decks, regions } from "../domain/fixtures";
import { getActiveDecksByRegionId, getRegionById } from "../domain/selectors";
import type { Deck } from "../domain/types";
import type { MapStackParamList } from "../navigation/AppNavigator";
import { setDeckSession } from "../services/deckSession";
import { recordEvent } from "../services/events";
import { colors, spacing, typography } from "../theme/tokens";

type DeckGalleryScreenProps = NativeStackScreenProps<MapStackParamList, "DeckGallery"> & {
  accessCodeId: string;
};

export function DeckGalleryScreen({ accessCodeId, navigation, route }: DeckGalleryScreenProps) {
  const region = getRegionById(regions, route.params.regionId);
  const activeDecks = getActiveDecksByRegionId(decks, route.params.regionId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const submittingRef = useRef(false);

  async function handleDeckPress(deck: Deck) {
    if (submittingRef.current) {
      return;
    }

    const now = new Date().toISOString();
    submittingRef.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await setDeckSession({
        accessCodeId,
        regionId: route.params.regionId,
        deckId: deck.id,
        seenPlaceIds: [],
        selectedPlaceIds: [],
        skippedPlaceIds: [],
        updatedAt: now,
      });
    } catch (error) {
      setErrorMessage("덱을 시작하지 못했어요. 잠시 후 다시 시도해주세요.");

      if (__DEV__) {
        console.warn("Failed to start deck session", error);
      }

      return;
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }

    void recordEvent({
      accessCodeId,
      eventName: "deck_selected",
    }).catch((error) => {
      if (__DEV__) {
        console.warn("Failed to record deck selected event", error);
      }
    });

    navigation.navigate("Discover", { regionId: route.params.regionId, deckId: deck.id });
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
          <Chip label={region?.shortName ?? "동네"} active />
        </View>

        <View style={styles.header}>
          <Text style={styles.kicker}>DECK</Text>
          <Text style={styles.title}>{region?.name ?? "열린 동네"}</Text>
          <Text style={styles.copy}>오늘의 기분에 맞는 작은 여정을 골라보세요.</Text>
          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
        </View>

        {activeDecks.length === 0 ? (
          <StateMessage
            title="아직 열린 덱이 없어요."
            copy="곧 이 동네의 장소 카드를 준비해둘게요."
            actionLabel="지도로 돌아가기"
            onAction={() => navigation.goBack()}
          />
        ) : (
          <View style={styles.deckList}>
            {activeDecks.map((deck) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${deck.title} 덱 선택`}
                accessibilityState={{ disabled: isSubmitting }}
                disabled={isSubmitting}
                key={deck.id}
                onPress={() => void handleDeckPress(deck)}
                style={({ pressed }) => [pressed && styles.pressed]}
              >
                <GradientCard tone={deck.tone} style={styles.deckCard}>
                  <View style={styles.deckMeta}>
                    <Chip label={deck.tone} />
                    <View style={styles.tagRow}>
                      {deck.tags.map((tag) => (
                        <Chip key={tag} label={tag} />
                      ))}
                    </View>
                  </View>
                  <View style={styles.deckCopy}>
                    <Text style={styles.deckTitle}>{deck.title}</Text>
                    <Text style={styles.deckDescription}>{deck.shortCopy}</Text>
                  </View>
                </GradientCard>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </AppScaffold>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  copy: {
    color: colors.muted,
    fontSize: typography.body,
    fontWeight: "700",
    lineHeight: 24,
  },
  deckCard: {
    minHeight: 178,
  },
  deckCopy: {
    gap: spacing.sm,
  },
  deckDescription: {
    color: colors.white,
    fontSize: typography.body,
    fontWeight: "800",
    lineHeight: 24,
  },
  deckList: {
    gap: spacing.md,
  },
  deckMeta: {
    gap: spacing.sm,
  },
  deckTitle: {
    color: colors.white,
    fontSize: typography.headline,
    fontWeight: "900",
    lineHeight: 36,
  },
  error: {
    color: colors.danger,
    fontSize: typography.caption,
    fontWeight: "700",
    lineHeight: 20,
  },
  header: {
    gap: spacing.md,
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  kicker: {
    color: colors.primaryDark,
    fontSize: typography.caption,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  pressed: {
    opacity: 0.78,
  },
  screen: {
    flex: 1,
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
