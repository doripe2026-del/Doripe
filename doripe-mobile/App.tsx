import { StatusBar } from "expo-status-bar";
import { Platform, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { ContentProvider } from "./src/services/contentContext";

export default function App() {
  return (
    <View style={styles.root}>
      <View style={Platform.OS === "web" ? styles.webFrame : styles.nativeFrame}>
        <SafeAreaProvider>
          <StatusBar hidden style="dark" />
          <ContentProvider>
            <AppNavigator />
          </ContentProvider>
        </SafeAreaProvider>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: Platform.OS === "web" ? "center" : "stretch",
    backgroundColor: Platform.OS === "web" ? "#E7E4DA" : "#F6F4EC",
    flex: 1,
    justifyContent: Platform.OS === "web" ? "center" : "flex-start",
  },
  webFrame: {
    height: 852,
    overflow: "hidden",
    width: 393,
  },
  nativeFrame: {
    flex: 1,
  },
});
