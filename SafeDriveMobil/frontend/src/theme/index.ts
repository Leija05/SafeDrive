import { Platform } from "react-native";

export const colors = {
  surface: "#07080A",
  onSurface: "#F8FAFC",
  surfaceSecondary: "#0F1720",
  onSurfaceSecondary: "#E6EEF6",
  surfaceTertiary: "#0B1220",
  onSurfaceTertiary: "#CBD5E1",
  brand: "#06B6D4", // teal-400
  onBrand: "#04263A",
  brandSecondary: "#0891B2",
  brandTertiary: "rgba(6,182,212,0.14)",
  onError: "#FFFFFF",
  surfaceInverse: "#FFFFFF",
  onSurfaceInverse: "#050505",
  success: "#00E676",
  warning: "#FFB800",
  error: "#FF2A2A",
  offline: "#52525B",
  border: "#27272A",
  borderStrong: "#3F3F46",
  divider: "#1F1F22",
  textSecondary: "#A1A1AA",
  textTertiary: "#71717A",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32, "3xl": 48 };
export const radius = { sm: 2, md: 4, lg: 8, pill: 999 };

export const MONO = Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }) as string;

export const STATUS_COLORS: Record<string, string> = {
  en_ruta: colors.success,
  detenido: colors.offline,
  alerta: colors.error,
  offline: colors.offline,
  cruce_fiscal: colors.warning,
};

export const STATUS_LABELS: Record<string, string> = {
  en_ruta: "EN RUTA",
  detenido: "DETENIDO",
  alerta: "ALERTA",
  offline: "SIN SEÑAL",
  cruce_fiscal: "CRUCE FISCAL",
};
