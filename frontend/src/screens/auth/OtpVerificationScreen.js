import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { COLORS } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";

const OtpVerificationScreen = ({ route, navigation }) => {
  const { verifyOTP, resendOTP } = useAuth();
  const identifier = route.params?.identifier || "";

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [countdown, setCountdown] = useState(60);
  const canResend = countdown === 0;

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  const handleVerify = async () => {
    setErrorMessage("");
    setSuccessMessage("");

    if (!otp || otp.trim().length !== 6) {
      setErrorMessage("Please enter the complete 6-digit verification code");
      return;
    }

    setLoading(true);
    const result = await verifyOTP(identifier, otp.trim());
    setLoading(false);

    if (!result.success) {
      setErrorMessage(result.message || "OTP is incorrect. Please re-enter the code.");
      setOtp(""); // Clear invalid input so user can re-enter
      return;
    }

    if (result.requiresAdminApproval) {
      setSuccessMessage(result.message || "OTP verified successfully! Account is pending Admin Approval.");
      setTimeout(() => {
        navigation.replace("Login");
      }, 2500);
      return;
    }

    setSuccessMessage("Account verified successfully!");
    setTimeout(() => {
      const role = result.role || result.user?.role;
      if (role === "customer") {
        navigation.replace("CustomerNavigator");
      } else if (role === "provider") {
        navigation.replace("ProviderNavigator");
      } else if (role === "admin") {
        navigation.replace("AdminNavigator");
      } else {
        navigation.replace("Login");
      }
    }, 1000);
  };

  const handleResend = async () => {
    if (!canResend) return;

    setErrorMessage("");
    setSuccessMessage("");
    setResendLoading(true);

    const result = await resendOTP(identifier);
    setResendLoading(false);

    if (result.success) {
      setSuccessMessage("A new OTP code has been generated and logged in backend console.");
      setCountdown(60);
    } else {
      setErrorMessage(result.message || "Failed to resend OTP");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.headerContainer}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconText}>🔑</Text>
            </View>
            <Text style={styles.title}>Verify Your Account</Text>
            <Text style={styles.subtitle}>
              Enter the 6-digit code sent to{"\n"}
              <Text style={styles.highlightText}>
                {identifier || "your registered email/phone"}
              </Text>
            </Text>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            {errorMessage ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {successMessage ? (
              <View style={styles.successContainer}>
                <Text style={styles.successText}>{successMessage}</Text>
              </View>
            ) : null}

            <Text style={styles.label}>6-Digit OTP Code</Text>
            <TextInput
              style={[
                styles.otpInput,
                errorMessage && styles.otpInputError,
              ]}
              placeholder="123456"
              placeholderTextColor="#CBD5E1"
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              autoFocus={true}
              onChangeText={(text) => {
                setOtp(text);
                if (errorMessage) setErrorMessage("");
              }}
            />

            {/* Verification Helper Notice */}
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>💡 Dev / Testing Tip:</Text>
              <Text style={styles.infoText}>
                The OTP is printed directly in the backend terminal console when
                registered or requested.
              </Text>
            </View>

            {/* Verify Button */}
            <TouchableOpacity
              style={[
                styles.verifyButton,
                (otp.length !== 6 || loading) && styles.disabledButton,
              ]}
              onPress={handleVerify}
              disabled={otp.length !== 6 || loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.secondary} />
              ) : (
                <Text style={styles.verifyButtonText}>Verify Account</Text>
              )}
            </TouchableOpacity>

            {/* Resend Section */}
            <View style={styles.resendContainer}>
              <Text style={styles.resendText}>{"Didn't receive code? "}</Text>
              {canResend ? (
                <TouchableOpacity onPress={handleResend} disabled={resendLoading}>
                  {resendLoading ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : (
                    <Text style={styles.resendLink}>Resend OTP</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <Text style={styles.timerText}>
                  Resend in <Text style={styles.timerBold}>{countdown}s</Text>
                </Text>
              )}
            </View>

            {/* Back to Login */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.navigate("Login")}
            >
              <Text style={styles.backButtonText}>← Back to Login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.secondary,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 32,
    alignItems: "center",
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F4F0FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  iconText: {
    fontSize: 36,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  highlightText: {
    color: COLORS.primary,
    fontWeight: "bold",
  },
  formContainer: {
    width: "100%",
  },
  errorContainer: {
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 14,
    textAlign: "center",
    fontWeight: "500",
  },
  successContainer: {
    backgroundColor: "#D1FAE5",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  successText: {
    color: COLORS.success,
    fontSize: 14,
    textAlign: "center",
    fontWeight: "500",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: 10,
    textAlign: "center",
  },
  otpInput: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 16,
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.textPrimary,
    textAlign: "center",
    letterSpacing: 10,
    marginBottom: 20,
  },
  otpInputError: {
    borderColor: COLORS.error,
    backgroundColor: "#FFF5F5",
  },
  infoBox: {
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#1E40AF",
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: "#1E3A8A",
    lineHeight: 18,
  },
  verifyButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: {
    backgroundColor: "#A5B4FC",
  },
  verifyButtonText: {
    color: COLORS.secondary,
    fontSize: 16,
    fontWeight: "bold",
  },
  resendContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
  },
  resendText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  resendLink: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "bold",
  },
  timerText: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  timerBold: {
    color: COLORS.primary,
    fontWeight: "bold",
  },
  backButton: {
    marginTop: 28,
    alignItems: "center",
  },
  backButtonText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
});

export default OtpVerificationScreen;
