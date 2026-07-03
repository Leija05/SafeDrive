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

const SEV_COLOR: Record<string, string> = {
  critical: colors.error,
  warning: colors.warning,
  info: colors.brand,
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
    const color = SEV_COLOR[item.severity] || colors.offline;
    return (
      <View style={styles.row} testID={`alert-row-${item.id}`}>
        <View style={[styles.iconBox, { borderColor: color }]}>
          <MaterialCommunityIcons name={TYPE_ICON[item.type] || "alert"} size={18} color={color} />
        </View>
        <View style={styles.rowBody}>
          <View style={styles.rowHead}>
            <Text style={[styles.badge, { color, borderColor: color }]}>{item.severity.toUpperCase()}</Text>
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
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <MaterialCommunityIcons name="alert-decagram" size={20} color={colors.warning} />
        <Text style={styles.headerTitle}>ALERTAS Y CAJA NEGRA</Text>
      </View>

      {queueCount > 0 && (
        <View style={styles.burstBar} testID="burst-sync-bar">
          <MaterialCommunityIcons name="database-sync" size={16} color={colors.warning} />
          <Text style={styles.burstText}>
            {queueCount} registros offline en espera de ráfaga de sincronización
          </Text>
        </View>
      )}

      <FlatList
        data={alerts}
        keyExtractor={(a) => a.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.xl }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        ListEmptyComponent={
          <View style={styles.empty} testID="alerts-empty">
            <MaterialCommunityIcons name="shield-check" size={40} color={colors.success} />
            <Text style={styles.emptyText}>Sistema nominal. Sin alertas.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm, backgroundColor: colors.surfaceSecondary,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { color: colors.onSurface, fontFamily: MONO, fontSize: 13, letterSpacing: 1.5 },
  burstBar: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: "rgba(255,184,0,0.12)",
    borderBottomWidth: 1, borderBottomColor: colors.warning, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  burstText: { color: colors.warning, fontFamily: MONO, fontSize: 11, flex: 1 },
  list: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
  row: {
    flexDirection: "row", gap: spacing.md, backgroundColor: colors.surfaceSecondary,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md,
  },
  iconBox: { width: 40, height: 40, borderRadius: radius.md, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  rowBody: { flex: 1, gap: 4 },
  rowHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: { fontFamily: MONO, fontSize: 9, letterSpacing: 1, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  time: { color: colors.textTertiary, fontFamily: MONO, fontSize: 10 },
  message: { color: colors.onSurfaceSecondary, fontSize: 13, lineHeight: 18 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, paddingTop: spacing["3xl"] },
  emptyText: { color: colors.textSecondary, fontSize: 13 },
});
