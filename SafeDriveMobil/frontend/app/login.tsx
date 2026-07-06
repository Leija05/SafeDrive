import { useState } from "react";
import {
  View, Text, TextInput, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator, Pressable,
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
  const [showPassword, setShowPassword] = useState(false);

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
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + spacing["2xl"],
            paddingBottom: insets.bottom + spacing.xl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandSection}>
          <View style={styles.logoBox}>
            <MaterialCommunityIcons name="shield-car" size={32} color={colors.brand} />
          </View>
          <View>
            <Text style={styles.brand}>SAFEDRIVE</Text>
            <Text style={styles.brandSub}>OPERADOR EN CARRETERA</Text>
          </View>
        </View>

        <View style={styles.greetingSection}>
          <Text style={styles.title}>Bienvenido</Text>
          <Text style={styles.subtitle}>
            Acceso exclusivo para conductores registrados. Ingresa tus credenciales para comenzar tu ruta.
          </Text>
        </View>

        {conflict && (
          <View style={styles.conflictBox} testID="session-conflict-banner">
            <MaterialCommunityIcons name="cellphone-lock" size={18} color={colors.error} />
            <Text style={styles.conflictText}>
              Tu sesión fue iniciada en otro dispositivo. Vuelve a iniciar sesión.
            </Text>
          </View>
        )}

        <View style={styles.formCard}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>CORREO ELECTRÓNICO</Text>
            <View style={styles.inputWrapper}>
              <MaterialCommunityIcons name="email-outline" size={18} color={colors.textTertiary} style={styles.inputIcon} />
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
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>CONTRASEÑA</Text>
            <View style={styles.inputWrapper}>
              <MaterialCommunityIcons name="lock-outline" size={18} color={colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                testID="password-input"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.textTertiary}
                secureTextEntry={!showPassword}
                style={styles.input}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <MaterialCommunityIcons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color={colors.textTertiary}
                />
              </Pressable>
            </View>
          </View>

          {!!error && (
            <View style={styles.errorBox} testID="login-error">
              <MaterialCommunityIcons name="alert-circle-outline" size={16} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Button onPress={submit} style={styles.submitBtn}>
            {busy ? (
              <ActivityIndicator color={colors.onBrand} />
            ) : (
              <>
                <MaterialCommunityIcons name="arrow-right-circle" size={20} color={colors.onBrand} />
                <Text style={styles.submitBtnText}>ENTRAR A LA RUTA</Text>
              </>
            )}
          </Button>
        </View>

        <View style={styles.footer}>
          <View style={styles.statusIndicator}>
            <View style={styles.dot} />
            <View style={styles.dotPulse} />
          </View>
          <Text style={styles.footerText}>SafeDrive Enforcer Activo</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface },
  scroll: { paddingHorizontal: spacing.xl },
  brandSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    marginBottom: spacing["2xl"],
  },
  logoBox: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: {
    color: colors.onSurface,
    fontFamily: MONO,
    fontSize: 22,
    letterSpacing: 4,
    fontWeight: "700",
  },
  brandSub: {
    color: colors.brand,
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 2.5,
    marginTop: 3,
  },
  greetingSection: { marginBottom: spacing.xl },
  title: {
    color: colors.onSurface,
    fontSize: 28,
    fontWeight: "800",
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  formCard: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.xl,
  },
  inputGroup: { gap: spacing.sm },
  label: {
    color: colors.textTertiary,
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 1.8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  inputIcon: { paddingLeft: spacing.md },
  input: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.onSurface,
    fontSize: 15,
  },
  eyeBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.errorDim,
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: { color: colors.error, fontSize: 13, fontWeight: "600", flex: 1 },
  submitBtn: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  submitBtnText: {
    color: colors.onBrand,
    fontWeight: "900",
    fontSize: 14,
    letterSpacing: 1.5,
  },
  conflictBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.errorDim,
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  conflictText: {
    color: colors.onSurface,
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing["2xl"],
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  dotPulse: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.successDim,
  },
  footerText: {
    color: colors.textTertiary,
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 1,
  },
});
