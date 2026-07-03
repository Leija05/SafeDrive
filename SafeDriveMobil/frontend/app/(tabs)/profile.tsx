import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "@/src/context/AuthContext";
import { useDrive } from "@/src/context/DriveContext";
import { apiFetch } from "@/src/lib/api";
import { colors, spacing, radius, MONO } from "@/src/theme";

function Row({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.row}>
      <MaterialCommunityIcons name={icon} size={20} color={colors.textSecondary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function Profile() {
  const insets = useSafeAreaInsets();
  const { user, unit, logout } = useAuth();
  const { unitName, queueCount } = useDrive();
  const [monitor, setMonitor] = useState<any>(null);

  useEffect(() => {
    apiFetch("/driver/monitor-contact").then(setMonitor).catch(() => {});
  }, []);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl, paddingHorizontal: spacing.lg }}
    >
      <View style={styles.avatarWrap}>
        <View style={styles.avatar}>
          <MaterialCommunityIcons name="account" size={40} color={colors.brand} />
        </View>
        <Text style={styles.name} testID="profile-name">{user?.name || "Conductor"}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <Text style={styles.section}>UNIDAD ASIGNADA</Text>
      <View style={styles.card}>
        <Row icon="truck" label="Unidad" value={unitName || unit?.name || "—"} />
        <View style={styles.divider} />
        <Row icon="card-text" label="Placas" value={unit?.plate || "—"} />
        <View style={styles.divider} />
        <Row icon="phone" label="Mi teléfono" value={user?.phone || unit?.driver_phone || "Pendiente de alta"} />
        <View style={styles.divider} />
        <Row icon="map-marker-path" label="Corredor" value="Monterrey ↔ Nuevo Laredo (FED-85)" />
      </View>

      <Text style={styles.section}>SESIÓN Y SEGURIDAD</Text>
      <View style={styles.card}>
        <Row icon="cellphone-check" label="Sesión activa" value="Solo este dispositivo" />
        <View style={styles.divider} />
        <Row icon="database-clock" label="Caja negra (offline)" value={`${queueCount} registros en espera`} />
      </View>

      {!!monitor?.phone && (
        <Pressable style={styles.callBtn} onPress={() => Linking.openURL(`tel:${monitor.phone}`)}>
          <MaterialCommunityIcons name="phone-alert" size={18} color={colors.onBrand} />
          <Text style={styles.callText}>LLAMAR A MONITOREO</Text>
        </Pressable>
      )}

      <View style={styles.infoBox}>
        <MaterialCommunityIcons name="shield-lock" size={16} color={colors.brand} />
        <Text style={styles.infoText}>
          Una sola sesión por conductor. Si inicias sesión en otro teléfono, esta sesión se cierra automáticamente.
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
  section: { color: colors.textTertiary, fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, marginBottom: spacing.sm, marginTop: spacing.lg },
  card: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  rowLabel: { color: colors.textTertiary, fontSize: 11, letterSpacing: 0.5 },
  rowValue: { color: colors.onSurface, fontSize: 15, fontWeight: "600", marginTop: 1 },
  divider: { height: 1, backgroundColor: colors.divider },
  callBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.success, borderRadius: radius.md, paddingVertical: spacing.md, marginTop: spacing.lg },
  callText: { color: colors.onBrand, fontWeight: "800", fontSize: 13, letterSpacing: 1 },
  infoBox: {
    flexDirection: "row", gap: spacing.sm, backgroundColor: "rgba(0,122,255,0.08)", borderWidth: 1,
    borderColor: colors.brandTertiary, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.lg,
  },
  infoText: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, flex: 1 },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    borderWidth: 1, borderColor: colors.error, borderRadius: radius.md, paddingVertical: spacing.md, marginTop: spacing.xl,
  },
  logoutText: { color: colors.error, fontWeight: "800", fontSize: 14, letterSpacing: 1 },
});
