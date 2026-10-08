import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, SHADOWS } from "../../constants/theme";
import adminService from "../../services/adminService";

const FILTERS = [
  { label: "All users", value: "All" },
  { label: "Customers", value: "Customer" },
  { label: "Providers", value: "Provider" },
  { label: "Admins", value: "Admin" },
];

const STATUS_STYLES = {
  Active: { bg: "#DDF5EA", text: "#0F8A5F" },
  Verified: { bg: "#DDF5EA", text: "#0F8A5F" },
  Unverified: { bg: "#FEF3DC", text: "#B25E09" },
  Pending: { bg: "#FEF3DC", text: "#B25E09" },
  Suspended: { bg: "#FDE8E8", text: "#C93B4B" },
};

const TYPE_STYLES = {
  Customer: { bg: "#E0ECFF", text: "#3B6FE0" },
  Provider: { bg: "#EDE9FE", text: COLORS.primary },
  Admin: { bg: "#FEE2E2", text: COLORS.error },
};

const TREND_GREEN = "#0F8A5F";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const formatJoined = (iso) => {
  if (!iso) return "N/A";

  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;

  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

const formatNumber = (n = 0) => n.toLocaleString("en-US");

const getInitials = (name = "") => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
};

// ---------------------------------------------------------------------------
// Summary tile component
// ---------------------------------------------------------------------------
const SummaryTile = ({ label, value }) => (
  <View style={styles.tile}>
    <Text style={styles.tileLabel}>{label}</Text>
    <Text style={styles.tileValue}>{value}</Text>
    <View style={styles.trendRow}>
      <MaterialCommunityIcons name="arrow-up" size={13} color={TREND_GREEN} />
      <Text style={styles.trendText}>Live Data</Text>
    </View>
  </View>
);

// ---------------------------------------------------------------------------
// Account card component
// ---------------------------------------------------------------------------
const AccountCard = ({ item, onPress }) => {
  const roleType =
    item.role === "provider"
      ? "Provider"
      : item.role === "admin"
      ? "Admin"
      : "Customer";

  const typeTone = TYPE_STYLES[roleType] || TYPE_STYLES.Customer;
  const statusKey = item.isVerified ? "Active" : "Unverified";
  const status = STATUS_STYLES[statusKey];

  const subtitle =
    roleType === "Provider"
      ? `Provider · ${item.providerDetails?.category || "General Repairs"}`
      : roleType === "Admin"
      ? `System Administrator`
      : `Customer · ${item.phone || item.email}`;

  const shortId = `US-${item._id ? item._id.slice(-6).toUpperCase() : "0000"}`;

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.avatar, { backgroundColor: typeTone.bg }]}>
          <Text style={[styles.avatarText, { color: typeTone.text }]}>
            {getInitials(item.name)}
          </Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.subtitleText}>{subtitle}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: status.bg }]}>
          <Text style={[styles.badgeText, { color: status.text }]}>{statusKey}</Text>
        </View>
      </View>

      {/* <Text style={styles.idLine}>
        joined {formatJoined(item.createdAt)}
      </Text> */}

      <View style={styles.divider} />

      <View style={styles.statsRow}>
        <Text style={[styles.statText, styles.statLeft]}>
          ✉️ {item.email}
        </Text>
        <Text style={[styles.statText, styles.statRight]}>
          📞 {item.phone}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.action}
        activeOpacity={0.8}
        onPress={() => onPress(item)}
        accessibilityRole="button"
        accessibilityLabel={`View account for ${item.name}`}
      >
        <Text style={styles.actionText}>View account</Text>
      </TouchableOpacity>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Main UsersScreen Component
// ---------------------------------------------------------------------------
const UsersScreen = () => {
  const insets = useSafeAreaInsets();

  const [users, setUsers] = useState([]);
  const [customerCount, setCustomerCount] = useState(0);
  const [providerCount, setProviderCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");

  // Popup View Account Modal State
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);

  // Add Admin Modal State
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminConfirmPassword, setAdminConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [addAdminLoading, setAddAdminLoading] = useState(false);
  const [addAdminError, setAddAdminError] = useState("");

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await adminService.getAllUsers();
      if (data && data.users) {
        setUsers(data.users);
        setCustomerCount(data.customerCount || 0);
        setProviderCount(data.providerCount || 0);
      }
    } catch (error) {
      console.error("Error fetching users list:", error);
      Alert.alert("Error", "Failed to load actual users data from database.");
    } finally {
      setLoading(false);
    }
  };

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      const roleType =
        u.role === "provider"
          ? "Provider"
          : u.role === "admin"
          ? "Admin"
          : "Customer";

      const matchesFilter = filter === "All" || roleType === filter;
      const matchesQuery =
        !q ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.phone && u.phone.toLowerCase().includes(q)) ||
        (u._id && u._id.toLowerCase().includes(q));

      return matchesFilter && matchesQuery;
    });
  }, [users, query, filter]);

  const handleCreateAdmin = async () => {
    setAddAdminError("");

    if (!adminName.trim()) {
      setAddAdminError("Full Name is required");
      return;
    }
    if (!adminEmail.trim() || !/\S+@\S+\.\S+/.test(adminEmail)) {
      setAddAdminError("Please enter a valid email address");
      return;
    }
    if (!adminPhone.trim()) {
      setAddAdminError("Phone Number is required");
      return;
    }
    if (!adminPassword || adminPassword.length < 6) {
      setAddAdminError("Password must be at least 6 characters long");
      return;
    }
    if (adminPassword !== adminConfirmPassword) {
      setAddAdminError("Passwords do not match");
      return;
    }

    try {
      setAddAdminLoading(true);
      const res = await adminService.createAdmin({
        name: adminName.trim(),
        email: adminEmail.trim(),
        phone: adminPhone.trim(),
        password: adminPassword,
      });

      Alert.alert("Success 🎉", res.message || "New Admin account created successfully!");
      
      // Reset form
      setAdminName("");
      setAdminEmail("");
      setAdminPhone("");
      setAdminPassword("");
      setAdminConfirmPassword("");
      setShowAddAdminModal(false);

      // Refresh list
      fetchUsers();
    } catch (error) {
      const msg = error.response?.data?.message || "Failed to create Admin account";
      setAddAdminError(msg);
    } finally {
      setAddAdminLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.secondary} />

      {/* Header (fixed, does not scroll) */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerText}>
          <Text style={styles.screenTitle}>Users & providers</Text>
          <Text style={styles.subtitle}>
            {formatNumber(users.length)} accounts on the platform
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.addAdminBtn}
            onPress={() => {
              setAddAdminError("");
              setShowAddAdminModal(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Add new Admin"
          >
            <Text style={styles.addAdminBtnText}>+ Admin</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuButton}
            onPress={fetchUsers}
            accessibilityRole="button"
            accessibilityLabel="Refresh list"
          >
            <MaterialCommunityIcons name="refresh" size={22} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Everything below scrolls */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Summary tiles */}
        {/* <View style={styles.tiles}>
          <SummaryTile
            label="Customers"
            value={formatNumber(customerCount)}
          />
          <SummaryTile
            label="Providers"
            value={formatNumber(providerCount)}
          />
        </View> */}

        {/* Search */}
        <View style={styles.search}>
          <MaterialCommunityIcons name="magnify" size={20} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search name, email or phone"
            placeholderTextColor={COLORS.disabledText}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => setQuery("")}
              accessibilityLabel="Clear search"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="close-circle" size={18} color={COLORS.disabledText} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter chips */}
        <View style={styles.filterRow}>
          <View style={styles.chips}>
            {FILTERS.map((f) => {
              const active = f.value === filter;
              return (
                <TouchableOpacity
                  key={f.value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setFilter(f.value)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[styles.chipText, active && styles.chipTextActive]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Result count */}
        <Text style={styles.count}>
          {results.length} matching {results.length === 1 ? "account" : "accounts"}
        </Text>

        {/* List */}
        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Fetching database accounts...</Text>
          </View>
        ) : results.length > 0 ? (
          results.map((item) => (
            <AccountCard
              key={item._id}
              item={item}
              onPress={(userObj) => setSelectedUser(userObj)}
            />
          ))
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No accounts found</Text>
            <Text style={styles.emptyText}>Try a different search or choose another group.</Text>
          </View>
        )}
      </ScrollView>

      {/* --------------------------------------------------------------------------- */}
      {/* 1. VIEW ACCOUNT DETAILS POPUP MODAL                                         */}
      {/* --------------------------------------------------------------------------- */}
      <Modal
        visible={!!selectedUser}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSelectedUser(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <View
                  style={[
                    styles.modalAvatar,
                    {
                      backgroundColor:
                        selectedUser?.role === "provider"
                          ? "#EDE9FE"
                          : selectedUser?.role === "admin"
                          ? "#FEE2E2"
                          : "#E0ECFF",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.modalAvatarText,
                      {
                        color:
                          selectedUser?.role === "provider"
                            ? COLORS.primary
                            : selectedUser?.role === "admin"
                            ? COLORS.error
                            : "#3B6FE0",
                      },
                    ]}
                  >
                    {getInitials(selectedUser?.name || "")}
                  </Text>
                </View>
                <View style={styles.modalHeaderTextGroup}>
                  <Text style={styles.modalTitle}>{selectedUser?.name}</Text>
                  <Text style={styles.modalSubtitle}>
                    {selectedUser?.role?.toUpperCase()} ACCOUNT
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setSelectedUser(null)}
              >
                <MaterialCommunityIcons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              {/* Profile & Database Information */}
              <View style={styles.infoSection}>
                <Text style={styles.infoSectionTitle}>Account Overview</Text>
                <View style={styles.infoRow}>
                  {/* <Text style={styles.infoLabel}>Database ID:</Text>
                  <Text style={styles.infoValue}>{selectedUser?._id}</Text> */}
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Email Address:</Text>
                  <Text style={styles.infoValue}>{selectedUser?.email}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Phone Number:</Text>
                  <Text style={styles.infoValue}>{selectedUser?.phone}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Account Role:</Text>
                  <Text style={styles.infoValue}>
                    {selectedUser?.role?.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>OTP Verification:</Text>
                  <Text
                    style={[
                      styles.infoValue,
                      { color: selectedUser?.isVerified ? "#0F8A5F" : "#B25E09" },
                    ]}
                  >
                    {selectedUser?.isVerified ? "Verified ✓" : "Pending OTP"}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Registration Date:</Text>
                  <Text style={styles.infoValue}>
                    {formatJoined(selectedUser?.createdAt)}
                  </Text>
                </View>
              </View>

              {/* Service Provider Specific Details */}
              {selectedUser?.role === "provider" && (
                <View style={styles.infoSection}>
                  <Text style={styles.infoSectionTitle}>
                    🛠️ Service Provider Information
                  </Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Category:</Text>
                    <Text style={styles.infoValue}>
                      {selectedUser?.providerDetails?.category || "General"}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Experience:</Text>
                    <Text style={styles.infoValue}>
                      {selectedUser?.providerDetails?.experience || "N/A"}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Admin Approval Status:</Text>
                    <Text
                      style={[
                        styles.infoValue,
                        {
                          color:
                            selectedUser?.providerDetails?.approvalStatus === "approved"
                              ? "#0F8A5F"
                              : selectedUser?.providerDetails?.approvalStatus === "rejected"
                              ? COLORS.error
                              : "#B25E09",
                        },
                      ]}
                    >
                      {(
                        selectedUser?.providerDetails?.approvalStatus || "pending"
                      ).toUpperCase()}
                    </Text>
                  </View>

                  {/* Provider Document Previews */}
                  <Text style={[styles.infoSectionTitle, { marginTop: 12 }]}>
                    Verification Documents:
                  </Text>

                  <View style={styles.modalDocRow}>
                    {selectedUser?.providerDetails?.nicFront ? (
                      <TouchableOpacity
                        style={styles.modalDocBox}
                        onPress={() => setSelectedImage(selectedUser.providerDetails.nicFront)}
                      >
                        <Image
                          source={{ uri: selectedUser.providerDetails.nicFront }}
                          style={styles.modalDocThumb}
                        />
                        <Text style={styles.modalDocText}>NIC Front 🔍</Text>
                      </TouchableOpacity>
                    ) : null}

                    {selectedUser?.providerDetails?.nicBack ? (
                      <TouchableOpacity
                        style={styles.modalDocBox}
                        onPress={() => setSelectedImage(selectedUser.providerDetails.nicBack)}
                      >
                        <Image
                          source={{ uri: selectedUser.providerDetails.nicBack }}
                          style={styles.modalDocThumb}
                        />
                        <Text style={styles.modalDocText}>NIC Back 🔍</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Modal Dismiss Button */}
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setSelectedUser(null)}
            >
              <Text style={styles.modalCloseButtonText}>Close Account Details</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --------------------------------------------------------------------------- */}
      {/* 2. CREATE ADMIN MODAL FORM (KEYBOARD AWARE)                                 */}
      {/* --------------------------------------------------------------------------- */}
      <Modal
        visible={showAddAdminModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddAdminModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoidingModalContainer}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderTitleRow}>
                  <View style={[styles.modalAvatar, { backgroundColor: "#FEE2E2" }]}>
                    <Text style={[styles.modalAvatarText, { color: COLORS.error }]}>
                      +
                    </Text>
                  </View>
                  <View style={styles.modalHeaderTextGroup}>
                    <Text style={styles.modalTitle}>Add System Admin</Text>
                    <Text style={styles.modalSubtitle}>
                      Create a new administrator account
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => setShowAddAdminModal(false)}
                >
                  <MaterialCommunityIcons name="close" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                style={styles.modalScroll}
                contentContainerStyle={{ paddingBottom: 24 }}
                keyboardShouldPersistTaps="handled"
              >
                {addAdminError ? (
                  <View style={styles.formErrorBox}>
                    <Text style={styles.formErrorText}>{addAdminError}</Text>
                  </View>
                ) : null}

                {/* Full Name */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Full Name *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. Kasun Fernando"
                    placeholderTextColor={COLORS.disabledText}
                    value={adminName}
                    onChangeText={(text) => {
                      setAdminName(text);
                      setAddAdminError("");
                    }}
                  />
                </View>

                {/* Email Address */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Email Address *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. admin.kasun@fixmate.com"
                    placeholderTextColor={COLORS.disabledText}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={adminEmail}
                    onChangeText={(text) => {
                      setAdminEmail(text);
                      setAddAdminError("");
                    }}
                  />
                </View>

                {/* Phone Number */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Phone Number *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. 0771234567"
                    placeholderTextColor={COLORS.disabledText}
                    keyboardType="phone-pad"
                    value={adminPhone}
                    onChangeText={(text) => {
                      setAdminPhone(text);
                      setAddAdminError("");
                    }}
                  />
                </View>

                {/* Password */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Password *</Text>
                  <View style={styles.passwordInputContainer}>
                    <TextInput
                      style={styles.passwordInputText}
                      placeholder="At least 6 characters"
                      placeholderTextColor={COLORS.disabledText}
                      secureTextEntry={!showPassword}
                      value={adminPassword}
                      onChangeText={(text) => {
                        setAdminPassword(text);
                        setAddAdminError("");
                      }}
                    />
                    <TouchableOpacity
                      style={styles.eyeBtn}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Text style={styles.eyeBtnText}>
                        {showPassword ? "Hide" : "Show"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Confirm Password */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Confirm Password *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Re-enter password"
                    placeholderTextColor={COLORS.disabledText}
                    secureTextEntry={!showPassword}
                    value={adminConfirmPassword}
                    onChangeText={(text) => {
                      setAdminConfirmPassword(text);
                      setAddAdminError("");
                    }}
                  />
                </View>

                {/* Modal Submit Button Inside ScrollView */}
                <TouchableOpacity
                  style={styles.createAdminSubmitBtn}
                  onPress={handleCreateAdmin}
                  disabled={addAdminLoading}
                >
                  {addAdminLoading ? (
                    <ActivityIndicator color={COLORS.secondary} />
                  ) : (
                    <Text style={styles.createAdminSubmitText}>
                      + Create Admin Account
                    </Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Fullscreen Image Preview Zoom */}
      <Modal
        visible={!!selectedImage}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <View style={styles.zoomModalBg}>
          <TouchableOpacity
            style={styles.zoomCloseBtn}
            onPress={() => setSelectedImage(null)}
          >
            <Text style={styles.zoomCloseText}>✕ Close Image</Text>
          </TouchableOpacity>
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={styles.zoomFullImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  errorBanner: { backgroundColor: '#FDE8E8', padding: 14, borderRadius: 14, gap: 10, marginBottom: 14 },
  errorText: { color: '#B42332', fontSize: 13 },
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Header
  header: {
    width: '100%', maxWidth: 760, alignSelf: 'center',
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 20,
    paddingBottom: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.inputBorder,
  },
  headerText: {
    flex: 1,
    paddingRight: 12,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addAdminBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  addAdminBtnText: {
    color: COLORS.secondary,
    fontWeight: "800",
    fontSize: 13,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 8,
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    backgroundColor: COLORS.secondary,
    alignItems: "center",
    justifyContent: "center",
  },

  // Scroll area
  scroll: {
    flex: 1,
  },
  scrollContent: {
    width: '100%', maxWidth: 760, alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
  },

  // Summary tiles
  tiles: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  tile: {
    flex: 1,
    backgroundColor: COLORS.cardBg,
    borderRadius: 22,
    padding: 16,
    ...SHADOWS.small,
  },
  tileLabel: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  tileValue: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginTop: 4,
    letterSpacing: -0.5,
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  trendText: {
    fontSize: 12,
    fontWeight: "700",
    color: TREND_GREEN,
    marginLeft: 2,
  },

  // Search
  search: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    backgroundColor: COLORS.secondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    paddingHorizontal: 14,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
    paddingVertical: 0,
  },

  // Chips
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    gap: 8,
  },
  chips: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 6,
  },
  chip: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    height: 40,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    backgroundColor: COLORS.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: {
    backgroundColor: "#EDE9FE",
    borderColor: "#CFC3FA",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textMuted,
  },
  chipTextActive: {
    color: COLORS.primary,
  },

  // Count
  count: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginTop: 18,
    marginBottom: 12,
  },

  // Card
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,
    ...SHADOWS.small,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 15,
    fontWeight: "800",
  },
  cardInfo: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  subtitleText: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  idLine: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 14,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.inputBorder,
    marginTop: 16,
    marginBottom: 14,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  statLeft: {
    textAlign: "left",
  },
  statRight: {
    textAlign: "right",
  },
  action: {
    backgroundColor: "#EEEAFD",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 14,
  },
  actionText: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.primary,
  },

  // Loader & Empty state
  loaderContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.textMuted,
    fontSize: 14,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 6,
    textAlign: "center",
  },

  // Keyboard Aware Container
  keyboardAvoidingModalContainer: {
    flex: 1,
  },

  // Modal Popup Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.secondary,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "92%",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.inputBorder,
  },
  modalHeaderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  modalAvatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  modalAvatarText: {
    fontSize: 16,
    fontWeight: "800",
  },
  modalHeaderTextGroup: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  modalSubtitle: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  modalScroll: {
    marginVertical: 14,
  },
  infoSection: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  infoSectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  modalDocRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  modalDocBox: {
    flex: 1,
    alignItems: "center",
    backgroundColor: COLORS.secondary,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
  },
  modalDocThumb: {
    width: 100,
    height: 75,
    borderRadius: 6,
  },
  modalDocText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primary,
    marginTop: 4,
  },
  modalCloseButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  modalCloseButtonText: {
    color: COLORS.secondary,
    fontSize: 15,
    fontWeight: "800",
  },

  // Add Admin Form Styles
  formErrorBox: {
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  formErrorText: {
    color: COLORS.error,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  formGroup: {
    marginBottom: 14,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  passwordInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: 12,
  },
  passwordInputText: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  eyeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  eyeBtnText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: "700",
  },
  createAdminSubmitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  createAdminSubmitText: {
    color: COLORS.secondary,
    fontSize: 15,
    fontWeight: "800",
  },

  // Zoom Modal
  zoomModalBg: {
    flex: 1,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
  },
  zoomCloseBtn: {
    position: "absolute",
    top: 50,
    right: 20,
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    zIndex: 10,
  },
  zoomCloseText: {
    color: COLORS.secondary,
    fontWeight: "bold",
    fontSize: 14,
  },
  zoomFullImage: {
    width: "95%",
    height: "85%",
  },
});

export default UsersScreen;