import { useEffect, useRef, useState, useCallback } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, FlatList,
  KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { apiFetch } from "@/src/lib/api";
import { colors, spacing, radius, MONO, STATUS_COLORS } from "@/src/theme";

const QUICK = ["Recibido", "Reporta posición", "Detente con precaución", "Continúa la ruta", "Llama a base"];

type Unit = { id: string; name: string; driver_name: string; status: string };
type Msg = { id: string; sender: string; text: string; created_at: string };

export default function MonitorChat() {
  const insets = useSafeAreaInsets();
  const [units, setUnits] = useState<Unit[]>([]);
  const [active, setActive] = useState<Unit | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    apiFetch<Unit[]>("/units").then((u) => {
      setUnits(u);
      if (u.length && !active) setActive(u[0]);
    }).catch(() => {});
  }, []);

  const loadMsgs = useCallback(async () => {
    if (!active) return;
    try {
      const m = await apiFetch<Msg[]>(`/units/${active.id}/chat`);
      setMessages(m);
    } catch {}
  }, [active]);

  useEffect(() => {
    loadMsgs();
    const t = setInterval(loadMsgs, 4000);
    return () => clearInterval(t);
  }, [loadMsgs]);

  const send = async (body: string) => {
    const value = body.trim();
    if (!value || !active) return;
    setText("");
    try {
      const msg = await apiFetch<Msg>(`/units/${active.id}/chat`, {
        method: "POST",
        body: JSON.stringify({ text: value, quick: false }),
      });
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch {}
  };

  const renderItem = ({ item }: { item: Msg }) => {
    const base = item.sender === "base";
    return (
      <View style={[styles.bubbleRow, base ? styles.rowRight : styles.rowLeft]}>
        <View style={[styles.bubble, base ? styles.bubbleBase : styles.bubbleUnit]}>
          {!base && (
            <View style={styles.senderRow}>
              <View style={styles.senderDot} />
              <Text style={styles.senderTag}>{active?.name || "UNIDAD"}</Text>
            </View>
          )}
          <Text style={styles.bubbleText}>{item.text}</Text>
          <View style={styles.bubbleFooter}>
            <Text style={styles.bubbleTime}>
              {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
            {base && <MaterialCommunityIcons name="check" size={12} color={colors.textTertiary} />}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerIconWrap}>
          <MaterialCommunityIcons name="forum" size={18} color={colors.brand} />
        </View>
        <Text style={styles.headerTitle}>CHAT CON UNIDADES</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.unitTabs} contentContainerStyle={styles.unitTabsContent}>
        {units.map((u) => {
          const sel = active?.id === u.id;
          const color = STATUS_COLORS[u.status] || colors.offline;
          return (
            <Pressable
              key={u.id}
              testID={`chat-unit-${u.id}`}
              onPress={() => setActive(u)}
              style={[styles.unitChip, sel && styles.unitChipActive]}
            >
              <View style={[styles.dot, { backgroundColor: color }]} />
              <Text style={[styles.unitChipText, sel && { color: colors.onSurface }]}>{u.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Sin mensajes con esta unidad.</Text>
          </View>
        }
      />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.inputArea, { paddingBottom: insets.bottom + spacing.sm }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
            {QUICK.map((q) => (
              <Pressable key={q} testID={`monitor-quick-${q}`} onPress={() => send(q)} style={styles.quickChip}>
                <Text style={styles.quickChipText}>{q}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.composer}>
            <TextInput
              testID="monitor-chat-input"
              value={text}
              onChangeText={setText}
              placeholder="Mensaje a la unidad..."
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
              multiline
            />
            <Pressable testID="monitor-chat-send" onPress={() => send(text)} style={styles.sendBtn}>
              <MaterialCommunityIcons name="send" size={20} color={colors.onBrand} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
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
  unitTabs: { maxHeight: 56, backgroundColor: colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: colors.border },
  unitTabsContent: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, alignItems: "center" },
  unitChip: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.surfaceTertiary,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.md, height: 36, flexShrink: 0,
  },
  unitChipActive: { borderColor: colors.brand, backgroundColor: colors.brandTertiary },
  dot: { width: 8, height: 8, borderRadius: 4 },
  unitChipText: { color: colors.textSecondary, fontFamily: MONO, fontSize: 12, fontWeight: "600" },
  listContent: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
  bubbleRow: { flexDirection: "row" },
  rowRight: { justifyContent: "flex-end" },
  rowLeft: { justifyContent: "flex-start" },
  bubble: { maxWidth: "82%", borderRadius: radius.lg, padding: spacing.md, borderWidth: 1 },
  bubbleBase: { backgroundColor: colors.brandSecondary, borderColor: colors.brand },
  bubbleUnit: { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
  senderRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2 },
  senderDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.warning },
  senderTag: { color: colors.warning, fontFamily: MONO, fontSize: 9, letterSpacing: 1, fontWeight: "700" },
  bubbleText: { color: colors.onSurface, fontSize: 14, lineHeight: 19 },
  bubbleFooter: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  bubbleTime: { color: colors.textSecondary, fontFamily: MONO, fontSize: 10 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: spacing["3xl"] },
  emptyText: { color: colors.textTertiary, fontSize: 13 },
  inputArea: { backgroundColor: colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  quickRow: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  quickChip: {
    backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.borderStrong,
    borderRadius: radius.pill, paddingHorizontal: spacing.md, height: 34, justifyContent: "center", flexShrink: 0,
  },
  quickChipText: { color: colors.onSurface, fontSize: 12, fontWeight: "600" },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, paddingHorizontal: spacing.md },
  input: {
    flex: 1, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.onSurface,
    fontSize: 15, maxHeight: 120, minHeight: 46,
  },
  sendBtn: { backgroundColor: colors.brand, borderRadius: radius.md, width: 48, height: 46, alignItems: "center", justifyContent: "center" },
});
