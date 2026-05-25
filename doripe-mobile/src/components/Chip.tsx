import { StyleSheet, Text, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { colors, radius, spacing, typography } from "../theme/tokens";

type ChipProps = {
  label: string;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Chip({ label, active = false, style }: ChipProps) {
  return (
    <View style={[styles.chip, active ? styles.activeChip : styles.inactiveChip, style]}>
      <Text numberOfLines={1} style={[styles.label, active ? styles.activeLabel : styles.inactiveLabel]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: "center",
    borderRadius: radius.pill,
    justifyContent: "center",
    minHeight: 30,
    paddingHorizontal: spacing.md,
  },
  activeChip: {
    backgroundColor: colors.ink,
  },
  inactiveChip: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
  },
  label: {
    fontSize: typography.caption,
    fontWeight: "800",
    lineHeight: 14,
  },
  activeLabel: {
    color: colors.white,
  },
  inactiveLabel: {
    color: colors.ink,
  },
});
