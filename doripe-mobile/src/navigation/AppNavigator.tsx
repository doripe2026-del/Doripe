import { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import type { NavigatorScreenParams } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { DesignCanvas, TextBox } from "../components/DesignCanvas";
import { AccessCodeScreen } from "../screens/AccessCodeScreen";
import { DeckGalleryScreen } from "../screens/DeckGalleryScreen";
import { DiscoverScreen } from "../screens/DiscoverScreen";
import { MapScreen } from "../screens/MapScreen";
import { PlaceGalleryScreen } from "../screens/PlaceGalleryScreen";
import { RouteScreen } from "../screens/RouteScreen";
import { SavedScreen } from "../screens/SavedScreen";
import type { Deck, Region } from "../domain/types";
import { getStoredAuthSession } from "../services/auth";

export type MapStackParamList = {
  MapHome: undefined;
  DeckGallery: { regionId: Region["id"] };
  Discover: { regionId: Region["id"]; deckId: Deck["id"] };
  PlaceGallery: { regionId: Region["id"]; deckId: Deck["id"] };
};

export type TabParamList = {
  Map: NavigatorScreenParams<MapStackParamList> | undefined;
  Saved: undefined;
  Route: { selectedAt?: string } | undefined;
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

function AppLoadingScreen() {
  return (
    <DesignCanvas>
      <TextBox
        style={{
          color: "#090B0A",
          fontSize: 20,
          fontWeight: "800",
          left: 24,
          lineHeight: 26,
          position: "absolute",
          textAlign: "center",
          top: 390,
          width: 345,
        }}
      >
        Doripe 준비 중...
      </TextBox>
    </DesignCanvas>
  );
}

export function AppNavigator() {
  const [accessCodeId, setAccessCodeId] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    let isMounted = true;

    getStoredAuthSession()
      .then((session) => {
        if (isMounted) {
          setAccessCodeId(session?.accessCodeId ?? null);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsCheckingAuth(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (isCheckingAuth) {
    return <AppLoadingScreen />;
  }

  if (!accessCodeId) {
    return <AccessCodeScreen onAccepted={setAccessCodeId} />;
  }

  return (
    <NavigationContainer>
      <Tab.Navigator tabBar={() => null} screenOptions={{ headerShown: false }}>
        <Tab.Screen name="Map" options={{ title: "지도" }}>
          {() => <MapStackNavigator accessCodeId={accessCodeId} />}
        </Tab.Screen>
        <Tab.Screen name="Saved" options={{ title: "저장함" }}>
          {() => <SavedScreen accessCodeId={accessCodeId} />}
        </Tab.Screen>
        <Tab.Screen name="Route" options={{ title: "루트" }}>
          {(props) => <RouteScreen {...props} accessCodeId={accessCodeId} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}
