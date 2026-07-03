import { useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { useDrive } from "@/src/context/DriveContext";
import { colors, spacing, radius, MONO, STATUS_COLORS, STATUS_LABELS } from "@/src/theme";
import RouteMap from "@/src/components/RouteMap";
import Button from "@/src/components/ui/Button";

export default function HUD() {
  const insets = useSafeAreaInsets();
  const {
    tripActive, starting, permissionDenied, webUnsupported, speed, location, status,
    deviationM, route, routeName, unitName, queueCount, reflection, panicActive,
    startTrip, stopTrip, triggerPanic, cancelPanic, toggleReflection, refreshUnit,
  } = useDrive();

  useEffect(() => { refreshUnit(); }, []);

  const deviated = status === "alerta" && deviationM > 400;
  const statusColor = STATUS_COLORS[status] || colors.offline;

  const instruction = deviated
    ? "⚠ REGRESE A LA RUTA AUTORIZADA"
    : tripActive
    ? "CONTINÚE EN RUTA · FED-85"
    : "VIAJE NO INICIADO";

  const onPanic = async () => {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    await triggerPanic();
  };

  return (
    <View style={[styles.root, reflection && styles.reflected]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <View>
            <Text style={styles.unitName} testID="hud-unit-name">{unitName}</Text>
            <Text style={[styles.statusLabel, { color: statusColor }]}>
              {STATUS_LABELS[status] || status.toUpperCase()}
            </Text>
          </View>
        </View>
        {queueCount > 0 && (
          <View style={styles.blackBoxChip} testID="blackbox-chip">
            <MaterialCommunityIcons name="database-clock" size={14} color={colors.warning} />
            <Text style={styles.blackBoxText}>{queueCount} en caja negra</Text>
          </View>
        )}
      </View>

      {/* Map */}
      <View style={styles.mapWrap}>
        <RouteMap route={route} location={location} deviation={deviated} />
        {!tripActive && (
          <View style={styles.assignedTripCard} testID="assigned-trip-card">
            <Text style={styles.assignedEyebrow}>VIAJE ASIGNADO POR MONITORISTA</Text>
            <Text style={styles.assignedTitle}>{routeName}</Text>
            <Text style={styles.assignedMeta}>{route.length} puntos de ruta · Unidad {unitName}</Text>
            <Button testID="assigned-start-button" onPress={startTrip} style={styles.assignedButton}>
              {starting ? <ActivityIndicator color={colors.onBrand} /> : (
                <>
                  <MaterialCommunityIcons name="play-circle" size={18} color={colors.onBrand} />
                  <Text style={styles.assignedButtonText}>INICIAR VIAJE</Text>
                </>
              )}
            </Button>
          </View>
        )}
        {deviated && (
          <View style={styles.deviationBanner} testID="deviation-banner">
            <MaterialCommunityIcons name="map-marker-alert" size={18} color={colors.onError} />
            <Text style={styles.deviationText}>DESVÍO DETECTADO · {Math.round(deviationM)} m</Text>
          </View>
        )}
      </View>

      {/* Telemetry + controls */}
      <View style={[styles.panel, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.speedRow}>
          <View>
            <Text style={styles.speedValue} testID="hud-speed">{speed}</Text>
            <Text style={styles.speedUnit}>KM/H</Text>
          </View>
          <View style={styles.instructionBox}>
            <MaterialCommunityIcons
              name={deviated ? "alert" : "arrow-up-bold"}
              size={20}
              color={deviated ? colors.error : colors.brand}
            />
            <Text style={[styles.instructionText, deviated && { color: colors.error }]}>{instruction}</Text>
          </View>
        </View>

        <View style={styles.controlsRow}>
          <Pressable
            testID="reflection-toggle"
            onPress={toggleReflection}
            style={[styles.ctrlBtn, reflection && styles.ctrlBtnActive]}
          >
            <MaterialCommunityIcons name="flip-vertical" size={20} color={reflection ? colors.surface : colors.onSurface} />
            <Text style={[styles.ctrlText, reflection && { color: colors.surface }]}>REFLEJO</Text>
          </Pressable>

          <Button onPress={tripActive ? stopTrip : startTrip} disabled={starting} style={[styles.tripBtn, tripActive ? styles.tripBtnStop : styles.tripBtnStart]}>
            {starting ? <ActivityIndicator color={colors.onBrand} /> : (tripActive ? "TERMINAR" : "INICIAR VIAJE")}
          </Button>

          <Button onPress={onPanic} style={styles.panicBtn}>
            <MaterialCommunityIcons name="shield-alert" size={18} color={colors.onError} />
            <Text style={styles.panicText}>PÁNICO</Text>
          </Button>
        </View>

        {permissionDenied && (
          <Text style={styles.warnText} testID="permission-warning">
            Permiso de ubicación denegado. Habilítalo en Ajustes para registrar el viaje.
          </Text>
        )}
        {webUnsupported && (
          <Text style={styles.infoText}>
            GPS y mapa en vivo funcionan en el dispositivo móvil (Android/iOS).
          </Text>
        )}
      </View>

      {/* Silent panic overlay (simulated screen-off) */}
      {panicActive && (
        <Pressable
          testID="panic-overlay"
          style={styles.panicOverlay}
          onLongPress={cancelPanic}
          delayLongPress={1500}
        >
          <Text style={styles.panicOverlayText}>●</Text>
          <Text style={styles.panicOverlayHint}>Alerta silenciosa enviada · mantén pulsado para salir</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  reflected: { transform: [{ scaleY: -1 }] },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingBottom: spacing.sm,
    backgroundColor: colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  unitName: { color: colors.onSurface, fontFamily: MONO, fontSize: 16, fontWeight: "700", letterSpacing: 1 },
  statusLabel: { fontFamily: MONO, fontSize: 10, letterSpacing: 1.5, marginTop: 1 },
  blackBoxChip: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: "rgba(255,184,0,0.12)",
    borderWidth: 1, borderColor: colors.warning, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: 4,
  },
  blackBoxText: { color: colors.warning, fontFamily: MONO, fontSize: 10 },
  mapWrap: { flex: 1.35, overflow: "hidden", backgroundColor: "#0a0a0a" },
  assignedTripCard: {
    position: "absolute", left: spacing.md, right: spacing.md, bottom: spacing.md,
    backgroundColor: "rgba(18,18,18,0.94)", borderWidth: 1, borderColor: colors.brand,
    borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs,
  },
  assignedEyebrow: { color: colors.brand, fontFamily: MONO, fontSize: 10, letterSpacing: 1.2 },
  assignedTitle: { color: colors.onSurface, fontSize: 17, fontWeight: "800" },
  assignedMeta: { color: colors.textSecondary, fontSize: 12 },
  assignedButton: {
    marginTop: spacing.sm, minHeight: 48, borderRadius: radius.md, backgroundColor: colors.brand,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
  },
  assignedButtonText: { color: colors.onBrand, fontWeight: "900", letterSpacing: 1 },
  deviationBanner: {
    position: "absolute", top: spacing.md, left: spacing.md, right: spacing.md,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    backgroundColor: colors.error, borderRadius: radius.md, paddingVertical: spacing.sm,
  },
  deviationText: { color: colors.onError, fontFamily: MONO, fontWeight: "700", fontSize: 13, letterSpacing: 1 },
  panel: {
    backgroundColor: colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: colors.border,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md,
  },
  speedRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  speedValue: { color: colors.onSurface, fontFamily: MONO, fontSize: 56, fontWeight: "800", lineHeight: 58 },
  speedUnit: { color: colors.textSecondary, fontFamily: MONO, fontSize: 12, letterSpacing: 3, marginTop: -4 },
  instructionBox: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md,
  },
  instructionText: { color: colors.onSurface, fontFamily: MONO, fontSize: 12, flex: 1, letterSpacing: 0.5 },
  controlsRow: { flexDirection: "row", gap: spacing.sm },
  ctrlBtn: {
    alignItems: "center", justifyContent: "center", gap: 2, backgroundColor: colors.surfaceTertiary,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: spacing.sm, width: 76,
  },
  ctrlBtnActive: { backgroundColor: colors.onSurface, borderColor: colors.onSurface },
  ctrlText: { color: colors.onSurface, fontFamily: MONO, fontSize: 9, letterSpacing: 1 },
  tripBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    borderRadius: radius.md, paddingVertical: spacing.md, minHeight: 52,
  },
  tripBtnStart: { backgroundColor: colors.brand },
  tripBtnStop: { backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.borderStrong },
  tripText: { color: colors.onBrand, fontWeight: "800", fontSize: 14, letterSpacing: 1 },
  panicBtn: {
    alignItems: "center", justifyContent: "center", gap: 2, backgroundColor: colors.error,
    borderRadius: radius.md, paddingVertical: spacing.sm, width: 76,
  },
  panicText: { color: colors.onError, fontFamily: MONO, fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  warnText: { color: colors.warning, fontSize: 12, textAlign: "center" },
  infoText: { color: colors.textTertiary, fontSize: 11, textAlign: "center" },
  panicOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "#000", alignItems: "center", justifyContent: "center", gap: 20 },
  panicOverlayText: { color: "#0a0a0a", fontSize: 14 },
  panicOverlayHint: { color: "#141414", fontSize: 11, position: "absolute", bottom: 40 },
});
