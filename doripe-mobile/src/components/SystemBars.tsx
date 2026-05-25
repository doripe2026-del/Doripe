import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/tokens";

export function StatusBarReference() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.statusBar}>
      <Text style={styles.time}>9:41</Text>
      <View style={styles.island} />
      <View style={styles.statusIcons}>
        <View style={styles.signal}>
          <View style={[styles.signalBar, styles.signalOne]} />
          <View style={[styles.signalBar, styles.signalTwo]} />
          <View style={[styles.signalBar, styles.signalThree]} />
        </View>
        <View style={styles.batteryWrap}>
          <View style={styles.battery}>
            <View style={styles.batteryFill} />
          </View>
          <View style={styles.batteryCap} />
        </View>
      </View>
    </View>
  );
}

export function HomeIndicator() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.homeWrap}>
      <View style={styles.homeIndicator} />
    </View>
  );
}

const styles = StyleSheet.create({
  statusBar: {
    height: 44,
    position: "relative",
    width: "100%",
  },
  time: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
    left: 28,
    lineHeight: 16,
    position: "absolute",
    top: 17,
  },
  island: {
    alignSelf: "center",
    backgroundColor: "#C9C7C0",
    borderRadius: 11,
    height: 22,
    position: "absolute",
    top: 12,
    width: 61,
  },
  statusIcons: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    position: "absolute",
    right: 12,
    top: 18,
  },
  signal: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 3,
    height: 12,
  },
  signalBar: {
    backgroundColor: colors.ink,
    borderRadius: 2,
    width: 3,
  },
  signalOne: {
    height: 5,
  },
  signalTwo: {
    height: 8,
  },
  signalThree: {
    height: 11,
  },
  batteryWrap: {
    alignItems: "center",
    flexDirection: "row",
  },
  battery: {
    alignItems: "flex-start",
    backgroundColor: "transparent",
    borderColor: "#6E706A",
    borderRadius: 4,
    borderWidth: 1,
    height: 11,
    justifyContent: "center",
    paddingHorizontal: 2,
    width: 24,
  },
  batteryFill: {
    backgroundColor: "#51534E",
    borderRadius: 2,
    height: 5,
    width: 14,
  },
  batteryCap: {
    backgroundColor: "#6E706A",
    borderBottomRightRadius: 2,
    borderTopRightRadius: 2,
    height: 5,
    width: 2,
  },
  homeWrap: {
    alignItems: "center",
    height: 20,
    justifyContent: "flex-start",
    paddingTop: 12,
  },
  homeIndicator: {
    backgroundColor: "#73756D",
    borderRadius: 3,
    height: 5,
    width: 135,
  },
});
