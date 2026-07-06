import React from "react";
import { Pressable, Text, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { colors, radius, spacing, MONO } from "@/src/theme";

export default function Button({
  children,
  onPress,
  style,
  variant = "primary",
  disabled = false,
  ...props
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  [key: string]: any;
}) {
  return (
    <Pressable
      {...props}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        variant === "primary" && styles.primary,
        variant === "secondary" && styles.secondary,
        variant === "ghost" && styles.ghost,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {typeof children === "string" ? (
        <Text
          style={[
            styles.text,
            variant === "primary" && styles.textPrimary,
            variant === "secondary" && styles.textSecondary,
            variant === "ghost" && styles.textGhost,
          ]}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
    flexDirection: "row",
    gap: spacing.sm,
  },
  primary: { backgroundColor: colors.brand },
  secondary: {
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  ghost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.45 },
  text: { fontWeight: "800", fontSize: 14, letterSpacing: 0.8, fontFamily: MONO },
  textPrimary: { color: colors.onBrand },
  textSecondary: { color: colors.onSurface },
  textGhost: { color: colors.textSecondary },
});
