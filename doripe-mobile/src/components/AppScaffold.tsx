import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { colors, spacing } from "../theme/tokens";
import { HomeIndicator, StatusBarReference } from "./SystemBars";

type AppScaffoldProps = {
  children: ReactNode;
  horizontalPadding?: boolean;
  showHomeIndicator?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

export function AppScaffold({
  children,
  horizontalPadding = true,
  showHomeIndicator = false,
  style,
  contentStyle,
}: AppScaffoldProps) {
  return (
    <View style={[styles.screen, style]}>
      <StatusBarReference />
      <View style={[styles.content, horizontalPadding && styles.horizontalPadding, contentStyle]}>
        {children}
      </View>
      {showHomeIndicator ? <HomeIndicator /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    flex: 1,
  },
  horizontalPadding: {
    paddingHorizontal: spacing.lg,
  },
});
