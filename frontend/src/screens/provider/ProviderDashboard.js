import React from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Switch,
  StatusBar,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";
import { COLORS, SHADOWS } from "../../constants/theme";
import { useProviderData } from "../../context/ProviderContext";
import Avatar from "../../components/provider/Avatar";
import { BellButton } from '../../components/provider/ScreenHeader';
import { money, bookingTime } from '../../services/bookingService';

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

const ScheduleCard = ({ item, onPress }) => {
  const status = STATUS_STYLES[item.status] || STATUS_STYLES.Upcoming;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.slot}>
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
        <Text style={styles.slotSub} >
          {item.customer} · {item.jobId}
        </Text>
      </View>
    </Pressable>
  );
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
const ProviderDashboard = ({ navigation }) => {

  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const { account: user, metrics, loaded, loading, load, online, setOnline, pendingCount, busy, error } = useProviderData();

  const name = user?.name || "Service Provider";
  const firstName = name.trim().split(/\s+/)[0];
  const morning = metrics.today.filter(b => bookingTime(b.startsAt).includes('AM')).length;
  const rating = user?.providerDetails?.rating, reviews = user?.providerDetails?.reviewCount || 0;
  const openGroup = group => navigation.navigate('Requests', { group, bookingId: null, openRequest: new Date().getTime() });
  const openJob = id => navigation.navigate('Requests', { bookingId: id, openRequest: new Date().getTime() });
  const count = value => loaded ? String(value) : '—';


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
              <Text style={styles.greeting} >
                Hello, {firstName}
              </Text>
              <Text style={styles.heroSub} >
                {user?.providerDetails?.category || 'Service provider'} · {user?.providerDetails?.serviceArea || 'Area not set'}
              </Text>
            </View>
            <BellButton light />
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
              disabled={busy}
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
              <Text style={styles.earningsLabel}>Payments received this week</Text>
              <Text style={styles.earningsValue}>{loaded ? money(metrics.weekReceived) : '—'}</Text>
              <View style={styles.trendRow}>
                <MaterialCommunityIcons name="check-circle-outline" size={16} color={GREEN} />
                <Text style={styles.trendText}>Confirmed cash / bank receipts</Text>
              </View>
            </View>
            <View style={styles.walletTile}>
              <MaterialCommunityIcons name="wallet-outline" size={22} color={COLORS.primary} />
            </View>
          </View>

          <Text style={styles.tileSub}>Unpaid invoices: {loaded ? money(metrics.unpaid) : '—'} · Sri Lanka time</Text>
          <View style={styles.earningsDivider} />

          <View style={styles.payoutRow}>
            <Text style={styles.payoutText}>
              Awaiting confirmation{" "}
              <Text style={styles.payoutValue}>{loaded ? money(metrics.awaiting) : '—'}</Text>
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
          {!!error && <Text accessibilityRole="alert" style={{ color: "#B52636", marginBottom: 12 }}>{error}</Text>}
          {loading && <ActivityIndicator accessibilityLabel="Loading dashboard" color={COLORS.primary} />}
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}><Pressable accessibilityRole="button" disabled={loading || busy} onPress={() => load()} style={styles.refresh}><Text style={styles.link}>Refresh dashboard</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => openGroup('Active jobs')} style={styles.refresh}><Text style={styles.link}>{count(metrics.active.length)} active jobs · View jobs</Text></Pressable></View>

          {/* Stats */}
          <View style={styles.grid}>
            <StatTile
              icon="clock-outline"
              iconColor={COLORS.primary}
              tileBg="#EEEAFD"
              value={count(metrics.today.length)}
              label="Today's bookings"
              sub={`${morning} in the morning`}
              onPress={() => navigation.navigate("Calendar")}
            />
            <StatTile
              icon="bell-outline"
              iconColor="#D9840B"
              tileBg="#FEF3DC"
              value={count(pendingCount)}
              label="Pending requests"
              sub="Awaiting a response"
              onPress={() => openGroup("New requests")}
            />
            <StatTile
              icon="briefcase-outline"
              iconColor={COLORS.primary}
              tileBg="#EEEAFD"
              value={count(metrics.completed)}
              label="Completed jobs"
              sub="All time"
              onPress={() => openGroup("History")}
            />
            <StatTile
              icon="star-outline"
              iconColor={GREEN}
              tileBg="#DDF5EA"
              value={reviews > 0 && Number.isFinite(rating) ? rating.toFixed(1) : '—'}
              label="Average rating"
              sub={reviews ? `${reviews} reviews` : 'No ratings yet'}
            />
          </View>

          {/* Today's schedule */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Today&#39;s schedule</Text>
            <Pressable
              onPress={() => navigation.navigate("Calendar")}
              style={styles.detailLink}
              accessibilityRole="link"
            >
              <Text style={styles.link}>Full calendar</Text>
              <MaterialCommunityIcons name="chevron-right" size={18} color={COLORS.primary} />
            </Pressable>
          </View>

          {loaded && !metrics.today.length && <Text style={styles.tileSub}>No confirmed appointments today. Preferred-time requests appear in Requests until accepted.</Text>}
          {metrics.today.map(job => <ScheduleCard key={job.id} onPress={() => openJob(job.id)} item={{ time: bookingTime(job.startsAt).split(' ')[0], period: bookingTime(job.startsAt).split(' ')[1], title: job.service, customer: job.customerName, jobId: job.reference, status: job.status === 'ongoing' ? 'In Progress' : job.status === 'completed' ? 'Completed' : job.status === 'quote_pending' ? 'Quote review' : job.status === 'awaiting_quote' ? 'Quote needed' : 'Upcoming' }} />)}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  refresh: { minHeight: 48, paddingVertical: 12 },
  screen: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingBottom: 28, width: "100%", maxWidth: 900, alignSelf: "center" },
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
  payoutRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" },
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
  slotTop: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
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
