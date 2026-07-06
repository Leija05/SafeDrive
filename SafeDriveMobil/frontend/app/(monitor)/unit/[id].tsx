import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Linking, Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { apiFetch } from "@/src/lib/api";
import { colors, spacing, radius, MONO, STATUS_COLORS, STATUS_LABELS } from "@/src/theme";
import RouteMap from "@/src/components/RouteMap";
import MapPointPicker from "@/src/components/MapPointPicker";

type RouteDef = { id: string; name: string; points: number[][] };

function InfoTile({ label, value, icon, color }: { label: string; value: string; icon?: any; color?: string }) {
  return (
    <View style={[styles.tile, color && { borderLeftColor: color, borderLeftWidth: 3 }]}>
      {icon && <MaterialCommunityIcons name={icon} size={16} color={color || colors.textTertiary} />}
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>{value}</Text>
    </View>
  );
}

export default function UnitDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [unit, setUnit] = useState<any>(null);
  const [routes, setRoutes] = useState<RouteDef[]>([]);
  const [routeForm, setRouteForm] = useState({ start: "", destination: "", tolerance: "400" });
  const [customModal, setCustomModal] = useState(false);
  const [pickMode, setPickMode] = useState<"origin" | "destination">("origin");
  const [assigning, setAssigning] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const keyboardBehavior = Platform.OS === "ios" ? "padding" : "height";

  const load = useCallback(async () => {
    try {
      const u = await apiFetch(`/units/${id}`);
      setUnit(u);
    } catch { }
  }, [id]);

  useEffect(() => {
    load();
    apiFetch<{ routes: RouteDef[] }>("/routes").then((r) => setRoutes(r.routes)).catch(() => { });
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2500);
  };

  const assignPredefined = async (r: RouteDef) => {
    setAssigning(r.id);
    try {
      const u = await apiFetch(`/units/${id}/route`, { method: "POST", body: JSON.stringify({ route_id: r.id }) });
      setUnit(u);
      flash(`Ruta asignada: ${r.name}`);
    } catch (e: any) {
      flash(e?.message || "Error al asignar");
    }
    setAssigning(null);
  };

  const assignShortest = async () => {
    const origin = routeForm.start.trim();
    const destination = routeForm.destination.trim();
    if (!origin || !destination) {
      flash("Ingresa dirección o coordenadas de origen y destino");
      return;
    }
    setAssigning("shortest");
    try {
      const parsePoint = (value: string) => {
        const [lat, lng] = value.split(",").map(Number);
        return [lat, lng];
      };
      const u = await apiFetch(`/units/${id}/route`, {
        method: "POST",
        body: JSON.stringify({
          origin: parsePoint(origin),
          destination: parsePoint(destination),
          tolerance_m: Number(routeForm.tolerance) || 400,
          name: "Ruta personalizada origen-destino",
        }),
      });
      setUnit(u);
      setCustomModal(false);
      flash(`Ruta asignada con tolerancia ${u.route_tolerance_m || routeForm.tolerance}m`);
    } catch (e: any) {
      flash(e?.message || "Error al asignar ruta personalizada");
    }
    setAssigning(null);
  };

  if (!unit) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.brand} size="large" />
        <Text style={styles.loadingText}>Cargando unidad...</Text>
      </View>
    );
  }

  const color = STATUS_COLORS[unit.status] || colors.offline;
  const last = unit.track && unit.track.length ? unit.track[unit.track.length - 1] : null;
  const location = last ? { lat: last.lat, lng: last.lng } : (unit.lat ? { lat: unit.lat, lng: unit.lng } : null);
  const deviated = unit.status === "alerta" && unit.deviation_m > 400;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={keyboardBehavior}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="back-button" onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>{unit.name}</Text>
        <View style={[styles.statusBadge, { borderColor: color }]}>
          <View style={[styles.badgeDot, { backgroundColor: color }]} />
          <Text style={[styles.statusBadgeText, { color }]}>{STATUS_LABELS[unit.status] || unit.status}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing["3xl"] }} keyboardShouldPersistTaps="handled">
        <View style={styles.mapBox}>
          <RouteMap route={unit.assigned_route || []} location={location} deviation={deviated} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DATOS DE LA UNIDAD</Text>
          <View style={styles.tileGrid}>
            <InfoTile icon="account" label="CONDUCTOR" value={unit.driver_name} />
            <InfoTile icon="phone" label="TELÉFONO" value={unit.driver_phone || "—"} color={unit.driver_phone ? colors.success : undefined} />
            <InfoTile icon="card-text" label="PLACAS" value={unit.plate} />
            <InfoTile icon="ruler" label="TOLERANCIA" value={`${Math.round(unit.route_tolerance_m || 400)} m`} />
            <InfoTile icon="speedometer" label="VELOCIDAD" value={`${Math.round(unit.speed)} km/h`} />
            <InfoTile icon="map-marker-distance" label="DESVÍO" value={`${Math.round(unit.deviation_m)} m`} color={deviated ? colors.error : undefined} />
          </View>

          {!!unit.driver_phone && (
            <Pressable style={styles.callBtn} onPress={() => Linking.openURL(`tel:${unit.driver_phone}`)}>
              <MaterialCommunityIcons name="phone" size={18} color={colors.onBrand} />
              <Text style={styles.callText}>LLAMAR AL CONDUCTOR</Text>
            </Pressable>
          )}

          <View style={styles.currentRoute}>
            <View style={styles.routeIconWrap}>
              <MaterialCommunityIcons name="map-marker-path" size={18} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>Ruta asignada</Text>
              <Text style={styles.routeValue}>{unit.route_name || "Sin ruta asignada"}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitleOutside}>RUTAS PREDEFINIDAS</Text>
        <View style={styles.routesWrap}>
          {routes.map((r) => {
            const active = unit.route_name === r.name;
            return (
              <Pressable
                key={r.id}
                testID={`route-option-${r.id}`}
                onPress={() => assignPredefined(r)}
                disabled={!!assigning}
                style={[styles.routeCard, active && styles.routeCardActive]}
              >
                <View style={[styles.radioOuter, active && styles.radioOuterActive]}>
                  {active && <View style={styles.radioInner} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.routeName}>{r.name}</Text>
                  <Text style={styles.routePoints}>{r.points.length} puntos de ruta</Text>
                </View>
                {assigning === r.id && <ActivityIndicator color={colors.brand} size="small" />}
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitleOutside}>RUTA PERSONALIZADA</Text>
        <View style={styles.manualBox}>
          <Pressable onPress={() => setCustomModal(true)} style={styles.manualBtn}>
            <MaterialCommunityIcons name="plus-circle" size={18} color={colors.onBrand} />
            <Text style={styles.manualBtnText}>AGREGAR RUTA PERSONALIZADA</Text>
          </Pressable>
          <Text style={styles.helperText}>
            Ingresa dirección de origen y destino o selecciona puntos desde el mapa.
          </Text>
        </View>
      </ScrollView>

      <Modal visible={customModal} transparent animationType="slide" onRequestClose={() => setCustomModal(false)}>
        <KeyboardAvoidingView style={styles.modalShade} behavior={keyboardBehavior}>
          <View style={[styles.modalCard, { maxHeight: Platform.OS === "web" ? "88%" : "92%" }]}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>RUTA PERSONALIZADA</Text>
              <Pressable onPress={() => setCustomModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.onSurface} />
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={[styles.modalBody, { paddingBottom: insets.bottom + spacing.xl }]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.helperText}>
                Escribe direcciones o mueve el mapa. El pin central marca la ubicación seleccionada.
              </Text>
              <TextInput
                value={routeForm.start}
                onChangeText={(start) => setRouteForm((f) => ({ ...f, start }))}
                placeholder="Dirección de origen"
                placeholderTextColor={colors.textTertiary}
                style={styles.input}
              />
              <TextInput
                value={routeForm.destination}
                onChangeText={(destination) => setRouteForm((f) => ({ ...f, destination }))}
                placeholder="Dirección de destino"
                placeholderTextColor={colors.textTertiary}
                style={styles.input}
              />
              <View style={styles.modeRow}>
                <Pressable
                  onPress={() => setPickMode("origin")}
                  style={[styles.modeBtn, pickMode === "origin" && styles.modeBtnActive]}
                >
                  <MaterialCommunityIcons name="map-marker" size={16} color={pickMode === "origin" ? colors.brand : colors.textTertiary} />
                  <Text style={[styles.modeText, pickMode === "origin" && styles.modeTextActive]}>ORIGEN</Text>
                </Pressable>
                <Pressable
                  onPress={() => setPickMode("destination")}
                  style={[styles.modeBtn, pickMode === "destination" && styles.modeBtnActive]}
                >
                  <MaterialCommunityIcons name="map-marker-check" size={16} color={pickMode === "destination" ? colors.brand : colors.textTertiary} />
                  <Text style={[styles.modeText, pickMode === "destination" && styles.modeTextActive]}>DESTINO</Text>
                </Pressable>
              </View>
              <MapPointPicker
                initial={location}
                onChange={(point) => {
                  const value = `${point.lat},${point.lng}`;
                  setRouteForm((f) => pickMode === "origin" ? { ...f, start: value } : { ...f, destination: value });
                }}
              />
              <TextInput
                value={routeForm.tolerance}
                onChangeText={(tolerance) => setRouteForm((f) => ({ ...f, tolerance }))}
                placeholder="Tolerancia en metros"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
                style={styles.input}
              />
              <Pressable onPress={assignShortest} disabled={!!assigning} style={styles.manualBtn}>
                {assigning === "shortest" ? (
                  <ActivityIndicator color={colors.onBrand} />
                ) : (
                  <Text style={styles.manualBtnText}>GUARDAR RUTA PERSONALIZADA</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {!!toast && (
        <View style={[styles.toast, { bottom: insets.bottom + spacing.lg }]} testID="toast">
          <MaterialCommunityIcons name="check-circle" size={16} color={colors.success} />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  loading: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", gap: spacing.md },
  loadingText: { color: colors.textSecondary, fontFamily: MONO, fontSize: 12, letterSpacing: 1 },
  header: {
    flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md, backgroundColor: colors.surfaceSecondary,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.onSurface, fontFamily: MONO, fontSize: 18, fontWeight: "700", letterSpacing: 1, flex: 1 },
  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  statusBadgeText: { fontFamily: MONO, fontSize: 9, letterSpacing: 1, fontWeight: "700" },
  mapBox: { height: 240, backgroundColor: "#0a0a0a", overflow: "hidden" },
  section: { padding: spacing.lg, gap: spacing.md },
  sectionTitle: { color: colors.textTertiary, fontFamily: MONO, fontSize: 10, letterSpacing: 1.5, marginBottom: spacing.sm },
  sectionTitleOutside: {
    color: colors.textTertiary, fontFamily: MONO, fontSize: 10, letterSpacing: 1.5,
    paddingHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.sm,
  },
  tileGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tile: {
    width: "48%", flexGrow: 1, backgroundColor: colors.surfaceSecondary,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md, gap: 2, minWidth: 140,
  },
  tileLabel: { color: colors.textTertiary, fontFamily: MONO, fontSize: 9, letterSpacing: 1 },
  tileValue: { color: colors.onSurface, fontSize: 15, fontWeight: "600", marginTop: 1 },
  callBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    backgroundColor: colors.success, borderRadius: radius.md, paddingVertical: spacing.md, minHeight: 50,
  },
  callText: { color: colors.onBrand, fontWeight: "800", fontSize: 13, letterSpacing: 1.5 },
  currentRoute: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.brandTertiary,
    borderRadius: radius.md, padding: spacing.md,
  },
  routeIconWrap: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.brandGlow, alignItems: "center", justifyContent: "center",
  },
  routeLabel: { color: colors.textTertiary, fontSize: 10, letterSpacing: 0.5 },
  routeValue: { color: colors.onSurface, fontSize: 14, fontWeight: "600", marginTop: 1 },
  routesWrap: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  routeCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md,
  },
  routeCardActive: { borderColor: colors.success },
  radioOuter: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    borderColor: colors.textTertiary, alignItems: "center", justifyContent: "center",
  },
  radioOuterActive: { borderColor: colors.success },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.success },
  routeName: { color: colors.onSurface, fontSize: 14, fontWeight: "600" },
  routePoints: { color: colors.textTertiary, fontFamily: MONO, fontSize: 11, marginTop: 1 },
  manualBox: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontSize: 14,
  },
  helperText: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  modalShade: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border,
  },
  modalHead: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTitle: { color: colors.onSurface, fontFamily: MONO, fontSize: 13, fontWeight: "800", letterSpacing: 1 },
  modalBody: { padding: spacing.lg, gap: spacing.md },
  modeRow: { flexDirection: "row", gap: spacing.sm },
  modeBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: spacing.sm,
  },
  modeBtnActive: { borderColor: colors.brand, backgroundColor: colors.brandTertiary },
  modeText: { color: colors.textSecondary, fontFamily: MONO, fontSize: 11, fontWeight: "800" },
  modeTextActive: { color: colors.brand },
  manualBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: spacing.md, minHeight: 50,
  },
  manualBtnText: { color: colors.onBrand, fontWeight: "800", fontSize: 13, letterSpacing: 1 },
  toast: {
    position: "absolute", left: spacing.lg, right: spacing.lg,
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderStrong,
    borderRadius: radius.md, padding: spacing.md,
  },
  toastText: { color: colors.onSurface, fontSize: 13, fontWeight: "600", textAlign: "center", flex: 1 },
});
