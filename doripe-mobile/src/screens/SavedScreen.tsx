import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "../theme/tokens";

type SavedScreenProps = {
  accessCodeId: string;
};

export function SavedScreen({ accessCodeId }: SavedScreenProps) {
  return (
    <View style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.kicker}>SAVED</Text>
        <Text style={styles.title}>저장함</Text>
        <Text style={styles.copy}>저장한 장소가 여기에 쌓입니다.</Text>
        <Text style={styles.debug}>{accessCodeId}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
  },
  content: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  kicker: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  title: {
    color: colors.ink,
    fontSize: typography.headline,
    fontWeight: "900",
  },
  copy: {
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: 24,
  },
  debug: {
    color: "#5F6C5F",
    fontSize: typography.caption,
    marginTop: spacing.md,
  },
});
