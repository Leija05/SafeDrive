import { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { apiFetch } from "@/src/lib/api";
import { colors, spacing, radius, MONO } from "@/src/theme";
import Button from "@/src/components/ui/Button";
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
          {!mine && <Text style={styles.senderTag}>CENTRAL</Text>}
          <Text style={styles.bubbleText}>{item.text}</Text>
          <Text style={styles.bubbleTime}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <MaterialCommunityIcons name="radio-handheld" size={20} color={colors.brand} />
        <Text style={styles.headerTitle}>CHAT SEGURO · CENTRAL</Text>
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
            <Text style={styles.emptyText}>Sin mensajes. Usa un mensaje rápido abajo.</Text>
          </View>
        }
      />

      <View style={[styles.quickArea, { paddingBottom: insets.bottom + spacing.sm }]} testID="quick-reply-panel">
        <View style={styles.lockBanner}>
          <MaterialCommunityIcons name={routeLocked ? "keyboard-off" : "keyboard"} size={14} color={routeLocked ? colors.success : colors.brand} />
          <Text style={[styles.lockText, !routeLocked && { color: colors.brand }]}>
            {routeLocked ? "EN RUTA: SOLO RESPUESTAS PREDETERMINADAS" : "DETENIDO: TEXTO LIBRE HABILITADO"}
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
            />
            <Button onPress={() => draft.trim() && send(draft.trim(), false)} style={[styles.sendButton, (!draft.trim() || sending) && { opacity: 0.5 }]}>
              {sending ? <ActivityIndicator color={colors.onBrand} /> : <MaterialCommunityIcons name="send" size={18} color={colors.onBrand} />}
            </Button>
          </View>
        )}
        <View style={styles.grid}>
          {QUICK_REPLIES.map((q) => (
            <Button key={q.text} onPress={() => send(q.text, true)} style={styles.chip}>
              <MaterialCommunityIcons name={q.icon as any} size={18} color={colors.onSurface} />
              <Text style={styles.chipText}>{q.text}</Text>
            </Button>
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
    paddingBottom: spacing.sm, backgroundColor: colors.surfaceSecondary,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { color: colors.onSurface, fontFamily: MONO, fontSize: 13, letterSpacing: 1.5 },
  listContent: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
  bubbleRow: { flexDirection: "row" },
  rowRight: { justifyContent: "flex-end" },
  rowLeft: { justifyContent: "flex-start" },
  bubble: { maxWidth: "82%", borderRadius: radius.lg, padding: spacing.md, borderWidth: 1 },
  bubbleMine: { backgroundColor: colors.brandSecondary, borderColor: colors.brand },
  bubbleBase: { backgroundColor: colors.surfaceTertiary, borderColor: colors.border },
  senderTag: { color: colors.warning, fontFamily: MONO, fontSize: 9, letterSpacing: 1, marginBottom: 2 },
  bubbleText: { color: colors.onSurface, fontSize: 14, lineHeight: 19 },
  bubbleTime: { color: colors.textSecondary, fontFamily: MONO, fontSize: 10, marginTop: 4, alignSelf: "flex-end" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: spacing["3xl"] },
  emptyText: { color: colors.textTertiary, fontSize: 13 },
  quickArea: {
    backgroundColor: colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: colors.border,
    paddingHorizontal: spacing.md, paddingTop: spacing.sm,
  },
  lockBanner: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingBottom: spacing.sm, justifyContent: "center" },
  lockText: { color: colors.success, fontFamily: MONO, fontSize: 10, letterSpacing: 0.5 },
  composer: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  composerInput: { flex: 1, minHeight: 46, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, color: colors.onSurface, paddingHorizontal: spacing.md },
  sendButton: { width: 48, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    flexBasis: "48%", flexGrow: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.borderStrong,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, minHeight: 56,
  },
  chipPressed: { backgroundColor: colors.brandTertiary, borderColor: colors.brand },
  chipText: { color: colors.onSurface, fontSize: 14, fontWeight: "600", flex: 1 },
});
