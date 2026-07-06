import { Redirect, Tabs } from "expo-router";
import { Platform, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "@/src/context/AuthContext";
import { colors } from "@/src/theme";

export default function TabsLayout() {
  const { token, ready, user } = useAuth();
  if (ready && !token) return <Redirect href="/login" />;
  if (ready && user?.role === "admin") return <Redirect href="/(monitor)" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 92 : 68,
          paddingTop: 8,
          paddingBottom: Platform.OS === "ios" ? 24 : 8,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: { fontSize: 10, letterSpacing: 0.8, fontWeight: "700" },
        tabBarItemStyle: { gap: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "CONDUCIR",
          tabBarIcon: ({ color, size }) => (
            <View style={{ alignItems: "center" }}>
              <MaterialCommunityIcons name="steering" size={size} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "CHAT",
          tabBarIcon: ({ color, size }) => (
            <View style={{ alignItems: "center" }}>
              <MaterialCommunityIcons name="radio-handheld" size={size} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: "ALERTAS",
          tabBarIcon: ({ color, size }) => (
            <View style={{ alignItems: "center" }}>
              <MaterialCommunityIcons name="alert-decagram" size={size} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "PERFIL",
          tabBarIcon: ({ color, size }) => (
            <View style={{ alignItems: "center" }}>
              <MaterialCommunityIcons name="account-circle" size={size} color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
