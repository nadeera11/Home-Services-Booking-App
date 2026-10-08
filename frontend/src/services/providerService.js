import api from "./api";

export const getProviders = async (signal) => {
  const response = await api.get("/providers", { signal });
  return response.data.providers;
};

export const getProvider = async (id, signal) => {
  const response = await api.get(`/providers/${encodeURIComponent(id)}`, { signal });
  return response.data.provider;
};

export const providerService = {
  // Fetch provider availability data (working days, off dates, slots) from backend DB
  getAvailability: async (signal) => {
    const response = await api.get("/provider/availability", { signal });
    return response.data;
  },

  // Update working days configuration in backend DB
  updateWorkingDays: async (workingDays, version) => {
    const response = await api.put("/provider/availability/working-days", { workingDays, version });
    return response.data;
  },

  // Toggle a date as unavailable (offDate) or available in backend DB
  toggleOffDate: async (dateKey, isOff, version) => {
    const response = await api.post("/provider/availability/toggle-off-date", { dateKey, isOff, version });
    return response.data;
  },

  // Add a new availability time slot in backend DB
  addSlot: async (slotData) => {
    const response = await api.post("/provider/availability/slot", slotData);
    return response.data;
  },

  // Remove an availability slot from backend DB
  removeSlot: async (slotId) => {
    const response = await api.delete(`/provider/availability/slot/${slotId}`);
    return response.data;
  },
};

export default providerService;
