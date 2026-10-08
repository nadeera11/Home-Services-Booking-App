import React from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Switch,
  StatusBar,
  StyleSheet,
  Alert,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { useProviderData } from "../../context/ProviderContext";
import Avatar from "../../components/provider/Avatar";
import {
  PROVIDER,
  EARNINGS,
  TODAY_SCHEDULE,
  formatMoney,
} from "../../constants/providerData";

const STATUS_STYLES = {
  "In Progress": { bg: "#E3EDFD", text: "#2F5FD0" },
  Upcoming: { bg: "#EEEAFD", text: COLORS.primary },
  Completed: { bg: "#DDF5EA", text: "#0F8A5F" },
};

const GREEN = "#0F8A5F";

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------
const StatTile = ({ icon, iconColor, tileBg, value, label, sub, onPress }) => (
  <Pressable
    onPress={onPress}
    disabled={!onPress}
    style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
  >
    <View style={[styles.tileIcon, { backgroundColor: tileBg }]}>
      <MaterialCommunityIcons name={icon} size={20} color={iconColor} />
    </View>
    <Text style={styles.tileValue}>{value}</Text>
    <Text style={styles.tileLabel}>{label}</Text>
    <Text style={styles.tileSub}>{sub}</Text>
  </Pressable>
);

const ScheduleCard = ({ item }) => {
  const status = STATUS_STYLES[item.status] || STATUS_STYLES.Upcoming;
  return (
    <View style={styles.slot}>
      <View style={styles.slotTime}>
        <Text style={styles.slotTimeText}>{item.time}</Text>
        <Text style={styles.slotPeriod}>{item.period}</Text>
      </View>
      <View style={styles.slotDivider} />
      <View style={styles.slotBody}>
        <View style={styles.slotTop}>
          <Text style={styles.slotTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={[styles.pill, { backgroundColor: status.bg }]}>
            <View style={[styles.pillDot, { backgroundColor: status.text }]} />
            <Text style={[styles.pillText, { color: status.text }]}>{item.status}</Text>
          </View>
        </View>
        <Text style={styles.slotSub} numberOfLines={1}>
          {item.customer} · {item.jobId}
        </Text>
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
const ProviderDashboard = ({ navigation }) => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const { online, setOnline, pendingCount, urgentCount } = useProviderData();

  const name = user?.name || "Service Provider";
  const firstName = name.trim().split(/\s+/)[0];
  const morning = TODAY_SCHEDULE.filter((s) => s.period === "AM").length;
  const comingSoon = (title) => Alert.alert(title, "Coming soon.");

  return (
    <View style={styles.screen}>
      {focused && <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Hero */}
        <View style={[styles.hero, { paddingTop: insets.top + 14 }]}>
          <View style={styles.heroTop}>
            <Avatar
              name={name}
              uri={user?.avatar || user?.profileImage}
              size={52}
              radius={16}
              tone="white"
            />
            <View style={styles.heroText}>
              <Text style={styles.greeting} numberOfLines={1}>
                Hello, {firstName}
              </Text>
              <Text style={styles.heroSub} numberOfLines={1}>
                {PROVIDER.category} · {PROVIDER.area}
              </Text>
            </View>
            <Pressable
              onPress={() => comingSoon("Notifications")}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              style={({ pressed }) => [styles.bell, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons name="bell-outline" size={22} color="#FFFFFF" />
              <View style={styles.bellDot} />
            </Pressable>
          </View>

          <View style={styles.onlineRow}>
            <View style={styles.onlineText}>
              <Text style={styles.onlineTitle}>
                {online ? "You are online" : "You are offline"}
              </Text>
              <Text style={styles.onlineSub}>
                {online
                  ? "Accepting new requests in your areas"
                  : "You will not receive new requests"}
              </Text>
            </View>
            <Switch
              value={online}
              onValueChange={setOnline}
              trackColor={{ false: "rgba(255,255,255,0.35)", true: "#FFFFFF" }}
              thumbColor={online ? COLORS.primary : "#FFFFFF"}
              ios_backgroundColor="rgba(255,255,255,0.35)"
              accessibilityLabel="Online status"
            />
          </View>
        </View>

        {/* Earnings card (overlaps hero) */}
        <View style={styles.earnings}>
          <View style={styles.earningsTop}>
            <View style={styles.earningsText}>
              <Text style={styles.earningsLabel}>Earnings this week</Text>
              <Text style={styles.earningsValue}>{formatMoney(EARNINGS.week)}</Text>
              <View style={styles.trendRow}>
                <MaterialCommunityIcons name="trending-up" size={16} color={GREEN} />
                <Text style={styles.trendText}>+{EARNINGS.weekGrowth}% vs last week</Text>
              </View>
            </View>
            <View style={styles.walletTile}>
              <MaterialCommunityIcons name="wallet-outline" size={22} color={COLORS.primary} />
            </View>
          </View>

          <View style={styles.earningsDivider} />

          <View style={styles.payoutRow}>
            <Text style={styles.payoutText}>
              Pending payout{" "}
              <Text style={styles.payoutValue}>{formatMoney(EARNINGS.pendingPayout)}</Text>
            </Text>
            <Pressable
              onPress={() => navigation.navigate("Profile")}
              style={styles.detailLink}
              accessibilityRole="link"
            >
              <Text style={styles.link}>Earnings detail</Text>
              <MaterialCommunityIcons name="arrow-right" size={16} color={COLORS.primary} />
            </Pressable>
          </View>
        </View>

        <View style={styles.body}>
          {/* Stats */}
          <View style={styles.grid}>
            <StatTile
              icon="clock-outline"
              iconColor={COLORS.primary}
              tileBg="#EEEAFD"
              value={String(TODAY_SCHEDULE.length)}
              label="Today's bookings"
              sub={`${morning} in the morning`}
              onPress={() => navigation.navigate("Calendar")}
            />
            <StatTile
              icon="bell-outline"
              iconColor="#D9840B"
              tileBg="#FEF3DC"
              value={String(pendingCount)}
              label="Pending requests"
              sub={urgentCount > 0 ? `${urgentCount} marked urgent` : "None urgent"}
              onPress={() => navigation.navigate("Requests")}
            />
            <StatTile
              icon="briefcase-outline"
              iconColor={COLORS.primary}
              tileBg="#EEEAFD"
              value={String(PROVIDER.jobsDone)}
              label="Completed jobs"
              sub="All time"
            />
            <StatTile
              icon="star-outline"
              iconColor={GREEN}
              tileBg="#DDF5EA"
              value={PROVIDER.rating.toFixed(1)}
              label="Average rating"
              sub={`${PROVIDER.reviews} reviews`}
            />
          </View>

          {/* Today's schedule */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Today's schedule</Text>
            <Pressable
              onPress={() => navigation.navigate("Calendar")}
              style={styles.detailLink}
              accessibilityRole="link"
            >
              <Text style={styles.link}>Full calendar</Text>
              <MaterialCommunityIcons name="chevron-right" size={18} color={COLORS.primary} />
            </Pressable>
          </View>

          {TODAY_SCHEDULE.map((item) => (
            <ScheduleCard key={item.id} item={item} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingBottom: 28 },
  pressed: { opacity: 0.85 },

  // Hero
  hero: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingBottom: 62,
  },
  heroTop: { flexDirection: "row", alignItems: "center" },
  heroText: { flex: 1, marginHorizontal: 14 },
  greeting: { fontSize: 20, fontWeight: "800", color: "#FFFFFF" },
  heroSub: { fontSize: 13, color: "rgba(255,255,255,0.88)", marginTop: 3 },
  bell: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  bellDot: {
    position: "absolute",
    top: 9,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },
  onlineRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 24,
    paddingHorizontal: 2,
  },
  onlineText: { flex: 1, paddingRight: 12 },
  onlineTitle: { fontSize: 15, fontWeight: "800", color: "#FFFFFF" },
  onlineSub: { fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 3 },

  // Earnings
  earnings: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 24,
    marginHorizontal: 20,
    marginTop: -38,
    padding: 18,
    ...SHADOWS.small,
  },
  earningsTop: { flexDirection: "row", alignItems: "flex-start" },
  earningsText: { flex: 1 },
  earningsLabel: { fontSize: 14, color: COLORS.textMuted },
  earningsValue: {
    fontSize: 30,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginTop: 2,
    letterSpacing: -0.5,
  },
  trendRow: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 6 },
  trendText: { fontSize: 13, fontWeight: "700", color: GREEN },
  walletTile: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#EEEAFD",
    alignItems: "center",
    justifyContent: "center",
  },
  earningsDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.inputBorder,
    marginTop: 16,
    marginBottom: 14,
  },
  payoutRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  payoutText: { fontSize: 13, color: COLORS.textPrimary },
  payoutValue: { fontWeight: "800" },
  detailLink: { flexDirection: "row", alignItems: "center", gap: 2 },
  link: { fontSize: 14, fontWeight: "800", color: COLORS.primary },

  // Body
  body: { paddingHorizontal: 20, paddingTop: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: {
    flexBasis: "47%",
    flexGrow: 1,
    backgroundColor: COLORS.cardBg,
    borderRadius: 22,
    padding: 16,
    ...SHADOWS.small,
  },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  tileValue: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginTop: 14,
    letterSpacing: -0.5,
  },
  tileLabel: { fontSize: 14, fontWeight: "800", color: COLORS.textPrimary, marginTop: 6 },
  tileSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },

  // Schedule
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 26,
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: COLORS.textPrimary },
  slot: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    ...SHADOWS.small,
  },
  slotTime: { width: 44, alignItems: "flex-start" },
  slotTimeText: { fontSize: 15, fontWeight: "800", color: COLORS.textPrimary },
  slotPeriod: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  slotDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    backgroundColor: COLORS.inputBorder,
    marginHorizontal: 14,
  },
  slotBody: { flex: 1 },
  slotTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  slotTitle: { flex: 1, fontSize: 15, fontWeight: "800", color: COLORS.textPrimary },
  slotSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 11, fontWeight: "800" },
});

export default ProviderDashboard;
