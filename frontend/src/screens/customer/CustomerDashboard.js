import React, { useState } from "react";
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
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";

// Attempt to import react-native-maps safely
let MapView = null;
let Marker = null;
try {
  const Maps = require("react-native-maps");
  MapView = Maps.default;
  Marker = Maps.Marker;
} catch (e) {
  console.log("react-native-maps fallback");
}

const DEFAULT_REGION = {
  latitude: 6.9271,
  longitude: 79.8612,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const HAS_UNREAD_NOTIFICATIONS = true;

const CATEGORIES = [
  { id: "plumbing", name: "Plumbing", icon: "water-outline", pros: "240+ pros" },
  { id: "electrical", name: "Electrical", icon: "flash-outline", pros: "186+ pros" },
  { id: "cleaning", name: "Cleaning", icon: "spray-bottle", pros: "310+ pros" },
  { id: "painting", name: "Painting", icon: "brush", pros: "128+ pros" },
  { id: "gardening", name: "Gardening", icon: "leaf", pros: "94+ pros" },
  { id: "appliance", name: "Appliance Repair", icon: "washing-machine", pros: "112+ pros" },
];

const POPULAR_SERVICES = [
  { id: "tap", title: "Leaking tap repair", icon: "water-outline", duration: "Avg. 45 min", price: "Rs. 2,500" },
  { id: "clean", title: "Full home deep clean", icon: "spray-bottle", duration: "Avg. 4 hrs", price: "Rs. 12,000" },
  { id: "fan", title: "Ceiling fan repair", icon: "fan", duration: "Avg. 1 hr", price: "Rs. 1,800" },
  { id: "paint", title: "Single room painting", icon: "brush", duration: "Avg. 1 day", price: "Rs. 15,000" },
];

const NEARBY_PROS = [
  { id: "p1", name: "Arjun Perera", category: "Plumbing", distance: "1.2 km", rating: 4.8, jobs: 412 },
  { id: "p2", name: "Sanduni Rathnayake", category: "Cleaning", distance: "2.4 km", rating: 4.9, jobs: 268 },
  { id: "p3", name: "Lasantha Kumara", category: "Appliance Repair", distance: "3.1 km", rating: 4.7, jobs: 190 },
];

const getInitials = (name = "") => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
};

const CustomerDashboard = ({ navigation }) => {
  const { user, updateUserLocation } = useAuth();
  const insets = useSafeAreaInsets();
  const firstName = (user?.name || "there").trim().split(/\s+/)[0];

  // Update Location Modal State
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locAddress, setLocAddress] = useState(user?.location?.address || "");
  const [locCity, setLocCity] = useState(user?.location?.city || "");
  const [locLat, setLocLat] = useState(user?.location?.latitude || null);
  const [locLng, setLocLng] = useState(user?.location?.longitude || null);
  const [savingLocation, setSavingLocation] = useState(false);
  const [gpsFetching, setGpsFetching] = useState(false);

  // Inner Map Modal State
  const [showInnerMap, setShowInnerMap] = useState(false);
  const [tempCoords, setTempCoords] = useState(DEFAULT_REGION);

  const goExplore = () => navigation.navigate("Explore");
  const comingSoon = (title) => Alert.alert(title, "Coming soon.");

  // Location display string fetched from database session
  const displayLocation = user?.location?.address
    ? user?.location?.city
      ? `${user.location.address}, ${user.location.city}`
      : user.location.address
    : user?.location?.city || "Set your location";

  const openLocationModal = () => {
    setLocAddress(user?.location?.address || "");
    setLocCity(user?.location?.city || "");
    setLocLat(user?.location?.latitude || null);
    setLocLng(user?.location?.longitude || null);
    setShowLocationModal(true);
  };

  // GPS Location fetch (coordinates only!)
  const handleFetchGps = async () => {
    try {
      setGpsFetching(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Location permission was denied.");
        setGpsFetching(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocLat(pos.coords.latitude);
      setLocLng(pos.coords.longitude);
      Alert.alert(
        "GPS Coordinates Saved 📍",
        `Latitude: ${pos.coords.latitude.toFixed(5)}, Longitude: ${pos.coords.longitude.toFixed(5)}`
      );
    } catch (err) {
      Alert.alert("GPS Error", "Failed to retrieve GPS location.");
    } finally {
      setGpsFetching(false);
    }
  };

  const openInnerMap = () => {
    setTempCoords({
      latitude: locLat || DEFAULT_REGION.latitude,
      longitude: locLng || DEFAULT_REGION.longitude,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    });
    // Close the location input modal first so the full-screen Map Modal is presented cleanly without overlay conflicts
    setShowLocationModal(false);
    setShowInnerMap(true);
  };

  const confirmInnerMap = () => {
    setLocLat(tempCoords.latitude);
    setLocLng(tempCoords.longitude);
    setShowInnerMap(false);
    // Re-open location form modal after map coordinate selection
    setShowLocationModal(true);
    Alert.alert(
      "Map Coordinates Saved 📍",
      `Latitude: ${tempCoords.latitude.toFixed(5)}, Longitude: ${tempCoords.longitude.toFixed(5)}`
    );
  };

  // Save location to MongoDB backend
  const handleSaveLocation = async () => {
    if (!locAddress.trim() && !locCity.trim()) {
      Alert.alert("Input Required", "Please enter your street address or city.");
      return;
    }

    try {
      setSavingLocation(true);
      const res = await updateUserLocation({
        address: locAddress.trim(),
        city: locCity.trim(),
        latitude: locLat,
        longitude: locLng,
      });

      if (res.success) {
        setShowLocationModal(false);
        Alert.alert("Success 🎉", "Your location has been updated successfully.");
      } else {
        Alert.alert("Update Failed", res.message || "Could not update location.");
      }
    } catch (err) {
      Alert.alert("Error", "Failed to update location.");
    } finally {
      setSavingLocation(false);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero */}
        <View style={[styles.hero, { paddingTop: insets.top + 16 }]}>
          <View style={styles.heroTop}>
            <View style={styles.heroText}>
              <Text style={styles.greeting}>Hello, {firstName}</Text>
              
              {/* Dynamic Location Header fetched from DB */}
              <TouchableOpacity
                style={styles.locationRow}
                onPress={openLocationModal}
                accessibilityRole="button"
                accessibilityLabel={`Location ${displayLocation}`}
              >
                <MaterialCommunityIcons
                  name="map-marker"
                  size={18}
                  color="#FFFFFF"
                />
                <Text style={styles.locationText} numberOfLines={1}>
                  {displayLocation}
                </Text>
                <MaterialCommunityIcons
                  name="chevron-down"
                  size={18}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.bell}
              onPress={() => comingSoon("Notifications")}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
            >
              <MaterialCommunityIcons name="bell-outline" size={22} color="#FFFFFF" />
              {HAS_UNREAD_NOTIFICATIONS && <View style={styles.bellDot} />}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.search}
            activeOpacity={0.9}
            onPress={goExplore}
            accessibilityRole="search"
            accessibilityLabel="Search for a service"
          >
            <MaterialCommunityIcons name="magnify" size={24} color={COLORS.primary} />
            <Text style={styles.searchText}>What service do you need?</Text>
          </TouchableOpacity>
        </View>

        {/* Service categories (overlaps the hero) */}
        <View style={styles.categoriesCard}>
          <View style={styles.sectionRow}>
            <Text style={styles.cardTitle}>Service categories</Text>
            <TouchableOpacity onPress={goExplore} accessibilityRole="link">
              <Text style={styles.link}>See all</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.categoryGrid}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={styles.category}
                activeOpacity={0.8}
                onPress={goExplore}
                accessibilityRole="button"
                accessibilityLabel={`${c.name}, ${c.pros}`}
              >
                <View style={styles.categoryIcon}>
                  <MaterialCommunityIcons name={c.icon} size={24} color={COLORS.primary} />
                </View>
                <Text style={styles.categoryName}>{c.name}</Text>
                <Text style={styles.categoryPros}>{c.pros}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Popular services */}
        <View style={[styles.sectionRow, styles.sectionPad]}>
          <Text style={styles.sectionTitle}>Popular services</Text>
          <TouchableOpacity style={styles.linkRow} onPress={goExplore} accessibilityRole="link">
            <Text style={styles.link}>See all</Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.serviceList}
        >
          {POPULAR_SERVICES.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={styles.serviceCard}
              activeOpacity={0.85}
              onPress={goExplore}
              accessibilityRole="button"
              accessibilityLabel={s.title}
            >
              <View style={styles.serviceIcon}>
                <MaterialCommunityIcons name={s.icon} size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.serviceTitle}>{s.title}</Text>
              <Text style={styles.serviceMeta}>{s.duration}</Text>
              <Text style={styles.servicePrice}>from {s.price}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Nearby professionals */}
        <View style={[styles.sectionRow, styles.sectionPad, styles.nearbyHeader]}>
          <Text style={styles.sectionTitle}>Nearby professionals</Text>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => comingSoon("Map view")}
            accessibilityRole="link"
          >
            <Text style={styles.link}>View map</Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.sectionPad}>
          {NEARBY_PROS.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={styles.proCard}
              activeOpacity={0.85}
              onPress={() => comingSoon(p.name)}
              accessibilityRole="button"
              accessibilityLabel={`${p.name}, ${p.category}, ${p.distance} away`}
            >
              <View style={styles.proAvatar}>
                <Text style={styles.proAvatarText}>{getInitials(p.name)}</Text>
              </View>
              <View style={styles.proInfo}>
                <Text style={styles.proName}>{p.name}</Text>
                <Text style={styles.proMeta}>
                  {p.category} · {p.distance} away
                </Text>
              </View>
              <View style={styles.proRating}>
                <MaterialCommunityIcons name="star" size={14} color="#F59E0B" />
                <Text style={styles.proRatingText}>{p.rating.toFixed(1)}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* --------------------------------------------------------------------------- */}
      {/* UPDATE LOCATION MODAL                                                       */}
      {/* --------------------------------------------------------------------------- */}
      <Modal
        visible={showLocationModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowLocationModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderTitleRow}>
                  <View style={styles.modalIconCircle}>
                    <MaterialCommunityIcons name="map-marker-radius" size={22} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>Update Your Location</Text>
                    <Text style={styles.modalSub}>Edit address or select GPS/Map coordinates</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setShowLocationModal(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <MaterialCommunityIcons name="close" size={20} color={COLORS.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={{ marginVertical: 14 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* Street Address */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Street Address</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. No. 123, Main Street"
                    placeholderTextColor="#94A3B8"
                    value={locAddress}
                    onChangeText={setLocAddress}
                  />
                </View>

                {/* City */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>City / Town</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Colombo 05, Kandy, Galle"
                    placeholderTextColor="#94A3B8"
                    value={locCity}
                    onChangeText={setLocCity}
                  />
                </View>

                {/* GPS & Map Buttons */}
                <View style={styles.locationBtnsRow}>
                  <TouchableOpacity style={styles.gpsBtn} onPress={handleFetchGps} disabled={gpsFetching}>
                    {gpsFetching ? (
                      <ActivityIndicator color={COLORS.primary} size="small" />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="crosshairs-gps" size={18} color={COLORS.primary} />
                        <Text style={styles.gpsBtnText}>Use Device GPS</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.mapBtn} onPress={openInnerMap}>
                    <MaterialCommunityIcons name="map-marker-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.mapBtnText}>Choose on Map</Text>
                  </TouchableOpacity>
                </View>

                {/* Coordinates Preview */}
                {locLat && locLng ? (
                  <View style={styles.coordsPreviewBox}>
                    <MaterialCommunityIcons name="check-circle" size={18} color={COLORS.success} />
                    <Text style={styles.coordsPreviewText}>
                      GPS Pin: {locLat.toFixed(4)}, {locLng.toFixed(4)}
                    </Text>
                  </View>
                ) : null}

                {/* Save Button */}
                <TouchableOpacity
                  style={styles.saveLocBtn}
                  onPress={handleSaveLocation}
                  disabled={savingLocation}
                >
                  {savingLocation ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveLocBtnText}>Save Location</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* --------------------------------------------------------------------------- */}
      {/* INNER MAP PICKER MODAL                                                      */}
      {/* --------------------------------------------------------------------------- */}
      <Modal
        visible={showInnerMap}
        animationType="slide"
        onRequestClose={() => {
          setShowInnerMap(false);
          setShowLocationModal(true);
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.secondary }}>
          {/* Header */}
          <View style={styles.innerMapHeader}>
            <TouchableOpacity
              style={styles.innerMapCloseBtn}
              onPress={() => {
                setShowInnerMap(false);
                setShowLocationModal(true);
              }}
            >
              <MaterialCommunityIcons name="close" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.innerMapTitle}>Select Pin Coordinates</Text>
              <Text style={styles.innerMapSub}>Tap map to position pin</Text>
            </View>
          </View>

          {/* Map View */}
          <View style={{ flex: 1, backgroundColor: "#F1F5F9" }}>
            {MapView ? (
              <MapView
                style={{ width: "100%", height: "100%" }}
                region={tempCoords}
                onPress={(e) => {
                  const c = e.nativeEvent?.coordinate || tempCoords;
                  setTempCoords((prev) => ({ ...prev, latitude: c.latitude, longitude: c.longitude }));
                }}
              >
                <Marker coordinate={{ latitude: tempCoords.latitude, longitude: tempCoords.longitude }} />
              </MapView>
            ) : (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <MaterialCommunityIcons name="map-marker" size={54} color={COLORS.primary} />
                <Text style={{ fontSize: 16, fontWeight: "700", marginTop: 10 }}>Map Pin Selector</Text>
              </View>
            )}
          </View>

          {/* Footer Controls */}
          <SafeAreaView edges={["bottom"]} style={{ backgroundColor: COLORS.secondary }}>
            <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: COLORS.inputBorder }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: COLORS.textPrimary, marginBottom: 12 }}>
                Coordinates: {tempCoords.latitude.toFixed(5)}, {tempCoords.longitude.toFixed(5)}
              </Text>
              <TouchableOpacity style={styles.saveLocBtn} onPress={confirmInnerMap}>
                <Text style={styles.saveLocBtnText}>Confirm Coordinates</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  scrollContent: {
    paddingBottom: 28
  },
  // Hero
  hero: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingBottom: 49
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between"
  },
  heroText: {
    flex: 1,
    paddingRight: 12
  },
  greeting: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF"
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  locationText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
    maxWidth: 220,
  },
  bell: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center"
  },
  bellDot: {
    position: "absolute",
    top: 9,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFFFFF"
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    backgroundColor: COLORS.secondary,
    borderRadius: 18,
    paddingHorizontal: 16,
    marginTop: 18,
    gap: 12
  },
  searchText: {
    fontSize: 15,
    color: COLORS.disabledText
  },
  // Categories card
  categoriesCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 26,
    marginHorizontal: 20,
    marginTop: -29,
    paddingTop: 18,
    paddingBottom: 8,
    paddingHorizontal: 16,
    ...SHADOWS.small
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.textPrimary
  },
  link: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.primary
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 18
  },
  category: {
    width: "33.333%",
    alignItems: "center",
    marginBottom: 20,
    paddingHorizontal: 4
  },
  categoryIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#EEEAFD",
    alignItems: "center",
    justifyContent: "center"
  },
  categoryName: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginTop: 10,
    textAlign: "center"
  },
  categoryPros: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
    textAlign: "center"
  },
  // Sections
  sectionPad: {
    paddingHorizontal: 20
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.textPrimary
  },
  nearbyHeader: {
    marginTop: 26,
    marginBottom: 14
  },
  // Popular services
  serviceList: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 4,
    gap: 12
  },
  serviceCard: {
    width: 172,
    minHeight: 160,
    backgroundColor: COLORS.cardBg,
    borderRadius: 22,
    padding: 16,
    ...SHADOWS.small
  },
  serviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#EEEAFD",
    alignItems: "center",
    justifyContent: "center"
  },
  serviceTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginTop: 18
  },
  serviceMeta: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4
  },
  servicePrice: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.primary,
    marginTop: "auto",
    paddingTop: 14
  },
  // Nearby professionals
  proCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    ...SHADOWS.small
  },
  proAvatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#EEEAFD",
    alignItems: "center",
    justifyContent: "center"
  },
  proAvatarText: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.primary
  },
  proInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8
  },
  proName: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.textPrimary
  },
  proMeta: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 3
  },
  proRating: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3DC",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 3
  },
  proRatingText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#B25E09",
  },

  // Location Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.secondary,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "90%",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.inputBorder,
  },
  modalHeaderTitleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingRight: 10,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  modalIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  modalSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  locationBtnsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  gpsBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F0FF",
    borderWidth: 1,
    borderColor: "#DDD6FE",
    borderRadius: 12,
    paddingVertical: 12,
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
    paddingVertical: 12,
    gap: 6,
  },
  mapBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  coordsPreviewBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DDF5EA",
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    gap: 6,
  },
  coordsPreviewText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.success,
  },
  saveLocBtn: {
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
  saveLocBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  innerMapHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.inputBorder,
    backgroundColor: COLORS.secondary,
  },
  innerMapCloseBtn: {
    padding: 6,
    marginRight: 10,
  },
  innerMapTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  innerMapSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});
export default CustomerDashboard;
