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
      contentContainerStyle={{
        paddingTop: insets.top + spacing.lg,
        paddingBottom: insets.bottom + spacing["3xl"],
        paddingHorizontal: spacing.lg,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.profileHeader}>
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <MaterialCommunityIcons name="shield-account" size={36} color={colors.brand} />
          </View>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>MONITOREO</Text>
          </View>
        </View>
        <Text style={styles.name} testID="monitor-profile-name">
          {user?.name || "Monitorista"}
        </Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <MaterialCommunityIcons name="truck-fast" size={22} color={colors.brand} />
          <Text style={styles.statValue}>—</Text>
          <Text style={styles.statLabel}>Unidades activas</Text>
        </View>
        <View style={styles.statCard}>
          <MaterialCommunityIcons name="account-multiple" size={22} color={colors.success} />
          <Text style={styles.statValue}>—</Text>
          <Text style={styles.statLabel}>Conductores</Text>
        </View>
      </View>

      <View style={styles.infoBox}>
        <View style={styles.infoIconWrap}>
          <MaterialCommunityIcons name="map-marker-path" size={18} color={colors.brand} />
        </View>
        <Text style={styles.infoText}>
          Desde aquí asignas rutas por unidad (catálogo o personalizada), supervisas la flota en tiempo real y
          respondes el chat de los conductores.
        </Text>
      </View>

      <View style={styles.actionsSection}>
        <Pressable testID="logout-button" onPress={logout} style={styles.logoutBtn}>
          <MaterialCommunityIcons name="logout" size={20} color={colors.error} />
          <Text style={styles.logoutText}>CERRAR SESIÓN</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  profileHeader: { alignItems: "center", gap: spacing.xs, marginBottom: spacing["2xl"] },
  avatarSection: { position: "relative", marginBottom: spacing.md },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 2,
    borderColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  roleBadge: {
    position: "absolute",
    bottom: -4,
    alignSelf: "center",
    backgroundColor: colors.brand,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  roleText: { color: colors.onBrand, fontFamily: MONO, fontSize: 8, letterSpacing: 1.5, fontWeight: "700" },
  name: { color: colors.onSurface, fontSize: 24, fontWeight: "800" },
  email: { color: colors.textSecondary, fontFamily: MONO, fontSize: 13 },
  statsRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.xl },
  statCard: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.xs,
  },
  statValue: { color: colors.onSurface, fontSize: 28, fontWeight: "800", fontFamily: MONO },
  statLabel: { color: colors.textTertiary, fontSize: 11, letterSpacing: 0.5 },
  infoBox: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.brandTertiary,
    borderWidth: 1,
    borderColor: colors.brandTertiary,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: "flex-start",
  },
  infoIconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.brandGlow,
    alignItems: "center",
    justifyContent: "center",
  },
  infoText: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, flex: 1 },
  actionsSection: { marginTop: spacing["2xl"] },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    minHeight: 52,
  },
  logoutText: { color: colors.error, fontWeight: "800", fontSize: 14, letterSpacing: 1 },
});
