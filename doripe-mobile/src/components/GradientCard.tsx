import type { ReactNode } from "react";
import { ImageBackground, StyleSheet, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { radius, spacing } from "../theme/tokens";

type GradientTone = "sunset" | "lane" | "night" | "lookout";

type GradientCardProps = {
  children: ReactNode;
  imageUrl?: string;
  tone?: GradientTone;
  style?: StyleProp<ViewStyle>;
};

const toneColors: Record<GradientTone, string> = {
  sunset: "#D9875C",
  lane: "#B8C9B2",
  night: "#2A3541",
  lookout: "#C6A06E",
};

export function GradientCard({ children, imageUrl, tone = "sunset", style }: GradientCardProps) {
  const cardStyle = [styles.card, { backgroundColor: toneColors[tone] }, style];

  if (imageUrl) {
    return (
      <ImageBackground
        source={{ uri: imageUrl }}
        resizeMode="cover"
        style={cardStyle}
        imageStyle={styles.imageRadius}
      >
        <View style={styles.scrim} />
        <View style={styles.content}>{children}</View>
      </ImageBackground>
    );
  }

  return (
    <View style={cardStyle}>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    minHeight: 148,
    overflow: "hidden",
  },
  content: {
    flex: 1,
    justifyContent: "flex-end",
    padding: spacing.lg,
  },
  imageRadius: {
    borderRadius: radius.md,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.28)",
  },
});
