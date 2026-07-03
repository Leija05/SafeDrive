import { useState } from "react";
import {
  View, Text, TextInput, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing, radius, MONO } from "@/src/theme";
import Button from "@/src/components/ui/Button";

export default function Login() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token, login, conflict } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (token) return <Redirect href="/" />;

  const submit = async () => {
    setError("");
    if (!email.trim() || !password) {
      setError("Ingresa correo y contraseña");
      return;
    }
    setBusy(true);
    try {
      await login(email, password);
      router.replace("/");
    } catch (e: any) {
      setError(e?.message || "No se pudo iniciar sesión");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing["2xl"], paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandRow}>
          <View style={styles.logoBox}>
            <MaterialCommunityIcons name="shield-car" size={28} color={colors.brand} />
          </View>
          <View>
            <Text style={styles.brand}>SAFEDRIVE</Text>
            <Text style={styles.brandSub}>OPERADOR EN CARRETERA</Text>
          </View>
        </View>

        <Text style={styles.title}>Iniciar sesión</Text>
        <Text style={styles.subtitle}>
          Acceso exclusivo para conductores dados de alta por el monitorista. No se permite crear cuentas desde la app móvil.
        </Text>

        {conflict && (
          <View style={styles.conflictBox} testID="session-conflict-banner">
            <MaterialCommunityIcons name="cellphone-lock" size={18} color={colors.error} />
            <Text style={styles.conflictText}>
              Tu sesión fue iniciada en otro dispositivo. Vuelve a iniciar sesión.
            </Text>
          </View>
        )}

        <Text style={styles.label}>CORREO</Text>
        <TextInput
          testID="email-input"
          value={email}
          onChangeText={setEmail}
          placeholder="conductor@safedrive.mx"
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />

        <Text style={styles.label}>CONTRASEÑA</Text>
        <TextInput
          testID="password-input"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor={colors.textTertiary}
          secureTextEntry
          style={styles.input}
        />

        {!!error && (
          <View style={styles.errorBox} testID="login-error">
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Button onPress={submit} style={{ marginTop: spacing.xl }}>
          {busy ? <ActivityIndicator color={colors.onBrand} /> : "ENTRAR A LA RUTA"}
        </Button>

        <View style={styles.footer}>
          <View style={styles.dot} />
          <Text style={styles.footerText}>SafeDrive Enforcer Activo</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface },
  scroll: { paddingHorizontal: spacing.xl, gap: spacing.sm },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.xl },
  logoBox: {
    width: 48, height: 48, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary,
    borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center",
  },
  brand: { color: colors.onSurface, fontFamily: MONO, fontSize: 20, letterSpacing: 3, fontWeight: "700" },
  brandSub: { color: colors.brand, fontFamily: MONO, fontSize: 10, letterSpacing: 2, marginTop: 2 },
  title: { color: colors.onSurface, fontSize: 26, fontWeight: "800", marginTop: spacing.md },
  subtitle: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: spacing.md },
  label: { color: colors.textSecondary, fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, marginTop: spacing.md, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    color: colors.onSurface, fontSize: 16,
  },
  conflictBox: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: "rgba(255,42,42,0.12)",
    borderWidth: 1, borderColor: colors.error, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md,
  },
  conflictText: { color: colors.onSurface, fontSize: 12, flex: 1, lineHeight: 17 },
  errorBox: { backgroundColor: "rgba(255,42,42,0.12)", borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  errorText: { color: colors.error, fontSize: 13, fontWeight: "600" },
  primaryBtn: {
    backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: spacing.lg,
    alignItems: "center", justifyContent: "center", marginTop: spacing.xl, minHeight: 52,
  },
  primaryBtnText: { color: colors.onBrand, fontWeight: "800", fontSize: 15, letterSpacing: 1 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.md },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  footerText: { color: colors.textTertiary, fontFamily: MONO, fontSize: 11, letterSpacing: 1 },
});
