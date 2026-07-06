import { Platform } from "react-native";

export const colors = {
  surface: "#07080A",
  onSurface: "#F8FAFC",
  surfaceSecondary: "#0F1720",
  onSurfaceSecondary: "#E6EEF6",
  surfaceTertiary: "#0B1220",
  onSurfaceTertiary: "#CBD5E1",
  surfaceElevated: "#141C2C",
  brand: "#06B6D4",
  onBrand: "#04263A",
  brandSecondary: "#0891B2",
  brandTertiary: "rgba(6,182,212,0.14)",
  brandGlow: "rgba(6,182,212,0.2)",
  onError: "#FFFFFF",
  surfaceInverse: "#FFFFFF",
  onSurfaceInverse: "#050505",
  success: "#00E676",
  successDim: "rgba(0,230,118,0.12)",
  warning: "#FFB800",
  warningDim: "rgba(255,184,0,0.12)",
  error: "#FF2A2A",
  errorDim: "rgba(255,42,42,0.12)",
  offline: "#52525B",
  offlineDim: "rgba(82,82,91,0.12)",
  border: "#27272A",
  borderStrong: "#3F3F46",
  divider: "#1F1F22",
  textSecondary: "#A1A1AA",
  textTertiary: "#71717A",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, "2xl": 28, "3xl": 40 };
export const radius = { sm: 4, md: 8, lg: 12, xl: 16, pill: 999 };

export const MONO = Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }) as string;

export const SANS = Platform.select({
  ios: "System",
  android: "Roboto",
  default: "sans-serif",
}) as string;

export const animation = {
  fast: 150,
  medium: 300,
  slow: 500,
};

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
