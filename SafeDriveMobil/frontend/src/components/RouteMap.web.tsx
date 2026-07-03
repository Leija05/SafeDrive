import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, spacing, MONO } from "@/src/theme";

type Props = {
  route: number[][];
  location: { lat: number; lng: number } | null;
  heading?: number;
  deviation?: boolean;
};

export default function RouteMap({ location }: Props) {
  return (
    <View style={styles.fallback} testID="map-web-fallback">
      <MaterialCommunityIcons name="map-marker-path" size={40} color={colors.brand} />
      <Text style={styles.fallbackTitle}>MAPA TÁCTICO</Text>
      <Text style={styles.fallbackText}>
        El mapa GPS en vivo y la ruta asignada se muestran en el dispositivo móvil (Android/iOS).
      </Text>
      {location && (
        <Text style={styles.coord}>
          {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0a0a0a",
    padding: spacing.xl,
    gap: spacing.sm,
  },
  fallbackTitle: { color: colors.onSurface, fontFamily: MONO, fontSize: 16, letterSpacing: 2, marginTop: spacing.sm },
  fallbackText: { color: colors.textSecondary, fontSize: 13, textAlign: "center", maxWidth: 280 },
  coord: { color: colors.brand, fontFamily: MONO, fontSize: 12, marginTop: spacing.sm },
});
