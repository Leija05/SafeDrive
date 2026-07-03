import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing, radius, MONO } from "@/src/theme";

export default function MonitorProfile() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl, paddingHorizontal: spacing.lg }}
    >
      <View style={styles.avatarWrap}>
        <View style={styles.avatar}>
          <MaterialCommunityIcons name="shield-account" size={40} color={colors.brand} />
        </View>
        <Text style={styles.name} testID="monitor-profile-name">{user?.name || "Monitorista"}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>CENTRAL DE MONITOREO</Text>
        </View>
      </View>

      <View style={styles.infoBox}>
        <MaterialCommunityIcons name="map-marker-path" size={16} color={colors.brand} />
        <Text style={styles.infoText}>
          Desde aquí asignas rutas por unidad (catálogo o personalizada), supervisas la flota en tiempo real y respondes el chat de los conductores. Todo se guarda en la misma base de datos.
        </Text>
      </View>

      <Pressable testID="logout-button" onPress={logout} style={styles.logoutBtn}>
        <MaterialCommunityIcons name="logout" size={20} color={colors.error} />
        <Text style={styles.logoutText}>CERRAR SESIÓN</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  avatarWrap: { alignItems: "center", gap: spacing.xs, marginBottom: spacing.xl },
  avatar: {
    width: 80, height: 80, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary,
    borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm,
  },
  name: { color: colors.onSurface, fontSize: 22, fontWeight: "800" },
  email: { color: colors.textSecondary, fontFamily: MONO, fontSize: 13 },
  roleBadge: { borderWidth: 1, borderColor: colors.brand, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3, marginTop: spacing.sm },
  roleText: { color: colors.brand, fontFamily: MONO, fontSize: 10, letterSpacing: 1.5 },
  infoBox: {
    flexDirection: "row", gap: spacing.sm, backgroundColor: "rgba(0,122,255,0.08)", borderWidth: 1,
    borderColor: colors.brandTertiary, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md,
  },
  infoText: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, flex: 1 },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    borderWidth: 1, borderColor: colors.error, borderRadius: radius.md, paddingVertical: spacing.md, marginTop: spacing.xl,
  },
  logoutText: { color: colors.error, fontWeight: "800", fontSize: 14, letterSpacing: 1 },
});
