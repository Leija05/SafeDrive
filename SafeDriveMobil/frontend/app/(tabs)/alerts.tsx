import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { apiFetch } from "@/src/lib/api";
import { useDrive } from "@/src/context/DriveContext";
import { colors, spacing, radius, MONO } from "@/src/theme";

type Alert = {
  id: string; type: string; severity: string; message: string; status: string; created_at: string;
};

const SEV_CONFIG: Record<string, { color: string; label: string }> = {
  critical: { color: colors.error, label: "CRÍTICO" },
  warning: { color: colors.warning, label: "ADVERTENCIA" },
  info: { color: colors.brand, label: "INFORMATIVO" },
};

const TYPE_ICON: Record<string, any> = {
  panico: "shield-alert",
  distractor: "cellphone-lock",
  jammer: "wifi-off",
  impacto: "car-emergency",
  desvio: "map-marker-alert",
  exceso_velocidad: "speedometer",
};

export default function Alerts() {
  const insets = useSafeAreaInsets();
  const { queueCount } = useDrive();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const a = await apiFetch<Alert[]>("/driver/alerts");
      setAlerts(a);
    } catch {}
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: Alert }) => {
    const config = SEV_CONFIG[item.severity] || { color: colors.offline, label: "DESCONOCIDO" };
    return (
      <View style={[styles.row, { borderLeftColor: config.color }]} testID={`alert-row-${item.id}`}>
        <View style={[styles.iconBox, { backgroundColor: `${config.color}18`, borderColor: `${config.color}40` }]}>
          <MaterialCommunityIcons name={TYPE_ICON[item.type] || "alert"} size={20} color={config.color} />
        </View>
        <View style={styles.rowBody}>
          <View style={styles.rowHead}>
            <View style={[styles.badge, { backgroundColor: `${config.color}18` }]}>
              <View style={[styles.badgeDot, { backgroundColor: config.color }]} />
              <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
            </View>
            <Text style={styles.time}>
              {new Date(item.created_at).toLocaleString([], { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </Text>
          </View>
          <Text style={styles.message}>{item.message}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconWrap}>
            <MaterialCommunityIcons name="alert-decagram" size={18} color={colors.warning} />
          </View>
          <Text style={styles.headerTitle}>ALERTAS</Text>
        </View>
        <View style={styles.headerCount}>
          <Text style={styles.headerCountText}>{alerts.length}</Text>
        </View>
      </View>

      {queueCount > 0 && (
        <View style={styles.burstBar} testID="burst-sync-bar">
          <View style={styles.burstIconWrap}>
            <MaterialCommunityIcons name="database-sync-outline" size={16} color={colors.warning} />
          </View>
          <View style={styles.burstContent}>
            <Text style={styles.burstTitle}>Sincronización pendiente</Text>
            <Text style={styles.burstText}>
              {queueCount} registro{queueCount !== 1 ? "s" : ""} offline esperando ráfaga
            </Text>
          </View>
          <View style={styles.burstProgress}>
            <View style={styles.burstProgressBar} />
          </View>
        </View>
      )}

      <FlatList
        data={alerts}
        keyExtractor={(a) => a.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.xl }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand}
            colors={[colors.brand]}
            progressBackgroundColor={colors.surfaceSecondary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty} testID="alerts-empty">
            <View style={styles.emptyIconWrap}>
              <MaterialCommunityIcons name="shield-check" size={48} color={colors.success} />
            </View>
            <Text style={styles.emptyTitle}>Sistema nominal</Text>
            <Text style={styles.emptyText}>Sin alertas registradas.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  headerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.warningDim,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: colors.onSurface, fontFamily: MONO, fontSize: 14, letterSpacing: 2, fontWeight: "700" },
  headerCount: {
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  headerCountText: { color: colors.textSecondary, fontFamily: MONO, fontSize: 11, fontWeight: "700" },
  burstBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.warningDim,
    borderBottomWidth: 1,
    borderBottomColor: colors.warning,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  burstIconWrap: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    backgroundColor: "rgba(255,184,0,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  burstContent: { flex: 1 },
  burstTitle: { color: colors.warning, fontFamily: MONO, fontSize: 10, letterSpacing: 1, fontWeight: "700" },
  burstText: { color: colors.onSurface, fontSize: 12, marginTop: 1 },
  burstProgress: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "rgba(255,184,0,0.15)",
  },
  burstProgressBar: {
    width: "60%",
    height: "100%",
    backgroundColor: colors.warning,
  },
  list: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
  row: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: { flex: 1, gap: 4 },
  rowHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontFamily: MONO, fontSize: 8, letterSpacing: 1, fontWeight: "700" },
  time: { color: colors.textTertiary, fontFamily: MONO, fontSize: 10 },
  message: { color: colors.onSurfaceSecondary, fontSize: 13, lineHeight: 18, marginTop: 2 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, paddingTop: spacing["3xl"] },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.successDim,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  emptyTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "700" },
  emptyText: { color: colors.textSecondary, fontSize: 13 },
});
