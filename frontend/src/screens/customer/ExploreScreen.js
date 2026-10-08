import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { bookingPrice } from '../../services/bookingService';
import ProviderProfileModal from "./ProviderProfileModal";
import * as Location from "expo-location";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../../context/AuthContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../../constants/theme";
import { getProvider, getProviders } from "../../services/providerService";
import { availabilityLabel, CATEGORIES, EMPTY_FILTERS, filterProviders, SORT_OPTIONS } from "../../utils/exploreProviders";

const PROVIDER_PHOTOS = {
  'Arjun perera': require('../../../assets/images/Home/Arjun perera.jpg'),
  'Sanduni rathnayake': require('../../../assets/images/Home/Sanduni rathnayake.jpg'),
  'Cleaning': require('../../../assets/images/Home/full home deep clean.jpg'),
  'Painting': require('../../../assets/images/Home/Single room painting.jpg'),
  'Plumbing': require('../../../assets/images/Home/Leaking tap repair.jpg'),
  'Electrical': require('../../../assets/images/Home/Appliance repair.jpg'),
  'Gardening': require('../../../assets/images/Home/full home deep clean.jpg'),
  'Appliance Repair': require('../../../assets/images/Home/Ceiling fan repair.jpg'),
};

const CATEGORY_ICONS = {
  'All': 'grid-outline',
  'Plumbing': 'water-outline',
  'Electrical': 'flash-outline',
  'Cleaning': 'sparkles-outline',
  'Painting': 'color-palette-outline',
  'Gardening': 'leaf-outline',
  'Appliance Repair': 'construct-outline',
};

const initials = name => (name || '').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
const priceText = bookingPrice;

function getProviderPhoto(p) {
  if (p.avatar) return { uri: p.avatar };
  if (p.name && PROVIDER_PHOTOS[p.name]) return PROVIDER_PHOTOS[p.name];
  if (p.category && PROVIDER_PHOTOS[p.category]) return PROVIDER_PHOTOS[p.category];
  return null;
}

function ProviderCard({ provider: p, onPress }) {
  const photo = getProviderPhoto(p);
  const nextTime = availabilityLabel(p.nextAvailableAt);
  const isAvailableToday = nextTime.startsWith("Today");

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View ${p.name}'s profile`}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed
      ]}
    >
      {/* Image Thumbnail */}
      <View style={styles.photoContainer}>
        {photo ? (
          <Image source={photo} style={styles.providerPhoto} contentFit="cover" />
        ) : (
          <View style={styles.photoFallback}>
            <Text style={styles.photoInitials}>{initials(p.name)}</Text>
          </View>
        )}
        {p.verified && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={18} color="#7F56D9" />
          </View>
        )}
      </View>

      {/* Card Info Content */}
      <View style={styles.cardBody}>
        {/* Name & Rating */}
        <View style={styles.rowBetween}>
          <Text style={styles.providerName} numberOfLines={1}>{p.name}</Text>
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={12} color="#F59E0B" />
            <Text style={styles.ratingText}>{p.rating == null ? "New" : p.rating.toFixed(1)}</Text>
            {p.reviewCount > 0 && <Text style={styles.reviewCountText}>({p.reviewCount})</Text>}
          </View>
        </View>

        {/* Category Tag */}
        <View style={styles.categoryBadgeRow}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{p.category}</Text>
          </View>
          {isAvailableToday && (
            <View style={styles.todayBadge}>
              <Text style={styles.todayBadgeText}>⚡ Available Today</Text>
            </View>
          )}
        </View>

        {/* Metadata: Location & Availability */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="location-outline" size={13} color="#6E6E76" />
            <Text style={styles.metaText} numberOfLines={1}>
              {p.distance != null ? `${p.distance.toFixed(1)} km away` : p.serviceArea || "Location not listed"}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={13} color="#6E6E76" />
            <Text style={styles.metaText} numberOfLines={1}>{nextTime}</Text>
          </View>
        </View>

        {/* Card Footer: Price & View Profile Link */}
        <View style={styles.cardFooter}>
          <Text style={styles.priceAmount}>{priceText(p)}</Text>
          <View style={styles.profileBtn}>
            <Text style={styles.profileBtnText}>View details</Text>
            <Ionicons name="chevron-forward" size={14} color="#7F56D9" />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function Sheet({ visible, title, onClose, children }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close dialog" accessibilityRole="button" />
        <View
          style={[styles.sheet, { paddingBottom: Math.max(24, insets.bottom), maxHeight: "90%" }]}
          accessibilityViewIsModal
        >
          <View style={styles.sheetHeader}>
            <Text accessibilityRole="header" style={styles.sheetTitle}>{title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close dialog" onPress={onClose} style={styles.close}>
              <Ionicons name="close" size={24} color="#6E6E76" />
            </Pressable>
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function ExploreScreen({ navigation, route }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(route?.params?.category || "All");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [draft, setDraft] = useState(EMPTY_FILTERS);
  const [filterError, setFilterError] = useState("");
  const [sheet, setSheet] = useState(null);
  const [sort, setSort] = useState("name");
  const [location, setLocation] = useState(user?.location?.latitude != null ? user.location : null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");

  const [profile, setProfile] = useState(null);
  const [profileId, setProfileId] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");

  useFocusEffect(useCallback(() => { if (route?.params?.category) setCategory(route.params.category); }, [route]));
  useFocusEffect(useCallback(() => { if (user?.location?.latitude != null) setLocation(user.location); }, [user]));

  const listRequest = useRef(null);
  const profileRequest = useRef(null);
  const mounted = useRef(false);

  const load = useCallback(() => {
    listRequest.current?.abort();
    const controller = new AbortController();
    listRequest.current = controller;
    return getProviders(controller.signal).then(result => {
      if (!controller.signal.aborted) {
        setProviders(result);
        setError("");
      }
    }).catch(e => {
      if (!controller.signal.aborted) setError(e.response?.data?.message || "We couldn’t load providers. Check your connection and try again.");
    }).finally(() => {
      if (!controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    });
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
      listRequest.current?.abort();
      profileRequest.current?.abort();
    };
  }, [load]);

  const categories = useMemo(() => [
    ...CATEGORIES,
    ...providers.map(p => p.category).filter((c, i, all) => !CATEGORIES.some(base => base.toLowerCase() === c.toLowerCase()) && all.indexOf(c) === i)
  ], [providers]);

  const results = useMemo(() => filterProviders(providers, {
    query,
    category,
    filters,
    sort,
    location
  }), [providers, query, category, filters, sort, location]);

  const filterCount = Number(filters.maxPrice !== "") + Number(filters.minRating > 0) + Number(filters.availableToday) + Number(!!filters.area.trim());

  const refresh = () => {
    setRefreshing(true);
    setError("");
    void load();
  };

  const reset = () => {
    setQuery("");
    setCategory("All");
    setFilters(EMPTY_FILTERS);
    setSort("name");
  };

  const close = () => {
    profileRequest.current?.abort();
    setSheet(null);
  };

  async function openProfile(id) {
    profileRequest.current?.abort();
    const controller = new AbortController();
    profileRequest.current = controller;
    setProfileId(id);
    setProfile(null);
    setProfileError("");
    setProfileLoading(true);
    setSheet("profile");
    try {
      const result = await getProvider(id, controller.signal);
      if (!controller.signal.aborted) setProfile(result);
    } catch (e) {
      if (!controller.signal.aborted) setProfileError(e.response?.data?.message || "Unable to load this profile. Please try again.");
    } finally {
      if (!controller.signal.aborted) setProfileLoading(false);
    }
  }

  async function chooseSort(value) {
    if (value !== "nearest" || location) {
      setSort(value);
      setSheet(null);
      return;
    }
    setLocating(true);
    setLocationError("");
    let timeout;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") throw new Error("Allow location access to sort by distance. You can still browse using another sort order.");
      const result = await Promise.race([Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      }), new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Location took too long. Please try again with location services enabled.")), 15000);
      })]);
      if (mounted.current) {
        setLocation(result.coords);
        setSort("nearest");
        setSheet(null);
      }
    } catch (e) {
      if (mounted.current) setLocationError(e.message || "Couldn’t get your location. Please try again.");
    } finally {
      clearTimeout(timeout);
      if (mounted.current) setLocating(false);
    }
  }

  function applyFilters() {
    const amount = draft.maxPrice.trim();
    if (amount !== "" && (!/^\d+(\.\d{1,2})?$/.test(amount) || !Number.isFinite(Number(amount)))) {
      setFilterError("Enter a valid price in LKR, or leave it empty.");
      return;
    }
    setFilters({
      ...draft,
      maxPrice: amount
    });
    setSheet(null);
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFD" />

      {/* Modern Fixed Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.titleGroup}>
          <Text style={styles.title}>Explore Services</Text>
          <Text style={styles.subtitle}>
            {loading ? "Finding verified professionals..." : `${results.length} verified professional${results.length === 1 ? "" : "s"} available`}
          </Text>
        </View>

        {/* Real-time Search Bar Row */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color="#7F56D9" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search services or providers..."
              placeholderTextColor="#98A2B3"
              accessibilityLabel="Search service or provider name"
              style={styles.searchInput}
              returnKeyType="search"
              autoCorrect={false}
            />
            {query !== "" && (
              <Pressable onPress={() => setQuery("")} accessibilityLabel="Clear search" accessibilityRole="button" hitSlop={10}>
                <Ionicons name="close-circle" size={18} color="#98A2B3" />
              </Pressable>
            )}
          </View>

          {/* Filter Button */}
          <Pressable
            onPress={() => {
              setDraft({ ...filters });
              setFilterError("");
              setSheet("filters");
            }}
            accessibilityRole="button"
            accessibilityLabel={`Filters, ${filterCount} active`}
            style={({ pressed }) => [
              styles.filterButton,
              filterCount > 0 && styles.filterButtonActive,
              pressed && styles.pressed
            ]}
          >
            <Ionicons name="options-outline" size={20} color={filterCount > 0 ? "#FFFFFF" : "#7F56D9"} />
            {filterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{filterCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Interactive Category Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}
          keyboardShouldPersistTaps="handled"
        >
          {categories.map(c => {
            const isSelected = category === c;
            const iconName = CATEGORY_ICONS[c] || 'build-outline';
            return (
              <Pressable
                key={c}
                onPress={() => setCategory(c)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                style={({ pressed }) => [
                  styles.categoryChip,
                  isSelected && styles.activeCategoryChip,
                  pressed && styles.pressed
                ]}
              >
                <Ionicons
                  name={iconName}
                  size={15}
                  color={isSelected ? "#FFFFFF" : "#7F56D9"}
                />
                <Text style={[styles.categoryChipText, isSelected && styles.activeCategoryChipText]}>{c}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Quick Filter & Sort Toolbar */}
        <View style={styles.quickFilterBar}>
          <Pressable
            onPress={() => {
              setLocationError("");
              setSheet("sort");
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.quickFilterPill, pressed && styles.pressed]}
          >
            <Ionicons name="swap-vertical" size={14} color="#7F56D9" />
            <Text style={styles.quickFilterText}>Sort: {SORT_OPTIONS[sort]}</Text>
            <Ionicons name="chevron-down" size={12} color="#7F56D9" />
          </Pressable>

          <Pressable
            onPress={() => setFilters(f => ({ ...f, availableToday: !f.availableToday }))}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.quickFilterPill,
              filters.availableToday && styles.quickFilterPillActive,
              pressed && styles.pressed
            ]}
          >
            <Text style={[styles.quickFilterText, filters.availableToday && styles.quickFilterTextActive]}>
              ⚡ Available Today
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setFilters(f => ({ ...f, minRating: f.minRating === 4.5 ? 0 : 4.5 }))}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.quickFilterPill,
              filters.minRating === 4.5 && styles.quickFilterPillActive,
              pressed && styles.pressed
            ]}
          >
            <Text style={[styles.quickFilterText, filters.minRating === 4.5 && styles.quickFilterTextActive]}>
              ⭐ 4.5+ Rating
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Error Banner */}
      {error !== "" && (
        <View accessibilityRole="alert" style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={refresh} accessibilityRole="button" style={styles.sortButton}>
            <Text style={styles.link}>Retry</Text>
          </Pressable>
        </View>
      )}

      {sort === "nearest" && <Text style={styles.distanceNote}>Providers without a listed location appear last.</Text>}

      {/* Services List */}
      {loading ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#7F56D9" />
          <Text style={styles.emptySubtitle}>Loading verified providers...</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={p => p.id}
          renderItem={({ item }) => <ProviderCard provider={item} onPress={() => openProfile(item.id)} />}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={["#7F56D9"]} />}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={48} color="#A09CAB" style={{ marginBottom: 8 }} />
              <Text style={styles.emptyTitle}>{error ? "Providers unavailable" : "No services found"}</Text>
              <Text style={styles.emptySubtitle}>
                {error
                  ? "Try again when your connection is restored."
                  : providers.length
                  ? "Try searching another service or clear active filters."
                  : "Verified providers will appear here as they join."}
              </Text>
              {providers.length > 0 && (
                <Pressable style={styles.resetBtn} onPress={reset} accessibilityRole="button">
                  <Text style={styles.resetBtnText}>Clear search and filters</Text>
                </Pressable>
              )}
            </View>
          }
        />
      )}

      {/* Filter Sheet Modal */}
      <Sheet visible={sheet === "filters"} title="Filter Services" onClose={close}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetContent}>
          <Text style={styles.label}>Service Area / Location</Text>
          <TextInput
            value={draft.area}
            onChangeText={area => setDraft(d => ({ ...d, area }))}
            placeholder="e.g. Colombo, Kandy"
            accessibilityLabel="Service area"
            style={styles.input}
          />

          <Text style={styles.label}>Maximum Price (LKR)</Text>
          <TextInput
            value={draft.maxPrice}
            onChangeText={maxPrice => setDraft(d => ({ ...d, maxPrice }))}
            placeholder="No maximum"
            accessibilityLabel="Maximum price in LKR"
            keyboardType="decimal-pad"
            style={styles.input}
          />

          <Text style={styles.label}>Minimum Rating</Text>
          <View style={styles.optionRow}>
            {[0, 4, 4.5].map(r => (
              <Pressable
                key={r}
                accessibilityRole="button"
                accessibilityState={{ selected: draft.minRating === r }}
                onPress={() => setDraft(d => ({ ...d, minRating: r }))}
                style={[styles.chip, draft.minRating === r && styles.activeChip]}
              >
                <Text style={[styles.chipText, draft.minRating === r && styles.activeChipText]}>
                  {r ? `⭐ ${r}+ stars` : "Any rating"}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.label}>Available Today</Text>
            <Switch
              accessibilityLabel="Available today"
              value={draft.availableToday}
              onValueChange={availableToday => setDraft(d => ({ ...d, availableToday }))}
              trackColor={{ true: "#7F56D9" }}
            />
          </View>

          {filterError !== "" && <Text accessibilityRole="alert" style={styles.errorText}>{filterError}</Text>}

          <Pressable onPress={applyFilters} style={styles.primaryButton} accessibilityRole="button">
            <Text style={styles.primaryText}>Apply Filters</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setDraft({ ...EMPTY_FILTERS });
              setFilterError("");
            }}
            style={styles.secondaryButton}
            accessibilityRole="button"
          >
            <Text style={styles.link}>Reset Filters</Text>
          </Pressable>
        </ScrollView>
      </Sheet>

      {/* Sort Sheet Modal */}
      <Sheet visible={sheet === "sort"} title="Sort Providers" onClose={close}>
        {Object.entries(SORT_OPTIONS).map(([value, label]) => (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{ checked: sort === value, disabled: locating }}
            disabled={locating}
            onPress={() => chooseSort(value)}
            style={styles.sortOption}
          >
            <Text style={styles.optionText}>{label}</Text>
            <Ionicons
              name={sort === value ? "checkmark-circle" : "ellipse-outline"}
              size={22}
              color={sort === value ? "#7F56D9" : "#98A2B3"}
            />
          </Pressable>
        ))}
        {locating && <ActivityIndicator color="#7F56D9" style={{ marginVertical: 10 }} />}
        {locationError !== "" && <Text accessibilityRole="alert" style={styles.errorText}>{locationError}</Text>}
      </Sheet>

      {/* Provider Details Profile Modal */}
      <ProviderProfileModal
        visible={sheet === "profile"}
        provider={profile}
        loading={profileLoading}
        error={profileError}
        onClose={close}
        onRetry={() => openProfile(profileId)}
        onTrackBookings={() => navigation.navigate("Bookings")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FAFAFD"
  },
  header: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F0EFF5"
  },
  titleGroup: {
    marginHorizontal: 20
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1D1B20",
    letterSpacing: -0.3
  },
  subtitle: {
    fontSize: 13,
    color: "#6E6E76",
    marginTop: 2
  },
  searchRow: {
    flexDirection: "row",
    gap: 10,
    marginHorizontal: 20,
    marginTop: 14
  },
  searchBox: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#1D1B20",
    paddingVertical: 0,
    minWidth: 0
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#F4F0FF",
    borderWidth: 1,
    borderColor: "#E9E3FA",
    alignItems: "center",
    justifyContent: "center",
    position: "relative"
  },
  filterButtonActive: {
    backgroundColor: "#7F56D9",
    borderColor: "#7F56D9"
  },
  filterBadge: {
    position: "absolute",
    right: -4,
    top: -4,
    borderRadius: 10,
    backgroundColor: "#1D1B20",
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4
  },
  filterBadgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "700"
  },
  categoriesContainer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 8,
    gap: 8
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F4F0FF",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "#E9E3FA"
  },
  activeCategoryChip: {
    backgroundColor: "#7F56D9",
    borderColor: "#7F56D9",
    boxShadow: "0px 4px 12px rgba(127, 86, 217, 0.25)",
    elevation: 2
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#7F56D9"
  },
  activeCategoryChipText: {
    color: "#FFFFFF",
    fontWeight: "700"
  },
  quickFilterBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 8
  },
  quickFilterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 6
  },
  quickFilterPillActive: {
    backgroundColor: "#F4F0FF",
    borderColor: "#7F56D9"
  },
  quickFilterText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6E6E76"
  },
  quickFilterTextActive: {
    color: "#7F56D9",
    fontWeight: "700"
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.97 }]
  },
  listContent: {
    padding: 20,
    gap: 16
  },
  card: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F2F0F9",
    boxShadow: "0px 6px 18px rgba(127, 86, 217, 0.08)",
    elevation: 3
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }]
  },
  photoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: "#F7F4FD",
    overflow: "hidden",
    position: "relative"
  },
  providerPhoto: {
    width: "100%",
    height: "100%"
  },
  photoFallback: {
    width: "100%",
    height: "100%",
    backgroundColor: "#F2EEFE",
    alignItems: "center",
    justifyContent: "center"
  },
  photoInitials: {
    color: "#7F56D9",
    fontSize: 22,
    fontWeight: "800"
  },
  verifiedBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 1
  },
  cardBody: {
    flex: 1,
    minWidth: 0
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 6
  },
  providerName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1D1B20",
    flex: 1
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10
  },
  ratingText: {
    fontSize: 12,
    color: "#B45309",
    fontWeight: "700"
  },
  reviewCountText: {
    fontSize: 11,
    color: "#98A2B3"
  },
  categoryBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4
  },
  categoryBadge: {
    backgroundColor: "#F4F0FF",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8
  },
  categoryBadgeText: {
    color: "#7F56D9",
    fontSize: 11,
    fontWeight: "700"
  },
  todayBadge: {
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8
  },
  todayBadgeText: {
    color: "#047857",
    fontSize: 11,
    fontWeight: "700"
  },
  metaRow: {
    gap: 4,
    marginTop: 8
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  metaText: {
    fontSize: 12,
    color: "#6E6E76",
    flexShrink: 1
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6"
  },
  priceAmount: {
    color: "#1D1B20",
    fontSize: 14,
    fontWeight: "800"
  },
  profileBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2
  },
  profileBtnText: {
    color: "#7F56D9",
    fontSize: 12,
    fontWeight: "700"
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
    marginTop: 40
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1D1B20"
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#6E6E76",
    marginTop: 4,
    textAlign: "center"
  },
  resetBtn: {
    marginTop: 16,
    backgroundColor: "#F4F0FF",
    borderWidth: 1,
    borderColor: "#E9E3FA",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14
  },
  resetBtnText: {
    color: "#7F56D9",
    fontSize: 13,
    fontWeight: "700"
  },
  errorBanner: {
    marginHorizontal: 20,
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#FEF2F2"
  },
  errorText: {
    color: "#991B1B",
    fontSize: 13
  },
  distanceNote: {
    marginHorizontal: 20,
    marginTop: 8,
    fontSize: 12,
    color: "#6E6E76"
  },
  modal: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end"
  },
  sheet: {
    backgroundColor: "white",
    padding: 20,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1D1B20"
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center"
  },
  sheetContent: {
    paddingBottom: 12,
    gap: 14
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1D1B20"
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#1D1B20",
    backgroundColor: "#F9FAFB"
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  chip: {
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  activeChip: {
    backgroundColor: "#7F56D9"
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4B5563"
  },
  activeChipText: {
    color: "#FFFFFF"
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6
  },
  primaryButton: {
    backgroundColor: "#7F56D9",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginTop: 8
  },
  primaryText: {
    fontSize: 15,
    color: "white",
    fontWeight: "700"
  },
  secondaryButton: {
    padding: 12,
    alignItems: "center"
  },
  link: {
    color: "#7F56D9",
    fontSize: 14,
    fontWeight: "700"
  },
  sortOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6"
  },
  optionText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1D1B20"
  }
});
