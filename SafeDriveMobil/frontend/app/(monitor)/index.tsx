import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { apiFetch } from "@/src/lib/api";
import { colors, spacing, radius, MONO, STATUS_COLORS, STATUS_LABELS } from "@/src/theme";

type Unit = {
  id: string; name: string; driver_name: string; plate: string; status: string;
  speed: number; deviation_m: number; route_name?: string; online: boolean;
};

export default function Fleet() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [units, setUnits] = useState<Unit[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const u = await apiFetch<Unit[]>("/units");
      setUnits(u);
    } catch {}
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: Unit }) => {
    const color = STATUS_COLORS[item.status] || colors.offline;
    return (
      <Pressable
        testID={`unit-card-${item.id}`}
        onPress={() => router.push(`/(monitor)/unit/${item.id}`)}
        style={({ pressed }) => [styles.card, pressed && { borderColor: colors.borderStrong }]}
      >
        <View style={[styles.statusBar, { backgroundColor: color }]} />
        <View style={styles.cardBody}>
          <View style={styles.cardHead}>
            <Text style={styles.unitName}>{item.name}</Text>
            <Text style={[styles.statusBadge, { color, borderColor: color }]}>
              {STATUS_LABELS[item.status] || item.status.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.driver}>{item.driver_name} · {item.plate}</Text>
          <View style={styles.metaRow}>
            <View style={styles.meta}>
              <MaterialCommunityIcons name="speedometer" size={13} color={colors.textSecondary} />
              <Text style={styles.metaText}>{Math.round(item.speed)} km/h</Text>
            </View>
            <View style={styles.meta}>
              <MaterialCommunityIcons name="map-marker-distance" size={13} color={colors.textSecondary} />
              <Text style={styles.metaText}>{Math.round(item.deviation_m)} m desvío</Text>
            </View>
          </View>
          <Text style={styles.route} numberOfLines={1}>
            <MaterialCommunityIcons name="map-marker-path" size={12} color={colors.brand} /> {item.route_name || "Sin ruta asignada"}
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textTertiary} />
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <MaterialCommunityIcons name="truck-fast" size={20} color={colors.brand} />
        <Text style={styles.headerTitle}>FLOTA · CENTRAL DE MONITOREO</Text>
      </View>
      <FlatList
        data={units}
        keyExtractor={(u) => u.id}
        renderItem={renderItem}

        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.xl }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="truck-remove" size={40} color={colors.textTertiary} />
            <Text style={styles.emptyText}>Sin unidades. Los conductores aparecen al registrarse.</Text>
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
  headerTitle: { color: colors.onSurface, fontFamily: MONO, fontSize: 12, letterSpacing: 1.2 },
  list: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
  card: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: "hidden",
  },
  statusBar: { width: 4, alignSelf: "stretch" },
  cardBody: { flex: 1, padding: spacing.md, gap: 3 },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  unitName: { color: colors.onSurface, fontFamily: MONO, fontSize: 16, fontWeight: "700", letterSpacing: 1 },
  statusBadge: { fontFamily: MONO, fontSize: 9, letterSpacing: 1, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  driver: { color: colors.textSecondary, fontSize: 13 },
  metaRow: { flexDirection: "row", gap: spacing.lg, marginTop: 2 },
  meta: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { color: colors.textSecondary, fontFamily: MONO, fontSize: 11 },
  route: { color: colors.textTertiary, fontSize: 11, marginTop: 2 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, paddingTop: spacing["3xl"] },
  emptyText: { color: colors.textTertiary, fontSize: 13, textAlign: "center", maxWidth: 260 },
});
