import React, { useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  StyleSheet,
  Alert,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Switch,
  Image,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { authService } from "../../services/authService";
import { COLORS, SHADOWS } from "../../constants/theme";

const getInitials = (name = "") => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
};

const errorText = (e) =>
  e.response?.data?.message || e.message || "Unable to save changes. Please try again.";

// ---------------------------------------------------------------------------
// LOCATION EDITOR MODAL
// ---------------------------------------------------------------------------
export function LocationEditor({ onClose }) {
  const { user, updateUserSession } = useAuth();
  const insets = useSafeAreaInsets();
  const lock = useRef(false);

  const [address, setAddress] = useState(user?.location?.address || "");
  const [city, setCity] = useState(user?.location?.city || "");
  const [latitude, setLatitude] = useState(
    user?.location?.latitude == null ? "" : String(user.location.latitude)
  );
  const [longitude, setLongitude] = useState(
    user?.location?.longitude == null ? "" : String(user.location.longitude)
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleGps() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const p = await Location.requestForegroundPermissionsAsync();
      if (p.status !== "granted") {
        throw new Error("Location permission denied. Enter your address manually.");
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLatitude(String(pos.coords.latitude));
      setLongitude(String(pos.coords.longitude));
      Alert.alert("GPS Pin Saved 📍", `Coordinates: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function handleSave() {
    if (lock.current) return;
    if (!address.trim() && !city.trim()) {
      setError("Please enter a street address or city.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const updatedUser = await authService.updateProfile({
        location: {
          address: address.trim(),
          city: city.trim(),
          latitude: latitude.trim() ? Number(latitude) : null,
          longitude: longitude.trim() ? Number(longitude) : null,
        },
      });
      await updateUserSession(updatedUser);
      Alert.alert("Success 🎉", "Address updated successfully.");
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => !busy && onClose()}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { paddingBottom: Math.max(24, insets.bottom) }]}>
          <View style={styles.modalSheetHeader}>
            <Text style={styles.modalSheetTitle}>My Addresses</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <MaterialCommunityIcons name="close" size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.modalSheetSub}>Save your default street address for home service bookings.</Text>

            <View style={styles.styledInputContainer}>
              <Text style={styles.styledInputLabel}>Street Address</Text>
              <TextInput
                style={styles.styledInput}
                placeholder="e.g. 427 Russell Junction, Apt 4B"
                placeholderTextColor="#94A3B8"
                value={address}
                onChangeText={setAddress}
              />
            </View>

            <View style={styles.styledInputContainer}>
              <Text style={styles.styledInputLabel}>City / Town</Text>
              <TextInput
                style={styles.styledInput}
                placeholder="e.g. Colombo, Kandy"
                placeholderTextColor="#94A3B8"
                value={city}
                onChangeText={setCity}
              />
            </View>

            <TouchableOpacity style={styles.gpsBtn} onPress={handleGps} disabled={busy}>
              <MaterialCommunityIcons name="crosshairs-gps" size={18} color={COLORS.primary} />
              <Text style={styles.gpsBtnText}>{busy ? "Locating..." : "Use Device GPS Coordinates"}</Text>
            </TouchableOpacity>

            {!!error && <Text style={styles.errorText}>{error}</Text>}

            <TouchableOpacity style={styles.primaryBtn} onPress={handleSave} disabled={busy}>
              {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Save Address</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// MAIN PROFILE SCREEN
// ---------------------------------------------------------------------------
export default function ProfileScreen({ navigation, embedded = false, children }) {
  const { user, logout, updateUserSession } = useAuth();
  const insets = useSafeAreaInsets();
  const lock = useRef(false);

  // Modals & States
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Edit Profile Form State
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [bio, setBio] = useState(user?.providerDetails?.bio || "");
  const [area, setArea] = useState(user?.providerDetails?.serviceArea || "");
  const [experience, setExperience] = useState(user?.providerDetails?.experience || "");
  const [avatarUri, setAvatarUri] = useState(user?.avatar || user?.profileImage || null);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState("");

  // Change Password Form State
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passBusy, setPassBusy] = useState(false);
  const [passError, setPassError] = useState("");

  const isProvider = user?.role === "provider";

  // Pick Image from Library
  const handlePickAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission Required", "Please allow access to your photos to change your profile picture.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        setAvatarUri(uri);
        // Persist avatar URI to profile
        const updatedUser = await authService.updateProfile({ avatar: uri, profileImage: uri });
        await updateUserSession(updatedUser);
        Alert.alert("Success 🎉", "Profile picture updated successfully.");
      }
    } catch (_e) {
      Alert.alert("Error", "Failed to select image.");
    }
  };

  // Save Edit Profile
  const handleSaveProfile = async () => {
    if (lock.current) return;
    if (!name.trim()) {
      setEditError("Name cannot be empty.");
      return;
    }
    lock.current = true;
    setEditBusy(true);
    setEditError("");
    try {
      const updatedUser = await authService.updateProfile({
        name: name.trim(),
        phone: phone.trim(),
        avatar: avatarUri,
        profileImage: avatarUri,
        ...(isProvider
          ? {
              providerDetails: {
                bio: bio.trim(),
                serviceArea: area.trim(),
                experience: experience.trim(),
              },
            }
          : {}),
      });
      await updateUserSession(updatedUser);
      setShowEditModal(false);
      Alert.alert("Success 🎉", "Your profile has been updated.");
    } catch (e) {
      setEditError(errorText(e));
    } finally {
      lock.current = false;
      setEditBusy(false);
    }
  };

  // Change Password Submit
  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword) {
      setPassError("Please enter your current and new password.");
      return;
    }
    if (newPassword.length < 6) {
      setPassError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassError("New passwords do not match.");
      return;
    }
    setPassBusy(true);
    setPassError("");
    try {
      await authService.updateProfile({ password: newPassword });
      setShowPasswordModal(false);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      Alert.alert("Password Updated 🎉", "Your password has been changed successfully.");
    } catch (e) {
      setPassError(errorText(e));
    } finally {
      setPassBusy(false);
    }
  };

  // Confirm Logout Dialog
  const handleConfirmLogout = () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out of your FixMate account?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: () => logout(),
        },
      ]
    );
  };

  const openEditProfile = () => {
    setName(user?.name || "");
    setEmail(user?.email || "");
    setPhone(user?.phone || "");
    setBio(user?.providerDetails?.bio || "");
    setArea(user?.providerDetails?.serviceArea || "");
    setExperience(user?.providerDetails?.experience || "");
    setAvatarUri(user?.avatar || user?.profileImage || null);
    setEditError("");
    setShowEditModal(true);
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          !embedded && { paddingTop: insets.top + 16 },
        ]}
      >
        {/* Top Header */}
        {!embedded && (
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>My Profile</Text>
          </View>
        )}

        {/* Profile Avatar & Name Card */}
        <View style={styles.profileHeaderCard}>
          <TouchableOpacity
            style={styles.avatarContainer}
            activeOpacity={0.85}
            onPress={handlePickAvatar}
            accessibilityRole="button"
            accessibilityLabel="Change profile picture"
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitials}>{getInitials(user?.name || "User")}</Text>
              </View>
            )}
            <View style={styles.cameraBadge}>
              <MaterialCommunityIcons name="camera" size={16} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          <Text style={styles.userName}>{user?.name || "Smith Johnson"}</Text>
          <Text style={styles.userRoleText}>
            {isProvider
              ? user?.providerDetails?.category || "Service Provider"
              : user?.email || "FixMate Customer"}
          </Text>
        </View>

        {/* Menu Items Container */}
        <View style={styles.menuContainer}>
          {/* Edit Profile */}
          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={openEditProfile}>
            <View style={styles.menuIconBox}>
              <MaterialCommunityIcons name="pencil-outline" size={22} color={COLORS.primary} />
            </View>
            <Text style={styles.menuItemText}>Edit Profile</Text>
            <MaterialCommunityIcons name="chevron-right" size={22} color="#94A3B8" />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* Change Password */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => {
              setPassError("");
              setShowPasswordModal(true);
            }}
          >
            <View style={styles.menuIconBox}>
              <MaterialCommunityIcons name="lock-outline" size={22} color={COLORS.primary} />
            </View>
            <Text style={styles.menuItemText}>Change Password</Text>
            <MaterialCommunityIcons name="chevron-right" size={22} color="#94A3B8" />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* My Bookings */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => navigation?.navigate ? navigation.navigate("Bookings") : Alert.alert("My Bookings", "Viewing active bookings.")}
          >
            <View style={styles.menuIconBox}>
              <MaterialCommunityIcons name="clipboard-text-outline" size={22} color={COLORS.primary} />
            </View>
            <Text style={styles.menuItemText}>My Bookings</Text>
            <MaterialCommunityIcons name="chevron-right" size={22} color="#94A3B8" />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* My Addresses */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => setShowLocationModal(true)}
          >
            <View style={styles.menuIconBox}>
              <MaterialCommunityIcons name="map-marker-outline" size={22} color={COLORS.primary} />
            </View>
            <Text style={styles.menuItemText}>My Addresses</Text>
            <MaterialCommunityIcons name="chevron-right" size={22} color="#94A3B8" />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* Dark Mode */}
          <View style={styles.menuItem}>
            <View style={styles.menuIconBox}>
              <MaterialCommunityIcons name="eye-outline" size={22} color={COLORS.primary} />
            </View>
            <Text style={styles.menuItemText}>Dark Mode</Text>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: "#CBD5E1", true: COLORS.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.menuDivider} />

          {/* Privacy Policy */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => setShowPrivacyModal(true)}
          >
            <View style={styles.menuIconBox}>
              <MaterialCommunityIcons name="shield-check-outline" size={22} color={COLORS.primary} />
            </View>
            <Text style={styles.menuItemText}>Privacy Policy</Text>
            <MaterialCommunityIcons name="chevron-right" size={22} color="#94A3B8" />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* Terms & Conditions */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => setShowTermsModal(true)}
          >
            <View style={styles.menuIconBox}>
              <MaterialCommunityIcons name="file-document-edit-outline" size={22} color={COLORS.primary} />
            </View>
            <Text style={styles.menuItemText}>Terms & Conditions</Text>
            <MaterialCommunityIcons name="chevron-right" size={22} color="#94A3B8" />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* Logout */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={handleConfirmLogout}
          >
            <View style={[styles.menuIconBox, { backgroundColor: "#FEE2E2" }]}>
              <MaterialCommunityIcons name="logout" size={22} color={COLORS.error} />
            </View>
            <Text style={[styles.menuItemText, { color: COLORS.error, fontWeight: "700" }]}>
              Logout
            </Text>
          </TouchableOpacity>
        </View>

        {children}
      </ScrollView>

      {/* --------------------------------------------------------------------------- */}
      {/* EDIT PROFILE MODAL (Matching Reference Image 2)                             */}
      {/* --------------------------------------------------------------------------- */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        onRequestClose={() => !editBusy && setShowEditModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
          {/* Modal Header */}
          <View style={styles.editHeader}>
            <TouchableOpacity
              style={styles.editBackBtn}
              onPress={() => setShowEditModal(false)}
              disabled={editBusy}
            >
              <MaterialCommunityIcons name="chevron-left" size={28} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.editHeaderTitle}>Edit Profile</Text>
            <View style={{ width: 40 }} />
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
          >
            <ScrollView
              contentContainerStyle={styles.editScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Profile Avatar in Edit Screen */}
              <View style={{ alignItems: "center", marginVertical: 20 }}>
                <TouchableOpacity
                  style={styles.avatarContainer}
                  activeOpacity={0.85}
                  onPress={handlePickAvatar}
                >
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarInitials}>{getInitials(name || user?.name || "U")}</Text>
                    </View>
                  )}
                  <View style={styles.cameraBadge}>
                    <MaterialCommunityIcons name="camera" size={16} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>
              </View>

              {/* Input Fields with Inset Labels matching Reference Image 2 */}
              <View style={styles.styledInputContainer}>
                <Text style={styles.styledInputLabel}>Name</Text>
                <TextInput
                  style={styles.styledInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter full name"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={styles.styledInputContainer}>
                <Text style={styles.styledInputLabel}>Email Address</Text>
                <TextInput
                  style={styles.styledInput}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="Enter email address"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={styles.styledInputContainer}>
                <Text style={styles.styledInputLabel}>Mobile Number</Text>
                <TextInput
                  style={styles.styledInput}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="Enter phone number"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              {isProvider && (
                <>
                  <View style={styles.styledInputContainer}>
                    <Text style={styles.styledInputLabel}>About / Bio</Text>
                    <TextInput
                      style={[styles.styledInput, { minHeight: 70 }]}
                      value={bio}
                      onChangeText={setBio}
                      multiline
                      placeholder="Describe your services"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View style={styles.styledInputContainer}>
                    <Text style={styles.styledInputLabel}>Service Area</Text>
                    <TextInput
                      style={styles.styledInput}
                      value={area}
                      onChangeText={setArea}
                      placeholder="e.g. Colombo & suburbs"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View style={styles.styledInputContainer}>
                    <Text style={styles.styledInputLabel}>Experience</Text>
                    <TextInput
                      style={styles.styledInput}
                      value={experience}
                      onChangeText={setExperience}
                      placeholder="e.g. 5+ years"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </>
              )}

              {!!editError && <Text style={styles.errorText}>{editError}</Text>}

              <View style={{ marginTop: 24, marginBottom: 20 }}>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={handleSaveProfile}
                  disabled={editBusy}
                >
                  {editBusy ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Update</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* CHANGE PASSWORD MODAL */}
      <Modal
        visible={showPasswordModal}
        transparent
        animationType="slide"
        onRequestClose={() => !passBusy && setShowPasswordModal(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: Math.max(24, insets.bottom) }]}>
            <View style={styles.modalSheetHeader}>
              <Text style={styles.modalSheetTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => setShowPasswordModal(false)} style={styles.closeBtn}>
                <MaterialCommunityIcons name="close" size={20} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.styledInputContainer}>
                <Text style={styles.styledInputLabel}>Current Password</Text>
                <TextInput
                  style={styles.styledInput}
                  secureTextEntry
                  value={oldPassword}
                  onChangeText={setOldPassword}
                  placeholder="Enter current password"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={styles.styledInputContainer}>
                <Text style={styles.styledInputLabel}>New Password</Text>
                <TextInput
                  style={styles.styledInput}
                  secureTextEntry
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Enter new password"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={styles.styledInputContainer}>
                <Text style={styles.styledInputLabel}>Confirm New Password</Text>
                <TextInput
                  style={styles.styledInput}
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter new password"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              {!!passError && <Text style={styles.errorText}>{passError}</Text>}

              <TouchableOpacity style={styles.primaryBtn} onPress={handleChangePassword} disabled={passBusy}>
                {passBusy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Update Password</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* PRIVACY POLICY MODAL */}
      <Modal visible={showPrivacyModal} animationType="slide" onRequestClose={() => setShowPrivacyModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
          <View style={styles.editHeader}>
            <TouchableOpacity style={styles.editBackBtn} onPress={() => setShowPrivacyModal(false)}>
              <MaterialCommunityIcons name="chevron-left" size={28} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.editHeaderTitle}>Privacy Policy</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Text style={styles.policyTitle}>FixMate Privacy & Data Policy</Text>
            <Text style={styles.policyText}>
              Your privacy is fundamental to FixMate. We collect necessary user details (name, email, phone, location) strictly to connect customers with trusted local home service providers.
            </Text>
            <Text style={styles.policyText}>
              - Location data is used only to show nearby professionals and service distances.
              {"\n"}- Phone numbers are kept secure and only shared upon confirmed service bookings.
              {"\n"}- Payment and transaction records are encrypted end-to-end.
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* TERMS & CONDITIONS MODAL */}
      <Modal visible={showTermsModal} animationType="slide" onRequestClose={() => setShowTermsModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
          <View style={styles.editHeader}>
            <TouchableOpacity style={styles.editBackBtn} onPress={() => setShowTermsModal(false)}>
              <MaterialCommunityIcons name="chevron-left" size={28} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.editHeaderTitle}>Terms & Conditions</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Text style={styles.policyTitle}>FixMate Terms of Service</Text>
            <Text style={styles.policyText}>
              By using FixMate, you agree to treat service providers and customers with mutual respect and fairness.
            </Text>
            <Text style={styles.policyText}>
              1. Bookings must be requested and managed through the official FixMate platform.
              {"\n"}2. Cancellations should be made at least 2 hours prior to scheduled appointment time.
              {"\n"}3. Service providers are responsible for delivering safe and qualified craftsmanship.
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* LOCATION EDITOR MODAL */}
      {showLocationModal && <LocationEditor onClose={() => setShowLocationModal(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 36,
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
  },
  headerRow: {
    paddingVertical: 12,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  // Profile Header Card
  profileHeaderCard: {
    alignItems: "center",
    backgroundColor: COLORS.cardBg,
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginBottom: 16,
    ...SHADOWS.small,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  avatarContainer: {
    width: 96,
    height: 96,
    borderRadius: 24,
    position: "relative",
    marginBottom: 14,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 24,
    resizeMode: "cover",
  },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: 24,
    backgroundColor: "#F3E8FF",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 32,
    fontWeight: "800",
    color: COLORS.primary,
  },
  cameraBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  userName: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  userRoleText: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4,
    fontWeight: "500",
  },
  // Menu Container
  menuContainer: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 16,
    ...SHADOWS.small,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 14,
  },
  menuIconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#F3E8FF",
    alignItems: "center",
    justifyContent: "center",
  },
  menuItemText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  menuDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginLeft: 56,
  },
  // Edit Profile Modal (Image 2 style)
  editHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  editBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  editHeaderTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  editScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    maxWidth: 600,
    width: "100%",
    alignSelf: "center",
  },
  styledInputContainer: {
    borderWidth: 1.5,
    borderColor: "#3B82F6",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 16,
    backgroundColor: "#FFFFFF",
  },
  styledInputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#3B82F6",
    marginBottom: 2,
  },
  styledInput: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textPrimary,
    paddingVertical: 4,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  errorText: {
    color: COLORS.error,
    fontSize: 13,
    fontWeight: "700",
    marginVertical: 8,
  },
  // Location & Password Sheet Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "90%",
    paddingHorizontal: 20,
    paddingTop: 20,
    maxWidth: 600,
    width: "100%",
    alignSelf: "center",
  },
  modalSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalSheetTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  modalSheetSub: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: 16,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  gpsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F3E8FF",
    borderWidth: 1,
    borderColor: "#DDD6FE",
    borderRadius: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  gpsBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.primary,
  },
  policyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  policyText: {
    fontSize: 14,
    color: COLORS.textMuted,
    lineHeight: 22,
    marginBottom: 16,
  },
});

