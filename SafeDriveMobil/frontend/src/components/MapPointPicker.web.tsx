import React, { useState } from "react";
import { View, StyleSheet, Text, Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, spacing, MONO } from "@/src/theme";

type Point = { lat: number; lng: number };
type Props = { initial?: Point | null; onChange: (point: Point) => void };

export default function MapPointPicker({ initial, onChange }: Props) {
  const [point, setPoint] = useState<Point>(initial || { lat: 27.4763, lng: -99.5164 });
  const nudge = (latDelta: number, lngDelta: number) => {
    const next = { lat: point.lat + latDelta, lng: point.lng + lngDelta };
    setPoint(next);
    onChange(next);
  };
  return (
    <View style={styles.wrap}>
      <MaterialCommunityIcons name="map-marker" size={48} color={colors.error} />
      <Text style={styles.title}>Selector de mapa</Text>
      <Text style={styles.text}>En web se simula el punto central. En iOS/Android puedes mover el mapa bajo el pin.</Text>
      <Text style={styles.coord}>{point.lat.toFixed(5)}, {point.lng.toFixed(5)}</Text>
      <View style={styles.row}>
        <Pressable onPress={() => nudge(0.002, 0)} style={styles.btn}><Text style={styles.btnText}>N</Text></Pressable>
        <Pressable onPress={() => nudge(0, -0.002)} style={styles.btn}><Text style={styles.btnText}>O</Text></Pressable>
        <Pressable onPress={() => nudge(0, 0.002)} style={styles.btn}><Text style={styles.btnText}>E</Text></Pressable>
        <Pressable onPress={() => nudge(-0.002, 0)} style={styles.btn}><Text style={styles.btnText}>S</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 260, borderRadius: 14, backgroundColor: "#0a0a0a", alignItems: "center", justifyContent: "center", padding: spacing.lg, gap: spacing.sm },
  title: { color: colors.onSurface, fontFamily: MONO, fontSize: 14, letterSpacing: 1 },
  text: { color: colors.textSecondary, fontSize: 12, textAlign: "center" },
  coord: { color: colors.brand, fontFamily: MONO, fontSize: 12 },
  row: { flexDirection: "row", gap: spacing.sm },
  btn: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  btnText: { color: colors.onSurface, fontWeight: "800" },
});
