const User = require("../models/User");

const APPROVED_PROVIDER = {
  role: "provider",
  isVerified: true,
  isApprovedByAdmin: true,
  "providerDetails.approvalStatus": "approved",
};

const publicProvider = (provider) => {
  const details = provider.providerDetails || {};
  const pricing = details.pricing && typeof details.pricing === "object"
    ? { ...details.pricing }
    : null;
  if (pricing) delete pricing.bankDetails;

  return {
    id: String(provider._id),
    name: provider.name,
    category: details.category || "",
    serviceArea: details.serviceArea || "",
    price: details.pricing && details.pricing.type !== "inspection" ? details.price ?? null : null,
    priceUnit: details.priceUnit || "visit",
    pricing,
    rating: details.rating ?? null,
    reviewCount: details.reviewCount ?? 0,
    latitude: details.latitude ?? null,
    longitude: details.longitude ?? null,
    nextAvailableAt: details.nextAvailableAt ?? null,
    acceptingRequests: details.acceptingRequests !== false,
    verified: true,
    bio: details.bio || "",
    experience: details.experience || "",
  };
};

const createProviderController = (UserModel, nextAppointment) => ({
  async list(_req, res) {
    try {
      const providers = await UserModel.find(APPROVED_PROVIDER)
        .select("name providerDetails")
        .sort({ name: 1, _id: 1 })
        .lean();
      return res.status(200).json({
        total: providers.length,
        providers: await Promise.all(providers
          .filter((provider) => provider.providerDetails?.acceptingRequests !== false)
          .map(async provider => ({ ...publicProvider(provider), ...(nextAppointment ? { nextAvailableAt: await nextAppointment(provider) } : {}) }))),
      });
    } catch (error) {
      console.error("List Providers Error:", error);
      return res.status(503).json({ message: "Unable to load providers. Please try again." });
    }
  },

  async detail(req, res) {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
      return res.status(400).json({ message: "Invalid provider id." });
    }
    try {
      const provider = await UserModel.findOne({
        _id: req.params.id,
        ...APPROVED_PROVIDER,
      })
        .select("name providerDetails")
        .lean();
      if (!provider) return res.status(404).json({ message: "Provider not found." });
      if (provider.providerDetails?.acceptingRequests === false) {
        return res.status(404).json({ message: "Provider not found." });
      }
      return res.status(200).json({ provider: { ...publicProvider(provider), ...(nextAppointment ? { nextAvailableAt: await nextAppointment(provider) } : {}) } });
    } catch (error) {
      console.error("Get Provider Error:", error);
      return res.status(503).json({ message: "Unable to load this provider. Please try again." });
    }
  },
});

// Appointment starts and reservations are managed by the booking controller.
// Keep the original routes, but never create a second set of bookable intervals.
const calendarController = require('./bookingController').createBookingController(require('../models/Booking'), User);
const publicController = createProviderController(User, calendarController.nextPublishedAt);
const legacyReadOnly = (_req, res) => res.status(409).json({ message: 'Legacy intervals are preserved for reference. Use Calendar to publish or withdraw an explicit appointment instead.' });
module.exports = {
  createProviderController, publicProvider,
  list: publicController.list, detail: publicController.detail,
  getAvailability: calendarController.calendar,
  updateWorkingDays: calendarController.workingDays,
  toggleOffDate: calendarController.offDate,
  addSlot: legacyReadOnly, removeSlot: legacyReadOnly,
};
