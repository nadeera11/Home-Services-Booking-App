import React from "react";
import { View, ActivityIndicator, StyleSheet, Image, StatusBar } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import { COLORS } from "../constants/theme";

import AuthNavigator from "./AuthNavigator";
import CustomerNavigator from "./CustomerNavigator";
import ProviderNavigator from "./ProviderNavigator";
import AdminNavigator from "./AdminNavigator";

const Stack = createNativeStackNavigator();

const RootNavigator = () => {
  const { isAuthenticated, userRole, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
        <View style={styles.logoContainer}>
          <Image
            source={require("../../assets/images/FixMate Logo.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
        <ActivityIndicator size="large" color={COLORS.secondary} style={{ marginTop: 20 }} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      ) : userRole === "provider" ? (
        <Stack.Screen name="ProviderNavigator" component={ProviderNavigator} />
      ) : userRole === "admin" ? (
        <Stack.Screen name="AdminNavigator" component={AdminNavigator} />
      ) : (
        <Stack.Screen name="CustomerNavigator" component={CustomerNavigator} />
      )}
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.primary,
  },
  logoContainer: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: "100%",
    height: "100%",
  },
});

export default RootNavigator;
