import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StyleSheet, View } from "react-native";
import { DesignCanvas, HomeIndicator, PlacePin, QuickNav, StatusBarReference, TextBox } from "../components/DesignCanvas";
import type { Region } from "../domain/types";
import type { MapStackParamList } from "../navigation/AppNavigator";
import { useContent } from "../services/contentContext";
import { recordEvent } from "../services/events";

type MapScreenProps = NativeStackScreenProps<MapStackParamList, "MapHome"> & {
  accessCodeId: string;
};

export function MapScreen({ accessCodeId, navigation }: MapScreenProps) {
  const { regions } = useContent();

  async function handleRegionPress(regionId: Region["id"]) {
    void recordEvent({ accessCodeId, eventName: "region_selected" }).catch((error) => {
      if (__DEV__) console.warn("Failed to record region selection", error);
    });
    navigation.navigate("DeckGallery", { regionId });
  }

  const seongsu = regions.find((region) => region.id === "seongsu")?.id ?? "seongsu";
  const yongsan = regions.find((region) => region.id === "yongsan_hbc")?.id ?? "yongsan_hbc";
  const yeonnam = regions.find((region) => region.id === "yeonnam_mangwon")?.id ?? "yeonnam_mangwon";

  return (
    <DesignCanvas>
      <StatusBarReference />
      <TextBox style={styles.title}>오늘은 어느 동네로{"\n"}가볼까요?</TextBox>
      <TextBox style={styles.copy}>서울 지도에서 지금 열려 있는 동네를 선택해요.</TextBox>
      <View style={styles.mapCard}>
        <View style={styles.river} />
      </View>
      <PlacePin label="연남·망원" left={48} top={312} onPress={() => void handleRegionPress(yeonnam)} />
      <PlacePin label="성수" left={215} top={273} onPress={() => void handleRegionPress(seongsu)} />
      <PlacePin label="용산·해방촌" left={148} top={398} onPress={() => void handleRegionPress(yongsan)} />
      <TextBox style={styles.note}>핀을 누르면 그 동네의 덱을 고를 수 있어요.</TextBox>
      <QuickNav
        active="home"
        onHome={() => navigation.navigate("MapHome")}
        onRoute={() => navigation.getParent()?.navigate("Route")}
        onSaved={() => navigation.getParent()?.navigate("Saved")}
      />
      <HomeIndicator />
    </DesignCanvas>
  );
}

const styles = StyleSheet.create({
  title: {
    color: "#090B0A",
    fontSize: 27,
    fontWeight: "800",
    left: 28,
    lineHeight: 33,
    position: "absolute",
    top: 82,
    width: 310,
  },
  copy: {
    color: "#5C6159",
    fontSize: 13,
    fontWeight: "500",
    left: 28,
    lineHeight: 18,
    position: "absolute",
    top: 158,
    width: 320,
  },
  mapCard: {
    backgroundColor: "#E5EBDB",
    borderRadius: 18,
    height: 438,
    left: 28,
    overflow: "hidden",
    position: "absolute",
    top: 206,
    width: 337,
  },
  river: {
    backgroundColor: "rgba(163,199,184,0.8)",
    height: 44,
    left: 0,
    position: "absolute",
    top: 249,
    width: 337,
  },
  note: {
    color: "#5C6159",
    fontSize: 13,
    fontWeight: "500",
    left: 28,
    lineHeight: 18,
    position: "absolute",
    textAlign: "center",
    top: 684,
    width: 337,
  },
});
