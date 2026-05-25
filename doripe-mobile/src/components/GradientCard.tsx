import type { ReactNode } from "react";
import { ImageBackground, StyleSheet, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { colors, gradients, radius, spacing } from "../theme/tokens";

type GradientTone = keyof typeof gradients;

type GradientCardProps = {
  children: ReactNode;
  imageUrl?: string;
  tone?: GradientTone;
  style?: StyleProp<ViewStyle>;
};

export function GradientCard({ children, imageUrl, tone = "sunset", style }: GradientCardProps) {
  const cardStyle = [styles.card, { backgroundColor: gradients[tone][1] }, style];

  if (imageUrl) {
    return (
      <ImageBackground
        imageStyle={styles.imageRadius}
        resizeMode="cover"
        source={{ uri: imageUrl }}
        style={cardStyle}
      >
        <View style={styles.scrim} />
        <View style={styles.content}>{children}</View>
      </ImageBackground>
    );
  }

  return (
    <View style={cardStyle}>
      <View style={[styles.colorWash, { backgroundColor: gradients[tone][0] }]} />
      <View style={styles.scrim} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    minHeight: 150,
    overflow: "hidden",
  },
  colorWash: {
    bottom: 0,
    left: 0,
    opacity: 0.46,
    position: "absolute",
    right: 0,
    top: 0,
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
    padding: 18,
  },
  imageRadius: {
    borderRadius: radius.lg,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5, 6, 5, 0.36)",
  },
});
