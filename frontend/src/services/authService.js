import api from "./api";
import { setSecureItem, deleteSecureItem } from "../utils/storage";

export const authService = {
  updateProfile: async values => (await api.patch('/auth/profile', values)).data.user,
  // Login user
  login: async (identifier, password) => {
    const response = await api.post("/auth/login", { identifier, password });
    return response.data;
  },

  // Register user (customer or provider)
  register: async (userData) => {
    const response = await api.post("/auth/register", userData);
    return response.data;
  },

  // Verify OTP
  verifyOTP: async (identifier, otp) => {
    const response = await api.post("/auth/verify-otp", { identifier, otp });
    return response.data;
  },

  // Resend OTP
  resendOTP: async (identifier) => {
    const response = await api.post("/auth/resend-otp", { identifier });
    return response.data;
  },

  // Forgot password request
  forgotPassword: async (identifier) => {
    const response = await api.post("/auth/forgot-password", { identifier });
    return response.data;
  },

  // Verify reset OTP
  verifyResetOTP: async (identifier, otp) => {
    const response = await api.post("/auth/verify-reset-otp", { identifier, otp });
    return response.data;
  },

  // Reset password
  resetPassword: async (identifier, otp, newPassword) => {
    const response = await api.post("/auth/reset-password", {
      identifier,
      otp,
      newPassword,
    });
    return response.data;
  },

  // Get profile of authenticated user
  getMe: async () => {
    const response = await api.get("/auth/me");
    return response.data;
  },

  // Update user location in database
  updateLocation: async (locationData) => {
    const response = await api.put("/auth/location", locationData);
    return response.data;
  },

  // Helper to store session tokens securely
  saveSession: async (token, user) => {
    if (token) await setSecureItem("userToken", token);
    if (user) await setSecureItem("userData", JSON.stringify(user));
  },

  // Clear session on logout
  clearSession: async () => {
    await deleteSecureItem("userToken");
    await deleteSecureItem("userData");
  },
};

export default authService;
