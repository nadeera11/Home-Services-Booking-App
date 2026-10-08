import api from "./api";

export const adminService = {
  // Fetch providers filtered by status ('pending', 'approved', 'rejected')
  getProviders: async (status = "pending") => {
    const response = await api.get(`/admin/providers?status=${status}`);
    return response.data;
  },

  // Verify (Approve or Reject) a provider
  verifyProvider: async (providerId, action, rejectionReason = "") => {
    const response = await api.put(`/admin/verify-provider/${providerId}`, {
      action,
      rejectionReason,
    });
    return response.data;
  },

  // Fetch all registered users & platform metrics from database
  getAllUsers: async () => {
    const response = await api.get("/admin/users");
    return response.data;
  },

  // Create a new Admin account
  createAdmin: async (adminData) => {
    const response = await api.post("/admin/create-admin", adminData);
    return response.data;
  },

  // Update current Admin profile
  updateProfile: async (profileData) => {
    const response = await api.put("/admin/profile", profileData);
    return response.data;
  },

  // Delete current Admin account
  deleteProfile: async () => {
    const response = await api.delete("/admin/profile");
    return response.data;
  },

  // Fetch dashboard summary statistics from DB
  getDashboardStats: async () => {
    const response = await api.get("/admin/dashboard-stats");
    return response.data;
  },

  // Fetch reports & analytics data from DB
  getReportsAnalytics: async () => {
    const response = await api.get("/admin/reports-analytics");
    return response.data;
  },
};

export default adminService;
