import { useCallback, useEffect, useMemo, useState } from "react";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import * as Clipboard from "expo-clipboard";
import { ImageBackground, Linking, Pressable, Share, StyleSheet, View } from "react-native";
import { CircleNumberPin, DesignCanvas, HomeIndicator, QuickNav, StatusBarReference, TextBox } from "../components/DesignCanvas";
import type { Category, Place } from "../domain/types";
import { getPlaceById } from "../domain/selectors";
import type { TabParamList } from "../navigation/AppNavigator";
import { useContent } from "../services/contentContext";
import { recordEvent } from "../services/events";
import { loadSavedPlaceIds, replaceSavedPlacesForCurrentUser } from "../services/savedPlaces";
import { buildNaverDirectionsUrl } from "../utils/naverLinks";

type RouteScreenProps = BottomTabScreenProps<TabParamList, "Route"> & {
  accessCodeId: string;
};

type RouteStep = "pick" | "order" | "saved";

const pickPinPositions = [
  { left: 72, top: 356 },
  { left: 184, top: 300 },
  { left: 276, top: 244 },
  { left: 306, top: 334 },
];
const orderPinPositions = [
  { left: 58, top: 500 },
  { left: 132, top: 456 },
  { left: 202, top: 296 },
  { left: 286, top: 244 },
];
const savedPinPositions = [
  { left: 72, top: 440 },
  { left: 142, top: 400 },
  { left: 210, top: 292 },
  { left: 284, top: 274 },
];

export function RouteScreen({ accessCodeId, navigation, route }: RouteScreenProps) {
  const { categories, places } = useContent();
  const [step, setStep] = useState<RouteStep>("pick");
  const [shareOpen, setShareOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const defaultRoutePlaces = useMemo(() => places.slice(0, 4), []);
  const [candidatePlaces, setCandidatePlaces] = useState<Place[]>(defaultRoutePlaces);
  const [routePlaces, setRoutePlaces] = useState<Place[]>(defaultRoutePlaces);
  const filteredCandidatePlaces = useMemo(
    () =>
      selectedCategoryId === "all"
        ? candidatePlaces
        : candidatePlaces.filter((place) => place.categoryId === selectedCategoryId),
    [candidatePlaces, selectedCategoryId],
  );

  const loadRoutePlaces = useCallback(async () => {
    const savedPlaceIds = await loadSavedPlaceIds(accessCodeId);
    const selectedPlaces = savedPlaceIds
      .map((placeId) => getPlaceById(places, placeId))
      .filter((place): place is Place => place !== undefined);

    const nextPlaces = selectedPlaces.length >= 2 ? selectedPlaces : defaultRoutePlaces;
    setCandidatePlaces(nextPlaces);
    setRoutePlaces(nextPlaces);
  }, [accessCodeId, defaultRoutePlaces, places]);

  useEffect(() => {
    setStep("pick");
    setShareOpen(false);
    void loadRoutePlaces();
  }, [loadRoutePlaces, route.params?.selectedAt]);

  function openOrder() {
    if (routePlaces.length < 2) return;

    setShareOpen(false);
    setStep("order");
  }

  function toggleRoutePlace(placeId: Place["id"]) {
    setRoutePlaces((currentPlaces) => {
      if (currentPlaces.some((place) => place.id === placeId)) {
        return currentPlaces.filter((place) => place.id !== placeId);
      }

      const place = candidatePlaces.find((candidatePlace) => candidatePlace.id === placeId);
      return place ? [...currentPlaces, place] : currentPlaces;
    });
  }

  function moveRoutePlace(placeId: Place["id"], direction: -1 | 1) {
    setRoutePlaces((currentPlaces) => {
      const index = currentPlaces.findIndex((place) => place.id === placeId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= currentPlaces.length) {
        return currentPlaces;
      }

      const nextPlaces = [...currentPlaces];
      const [place] = nextPlaces.splice(index, 1);
      nextPlaces.splice(nextIndex, 0, place);
      return nextPlaces;
    });
  }

  async function confirmOrder() {
    const now = new Date().toISOString();
    await replaceSavedPlacesForCurrentUser(
      accessCodeId,
      routePlaces.map((place) => place.id),
      now,
    );
    void recordEvent({ accessCodeId, eventName: "route_order_confirmed" }).catch((error) => {
      if (__DEV__) console.warn("Failed to record route order confirmed", error);
    });
    setShareOpen(false);
    setStep("saved");
  }

  function buildRouteShareMessage() {
    return `Doripe 루트: ${routePlaces.map((place, index) => `${index + 1}. ${place.name}`).join(" → ")}`;
  }

  async function shareRoute() {
    await Clipboard.setStringAsync(buildRouteShareMessage());
    setShareOpen(true);
    void recordEvent({ accessCodeId, eventName: "route_shared" }).catch((error) => {
      if (__DEV__) console.warn("Failed to record route shared", error);
    });
  }

  async function shareChannel(channel: string) {
    setShareOpen(true);

    if (channel === "copy") {
      await Clipboard.setStringAsync(buildRouteShareMessage());
    } else {
      await Share.share({
        message: buildRouteShareMessage(),
      });
    }
    void recordEvent({ accessCodeId, eventName: "route_shared" }).catch((error) => {
      if (__DEV__) console.warn(`Failed to record ${channel} share`, error);
    });
  }

  async function startNavigation() {
    const [from, to] = routePlaces;
    if (!from || !to) return;

    await Linking.openURL(
      buildNaverDirectionsUrl({
        fromLat: from.lat,
        fromLng: from.lng,
        fromName: from.name,
        toLat: to.lat,
        toLng: to.lng,
        toName: to.name,
      }),
    );
    void recordEvent({ accessCodeId, eventName: "route_navigation_started" }).catch((error) => {
      if (__DEV__) console.warn("Failed to record route navigation started", error);
    });
  }

  if (step === "order") {
    return (
      <OrderScreen
        places={routePlaces}
        onBack={() => setStep("pick")}
        onConfirm={() => void confirmOrder()}
        onHome={() => navigation.navigate("Map")}
        onMove={moveRoutePlace}
        onSaved={() => navigation.navigate("Saved")}
      />
    );
  }

  if (step === "saved") {
    return (
      <SavedRouteScreen
        places={routePlaces}
        shareOpen={shareOpen}
        onHome={() => navigation.navigate("Map")}
        onShare={() => void shareRoute()}
        onShareChannel={(channel) => void shareChannel(channel)}
        onSaved={() => navigation.navigate("Saved")}
        onStart={() => void startNavigation()}
      />
    );
  }

  return (
    <PickPlacesScreen
      categories={categories}
      candidatePlaces={filteredCandidatePlaces}
      selectedCategoryId={selectedCategoryId}
      selectedPlaces={routePlaces}
      onFilterChange={setSelectedCategoryId}
      onHome={() => navigation.navigate("Map")}
      onSaved={() => navigation.navigate("Saved")}
      onContinue={openOrder}
      onTogglePlace={toggleRoutePlace}
    />
  );
}

function PickPlacesScreen({
  categories,
  candidatePlaces,
  onFilterChange,
  onHome,
  onSaved,
  selectedPlaces,
  selectedCategoryId,
  onContinue,
  onTogglePlace,
}: {
  categories: Category[];
  candidatePlaces: Place[];
  onFilterChange: (categoryId: string) => void;
  onHome: () => void;
  onSaved: () => void;
  selectedPlaces: Place[];
  selectedCategoryId: string;
  onContinue: () => void;
  onTogglePlace: (placeId: Place["id"]) => void;
}) {
  const canContinue = selectedPlaces.length >= 2;

  return (
    <DesignCanvas>
      <StatusBarReference />
      <QuickNav active="route" onHome={onHome} onRoute={() => undefined} onSaved={onSaved} />
      <TextBox style={styles.kicker}>선택한 장소로 루트 만들기</TextBox>
      <TextBox style={styles.title}>누른 순서대로 담겨요</TextBox>
      <TextBox style={styles.helper}>카드를 눌러 루트 순서를 정해요. 선택을 해제하면 뒤 번호가 자동으로 당겨집니다.</TextBox>
      <MapSurface height={300} left={24} pointCount={selectedPlaces.length} top={180} variant="pick" width={345} />
      {selectedPlaces.slice(0, 4).map((place, index) => (
        <CircleNumberPin
          active={index === 0}
          index={index + 1}
          key={place.id}
          left={pickPinPositions[index].left}
          top={pickPinPositions[index].top}
        />
      ))}
      <FilterPill active={selectedCategoryId === "all"} label="전체" left={24} width={56} onPress={() => onFilterChange("all")} />
      {categories.slice(0, 4).map((category, index) => (
        <FilterPill
          active={selectedCategoryId === category.id}
          key={category.id}
          label={category.name}
          left={88 + index * 66}
          width={58}
          onPress={() => onFilterChange(category.id)}
        />
      ))}
      <View style={styles.pickSheet}>
        <View style={styles.handle} />
        <TextBox style={styles.sheetSmallTitle}>루트에 넣을 장소</TextBox>
        <TextBox style={styles.selectedCount}>{selectedPlaces.length}개 선택됨</TextBox>
        {candidatePlaces.length === 0 ? (
          <TextBox style={styles.emptyCandidateText}>이 필터에 맞는 저장 장소가 없어요.</TextBox>
        ) : null}
        {candidatePlaces.slice(0, 4).map((place, index) => (
          <PickCard
            color={stopColors[index] ?? "#C4D5BD"}
            imageUrl={place.coverImageUrl}
            key={place.id}
            orderIndex={selectedPlaces.findIndex((selectedPlace) => selectedPlace.id === place.id) + 1}
            selected={selectedPlaces.some((selectedPlace) => selectedPlace.id === place.id)}
            title={place.name}
            subtitle={`${place.moodTags[0] ?? "장소"} · ${place.nearestStation}`}
            x={31 + (index % 2) * 171}
            y={63 + Math.floor(index / 2) * 82}
            onPress={() => onTogglePlace(place.id)}
          />
        ))}
        <TextBox style={styles.pickHint}>2곳 이상 선택하면 8번 순서 확정 화면으로 이어져요.</TextBox>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canContinue }}
          disabled={!canContinue}
          onPress={onContinue}
          style={({ pressed }) => [
            styles.pickContinueButton,
            !canContinue && styles.pickContinueButtonDisabled,
            pressed && canContinue && styles.pressed,
          ]}
        >
          <TextBox style={[styles.pickContinueText, !canContinue && styles.pickContinueTextDisabled]}>
            {canContinue ? "루트 순서 정하기" : "2곳 이상 선택"}
          </TextBox>
        </Pressable>
      </View>
      <HomeIndicator color="#090B0A" />
    </DesignCanvas>
  );
}

function OrderScreen({
  onBack,
  onConfirm,
  onHome,
  onMove,
  onSaved,
  places,
}: {
  onBack: () => void;
  onConfirm: () => void;
  onHome: () => void;
  onMove: (placeId: Place["id"], direction: -1 | 1) => void;
  onSaved: () => void;
  places: Place[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activePlace = places[activeIndex];
  const canMoveBack = activeIndex > 0;
  const canMoveForward = activeIndex < places.length - 1;

  function moveActive(direction: -1 | 1) {
    if (!activePlace) return;

    onMove(activePlace.id, direction);
    setActiveIndex((currentIndex) => currentIndex + direction);
  }

  return (
    <DesignCanvas>
      <StatusBarReference />
      <QuickNav active="route" onHome={onHome} onRoute={() => undefined} onSaved={onSaved} />
      <TextBox style={styles.kicker}>루트 순서 정하기</TextBox>
      <TextBox style={styles.title}>순서대로 연결하세요</TextBox>
      <TextBox style={styles.helper}>선택한 장소를 방문 순서대로 확인하고 확정합니다.</TextBox>
      <MapSurface height={488} left={0} pointCount={places.length} top={176} variant="order" width={393} />
      {places.slice(0, 4).map((place, index) => (
        <CircleNumberPin
          index={index + 1}
          key={place.id}
          left={orderPinPositions[index].left}
          top={orderPinPositions[index].top}
        />
      ))}
      <View style={styles.orderSheet}>
        <View style={styles.handle} />
        <TextBox style={styles.orderTitle}>순서를 확정할까요?</TextBox>
        <TextBox style={styles.orderCopy}>사진을 누르고 앞으로/뒤로 버튼으로 순서를 바꿀 수 있어요.</TextBox>
        {places.slice(0, 4).map((place, index) => (
          <StopPhoto
            key={place.id}
            color={stopColors[index] ?? "#D8BB82"}
            imageUrl={place.coverImageUrl}
            index={index + 1}
            left={23 + index * 89}
            selected={index === activeIndex}
            size={78}
            top={83}
            onPress={() => setActiveIndex(index)}
          />
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canMoveBack }}
          disabled={!canMoveBack}
          onPress={() => moveActive(-1)}
          style={({ pressed }) => [styles.orderMoveLeft, !canMoveBack && styles.orderMoveDisabled, pressed && canMoveBack && styles.pressed]}
        >
          <TextBox style={[styles.orderMoveText, !canMoveBack && styles.orderMoveTextDisabled]}>앞으로</TextBox>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canMoveForward }}
          disabled={!canMoveForward}
          onPress={() => moveActive(1)}
          style={({ pressed }) => [styles.orderMoveRight, !canMoveForward && styles.orderMoveDisabled, pressed && canMoveForward && styles.pressed]}
        >
          <TextBox style={[styles.orderMoveText, !canMoveForward && styles.orderMoveTextDisabled]}>뒤로</TextBox>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onBack} style={({ pressed }) => [styles.orderBackButton, pressed && styles.pressed]}>
          <TextBox style={styles.orderBackText}>다시 고르기</TextBox>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onConfirm} style={({ pressed }) => [styles.orderConfirm, pressed && styles.pressed]}>
          <TextBox style={styles.orderConfirmText}>이 순서로 확정</TextBox>
        </Pressable>
        <TextBox style={styles.orderBottomHint}>확정 후에도 저장함에서 다시 열 수 있어요.</TextBox>
      </View>
      <HomeIndicator color="#474A45" />
    </DesignCanvas>
  );
}

function SavedRouteScreen({
  onHome,
  places,
  shareOpen,
  onShare,
  onShareChannel,
  onSaved,
  onStart,
}: {
  onHome: () => void;
  places: Place[];
  shareOpen: boolean;
  onShare: () => void;
  onShareChannel: (channel: string) => void;
  onSaved: () => void;
  onStart: () => void;
}) {
  return (
    <DesignCanvas>
      <StatusBarReference />
      <QuickNav active="route" onHome={onHome} onRoute={() => undefined} onSaved={onSaved} />
      <TextBox style={styles.savedKicker}>루트 저장 완료</TextBox>
      <TextBox style={styles.savedTitle}>루트를{"\n"}저장했어요!</TextBox>
      <TextBox style={styles.savedHelper}>저장함에서 다시 열고 바로 길찾기를 시작할 수 있어요.</TextBox>
      <MapSurface height={300} left={24} pointCount={places.length} top={218} variant="saved" width={345} />
      {places.slice(0, 4).map((place, index) => (
        <CircleNumberPin
          index={index + 1}
          key={place.id}
          left={savedPinPositions[index].left}
          top={savedPinPositions[index].top}
        />
      ))}
      {shareOpen ? <ShareToast /> : null}
      <View style={styles.savedSheet}>
        <View style={styles.savedHandle} />
        <TextBox style={styles.savedSheetTitle}>저장된 루트</TextBox>
        <TextBox style={styles.savedSheetCopy}>{places.length}곳 · 예상 1시간 40분 · 이동 2.8km</TextBox>
        {places.slice(0, 4).map((place, index) => (
          <StopPhoto
            key={place.id}
            color={savedStopColors[index] ?? "#D4ADD6"}
            imageUrl={place.coverImageUrl}
            index={index + 1}
            left={32 + index * 86}
            size={72}
            top={104}
          />
        ))}
        {shareOpen ? <ShareTray onShareChannel={onShareChannel} /> : null}
        <Pressable accessibilityRole="button" onPress={onShare} style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}>
          <TextBox style={styles.shareButtonText}>공유하기</TextBox>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onStart} style={({ pressed }) => [styles.startButton, pressed && styles.pressed]}>
          <TextBox style={styles.startButtonText}>길찾기 시작</TextBox>
        </Pressable>
        <TextBox style={styles.savedBottomHint}>공유하면 친구도 같은 순서의 루트를 볼 수 있어요.</TextBox>
      </View>
      <HomeIndicator color="#474A45" />
    </DesignCanvas>
  );
}

function MapSurface({
  height,
  left,
  pointCount = 4,
  top,
  variant,
  width,
}: {
  height: number;
  left: number;
  pointCount?: number;
  top: number;
  variant: "pick" | "order" | "saved";
  width: number;
}) {
  const routePoints = (
    variant === "order"
      ? [
          { x: 75, y: 341 },
          { x: 149, y: 297 },
          { x: 219, y: 137 },
          { x: 303, y: 85 },
        ]
      : [
          { x: 65, y: 239 },
          { x: 135, y: 199 },
          { x: 203, y: 91 },
          { x: 277, y: 73 },
        ]
  ).slice(0, Math.max(0, Math.min(pointCount, 4)));

  return (
    <View style={[styles.mapSurface, { height, left, top, width }]}>
      <RoadLine color="#FFFFF9" from={{ x: -20, y: height * 0.22 }} to={{ x: width + 40, y: height * 0.12 }} thickness={9} />
      <RoadLine color="#FFFFF9" from={{ x: -20, y: height * 0.74 }} to={{ x: width + 40, y: height * 0.58 }} thickness={7} />
      <RoadLine color="#FFFFF9" from={{ x: width * 0.22, y: -30 }} to={{ x: width * 0.34, y: height + 40 }} thickness={8} />
      <RoadLine color="#D8CFBB" from={{ x: width * 0.58, y: -20 }} to={{ x: width * 0.47, y: height + 30 }} thickness={2} />
      <RoadLine color="#D8CFBB" from={{ x: -5, y: height * 0.43 }} to={{ x: width + 20, y: height * 0.35 }} thickness={2} />
      {variant !== "pick"
        ? routePoints.slice(1).map((point, index) => (
            <RoadLine color="#090B0A" from={routePoints[index]} key={`${point.x}-${point.y}`} to={point} thickness={4} />
          ))
        : null}
    </View>
  );
}

function RoadLine({
  color,
  from,
  thickness,
  to,
}: {
  color: string;
  from: { x: number; y: number };
  thickness: number;
  to: { x: number; y: number };
}) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  return (
    <View
      style={{
        backgroundColor: color,
        borderRadius: thickness,
        height: thickness,
        left: (from.x + to.x) / 2 - length / 2,
        position: "absolute",
        top: (from.y + to.y) / 2 - thickness / 2,
        transform: [{ rotate: `${angle}deg` }],
        width: length,
      }}
    />
  );
}

function FilterPill({
  active = false,
  label,
  left,
  onPress,
  width,
}: {
  active?: boolean;
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
        styles.filterPill,
        { backgroundColor: active ? "#090B0A" : "#FFFFF9", borderColor: active ? "#090B0A" : "#D8D2C3", left, width },
        pressed && styles.pressed,
      ]}
    >
      <TextBox style={[styles.filterText, { color: active ? "#FFFFF9" : "#090B0A", width }]}>{label}</TextBox>
    </Pressable>
  );
}

function PickCard({
  color,
  imageUrl,
  orderIndex,
  onPress,
  selected = false,
  subtitle,
  title,
  x,
  y,
}: {
  color: string;
  imageUrl: string;
  orderIndex: number;
  onPress: () => void;
  selected?: boolean;
  subtitle: string;
  title: string;
  x: number;
  y: number;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${title} 루트에 넣기`}
      onPress={onPress}
      style={({ pressed }) => [styles.pickCard, selected && styles.pickCardSelected, { left: x, top: y }, pressed && styles.pressed]}
    >
      <ImageBackground
        imageStyle={styles.pickPhotoImage}
        resizeMode="cover"
        source={{ uri: imageUrl }}
        style={[styles.pickPhoto, { backgroundColor: color }]}
      >
        <View style={styles.photoShade} />
      </ImageBackground>
      <View style={[styles.pickBadge, { backgroundColor: selected ? "#21F073" : "#FFFFF9" }]}>
        <TextBox style={styles.pickBadgeText}>{selected ? orderIndex : "+"}</TextBox>
      </View>
      <TextBox numberOfLines={1} style={styles.pickCardTitle}>{title}</TextBox>
      <TextBox numberOfLines={2} style={styles.pickCardCopy}>{subtitle}</TextBox>
    </Pressable>
  );
}

function StopPhoto({
  color,
  imageUrl,
  index,
  left,
  onPress,
  selected = false,
  size,
  top,
}: {
  color: string;
  imageUrl: string;
  index: number;
  left: number;
  onPress?: () => void;
  selected?: boolean;
  size: number;
  top: number;
}) {
  return (
    <Pressable
      accessibilityLabel={`${index}번째 장소 선택`}
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      style={[styles.stopPhoto, selected && styles.stopPhotoSelected, { backgroundColor: color, height: size, left, top, width: size }]}
    >
      <ImageBackground
        imageStyle={{ borderRadius: 18 }}
        resizeMode="cover"
        source={{ uri: imageUrl }}
        style={{ height: size, width: size }}
      >
      <View style={[styles.stopPhotoShade, { height: size / 2, top: size / 2 }]} />
      <View style={styles.stopBadge}>
        <TextBox style={styles.stopBadgeText}>{index}</TextBox>
      </View>
      </ImageBackground>
    </Pressable>
  );
}

function ShareToast() {
  return (
    <View style={styles.toast}>
      <View style={styles.toastIcon}>
        <TextBox style={styles.toastCheck}>✓</TextBox>
      </View>
      <TextBox style={styles.toastTitle}>클립보드에 저장됐어요</TextBox>
      <TextBox style={styles.toastCopy}>공유 링크를 바로 붙여넣을 수 있어요.</TextBox>
    </View>
  );
}

function ShareTray({ onShareChannel }: { onShareChannel: (channel: string) => void }) {
  return (
    <View style={styles.shareTray}>
      <ShareOption color="#FFD400" label="카카오톡" onPress={() => onShareChannel("kakao")} />
      <ShareOption color="#EF3D7A" label="인스타그램" onPress={() => onShareChannel("instagram")} />
      <ShareOption color="#3047F2" label="복사" mark="⧉" onPress={() => onShareChannel("copy")} />
    </View>
  );
}

function ShareOption({
  color,
  label,
  mark,
  onPress,
}: {
  color: string;
  label: string;
  mark?: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.shareOption, pressed && styles.pressed]}>
      <View style={[styles.shareIcon, { backgroundColor: color }]}>
        {mark ? <TextBox style={styles.shareMark}>{mark}</TextBox> : null}
      </View>
      <TextBox style={styles.shareLabel}>{label}</TextBox>
    </Pressable>
  );
}

const stopColors = ["#F5995C", "#C4D5BD", "#1F333D", "#D8BB82"];
const savedStopColors = ["#E8A857", "#9EC48C", "#8CBAC7", "#D4ADD6"];

const styles = StyleSheet.create({
  kicker: {
    color: "#5C6159",
    fontSize: 12,
    fontWeight: "700",
    left: 24,
    lineHeight: 15,
    position: "absolute",
    top: 64,
    width: 260,
  },
  title: {
    color: "#090B0A",
    fontSize: 25,
    fontWeight: "800",
    left: 24,
    lineHeight: 32,
    position: "absolute",
    top: 88,
    width: 330,
  },
  helper: {
    color: "#5C6159",
    fontSize: 12,
    fontWeight: "400",
    left: 24,
    lineHeight: 15,
    position: "absolute",
    top: 128,
    width: 330,
  },
  mapSurface: {
    backgroundColor: "#E1DED4",
    borderColor: "#D8D2C3",
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    position: "absolute",
  },
  filterPill: {
    alignItems: "center",
    borderRadius: 17,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    position: "absolute",
    top: 496,
  },
  filterText: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 15,
    textAlign: "center",
  },
  pickSheet: {
    backgroundColor: "#FFFFF9",
    borderColor: "#D8D2C3",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    height: 321,
    left: 0,
    overflow: "hidden",
    position: "absolute",
    top: 544,
    width: 393,
  },
  handle: {
    backgroundColor: "#D8D2C3",
    borderRadius: 3,
    height: 5,
    left: 168,
    position: "absolute",
    top: 11,
    width: 55,
  },
  sheetSmallTitle: {
    color: "#090B0A",
    fontSize: 15,
    fontWeight: "700",
    left: 23,
    lineHeight: 19,
    position: "absolute",
    top: 29,
    width: 210,
  },
  selectedCount: {
    color: "#052E14",
    fontSize: 11,
    fontWeight: "700",
    left: 287,
    lineHeight: 14,
    position: "absolute",
    textAlign: "right",
    top: 31,
    width: 76,
  },
  pickCard: {
    backgroundColor: "#FFFFF9",
    borderColor: "#D1D1C5",
    borderRadius: 18,
    borderWidth: 1,
    height: 74,
    overflow: "hidden",
    position: "absolute",
    width: 158,
  },
  pickCardSelected: {
    borderColor: "#21F073",
    borderWidth: 2,
  },
  pickPhoto: {
    borderBottomLeftRadius: 17,
    borderTopLeftRadius: 17,
    height: 74,
    left: 0,
    position: "absolute",
    top: 0,
    width: 64,
  },
  pickPhotoImage: {
    borderBottomLeftRadius: 17,
    borderTopLeftRadius: 17,
  },
  photoShade: {
    backgroundColor: "rgba(9,11,10,0.36)",
    borderBottomLeftRadius: 17,
    height: 74,
    left: 0,
    position: "absolute",
    top: 0,
    width: 64,
  },
  emptyCandidateText: {
    color: "#5C6159",
    fontSize: 12,
    fontWeight: "700",
    left: 31,
    lineHeight: 16,
    position: "absolute",
    textAlign: "center",
    top: 110,
    width: 331,
  },
  pickBadge: {
    alignItems: "center",
    borderRadius: 12,
    height: 24,
    justifyContent: "center",
    left: 32,
    position: "absolute",
    top: 9,
    width: 24,
  },
  pickBadgeText: {
    color: "#090B0A",
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 14,
  },
  pickCardTitle: {
    color: "#090B0A",
    fontSize: 15,
    fontWeight: "800",
    left: 74,
    lineHeight: 18,
    position: "absolute",
    top: 13,
    width: 70,
  },
  pickCardCopy: {
    color: "#5C6159",
    fontSize: 11,
    fontWeight: "400",
    left: 74,
    lineHeight: 14,
    position: "absolute",
    top: 39,
    width: 72,
  },
  pickHint: {
    color: "#5C6159",
    fontSize: 11,
    fontWeight: "400",
    left: 23,
    lineHeight: 16,
    position: "absolute",
    top: 229,
    width: 250,
  },
  pickContinueButton: {
    alignItems: "center",
    backgroundColor: "#21F073",
    borderRadius: 16,
    height: 52,
    justifyContent: "center",
    left: 23,
    position: "absolute",
    top: 249,
    width: 345,
  },
  pickContinueButtonDisabled: {
    backgroundColor: "#C8CDBF",
  },
  pickContinueText: {
    color: "#052E14",
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 18,
  },
  pickContinueTextDisabled: {
    color: "#6D7569",
  },
  pickContinueHit: {
    height: 250,
    left: 0,
    position: "absolute",
    top: 544,
    width: 393,
  },
  orderSheet: {
    backgroundColor: "#FEFEF6",
    borderColor: "#D8D2C3",
    borderRadius: 28,
    borderWidth: 1,
    height: 296,
    left: 0,
    overflow: "hidden",
    position: "absolute",
    top: 576,
    width: 393,
  },
  orderTitle: {
    color: "#090B0A",
    fontSize: 15,
    fontWeight: "700",
    left: 23,
    lineHeight: 19,
    position: "absolute",
    top: 31,
    width: 160,
  },
  orderCopy: {
    color: "#5C6159",
    fontSize: 11,
    fontWeight: "400",
    left: 23,
    lineHeight: 14,
    position: "absolute",
    top: 55,
    width: 240,
  },
  stopPhoto: {
    borderColor: "#D1D1C5",
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    position: "absolute",
  },
  stopPhotoSelected: {
    borderColor: "#21F073",
    borderWidth: 2,
  },
  stopPhotoShade: {
    backgroundColor: "rgba(9,11,10,0.28)",
    left: 0,
    position: "absolute",
    width: "100%",
  },
  stopBadge: {
    alignItems: "center",
    backgroundColor: "#21F073",
    borderRadius: 12,
    height: 24,
    justifyContent: "center",
    left: 7,
    position: "absolute",
    top: 7,
    width: 24,
  },
  stopBadgeText: {
    color: "#090A09",
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 14,
  },
  orderConfirm: {
    alignItems: "center",
    backgroundColor: "#1FE56B",
    borderRadius: 16,
    height: 52,
    justifyContent: "center",
    left: 23,
    position: "absolute",
    top: 214,
    width: 345,
  },
  orderConfirmText: {
    color: "#090A09",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 18,
  },
  orderBottomHint: {
    color: "#5C5E57",
    fontSize: 12,
    fontWeight: "400",
    left: 24,
    lineHeight: 16,
    position: "absolute",
    textAlign: "center",
    top: 274,
    width: 345,
  },
  orderMoveLeft: {
    alignItems: "center",
    backgroundColor: "#FFFFF9",
    borderColor: "#C7C4B5",
    borderRadius: 14,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    left: 23,
    position: "absolute",
    top: 171,
    width: 78,
  },
  orderMoveRight: {
    alignItems: "center",
    backgroundColor: "#FFFFF9",
    borderColor: "#C7C4B5",
    borderRadius: 14,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    left: 108,
    position: "absolute",
    top: 171,
    width: 78,
  },
  orderMoveDisabled: {
    backgroundColor: "#EEECE3",
  },
  orderMoveText: {
    color: "#090A09",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 15,
  },
  orderMoveTextDisabled: {
    color: "#8B8D85",
  },
  orderBackButton: {
    alignItems: "center",
    backgroundColor: "#FFFFF9",
    borderColor: "#C7C4B5",
    borderRadius: 14,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    left: 269,
    position: "absolute",
    top: 171,
    width: 99,
  },
  orderBackText: {
    color: "#090A09",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 15,
  },
  savedKicker: {
    color: "#5C6159",
    fontSize: 12,
    fontWeight: "700",
    left: 24,
    lineHeight: 15,
    position: "absolute",
    top: 64,
    width: 260,
  },
  savedTitle: {
    color: "#090B0A",
    fontSize: 25,
    fontWeight: "800",
    left: 24,
    lineHeight: 38,
    position: "absolute",
    top: 88,
    width: 330,
  },
  savedHelper: {
    color: "#5C6159",
    fontSize: 13,
    fontWeight: "700",
    left: 24,
    lineHeight: 20,
    position: "absolute",
    top: 166,
    width: 330,
  },
  savedSheet: {
    backgroundColor: "#FEFEF6",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: 336,
    left: 0,
    overflow: "hidden",
    position: "absolute",
    top: 536,
    width: 393,
  },
  savedHandle: {
    backgroundColor: "#C7C4B5",
    borderRadius: 3,
    height: 5,
    left: 169,
    position: "absolute",
    top: 14,
    width: 55,
  },
  savedSheetTitle: {
    color: "#090A09",
    fontSize: 21,
    fontWeight: "800",
    left: 24,
    lineHeight: 26,
    position: "absolute",
    top: 36,
    width: 180,
  },
  savedSheetCopy: {
    color: "#5C5E57",
    fontSize: 13,
    fontWeight: "400",
    left: 24,
    lineHeight: 17,
    position: "absolute",
    top: 66,
    width: 260,
  },
  shareButton: {
    alignItems: "center",
    backgroundColor: "#FEFEF6",
    borderColor: "#C7C4B5",
    borderRadius: 16,
    borderWidth: 1,
    height: 52,
    justifyContent: "center",
    left: 24,
    position: "absolute",
    top: 210,
    width: 162,
  },
  shareButtonText: {
    color: "#090A09",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 18,
  },
  startButton: {
    alignItems: "center",
    backgroundColor: "#1FE56B",
    borderRadius: 16,
    height: 52,
    justifyContent: "center",
    left: 207,
    position: "absolute",
    top: 210,
    width: 162,
  },
  startButtonText: {
    color: "#090A09",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 18,
  },
  savedBottomHint: {
    color: "#5C5E57",
    fontSize: 12,
    fontWeight: "400",
    left: 24,
    lineHeight: 16,
    position: "absolute",
    textAlign: "center",
    top: 278,
    width: 345,
  },
  toast: {
    backgroundColor: "#090A09",
    borderRadius: 22,
    height: 74,
    left: 24,
    position: "absolute",
    top: 57,
    width: 345,
    zIndex: 4,
  },
  toastIcon: {
    alignItems: "center",
    backgroundColor: "#21F073",
    borderRadius: 19,
    height: 38,
    justifyContent: "center",
    left: 18,
    position: "absolute",
    top: 18,
    width: 38,
  },
  toastCheck: {
    color: "#090A09",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 20,
  },
  toastTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    left: 70,
    lineHeight: 18,
    position: "absolute",
    top: 16,
    width: 230,
  },
  toastCopy: {
    color: "#CCD1C7",
    fontSize: 12,
    fontWeight: "400",
    left: 70,
    lineHeight: 16,
    position: "absolute",
    top: 42,
    width: 240,
  },
  shareTray: {
    backgroundColor: "#FEFEF6",
    borderColor: "#C7C4B5",
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    height: 94,
    left: 24,
    position: "absolute",
    top: 108,
    width: 345,
    zIndex: 2,
  },
  shareOption: {
    alignItems: "center",
    height: 94,
    justifyContent: "flex-start",
    paddingTop: 16,
    width: 115,
  },
  shareIcon: {
    alignItems: "center",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  shareMark: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 16,
  },
  shareLabel: {
    color: "#090A09",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 14,
    marginTop: 6,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.78,
  },
});
