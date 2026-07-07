import { useState } from "react";
import {
  View, Text, TextInput, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator, Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing, radius, MONO } from "@/src/theme";
import { ApiError } from "@/src/lib/api";
import Button from "@/src/components/ui/Button";

export default function TokenGate({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const { verifyDriverToken, driverToken, clearDriverToken } = useAuth();
  const [tokenInput, setTokenInput] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    const raw = tokenInput.trim();
    if (!raw) {
      setError("Ingresa tu token de activación");
      return;
    }
    setBusy(true);
    try {
      await verifyDriverToken(raw);
      onDone();
    } catch (e: any) {
      setError(e?.message || "Token inválido");
    } finally {
      setBusy(false);
    }
  };

  const clearExisting = async () => {
    await clearDriverToken();
    setTokenInput("");
    setError("");
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
            <MaterialCommunityIcons name="shield-key" size={32} color={colors.brand} />
          </View>
          <View>
            <Text style={styles.brand}>ACTIVACIÓN</Text>
            <Text style={styles.brandSub}>TOKEN DE CONDUCTOR</Text>
          </View>
        </View>

        <View style={styles.greetingSection}>
          <Text style={styles.title}>Token de acceso</Text>
          <Text style={styles.subtitle}>
            Ingresa el token único que recibiste al contratar el servicio.
            Este código vincula tu dispositivo con tu unidad.
          </Text>
        </View>

        {driverToken && (
          <View style={styles.existingTokenBox}>
            <View style={styles.existingTokenRow}>
              <MaterialCommunityIcons name="key" size={16} color={colors.warning} />
              <Text style={styles.existingTokenText} numberOfLines={1}>
                Token actual: {driverToken.slice(0, 16)}...
              </Text>
            </View>
            <Pressable onPress={clearExisting} style={styles.clearBtn}>
              <MaterialCommunityIcons name="close-circle" size={16} color={colors.error} />
              <Text style={styles.clearBtnText}>LIMPIAR</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.formCard}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>TOKEN DE ACTIVACIÓN</Text>
            <View style={styles.inputWrapper}>
              <MaterialCommunityIcons name="key-variant" size={18} color={colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                testID="driver-token-input"
                value={tokenInput}
                onChangeText={setTokenInput}
                placeholder="Ingresa tu token"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
            </View>
          </View>

          {!!error && (
            <View style={styles.errorBox} testID="token-error">
              <MaterialCommunityIcons name="alert-circle-outline" size={16} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Button onPress={submit} style={styles.submitBtn}>
            {busy ? (
              <ActivityIndicator color={colors.onBrand} />
            ) : (
              <>
                <MaterialCommunityIcons name="check-circle" size={20} color={colors.onBrand} />
                <Text style={styles.submitBtnText}>ACTIVAR DISPOSITIVO</Text>
              </>
            )}
          </Button>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            ¿No tienes token? Contacta a tu administrador
          </Text>
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
  existingTokenBox: {
    backgroundColor: colors.warningDim,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  existingTokenRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  existingTokenText: {
    color: colors.onSurface,
    fontSize: 12,
    fontFamily: MONO,
    flex: 1,
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  clearBtnText: {
    color: colors.error,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
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
  footer: {
    alignItems: "center",
    marginTop: spacing["2xl"],
  },
  footerText: {
    color: colors.textTertiary,
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 1,
    textAlign: "center",
  },
});

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
  footer: {
    alignItems: "center",
    marginTop: spacing["2xl"],
  },
  footerText: {
    color: colors.textTertiary,
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 1,
    textAlign: "center",
  },
});
