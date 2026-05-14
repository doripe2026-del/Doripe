import { useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { AccessCodeScreen } from "../screens/AccessCodeScreen";
import { DiscoverScreen } from "../screens/DiscoverScreen";
import { RouteScreen } from "../screens/RouteScreen";
import { SavedScreen } from "../screens/SavedScreen";
import { colors, spacing, typography } from "../theme/tokens";

type TabParamList = {
  Discover: undefined;
  Saved: undefined;
  Route: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

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
        <Tab.Screen name="Discover" options={{ title: "발견" }}>
          {() => <DiscoverScreen accessCodeId={accessCodeId} />}
        </Tab.Screen>
        <Tab.Screen name="Saved" options={{ title: "저장함" }}>
          {() => <SavedScreen accessCodeId={accessCodeId} />}
        </Tab.Screen>
        <Tab.Screen name="Route" options={{ title: "루트" }}>
          {() => <RouteScreen accessCodeId={accessCodeId} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}
