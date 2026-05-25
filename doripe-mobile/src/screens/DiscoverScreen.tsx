import { useEffect, useMemo, useRef, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Animated, Image, ImageBackground, PanResponder, Pressable, StyleSheet, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { BackCircle, DesignCanvas, TextBox } from "../components/DesignCanvas";
import type { Place } from "../domain/types";
import { getPlacesForDeck } from "../domain/selectors";
import type { MapStackParamList } from "../navigation/AppNavigator";
import { useContent } from "../services/contentContext";
import { addSelectedPlace, addSkippedPlace } from "../services/deckSession";
import { recordEvent } from "../services/events";
import { savePlaceForCurrentUser } from "../services/savedPlaces";

type DiscoverScreenProps = NativeStackScreenProps<MapStackParamList, "Discover"> & {
  accessCodeId: string;
};

type SwipeAction = "save" | "skip";

const heroShadeStops = createAlphaRamp(0, 0.68, 96);

export function DiscoverScreen({ accessCodeId, navigation, route }: DiscoverScreenProps) {
  const { deckPlaces, places } = useContent();
  const deckReadyPlaces = useMemo(
    () => getPlacesForDeck(deckPlaces, places, route.params.deckId),
    [route.params.deckId],
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const pan = useRef(new Animated.ValueXY()).current;
  const isSwipingRef = useRef(false);

  const currentPlace = deckReadyPlaces[currentIndex];
  const nextPlace = deckReadyPlaces[currentIndex + 1];
  const isComplete = currentIndex >= Math.max(deckReadyPlaces.length, 1);

  useEffect(() => {
    setCurrentIndex(0);
    pan.setValue({ x: 0, y: 0 });
  }, [pan, route.params.deckId]);

  useEffect(() => {
    if (!currentPlace) return;

    void recordEvent({ accessCodeId, eventName: "place_seen", placeId: currentPlace.id }).catch((error) => {
      if (__DEV__) console.warn("Failed to record place seen event", error);
    });
  }, [accessCodeId, currentPlace]);

  useEffect(() => {
    [currentPlace, nextPlace, deckReadyPlaces[0]].forEach((place) => {
      if (!place?.coverImageUrl) return;
      void Image.prefetch(place.coverImageUrl).catch((error) => {
        if (__DEV__) console.warn("Failed to prefetch discover image", error);
      });
    });
  }, [currentPlace, deckReadyPlaces, nextPlace]);

  async function finishSwipe(action: SwipeAction) {
    const place = currentPlace;

    if (!place) {
      isSwipingRef.current = false;
      return;
    }

    const updatedAt = new Date().toISOString();
    const nextIndex = currentIndex + 1;

    try {
      if (action === "save") {
        await addSelectedPlace(accessCodeId, place.id, updatedAt);
        await savePlaceForCurrentUser(accessCodeId, place.id, updatedAt);
      } else {
        await addSkippedPlace(accessCodeId, place.id, updatedAt);
      }

      void recordEvent({
        accessCodeId,
        eventName: action === "save" ? "place_saved" : "place_skipped",
        placeId: place.id,
      }).catch((error) => {
        if (__DEV__) console.warn("Failed to record discover swipe event", error);
      });

      setCurrentIndex(nextIndex);

      if (nextIndex >= Math.max(deckReadyPlaces.length, 1)) {
        void recordEvent({ accessCodeId, eventName: "deck_finished" }).catch((error) => {
          if (__DEV__) console.warn("Failed to record deck finished event", error);
        });
      }
    } finally {
      isSwipingRef.current = false;
    }
  }

  function animateSwipe(action: SwipeAction) {
    if (!currentPlace || isSwipingRef.current) return;

    isSwipingRef.current = true;
    const direction = action === "save" ? 1 : -1;

    Animated.timing(pan, {
      duration: 220,
      toValue: { x: direction * 460, y: action === "save" ? -28 : 28 },
      useNativeDriver: false,
    }).start(() => {
      pan.setValue({ x: 0, y: 0 });
      void finishSwipe(action);
    });
  }

  function resetSwipe() {
    Animated.spring(pan, {
      friction: 7,
      tension: 62,
      toValue: { x: 0, y: 0 },
      useNativeDriver: false,
    }).start();
  }

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 8 || Math.abs(gesture.dy) > 8,
    onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx > 92) {
        animateSwipe("save");
        return;
      }

      if (gesture.dx < -92) {
        animateSwipe("skip");
        return;
      }

      resetSwipe();
    },
    onPanResponderTerminate: resetSwipe,
  });

  const rotation = pan.x.interpolate({
    inputRange: [-240, 0, 240],
    outputRange: ["-9deg", "0deg", "9deg"],
  });
  const saveOpacity = pan.x.interpolate({
    inputRange: [24, 140],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const skipOpacity = pan.x.interpolate({
    inputRange: [-140, -24],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  const cardAnimatedStyle = {
    transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate: rotation }],
  };

  if (isComplete) {
    return (
      <DesignCanvas backgroundColor="#090B0A">
        <PhotoStage imageUrl={deckReadyPlaces[0]?.coverImageUrl} variant="complete" />
        <BackCircle onPress={() => navigation.goBack()} />
        <TextBox style={styles.completeTitle}>덱을 모두 봤어요</TextBox>
        <TextBox style={styles.completeCopy}>
          마음에 든 장소를 한 번 더 고르고,{"\n"}저장함에서 루트로 이어가요.
        </TextBox>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="다시 둘러보기"
          onPress={() => setCurrentIndex(0)}
          style={({ pressed }) => [styles.replayButton, pressed && styles.pressed]}
        >
          <TextBox style={styles.replayButtonText}>다시 둘러보기</TextBox>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="저장함으로 이동"
          onPress={() => navigation.getParent()?.navigate("Saved")}
          style={({ pressed }) => [styles.completeSavedButton, pressed && styles.pressed]}
        >
          <TextBox style={styles.replayButtonText}>저장함</TextBox>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="덱 장소 고르기"
          onPress={() => navigation.navigate("PlaceGallery", route.params)}
          style={({ pressed }) => [styles.completeButton, pressed && styles.pressed]}
        >
          <TextBox style={styles.completeButtonText}>덱 장소 고르기</TextBox>
        </Pressable>
      </DesignCanvas>
    );
  }

  return (
    <DesignCanvas backgroundColor="#090B0A">
      {nextPlace ? <PhotoStage dimmed imageUrl={nextPlace.coverImageUrl} variant="card" /> : null}
      <BackCircle onPress={() => navigation.goBack()} />
      <Animated.View style={[styles.swipeLayer, cardAnimatedStyle]} {...panResponder.panHandlers}>
        <PhotoStage imageUrl={currentPlace?.coverImageUrl} variant="card" />
        {currentPlace ? <DiscoverCardContent place={currentPlace} /> : null}
        <Animated.View style={[styles.swipeStamp, styles.saveStamp, { opacity: saveOpacity }]}>
          <TextBox style={styles.saveStampText}>저장</TextBox>
        </Animated.View>
        <Animated.View style={[styles.swipeStamp, styles.skipStamp, { opacity: skipOpacity }]}>
          <TextBox style={styles.skipStampText}>패스</TextBox>
        </Animated.View>
      </Animated.View>
      <View style={styles.progressPill}>
        <TextBox style={styles.progressText}>
          {Math.min(currentIndex + 1, deckReadyPlaces.length)} / {deckReadyPlaces.length}
        </TextBox>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="저장함으로 이동"
        onPress={() => navigation.getParent()?.navigate("Saved")}
        style={({ pressed }) => [styles.savedShortcut, pressed && styles.pressed]}
      >
        <TextBox style={styles.savedShortcutText}>저장함</TextBox>
      </Pressable>
      <View style={styles.actionRail}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="이 장소 패스"
          onPress={() => animateSwipe("skip")}
          style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}
        >
          <TextBox style={styles.skipButtonText}>패스</TextBox>
        </Pressable>
        <TextBox style={styles.swipeHint}>오른쪽 저장 · 왼쪽 패스</TextBox>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="이 장소 저장"
          onPress={() => animateSwipe("save")}
          style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}
        >
          <TextBox style={styles.saveButtonText}>저장</TextBox>
        </Pressable>
      </View>
    </DesignCanvas>
  );
}

function DiscoverCardContent({ place }: { place: Place }) {
  const tags = place.moodTags.slice(0, 3);

  return (
    <>
      {tags.map((tag, index) => (
        <View
          key={`${place.id}-${tag}`}
          style={[
            index === 0 ? styles.darkChip : styles.lightChip,
            { left: index === 0 ? 23 : index === 1 ? 93 : 175, width: index === 0 ? 61 : index === 1 ? 73 : 62 },
          ]}
        >
          <TextBox style={index === 0 ? styles.darkChipText : styles.lightChipText} numberOfLines={1}>
            {tag}
          </TextBox>
        </View>
      ))}
      <TextBox numberOfLines={1} style={styles.placeName}>
        {place.name}
      </TextBox>
      <TextBox numberOfLines={3} style={styles.placeCopy}>
        {place.shortCopy}
      </TextBox>
    </>
  );
}

function PhotoStage({
  dimmed = false,
  imageUrl,
  variant,
}: {
  dimmed?: boolean;
  imageUrl?: string;
  variant: "card" | "complete";
}) {
  const isComplete = variant === "complete";

  return (
    <>
      <View style={[styles.cardStage, isComplete && styles.completeCardStage]} />
      <ImageBackground
        imageStyle={styles.heroImage}
        resizeMode="cover"
        source={imageUrl ? { uri: imageUrl } : undefined}
        style={[styles.heroPhoto, isComplete && styles.completeHeroPhoto, dimmed && styles.nextHeroPhoto]}
      >
        <View style={[styles.photoWash, dimmed && styles.nextPhotoWash]} />
      </ImageBackground>
      <StripedGradient
        colors={heroShadeStops}
        height={330}
        radius={14}
        style={[styles.heroShade, isComplete && styles.completeHeroShade, dimmed && styles.nextHeroShade]}
        width={393}
      />
    </>
  );
}

function StripedGradient({
  colors,
  height,
  radius,
  style,
  width,
}: {
  colors: string[];
  height: number;
  radius: number;
  style?: StyleProp<ViewStyle>;
  width: number;
}) {
  const stripeHeight = height / colors.length;

  return (
    <View pointerEvents="none" style={[style, { borderRadius: radius, height, overflow: "hidden", width }]}>
      {colors.map((color, index) => (
        <View
          key={`${color}-${index}`}
          style={{
            backgroundColor: color,
            height: index === colors.length - 1 ? height - stripeHeight * (colors.length - 1) : stripeHeight,
            width,
          }}
        />
      ))}
    </View>
  );
}

function createAlphaRamp(startAlpha: number, endAlpha: number, steps: number) {
  return Array.from({ length: steps }, (_, index) => {
    const ratio = steps === 1 ? 1 : index / (steps - 1);
    const alpha = startAlpha + (endAlpha - startAlpha) * ratio;
    return `rgba(0,0,0,${alpha.toFixed(4)})`;
  });
}

const styles = StyleSheet.create({
  swipeLayer: {
    height: 852,
    left: 0,
    position: "absolute",
    top: 0,
    width: 393,
    zIndex: 2,
  },
  cardStage: {
    backgroundColor: "#FFFFF9",
    borderRadius: 24,
    height: 869,
    left: -7,
    position: "absolute",
    top: -17,
    width: 400,
  },
  completeCardStage: {
    left: -8,
    top: -27,
  },
  heroPhoto: {
    backgroundColor: "#B09678",
    borderRadius: 14,
    height: 869,
    left: -7,
    overflow: "hidden",
    position: "absolute",
    top: -17,
    width: 410,
  },
  completeHeroPhoto: {
    left: -8,
    top: -27,
  },
  nextHeroPhoto: {
    opacity: 0.52,
    transform: [{ scale: 0.965 }],
  },
  heroImage: {
    borderRadius: 14,
  },
  photoWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5,6,5,0.1)",
  },
  nextPhotoWash: {
    backgroundColor: "rgba(5,6,5,0.42)",
  },
  heroShade: {
    left: 0,
    position: "absolute",
    top: 522,
  },
  completeHeroShade: {
    left: -1,
    top: 512,
  },
  nextHeroShade: {
    opacity: 0.72,
  },
  darkChip: {
    alignItems: "center",
    backgroundColor: "#090B0A",
    borderRadius: 999,
    height: 38,
    justifyContent: "center",
    paddingHorizontal: 12,
    position: "absolute",
    top: 557,
    zIndex: 3,
  },
  darkChipText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 14,
    textAlign: "center",
  },
  lightChip: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,249,0.96)",
    borderRadius: 999,
    height: 38,
    justifyContent: "center",
    paddingHorizontal: 10,
    position: "absolute",
    top: 557,
    zIndex: 3,
  },
  lightChipText: {
    color: "#090B0A",
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 14,
    textAlign: "center",
  },
  placeName: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "700",
    left: 23,
    lineHeight: 35,
    position: "absolute",
    top: 641,
    width: 296,
    zIndex: 3,
  },
  placeCopy: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "500",
    left: 23,
    lineHeight: 19,
    position: "absolute",
    top: 697,
    width: 324,
    zIndex: 3,
  },
  progressPill: {
    alignItems: "center",
    backgroundColor: "rgba(9,11,10,0.56)",
    borderColor: "rgba(255,255,249,0.2)",
    borderRadius: 999,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    left: 76,
    position: "absolute",
    top: 56,
    width: 64,
    zIndex: 4,
  },
  progressText: {
    color: "#FFFFF9",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 14,
    textAlign: "center",
  },
  savedShortcut: {
    alignItems: "center",
    backgroundColor: "rgba(9,11,10,0.72)",
    borderColor: "rgba(255,255,249,0.22)",
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    left: 285,
    position: "absolute",
    top: 56,
    width: 84,
    zIndex: 4,
  },
  savedShortcutText: {
    color: "#FFFFF9",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
    textAlign: "center",
  },
  actionRail: {
    alignItems: "center",
    flexDirection: "row",
    height: 52,
    justifyContent: "space-between",
    left: 24,
    position: "absolute",
    top: 770,
    width: 345,
    zIndex: 4,
  },
  skipButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,249,0.92)",
    borderRadius: 18,
    height: 46,
    justifyContent: "center",
    width: 86,
  },
  skipButtonText: {
    color: "#090B0A",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 16,
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: "#21F073",
    borderRadius: 18,
    height: 46,
    justifyContent: "center",
    width: 86,
  },
  saveButtonText: {
    color: "#052E14",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 16,
  },
  swipeHint: {
    color: "rgba(255,255,249,0.8)",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 14,
    textAlign: "center",
    width: 142,
  },
  swipeStamp: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 2,
    height: 48,
    justifyContent: "center",
    position: "absolute",
    top: 150,
    width: 104,
    zIndex: 5,
  },
  saveStamp: {
    borderColor: "#21F073",
    left: 244,
    transform: [{ rotate: "9deg" }],
  },
  skipStamp: {
    borderColor: "#FFFFF9",
    left: 45,
    transform: [{ rotate: "-9deg" }],
  },
  saveStampText: {
    color: "#21F073",
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 24,
  },
  skipStampText: {
    color: "#FFFFF9",
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 24,
  },
  completeTitle: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "700",
    left: 24,
    lineHeight: 35,
    position: "absolute",
    textAlign: "center",
    top: 572,
    width: 345,
    zIndex: 2,
  },
  completeCopy: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "500",
    left: 44,
    lineHeight: 19,
    position: "absolute",
    textAlign: "center",
    top: 628,
    width: 305,
    zIndex: 2,
  },
  replayButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,249,0.92)",
    borderRadius: 19,
    height: 38,
    justifyContent: "center",
    left: 122,
    position: "absolute",
    top: 690,
    width: 148,
    zIndex: 3,
  },
  completeSavedButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,249,0.92)",
    borderRadius: 19,
    height: 38,
    justifyContent: "center",
    left: 276,
    position: "absolute",
    top: 690,
    width: 72,
    zIndex: 3,
  },
  replayButtonText: {
    color: "#090B0A",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
    textAlign: "center",
  },
  completeButton: {
    alignItems: "center",
    backgroundColor: "#21F073",
    borderRadius: 18,
    height: 52,
    justifyContent: "center",
    left: 24,
    position: "absolute",
    top: 736,
    width: 345,
    zIndex: 3,
  },
  completeButtonText: {
    color: "#052E14",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 18,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.78,
  },
});
