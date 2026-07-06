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

      <View style={styles.mapWrap}>
        <RouteMap route={route} location={location} deviation={deviated} />
        {!tripActive && (
          <View style={styles.assignedTripCard} testID="assigned-trip-card">
            <Text style={styles.assignedEyebrow}>VIAJE ASIGNADO</Text>
            <Text style={styles.assignedTitle}>{routeName}</Text>
            <Text style={styles.assignedMeta}>{route.length} puntos · Unidad {unitName}</Text>
            <Button testID="assigned-start-button" onPress={startTrip} style={styles.assignedButton}>
              {starting ? (
                <ActivityIndicator color={colors.onBrand} />
              ) : (
                <>
                  <MaterialCommunityIcons name="play-circle" size={20} color={colors.onBrand} />
                  <Text style={styles.assignedButtonText}>INICIAR VIAJE</Text>
                </>
              )}
            </Button>
          </View>
        )}
        {deviated && (
          <View style={styles.deviationBanner} testID="deviation-banner">
            <MaterialCommunityIcons name="map-marker-alert" size={18} color={colors.onError} />
            <Text style={styles.deviationText}>DESVÍO · {Math.round(deviationM)} m</Text>
          </View>
        )}
      </View>

      <View style={[styles.panel, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.speedRow}>
          <View style={styles.speedSection}>
            <Text style={styles.speedValue} testID="hud-speed">{speed}</Text>
            <Text style={styles.speedUnit}>KM/H</Text>
          </View>
          <View style={[styles.instructionBox, deviated && styles.instructionBoxError]}>
            <MaterialCommunityIcons
              name={deviated ? "alert" : "arrow-up-bold"}
              size={22}
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

          <Button
            onPress={tripActive ? stopTrip : startTrip}
            disabled={starting}
            style={[styles.tripBtn, tripActive ? styles.tripBtnStop : styles.tripBtnStart]}
          >
            {starting ? (
              <ActivityIndicator color={colors.onBrand} />
            ) : (
              <>
                <MaterialCommunityIcons
                  name={tripActive ? "stop-circle" : "play-circle"}
                  size={20}
                  color={tripActive ? colors.onSurface : colors.onBrand}
                />
                <Text style={[styles.tripText, tripActive && { color: colors.onSurface }]}>
                  {tripActive ? "TERMINAR" : "INICIAR"}
                </Text>
              </>
            )}
          </Button>

          <Pressable onPress={onPanic} style={styles.panicBtn}>
            <MaterialCommunityIcons name="shield-alert" size={20} color={colors.onError} />
            <Text style={styles.panicText}>PÁNICO</Text>
          </Pressable>
        </View>

        {permissionDenied && (
          <View style={styles.warningBox}>
            <MaterialCommunityIcons name="map-marker-off" size={16} color={colors.warning} />
            <Text style={styles.warnText}>Permiso de ubicación denegado. Habilítalo en Ajustes.</Text>
          </View>
        )}
        {webUnsupported && (
          <Text style={styles.infoText}>
            GPS y mapa en vivo funcionan en el dispositivo móvil (Android/iOS).
          </Text>
        )}
      </View>

      {panicActive && (
        <Pressable
          testID="panic-overlay"
          style={styles.panicOverlay}
          onLongPress={cancelPanic}
          delayLongPress={1500}
        >
          <View style={styles.panicIndicator}>
            <View style={styles.panicPulse1} />
            <View style={styles.panicPulse2} />
            <MaterialCommunityIcons name="shield-alert" size={48} color={colors.error} />
          </View>
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
    flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.warningDim,
    borderWidth: 1, borderColor: colors.warning, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: 4,
  },
  blackBoxText: { color: colors.warning, fontFamily: MONO, fontSize: 10, fontWeight: "600" },
  mapWrap: { flex: 1.35, overflow: "hidden", backgroundColor: "#0a0a0a" },
  assignedTripCard: {
    position: "absolute", left: spacing.md, right: spacing.md, bottom: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1, borderColor: colors.brand,
    borderRadius: radius.lg, padding: spacing.lg, gap: spacing.xs,
  },
  assignedEyebrow: { color: colors.brand, fontFamily: MONO, fontSize: 10, letterSpacing: 1.2, fontWeight: "700" },
  assignedTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "800" },
  assignedMeta: { color: colors.textSecondary, fontSize: 12 },
  assignedButton: {
    marginTop: spacing.sm, minHeight: 50, borderRadius: radius.md, backgroundColor: colors.brand,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
  },
  assignedButtonText: { color: colors.onBrand, fontWeight: "900", letterSpacing: 1, fontSize: 13 },
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
  speedSection: { alignItems: "center" },
  speedRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  speedValue: { color: colors.onSurface, fontFamily: MONO, fontSize: 60, fontWeight: "800", lineHeight: 62 },
  speedUnit: { color: colors.textSecondary, fontFamily: MONO, fontSize: 11, letterSpacing: 4, marginTop: -2 },
  instructionBox: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.md, minHeight: 60,
  },
  instructionBoxError: { borderColor: colors.error, backgroundColor: colors.errorDim },
  instructionText: { color: colors.onSurface, fontFamily: MONO, fontSize: 11, flex: 1, letterSpacing: 0.5, lineHeight: 16 },
  controlsRow: { flexDirection: "row", gap: spacing.sm },
  ctrlBtn: {
    alignItems: "center", justifyContent: "center", gap: 2, backgroundColor: colors.surfaceTertiary,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: spacing.sm, width: 76,
  },
  ctrlBtnActive: { backgroundColor: colors.onSurface, borderColor: colors.onSurface },
  ctrlText: { color: colors.onSurface, fontFamily: MONO, fontSize: 9, letterSpacing: 1, fontWeight: "700" },
  tripBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    borderRadius: radius.md, paddingVertical: spacing.md, minHeight: 54,
  },
  tripBtnStart: { backgroundColor: colors.brand },
  tripBtnStop: { backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.borderStrong },
  tripText: { color: colors.onBrand, fontWeight: "800", fontSize: 14, letterSpacing: 1 },
  panicBtn: {
    alignItems: "center", justifyContent: "center", gap: 2, backgroundColor: colors.error,
    borderRadius: radius.md, paddingVertical: spacing.sm, width: 76,
  },
  panicText: { color: colors.onError, fontFamily: MONO, fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  warningBox: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.warningDim, borderWidth: 1, borderColor: colors.warning,
    borderRadius: radius.md, padding: spacing.sm,
  },
  warnText: { color: colors.warning, fontSize: 12, flex: 1 },
  infoText: { color: colors.textTertiary, fontSize: 11, textAlign: "center" },
  panicOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "#000", alignItems: "center", justifyContent: "center", gap: 40 },
  panicIndicator: { position: "relative", alignItems: "center", justifyContent: "center" },
  panicPulse1: {
    position: "absolute", width: 100, height: 100, borderRadius: 50,
    borderWidth: 2, borderColor: "rgba(255,42,42,0.3)",
  },
  panicPulse2: {
    position: "absolute", width: 70, height: 70, borderRadius: 35,
    borderWidth: 2, borderColor: "rgba(255,42,42,0.15)",
  },
  panicOverlayHint: { color: "#252525", fontSize: 12, position: "absolute", bottom: 60, letterSpacing: 0.5 },
});
