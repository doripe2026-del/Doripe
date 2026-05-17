import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../theme/tokens";
import { PrimaryButton } from "./PrimaryButton";

type StateMessageProps = {
  title: string;
  copy: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function StateMessage({ title, copy, actionLabel, onAction }: StateMessageProps) {
  return (
    <View style={styles.container}>
      <View style={styles.copyBlock}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.copy}>{copy}</Text>
      </View>

      {actionLabel && onAction ? <PrimaryButton label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "stretch",
    gap: spacing.lg,
    justifyContent: "center",
    paddingVertical: spacing.xl,
  },
  copy: {
    color: colors.muted,
    fontSize: typography.body,
    fontWeight: "700",
    lineHeight: 24,
    textAlign: "center",
  },
  copyBlock: {
    gap: spacing.sm,
  },
  title: {
    color: colors.ink,
    fontSize: typography.headline,
    fontWeight: "900",
    lineHeight: 36,
    textAlign: "center",
  },
});
