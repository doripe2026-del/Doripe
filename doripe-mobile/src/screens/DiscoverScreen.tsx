import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "../theme/tokens";

type DiscoverScreenProps = {
  accessCodeId: string;
};

export function DiscoverScreen({ accessCodeId }: DiscoverScreenProps) {
  return (
    <View style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.kicker}>DORIPE</Text>
        <Text style={styles.title}>발견</Text>
        <Text style={styles.copy}>장소 카드를 넘기며 취향을 모아요.</Text>
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
