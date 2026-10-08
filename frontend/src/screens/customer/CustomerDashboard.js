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
  Image,
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
} catch (_e) {
  console.log("react-native-maps fallback");
}

const DEFAULT_REGION = {
  latitude: 6.9271,
  longitude: 79.8612,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const CATEGORIES = [
  { id: "plumbing", name: "Plumbing", icon: "pipe-leak", pros: "240+ pros", bg: "#E0F2FE", iconColor: "#0284C7" },
  { id: "electrical", name: "Electrical", icon: "lightning-bolt-outline", pros: "186+ pros", bg: "#FEF3C7", iconColor: "#D97706" },
  { id: "cleaning", name: "Cleaning", icon: "spray-bottle", pros: "310+ pros", bg: "#F3E8FF", iconColor: COLORS.primary },
  { id: "painting", name: "Painting", icon: "format-paint", pros: "128+ pros", bg: "#E0E7FF", iconColor: "#4F46E5" },
  { id: "gardening", name: "Gardening", icon: "leaf-outline", pros: "94+ pros", bg: "#DCFCE7", iconColor: "#16A34A" },
  { id: "appliance", name: "Appliance Repair", icon: "washing-machine", pros: "112+ pros", bg: "#FFE4E6", iconColor: "#E11D48" },
];

const POPULAR_SERVICES = [
  {
    id: "tap",
    title: "Leaking tap repair",
    category: "Plumbing",
    duration: "Avg. 45 min",
    price: "Rs. 2,500",
    rating: 4.8,
    reviews: "1,240",
    image: require("../../../assets/images/Home/Leaking tap repair.jpg"),
  },
  {
    id: "clean",
    title: "Full home deep clean",
    category: "Cleaning",
    duration: "Avg. 4 hrs",
    price: "Rs. 12,000",
    rating: 4.9,
    reviews: "3,820",
    image: require("../../../assets/images/Home/full home deep clean.jpg"),
  },
  {
    id: "fan",
    title: "Ceiling fan repair",
    category: "Electrical",
    duration: "Avg. 1 hr",
    price: "Rs. 1,800",
    rating: 4.7,
    reviews: "950",
    image: require("../../../assets/images/Home/Ceiling fan repair.jpg"),
  },
  {
    id: "paint",
    title: "Single room painting",
    category: "Painting",
    duration: "Avg. 1 day",
    price: "Rs. 15,000",
    rating: 4.9,
    reviews: "2,150",
    image: require("../../../assets/images/Home/Single room painting.jpg"),
  },
];

const NEARBY_PROS = [
  {
    id: "p1",
    name: "Arjun Perera",
    category: "Plumbing",
    distance: "1.2 km",
    rating: 4.8,
    jobs: 412,
    image: require("../../../assets/images/Home/Arjun perera.jpg"),
  },
  {
    id: "p2",
    name: "Sanduni Rathnayake",
    category: "Cleaning",
    distance: "2.4 km",
    rating: 4.9,
    jobs: 268,
    image: require("../../../assets/images/Home/Sanduni rathnayake.jpg"),
  },
  {
    id: "p3",
    name: "Lasantha Kumara",
    category: "Appliance Repair",
    distance: "3.1 km",
    rating: 4.7,
    jobs: 190,
    image: require("../../../assets/images/Home/Appliance repair.jpg"),
  },
];

const getInitials = (name = "") => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
};

const CustomerDashboard = ({ navigation }) => {
  const { user, updateUserLocation } = useAuth();
  const insets = useSafeAreaInsets();

  // Category Filter State for Popular Services
  const [activeTab, setActiveTab] = useState("All");

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

  // GPS Location fetch
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
    } catch (_err) {
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
    setShowLocationModal(false);
    setShowInnerMap(true);
  };

  const confirmInnerMap = () => {
    setLocLat(tempCoords.latitude);
    setLocLng(tempCoords.longitude);
    setShowInnerMap(false);
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
    } catch (_err) {
      Alert.alert("Error", "Failed to update location.");
    } finally {
      setSavingLocation(false);
    }
  };

  const filteredPopularServices = activeTab === "All"
    ? POPULAR_SERVICES
    : POPULAR_SERVICES.filter((s) => s.category.toLowerCase() === activeTab.toLowerCase());

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero Section */}
        <View style={[styles.hero, { paddingTop: insets.top + 16 }]}>
          <View style={styles.heroTop}>
            <View style={styles.userInfoRow}>
              <View style={styles.userAvatar}>
                <Text style={styles.userAvatarText}>{getInitials(user?.name || "Andrew Ainsley")}</Text>
              </View>
              <View style={styles.heroText}>
                <Text style={styles.greetingSub}>Good Morning 👋</Text>
                <Text style={styles.greetingName}>{user?.name || "Andrew Ainsley"}</Text>
              </View>
            </View>

            <View style={styles.headerIconsRow}>
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={() => comingSoon("Bookmarks")}
                accessibilityRole="button"
                accessibilityLabel="Saved bookmarks"
              >
                <MaterialCommunityIcons name="bookmark-outline" size={22} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={() => navigation.navigate("Bookings")}
                accessibilityRole="button"
                accessibilityLabel="Booking notifications"
              >
                <MaterialCommunityIcons name="bell-outline" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Location Bar */}
          <TouchableOpacity
            style={styles.locationRow}
            onPress={openLocationModal}
            accessibilityRole="button"
            accessibilityLabel={`Location ${displayLocation}`}
          >
            <MaterialCommunityIcons name="map-marker" size={16} color="#FFFFFF" />
            <Text style={styles.locationText} numberOfLines={1}>
              {displayLocation}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={16} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Search Bar */}
          <TouchableOpacity
            style={styles.search}
            activeOpacity={0.9}
            onPress={goExplore}
            accessibilityRole="search"
            accessibilityLabel="Search for a service"
          >
            <MaterialCommunityIcons name="magnify" size={22} color={COLORS.primary} />
            <Text style={styles.searchText}>Search services, repairs, cleaning...</Text>
            <View style={styles.searchFilterBadge}>
              <MaterialCommunityIcons name="tune-variant" size={18} color={COLORS.primary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Service categories */}
        <View style={styles.categoriesCard}>
          <View style={styles.sectionRow}>
            <Text style={styles.cardTitle}>Services</Text>
            <TouchableOpacity onPress={goExplore} accessibilityRole="link">
              <Text style={styles.link}>See All</Text>
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
                <View style={[styles.categoryIconCircle, { backgroundColor: c.bg }]}>
                  <MaterialCommunityIcons name={c.icon} size={26} color={c.iconColor} />
                </View>
                <Text style={styles.categoryName}>{c.name}</Text>
                <Text style={styles.categoryPros}>{c.pros}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Popular services */}
        <View style={[styles.sectionRow, styles.sectionPad, { marginTop: 24 }]}>
          <Text style={styles.sectionTitle}>Most Popular Services</Text>
          <TouchableOpacity style={styles.linkRow} onPress={goExplore} accessibilityRole="link">
            <Text style={styles.link}>See All</Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* Category Filter Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterTabsList}
        >
          {["All", "Cleaning", "Plumbing", "Electrical", "Painting"].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.filterTab,
                activeTab === tab && styles.filterTabActive,
              ]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  activeTab === tab && styles.filterTabTextActive,
                ]}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.serviceList}
        >
          {filteredPopularServices.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={styles.serviceCard}
              activeOpacity={0.88}
              onPress={goExplore}
              accessibilityRole="button"
              accessibilityLabel={s.title}
            >
              <View style={styles.serviceImageContainer}>
                <Image source={s.image} style={styles.serviceImage} />
                <TouchableOpacity
                  style={styles.bookmarkBadge}
                  onPress={() => comingSoon("Bookmark")}
                >
                  <MaterialCommunityIcons name="bookmark-outline" size={16} color={COLORS.primary} />
                </TouchableOpacity>
              </View>

              <View style={styles.serviceContent}>
                <Text style={styles.serviceCategoryTag}>{s.category}</Text>
                <Text style={styles.serviceTitle} numberOfLines={1}>
                  {s.title}
                </Text>
                <Text style={styles.servicePrice}>{s.price}</Text>

                <View style={styles.serviceMetaRow}>
                  <View style={styles.ratingBox}>
                    <MaterialCommunityIcons name="star" size={13} color="#F59E0B" />
                    <Text style={styles.serviceRatingText}>{s.rating.toFixed(1)}</Text>
                  </View>
                  <Text style={styles.serviceReviewsText}>({s.reviews})</Text>
                  <Text style={styles.serviceDot}>·</Text>
                  <Text style={styles.serviceDuration}>{s.duration}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Nearby professionals */}
        <View style={[styles.sectionRow, styles.sectionPad, styles.nearbyHeader]}>
          <Text style={styles.sectionTitle}>Nearby Professionals</Text>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => comingSoon("Map view")}
            accessibilityRole="link"
          >
            <Text style={styles.link}>View Map</Text>
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
              <Image source={p.image} style={styles.proImage} />
              <View style={styles.proInfo}>
                <Text style={styles.proName}>{p.name}</Text>
                <Text style={styles.proMeta}>
                  {p.category} · {p.distance} away
                </Text>
                <View style={styles.proStatsRow}>
                  <View style={styles.proRatingBadge}>
                    <MaterialCommunityIcons name="star" size={12} color="#F59E0B" />
                    <Text style={styles.proRatingText}>{p.rating.toFixed(1)}</Text>
                  </View>
                  <Text style={styles.proJobsText}>({p.jobs} jobs completed)</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.proBookmarkBtn}
                onPress={() => comingSoon("Bookmark Pro")}
              >
                <MaterialCommunityIcons name="bookmark-outline" size={20} color={COLORS.primary} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* UPDATE LOCATION MODAL */}
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

                {locLat && locLng ? (
                  <View style={styles.coordsPreviewBox}>
                    <MaterialCommunityIcons name="check-circle" size={18} color={COLORS.success} />
                    <Text style={styles.coordsPreviewText}>
                      GPS Pin: {locLat.toFixed(4)}, {locLng.toFixed(4)}
                    </Text>
                  </View>
                ) : null}

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

      {/* INNER MAP PICKER MODAL */}
      <Modal
        visible={showInnerMap}
        animationType="slide"
        onRequestClose={() => {
          setShowInnerMap(false);
          setShowLocationModal(true);
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.secondary }}>
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
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  // Hero Section
  hero: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingBottom: 44,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  userInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatarText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  heroText: {
    flex: 1,
  },
  greetingSub: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.8)",
    fontWeight: "600",
  },
  greetingName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    marginTop: 1,
  },
  headerIconsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 14,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  locationText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
    maxWidth: 240,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    backgroundColor: COLORS.secondary,
    borderRadius: 18,
    paddingHorizontal: 16,
    marginTop: 4,
    gap: 10,
    ...SHADOWS.small,
  },
  searchText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.disabledText,
    fontWeight: "500",
  },
  searchFilterBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#F3E8FF",
    alignItems: "center",
    justifyContent: "center",
  },
  // Categories Card
  categoriesCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 24,
    marginHorizontal: 20,
    marginTop: -24,
    paddingTop: 18,
    paddingBottom: 10,
    paddingHorizontal: 16,
    ...SHADOWS.small,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  link: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.primary,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 18,
  },
  category: {
    width: "33.333%",
    alignItems: "center",
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  categoryIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  categoryName: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginTop: 8,
    textAlign: "center",
  },
  categoryPros: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    textAlign: "center",
  },
  // Sections
  sectionPad: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  nearbyHeader: {
    marginTop: 26,
    marginBottom: 14,
  },
  // Filter Tabs
  filterTabsList: {
    paddingHorizontal: 20,
    marginTop: 14,
    marginBottom: 12,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textMuted,
  },
  filterTabTextActive: {
    color: "#FFFFFF",
  },
  // Popular Services Cards
  serviceList: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 14,
  },
  serviceCard: {
    width: 220,
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F1F5F9",
    ...SHADOWS.small,
  },
  serviceImageContainer: {
    width: "100%",
    height: 125,
    backgroundColor: "#F1F5F9",
    position: "relative",
  },
  serviceImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  bookmarkBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  serviceContent: {
    padding: 12,
  },
  serviceCategoryTag: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  serviceTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginTop: 4,
  },
  servicePrice: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.primary,
    marginTop: 6,
  },
  serviceMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 4,
  },
  ratingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  serviceRatingText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1E293B",
  },
  serviceReviewsText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  serviceDot: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  serviceDuration: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  // Nearby Professionals
  proCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    ...SHADOWS.small,
  },
  proImage: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    resizeMode: "cover",
  },
  proInfo: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },
  proName: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  proMeta: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 3,
    fontWeight: "500",
  },
  proStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 6,
  },
  proRatingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3DC",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 3,
  },
  proRatingText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#B25E09",
  },
  proJobsText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: "500",
  },
  proBookmarkBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#F3E8FF",
    alignItems: "center",
    justifyContent: "center",
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
