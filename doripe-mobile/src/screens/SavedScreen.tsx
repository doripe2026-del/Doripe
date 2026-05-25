import { useCallback, useState } from "react";
import { ImageBackground, Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { BackCircle, DesignCanvas, PhotoPanel, QuickNav, StatusBarReference, TextBox } from "../components/DesignCanvas";
import type { Place } from "../domain/types";
import { getCategoryById, getPlaceById } from "../domain/selectors";
import type { TabParamList } from "../navigation/AppNavigator";
import { useContent } from "../services/contentContext";
import { recordEvent } from "../services/events";
import { loadSavedPlaceIds, removeSavedPlaceForCurrentUser } from "../services/savedPlaces";

type SavedScreenProps = {
  accessCodeId: string;
};

export function SavedScreen({ accessCodeId }: SavedScreenProps) {
  const navigation = useNavigation<BottomTabNavigationProp<TabParamList, "Saved">>();
  const { categories, places } = useContent();
  const [savedPlaces, setSavedPlaces] = useState<Place[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const loadSavedPlaces = useCallback(async () => {
    const savedPlaceIds = await loadSavedPlaceIds(accessCodeId);
    const nextSavedPlaces = savedPlaceIds
      .map((placeId) => getPlaceById(places, placeId))
      .filter((place): place is Place => place !== undefined);

    setSavedPlaces(nextSavedPlaces);
    setMessage(null);

    void recordEvent({ accessCodeId, eventName: "saved_list_opened" }).catch((error) => {
      if (__DEV__) console.warn("Failed to record saved list opened", error);
    });
  }, [accessCodeId, places]);

  useFocusEffect(
    useCallback(() => {
      void loadSavedPlaces();
    }, [loadSavedPlaces]),
  );

  async function removePlace(placeId: Place["id"]) {
    await removeSavedPlaceForCurrentUser(accessCodeId, placeId);
    await loadSavedPlaces();
  }

  function openRoute() {
    if (savedPlaces.length < 2) {
      setMessage("루트를 만들려면 최소 2곳을 저장해야 해요.");
      return;
    }

    navigation.navigate("Route", { selectedAt: new Date().toISOString() });
  }

  return (
    <DesignCanvas>
      <StatusBarReference />
      <BackCircle onPress={() => navigation.navigate("Map")} />
      <QuickNav
        active="saved"
        onHome={() => navigation.navigate("Map")}
        onRoute={() => navigation.navigate("Route")}
        onSaved={() => void loadSavedPlaces()}
      />
      <TextBox style={styles.eyebrow}>Saved places</TextBox>
      <TextBox style={styles.title}>저장함</TextBox>
      <TextBox style={styles.copy}>저장한 장소를 모아보고, 2곳 이상이면 바로 루트로 이어갈 수 있어요.</TextBox>

      {savedPlaces.length > 0 ? (
        <>
          <SavedMap places={savedPlaces} />
          <TextBox style={styles.countText}>{savedPlaces.length}곳 저장됨</TextBox>
          {message ? <TextBox style={styles.message}>{message}</TextBox> : null}
          {savedPlaces.slice(0, 4).map((place, index) => (
            <SavedPlaceCard
              categoryName={getCategoryById(categories, place.categoryId)?.name ?? "장소"}
              index={index}
              key={place.id}
              place={place}
              onRemove={() => void removePlace(place.id)}
            />
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: savedPlaces.length < 2 }}
            disabled={savedPlaces.length < 2}
            onPress={openRoute}
            style={({ pressed }) => [styles.routeButton, savedPlaces.length < 2 && styles.routeButtonDisabled, pressed && styles.pressed]}
          >
            <TextBox style={[styles.routeButtonText, savedPlaces.length < 2 && styles.routeButtonTextDisabled]}>
              {savedPlaces.length < 2 ? "2곳 이상 저장하면 루트 만들기" : "이 장소들로 루트 만들기"}
            </TextBox>
          </Pressable>
        </>
      ) : (
        <EmptySavedState onStart={() => navigation.navigate("Map")} />
      )}
    </DesignCanvas>
  );
}

function SavedMap({ places: savedPlaces }: { places: Place[] }) {
  return (
    <View style={styles.mapPreview}>
      <View style={styles.mapRoadWide} />
      <View style={styles.mapRoadThin} />
      <View style={styles.mapRiver} />
      {savedPlaces.slice(0, 4).map((place, index) => (
        <View
          key={place.id}
          style={[
            styles.mapPin,
            {
              left: [54, 128, 218, 282][index] ?? 54,
              top: [102, 76, 124, 58][index] ?? 102,
            },
          ]}
        >
          <TextBox style={styles.mapPinText}>{index + 1}</TextBox>
        </View>
      ))}
    </View>
  );
}

function SavedPlaceCard({
  categoryName,
  index,
  onRemove,
  place,
}: {
  categoryName: string;
  index: number;
  onRemove: () => void;
  place: Place;
}) {
  const left = index % 2 === 0 ? 24 : 202;
  const top = 370 + Math.floor(index / 2) * 142;

  return (
    <View style={[styles.savedCard, { left, top }]}>
      <ImageBackground
        imageStyle={styles.savedCardImage}
        resizeMode="cover"
        source={{ uri: place.coverImageUrl }}
        style={styles.savedCardPhoto}
      >
        <View style={styles.savedCardShade} />
        <TextBox style={styles.savedCardIndex}>{String(index + 1).padStart(2, "0")}</TextBox>
        <Pressable accessibilityLabel={`${place.name} 저장 취소`} accessibilityRole="button" onPress={onRemove} style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}>
          <TextBox style={styles.removeButtonText}>×</TextBox>
        </Pressable>
        <TextBox numberOfLines={1} style={styles.savedCardTitle}>{place.name}</TextBox>
        <TextBox numberOfLines={1} style={styles.savedCardCopy}>{categoryName} · {place.nearestStation}</TextBox>
      </ImageBackground>
    </View>
  );
}

function EmptySavedState({ onStart }: { onStart: () => void }) {
  return (
    <>
      <PhotoPanel color="#D8BB82" height={284} left={24} radius={22} top={218} width={345}>
        <View style={styles.emptyOrb}>
          <TextBox style={styles.emptyOrbText}>+</TextBox>
        </View>
        <TextBox style={styles.emptyTitle}>아직 저장한 장소가 없어요</TextBox>
        <TextBox style={styles.emptyCopy}>동네 핀을 누르고 덱을 넘기면서 마음에 드는 장소를 저장해 보세요.</TextBox>
      </PhotoPanel>
      <Pressable accessibilityRole="button" onPress={onStart} style={({ pressed }) => [styles.startButton, pressed && styles.pressed]}>
        <TextBox style={styles.startButtonText}>동네 고르러 가기</TextBox>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    color: "#5C6159",
    fontSize: 11,
    fontWeight: "800",
    left: 72,
    lineHeight: 14,
    position: "absolute",
    top: 67,
    width: 150,
  },
  title: {
    color: "#090B0A",
    fontSize: 31,
    fontWeight: "800",
    left: 24,
    lineHeight: 36,
    position: "absolute",
    top: 104,
    width: 300,
  },
  copy: {
    color: "#5C6159",
    fontSize: 13,
    fontWeight: "500",
    left: 24,
    lineHeight: 18,
    position: "absolute",
    top: 150,
    width: 300,
  },
  mapPreview: {
    backgroundColor: "#E1DED4",
    borderColor: "#D8D2C3",
    borderRadius: 18,
    borderWidth: 1,
    height: 150,
    left: 24,
    overflow: "hidden",
    position: "absolute",
    top: 204,
    width: 345,
  },
  mapRoadWide: {
    backgroundColor: "#FFFFF9",
    borderRadius: 10,
    height: 12,
    left: -18,
    position: "absolute",
    top: 98,
    transform: [{ rotate: "-11deg" }],
    width: 390,
  },
  mapRoadThin: {
    backgroundColor: "#FFFFF9",
    borderRadius: 8,
    height: 210,
    left: 78,
    position: "absolute",
    top: -24,
    transform: [{ rotate: "12deg" }],
    width: 10,
  },
  mapRiver: {
    backgroundColor: "rgba(157,196,190,0.72)",
    height: 32,
    left: -20,
    position: "absolute",
    top: 36,
    transform: [{ rotate: "-7deg" }],
    width: 390,
  },
  mapPin: {
    alignItems: "center",
    backgroundColor: "#21F073",
    borderColor: "#090B0A",
    borderRadius: 14,
    borderWidth: 1.5,
    height: 28,
    justifyContent: "center",
    position: "absolute",
    width: 28,
  },
  mapPinText: {
    color: "#090B0A",
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 13,
    textAlign: "center",
  },
  countText: {
    color: "#052E14",
    fontSize: 12,
    fontWeight: "800",
    left: 24,
    lineHeight: 15,
    position: "absolute",
    top: 360,
    width: 140,
  },
  message: {
    color: "#B34C1C",
    fontSize: 11,
    fontWeight: "700",
    left: 174,
    lineHeight: 14,
    position: "absolute",
    textAlign: "right",
    top: 360,
    width: 195,
  },
  savedCard: {
    borderRadius: 16,
    height: 126,
    overflow: "hidden",
    position: "absolute",
    width: 167,
  },
  savedCardPhoto: {
    height: 126,
    width: 167,
  },
  savedCardImage: {
    borderRadius: 16,
  },
  savedCardShade: {
    backgroundColor: "rgba(9,11,10,0.42)",
    bottom: 0,
    height: 70,
    left: 0,
    position: "absolute",
    right: 0,
  },
  savedCardIndex: {
    color: "#21F073",
    fontSize: 10,
    fontWeight: "900",
    left: 12,
    lineHeight: 12,
    position: "absolute",
    top: 12,
    width: 32,
  },
  removeButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,249,0.9)",
    borderRadius: 13,
    height: 26,
    justifyContent: "center",
    position: "absolute",
    right: 10,
    top: 10,
    width: 26,
  },
  removeButtonText: {
    color: "#090B0A",
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 18,
    textAlign: "center",
  },
  savedCardTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    left: 12,
    lineHeight: 18,
    position: "absolute",
    top: 82,
    width: 140,
  },
  savedCardCopy: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
    left: 12,
    lineHeight: 13,
    position: "absolute",
    top: 104,
    width: 140,
  },
  routeButton: {
    alignItems: "center",
    backgroundColor: "#21F073",
    borderRadius: 18,
    height: 52,
    justifyContent: "center",
    left: 24,
    position: "absolute",
    top: 760,
    width: 345,
  },
  routeButtonDisabled: {
    backgroundColor: "#C8CDBF",
  },
  routeButtonText: {
    color: "#052E14",
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 18,
    textAlign: "center",
  },
  routeButtonTextDisabled: {
    color: "#6D7569",
  },
  emptyOrb: {
    alignItems: "center",
    backgroundColor: "#21F073",
    borderRadius: 30,
    height: 60,
    justifyContent: "center",
    left: 142,
    position: "absolute",
    top: 50,
    width: 60,
  },
  emptyOrbText: {
    color: "#052E14",
    fontSize: 32,
    fontWeight: "800",
    lineHeight: 36,
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    left: 24,
    lineHeight: 29,
    position: "absolute",
    textAlign: "center",
    top: 142,
    width: 297,
  },
  emptyCopy: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    left: 36,
    lineHeight: 19,
    position: "absolute",
    textAlign: "center",
    top: 184,
    width: 273,
  },
  startButton: {
    alignItems: "center",
    backgroundColor: "#21F073",
    borderRadius: 18,
    height: 52,
    justifyContent: "center",
    left: 24,
    position: "absolute",
    top: 720,
    width: 345,
  },
  startButtonText: {
    color: "#052E14",
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.78,
  },
});
