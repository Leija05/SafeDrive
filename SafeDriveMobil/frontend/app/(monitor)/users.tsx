import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, Modal, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { apiFetch } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing, radius, MONO } from "@/src/theme";

type UserRow = {
  id: string; email: string; name: string; role: string; phone?: string | null;
  unit?: { name?: string; plate?: string; driver_phone?: string | null } | null;
};

const emptyForm = { name: "", email: "", password: "", phone: "", plate: "", role: "driver" };
const emptyEdit = { name: "", email: "", password: "", phone: "", plate: "", role: "driver", admin_password: "" };

export default function MonitorUsers() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [createForm, setCreateForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyEdit);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const keyboardBehavior = Platform.OS === "ios" ? "padding" : "height";
  const canCreateUsers = user?.role === "admin";

  const load = useCallback(async () => {
    try {
      setUsers(await apiFetch<UserRow[]>("/users"));
    } catch {}
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (m: string) => {
    setMessage(m);
    setTimeout(() => setMessage(""), 3000);
  };

  const createUser = async () => {
    if (!createForm.name.trim() || !createForm.email.trim() || !createForm.password.trim()) {
      flash("Nombre, correo y contraseña son obligatorios");
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/users", { method: "POST", body: JSON.stringify({ ...createForm, email: createForm.email.trim().toLowerCase() }) });
      setCreateForm(emptyForm);
      setCreateOpen(false);
      flash("Usuario creado correctamente");
      await load();
    } catch (e: any) {
      flash(e?.message || "No se pudo crear el usuario");
    }
    setBusy(false);
  };

  const openUser = (u: UserRow) => {
    setSelected(u);
    setEditForm({
      name: u.name || "", email: u.email || "", password: "", phone: u.phone || u.unit?.driver_phone || "",
      plate: u.unit?.plate || "", role: u.role || "driver", admin_password: "",
    });
  };

  const saveUser = async () => {
    if (!selected) return;
    if (!editForm.admin_password) {
      flash("Confirma con tu contraseña de monitorista");
      return;
    }
    setBusy(true);
    try {
      const payload: any = { ...editForm, email: editForm.email.trim().toLowerCase() };
      if (!payload.password) delete payload.password;
      const updated = await apiFetch<UserRow>(`/users/${selected.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      setSelected(updated);
      flash("Usuario actualizado");
      await load();
    } catch (e: any) {
      flash(e?.message || "No se pudo actualizar");
    }
    setBusy(false);
  };

  const renderUser = ({ item }: { item: UserRow }) => (
    <Pressable onPress={() => openUser(item)} style={styles.userCard}>
      <MaterialCommunityIcons name={item.role === "admin" ? "shield-account" : "account-hard-hat"} size={22} color={colors.brand} />
      <View style={{ flex: 1 }}>
        <Text style={styles.userName}>{item.name}</Text>
        <Text style={styles.userMeta}>{item.email} · {item.role === "admin" ? "Monitorista" : "Conductor"}</Text>
        {!!item.unit?.plate && <Text style={styles.userMeta}>Unidad {item.unit?.name || "—"} · {item.unit.plate}</Text>}
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textTertiary} />
    </Pressable>
  );

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <MaterialCommunityIcons name="account-cog" size={20} color={colors.brand} />
        <Text style={styles.headerTitle}>USUARIOS · ADMINISTRACIÓN</Text>
      </View>
      <FlatList
        data={users}
        keyExtractor={(u) => u.id}
        renderItem={renderUser}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.xl }]}
        ListHeaderComponent={
          <View style={styles.headerActions}>
            {canCreateUsers && (
              <Pressable onPress={() => setCreateOpen(true)} style={styles.primaryBtn}>
                <MaterialCommunityIcons name="account-plus" size={18} color={colors.onBrand} />
                <Text style={styles.primaryText}>CREAR USUARIO</Text>
              </Pressable>
            )}
            <Text style={styles.helperText}>Lista de usuarios: toca un registro para modificarlo. Crear usuarios solo está disponible para monitoristas.</Text>
          </View>
        }
      />

      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <KeyboardAvoidingView style={styles.modalShade} behavior={keyboardBehavior}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>CREAR NUEVO USUARIO</Text>
              <Pressable onPress={() => setCreateOpen(false)}><MaterialCommunityIcons name="close" size={24} color={colors.onSurface} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={[styles.modalBody, { paddingBottom: insets.bottom + spacing.xl }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <RoleSwitch value={createForm.role} onChange={(role) => setCreateForm((f) => ({ ...f, role }))} />
              <TextInput value={createForm.name} onChangeText={(name) => setCreateForm((f) => ({ ...f, name }))} placeholder="Nombre completo" placeholderTextColor={colors.textTertiary} style={styles.input} />
              <TextInput value={createForm.email} onChangeText={(email) => setCreateForm((f) => ({ ...f, email }))} placeholder="correo@empresa.com" placeholderTextColor={colors.textTertiary} autoCapitalize="none" keyboardType="email-address" style={styles.input} />
              <TextInput value={createForm.password} onChangeText={(password) => setCreateForm((f) => ({ ...f, password }))} placeholder="Contraseña temporal" placeholderTextColor={colors.textTertiary} secureTextEntry style={styles.input} />
              <TextInput value={createForm.phone} onChangeText={(phone) => setCreateForm((f) => ({ ...f, phone }))} placeholder="Teléfono" placeholderTextColor={colors.textTertiary} keyboardType="phone-pad" style={styles.input} />
              {createForm.role === "driver" && <TextInput value={createForm.plate} onChangeText={(plate) => setCreateForm((f) => ({ ...f, plate }))} placeholder="Placas" placeholderTextColor={colors.textTertiary} style={styles.input} />}
              <Pressable onPress={createUser} disabled={busy} style={styles.primaryBtn}>{busy ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.primaryText}>GUARDAR USUARIO</Text>}</Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <KeyboardAvoidingView style={styles.modalShade} behavior={keyboardBehavior}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>DATOS DEL USUARIO</Text>
              <Pressable onPress={() => setSelected(null)}><MaterialCommunityIcons name="close" size={24} color={colors.onSurface} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={[styles.modalBody, { paddingBottom: insets.bottom + spacing.xl }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <RoleSwitch value={editForm.role} onChange={(role) => setEditForm((f) => ({ ...f, role }))} />
              <TextInput value={editForm.name} onChangeText={(name) => setEditForm((f) => ({ ...f, name }))} placeholder="Nombre" placeholderTextColor={colors.textTertiary} style={styles.input} />
              <TextInput value={editForm.email} onChangeText={(email) => setEditForm((f) => ({ ...f, email }))} placeholder="Correo" placeholderTextColor={colors.textTertiary} autoCapitalize="none" keyboardType="email-address" style={styles.input} />
              <TextInput value={editForm.phone} onChangeText={(phone) => setEditForm((f) => ({ ...f, phone }))} placeholder="Teléfono" placeholderTextColor={colors.textTertiary} keyboardType="phone-pad" style={styles.input} />
              {editForm.role === "driver" && <TextInput value={editForm.plate} onChangeText={(plate) => setEditForm((f) => ({ ...f, plate }))} placeholder="Placas" placeholderTextColor={colors.textTertiary} style={styles.input} />}
              <TextInput value={editForm.password} onChangeText={(password) => setEditForm((f) => ({ ...f, password }))} placeholder="Nueva contraseña (opcional)" placeholderTextColor={colors.textTertiary} secureTextEntry style={styles.input} />
              <TextInput value={editForm.admin_password} onChangeText={(admin_password) => setEditForm((f) => ({ ...f, admin_password }))} placeholder="Contraseña del monitorista para confirmar" placeholderTextColor={colors.textTertiary} secureTextEntry style={[styles.input, styles.confirmInput]} />
              <Pressable onPress={saveUser} disabled={busy} style={styles.primaryBtn}>{busy ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.primaryText}>CONFIRMAR MODIFICACIÓN</Text>}</Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {!!message && <View style={[styles.toast, { bottom: insets.bottom + spacing.lg }]}><Text style={styles.toastText}>{message}</Text></View>}
    </View>
  );
}

function RoleSwitch({ value, onChange }: { value: string; onChange: (role: string) => void }) {
  return <View style={styles.roleRow}>{["driver", "admin"].map((role) => <Pressable key={role} onPress={() => onChange(role)} style={[styles.roleBtn, value === role && styles.roleBtnActive]}><Text style={[styles.roleText, value === role && styles.roleTextActive]}>{role === "driver" ? "CONDUCTOR" : "MONITORISTA"}</Text></Pressable>)}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, backgroundColor: colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { color: colors.onSurface, fontFamily: MONO, fontSize: 13, letterSpacing: 1.5 },
  list: { padding: spacing.lg, gap: spacing.sm },
  headerActions: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, marginBottom: spacing.lg },
  helperText: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, textAlign: "center" },
  roleRow: { flexDirection: "row", gap: spacing.sm },
  roleBtn: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: spacing.sm, alignItems: "center" },
  roleBtnActive: { borderColor: colors.brand, backgroundColor: "rgba(0,122,255,0.12)" },
  roleText: { color: colors.textSecondary, fontFamily: MONO, fontSize: 10, fontWeight: "700" },
  roleTextActive: { color: colors.brand },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md, color: colors.onSurface, fontSize: 14 },
  confirmInput: { borderColor: colors.warning },
  primaryBtn: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.brand, borderRadius: radius.sm, paddingVertical: spacing.md, alignItems: "center", minHeight: 46, justifyContent: "center" },
  primaryText: { color: colors.onBrand, fontWeight: "800", fontSize: 12, letterSpacing: 1 },
  userCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  userName: { color: colors.onSurface, fontSize: 15, fontWeight: "800" },
  userMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  modalShade: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "flex-end" },
  modalCard: { maxHeight: "88%", backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  modalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { color: colors.onSurface, fontFamily: MONO, fontSize: 13, fontWeight: "800", letterSpacing: 1 },
  modalBody: { padding: spacing.lg, gap: spacing.sm },
  toast: { position: "absolute", left: spacing.lg, right: spacing.lg, backgroundColor: colors.surfaceInverse, borderRadius: radius.md, padding: spacing.md },
  toastText: { color: colors.onSurfaceInverse, textAlign: "center", fontWeight: "700" },
});
