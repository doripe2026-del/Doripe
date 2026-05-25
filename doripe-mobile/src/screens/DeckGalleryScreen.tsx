import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, StyleSheet, View } from "react-native";
import { BackCircle, DesignCanvas, HomeIndicator, PhotoPanel, QuickNav, StatusBarReference, TextBox } from "../components/DesignCanvas";
import type { Deck } from "../domain/types";
import { getActiveDecksByRegionId, getRegionById } from "../domain/selectors";
import type { MapStackParamList } from "../navigation/AppNavigator";
import { useContent } from "../services/contentContext";
import { setDeckSession } from "../services/deckSession";
import { recordEvent } from "../services/events";

type DeckGalleryScreenProps = NativeStackScreenProps<MapStackParamList, "DeckGallery"> & {
  accessCodeId: string;
};

const toneColors: Record<Deck["tone"], string> = {
  lane: "#B2C7B2",
  lookout: "#DBBA8C",
  night: "#1F333D",
  sunset: "#F5995C",
};

export function DeckGalleryScreen({ accessCodeId, navigation, route }: DeckGalleryScreenProps) {
  const { decks, regions } = useContent();
  const region = getRegionById(regions, route.params.regionId);
  const activeDecks = getActiveDecksByRegionId(decks, route.params.regionId);

  async function openDeck(deckId: Deck["id"]) {
    try {
      await setDeckSession({
        accessCodeId,
        deckId,
        regionId: route.params.regionId,
        seenPlaceIds: [],
        selectedPlaceIds: [],
        skippedPlaceIds: [],
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (__DEV__) console.warn("Failed to start deck session", error);
    }

    void recordEvent({ accessCodeId, eventName: "deck_selected" }).catch((error) => {
      if (__DEV__) console.warn("Failed to record deck selected event", error);
    });
    navigation.navigate("Discover", { regionId: route.params.regionId, deckId });
  }

  return (
    <DesignCanvas>
      <StatusBarReference />
      <BackCircle onPress={() => navigation.goBack()} />
      <QuickNav
        active="home"
        onHome={() => navigation.navigate("MapHome")}
        onRoute={() => navigation.getParent()?.navigate("Route")}
        onSaved={() => navigation.getParent()?.navigate("Saved")}
      />
      <TextBox style={styles.eyebrow}>{region?.shortName ?? "DORIPE"}</TextBox>
      <TextBox style={styles.title}>{region?.name ?? "동네 덱"}</TextBox>
      <TextBox style={styles.copy}>원하는 분위기의 덱을 고르면, 그 안에서 갈 곳을 직접 선택해요.</TextBox>
      {activeDecks.length > 0 ? (
        activeDecks.slice(0, 3).map((deck, index) => (
          <DeckCard
            color={toneColors[deck.tone]}
            description={deck.shortCopy}
            key={deck.id}
            tags={deck.tags}
            title={deck.title}
            top={210 + index * 178}
            onPress={() => void openDeck(deck.id)}
          />
        ))
      ) : (
        <View style={styles.emptyState}>
          <TextBox style={styles.emptyTitle}>이 동네는 준비 중이에요</TextBox>
          <TextBox style={styles.emptyCopy}>MVP에서는 먼저 용산·후암·해방촌 덱부터 열어둘게요.</TextBox>
          <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}>
            <TextBox style={styles.emptyButtonText}>다른 동네 보기</TextBox>
          </Pressable>
        </View>
      )}
      <HomeIndicator />
    </DesignCanvas>
  );
}

function DeckCard({
  color,
  description,
  tags,
  title,
  top,
  onPress,
}: {
  color: string;
  description: string;
  tags: string[];
  title: string;
  top: number;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.deckHit, { top }, pressed && styles.pressed]}>
      <PhotoPanel color={color} height={150} left={0} radius={14} top={0} width={345}>
        <View style={styles.primaryChip}>
          <TextBox style={styles.primaryChipText}>{tags[0] ?? "추천"}</TextBox>
        </View>
        <View style={styles.secondaryChip}>
          <TextBox style={styles.secondaryChipText}>{tags[1] ?? "동네"}</TextBox>
        </View>
        <TextBox style={styles.cardTitle}>{title}</TextBox>
        <TextBox style={styles.cardCopy}>{description}</TextBox>
      </PhotoPanel>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    color: "#052E14",
    fontSize: 11,
    fontWeight: "800",
    left: 72,
    lineHeight: 14,
    position: "absolute",
    top: 67,
    width: 220,
  },
  title: {
    color: "#090B0A",
    fontSize: 29,
    fontWeight: "800",
    left: 24,
    lineHeight: 35,
    position: "absolute",
    top: 104,
    width: 330,
  },
  copy: {
    color: "#5C6159",
    fontSize: 13,
    fontWeight: "500",
    left: 24,
    lineHeight: 19,
    position: "absolute",
    top: 152,
    width: 330,
  },
  deckHit: {
    height: 150,
    left: 24,
    position: "absolute",
    width: 345,
  },
  primaryChip: {
    alignItems: "center",
    backgroundColor: "#090B0A",
    borderRadius: 999,
    height: 30,
    justifyContent: "center",
    left: 18,
    position: "absolute",
    top: 18,
    width: 52,
  },
  primaryChipText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 14,
    textAlign: "center",
  },
  secondaryChip: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,249,0.96)",
    borderRadius: 999,
    height: 30,
    justifyContent: "center",
    left: 76,
    position: "absolute",
    top: 18,
    width: 62,
  },
  secondaryChipText: {
    color: "#090B0A",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 14,
    textAlign: "center",
  },
  cardTitle: {
    color: "#FFFFFF",
    fontSize: 23,
    fontWeight: "800",
    left: 18,
    lineHeight: 28,
    position: "absolute",
    top: 92,
    width: 270,
  },
  cardCopy: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
    left: 18,
    lineHeight: 14,
    position: "absolute",
    top: 124,
    width: 280,
  },
  pressed: {
    opacity: 0.78,
  },
  emptyState: {
    backgroundColor: "#FFFFF9",
    borderColor: "#D8D2C3",
    borderRadius: 18,
    borderWidth: 1,
    height: 250,
    left: 24,
    position: "absolute",
    top: 236,
    width: 345,
  },
  emptyTitle: {
    color: "#090B0A",
    fontSize: 22,
    fontWeight: "800",
    left: 22,
    lineHeight: 27,
    position: "absolute",
    top: 44,
    width: 280,
  },
  emptyCopy: {
    color: "#5C6159",
    fontSize: 13,
    fontWeight: "500",
    left: 22,
    lineHeight: 19,
    position: "absolute",
    top: 88,
    width: 280,
  },
  emptyButton: {
    alignItems: "center",
    backgroundColor: "#21F073",
    borderRadius: 16,
    height: 48,
    justifyContent: "center",
    left: 22,
    position: "absolute",
    top: 170,
    width: 301,
  },
  emptyButtonText: {
    color: "#052E14",
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 18,
  },
});
