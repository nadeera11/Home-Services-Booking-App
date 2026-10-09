import React from "react";
import { StyleSheet, Platform } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../constants/theme";

import AdminDashboard from "../screens/admin/AdminDashboard";
import VerificationScreen from "../screens/admin/VerificationScreen";
import ComplaintsScreen from "../screens/admin/ComplaintsScreen";
import UsersScreen from "../screens/admin/UsersScreen";
import ReportsScreen from "../screens/admin/ReportsScreen";
import AdminProfileScreen from "../screens/admin/AdminProfileScreen";

const Tab = createBottomTabNavigator();

// [route name, label, outline icon, filled icon, screen]
const TABS = [
  ["Dashboard", "Dashboard", "view-grid-outline", "view-grid", AdminDashboard],
  ["Verification", "Verification", "shield-check-outline", "shield-check", VerificationScreen],
  ["Complaints", "Complaints", "message-alert-outline", "message-alert", ComplaintsScreen],
  ["Users", "Users", "account-group-outline", "account-group", UsersScreen],
  ["Reports", "Reports", "chart-bar", "chart-bar", ReportsScreen],
];

const AdminNavigator = () => {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: styles.label,
        tabBarStyle: [
          styles.tabBar,
          {
            height: Platform.OS === "ios" ? 60 + insets.bottom : 65 + Math.max(0, insets.bottom),
            paddingBottom: Math.max(8, insets.bottom),
          },
        ],
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
            tabBarIcon: ({ focused, color, size }) => (
              <MaterialCommunityIcons
                name={focused ? filled : outline}
                size={size}
                color={color}
              />
            ),
          }}
        />
      ))}
      <Tab.Screen
        name="AdminProfile"
        component={AdminProfileScreen}
        options={{
          tabBarItemStyle: { display: "none" },
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.secondary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.inputBorder,
    paddingTop: 6,
  },
  item: {
    paddingVertical: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
  },
});

export default AdminNavigator;