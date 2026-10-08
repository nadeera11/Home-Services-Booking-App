import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "../constants/theme";
import { ProviderDataProvider, useProviderData } from "../context/ProviderContext";

import ProviderDashboard from "../screens/provider/ProviderDashboard";
import ProviderRequestsScreen from "../screens/provider/ProviderRequestsScreen";
import ProviderCalendarScreen from "../screens/provider/ProviderCalendarScreen";
import ProviderMessagesScreen from "../screens/provider/ProviderMessagesScreen";
import ProviderProfileScreen from "../screens/provider/ProviderProfileScreen";

const Tab = createBottomTabNavigator();

// [route name, label, outline icon, filled icon, screen]
const TABS = [
  ["Dashboard", "Dashboard", "view-grid-outline", "view-grid", ProviderDashboard],
  ["Requests", "Requests", "wrench-outline", "wrench", ProviderRequestsScreen],
  ["Calendar", "Calendar", "calendar-month-outline", "calendar-month", ProviderCalendarScreen],
  ["Messages", "Messages", "message-outline", "message", ProviderMessagesScreen],
  ["Profile", "Profile", "account-outline", "account", ProviderProfileScreen],
];

const ProviderTabs = () => {
  const { pendingCount } = useProviderData();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: styles.label,
        tabBarStyle: [styles.tabBar, { height: 70 + insets.bottom, paddingBottom: Math.max(8, insets.bottom) }],
        tabBarItemStyle: styles.item,
      }}
    >
      {TABS.map(([name, label, outline, filled, component]) => (
        <Tab.Screen
          key={name}
          name={name}
          component={component}
          options={{
            tabBarLabel: label,
            tabBarBadge: name === "Requests" && pendingCount > 0 ? pendingCount : undefined,
            tabBarBadgeStyle: styles.badge,
            tabBarIcon: ({ focused, color, size }) => (
              <MaterialCommunityIcons name={focused ? filled : outline} size={size} color={color} />
            ),
          }}
        />
      ))}
    </Tab.Navigator>
  );
};

const ProviderNavigator = () => (
  <ProviderDataProvider>
    <ProviderTabs />
  </ProviderDataProvider>
);

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.secondary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.inputBorder,
    paddingTop: 6,
  },
  item: { paddingVertical: 2 },
  label: { fontSize: 11, fontWeight: "600" },
  badge: {
    backgroundColor: COLORS.primary,
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
});

export default ProviderNavigator;
