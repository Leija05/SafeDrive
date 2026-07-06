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
    const active = item.online && item.status !== "offline";
    return (
      <Pressable
        testID={`unit-card-${item.id}`}
        onPress={() => router.push(`/(monitor)/unit/${item.id}`)}
        style={({ pressed }) => [styles.card, pressed && { borderColor: color }]}
      >
        <View style={[styles.statusBar, { backgroundColor: color }]} />
        <View style={styles.cardBody}>
          <View style={styles.cardHead}>
            <View style={styles.titleRow}>
              <Text style={styles.unitName}>{item.name}</Text>
              {active && <View style={styles.onlineDot} />}
            </View>
            <View style={[styles.statusBadge, { borderColor: color }]}>
              <View style={[styles.badgeDot, { backgroundColor: color }]} />
              <Text style={[styles.statusBadgeText, { color }]}>
                {STATUS_LABELS[item.status] || item.status.toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={styles.driver}>{item.driver_name} · {item.plate}</Text>
          <View style={styles.metaRow}>
            <View style={styles.meta}>
              <MaterialCommunityIcons name="speedometer" size={14} color={colors.textSecondary} />
              <Text style={styles.metaText}>{Math.round(item.speed)} km/h</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.meta}>
              <MaterialCommunityIcons name="map-marker-distance" size={14} color={colors.textSecondary} />
              <Text style={styles.metaText}>{Math.round(item.deviation_m)} m desvío</Text>
            </View>
          </View>
          {item.route_name && (
            <View style={styles.routeTag}>
              <MaterialCommunityIcons name="map-marker-path" size={12} color={colors.brand} />
              <Text style={styles.routeText} numberOfLines={1}>{item.route_name}</Text>
            </View>
          )}
        </View>
        <View style={styles.chevronWrap}>
          <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textTertiary} />
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerIconWrap}>
          <MaterialCommunityIcons name="truck-fast" size={18} color={colors.brand} />
        </View>
        <Text style={styles.headerTitle}>FLOTA</Text>
        <View style={styles.headerCount}>
          <Text style={styles.headerCountText}>{units.length} unid.</Text>
        </View>
      </View>
      <FlatList
        data={units}
        keyExtractor={(u) => u.id}
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
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <MaterialCommunityIcons name="truck-remove" size={40} color={colors.textTertiary} />
            </View>
            <Text style={styles.emptyText}>Sin unidades registradas</Text>
            <Text style={styles.emptyHint}>Los conductores aparecen al registrarse en el sistema.</Text>
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
    paddingBottom: spacing.md, backgroundColor: colors.surfaceSecondary,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerIconWrap: {
    width: 32, height: 32, borderRadius: radius.md,
    backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center",
  },
  headerTitle: { color: colors.onSurface, fontFamily: MONO, fontSize: 14, letterSpacing: 2, fontWeight: "700" },
  headerCount: {
    marginLeft: "auto", backgroundColor: colors.surfaceTertiary,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  headerCountText: { color: colors.textSecondary, fontFamily: MONO, fontSize: 10, fontWeight: "600" },
  list: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
  card: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, overflow: "hidden",
  },
  statusBar: { width: 4, alignSelf: "stretch" },
  cardBody: { flex: 1, padding: spacing.md, gap: 4 },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  unitName: { color: colors.onSurface, fontFamily: MONO, fontSize: 16, fontWeight: "700", letterSpacing: 1 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  badgeDot: { width: 5, height: 5, borderRadius: 3 },
  statusBadgeText: { fontFamily: MONO, fontSize: 8, letterSpacing: 1, fontWeight: "700" },
  driver: { color: colors.textSecondary, fontSize: 13 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 2 },
  meta: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaDivider: { width: 1, height: 10, backgroundColor: colors.divider },
  metaText: { color: colors.textSecondary, fontFamily: MONO, fontSize: 11 },
  routeTag: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: colors.brandTertiary, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 2, alignSelf: "flex-start", marginTop: 2,
  },
  routeText: { color: colors.brand, fontSize: 10, maxWidth: 180 },
  chevronWrap: { paddingRight: spacing.md },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingTop: spacing["3xl"] },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.sm,
  },
  emptyText: { color: colors.onSurface, fontSize: 16, fontWeight: "600" },
  emptyHint: { color: colors.textTertiary, fontSize: 13, textAlign: "center", maxWidth: 260 },
});
