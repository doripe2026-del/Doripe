import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { colors, spacing } from "../theme/tokens";

type AppScaffoldProps = {
  children: ReactNode;
  horizontalPadding?: boolean;
  topPadding?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function AppScaffold({
  children,
  horizontalPadding = true,
  topPadding = true,
  style,
}: AppScaffoldProps) {
  return (
    <View
      style={[
        styles.screen,
        horizontalPadding && styles.horizontalPadding,
        topPadding && styles.topPadding,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  horizontalPadding: {
    paddingHorizontal: spacing.lg,
  },
  topPadding: {
    paddingTop: spacing.xxl,
  },
});
