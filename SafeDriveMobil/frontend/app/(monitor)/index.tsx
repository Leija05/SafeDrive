import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, RefreshControl,
  Modal, TextInput, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform,
} from "react-native";
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
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", plate: "", imei: "", color: "#00E676" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

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

  const flash = (m: string) => {
    setMessage(m);
    setTimeout(() => setMessage(""), 3000);
  };

  const createUnit = async () => {
    if (!createForm.name.trim() || !createForm.plate.trim()) {
      flash("Nombre y placas son obligatorios");
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/units", {
        method: "POST",
        body: JSON.stringify(createForm),
      });
      setCreateForm({ name: "", plate: "", imei: "", color: "#00E676" });
      setShowCreate(false);
      flash("Unidad creada correctamente");
      await load();
    } catch (e: any) {
      flash(e?.message || "Error al crear unidad");
    }
    setBusy(false);
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
        <Pressable onPress={() => setShowCreate(true)} style={styles.addBtn}>
          <MaterialCommunityIcons name="plus" size={18} color={colors.onBrand} />
        </Pressable>
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
            <Pressable onPress={() => setShowCreate(true)} style={styles.emptyBtn}>
              <MaterialCommunityIcons name="plus" size={16} color={colors.onBrand} />
              <Text style={styles.emptyBtnText}>CREAR PRIMERA UNIDAD</Text>
            </Pressable>
          </View>
        }
      />

      {/* Create Unit Modal */}
      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <KeyboardAvoidingView style={styles.modalShade} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>CREAR UNIDAD</Text>
              <Pressable onPress={() => setShowCreate(false)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.onSurface} />
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={[styles.modalBody, { paddingBottom: insets.bottom + spacing.xl }]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <TextInput
                value={createForm.name}
                onChangeText={(name) => setCreateForm((f) => ({ ...f, name }))}
                placeholder="Nombre de la unidad (ej: NL-01)"
                placeholderTextColor={colors.textTertiary}
                style={styles.input}
              />
              <TextInput
                value={createForm.plate}
                onChangeText={(plate) => setCreateForm((f) => ({ ...f, plate }))}
                placeholder="Placas"
                placeholderTextColor={colors.textTertiary}
                style={styles.input}
              />
              <TextInput
                value={createForm.imei}
                onChangeText={(imei) => setCreateForm((f) => ({ ...f, imei }))}
                placeholder="IMEI (opcional)"
                placeholderTextColor={colors.textTertiary}
                style={styles.input}
              />
              <Pressable onPress={createUnit} disabled={busy} style={styles.primaryBtn}>
                {busy ? (
                  <ActivityIndicator color={colors.onBrand} />
                ) : (
                  <Text style={styles.primaryText}>GUARDAR UNIDAD</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {!!message && (
        <View style={[styles.toast, { bottom: insets.bottom + spacing.lg }]}>
          <MaterialCommunityIcons
            name={message.includes("correctamente") ? "check-circle" : "alert-circle"}
            size={16}
            color={message.includes("correctamente") ? colors.success : colors.warning}
          />
          <Text style={styles.toastText}>{message}</Text>
        </View>
      )}
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
  addBtn: {
    marginLeft: "auto",
    width: 32, height: 32, borderRadius: radius.md,
    backgroundColor: colors.brand, alignItems: "center", justifyContent: "center",
  },
  emptyBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.brand, borderRadius: radius.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, marginTop: spacing.lg,
  },
  emptyBtnText: { color: colors.onBrand, fontWeight: "800", fontSize: 12, letterSpacing: 1 },
  // Modal styles
  modalShade: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "flex-end" },
  modalCard: {
    maxHeight: "70%", backgroundColor: colors.surfaceSecondary,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border,
  },
  modalHead: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTitle: { color: colors.onSurface, fontFamily: MONO, fontSize: 13, fontWeight: "800", letterSpacing: 1 },
  modalBody: { padding: spacing.lg, gap: spacing.md },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    color: colors.onSurface, fontSize: 14,
  },
  primaryBtn: {
    flexDirection: "row", gap: spacing.sm, backgroundColor: colors.brand,
    borderRadius: radius.md, paddingVertical: spacing.md, alignItems: "center",
    minHeight: 48, justifyContent: "center",
  },
  primaryText: { color: colors.onBrand, fontWeight: "800", fontSize: 12, letterSpacing: 1 },
  toast: {
    position: "absolute", left: spacing.lg, right: spacing.lg,
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderStrong,
    borderRadius: radius.md, padding: spacing.md,
  },
  toastText: { color: colors.onSurface, fontSize: 13, fontWeight: "600", textAlign: "center", flex: 1 },
});
