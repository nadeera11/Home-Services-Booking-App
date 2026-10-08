import React from "react";
import { StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../constants/theme";

import CustomerDashboard from "../screens/customer/CustomerDashboard";
import ExploreScreen from "../screens/customer/ExploreScreen";
import BookingsScreen from "../screens/customer/BookingsScreen";
import MessagesScreen from "../screens/customer/MessagesScreen";
import ProfileScreen from "../screens/customer/ProfileScreen";

const Tab = createBottomTabNavigator();
const TAB_ICONS = {
  Home: require('../../assets/images/booking/nav-imgSvg.svg'),
  Explore: require('../../assets/images/booking/nav-imgSvg1.svg'),
  Bookings: require('../../assets/images/booking/nav-imgSvg2.svg'),
  Messages: require('../../assets/images/booking/nav-imgSvg3.svg'),
  Profile: require('../../assets/images/booking/nav-imgSvg4.svg'),
};



// [route name, label, outline icon, filled icon, screen]
const TABS = [
  ["Home", "Home", "home-variant-outline", "home-variant", CustomerDashboard],
  ["Explore", "Explore", "compass-outline", "compass", ExploreScreen],
  ["Bookings", "Bookings", "clipboard-text-outline", "clipboard-text", BookingsScreen],
  ["Messages", "Messages", "message-text-outline", "message-text", MessagesScreen],
  ["Profile", "Profile", "account-outline", "account", ProfileScreen],
];

const CustomerNavigator = () => {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: styles.label,
        tabBarStyle: [styles.tabBar, { height: 70 + insets.bottom, paddingBottom: Math.max(8, insets.bottom) }],
        tabBarItemStyle: styles.item,
      }}
    >
      {TABS.map(([name, label, , , component]) => (
        <Tab.Screen
          key={name}
          name={name}
          component={component}
          options={{
            tabBarLabel: label,

            tabBarBadgeStyle: styles.badge,
            tabBarIcon: ({ color }) => (
              <Image accessible={false} source={TAB_ICONS[name]} tintColor={color} style={{ width: 22, height: 22 }} contentFit="contain" />
            ),
          }}
        />
      ))}
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
  item: { paddingVertical: 2 },
  label: { fontSize: 11, fontWeight: "600" },
  badge: {
    backgroundColor: COLORS.primary,
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
});

export default CustomerNavigator;
