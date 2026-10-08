import React, { createContext, useState, useEffect, useContext, useCallback } from "react";
import { authService } from "../services/authService";
import { getSecureItem } from "../utils/storage";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Only restoring a session may replace the navigator with the startup loader.
  // Login/OTP screens own their request spinners and must stay mounted on failure.
  const checkAuthState = useCallback(() => {
    return getSecureItem("userToken").then(async (storedToken) => {
      if (!storedToken) return;
      const res = await authService.getMe();
      if (!res?.user) throw new Error("Invalid session response");
      await authService.saveSession(storedToken, res.user);
      setUser(res.user);
      setToken(storedToken);
    }).catch(async () => {
      await authService.clearSession();
      setToken(null);
      setUser(null);
    }).finally(() => setIsLoading(false));
  }, []);

  useEffect(() => { void checkAuthState(); }, [checkAuthState]);

  const login = async (identifier, password) => {
    try {
      const data = await authService.login(identifier, password);

      if (data.requiresVerification) {
        return { success: false, requiresVerification: true, identifier: data.identifier, message: data.message };
      }

      if (data.token && data.user) {
        await authService.saveSession(data.token, data.user);
        setToken(data.token);
        setUser(data.user);
        await authService.saveSession(data.token, data.user);
        return { success: true, user: data.user, role: data.user.role };
      }
      return { success: false, message: data.message || "Login failed" };
    } catch (error) {
      const msg = error.response?.data?.message || "Invalid credentials or connection error";
      const isUnverified = error.response?.data?.requiresVerification;
      const unverifiedIdentifier = error.response?.data?.identifier;
      return {
        success: false,
        requiresVerification: isUnverified,
        identifier: unverifiedIdentifier,
        requiresAdminApproval: error.response?.data?.requiresAdminApproval,
        approvalStatus: error.response?.data?.approvalStatus,
        message: msg,
      };
    }
  };

  const register = async (userData) => {
    try {
      const data = await authService.register(userData);
      return { success: true, data };
    } catch (error) {
      const msg = error.response?.data?.message || "Registration failed";
      return { success: false, message: msg };
    }
  };

  const verifyOTP = async (identifier, otp) => {
    try {
      const data = await authService.verifyOTP(identifier, otp);
      if (data.token && data.user) {
        await authService.saveSession(data.token, data.user);
        setToken(data.token);
        setUser(data.user);
        await authService.saveSession(data.token, data.user);
        return { success: true, user: data.user, role: data.user.role, message: data.message };
      }
      return {
        success: true,
        message: data.message,
        requiresAdminApproval: data.requiresAdminApproval,
        user: data.user,
        role: data.user?.role,
      };
    } catch (error) {
      const msg = error.response?.data?.message || "OTP verification failed";
      return { success: false, message: msg };
    }
  };

  const resendOTP = async (identifier) => {
    try {
      const data = await authService.resendOTP(identifier);
      return { success: true, message: data.message };
    } catch (error) {
      const msg = error.response?.data?.message || "Failed to resend OTP";
      return { success: false, message: msg };
    }
  };

  const forgotPassword = async (identifier) => {
    try {
      const data = await authService.forgotPassword(identifier);
      return { success: true, message: data.message, identifier: data.identifier };
    } catch (error) {
      const msg = error.response?.data?.message || "Forgot password request failed";
      return { success: false, message: msg };
    }
  };

  const verifyResetOTP = async (identifier, otp) => {
    try {
      const data = await authService.verifyResetOTP(identifier, otp);
      return { success: true, message: data.message };
    } catch (error) {
      const msg = error.response?.data?.message || "Reset OTP verification failed";
      return { success: false, message: msg };
    }
  };

  const resetPassword = async (identifier, otp, newPassword) => {
    try {
      const data = await authService.resetPassword(identifier, otp, newPassword);
      return { success: true, message: data.message };
    } catch (error) {
      const msg = error.response?.data?.message || "Failed to reset password";
      return { success: false, message: msg };
    }
  };

  const updateUserLocation = async (locationData) => {
    try {
      const res = await authService.updateLocation(locationData);
      if (res && res.user) {
        setUser(res.user);
        if (token) {
          await authService.saveSession(token, res.user);
        }
        return { success: true, user: res.user };
      }
      return { success: false, message: "Failed to update location" };
    } catch (error) {
      const msg = error.response?.data?.message || "Error updating location";
      return { success: false, message: msg };
    }
  };

  const updateUserSession = async (updatedUser) => {
    setUser(updatedUser);
    if (token) {
      await authService.saveSession(token, updatedUser);
    }
  };

  const logout = async () => {
    await authService.clearSession();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        userRole: user?.role || null,
        login,
        register,
        verifyOTP,
        resendOTP,
        forgotPassword,
        verifyResetOTP,
        resetPassword,
        updateUserSession,
        updateUserLocation,
        logout,
        checkAuthState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
