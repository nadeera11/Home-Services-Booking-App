import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { COLORS } from "../../constants/theme";
import { getInitials } from "../../constants/providerData";

/**
 * Rounded-square avatar. Shows the photo when `uri` is given,
 * otherwise the person's initials.
 */
const Avatar = ({ name, uri, size = 48, radius = 14, fontSize, tone = "lavender", style }) => {
  const box = { width: size, height: size, borderRadius: radius };

  if (uri) {
    return <Image accessibilityLabel={`${name || "Provider"} profile photo`} source={{ uri }} style={[box, style]} />;
  }

  return (
    <View style={[styles.base, box, tone === "white" && styles.white, style]}>
      <Text style={[styles.text, { fontSize: fontSize || Math.round(size * 0.32) }]}>
        {getInitials(name)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: "#EEEAFD",
    alignItems: "center",
    justifyContent: "center",
  },
  white: {
    backgroundColor: "#FFFFFF",
  },
  text: {
    fontWeight: "800",
    color: COLORS.primary,
  },
});

export default Avatar;
