import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, TextInput, Modal, ActivityIndicator,
  ScrollView, KeyboardAvoidingView, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { apiFetch } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing, radius, MONO } from "@/src/theme";

type UserRow = {
  id: string; email: string; name: string; role: string; phone?: string | null;
  unit?: { id?: string; name?: string; plate?: string; driver_phone?: string | null } | null;
};

type UnitOption = {
  id: string; name: string; plate: string; driver_id?: string | null;
};

const emptyForm = { name: "", email: "", password: "", phone: "", plate: "", role: "driver", unit_id: "" };
const emptyEdit = { name: "", email: "", password: "", phone: "", plate: "", role: "driver", unit_id: "", admin_password: "" };

function RoleSwitch({ value, onChange }: { value: string; onChange: (role: string) => void }) {
  return (
    <View style={styles.roleRow}>
      {["driver", "admin"].map((role) => (
        <Pressable
          key={role}
          onPress={() => onChange(role)}
          style={[styles.roleBtn, value === role && styles.roleBtnActive]}
        >
          <MaterialCommunityIcons
            name={role === "driver" ? "account-hard-hat" : "shield-account"}
            size={16}
            color={value === role ? colors.brand : colors.textTertiary}
          />
          <Text style={[styles.roleText, value === role && styles.roleTextActive]}>
            {role === "driver" ? "CONDUCTOR" : "MONITORISTA"}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function MonitorUsers() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
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
      const allUnits = await apiFetch<UnitOption[]>("/units/with-drivers");
      setUnits(allUnits);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

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
      const payload: any = { ...createForm, email: createForm.email.trim().toLowerCase() };
      if (!payload.unit_id) delete payload.unit_id;
      await apiFetch("/users", { method: "POST", body: JSON.stringify(payload) });
      setCreateForm(emptyForm);
      setCreateOpen(false);
      flash("Usuario creado correctamente");
      await load();
    } catch (e: any) {
      flash(e?.message || "No se pudo crear el usuario");
    }
    setBusy(false);
  };

  const allUnits = units;
  const unitOptions = allUnits.filter((u) => !u.driver_id || u.driver_id === selected?.id);

  const openUser = (u: UserRow) => {
    setSelected(u);
    setEditForm({
      name: u.name || "", email: u.email || "", password: "", phone: u.phone || u.unit?.driver_phone || "",
      plate: u.unit?.plate || "", role: u.role || "driver", unit_id: u.unit?.id || "", admin_password: "",
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
      delete payload.unit_id;
      const updated = await apiFetch<UserRow>(`/users/${selected.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      // Assign unit if changed
      if (editForm.unit_id && editForm.unit_id !== (selected.unit?.id || "")) {
        await apiFetch(`/users/${selected.id}/assign-unit`, {
          method: "PUT", body: JSON.stringify({ unit_id: editForm.unit_id })
        });
      }
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
      <View style={styles.userIconWrap}>
        <MaterialCommunityIcons
          name={item.role === "admin" ? "shield-account" : "account-hard-hat"}
          size={22}
          color={colors.brand}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.userName}>{item.name}</Text>
        <Text style={styles.userMeta}>{item.email} · {item.role === "admin" ? "Monitorista" : "Conductor"}</Text>
        {!!item.unit?.plate && (
          <View style={styles.userUnitTag}>
            <MaterialCommunityIcons name="truck" size={12} color={colors.textTertiary} />
            <Text style={styles.userUnitText}>{item.unit.name || "—"} · {item.unit.plate}</Text>
          </View>
        )}
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textTertiary} />
    </Pressable>
  );

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerIconWrap}>
          <MaterialCommunityIcons name="account-cog" size={18} color={colors.brand} />
        </View>
        <Text style={styles.headerTitle}>USUARIOS</Text>
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
            <Text style={styles.helperText}>
              Toca un registro para modificarlo. Crear usuarios solo disponible para monitoristas.
            </Text>
          </View>
        }
      />

      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <KeyboardAvoidingView style={styles.modalShade} behavior={keyboardBehavior}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>CREAR USUARIO</Text>
              <Pressable onPress={() => setCreateOpen(false)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.onSurface} />
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={[styles.modalBody, { paddingBottom: insets.bottom + spacing.xl }]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <RoleSwitch value={createForm.role} onChange={(role) => setCreateForm((f) => ({ ...f, role }))} />
              <TextInput value={createForm.name} onChangeText={(name) => setCreateForm((f) => ({ ...f, name }))} placeholder="Nombre completo" placeholderTextColor={colors.textTertiary} style={styles.input} />
              <TextInput value={createForm.email} onChangeText={(email) => setCreateForm((f) => ({ ...f, email }))} placeholder="correo@empresa.com" placeholderTextColor={colors.textTertiary} autoCapitalize="none" keyboardType="email-address" style={styles.input} />
              <TextInput value={createForm.password} onChangeText={(password) => setCreateForm((f) => ({ ...f, password }))} placeholder="Contraseña temporal" placeholderTextColor={colors.textTertiary} secureTextEntry style={styles.input} />
              <TextInput value={createForm.phone} onChangeText={(phone) => setCreateForm((f) => ({ ...f, phone }))} placeholder="Teléfono" placeholderTextColor={colors.textTertiary} keyboardType="phone-pad" style={styles.input} />
              {createForm.role === "driver" && (
                <>
                  <TextInput value={createForm.plate} onChangeText={(plate) => setCreateForm((f) => ({ ...f, plate }))} placeholder="Placas" placeholderTextColor={colors.textTertiary} style={styles.input} />
                  <View style={styles.pickerWrap}>
                    <Text style={styles.pickerLabel}>UNIDAD (OPCIONAL — {units.filter((u) => !u.driver_id).length} disponibles)</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll}>
                      <Pressable
                        onPress={() => setCreateForm((f) => ({ ...f, unit_id: "" }))}
                        style={[styles.pickerOption, !createForm.unit_id && styles.pickerOptionActive]}
                      >
                        <Text style={[styles.pickerOptionText, !createForm.unit_id && styles.pickerOptionTextActive]}>Auto-crear</Text>
                      </Pressable>
                      {units.map((u) => {
                        const libre = !u.driver_id;
                        return (
                          <Pressable
                            key={u.id}
                            onPress={() => libre && setCreateForm((f) => ({ ...f, unit_id: u.id }))}
                            style={[styles.pickerOption, createForm.unit_id === u.id && styles.pickerOptionActive, !libre && { opacity: 0.4 }]}
                          >
                            <Text style={[styles.pickerOptionText, createForm.unit_id === u.id && styles.pickerOptionTextActive]}>
                              {u.name} · {u.plate} {libre ? "(disp.)" : "(ocupado)"}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>

                  {/* Quick unit list showing availability */}
                  <View style={styles.unitGrid}>
                    <Text style={[styles.pickerLabel, { marginBottom: spacing.sm }]}>TODAS LAS UNIDADES</Text>
                    <View style={styles.pickerRow}>
                      {units.map((u) => {
                        const libre = !u.driver_id;
                        return (
                          <View key={u.id} style={[styles.unitChip, libre ? styles.unitChipFree : styles.unitChipBusy]}>
                            <Text style={[styles.unitChipText, libre ? { color: colors.success } : { color: colors.textTertiary }]}>
                              {u.name}
                            </Text>
                            {u.driver_name && (
                              <Text style={styles.unitChipDriver} numberOfLines={1}>{u.driver_name}</Text>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </>
              )}
              <Pressable onPress={createUser} disabled={busy} style={styles.primaryBtn}>
                {busy ? (
                  <ActivityIndicator color={colors.onBrand} />
                ) : (
                  <Text style={styles.primaryText}>GUARDAR USUARIO</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <KeyboardAvoidingView style={styles.modalShade} behavior={keyboardBehavior}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>DATOS DEL USUARIO</Text>
              <Pressable onPress={() => setSelected(null)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.onSurface} />
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={[styles.modalBody, { paddingBottom: insets.bottom + spacing.xl }]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <RoleSwitch value={editForm.role} onChange={(role) => setEditForm((f) => ({ ...f, role }))} />
              <TextInput value={editForm.name} onChangeText={(name) => setEditForm((f) => ({ ...f, name }))} placeholder="Nombre" placeholderTextColor={colors.textTertiary} style={styles.input} />
              <TextInput value={editForm.email} onChangeText={(email) => setEditForm((f) => ({ ...f, email }))} placeholder="Correo" placeholderTextColor={colors.textTertiary} autoCapitalize="none" keyboardType="email-address" style={styles.input} />
              <TextInput value={editForm.phone} onChangeText={(phone) => setEditForm((f) => ({ ...f, phone }))} placeholder="Teléfono" placeholderTextColor={colors.textTertiary} keyboardType="phone-pad" style={styles.input} />
              {editForm.role === "driver" && (
                <>
                  <TextInput value={editForm.plate} onChangeText={(plate) => setEditForm((f) => ({ ...f, plate }))} placeholder="Placas" placeholderTextColor={colors.textTertiary} style={styles.input} />
                  <View style={styles.pickerWrap}>
                    <Text style={styles.pickerLabel}>UNIDAD ASIGNADA</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll}>
                      {units.map((u) => {
                        const libre = !u.driver_id || u.driver_id === selected?.id;
                        return (
                          <Pressable
                            key={u.id}
                            onPress={() => libre && setEditForm((f) => ({ ...f, unit_id: u.id }))}
                            style={[styles.pickerOption, editForm.unit_id === u.id && styles.pickerOptionActive, !libre && { opacity: 0.4 }]}
                          >
                            <Text style={[styles.pickerOptionText, editForm.unit_id === u.id && styles.pickerOptionTextActive]}>
                              {u.name} · {u.plate}{libre ? (u.driver_id ? ' (asignado)' : ' (libre)') : ' (ocupado)'}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>

                  {/* Quick unit grid showing availability */}
                  <View style={styles.unitGrid}>
                    <Text style={[styles.pickerLabel, { marginBottom: spacing.sm }]}>ESTADO DE UNIDADES</Text>
                    <View style={styles.pickerRow}>
                      {units.map((u) => {
                        const libre = !u.driver_id || u.driver_id === selected?.id;
                        return (
                          <View key={u.id} style={[styles.unitChip, libre ? styles.unitChipFree : styles.unitChipBusy]}>
                            <Text style={[styles.unitChipText, libre ? { color: colors.success } : { color: colors.textTertiary }]}>
                              {u.name}
                            </Text>
                            {u.driver_name && (
                              <Text style={styles.unitChipDriver} numberOfLines={1}>{u.driver_name}</Text>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </>
              )}
              <TextInput value={editForm.password} onChangeText={(password) => setEditForm((f) => ({ ...f, password }))} placeholder="Nueva contraseña (opcional)" placeholderTextColor={colors.textTertiary} secureTextEntry style={styles.input} />
              <TextInput value={editForm.admin_password} onChangeText={(admin_password) => setEditForm((f) => ({ ...f, admin_password }))} placeholder="Contraseña del monitorista para confirmar" placeholderTextColor={colors.textTertiary} secureTextEntry style={[styles.input, styles.confirmInput]} />
              <Pressable onPress={saveUser} disabled={busy} style={styles.primaryBtn}>
                {busy ? (
                  <ActivityIndicator color={colors.onBrand} />
                ) : (
                  <Text style={styles.primaryText}>CONFIRMAR MODIFICACIÓN</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {!!message && (
        <View style={[styles.toast, { bottom: insets.bottom + spacing.lg }]}>
          <MaterialCommunityIcons name={message.includes("correctamente") ? "check-circle" : "alert-circle"} size={16} color={message.includes("correctamente") ? colors.success : colors.warning} />
          <Text style={styles.toastText}>{message}</Text>
        </View>
      )}
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
  list: { padding: spacing.lg, gap: spacing.sm },
  headerActions: {
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, marginBottom: spacing.lg,
  },
  helperText: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, textAlign: "center" },
  roleRow: { flexDirection: "row", gap: spacing.sm },
  roleBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: spacing.sm,
  },
  roleBtnActive: { borderColor: colors.brand, backgroundColor: colors.brandTertiary },
  roleText: { color: colors.textSecondary, fontFamily: MONO, fontSize: 10, fontWeight: "700" },
  roleTextActive: { color: colors.brand },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    color: colors.onSurface, fontSize: 14,
  },
  confirmInput: { borderColor: colors.warning },
  pickerWrap: { gap: spacing.sm },
  pickerLabel: { color: colors.textTertiary, fontFamily: MONO, fontSize: 10, letterSpacing: 1.8 },
  pickerScroll: { marginHorizontal: -spacing.lg, paddingHorizontal: spacing.lg },
  pickerRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  pickerOption: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  pickerOptionActive: { borderColor: colors.brand, backgroundColor: colors.brandTertiary },
  pickerOptionText: { color: colors.textSecondary, fontSize: 12, fontFamily: MONO },
  pickerOptionTextActive: { color: colors.brand },
  primaryBtn: {
    flexDirection: "row", gap: spacing.sm, backgroundColor: colors.brand,
    borderRadius: radius.md, paddingVertical: spacing.md, alignItems: "center",
    minHeight: 48, justifyContent: "center",
  },
  primaryText: { color: colors.onBrand, fontWeight: "800", fontSize: 12, letterSpacing: 1 },
  userCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.md,
  },
  userIconWrap: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center",
  },
  userName: { color: colors.onSurface, fontSize: 15, fontWeight: "800" },
  userMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 1 },
  userUnitTag: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  userUnitText: { color: colors.textTertiary, fontSize: 11 },
  modalShade: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "flex-end" },
  modalCard: {
    maxHeight: "88%", backgroundColor: colors.surfaceSecondary,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border,
  },
  modalHead: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTitle: { color: colors.onSurface, fontFamily: MONO, fontSize: 13, fontWeight: "800", letterSpacing: 1 },
  modalBody: { padding: spacing.lg, gap: spacing.md },
  toast: {
    position: "absolute", left: spacing.lg, right: spacing.lg,
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderStrong,
    borderRadius: radius.md, padding: spacing.md,
  },
  toastText: { color: colors.onSurface, fontSize: 13, fontWeight: "600", textAlign: "center", flex: 1 },
  unitGrid: { marginTop: spacing.sm },
  unitChip: {
    borderWidth: 1, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    minWidth: 60, alignItems: "center",
  },
  unitChipFree: { borderColor: colors.success, backgroundColor: colors.success + "15" },
  unitChipBusy: { borderColor: colors.border, backgroundColor: colors.surface },
  unitChipText: { fontFamily: MONO, fontSize: 9, fontWeight: "700" },
  unitChipDriver: { color: colors.textTertiary, fontSize: 8, marginTop: 1, maxWidth: 60 },
});
