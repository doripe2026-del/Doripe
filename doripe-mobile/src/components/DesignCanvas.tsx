import type { ReactNode } from "react";
import { ImageBackground, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import type { StyleProp, TextStyle, ViewStyle } from "react-native";

export const FIGMA_WIDTH = 393;
export const FIGMA_HEIGHT = 852;

type DesignCanvasProps = {
  children: ReactNode;
  backgroundColor?: string;
};

export function DesignCanvas({ children, backgroundColor = "#F6F4EC" }: DesignCanvasProps) {
  const { height, width } = useWindowDimensions();
  const scale = Math.min(width / FIGMA_WIDTH, height / FIGMA_HEIGHT);
  const scaledWidth = FIGMA_WIDTH * scale;
  const scaledHeight = FIGMA_HEIGHT * scale;

  return (
    <View style={styles.viewport}>
      <View style={[styles.scaledCanvasFrame, { height: scaledHeight, width: scaledWidth }]}>
        <View
          style={[
            styles.canvas,
            {
              backgroundColor,
              left: (scaledWidth - FIGMA_WIDTH) / 2,
              top: (scaledHeight - FIGMA_HEIGHT) / 2,
              transform: [{ scale }],
            },
          ]}
        >
          {children}
        </View>
      </View>
    </View>
  );
}

type AbsoluteProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Absolute({ children, style }: AbsoluteProps) {
  return <View style={[styles.absolute, style]}>{children}</View>;
}

type TextBoxProps = {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
};

export function TextBox({ children, numberOfLines, style }: TextBoxProps) {
  return (
    <Text allowFontScaling={false} numberOfLines={numberOfLines} style={[styles.text, style]}>
      {children}
    </Text>
  );
}

export function StatusBarReference(_props?: { subtle?: boolean }) {
  return null;
}

export function HomeIndicator(_props?: { color?: string; height?: number }) {
  return null;
}

type QuickNavTarget = "home" | "saved" | "route";

export function QuickNav({
  active,
  onHome,
  onRoute,
  onSaved,
}: {
  active?: QuickNavTarget;
  onHome: () => void;
  onRoute: () => void;
  onSaved: () => void;
}) {
  return (
    <View style={styles.quickNav}>
      <QuickNavButton
        accessibilityLabel="홈으로 이동"
        active={active === "home"}
        label="홈"
        onPress={onHome}
      />
      <QuickNavButton
        accessibilityLabel="저장함으로 이동"
        active={active === "saved"}
        label="저장"
        onPress={onSaved}
      />
      <QuickNavButton
        accessibilityLabel="루트로 이동"
        active={active === "route"}
        label="길"
        onPress={onRoute}
      />
    </View>
  );
}

function QuickNavButton({
  accessibilityLabel,
  active,
  label,
  onPress,
}: {
  accessibilityLabel: string;
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickNavButton,
        active && styles.quickNavButtonActive,
        pressed && styles.quickNavButtonPressed,
      ]}
    >
      <TextBox style={[styles.quickNavText, active && styles.quickNavTextActive]}>{label}</TextBox>
    </Pressable>
  );
}

export function BackCircle({ onPress }: { onPress: () => void }) {
  return (
    <View style={{ left: 24, position: "absolute", top: 56, zIndex: 20 }}>
      <View
        style={{
          backgroundColor: "rgba(9,11,10,0.08)",
          borderRadius: 999,
          height: 36,
          width: 36,
        }}
      />
      <TextBox
        style={{
          color: "#090B0A",
          fontSize: 25,
          fontWeight: "500",
          left: 13,
          lineHeight: 28,
          position: "absolute",
          top: 3,
          width: 12,
        }}
      >
        ‹
      </TextBox>
      <View
        accessibilityRole="button"
        onStartShouldSetResponder={() => true}
        onResponderRelease={onPress}
        style={{ height: 44, left: -4, position: "absolute", top: -4, width: 44 }}
      />
    </View>
  );
}

export function CircleNumberPin({
  active = true,
  index,
  left,
  top,
}: {
  active?: boolean;
  index: number;
  left: number;
  top: number;
}) {
  return (
    <Absolute style={{ height: 34, left, top, width: 34 }}>
      <View
        style={{
          alignItems: "center",
          backgroundColor: active ? "#21F073" : "#FFFFF9",
          borderColor: "#090B0A",
          borderRadius: 17,
          borderWidth: 1.5,
          height: 34,
          justifyContent: "center",
          width: 34,
        }}
      >
        <TextBox
          style={{
            color: "#090B0A",
            fontSize: 12,
            fontWeight: "800",
            lineHeight: 15,
            textAlign: "center",
          }}
        >
          {index}
        </TextBox>
      </View>
    </Absolute>
  );
}

export function PlacePin({ left, label, onPress, top }: { left: number; label: string; onPress: () => void; top: number }) {
  return (
    <View style={{ height: 88, left, position: "absolute", top, width: 96 }}>
      <View
        onStartShouldSetResponder={() => true}
        onResponderRelease={onPress}
        style={{ height: 88, width: 96 }}
      >
        <View style={styles.mapPinTail} />
        <View style={styles.mapPinHead}>
          <View style={styles.mapPinCenter} />
        </View>
        <View style={styles.mapPinLabel}>
          <TextBox numberOfLines={1} style={styles.mapPinText}>
            {label}
          </TextBox>
        </View>
      </View>
    </View>
  );
}

export function PhotoPanel({
  borderColor,
  children,
  color,
  height,
  imageUrl,
  left,
  radius = 14,
  top,
  width,
}: {
  borderColor?: string;
  children?: ReactNode;
  color: string;
  height: number;
  imageUrl?: string;
  left: number;
  radius?: number;
  top: number;
  width: number;
}) {
  const panelStyle = {
    backgroundColor: color,
    borderColor,
    borderRadius: radius,
    borderWidth: borderColor ? 2 : 0,
    height,
    left,
    overflow: "hidden" as const,
    position: "absolute" as const,
    top,
    width,
  };

  const content = (
    <>
      <View
        style={{
          backgroundColor: "rgba(9,11,10,0.5)",
          bottom: 0,
          height: Math.max(40, height * 0.44),
          left: 0,
          position: "absolute",
          right: 0,
        }}
      />
      {children}
    </>
  );

  if (imageUrl) {
    return (
      <ImageBackground imageStyle={{ borderRadius: radius }} resizeMode="cover" source={{ uri: imageUrl }} style={panelStyle}>
        {content}
      </ImageBackground>
    );
  }

  return <View style={panelStyle}>{content}</View>;
}

const styles = StyleSheet.create({
  viewport: {
    alignItems: "center",
    backgroundColor: Platform.OS === "web" ? "#E7E4DA" : "#F6F4EC",
    flex: 1,
    justifyContent: Platform.OS === "web" ? "center" : "flex-start",
  },
  canvas: {
    height: FIGMA_HEIGHT,
    overflow: "hidden",
    position: "absolute",
    width: FIGMA_WIDTH,
  },
  scaledCanvasFrame: {
    overflow: "hidden",
    position: "relative",
  },
  absolute: {
    position: "absolute",
  },
  text: {
    includeFontPadding: false,
  },
  quickNav: {
    backgroundColor: "rgba(255,255,249,0.88)",
    borderColor: "rgba(9,11,10,0.1)",
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    height: 44,
    justifyContent: "center",
    padding: 4,
    position: "absolute",
    right: 18,
    top: 50,
    width: 134,
    zIndex: 20,
  },
  quickNavButton: {
    alignItems: "center",
    borderRadius: 18,
    height: 34,
    justifyContent: "center",
    width: 39,
  },
  quickNavButtonActive: {
    backgroundColor: "#090B0A",
  },
  quickNavButtonPressed: {
    opacity: 0.72,
  },
  quickNavText: {
    color: "#090B0A",
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 12,
    textAlign: "center",
  },
  quickNavTextActive: {
    color: "#FFFFF9",
  },
  signalBar: {
    borderRadius: 1,
    position: "absolute",
    width: 3,
  },
  mapPinHead: {
    alignItems: "center",
    backgroundColor: "#21F073",
    borderColor: "#090B0A",
    borderRadius: 11,
    borderWidth: 2,
    height: 22,
    justifyContent: "center",
    left: 37,
    position: "absolute",
    top: 25,
    width: 22,
    zIndex: 2,
  },
  mapPinTail: {
    backgroundColor: "#21F073",
    borderBottomColor: "#090B0A",
    borderBottomWidth: 2,
    borderRightColor: "#090B0A",
    borderRightWidth: 2,
    height: 16,
    left: 40,
    position: "absolute",
    top: 39,
    transform: [{ rotate: "45deg" }],
    width: 16,
    zIndex: 1,
  },
  mapPinCenter: {
    backgroundColor: "#052E14",
    borderRadius: 5,
    height: 9,
    width: 9,
  },
  mapPinLabel: {
    alignItems: "center",
    backgroundColor: "#FFFFF9",
    borderColor: "#D1D1C5",
    borderRadius: 12,
    borderWidth: 1,
    height: 24,
    justifyContent: "center",
    left: 1,
    position: "absolute",
    top: 62,
    width: 94,
  },
  mapPinText: {
    color: "#090B0A",
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 11,
    textAlign: "center",
    width: 82,
  },
});
