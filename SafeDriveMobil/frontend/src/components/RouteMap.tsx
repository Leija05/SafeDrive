import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { colors } from "@/src/theme";

type Props = {
  route: number[][];
  location: { lat: number; lng: number } | null;
  heading?: number;
  deviation?: boolean;
};

const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#0a0a0a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0a0a0a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#6b6b6b" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1a1a1d" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#272729" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

export default function RouteMap({ route, location, deviation }: Props) {
  const coords = (route || []).map((p) => ({ latitude: p[0], longitude: p[1] }));
  const center = location
    ? { latitude: location.lat, longitude: location.lng }
    : coords[0] || { latitude: 25.6866, longitude: -100.3161 };

  return (
    <MapView
      testID="route-map"
      provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
      style={StyleSheet.absoluteFill}
      customMapStyle={DARK_MAP_STYLE}
      initialRegion={{ ...center, latitudeDelta: 0.4, longitudeDelta: 0.4 }}
      showsCompass={false}
      toolbarEnabled={false}
    >
      {coords.length > 1 && (
        <Polyline coordinates={coords} strokeColor={deviation ? colors.error : colors.brand} strokeWidth={5} />
      )}
      {coords.length > 0 && (
        <Marker coordinate={coords[coords.length - 1]} pinColor={colors.success} title="Destino" />
      )}
      {location && (
        <Marker coordinate={{ latitude: location.lat, longitude: location.lng }} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={[styles.unitDot, deviation && { borderColor: colors.error }]}>
            <View style={[styles.unitCore, deviation && { backgroundColor: colors.error }]} />
          </View>
        </Marker>
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
  unitDot: {
    width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.brand,
    alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,122,255,0.2)",
  },
  unitCore: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.brand },
});
