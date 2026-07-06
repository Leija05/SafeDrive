import { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, ActivityIndicator, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { apiFetch } from "@/src/lib/api";
import { colors, spacing, radius, MONO } from "@/src/theme";
import { useDrive } from "@/src/context/DriveContext";

const QUICK_REPLIES = [
  { text: "Copiado", icon: "check-bold" },
  { text: "Tráfico detenido", icon: "car-brake-alert" },
  { text: "Retén militar", icon: "shield-account" },
  { text: "Llegando a caseta", icon: "boom-gate" },
  { text: "Sin novedad", icon: "thumb-up" },
  { text: "Necesito apoyo", icon: "lifebuoy" },
];

type Msg = { id: string; sender: string; text: string; quick?: boolean; created_at: string };

export default function Chat() {
  const insets = useSafeAreaInsets();
  const { speed, tripActive, status } = useDrive();
  const routeLocked = tripActive || status === "en_ruta" || speed > 0;
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    try {
      const m = await apiFetch<Msg[]>("/driver/chat");
      setMessages(m);
    } catch {}
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  const send = async (body: string, quick = true) => {
    if (sending) return;
    setSending(true);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const msg = await apiFetch<Msg>("/driver/chat", {
        method: "POST",
        body: JSON.stringify({ text: body, quick }),
      });
      setMessages((prev) => [...prev, msg]);
      if (!quick) setDraft("");
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch {}
    setSending(false);
  };

  const renderItem = ({ item }: { item: Msg }) => {
    const mine = item.sender === "driver";
    return (
      <View style={[styles.bubbleRow, mine ? styles.rowRight : styles.rowLeft]}>
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleBase]}>
          {!mine && (
            <View style={styles.senderRow}>
              <View style={styles.senderDot} />
              <Text style={styles.senderTag}>CENTRAL</Text>
            </View>
          )}
          <Text style={styles.bubbleText}>{item.text}</Text>
          <View style={styles.bubbleFooter}>
            <Text style={styles.bubbleTime}>
              {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
            {mine && <MaterialCommunityIcons name="check" size={12} color={colors.textTertiary} />}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerIconWrap}>
          <MaterialCommunityIcons name="radio-handheld" size={18} color={colors.brand} />
        </View>
        <Text style={styles.headerTitle}>CHAT SEGURO</Text>
        <View style={styles.headerSub}>
          <Text style={styles.headerSubText}>CENTRAL</Text>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <MaterialCommunityIcons name="forum-outline" size={40} color={colors.textTertiary} />
            </View>
            <Text style={styles.emptyText}>Sin mensajes aún</Text>
            <Text style={styles.emptyHint}>Usa un mensaje rápido para comunicarte con central</Text>
          </View>
        }
      />

      <View style={[styles.quickArea, { paddingBottom: insets.bottom + spacing.sm }]} testID="quick-reply-panel">
        <View style={[styles.lockBanner, routeLocked ? styles.lockBannerActive : styles.lockBannerInactive]}>
          <MaterialCommunityIcons
            name={routeLocked ? "keyboard-off" : "keyboard"}
            size={14}
            color={routeLocked ? colors.success : colors.brand}
          />
          <Text style={[styles.lockText, !routeLocked && { color: colors.brand }]}>
            {routeLocked ? "EN RUTA: SOLO RESPUESTAS RÁPIDAS" : "DETENIDO: TEXTO LIBRE HABILITADO"}
          </Text>
        </View>
        {!routeLocked && (
          <View style={styles.composer} testID="free-text-composer">
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Escribe a central..."
              placeholderTextColor={colors.textTertiary}
              style={styles.composerInput}
              multiline
            />
            <Pressable
              onPress={() => draft.trim() && send(draft.trim(), false)}
              style={[styles.sendButton, (!draft.trim() || sending) && { opacity: 0.5 }]}
            >
              {sending ? (
                <ActivityIndicator color={colors.onBrand} />
              ) : (
                <MaterialCommunityIcons name="send" size={18} color={colors.onBrand} />
              )}
            </Pressable>
          </View>
        )}
        <View style={styles.grid}>
          {QUICK_REPLIES.map((q) => (
            <Pressable key={q.text} onPress={() => send(q.text, true)} style={styles.chip}>
              <MaterialCommunityIcons name={q.icon as any} size={18} color={colors.brand} />
              <Text style={styles.chipText}>{q.text}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md, backgroundColor: colors.surfaceSecondary,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerIconWrap: {
    width: 32, height: 32, borderRadius: radius.md,
    backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center",
  },
  headerTitle: { color: colors.onSurface, fontFamily: MONO, fontSize: 14, letterSpacing: 2, fontWeight: "700" },
  headerSub: {
    marginLeft: "auto", backgroundColor: colors.surfaceTertiary,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  headerSubText: { color: colors.brand, fontFamily: MONO, fontSize: 9, letterSpacing: 1, fontWeight: "600" },
  listContent: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
  bubbleRow: { flexDirection: "row" },
  rowRight: { justifyContent: "flex-end" },
  rowLeft: { justifyContent: "flex-start" },
  bubble: { maxWidth: "82%", borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, gap: 2 },
  bubbleMine: { backgroundColor: colors.brandSecondary, borderColor: colors.brand },
  bubbleBase: { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
  senderRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2 },
  senderDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.warning },
  senderTag: { color: colors.warning, fontFamily: MONO, fontSize: 9, letterSpacing: 1, fontWeight: "700" },
  bubbleText: { color: colors.onSurface, fontSize: 14, lineHeight: 19 },
  bubbleFooter: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  bubbleTime: { color: colors.textSecondary, fontFamily: MONO, fontSize: 10 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingTop: spacing["3xl"] },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.sm,
  },
  emptyText: { color: colors.onSurface, fontSize: 16, fontWeight: "600" },
  emptyHint: { color: colors.textTertiary, fontSize: 13, textAlign: "center" },
  quickArea: {
    backgroundColor: colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: colors.border,
    paddingHorizontal: spacing.md, paddingTop: spacing.sm,
  },
  lockBanner: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md,
    justifyContent: "center", marginBottom: spacing.sm,
  },
  lockBannerActive: { backgroundColor: colors.successDim },
  lockBannerInactive: { backgroundColor: colors.brandTertiary },
  lockText: { color: colors.success, fontFamily: MONO, fontSize: 10, letterSpacing: 0.8, fontWeight: "600" },
  composer: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  composerInput: {
    flex: 1, minHeight: 48, maxHeight: 100,
    backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.borderStrong,
    borderRadius: radius.md, color: colors.onSurface, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    fontSize: 14,
  },
  sendButton: {
    width: 48, borderRadius: radius.md, backgroundColor: colors.brand,
    alignItems: "center", justifyContent: "center",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    flexBasis: "48%", flexGrow: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.borderStrong,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, minHeight: 52,
  },
  chipText: { color: colors.onSurface, fontSize: 14, fontWeight: "600", flex: 1 },
});
