import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppScaffold } from "../components/AppScaffold";
import { Chip } from "../components/Chip";
import { regions } from "../domain/fixtures";
import type { Region } from "../domain/types";
import type { MapStackParamList } from "../navigation/AppNavigator";
import { recordEvent } from "../services/events";
import { colors, radius, spacing, touch, typography } from "../theme/tokens";

type MapScreenProps = NativeStackScreenProps<MapStackParamList, "MapHome"> & {
  accessCodeId: string;
};

const mapBaseWidth = 320;
const mapBaseHeight = 520;

export function MapScreen({ accessCodeId, navigation }: MapScreenProps) {
  const { width } = useWindowDimensions();
  const [selectedRegionId, setSelectedRegionId] = useState<Region["id"] | null>(null);
  const activeRegions = useMemo(
    () =>
      regions
        .filter((region) => region.status === "active")
        .sort((left, right) => left.displayOrder - right.displayOrder),
    [],
  );
  const mapWidth = Math.min(width - spacing.lg * 2, mapBaseWidth);
  const mapHeight = (mapWidth / mapBaseWidth) * mapBaseHeight;

  async function handleRegionPress(region: Region) {
    setSelectedRegionId(region.id);

    try {
      await recordEvent({
        accessCodeId,
        eventName: "region_selected",
      });
    } catch (error) {
      if (__DEV__) {
        console.warn("Failed to record region selection", error);
      }
    }

    navigation.navigate("DeckGallery", { regionId: region.id });
  }

  return (
    <AppScaffold>
      <View style={styles.header}>
        <Text style={styles.kicker}>MAP</Text>
        <Text style={styles.title}>오늘은 어느 동네로{"\n"}가볼까요?</Text>
        <Text style={styles.copy}>서울 지도에서 지금 열려 있는 동네를 선택해요.</Text>
      </View>

      <View style={styles.mapWrap}>
        <View style={[styles.mapSurface, { height: mapHeight, width: mapWidth }]}>
          <View style={styles.riverLine} />
          <View style={styles.cityCore} />
          <View style={styles.greenPatch} />

          {activeRegions.map((region) => {
            const isSelected = selectedRegionId === region.id;

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${region.name} 선택`}
                key={region.id}
                onPress={() => void handleRegionPress(region)}
                style={({ pressed }) => [
                  styles.pin,
                  {
                    left: `${(region.mapPin.x / mapBaseWidth) * 100}%`,
                    top: `${(region.mapPin.y / mapBaseHeight) * 100}%`,
                  },
                  isSelected && styles.selectedPin,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.pinDot} />
                <Text style={styles.pinLabel}>{region.shortName}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.regionChips}>
        {activeRegions.map((region) => (
          <Chip key={region.id} label={region.shortName} active={selectedRegionId === region.id} />
        ))}
      </View>
    </AppScaffold>
  );
}

const styles = StyleSheet.create({
  cityCore: {
    backgroundColor: "rgba(255, 255, 249, 0.74)",
    borderColor: "rgba(209, 209, 197, 0.7)",
    borderRadius: radius.lg,
    borderWidth: 1,
    height: "34%",
    left: "24%",
    position: "absolute",
    top: "31%",
    transform: [{ rotate: "-12deg" }],
    width: "48%",
  },
  copy: {
    color: colors.muted,
    fontSize: typography.body,
    fontWeight: "700",
    lineHeight: 24,
  },
  greenPatch: {
    backgroundColor: "rgba(33, 240, 115, 0.18)",
    borderRadius: radius.lg,
    bottom: "10%",
    height: "22%",
    position: "absolute",
    right: "10%",
    width: "30%",
  },
  header: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  kicker: {
    color: colors.primaryDark,
    fontSize: typography.caption,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  mapSurface: {
    backgroundColor: "#E8E6DA",
    borderColor: colors.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  mapWrap: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 420,
  },
  pin: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: touch.minimum,
    minWidth: 76,
    paddingHorizontal: spacing.md,
    position: "absolute",
    transform: [{ translateX: -38 }, { translateY: -22 }],
  },
  pinDot: {
    backgroundColor: colors.primaryDark,
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  pinLabel: {
    color: colors.ink,
    fontSize: typography.caption,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.72,
  },
  regionChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingTop: spacing.lg,
  },
  riverLine: {
    backgroundColor: "rgba(116, 168, 194, 0.34)",
    height: 28,
    left: "-12%",
    position: "absolute",
    top: "55%",
    transform: [{ rotate: "-16deg" }],
    width: "126%",
  },
  selectedPin: {
    backgroundColor: colors.primary,
  },
  title: {
    color: colors.ink,
    fontSize: typography.title,
    fontWeight: "900",
    lineHeight: 48,
  },
});
