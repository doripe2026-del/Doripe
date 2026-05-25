import { Pressable, StyleSheet, Text } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { colors, radius, touch } from "../theme/tokens";

type BackButtonProps = {
  onPress: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function BackButton({ onPress, accessibilityLabel = "뒤로", style }: BackButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, style]}
    >
      <Text style={styles.icon}>‹</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    minHeight: 36,
    minWidth: 36,
    width: 36,
  },
  icon: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 30,
  },
  pressed: {
    opacity: 0.72,
  },
});
