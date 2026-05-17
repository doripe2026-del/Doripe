import { useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AccessCodeScreen } from "../screens/AccessCodeScreen";
import { DeckGalleryScreen } from "../screens/DeckGalleryScreen";
import { DiscoverScreen } from "../screens/DiscoverScreen";
import { MapScreen } from "../screens/MapScreen";
import { PlaceGalleryScreen } from "../screens/PlaceGalleryScreen";
import { RouteScreen } from "../screens/RouteScreen";
import { SavedScreen } from "../screens/SavedScreen";
import type { Deck, Region } from "../domain/types";
import { colors, spacing, typography } from "../theme/tokens";

export type MapStackParamList = {
  MapHome: undefined;
  DeckGallery: { regionId: Region["id"] };
  Discover: { regionId: Region["id"]; deckId: Deck["id"] };
  PlaceGallery: { regionId: Region["id"]; deckId: Deck["id"] };
};

export type TabParamList = {
  Map: undefined;
  Saved: undefined;
  Route: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();
const MapStack = createNativeStackNavigator<MapStackParamList>();

type MapStackScreenProps = {
  accessCodeId: string;
};

function MapStackNavigator({ accessCodeId }: MapStackScreenProps) {
  return (
    <MapStack.Navigator screenOptions={{ headerShown: false }}>
      <MapStack.Screen name="MapHome">
        {(props) => <MapScreen {...props} accessCodeId={accessCodeId} />}
      </MapStack.Screen>
      <MapStack.Screen name="DeckGallery">
        {(props) => <DeckGalleryScreen {...props} accessCodeId={accessCodeId} />}
      </MapStack.Screen>
      <MapStack.Screen name="Discover">
        {(props) => <DiscoverScreen {...props} accessCodeId={accessCodeId} />}
      </MapStack.Screen>
      <MapStack.Screen name="PlaceGallery">
        {(props) => <PlaceGalleryScreen {...props} accessCodeId={accessCodeId} />}
      </MapStack.Screen>
    </MapStack.Navigator>
  );
}

export function AppNavigator() {
  const [accessCodeId, setAccessCodeId] = useState<string | null>(null);

  if (!accessCodeId) {
    return <AccessCodeScreen onAccepted={setAccessCodeId} />;
  }

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.muted,
          tabBarLabelStyle: {
            fontSize: typography.caption,
            fontWeight: "800",
          },
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.line,
            borderTopWidth: 1,
            minHeight: 72,
            paddingBottom: spacing.md,
            paddingTop: spacing.sm,
          },
        }}
      >
        <Tab.Screen name="Map" options={{ title: "지도" }}>
          {() => <MapStackNavigator accessCodeId={accessCodeId} />}
        </Tab.Screen>
        <Tab.Screen name="Saved" options={{ title: "저장함" }}>
          {() => <SavedScreen accessCodeId={accessCodeId} />}
        </Tab.Screen>
        <Tab.Screen name="Route" options={{ title: "방문 순서" }}>
          {() => <RouteScreen accessCodeId={accessCodeId} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}
