import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { COLORS } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import adminService from "../../services/adminService";
import StatCard from "../../components/admin/StatCard";
import TaskCard from "../../components/admin/TaskCard";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const formatLongDate = (d) =>
  `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

const getGreeting = (d) => {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

const formatNumber = (n) => (n || 0).toLocaleString("en-US");

const AdminDashboard = ({ navigation }) => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [stats, setStats] = useState({
    totalCustomers: 0,
    serviceProviders: 0,
    verifiedProviders: 0,
    pendingVerifications: 0,
    newApplicationsToday: 0,
    activeBookings: 0,
    bookingsToday: 0,
    openComplaints: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async (isRefreshing = false) => {
    try {
      if (isRefreshing) setRefreshing(true);
      else setLoading(true);

      const data = await adminService.getDashboardStats();
      setStats(data);
    } catch (error) {
      console.error("Fetch Admin Dashboard Stats Error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchStats();
    }, [])
  );

  const now = useMemo(() => new Date(), []);
  const firstName = (user?.name || "Admin").trim().split(/\s+/)[0];
  const verifiedPercent = stats.serviceProviders > 0
    ? Math.round((stats.verifiedProviders / stats.serviceProviders) * 100)
    : 0;

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      {/* Hero (fixed, does not scroll) */}
      <View style={[styles.hero, { paddingTop: insets.top + 24 }]}>
        <View style={styles.heroTop}>
          <View style={styles.heroText}>
            <Text style={styles.date}>{formatLongDate(now)}</Text>
            <Text style={styles.greeting}>
              {getGreeting(now)}, {firstName}
            </Text>
            <Text style={styles.role}>Platform Administrator · FixMate LK</Text>
          </View>
          {/* Profile Icon Button */}
          <TouchableOpacity
            style={styles.avatar}
            onPress={() => navigation.navigate("AdminProfile")}
            accessibilityRole="button"
            accessibilityLabel="Admin Profile"
          >
            <MaterialCommunityIcons name="account-cog-outline" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <Text style={styles.attention}>
          {stats.pendingVerifications} applications and {stats.openComplaints}{" "}
          complaints need your attention today.
        </Text>

        <View style={styles.heroActions}>
          <TouchableOpacity
            style={styles.heroButton}
            activeOpacity={0.8}
            onPress={() => navigation.navigate("Verification")}
          >
            <Text style={styles.heroButtonText}>Review verifications</Text>
            <MaterialCommunityIcons name="arrow-top-right" size={14} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.heroButton}
            activeOpacity={0.8}
            onPress={() => navigation.navigate("Complaints")}
          >
            <Text style={styles.heroButtonText}>Open complaints</Text>
            <MaterialCommunityIcons name="arrow-top-right" size={14} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Only this area scrolls */}
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchStats(true)}
            colors={[COLORS.primary]}
          />
        }
      >
        <View style={styles.body}>
          {/* Platform overview */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Platform overview</Text>
            <TouchableOpacity
              style={styles.link}
              onPress={() => navigation.navigate("Reports")}
              accessibilityRole="link"
            >
              <Text style={styles.linkText}>Reports</Text>
              <MaterialCommunityIcons name="arrow-right" size={16} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          {loading && !refreshing ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={{ marginVertical: 30 }} />
          ) : (
            <>
              <View style={styles.grid}>
                <StatCard
                  label="Total customers"
                  value={formatNumber(stats.totalCustomers)}
                  trend="Registered users"
                  trendUp
                />
                <StatCard
                  label="Service providers"
                  value={formatNumber(stats.serviceProviders)}
                  trend="Registered pros"
                  trendUp
                />
                <StatCard
                  label="Active bookings"
                  value={formatNumber(stats.activeBookings)}
                  trend={`${stats.bookingsToday} new today`}
                  trendUp
                />
                <StatCard
                  label="Verified providers"
                  value={formatNumber(stats.verifiedProviders)}
                  trend={`${verifiedPercent}% of providers`}
                />
              </View>

              {/* Urgent tasks */}
              <Text style={[styles.sectionTitle, styles.urgentTitle]}>Urgent tasks</Text>

              <TaskCard
                icon="check"
                title="Pending verifications"
                subtitle={`${stats.newApplicationsToday} new applications today`}
                badge={String(stats.pendingVerifications)}
                actionLabel="Review queue"
                tone="purple"
                onPress={() => navigation.navigate("Verification")}
              />
              <TaskCard
                icon="exclamation-thick"
                title="Open complaints"
                subtitle="Customer & provider disputes"
                badge={`${stats.openComplaints} cases`}
                actionLabel="View complaints"
                tone="red"
                onPress={() => navigation.navigate("Complaints")}
              />
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },

  // Hero
  hero: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  heroText: {
    flex: 1,
    paddingRight: 12,
  },
  date: {
    fontSize: 13,
    color: "rgba(255,255,255,0.78)",
  },
  greeting: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    marginTop: 6,
  },
  role: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    marginTop: 6,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  attention: {
    fontSize: 15,
    lineHeight: 22,
    color: "#FFFFFF",
    marginTop: 20,
  },
  heroActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 18,
  },
  heroButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  heroButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // Body
  body: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  linkText: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.primary,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  urgentTitle: {
    marginTop: 26,
    marginBottom: 14,
  },
});

export default AdminDashboard;