import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import adminService from "../../services/adminService";

const ROLE_LABEL = "Platform Administrator";
const NOTICE_MS = 3000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const getInitials = (name = "") => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "AD";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
};

const validate = ({ name, email, phone, password }) => {
  const errors = {};
  if (!name.trim()) errors.name = "Full name is required.";
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) errors.email = "Enter a valid email address.";
  if (!/^\+?[\d\s-]{7,18}$/.test(phone.trim())) errors.phone = "Enter a valid phone number.";
  if (password && password.length < 6) {
    errors.password = "Password must be at least 6 characters.";
  }
  return errors;
};

const getApiError = (err, fallback) => err?.response?.data?.message || fallback;

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------
const IconButton = ({ icon, onPress, label }) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
  >
    <MaterialCommunityIcons name={icon} size={22} color={COLORS.textPrimary} />
  </Pressable>
);

const InfoRow = ({ icon, label, value, tone, last, onPress, d, iconSize = 18 }) => {
  const color = tone === "success" ? COLORS.success : COLORS.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.infoRow, d.infoRow, !last && styles.infoRowDivider, pressed && styles.pressed]}
    >
      <View style={[styles.infoIcon, d.infoIcon, tone === "success" && styles.infoIconSuccess]}>
        <MaterialCommunityIcons name={icon} size={iconSize} color={color} />
      </View>
      <View style={styles.infoText}>
        <Text style={[styles.infoLabel, d.infoLabel]}>{label}</Text>
        <Text style={[styles.infoValue, d.infoValue, tone === "success" && { color: COLORS.success }]} numberOfLines={1}>
          {value}
        </Text>
      </View>
      {onPress && <MaterialCommunityIcons name="chevron-right" size={iconSize} color={COLORS.disabledText} />}
    </Pressable>
  );
};

const Field = ({ label, icon, error, right, ...inputProps }) => (
  <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <View style={[styles.inputWrap, !!error && styles.inputWrapError]}>
      <MaterialCommunityIcons
        name={icon}
        size={20}
        color={error ? COLORS.error : COLORS.textMuted}
      />
      <TextInput
        style={styles.input}
        placeholderTextColor={COLORS.disabledText}
        {...inputProps}
      />
      {right}
    </View>
    {!!error && <Text style={styles.fieldError}>{error}</Text>}
  </View>
);

// ---------------------------------------------------------------------------
// Edit profile bottom sheet
// ---------------------------------------------------------------------------
const EditProfileSheet = ({ visible, user, onClose, onSaved }) => {
  const insets = useSafeAreaInsets();
  const { updateUserSession } = useAuth();

  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset the form every time the sheet opens
  useEffect(() => {
    if (visible) {
      setForm({
        name: user?.name || "",
        email: user?.email || "",
        phone: user?.phone || "",
        password: "",
      });
      setErrors({});
      setServerError("");
      setShowPassword(false);
    }
  }, [visible, user]);

  const setField = useCallback((key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
    setServerError("");
  }, []);

  const isDirty = useMemo(
    () =>
      form.name.trim() !== (user?.name || "") ||
      form.email.trim() !== (user?.email || "") ||
      form.phone.trim() !== (user?.phone || "") ||
      form.password.length > 0,
    [form, user]
  );

  const handleSave = async () => {
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
    };
    if (form.password) payload.password = form.password;

    try {
      setSaving(true);
      const res = await adminService.updateProfile(payload);
      if (res?.user) {
        await updateUserSession(res.user);
        onSaved();
      } else {
        setServerError("Unexpected response from the server.");
      }
    } catch (err) {
      setServerError(getApiError(err, "Failed to update profile."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.sheetRoot}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />

        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.handle} />

          <View style={styles.sheetHeader}>
            <View style={styles.sheetIcon}>
              <MaterialCommunityIcons name="account-edit-outline" size={22} color="#FFFFFF" />
            </View>
            <View style={styles.sheetTitleWrap}>
              <Text style={styles.sheetTitle}>Edit profile</Text>
              <Text style={styles.sheetSubtitle}>Update your administrator details</Text>
            </View>
            <IconButton icon="close" onPress={onClose} label="Close" />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.sheetBody}
          >
            {!!serverError && (
              <View style={styles.errorBanner}>
                <MaterialCommunityIcons name="alert-circle-outline" size={18} color={COLORS.error} />
                <Text style={styles.errorBannerText}>{serverError}</Text>
              </View>
            )}

            <Field
              label="Full name"
              icon="account-outline"
              value={form.name}
              onChangeText={(t) => setField("name", t)}
              placeholder="Full name"
              autoCapitalize="words"
              textContentType="name"
              error={errors.name}
            />
            <Field
              label="Email address"
              icon="email-outline"
              value={form.email}
              onChangeText={(t) => setField("email", t)}
              placeholder="name@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              error={errors.email}
            />
            <Field
              label="Phone number"
              icon="phone-outline"
              value={form.phone}
              onChangeText={(t) => setField("phone", t)}
              placeholder="+94 77 123 4567"
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              error={errors.phone}
            />
            <Field
              label="New password (optional)"
              icon="lock-outline"
              value={form.password}
              onChangeText={(t) => setField("password", t)}
              placeholder="Leave blank to keep current"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              error={errors.password}
              right={
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                >
                  <MaterialCommunityIcons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={COLORS.textMuted}
                  />
                </Pressable>
              }
            />
          </ScrollView>

          <View style={styles.sheetFooter}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.footerButton, styles.cancelButton, pressed && styles.pressed]}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={saving || !isDirty}
              style={({ pressed }) => [
                styles.footerButton,
                styles.saveButton,
                (saving || !isDirty) && styles.saveDisabled,
                pressed && styles.pressed,
              ]}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveText}>Save changes</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Sizes that grow with the free space on tall phones (scale 1 = compact)
// ---------------------------------------------------------------------------
const buildScaledStyles = (k) => {
  const n = (v) => Math.round(v * k);
  return {
    content: { paddingTop: n(14), paddingBottom: n(14) },
    hero: { padding: n(16) },
    avatar: { width: n(60), height: n(60), borderRadius: n(20) },
    avatarText: { fontSize: n(20) },
    heroName: { fontSize: n(17) },
    heroEmail: { fontSize: n(12) },
    roleBadge: { paddingVertical: n(4), paddingHorizontal: n(10), marginTop: n(8) },
    roleBadgeText: { fontSize: n(10) },
    sectionTitle: { fontSize: n(14), marginTop: n(16), marginBottom: n(8) },
    infoRow: { paddingVertical: n(10) },
    infoIcon: { width: n(36), height: n(36), borderRadius: n(12) },
    infoLabel: { fontSize: n(11) },
    infoValue: { fontSize: n(13) },
    actionsRow: { marginTop: n(14) },
    actionButton: { paddingVertical: n(13) },
    buttonText: { fontSize: n(14) },
    dangerRow: { marginTop: n(12), paddingVertical: n(10) },
    dangerIcon: { width: n(34), height: n(34), borderRadius: n(11) },
    dangerTitle: { fontSize: n(13) },
    dangerSub: { fontSize: n(11) },
  };
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
const AdminProfileScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef(null);

  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  const showNotice = useCallback((message) => {
    setNotice(message);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), NOTICE_MS);
  }, []);

  const handleSaved = useCallback(() => {
    setSheetOpen(false);
    showNotice("Profile updated successfully.");
  }, [showNotice]);

  const confirmLogout = () =>
    Alert.alert("Log out", "Are you sure you want to log out of this account?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: () => logout() },
    ]);

  const confirmDelete = () =>
    Alert.alert(
      "Delete admin account",
      "This permanently deletes your administrator account and cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: async () => {
            try {
              setDeleting(true);
              await adminService.deleteProfile();
              await logout();
            } catch (err) {
              setDeleting(false);
              Alert.alert("Delete failed", getApiError(err, "Failed to delete account."));
            }
          },
        },
      ]
    );

  const canGoBack = navigation?.canGoBack?.() ?? false;

  // The page is built to fit on one screen. Scrolling only switches on
  // if the content is taller than the space available (very small phones).
  const [viewH, setViewH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const needsScroll = viewH > 0 && contentH > viewH + 1;

  // Measure the natural (scale 1) height once, then grow sizes to use
  // the free space on tall phones. Capped so it never looks oversized.
  const [baseH, setBaseH] = useState(null);
  const scale = baseH && viewH ? Math.max(1, Math.min((viewH / baseH) * 0.97, 1.18)) : 1;
  const d = useMemo(() => buildScaledStyles(scale), [scale]);
  const icon = Math.round(18 * scale);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.secondary} />

      {/* Header (fixed) */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        {canGoBack && <IconButton icon="arrow-left" onPress={() => navigation.goBack()} label="Go back" />}
        <View style={[styles.headerText, canGoBack && styles.headerTextWithBack]}>
          <Text style={styles.title}>Admin profile</Text>
          <Text style={styles.subtitle}>Manage your account</Text>
        </View>
        <IconButton icon="pencil-outline" onPress={() => setSheetOpen(true)} label="Edit profile" />
      </View>

      <View style={styles.body} onLayout={(e) => setViewH(e.nativeEvent.layout.height)}>
        {!!notice && (
          <View style={styles.notice}>
            <MaterialCommunityIcons name="check-circle" size={16} color={COLORS.success} />
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        )}

        <ScrollView
          scrollEnabled={needsScroll}
          bounces={false}
          overScrollMode="never"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, d.content]}
          onContentSizeChange={(_, h) => {
            setContentH(h);
            setBaseH((prev) => prev ?? h);
          }}
        >
          {/* Hero */}
          <View style={[styles.hero, d.hero]}>
            <View style={[styles.avatar, d.avatar]}>
              <Text style={[styles.avatarText, d.avatarText]}>{getInitials(user?.name)}</Text>
            </View>
            <View style={styles.heroInfo}>
              <Text style={[styles.heroName, d.heroName]} numberOfLines={1}>
                {user?.name || "System Admin"}
              </Text>
              {!!user?.email && (
                <Text style={[styles.heroEmail, d.heroEmail]} numberOfLines={1}>
                  {user.email}
                </Text>
              )}
              <View style={[styles.roleBadge, d.roleBadge]}>
                <MaterialCommunityIcons name="shield-check" size={Math.round(12 * scale)} color="#FFFFFF" />
                <Text style={[styles.roleBadgeText, d.roleBadgeText]}>{ROLE_LABEL}</Text>
              </View>
            </View>
          </View>

          {/* Account information */}
          <Text style={[styles.sectionTitle, d.sectionTitle]}>Account information</Text>
          <View style={styles.card}>
            <InfoRow
              icon="account-outline"
              label="Full name"
              value={user?.name || "N/A"}
              onPress={() => setSheetOpen(true)}
              d={d}
              iconSize={icon}
            />
            <InfoRow
              icon="email-outline"
              label="Email address"
              value={user?.email || "N/A"}
              onPress={() => setSheetOpen(true)}
              d={d}
              iconSize={icon}
            />
            <InfoRow
              icon="phone-outline"
              label="Phone number"
              value={user?.phone || "N/A"}
              onPress={() => setSheetOpen(true)}
              d={d}
              iconSize={icon}
            />
            <InfoRow icon="check-decagram-outline" label="Status" value="Active & verified" tone="success" last d={d} iconSize={icon} />
          </View>

          {/* Actions */}
          <View style={[styles.actionsRow, d.actionsRow]}>
            <Pressable
              onPress={() => setSheetOpen(true)}
              style={({ pressed }) => [styles.actionButton, styles.primaryButton, d.actionButton, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons name="square-edit-outline" size={icon} color="#FFFFFF" />
              <Text style={[styles.primaryButtonText, d.buttonText]}>Edit profile</Text>
            </Pressable>
            <Pressable
              onPress={confirmLogout}
              style={({ pressed }) => [styles.actionButton, styles.secondaryButton, d.actionButton, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons name="logout" size={icon} color={COLORS.textPrimary} />
              <Text style={[styles.secondaryButtonText, d.buttonText]}>Log out</Text>
            </Pressable>
          </View>

          {/* Danger zone */}
          <Pressable
            onPress={confirmDelete}
            disabled={deleting}
            style={({ pressed }) => [styles.dangerRow, d.dangerRow, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Delete admin account"
          >
            <View style={[styles.dangerIcon, d.dangerIcon]}>
              {deleting ? (
                <ActivityIndicator size="small" color={COLORS.error} />
              ) : (
                <MaterialCommunityIcons name="trash-can-outline" size={icon} color={COLORS.error} />
              )}
            </View>
            <View style={styles.dangerText}>
              <Text style={[styles.dangerTitle, d.dangerTitle]}>Delete account</Text>
              <Text style={[styles.dangerSub, d.dangerSub]}>Permanent and cannot be undone</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={icon} color={COLORS.error} />
          </Pressable>
        </ScrollView>
      </View>

      <EditProfileSheet
        visible={sheetOpen}
        user={user}
        onClose={() => setSheetOpen(false)}
        onSaved={handleSaved}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  pressed: { opacity: 0.8 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.inputBorder,
  },
  headerText: { flex: 1 },
  headerTextWithBack: { marginLeft: 12 },
  title: { fontSize: 20, fontWeight: "800", color: COLORS.textPrimary },
  subtitle: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    backgroundColor: COLORS.secondary,
    alignItems: "center",
    justifyContent: "center",
  },

  // Body (fits on one screen)
  body: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14 },

  notice: {
    position: "absolute",
    top: 8,
    left: 20,
    right: 20,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#DDF5EA",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...SHADOWS.small,
  },
  noticeText: { flex: 1, fontSize: 12, fontWeight: "700", color: COLORS.success },

  // Hero
  hero: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 22,
    padding: 16,
    ...SHADOWS.medium,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 20, fontWeight: "900", color: COLORS.primary },
  heroInfo: { flex: 1, marginLeft: 14 },
  heroName: { fontSize: 17, fontWeight: "800", color: "#FFFFFF" },
  heroEmail: { fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 2 },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
  },
  roleBadgeText: { fontSize: 10, fontWeight: "800", color: "#FFFFFF", letterSpacing: 0.3 },

  // Info card
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    paddingHorizontal: 14,
    ...SHADOWS.small,
  },
  infoRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  infoRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.inputBorder,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#EEEAFD",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  infoIconSuccess: { backgroundColor: "#DDF5EA" },
  infoText: { flex: 1 },
  infoLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: "600" },
  infoValue: { fontSize: 13, fontWeight: "700", color: COLORS.textPrimary, marginTop: 1 },

  // Buttons
  actionsRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 14,
    paddingVertical: 13,
  },
  primaryButton: { backgroundColor: COLORS.primary, ...SHADOWS.small },
  primaryButtonText: { fontSize: 14, fontWeight: "800", color: "#FFFFFF" },
  secondaryButton: {
    backgroundColor: COLORS.secondary,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
  },
  secondaryButtonText: { fontSize: 14, fontWeight: "800", color: COLORS.textPrimary },

  // Danger row
  dangerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF6F6",
    borderWidth: 1,
    borderColor: "#F8CACA",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  dangerIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "#FDE8E8",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  dangerText: { flex: 1 },
  dangerTitle: { fontSize: 13, fontWeight: "800", color: COLORS.error },
  dangerSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },

  // Bottom sheet
  sheetRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(20,15,45,0.55)" },
  sheet: {
    backgroundColor: COLORS.secondary,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "92%",
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.inputBorder,
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.inputBorder,
  },
  sheetIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitleWrap: { flex: 1, marginHorizontal: 12 },
  sheetTitle: { fontSize: 16, fontWeight: "800", color: COLORS.textPrimary },
  sheetSubtitle: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  sheetBody: { paddingTop: 16, paddingBottom: 8 },
  sheetFooter: { flexDirection: "row", gap: 12, paddingTop: 12 },
  footerButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: { borderWidth: 1, borderColor: COLORS.inputBorder, backgroundColor: COLORS.secondary },
  cancelText: { fontSize: 14, fontWeight: "700", color: COLORS.textPrimary },
  saveButton: { backgroundColor: COLORS.primary },
  saveDisabled: { opacity: 0.45 },
  saveText: { fontSize: 14, fontWeight: "800", color: "#FFFFFF" },

  // Form
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FDE8E8",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  errorBannerText: { flex: 1, fontSize: 13, fontWeight: "600", color: COLORS.error },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: COLORS.textPrimary, marginBottom: 6 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
  },
  inputWrapError: { borderColor: COLORS.error, backgroundColor: "#FFF6F6" },
  input: { flex: 1, fontSize: 14, color: COLORS.textPrimary, paddingVertical: 0 },
  fieldError: { fontSize: 12, color: COLORS.error, marginTop: 6, fontWeight: "600" },
});

export default AdminProfileScreen;
