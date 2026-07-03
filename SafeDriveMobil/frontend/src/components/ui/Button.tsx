import React from "react";
import { Pressable, Text, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { colors, radius, spacing } from "@/src/theme";

export default function Button({ children, onPress, style, variant = "primary", disabled = false, ...props }: { children: React.ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; variant?: "primary" | "secondary"; disabled?: boolean; [key: string]: any }) {
  return (
    <Pressable {...props} onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.btn, variant === "secondary" ? styles.secondary : styles.primary, pressed && styles.pressed, disabled && styles.disabled, style]}>
      {typeof children === "string" ? (
        <Text style={[styles.text, variant === "secondary" ? styles.textSecondary : styles.textPrimary]}>{children}</Text>
      ) : (
        <Text style={[styles.text, variant === "secondary" ? styles.textSecondary : styles.textPrimary]}>{children}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },
  primary: {
    backgroundColor: colors.brand,
  },
  secondary: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  text: { fontWeight: "700", fontSize: 15 },
  textPrimary: { color: colors.onBrand },
  textSecondary: { color: colors.onSurface },
});
