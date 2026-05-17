import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.screen,
        horizontalPadding && styles.horizontalPadding,
        {
          paddingBottom: insets.bottom,
          paddingTop: insets.top + (topPadding ? spacing.lg : 0),
        },
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
});
