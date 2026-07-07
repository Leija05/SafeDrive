import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "@/src/context/AuthContext";
import { apiFetch } from "@/src/lib/api";
import { colors, spacing, radius, MONO } from "@/src/theme";

type MonitorToken = {
  token: string; name?: string; active: boolean;
  plan_id?: string; plan_name?: string; max_drivers?: number; drivers_used?: number;
  cycle?: string; expires_at?: string; expired?: boolean;
  remaining_drivers?: number;
};

type ConductorToken = {
  token: string; name?: string; active: boolean;
  unit_id?: string; device_id?: string; driver_id?: string;
  unit_info?: { name?: string; plate?: string; driver_name?: string };
};

type TokenOverview = {
  monitor_token: MonitorToken | null;
  conductor_tokens: ConductorToken[];
  total_drivers_used: number;
  max_drivers: number;
};

export default function MonitorProfile() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const [overview, setOverview] = useState<TokenOverview | null>(null);
  const [showTokens, setShowTokens] = useState(false);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [revealedTokens, setRevealedTokens] = useState<Set<string>>(new Set());
  const [filterActive, setFilterActive] = useState<string>("all");

  const loadTokens = async () => {
    setLoadingTokens(true);
    try {
      const data = await apiFetch<TokenOverview>("/auth/company-token-overview");
      setOverview(data);
    } catch {}
    setLoadingTokens(false);
  };

  const toggleToken = async (tid: string) => {
    try {
      await apiFetch(`/auth/site-tokens/${tid}`, { method: "PATCH" });
      await loadTokens();
    } catch {}
  };

  const toggleReveal = (token: string) => {
    setRevealedTokens((prev) => {
      const next = new Set(prev);
      if (next.has(token)) next.delete(token);
      else next.add(token);
      return next;
    });
  };

  const mt = overview?.monitor_token;
  const condTokens = overview?.conductor_tokens || [];
  const driversPct = mt?.max_drivers && mt.max_drivers > 0
    ? Math.round(((mt.drivers_used || 0) / mt.max_drivers) * 100)
    : 0;

  const filteredCond = condTokens.filter((t) => {
    if (filterActive === "active" && !t.active) return false;
    if (filterActive === "inactive" && t.active) return false;
    return true;
  });

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

      <Pressable
        onPress={() => { setShowTokens(true); loadTokens(); }}
        style={styles.tokensBtn}
      >
        <View style={styles.tokensBtnIcon}>
          <MaterialCommunityIcons name="key-chain-variant" size={20} color={colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.tokensBtnTitle}>Tokens del sistema</Text>
          <Text style={styles.tokensBtnSub}>Ver token único de empresa y conductores</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textTertiary} />
      </Pressable>

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

      <Modal visible={showTokens} transparent animationType="slide" onRequestClose={() => setShowTokens(false)}>
        <View style={styles.modalShade}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>TOKENS DEL SISTEMA</Text>
              <Pressable onPress={() => setShowTokens(false)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.onSurface} />
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={[styles.modalBody, { paddingBottom: insets.bottom + spacing.xl }]}
              showsVerticalScrollIndicator={false}
            >
              {loadingTokens ? (
                <ActivityIndicator color={colors.brand} />
              ) : (
                <>
                  {/* ── Highlighted Company Token ── */}
                  {mt && (
                    <View style={[styles.companyTokenCard, !mt.active && styles.companyTokenInactive]}>
                      <View style={styles.companyTokenHeader}>
                        <View style={styles.companyTokenIcon}>
                          <MaterialCommunityIcons name="shield-account" size={22} color={colors.brand} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.companyTokenName}>{mt.name || "Token de empresa"}</Text>
                          <Text style={styles.companyTokenBadge}>TOKEN ÚNICO DE MONITORISTA</Text>
                        </View>
                        <Pressable
                          onPress={() => toggleToken(mt.token)}
                          style={[styles.toggleBtn, mt.active ? styles.toggleActive : styles.toggleInactive]}
                        >
                          <Text style={[styles.toggleText, mt.active ? styles.toggleTextActive : styles.toggleTextInactive]}>
                            {mt.active ? "ACTIVO" : "INACTIVO"}
                          </Text>
                        </Pressable>
                      </View>

                      {mt.plan_name && (
                        <View style={styles.planGrid}>
                          <View style={styles.planItem}>
                            <Text style={styles.planLabel}>Plan</Text>
                            <Text style={styles.planValue}>{mt.plan_name}</Text>
                          </View>
                          <View style={styles.planItem}>
                            <Text style={styles.planLabel}>Ciclo</Text>
                            <Text style={styles.planValue}>{mt.cycle || "—"}</Text>
                          </View>
                          <View style={styles.planItem}>
                            <Text style={styles.planLabel}>Vence</Text>
                            <Text style={[styles.planValue, mt.expired && { color: colors.error }]}>
                              {mt.expires_at ? new Date(mt.expires_at).toLocaleDateString("es-MX") : "—"}
                            </Text>
                          </View>
                          <View style={styles.planItem}>
                            <Text style={styles.planLabel}>Conductores</Text>
                            <Text style={styles.planValue}>
                              {mt.drivers_used || 0}/{mt.max_drivers || "∞"}
                            </Text>
                          </View>
                        </View>
                      )}

                      {mt.max_drivers && mt.max_drivers > 0 && (
                        <View style={styles.progressWrap}>
                          <View style={styles.progressBg}>
                            <View style={[styles.progressFill, {
                              width: `${Math.min(100, driversPct)}%`,
                              backgroundColor: driversPct >= 90 ? colors.error : driversPct >= 70 ? colors.warning : colors.success,
                            }]} />
                          </View>
                          <Text style={styles.progressText}>
                            {mt.max_drivers - (mt.drivers_used || 0)} lugares disponibles
                          </Text>
                        </View>
                      )}

                      {/* Token reveal */}
                      <Pressable onPress={() => toggleReveal(mt.token)} style={styles.tokenRevealRow}>
                        <MaterialCommunityIcons
                          name={revealedTokens.has(mt.token) ? "eye-off" : "eye"}
                          size={16}
                          color={colors.textTertiary}
                        />
                        <Text style={styles.tokenCode}>
                          {revealedTokens.has(mt.token) ? mt.token : `${mt.token.slice(0, 20)}...`}
                        </Text>
                      </Pressable>
                    </View>
                  )}

                  {!mt && (
                    <View style={styles.emptySection}>
                      <MaterialCommunityIcons name="key-off" size={32} color={colors.textTertiary} />
                      <Text style={styles.emptyText}>No hay token de monitorista asignado</Text>
                    </View>
                  )}

                  {/* ── Conductor Tokens ── */}
                  {mt && (
                    <>
                      <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>
                          Conductores ({condTokens.length})
                        </Text>
                        {/* Filter */}
                        <View style={styles.filterRow}>
                          {["all", "active", "inactive"].map((f) => (
                            <Pressable
                              key={f}
                              onPress={() => setFilterActive(f)}
                              style={[styles.filterBtn, filterActive === f && styles.filterBtnActive]}
                            >
                              <Text style={[styles.filterText, filterActive === f && styles.filterTextActive]}>
                                {f === "all" ? "Todos" : f === "active" ? "Activos" : "Inactivos"}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>

                      {filteredCond.length === 0 ? (
                        <Text style={styles.emptySmall}>
                          {condTokens.length === 0 ? "No hay tokens de conductores" : "Ninguno coincide con el filtro"}
                        </Text>
                      ) : (
                        filteredCond.map((t) => {
                          const inUse = !!t.device_id || !!t.driver_id;
                          return (
                            <View key={t.token} style={styles.tokenCard}>
                              <View style={styles.tokenRow}>
                                <View style={[styles.tokenDot, {
                                  backgroundColor: inUse ? colors.success : colors.textTertiary,
                                }]} />
                                <View style={{ flex: 1 }}>
                                  <View style={styles.tokenNameRow}>
                                    <Text style={styles.tokenName}>{t.name || "Sin nombre"}</Text>
                                    <Text style={[styles.tokenStatus, {
                                      color: inUse ? colors.success : colors.textTertiary,
                                    }]}>
                                      {inUse ? "En uso" : "Disponible"}
                                    </Text>
                                  </View>
                                  <Text style={styles.tokenMeta}>
                                    {revealedTokens.has(t.token) ? t.token : `${t.token.slice(0, 20)}...`}
                                  </Text>
                                  {t.unit_info && (
                                    <Text style={styles.unitInfo}>
                                      {t.unit_info.name} · {t.unit_info.plate}
                                      {t.unit_info.driver_name ? ` · ${t.unit_info.driver_name}` : ""}
                                    </Text>
                                  )}
                                </View>
                                <View style={styles.tokenActions}>
                                  <Pressable onPress={() => toggleReveal(t.token)} style={styles.actionBtn}>
                                    <MaterialCommunityIcons
                                      name={revealedTokens.has(t.token) ? "eye-off" : "eye"}
                                      size={16}
                                      color={colors.textTertiary}
                                    />
                                  </Pressable>
                                  <Pressable
                                    onPress={() => toggleToken(t.token)}
                                    style={[styles.toggleSmall, t.active ? styles.toggleSmallActive : styles.toggleSmallInactive]}
                                  >
                                    <Text style={[styles.toggleSmallText, t.active ? { color: colors.success } : { color: colors.textTertiary }]}>
                                      {t.active ? "ON" : "OFF"}
                                    </Text>
                                  </Pressable>
                                </View>
                              </View>
                            </View>
                          );
                        })
                      )}
                    </>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  profileHeader: { alignItems: "center", gap: spacing.xs, marginBottom: spacing["2xl"] },
  avatarSection: { position: "relative", marginBottom: spacing.md },
  avatar: {
    width: 88, height: 88, borderRadius: radius.xl,
    backgroundColor: colors.surfaceSecondary, borderWidth: 2, borderColor: colors.brandTertiary,
    alignItems: "center", justifyContent: "center",
  },
  roleBadge: {
    position: "absolute", bottom: -4, alignSelf: "center",
    backgroundColor: colors.brand, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  roleText: { color: colors.onBrand, fontFamily: MONO, fontSize: 8, letterSpacing: 1.5, fontWeight: "700" },
  name: { color: colors.onSurface, fontSize: 24, fontWeight: "800" },
  email: { color: colors.textSecondary, fontFamily: MONO, fontSize: 13 },
  infoBox: {
    flexDirection: "row", gap: spacing.md,
    backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.brandTertiary,
    borderRadius: radius.md, padding: spacing.lg, alignItems: "flex-start",
  },
  infoIconWrap: {
    width: 38, height: 38, borderRadius: radius.md,
    backgroundColor: colors.brandGlow, alignItems: "center", justifyContent: "center",
  },
  infoText: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, flex: 1 },
  actionsSection: { marginTop: spacing["2xl"] },
  tokensBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg,
  },
  tokensBtnIcon: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center",
  },
  tokensBtnTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "700" },
  tokensBtnSub: { color: colors.textTertiary, fontSize: 12, marginTop: 1 },
  // Company token card (highlighted)
  companyTokenCard: {
    backgroundColor: colors.brandTertiary,
    borderWidth: 2, borderColor: colors.brand,
    borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg,
  },
  companyTokenInactive: { opacity: 0.6, borderColor: colors.border },
  companyTokenHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md },
  companyTokenIcon: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.brandGlow, alignItems: "center", justifyContent: "center",
  },
  companyTokenName: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },
  companyTokenBadge: {
    color: colors.brand, fontFamily: MONO, fontSize: 8, letterSpacing: 1.5, fontWeight: "700", marginTop: 1,
  },
  toggleBtn: {
    borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    borderWidth: 1,
  },
  toggleActive: { borderColor: colors.success, backgroundColor: colors.success + "20" },
  toggleInactive: { borderColor: colors.border, backgroundColor: "transparent" },
  toggleText: { fontFamily: MONO, fontSize: 8, letterSpacing: 1, fontWeight: "700" },
  toggleTextActive: { color: colors.success },
  toggleTextInactive: { color: colors.textTertiary },
  planGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md,
  },
  planItem: {
    backgroundColor: colors.surface, borderRadius: radius.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderWidth: 1, borderColor: colors.border, minWidth: "44%",
  },
  planLabel: { color: colors.textTertiary, fontFamily: MONO, fontSize: 9, letterSpacing: 1 },
  planValue: { color: colors.onSurface, fontSize: 13, fontWeight: "700", marginTop: 1 },
  progressWrap: { marginBottom: spacing.md },
  progressBg: {
    height: 6, backgroundColor: colors.surface, borderRadius: 3,
    borderWidth: 1, borderColor: colors.border, overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 3 },
  progressText: { color: colors.textSecondary, fontSize: 11, marginTop: spacing.xs },
  tokenRevealRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  tokenCode: { color: colors.textTertiary, fontFamily: MONO, fontSize: 11, flex: 1 },
  // Section header
  sectionHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: spacing.md, marginTop: spacing.md,
  },
  sectionTitle: {
    color: colors.textTertiary, fontFamily: MONO, fontSize: 11, letterSpacing: 1.5,
  },
  filterRow: { flexDirection: "row", gap: spacing.xs },
  filterBtn: {
    borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2,
    borderWidth: 1, borderColor: colors.border,
  },
  filterBtnActive: { borderColor: colors.brand, backgroundColor: colors.brandTertiary },
  filterText: { color: colors.textTertiary, fontFamily: MONO, fontSize: 8, fontWeight: "600" },
  filterTextActive: { color: colors.brand },
  // Conductor token cards
  tokenCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm,
  },
  tokenRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  tokenDot: { width: 8, height: 8, borderRadius: 4 },
  tokenNameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  tokenName: { color: colors.onSurface, fontSize: 14, fontWeight: "600" },
  tokenStatus: { fontFamily: MONO, fontSize: 8, letterSpacing: 1, fontWeight: "700" },
  tokenMeta: { color: colors.textTertiary, fontFamily: MONO, fontSize: 11, marginTop: 1 },
  unitInfo: { color: colors.textSecondary, fontSize: 11, marginTop: 1 },
  tokenActions: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  actionBtn: { padding: spacing.xs },
  toggleSmall: {
    borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 1,
    borderWidth: 1,
  },
  toggleSmallActive: { borderColor: colors.success },
  toggleSmallInactive: { borderColor: colors.border },
  toggleSmallText: { fontFamily: MONO, fontSize: 8, fontWeight: "700" },
  // Modals & empty states
  modalShade: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "flex-end" },
  modalCard: {
    maxHeight: "88%", backgroundColor: colors.surfaceSecondary,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border,
  },
  modalHead: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTitle: { color: colors.onSurface, fontFamily: MONO, fontSize: 13, fontWeight: "800", letterSpacing: 1 },
  modalBody: { padding: spacing.lg, gap: spacing.md },
  emptySection: { alignItems: "center", gap: spacing.md, paddingVertical: spacing["2xl"] },
  emptyText: { color: colors.textTertiary, textAlign: "center", fontSize: 13 },
  emptySmall: { color: colors.textTertiary, textAlign: "center", paddingVertical: spacing.xl, fontSize: 12 },
});