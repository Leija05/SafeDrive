import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "@/src/context/AuthContext";
import { useDrive } from "@/src/context/DriveContext";
import { apiFetch } from "@/src/lib/api";
import { colors, spacing, radius, MONO } from "@/src/theme";

function InfoRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>
        <MaterialCommunityIcons name={icon} size={18} color={colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function SectionCard({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
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
            <MaterialCommunityIcons name="account" size={36} color={colors.brand} />
          </View>
          <View style={styles.avatarOnline} />
        </View>
        <Text style={styles.name} testID="profile-name">
          {user?.name || "Conductor"}
        </Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <Text style={styles.sectionTitle}>
        <MaterialCommunityIcons name="truck" size={14} color={colors.brand} />
        {"  "}UNIDAD ASIGNADA
      </Text>
      <SectionCard>
        <InfoRow icon="truck" label="Unidad" value={unitName || unit?.name || "—"} />
        <View style={styles.divider} />
        <InfoRow icon="card-text" label="Placas" value={unit?.plate || "—"} />
        <View style={styles.divider} />
        <InfoRow icon="phone" label="Mi teléfono" value={user?.phone || unit?.driver_phone || "Pendiente de alta"} />
        <View style={styles.divider} />
        <InfoRow icon="map-marker-path" label="Corredor" value="Monterrey ↔ Nuevo Laredo (FED-85)" />
      </SectionCard>

      <Text style={styles.sectionTitle}>
        <MaterialCommunityIcons name="shield-lock" size={14} color={colors.brand} />
        {"  "}SESIÓN Y SEGURIDAD
      </Text>
      <SectionCard>
        <InfoRow icon="cellphone-check" label="Sesión activa" value="Solo este dispositivo" />
        <View style={styles.divider} />
        <InfoRow icon="database-clock" label="Caja negra (offline)" value={`${queueCount} registro${queueCount !== 1 ? "s" : ""} en espera`} />
      </SectionCard>

      {!!monitor?.phone && (
        <Pressable style={styles.callBtn} onPress={() => Linking.openURL(`tel:${monitor.phone}`)}>
          <MaterialCommunityIcons name="phone-alert" size={20} color={colors.onBrand} />
          <Text style={styles.callBtnText}>LLAMAR A MONITOREO</Text>
        </Pressable>
      )}

      <View style={styles.infoBox}>
        <MaterialCommunityIcons name="information-outline" size={16} color={colors.brand} />
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
  avatarOnline: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.success,
    borderWidth: 3,
    borderColor: colors.surface,
  },
  name: { color: colors.onSurface, fontSize: 24, fontWeight: "800" },
  email: { color: colors.textSecondary, fontFamily: MONO, fontSize: 13 },
  sectionTitle: {
    color: colors.textTertiary,
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
    marginTop: spacing.xl,
  },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  infoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  infoLabel: { color: colors.textTertiary, fontSize: 11, letterSpacing: 0.5 },
  infoValue: { color: colors.onSurface, fontSize: 15, fontWeight: "600", marginTop: 1 },
  divider: { height: 1, backgroundColor: colors.divider, marginHorizontal: spacing.lg },
  callBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.success,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginTop: spacing.xl,
    minHeight: 52,
  },
  callBtnText: { color: colors.onBrand, fontWeight: "800", fontSize: 14, letterSpacing: 1.5 },
  infoBox: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.brandTertiary,
    borderWidth: 1,
    borderColor: colors.brandTertiary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  infoText: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, flex: 1 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginTop: spacing.xl,
    minHeight: 52,
  },
  logoutText: { color: colors.error, fontWeight: "800", fontSize: 14, letterSpacing: 1 },
});
