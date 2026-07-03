import React, { useState } from "react";
import { View, StyleSheet, Text } from "react-native";
import MapView, { PROVIDER_GOOGLE, Region } from "react-native-maps";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, MONO } from "@/src/theme";

type Point = { lat: number; lng: number };

type Props = {
  initial?: Point | null;
  onChange: (point: Point) => void;
};

export default function MapPointPicker({ initial, onChange }: Props) {
  const [region, setRegion] = useState<Region>({
    latitude: initial?.lat ?? 27.4763,
    longitude: initial?.lng ?? -99.5164,
    latitudeDelta: 0.03,
    longitudeDelta: 0.03,
  });

  const onRegionChangeComplete = (next: Region) => {
    setRegion(next);
    onChange({ lat: next.latitude, lng: next.longitude });
  };

  return (
    <View style={styles.wrap}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        onRegionChangeComplete={onRegionChangeComplete}
        showsCompass={false}
        toolbarEnabled={false}
      />
      <View pointerEvents="none" style={styles.pinWrap}>
        <MaterialCommunityIcons name="map-marker" size={44} color={colors.error} />
        <View style={styles.pinDot} />
      </View>
      <View style={styles.coordBox} pointerEvents="none">
        <Text style={styles.coordText}>{region.latitude.toFixed(5)}, {region.longitude.toFixed(5)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 260, borderRadius: 14, overflow: "hidden", backgroundColor: "#0a0a0a" },
  pinWrap: { position: "absolute", left: 0, right: 0, top: 0, bottom: 18, alignItems: "center", justifyContent: "center" },
  pinDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.onSurface, marginTop: -14 },
  coordBox: { position: "absolute", left: 12, right: 12, bottom: 12, alignItems: "center" },
  coordText: { color: colors.onSurface, backgroundColor: "rgba(0,0,0,0.72)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, fontFamily: MONO, fontSize: 11 },
});
