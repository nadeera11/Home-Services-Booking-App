import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { bookingPrice } from '../../services/bookingService';
import ProviderProfileModal from "./ProviderProfileModal";
import * as Location from "expo-location";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../../context/AuthContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../../constants/theme";
import { getProvider, getProviders } from "../../services/providerService";
import { availabilityLabel, CATEGORIES, EMPTY_FILTERS, filterProviders, SORT_OPTIONS } from "../../utils/exploreProviders";
const ICONS = {
  search: require("../../../assets/images/explore/imgSvg.svg"),
  filter: require("../../../assets/images/explore/imgSvg1.svg"),
  verified: require("../../../assets/images/explore/imgSvg2.svg"),
  star: require("../../../assets/images/explore/imgSvg3.svg"),
  location: require("../../../assets/images/explore/imgSvg4.svg"),
  clock: require("../../../assets/images/explore/imgSvg5.svg"),
  chevron: require("../../../assets/images/explore/imgSvg6.svg")
};
const Icon = ({
  name,
  size = 14
}) => <Image source={ICONS[name]} style={{
  width: size,
  height: size
}} contentFit="contain" accessible={false} />;
const initials = name => name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
const priceText = bookingPrice;
function ProviderCard({
  provider: p,
  onPress
}) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`View ${p.name}'s profile`} style={({
    pressed
  }) => [styles.card, pressed && styles.pressed]}>
    <View style={styles.avatarSlot}><View style={styles.avatar}><Text style={styles.initials}>{initials(p.name)}</Text></View>{p.verified && <View style={styles.verified}><Icon name="verified" size={21.59} /></View>}</View>
    <View style={styles.cardBody}>
      <View style={styles.rowBetween}><Text style={styles.providerName} numberOfLines={2}>{p.name}</Text><View style={styles.rating}><Icon name="star" /><Text style={styles.ratingText}>{p.rating == null ? "New" : p.rating.toFixed(1)}</Text>{p.reviewCount > 0 && <Text style={styles.smallMuted}>({p.reviewCount})</Text>}</View></View>
      <Text style={styles.categoryText}>{p.category}</Text>
      <View style={styles.metadata}><View style={styles.metaItem}><Icon name="location" /><Text style={styles.smallMuted}>{p.distance != null ? `${p.distance.toFixed(1)} km away` : p.serviceArea || "Location not listed"}</Text></View><View style={styles.metaItem}><Icon name="clock" /><Text style={styles.smallMuted}>{availabilityLabel(p.nextAvailableAt)}</Text></View></View>
      <View style={styles.cardFooter}><Text style={styles.price}>{priceText(p)}</Text><View style={styles.profileLink}><Text style={styles.link}>View profile</Text><Icon name="chevron" /></View></View>
    </View>
  </Pressable>;
}
function Sheet({
  visible,
  title,
  onClose,
  children
}) {
  const insets = useSafeAreaInsets();
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close dialog" accessibilityRole="button" />
    <View style={[styles.sheet, {
        paddingBottom: Math.max(24, insets.bottom),
        maxHeight: "90%"
      }]} accessibilityViewIsModal><View style={styles.sheetHeader}><Text accessibilityRole="header" style={styles.sheetTitle}>{title}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close dialog" onPress={onClose} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable></View>{children}</View>
  </KeyboardAvoidingView></Modal>;
}
export default function ExploreScreen({ navigation, route }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [providers, setProviders] = useState([]),
    [loading, setLoading] = useState(true),
    [refreshing, setRefreshing] = useState(false),
    [error, setError] = useState("");
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState(route?.params?.category || "All"),
    [filters, setFilters] = useState(EMPTY_FILTERS),
    [draft, setDraft] = useState(EMPTY_FILTERS),
    [filterError, setFilterError] = useState("");
  const [sheet, setSheet] = useState(null),
    [sort, setSort] = useState("name"),
    [location, setLocation] = useState(user?.location?.latitude != null ? user.location : null),
    [locating, setLocating] = useState(false),
    [locationError, setLocationError] = useState("");
  const [profile, setProfile] = useState(null),
    [profileId, setProfileId] = useState(null),
    [profileLoading, setProfileLoading] = useState(false),
    [profileError, setProfileError] = useState("");
  useFocusEffect(useCallback(() => { if (route?.params?.category) setCategory(route.params.category); }, [route]));
  useFocusEffect(useCallback(() => { if (user?.location?.latitude != null) setLocation(user.location); }, [user]));
  const listRequest = useRef(null),
    profileRequest = useRef(null),
    mounted = useRef(false);
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
  const categories = useMemo(() => [...CATEGORIES, ...providers.map(p => p.category).filter((c, i, all) => !CATEGORIES.some(base => base.toLowerCase() === c.toLowerCase()) && all.indexOf(c) === i)], [providers]);
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
  return <View style={styles.screen}>
    <StatusBar barStyle="dark-content" backgroundColor={COLORS.secondary} />
    <View style={[styles.header, {
      paddingTop: insets.top + 8
    }]}>
      <Text style={styles.title}>Explore services</Text><Text style={styles.subtitle}>{loading ? "Find verified professionals for your home" : `${providers.length.toLocaleString()} verified professional${providers.length === 1 ? "" : "s"}${location ? " • location enabled" : " to explore"}`}</Text>
      <View style={styles.searchRow}><View style={styles.searchBox}><Icon name="search" size={16} /><TextInput value={query} onChangeText={setQuery} placeholder="Search service or provider name" placeholderTextColor="#9CA3AF" accessibilityLabel="Search service or provider name" style={styles.searchInput} returnKeyType="search" autoCorrect={false} />{query !== "" && <Pressable onPress={() => setQuery("")} accessibilityLabel="Clear search" accessibilityRole="button" hitSlop={10}><Text style={styles.clear}>×</Text></Pressable>}</View><Pressable onPress={() => {
          setDraft({
            ...filters
          });
          setFilterError("");
          setSheet("filters");
        }} accessibilityRole="button" accessibilityLabel={`Filters, ${filterCount} active`} style={styles.filterButton}><Icon name="filter" size={18} />{filterCount > 0 && <View style={styles.filterBadge}><Text style={styles.filterBadgeText}>{filterCount}</Text></View>}</Pressable></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories} keyboardShouldPersistTaps="handled">{categories.map(c => <Pressable key={c} onPress={() => setCategory(c)} accessibilityRole="button" accessibilityState={{
          selected: category === c
        }} style={[styles.chip, category === c && styles.activeChip]}><Text style={[styles.chipText, category === c && styles.activeChipText]}>{c}</Text></Pressable>)}</ScrollView>
    </View>
    <View style={styles.resultsHeader}><Text style={styles.resultsCount}>{loading ? "Finding providers…" : `${results.length} provider${results.length === 1 ? "" : "s"} found`}</Text><Pressable onPress={() => {
        setLocationError("");
        setSheet("sort");
      }} accessibilityRole="button" style={styles.sortButton}><Text style={styles.link}>Sort: {SORT_OPTIONS[sort]}</Text></Pressable></View>
    {error !== "" && <View accessibilityRole="alert" style={styles.errorBanner}><Text style={styles.errorText}>{error}</Text><Pressable onPress={refresh} accessibilityRole="button" style={styles.sortButton}><Text style={styles.link}>Retry</Text></Pressable></View>}
    {sort === "nearest" && <Text style={styles.distanceNote}>Providers without a listed location appear last.</Text>}
    {loading ? <View style={styles.empty}><ActivityIndicator size="large" color={COLORS.primary} /><Text style={styles.subtitle}>Loading verified providers…</Text></View> : <FlatList data={results} keyExtractor={p => p.id} renderItem={({
      item
    }) => <ProviderCard provider={item} onPress={() => openProfile(item.id)} />} contentContainerStyle={styles.list} refreshing={refreshing} onRefresh={refresh} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>{error ? "Providers unavailable" : "No providers found"}</Text><Text style={styles.emptyDescription}>{error ? "Try again when your connection is restored." : providers.length ? "Try a different search or adjust your filters." : "Verified, approved providers will appear here as they join."}</Text>{providers.length > 0 && <Pressable style={styles.primaryButton} onPress={reset} accessibilityRole="button"><Text style={styles.primaryText}>Clear search and filters</Text></Pressable>}</View>} />}
    <Sheet visible={sheet === "filters"} title="Filter services" onClose={close}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetContent}>
      <Text style={styles.label}>Service area</Text><TextInput value={draft.area} onChangeText={area => setDraft(d => ({
          ...d,
          area
        }))} placeholder="Town or city" accessibilityLabel="Service area" style={styles.input} />
      <Text style={styles.label}>Maximum service price (LKR; estimates use upper limit)</Text><TextInput value={draft.maxPrice} onChangeText={maxPrice => setDraft(d => ({
          ...d,
          maxPrice
        }))} placeholder="No maximum" accessibilityLabel="Maximum price in LKR" keyboardType="decimal-pad" style={styles.input} />
      <Text style={styles.label}>Minimum rating</Text><View style={styles.optionRow}>{[0, 4, 4.5].map(r => <Pressable key={r} accessibilityRole="button" accessibilityState={{
            selected: draft.minRating === r
          }} onPress={() => setDraft(d => ({
            ...d,
            minRating: r
          }))} style={[styles.chip, draft.minRating === r && styles.activeChip]}><Text style={[styles.chipText, draft.minRating === r && styles.activeChipText]}>{r ? `${r}+ stars` : "Any rating"}</Text></Pressable>)}</View>
      <View style={styles.toggleRow}><Text style={styles.label}>Available today</Text><Switch accessibilityLabel="Available today" value={draft.availableToday} onValueChange={availableToday => setDraft(d => ({
            ...d,
            availableToday
          }))} trackColor={{
            true: COLORS.primary
          }} /></View>
      {filterError !== "" && <Text accessibilityRole="alert" style={styles.errorText}>{filterError}</Text>}<Pressable onPress={applyFilters} style={styles.primaryButton} accessibilityRole="button"><Text style={styles.primaryText}>Show results</Text></Pressable><Pressable onPress={() => {
          setDraft({
            ...EMPTY_FILTERS
          });
          setFilterError("");
        }} style={styles.secondaryButton} accessibilityRole="button"><Text style={styles.link}>Reset filters</Text></Pressable>
    </ScrollView></Sheet>
    <Sheet visible={sheet === "sort"} title="Sort providers" onClose={close}>{Object.entries(SORT_OPTIONS).map(([value, label]) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{
        checked: sort === value,
        disabled: locating
      }} disabled={locating} onPress={() => chooseSort(value)} style={styles.sortOption}><Text style={styles.optionText}>{label}</Text><Text style={styles.link}>{sort === value ? "●" : "○"}</Text></Pressable>)}{locating && <ActivityIndicator color={COLORS.primary} />}{locationError !== "" && <Text accessibilityRole="alert" style={styles.errorText}>{locationError}</Text>}</Sheet>
    <ProviderProfileModal visible={sheet === "profile"} provider={profile} loading={profileLoading} error={profileError} onClose={close} onRetry={() => openProfile(profileId)} onTrackBookings={() => navigation.navigate("Bookings")} />
  </View>;
}
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F6F6F9"
  },
  header: {
    backgroundColor: COLORS.secondary,
    borderBottomWidth: 1,
    borderBottomColor: "#ECECF1"
  },
  title: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "700",
    color: COLORS.textPrimary,
    letterSpacing: -0.19,
    marginHorizontal: 20
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: "#6E6E76",
    marginTop: 2,
    marginHorizontal: 20
  },
  searchRow: {
    flexDirection: "row",
    gap: 8,
    marginHorizontal: 20,
    marginTop: 12
  },
  searchBox: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: "#ECECF1",
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
    paddingVertical: 0,
    minWidth: 0
  },
  clear: {
    fontSize: 24,
    color: "#6E6E76"
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  filterBadge: {
    position: "absolute",
    right: -4,
    top: -4,
    borderRadius: 10,
    backgroundColor: COLORS.textPrimary,
    minWidth: 18,
    alignItems: "center"
  },
  filterBadgeText: {
    color: "white",
    fontSize: 11,
    lineHeight: 18
  },
  categories: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 13,
    gap: 8
  },
  chip: {
    backgroundColor: "#F6F6F9",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7
  },
  activeChip: {
    backgroundColor: COLORS.primary
  },
  chipText: {
    fontSize: 12.5,
    lineHeight: 19,
    fontWeight: "600",
    color: COLORS.textSecondary
  },
  activeChipText: {
    color: "white"
  },
  resultsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 20,
    minHeight: 48
  },
  resultsCount: {
    color: COLORS.textPrimary,
    fontWeight: "600",
    fontSize: 13
  },
  sortButton: {
    paddingVertical: 12
  },
  link: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "600"
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    flexGrow: 1
  },
  card: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "white",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#272727",
    shadowOffset: {
      width: 0,
      height: 6
    },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2
  },
  pressed: {
    opacity: 0.75
  },
  avatarSlot: {
    width: 60,
    height: 64
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 16.8,
    backgroundColor: "#F1EDFE",
    alignItems: "center",
    justifyContent: "center"
  },
  initials: {
    color: COLORS.primary,
    fontSize: 20.4,
    fontWeight: "600"
  },
  verified: {
    position: "absolute",
    left: 42.41,
    top: 42.41
  },
  cardBody: {
    flex: 1,
    minWidth: 0
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 6
  },
  providerName: {
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 19,
    color: COLORS.textPrimary,
    flex: 1
  },
  rating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3
  },
  ratingText: {
    fontSize: 12,
    color: COLORS.textPrimary,
    fontWeight: "600"
  },
  smallMuted: {
    fontSize: 12,
    lineHeight: 18,
    color: "#6E6E76",
    flexShrink: 1
  },
  categoryText: {
    color: COLORS.primary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2
  },
  metadata: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 1
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10
  },
  price: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20
  },
  unit: {
    color: "#6E6E76",
    fontSize: 11,
    fontWeight: "400"
  },
  profileLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textPrimary
  },
  emptyDescription: {
    color: "#6E6E76",
    textAlign: "center",
    lineHeight: 22
  },
  errorBanner: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#FFF1F1"
  },
  errorText: {
    color: "#B42318",
    lineHeight: 21,
    fontSize: 13
  },
  distanceNote: {
    marginHorizontal: 20,
    marginBottom: 12,
    fontSize: 11,
    color: "#6E6E76"
  },
  modal: {
    flex: 1,
    backgroundColor: "rgba(39,39,39,0.4)",
    justifyContent: "flex-end"
  },
  sheet: {
    backgroundColor: "white",
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textPrimary,
    flexShrink: 1
  },
  close: {
    minHeight: 44,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  closeText: {
    fontSize: 30,
    color: "#6E6E76"
  },
  sheetContent: {
    paddingBottom: 12,
    gap: 12
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary
  },
  input: {
    borderWidth: 1,
    borderColor: "#ECECF1",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.textPrimary
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: "center"
  },
  primaryText: {
    fontSize: 14,
    color: "white",
    fontWeight: "600"
  },
  secondaryButton: {
    padding: 12,
    alignItems: "center"
  },
  sortOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ECECF1"
  },
  optionText: {
    fontSize: 15,
    color: COLORS.textPrimary
  },
  profileLoader: {
    paddingVertical: 50
  },
  profileHeading: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center"
  },
  flex: {
    flex: 1
  },
  profilePrice: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
    paddingVertical: 12
  },
  bodyText: {
    color: "#6E6E76",
    fontSize: 14,
    lineHeight: 22
  },
  detailRow: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#ECECF1",
    gap: 6
  },
  detailLabel: {
    fontSize: 12,
    color: "#6E6E76"
  },
  detailValue: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 21
  }
});
