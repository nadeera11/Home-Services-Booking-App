import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Image,
} from "react-native";
import { COLORS } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";

const SplashScreen = ({ navigation }) => {
  const { isAuthenticated, userRole, isLoading } = useAuth();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isLoading) {
        if (isAuthenticated && userRole) {
          // Navigate to appropriate role navigator
          if (userRole === "customer") {
            navigation.replace("CustomerNavigator");
          } else if (userRole === "provider") {
            navigation.replace("ProviderNavigator");
          } else if (userRole === "admin") {
            navigation.replace("AdminNavigator");
          } else {
            navigation.replace("Login");
          }
        } else {
          navigation.replace("Login");
        }
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [isLoading, isAuthenticated, userRole]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      
      {/* Brand Logo Image */}
      <View style={styles.logoContainer}>
        <Image
          source={require("../../../assets/images/FixMate Logo.png")}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </View>

      <Text style={styles.appName}>FixMate</Text>
      <Text style={styles.tagline}>Trusted Services, Right at Your Door</Text>

      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={COLORS.secondary} />
      </View>

      <Text style={styles.footerText}>Version 1.0.0</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  logoContainer: {
    width: 140,
    height: 140,
    marginBottom: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: "100%",
    height: "100%",
  },
  appName: {
    fontSize: 42,
    fontWeight: "bold",
    color: COLORS.secondary,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.9)",
    textAlign: "center",
    marginBottom: 40,
    fontWeight: "500",
  },
  loaderContainer: {
    position: "absolute",
    bottom: 80,
  },
  footerText: {
    position: "absolute",
    bottom: 30,
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.6)",
  },
});

export default SplashScreen;
