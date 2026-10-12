import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";

// Attempt to import react-native-maps safely
let MapView = null;
let Marker = null;
try {
  const Maps = require("react-native-maps");
  MapView = Maps.default;
  Marker = Maps.Marker;
} catch (e) {
  console.log("react-native-maps not natively supported in this environment, using interactive pin picker fallback.");
}

// Default initial map region (Colombo, Sri Lanka)
const DEFAULT_REGION = {
  latitude: 6.9271,
  longitude: 79.8612,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const SignupScreen = ({ navigation }) => {
  const { register } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("customer"); // 'customer' or 'provider'
  const [agreedTerms, setAgreedTerms] = useState(false);

  // Location State
  const [location, setLocation] = useState({
    address: "",
    city: "",
    district: "",
    latitude: null,
    longitude: null,
  });
  const [locationFetching, setLocationFetching] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);

  // Temporary location state during Map Modal interaction
  const [tempCoords, setTempCoords] = useState(DEFAULT_REGION);
  const [tempAddress, setTempAddress] = useState("");
  const [tempCity, setTempCity] = useState("");
  const [mapGeocoding, setMapGeocoding] = useState(false);

  // Map Location Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  const handleSearchLocation = async (overrideQuery) => {
    const q = (typeof overrideQuery === "string" ? overrideQuery : searchQuery).trim();
    if (!q) return;

    try {
      setSearchLoading(true);
      setSearchError("");

      const results = await Location.geocodeAsync(q);
      if (results && results.length > 0) {
        const { latitude, longitude } = results[0];
        setTempCoords({
          latitude,
          longitude,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        });
      } else {
        setSearchError(`No coordinates found for "${q}". Try another location.`);
      }
    } catch (err) {
      console.error("Geocode Search Error:", err);
      setSearchError("Failed to search location. Please check spelling or internet.");
    } finally {
      setSearchLoading(false);
    }
  };

  // Provider specific details & verification documents
  const CATEGORY_OPTIONS = [
    "Plumbing",
    "Electrical",
    "Cleaning",
    "Painting",
    "Gardening",
    "Appliance Repair",
    "Other",
  ];
  const [category, setCategory] = useState("Plumbing");
  const [customCategory, setCustomCategory] = useState("");
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [experience, setExperience] = useState("");
  const [nicFront, setNicFront] = useState("");
  const [nicBack, setNicBack] = useState("");
  const [certificates, setCertificates] = useState([]);

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // ---------------------------------------------------------------------------
  // Location Handlers (Fetch ONLY Latitude & Longitude)
  // ---------------------------------------------------------------------------
  const handleFetchCurrentLocation = async () => {
    try {
      setLocationFetching(true);
      setErrorMessage("");

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Permission to access device GPS location was denied. Please select your location on the map instead."
        );
        setLocationFetching(false);
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = pos.coords;

      // Only set latitude and longitude. Address is taken strictly from user's text input!
      setLocation((prev) => ({
        ...prev,
        latitude,
        longitude,
      }));

      Alert.alert(
        "GPS Coordinates Saved 📍",
        `Latitude: ${latitude.toFixed(5)}, Longitude: ${longitude.toFixed(5)}`
      );
    } catch (err) {
      console.error("GPS Fetch Error:", err);
      Alert.alert(
        "Location Fetch Failed",
        "Unable to retrieve phone location. Please tap 'Choose on Map' to select coordinates manually."
      );
    } finally {
      setLocationFetching(false);
    }
  };

  const openMapPicker = () => {
    const initialLat = location.latitude || DEFAULT_REGION.latitude;
    const initialLng = location.longitude || DEFAULT_REGION.longitude;

    setTempCoords({
      latitude: initialLat,
      longitude: initialLng,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    });
    setShowMapModal(true);
  };

  const handleMapPress = (e) => {
    const coords = e.nativeEvent?.coordinate || tempCoords;
    setTempCoords((prev) => ({
      ...prev,
      latitude: coords.latitude,
      longitude: coords.longitude,
    }));
  };

  const confirmMapLocation = () => {
    // Only set latitude and longitude from Map. Address is taken strictly from user's text input!
    setLocation((prev) => ({
      ...prev,
      latitude: tempCoords.latitude,
      longitude: tempCoords.longitude,
    }));
    setShowMapModal(false);
    setErrorMessage("");
    Alert.alert(
      "Map Coordinates Saved 📍",
      `Latitude: ${tempCoords.latitude.toFixed(5)}, Longitude: ${tempCoords.longitude.toFixed(5)}`
    );
  };

  // ---------------------------------------------------------------------------
  // Document Uploads
  // ---------------------------------------------------------------------------
  const pickImage = async (target) => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert(
          "Permission Required",
          "Permission to access photo library is required to upload verification documents!"
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.4,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        const base64Str = result.assets[0].base64
          ? `data:image/jpeg;base64,${result.assets[0].base64}`
          : imageUri;

        if (target === "nicFront") {
          setNicFront(base64Str);
        } else if (target === "nicBack") {
          setNicBack(base64Str);
        } else if (target === "cert") {
          setCertificates((prev) => [...prev, base64Str]);
        }
        setErrorMessage("");
      }
    } catch (err) {
      console.error("ImagePicker Error:", err);
      Alert.alert("Image Error", "Failed to select image. Please try again.");
    }
  };

  const removeCertificate = (index) => {
    setCertificates((prev) => prev.filter((_, i) => i !== index));
  };

  // ---------------------------------------------------------------------------
  // Validation & Submit
  // ---------------------------------------------------------------------------
  const validateForm = () => {
    if (!name.trim()) return "Full name is required";
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email))
      return "Please enter a valid email address";
    if (!phone.trim() || phone.trim().length < 8)
      return "Please enter a valid phone number";
    if (!location.address && !location.city)
      return "Please set your location via GPS or Map";
    if (!password || password.length < 6)
      return "Password must be at least 6 characters long";
    if (password !== confirmPassword) return "Passwords do not match";
    if (!role) return "Please select account role";

    if (role === "provider") {
      const selectedCat = category === "Other" ? customCategory.trim() : category.trim();
      if (!selectedCat) return "Please select or enter your service category";
      if (!nicFront) return "NIC Front Image is required for Service Providers";
      if (!nicBack) return "NIC Back Image is required for Service Providers";
    }

    if (!agreedTerms) return "You must accept the Terms & Conditions to proceed";
    return null;
  };

  const handleSignup = async () => {
    const error = validateForm();
    if (error) {
      setErrorMessage(error);
      return;
    }

    setErrorMessage("");
    setLoading(true);

    const finalCategory = category === "Other" ? customCategory.trim() : category.trim();

    const userData = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      password,
      role,
      location,
    };

    if (role === "provider") {
      userData.providerDetails = {
        category: finalCategory,
        experience: experience.trim(),
        nicFront,
        nicBack,
        certificates,
      };
    }

    const result = await register(userData);
    setLoading(false);

    if (result.success) {
      Alert.alert(
        "Account Created!",
        role === "provider"
          ? "Please verify the OTP code. Note: Your account will require Admin Review before you can log in."
          : "A 6-digit OTP verification code has been generated.",
        [
          {
            text: "Proceed to Verification",
            onPress: () =>
              navigation.navigate("OtpVerification", {
                identifier: email.trim(),
                role,
              }),
          },
        ]
      );
    } else {
      setErrorMessage(result.message || "Failed to create account");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.headerContainer}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>
              Join FixMate for seamless home services
            </Text>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            {errorMessage ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Role Selector */}
            <Text style={styles.label}>Select Account Type</Text>
            <View style={styles.roleContainer}>
              <TouchableOpacity
                style={[
                  styles.roleCard,
                  role === "customer" && styles.roleCardActive,
                ]}
                onPress={() => setRole("customer")}
              >
                <Text
                  style={[
                    styles.roleTitle,
                    role === "customer" && styles.roleTitleActive,
                  ]}
                >
                  Customer
                </Text>
                <Text
                  style={[
                    styles.roleSub,
                    role === "customer" && styles.roleSubActive,
                  ]}
                >
                  Book home services
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roleCard,
                  role === "provider" && styles.roleCardActive,
                ]}
                onPress={() => setRole("provider")}
              >
                <Text
                  style={[
                    styles.roleTitle,
                    role === "provider" && styles.roleTitleActive,
                  ]}
                >
                  Service Provider
                </Text>
                <Text
                  style={[
                    styles.roleSub,
                    role === "provider" && styles.roleSubActive,
                  ]}
                >
                  Offer services
                </Text>
              </TouchableOpacity>
            </View>

            {/* Full Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="John Doe"
                placeholderTextColor="#94A3B8"
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  setErrorMessage("");
                }}
              />
            </View>

            {/* Email Address */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="john@example.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setErrorMessage("");
                }}
              />
            </View>

            {/* Phone Number */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                placeholder="+94 77 123 4567"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={(text) => {
                  setPhone(text);
                  setErrorMessage("");
                }}
              />
            </View>

            {/* Location Section (Address Input + GPS + Map Picker) */}
            <View style={styles.locationSection}>
              <Text style={styles.label}>Location & Address *</Text>
              
              {/* Direct Street Address Input */}
              <View style={styles.inputGroup}>
                <TextInput
                  style={styles.input}
                  placeholder="Street Address (e.g. No. 123, Main Street)"
                  placeholderTextColor="#94A3B8"
                  value={location.address}
                  onChangeText={(text) => {
                    setLocation((prev) => ({ ...prev, address: text }));
                    setErrorMessage("");
                  }}
                />
              </View>

              {/* Direct City Input */}
              <View style={styles.inputGroup}>
                <TextInput
                  style={styles.input}
                  placeholder="City / Town (e.g. Colombo 03, Kandy, Galle)"
                  placeholderTextColor="#94A3B8"
                  value={location.city}
                  onChangeText={(text) => {
                    setLocation((prev) => ({ ...prev, city: text }));
                    setErrorMessage("");
                  }}
                />
              </View>

              {/* Action Buttons for Auto-detecting via GPS or Picking via Map */}
              <View style={styles.locationButtonsRow}>
                {/* GPS Location Button */}
                <TouchableOpacity
                  style={styles.gpsBtn}
                  onPress={handleFetchCurrentLocation}
                  disabled={locationFetching}
                >
                  {locationFetching ? (
                    <ActivityIndicator color={COLORS.primary} size="small" />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="crosshairs-gps" size={18} color={COLORS.primary} />
                      <Text style={styles.gpsBtnText}>Use Device GPS</Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Map Picker Button */}
                <TouchableOpacity
                  style={styles.mapBtn}
                  onPress={openMapPicker}
                >
                  <MaterialCommunityIcons name="map-marker-radius" size={18} color="#FFFFFF" />
                  <Text style={styles.mapBtnText}>Choose on Map</Text>
                </TouchableOpacity>
              </View>

              {/* Selected Location Summary Box */}
              {(location.address || location.city) ? (
                <View style={styles.selectedLocBox}>
                  <View style={styles.locCheckIcon}>
                    <MaterialCommunityIcons name="check-circle" size={20} color={COLORS.success} />
                  </View>
                  <View style={styles.locTextGroup}>
                    <Text style={styles.locAddressText} numberOfLines={2}>
                      {location.address || "Address set"}
                    </Text>
                    {!!location.city && (
                      <Text style={styles.locCityText}>City: {location.city}</Text>
                    )}
                    {location.latitude && location.longitude ? (
                      <Text style={styles.locCoordsText}>
                        GPS Pin: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ) : null}
            </View>

            {/* Provider Verification Fields */}
            {role === "provider" && (
              <View style={styles.providerBox}>
                <Text style={styles.providerBoxTitle}>
                  🛠️ Service Provider Verification Details
                </Text>

                {/* Service Category Dropdown */}
                <View style={[styles.inputGroup, { zIndex: 10 }]}>
                  <Text style={styles.label}>Service Category *</Text>
                  <TouchableOpacity
                    style={styles.dropdownSelector}
                    onPress={() => setShowCategoryDropdown((prev) => !prev)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.dropdownSelectorText}>{category}</Text>
                    <MaterialCommunityIcons
                      name={showCategoryDropdown ? "chevron-up" : "chevron-down"}
                      size={22}
                      color={COLORS.textPrimary}
                    />
                  </TouchableOpacity>

                  {showCategoryDropdown && (
                    <View style={styles.dropdownMenu}>
                      {CATEGORY_OPTIONS.map((opt) => (
                        <TouchableOpacity
                          key={opt}
                          style={[
                            styles.dropdownItem,
                            category === opt && styles.dropdownItemActive,
                          ]}
                          onPress={() => {
                            setCategory(opt);
                            setShowCategoryDropdown(false);
                          }}
                        >
                          <Text
                            style={[
                              styles.dropdownItemText,
                              category === opt && styles.dropdownItemTextActive,
                            ]}
                          >
                            {opt}
                          </Text>
                          {category === opt && (
                            <MaterialCommunityIcons
                              name="check"
                              size={18}
                              color={COLORS.primary}
                            />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* Custom Category Input if "Other" is selected */}
                {category === "Other" && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Specify Your Category *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. Carpentry, Roofing, AC Repair"
                      placeholderTextColor="#94A3B8"
                      value={customCategory}
                      onChangeText={setCustomCategory}
                    />
                  </View>
                )}

                {/* Experience */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Years of Experience</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 3 years"
                    placeholderTextColor="#94A3B8"
                    value={experience}
                    onChangeText={setExperience}
                  />
                </View>

                {/* NIC Front Image (Required) */}
                <View style={styles.docUploadGroup}>
                  <View style={styles.docHeader}>
                    <Text style={styles.label}>NIC Front Image *</Text>
                    <Text style={styles.requiredBadge}>REQUIRED</Text>
                  </View>
                  {nicFront ? (
                    <View style={styles.previewContainer}>
                      <Image
                        source={{ uri: nicFront }}
                        style={styles.imagePreview}
                      />
                      <TouchableOpacity
                        style={styles.changeImageBtn}
                        onPress={() => pickImage("nicFront")}
                      >
                        <Text style={styles.changeImageText}>Change Image</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.uploadBtn}
                      onPress={() => pickImage("nicFront")}
                    >
                      <Text style={styles.uploadBtnIcon}>📷</Text>
                      <Text style={styles.uploadBtnText}>
                        Upload NIC Front Photo
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* NIC Back Image (Required) */}
                <View style={styles.docUploadGroup}>
                  <View style={styles.docHeader}>
                    <Text style={styles.label}>NIC Back Image *</Text>
                    <Text style={styles.requiredBadge}>REQUIRED</Text>
                  </View>
                  {nicBack ? (
                    <View style={styles.previewContainer}>
                      <Image
                        source={{ uri: nicBack }}
                        style={styles.imagePreview}
                      />
                      <TouchableOpacity
                        style={styles.changeImageBtn}
                        onPress={() => pickImage("nicBack")}
                      >
                        <Text style={styles.changeImageText}>Change Image</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.uploadBtn}
                      onPress={() => pickImage("nicBack")}
                    >
                      <Text style={styles.uploadBtnIcon}>📷</Text>
                      <Text style={styles.uploadBtnText}>
                        Upload NIC Back Photo
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Certifications (Optional) */}
                <View style={styles.docUploadGroup}>
                  <View style={styles.docHeader}>
                    <Text style={styles.label}>Certifications & Documents</Text>
                    <Text style={styles.optionalBadge}>OPTIONAL</Text>
                  </View>
                  
                  {certificates.length > 0 && (
                    <View style={styles.certList}>
                      {certificates.map((cert, idx) => (
                        <View key={idx} style={styles.certItem}>
                          <Image
                            source={{ uri: cert }}
                            style={styles.certThumb}
                          />
                          <TouchableOpacity
                            style={styles.removeCertBtn}
                            onPress={() => removeCertificate(idx)}
                          >
                            <Text style={styles.removeCertText}>✕ Remove</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.uploadBtnSecondary}
                    onPress={() => pickImage("cert")}
                  >
                    <Text style={styles.uploadBtnIcon}>📜</Text>
                    <Text style={styles.uploadBtnTextSecondary}>
                      + Add Certificate Photo (Optional)
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="At least 6 characters"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setErrorMessage("");
                  }}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text style={styles.eyeText}>
                    {showPassword ? "Hide" : "Show"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Re-enter your password"
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showPassword}
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  setErrorMessage("");
                }}
              />
            </View>

            {/* Terms & Conditions Checkbox */}
            <TouchableOpacity
              style={styles.termsContainer}
              onPress={() => setAgreedTerms(!agreedTerms)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.checkbox,
                  agreedTerms && styles.checkboxSelected,
                ]}
              >
                {agreedTerms && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.termsText}>
                I agree to the{" "}
                <Text style={styles.termsLink}>Terms & Conditions</Text> and{" "}
                <Text style={styles.termsLink}>Privacy Policy</Text>
              </Text>
            </TouchableOpacity>

            {/* Create Account Button */}
            <TouchableOpacity
              style={styles.signupButton}
              onPress={handleSignup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.secondary} />
              ) : (
                <Text style={styles.signupButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer Link */}
          <View style={styles.footerContainer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate("Login")}>
              <Text style={styles.loginLinkText}>Login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* --------------------------------------------------------------------------- */}
      {/* INTERACTIVE MAP LOCATION PICKER MODAL                                       */}
      {/* --------------------------------------------------------------------------- */}
      <Modal
        visible={showMapModal}
        animationType="slide"
        onRequestClose={() => setShowMapModal(false)}
      >
        <SafeAreaView style={styles.mapModalArea}>
          {/* Modal Header */}
          <View style={styles.mapHeader}>
            <TouchableOpacity
              style={styles.mapCloseBtn}
              onPress={() => setShowMapModal(false)}
            >
              <MaterialCommunityIcons name="close" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <View style={styles.mapTitleGroup}>
              <Text style={styles.mapTitle}>Choose Location on Map</Text>
              <Text style={styles.mapSub}>Tap on the map or drag the pin to set location</Text>
            </View>
          </View>

          {/* Map View / Interactive Pin Container */}
          <View style={styles.mapContainer}>
            {/* Floating Search Bar Bar Overlay */}
            <View style={styles.mapSearchBarContainer}>
              <View style={styles.mapSearchInputWrap}>
                <MaterialCommunityIcons name="magnify" size={20} color={COLORS.textMuted} />
                <TextInput
                  style={styles.mapSearchInput}
                  placeholder="Search city, area, or address (e.g. Kandy)"
                  placeholderTextColor={COLORS.disabledText}
                  value={searchQuery}
                  onChangeText={(text) => {
                    setSearchQuery(text);
                    if (searchError) setSearchError("");
                  }}
                  onSubmitEditing={() => handleSearchLocation()}
                  returnKeyType="search"
                />
                {searchQuery ? (
                  <TouchableOpacity
                    onPress={() => {
                      setSearchQuery("");
                      setSearchError("");
                    }}
                    style={{ padding: 4 }}
                  >
                    <MaterialCommunityIcons name="close-circle" size={18} color={COLORS.disabledText} />
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={styles.mapSearchSubmitBtn}
                  onPress={() => handleSearchLocation()}
                  disabled={searchLoading}
                >
                  {searchLoading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.mapSearchSubmitText}>Search</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Quick City Chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.cityChipsRow}
              >
                {["Colombo", "Kandy", "Galle", "Negombo", "Jaffna", "Kurunegala"].map((city) => (
                  <TouchableOpacity
                    key={city}
                    style={styles.cityChip}
                    onPress={() => {
                      setSearchQuery(city);
                      handleSearchLocation(city);
                    }}
                  >
                    <MaterialCommunityIcons name="map-marker" size={13} color={COLORS.primary} />
                    <Text style={styles.cityChipText}>{city}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {searchError ? (
                <View style={styles.searchErrorBox}>
                  <Text style={styles.searchErrorText}>{searchError}</Text>
                </View>
              ) : null}
            </View>

            {MapView ? (
              <MapView
                style={styles.mapElement}
                region={tempCoords}
                onPress={handleMapPress}
              >
                <Marker
                  coordinate={{
                    latitude: tempCoords.latitude,
                    longitude: tempCoords.longitude,
                  }}
                  title="Selected Location"
                  description={tempAddress}
                  draggable
                  onDragEnd={handleMapPress}
                />
              </MapView>
            ) : (
              /* Fallback Pin Location View if native map is unavailable */
              <View style={styles.mapFallbackContainer}>
                <MaterialCommunityIcons name="map-marker-check" size={54} color={COLORS.primary} />
                <Text style={styles.fallbackTitle}>Interactive Location Pin</Text>
                <Text style={styles.fallbackSub}>
                  Enter or edit city & street details below:
                </Text>

                <View style={styles.fallbackInputWrap}>
                  <Text style={styles.fallbackLabel}>City / Area Name</Text>
                  <TextInput
                    style={styles.fallbackInput}
                    value={tempCity}
                    onChangeText={setTempCity}
                    placeholder="e.g. Colombo 03, Kandy, Galle"
                  />
                </View>

                <View style={styles.fallbackInputWrap}>
                  <Text style={styles.fallbackLabel}>Street / Full Address</Text>
                  <TextInput
                    style={styles.fallbackInput}
                    value={tempAddress}
                    onChangeText={setTempAddress}
                    placeholder="e.g. Main Street, House No. 45"
                  />
                </View>
              </View>
            )}

            {mapGeocoding && (
              <View style={styles.geocodingOverlay}>
                <ActivityIndicator color={COLORS.primary} />
                <Text style={styles.geocodingText}>Resolving address details...</Text>
              </View>
            )}
          </View>

          {/* Location Summary Footer */}
          <View style={styles.mapFooter}>
            <View style={styles.mapFooterAddressBox}>
              <MaterialCommunityIcons name="map-marker-account" size={22} color={COLORS.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.mapFooterTitle}>
                  Selected Coordinates
                </Text>
                <Text style={styles.mapFooterAddress} numberOfLines={2}>
                  Lat: {tempCoords.latitude.toFixed(5)}, Lng: {tempCoords.longitude.toFixed(5)}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.confirmMapBtn}
              onPress={confirmMapLocation}
            >
              <Text style={styles.confirmMapBtnText}>Confirm Pin Coordinates</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.secondary,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
  },
  headerContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  formContainer: {
    width: "100%",
  },
  errorContainer: {
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 14,
    textAlign: "center",
    fontWeight: "500",
  },
  roleContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  roleCard: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    borderRadius: 14,
    padding: 14,
    backgroundColor: COLORS.inputBg,
  },
  roleCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: "#F4F0FF",
  },
  roleTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  roleTitleActive: {
    color: COLORS.primary,
  },
  roleSub: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  roleSubActive: {
    color: COLORS.primary,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.textPrimary,
  },

  // Location Styles
  locationSection: {
    marginBottom: 20,
  },
  locationButtonsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  gpsBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F0FF",
    borderWidth: 1.5,
    borderColor: "#DDD6FE",
    borderRadius: 12,
    paddingVertical: 14,
    gap: 6,
  },
  gpsBtnText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  mapBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 6,
  },
  mapBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  selectedLocBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DDF5EA",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
  },
  locCheckIcon: {
    marginRight: 10,
  },
  locTextGroup: {
    flex: 1,
  },
  locAddressText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  locCityText: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
    fontWeight: "600",
  },
  locCoordsText: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  providerBox: {
    backgroundColor: "#F8F7FF",
    borderWidth: 1.5,
    borderColor: "#DDD6FE",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  providerBoxTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: COLORS.primary,
    marginBottom: 16,
  },
  docUploadGroup: {
    marginBottom: 18,
  },
  docHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  requiredBadge: {
    fontSize: 10,
    fontWeight: "bold",
    color: COLORS.error,
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  optionalBadge: {
    fontSize: 10,
    fontWeight: "bold",
    color: COLORS.textMuted,
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.secondary,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderStyle: "dashed",
    borderRadius: 12,
    paddingVertical: 14,
  },
  uploadBtnIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  uploadBtnText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "bold",
  },
  uploadBtnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.secondary,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: 12,
    paddingVertical: 12,
  },
  uploadBtnTextSecondary: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  previewContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.secondary,
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
  },
  imagePreview: {
    width: 80,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  changeImageBtn: {
    backgroundColor: "#F4F0FF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  changeImageText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "bold",
  },
  certList: {
    gap: 8,
    marginBottom: 10,
  },
  certItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.secondary,
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
  },
  certThumb: {
    width: 50,
    height: 50,
    borderRadius: 6,
    marginRight: 10,
  },
  removeCertBtn: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  removeCertText: {
    color: COLORS.error,
    fontSize: 12,
    fontWeight: "bold",
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: 12,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  eyeButton: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  eyeText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "600",
  },
  termsContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    marginTop: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.inputBorder,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    backgroundColor: COLORS.secondary,
  },
  checkboxSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkmark: {
    color: COLORS.secondary,
    fontSize: 13,
    fontWeight: "bold",
  },
  termsText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    flex: 1,
  },
  termsLink: {
    color: COLORS.primary,
    fontWeight: "600",
  },
  signupButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  signupButtonText: {
    color: COLORS.secondary,
    fontSize: 16,
    fontWeight: "bold",
  },
  footerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
  },
  footerText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  loginLinkText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "bold",
  },

  // Map Modal Styles
  mapModalArea: {
    flex: 1,
    backgroundColor: COLORS.secondary,
  },
  mapHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.inputBorder,
  },
  mapCloseBtn: {
    padding: 6,
    marginRight: 10,
  },
  mapTitleGroup: {
    flex: 1,
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  mapSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  mapContainer: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    position: "relative",
  },
  mapSearchBarContainer: {
    position: "absolute",
    top: 12,
    left: 14,
    right: 14,
    zIndex: 20,
  },
  mapSearchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    gap: 8,
  },
  mapSearchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textPrimary,
    paddingVertical: 0,
  },
  mapSearchSubmitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mapSearchSubmitText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  cityChipsRow: {
    flexDirection: "row",
    gap: 6,
    paddingTop: 8,
    paddingBottom: 4,
  },
  cityChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cityChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  searchErrorBox: {
    backgroundColor: "#FEE2E2",
    borderRadius: 8,
    padding: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  searchErrorText: {
    color: COLORS.error,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  mapElement: {
    width: "100%",
    height: "100%",
  },
  mapFallbackContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  fallbackTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginTop: 12,
  },
  fallbackSub: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4,
    marginBottom: 20,
    textAlign: "center",
  },
  fallbackInputWrap: {
    width: "100%",
    marginBottom: 14,
  },
  fallbackLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  fallbackInput: {
    backgroundColor: COLORS.secondary,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  geocodingOverlay: {
    position: "absolute",
    top: 16,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  geocodingText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  mapFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.inputBorder,
    backgroundColor: COLORS.secondary,
  },
  mapFooterAddressBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  mapFooterTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  mapFooterAddress: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  confirmMapBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmMapBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },

  // Dropdown Styles
  dropdownSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dropdownSelectorText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  dropdownMenu: {
    marginTop: 6,
    backgroundColor: COLORS.secondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.inputBorder,
  },
  dropdownItemActive: {
    backgroundColor: "#F3F0FF",
  },
  dropdownItemText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: "500",
  },
  dropdownItemTextActive: {
    color: COLORS.primary,
    fontWeight: "700",
  },
});

export default SignupScreen;
