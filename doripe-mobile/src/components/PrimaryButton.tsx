import { Pressable, StyleSheet, Text } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { colors, spacing, touch, typography } from "../theme/tokens";

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({ label, onPress, disabled = false, style }: PrimaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Text style={[styles.label, disabled && styles.disabledLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 18,
    justifyContent: "center",
    minHeight: touch.minimum + spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  disabled: {
    backgroundColor: colors.surfaceElevated,
  },
  disabledLabel: {
    color: colors.muted,
  },
  label: {
    color: colors.primaryInk,
    fontSize: typography.body,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.72,
  },
});
