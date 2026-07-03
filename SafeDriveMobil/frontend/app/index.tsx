import { Redirect } from "expo-router";
import { ActivityIndicator, View, Text, StyleSheet } from "react-native";
import { useAuth } from "@/src/context/AuthContext";
import { colors, MONO } from "@/src/theme";

export default function Index() {
  const { ready, token, user } = useAuth();

  if (!ready) {
    return (
      <View style={styles.container} testID="boot-loading">
        <ActivityIndicator color={colors.brand} />
        <Text style={styles.text}>SYNCING...</Text>
      </View>
    );
  }

  if (!token) return <Redirect href="/login" />;
  return <Redirect href={user?.role === "admin" ? "/(monitor)" : "/(tabs)"} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, gap: 12 },
  text: { color: colors.textSecondary, fontFamily: MONO, letterSpacing: 2, fontSize: 13 },
});
