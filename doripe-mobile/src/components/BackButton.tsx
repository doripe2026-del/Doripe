import { Pressable, StyleSheet, Text } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { colors, radius, touch, typography } from "../theme/tokens";

type BackButtonProps = {
  onPress: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function BackButton({ onPress, accessibilityLabel = "뒤로", style }: BackButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
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
    backgroundColor: "rgba(9, 11, 10, 0.08)",
    borderRadius: radius.pill,
    height: touch.minimum,
    justifyContent: "center",
    minHeight: touch.minimum,
    minWidth: touch.minimum,
    width: touch.minimum,
  },
  icon: {
    color: colors.ink,
    fontSize: typography.headline,
    fontWeight: "800",
    lineHeight: typography.headline,
  },
  pressed: {
    opacity: 0.72,
  },
});
