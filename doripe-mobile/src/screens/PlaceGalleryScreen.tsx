import { useEffect, useMemo, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, StyleSheet, View } from "react-native";
import { BackCircle, DesignCanvas, PhotoPanel, QuickNav, TextBox } from "../components/DesignCanvas";
import type { Place } from "../domain/types";
import { getPlacesForDeck } from "../domain/selectors";
import type { MapStackParamList } from "../navigation/AppNavigator";
import { useContent } from "../services/contentContext";
import { getDeckSession, setSelectedPlaces } from "../services/deckSession";
import { recordEvent } from "../services/events";
import { replaceSavedPlacesForCurrentUser } from "../services/savedPlaces";

type PlaceGalleryScreenProps = NativeStackScreenProps<MapStackParamList, "PlaceGallery"> & {
  accessCodeId: string;
};

export function PlaceGalleryScreen({ accessCodeId, navigation, route }: PlaceGalleryScreenProps) {
  const { categories, deckPlaces, places } = useContent();
  const deckReadyPlaces = useMemo(
    () => getPlacesForDeck(deckPlaces, places, route.params.deckId),
    [route.params.deckId],
  );
  const fallbackSelection = useMemo(() => deckReadyPlaces.slice(0, 3).map((place) => place.id), [deckReadyPlaces]);
  const [selectedIds, setSelectedIds] = useState<string[]>(fallbackSelection);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [message, setMessage] = useState<string | null>(null);
  const visiblePlaces = useMemo(
    () =>
      selectedCategoryId === "all"
        ? deckReadyPlaces
        : deckReadyPlaces.filter((place) => place.categoryId === selectedCategoryId),
    [deckReadyPlaces, selectedCategoryId],
  );

  useEffect(() => {
    let isMounted = true;

    setMessage(null);
    setSelectedIds(fallbackSelection);
    void getDeckSession(accessCodeId).then((session) => {
      if (!isMounted) return;

      const validSelectedIds =
        session?.selectedPlaceIds.filter((placeId) => deckReadyPlaces.some((place) => place.id === placeId)) ?? [];
      if (validSelectedIds.length > 0) {
        setSelectedIds(validSelectedIds);
      }
    });

    void recordEvent({ accessCodeId, eventName: "place_gallery_opened" }).catch((error) => {
      if (__DEV__) console.warn("Failed to record place gallery opened", error);
    });

    return () => {
      isMounted = false;
    };
  }, [accessCodeId, deckReadyPlaces, fallbackSelection]);

  function togglePlace(placeId: Place["id"]) {
    setMessage(null);
    setSelectedIds((currentIds) => {
      const nextIds = currentIds.includes(placeId)
        ? currentIds.filter((selectedId) => selectedId !== placeId)
        : [...currentIds, placeId];

      void setSelectedPlaces(accessCodeId, nextIds, new Date().toISOString()).catch((error) => {
        if (__DEV__) console.warn("Failed to persist selected places", error);
      });

      return nextIds;
    });
  }

  async function saveSelection() {
    if (selectedIds.length < 2) {
      setMessage("최소 2곳은 선택해야 루트를 만들 수 있어요.");
      return;
    }

    const now = new Date().toISOString();
    await setSelectedPlaces(accessCodeId, selectedIds, now);
    await replaceSavedPlacesForCurrentUser(accessCodeId, selectedIds, now);
    void recordEvent({ accessCodeId, eventName: "place_selection_confirmed" }).catch((error) => {
      if (__DEV__) console.warn("Failed to record place selection confirmed", error);
    });
    navigation.getParent()?.navigate("Route", { selectedAt: now });
  }

  return (
      <DesignCanvas>
      <BackCircle onPress={() => navigation.goBack()} />
      <QuickNav
        active="saved"
        onHome={() => navigation.navigate("MapHome")}
        onRoute={() => navigation.getParent()?.navigate("Route")}
        onSaved={() => navigation.getParent()?.navigate("Saved")}
      />
      <TextBox style={styles.eyebrow}>YONGSAN / HBC Deck</TextBox>
      <TextBox style={styles.title}>덱 안에서{"\n"}후보를 골라요</TextBox>
      <TextBox style={styles.copy}>
        사진 카드를 눌러 선택해요. 선택한 장소만 저장함에서 루트 후보로 이어져요.
      </TextBox>
      <View style={styles.selectedChip}>
        <TextBox style={styles.selectedChipText}>{selectedIds.length}개 선택</TextBox>
      </View>
      <View style={styles.minChip}>
        <TextBox style={styles.minChipText}>최소 2곳</TextBox>
      </View>
      <FilterButton
        active={selectedCategoryId === "all"}
        label="전체"
        left={204}
        onPress={() => setSelectedCategoryId("all")}
        width={52}
      />
      {categories.slice(0, 3).map((category, index) => (
        <FilterButton
          active={selectedCategoryId === category.id}
          key={category.id}
          label={category.name}
          left={260 + index * 43}
          onPress={() => setSelectedCategoryId(category.id)}
          width={39}
        />
      ))}
      {message ? <TextBox style={styles.message}>{message}</TextBox> : null}
      {visiblePlaces.length === 0 ? (
        <TextBox style={styles.emptyFilter}>이 필터에 맞는 장소가 없어요.</TextBox>
      ) : null}
      {visiblePlaces.map((place, index) => (
        <GalleryCard
          key={place.id}
          index={index}
          place={place}
          selected={selectedIds.includes(place.id)}
          onPress={() => togglePlace(place.id)}
        />
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="선택한 장소로 보기"
        onPress={() => void saveSelection()}
        style={({ pressed }) => [styles.cta, selectedIds.length < 2 && styles.ctaDisabled, pressed && styles.pressed]}
      >
        <TextBox style={styles.ctaText}>{selectedIds.length < 2 ? "최소 2곳 선택" : "선택한 장소로 보기"}</TextBox>
      </Pressable>
    </DesignCanvas>
  );
}

function FilterButton({
  active,
  label,
  left,
  onPress,
  width,
}: {
  active: boolean;
  label: string;
  left: number;
  onPress: () => void;
  width: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterButton,
        { left, width },
        active && styles.filterButtonActive,
        pressed && styles.pressed,
      ]}
    >
      <TextBox numberOfLines={1} style={[styles.filterText, active && styles.filterTextActive, { width }]}>
        {label}
      </TextBox>
    </Pressable>
  );
}

function GalleryCard({
  index,
  place,
  selected,
  onPress,
}: {
  index: number;
  place: Place;
  selected: boolean;
  onPress: () => void;
}) {
  const full = index === 0;
  const x = full ? 24 : index % 2 === 1 ? 24 : 207;
  const row = Math.floor((index - 1) / 2);
  const top = full ? 282 : 456 + row * 168;
  const width = full ? 345 : 162;
  const height = full ? 154 : 150;

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${place.name} 선택`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.cardHit,
        { height, left: x, top, width },
        selected && styles.cardHitSelected,
        pressed && styles.pressed,
      ]}
    >
      <PhotoPanel color="#B09678" height={height} imageUrl={place.coverImageUrl} left={0} radius={14} top={0} width={width}>
        <TextBox style={styles.cardNumber}>{String(index + 1).padStart(2, "0")}</TextBox>
        <View style={[styles.check, selected ? styles.checkSelected : styles.checkIdle, { left: width - 38 }]}>
          {selected ? <TextBox style={styles.checkText}>✓</TextBox> : null}
        </View>
        <TextBox numberOfLines={1} style={[styles.cardTitle, { top: height - 55, width: width - 28 }]}>
          {place.name}
        </TextBox>
        <TextBox numberOfLines={2} style={[styles.cardCopy, { top: height - 31, width: width - 28 }]}>
          {place.shortCopy}
        </TextBox>
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
    fontSize: 30,
    fontWeight: "800",
    left: 24,
    lineHeight: 36,
    position: "absolute",
    top: 102,
    width: 330,
  },
  copy: {
    color: "#5C6159",
    fontSize: 13,
    fontWeight: "500",
    left: 24,
    lineHeight: 19,
    position: "absolute",
    top: 181,
    width: 330,
  },
  selectedChip: {
    alignItems: "center",
    backgroundColor: "#090B0A",
    borderRadius: 999,
    height: 30,
    justifyContent: "center",
    left: 24,
    position: "absolute",
    top: 232,
    width: 82,
  },
  selectedChipText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 14,
  },
  minChip: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,249,0.96)",
    borderColor: "#D8D2C3",
    borderRadius: 999,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    left: 114,
    position: "absolute",
    top: 232,
    width: 76,
  },
  minChipText: {
    color: "#090B0A",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 14,
  },
  filterButton: {
    alignItems: "center",
    backgroundColor: "#FFFFF9",
    borderColor: "#D8D2C3",
    borderRadius: 999,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    position: "absolute",
    top: 232,
  },
  filterButtonActive: {
    backgroundColor: "#090B0A",
    borderColor: "#090B0A",
  },
  filterText: {
    color: "#090B0A",
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 12,
    textAlign: "center",
  },
  filterTextActive: {
    color: "#FFFFF9",
  },
  message: {
    color: "#B34C1C",
    fontSize: 11,
    fontWeight: "700",
    left: 204,
    lineHeight: 14,
    position: "absolute",
    textAlign: "right",
    top: 240,
    width: 165,
  },
  emptyFilter: {
    color: "#5C6159",
    fontSize: 13,
    fontWeight: "700",
    left: 24,
    lineHeight: 18,
    position: "absolute",
    textAlign: "center",
    top: 362,
    width: 345,
  },
  cardHit: {
    borderRadius: 14,
    position: "absolute",
  },
  cardHitSelected: {
    shadowColor: "#21F073",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
  },
  cardNumber: {
    color: "#21F073",
    fontSize: 11,
    fontWeight: "800",
    left: 14,
    lineHeight: 14,
    position: "absolute",
    top: 16,
    width: 36,
  },
  check: {
    alignItems: "center",
    borderRadius: 12,
    height: 24,
    justifyContent: "center",
    position: "absolute",
    top: 14,
    width: 24,
  },
  checkIdle: {
    backgroundColor: "rgba(255,255,249,0.28)",
    borderColor: "rgba(255,255,249,0.7)",
    borderWidth: 1,
  },
  checkSelected: {
    backgroundColor: "#21F073",
    borderColor: "#052E14",
    borderWidth: 1,
  },
  checkText: {
    color: "#052E14",
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 18,
  },
  cardTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    left: 14,
    lineHeight: 20,
    position: "absolute",
  },
  cardCopy: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
    left: 14,
    lineHeight: 13,
    position: "absolute",
  },
  cta: {
    alignItems: "center",
    backgroundColor: "#21F073",
    borderRadius: 18,
    height: 52,
    justifyContent: "center",
    left: 24,
    position: "absolute",
    top: 772,
    width: 345,
  },
  ctaDisabled: {
    backgroundColor: "#BFC5B6",
  },
  ctaText: {
    color: "#052E14",
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.78,
  },
});
