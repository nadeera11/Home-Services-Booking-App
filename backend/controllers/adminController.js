const User = require("../models/User");

/**
 * @desc    Get list of service providers (filtered by approval status)
 * @route   GET /api/admin/providers
 * @access  Private (Admin only)
 */
const getProviders = async (req, res) => {
  try {
    const { status } = req.query; // 'pending', 'approved', 'rejected', or undefined for all

    const query = { role: "provider" };
    if (status && ["pending", "approved", "rejected"].includes(status)) {
      query["providerDetails.approvalStatus"] = status;
    }

    const providers = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      count: providers.length,
      providers,
    });
  } catch (error) {
    console.error("Get Providers Error:", error);
    return res.status(500).json({ message: "Server error fetching providers" });
  }
};

/**
 * @desc    Approve or Reject a Service Provider
 * @route   PUT /api/admin/verify-provider/:id
 * @access  Private (Admin only)
 */
const verifyProvider = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, rejectionReason } = req.body; // action: 'approve' or 'reject'

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ message: "Invalid action. Must be 'approve' or 'reject'" });
    }

    const provider = await User.findById(id);

    if (!provider || provider.role !== "provider") {
      return res.status(404).json({ message: "Service Provider not found" });
    }

    if (action === "approve") {
      provider.isApprovedByAdmin = true;
      provider.providerDetails.approvalStatus = "approved";
      provider.providerDetails.rejectionReason = "";
    } else if (action === "reject") {
      provider.isApprovedByAdmin = false;
      provider.providerDetails.approvalStatus = "rejected";
      provider.providerDetails.rejectionReason =
        rejectionReason || "Verification documents did not meet system requirements.";
    }

    await provider.save();

    console.log("==========================================");
    console.log(`🛡️ [ADMIN ACTION] Provider ${action.toUpperCase()}D`);
    console.log(`👤 Name: ${provider.name}`);
    console.log(`📧 Email: ${provider.email}`);
    console.log("==========================================");

    return res.status(200).json({
      message: `Service Provider has been successfully ${action}d.`,
      provider: {
        id: provider._id,
        name: provider.name,
        email: provider.email,
        isApprovedByAdmin: provider.isApprovedByAdmin,
        approvalStatus: provider.providerDetails.approvalStatus,
        rejectionReason: provider.providerDetails.rejectionReason,
      },
    });
  } catch (error) {
    console.error("Verify Provider Error:", error);
    return res.status(500).json({ message: "Server error reviewing provider" });
  }
};

/**
 * @desc    Get list of all registered users (Customers, Providers, Admins) with platform metrics
 * @route   GET /api/admin/users
 * @access  Private (Admin only)
 */
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select("-password").sort({ createdAt: -1 });

    const customerCount = users.filter((u) => u.role === "customer").length;
    const providerCount = users.filter((u) => u.role === "provider").length;

    return res.status(200).json({
      total: users.length,
      customerCount,
      providerCount,
      users,
    });
  } catch (error) {
    console.error("Get All Users Error:", error);
    return res.status(500).json({ message: "Server error fetching user list" });
  }
};

/**
 * @desc    Create a new Admin account (Admin only)
 * @route   POST /api/admin/create-admin
 * @access  Private (Admin only)
 */
const createAdmin = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: "Name, email, phone, and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanPhone = phone.trim();

    const emailExists = await User.findOne({ email: cleanEmail });
    if (emailExists) {
      return res.status(400).json({ message: "An account with this email already exists" });
    }

    const phoneExists = await User.findOne({ phone: cleanPhone });
    if (phoneExists) {
      return res.status(400).json({ message: "An account with this phone number already exists" });
    }

    const newAdmin = await User.create({
      name: name.trim(),
      email: cleanEmail,
      phone: cleanPhone,
      password,
      role: "admin",
      isVerified: true,
      isApprovedByAdmin: true,
    });

    console.log("==========================================");
    console.log("🛡️ NEW ADMIN ACCOUNT CREATED BY SYSTEM ADMIN");
    console.log(`👤 Name: ${newAdmin.name}`);
    console.log(`📧 Email: ${newAdmin.email}`);
    console.log("==========================================");

    return res.status(201).json({
      message: "Admin account created successfully",
      admin: {
        id: newAdmin._id,
        name: newAdmin.name,
        email: newAdmin.email,
        phone: newAdmin.phone,
        role: newAdmin.role,
      },
    });
  } catch (error) {
    console.error("Create Admin Error:", error);
    return res.status(500).json({ message: "Server error creating admin account" });
  }
};

/**
 * @desc    Update current Admin profile details
 * @route   PUT /api/admin/profile
 * @access  Private (Admin only)
 */
const updateAdminProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "Admin account not found" });
    }

    const { name, email, phone, password } = req.body;

    if (name) user.name = name.trim();

    if (email && email.toLowerCase().trim() !== user.email) {
      const emailExists = await User.findOne({ email: email.toLowerCase().trim() });
      if (emailExists) {
        return res.status(400).json({ message: "An account with this email already exists" });
      }
      user.email = email.toLowerCase().trim();
    }

    if (phone && phone.trim() !== user.phone) {
      const phoneExists = await User.findOne({ phone: phone.trim() });
      if (phoneExists) {
        return res.status(400).json({ message: "An account with this phone number already exists" });
      }
      user.phone = phone.trim();
    }

    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters" });
      }
      user.password = password;
    }

    const updatedUser = await user.save();

    return res.status(200).json({
      message: "Admin profile updated successfully",
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role,
        isVerified: updatedUser.isVerified,
      },
    });
  } catch (error) {
    console.error("Update Admin Profile Error:", error);
    return res.status(500).json({ message: "Server error updating profile" });
  }
};

/**
 * @desc    Delete current Admin account
 * @route   DELETE /api/admin/profile
 * @access  Private (Admin only)
 */
const deleteAdminProfile = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "Admin account not found" });
    }

    console.log("==========================================");
    console.log(`⚠️ ADMIN ACCOUNT DELETED: ${user.email}`);
    console.log("==========================================");

    return res.status(200).json({ message: "Admin account deleted successfully" });
  } catch (error) {
    console.error("Delete Admin Profile Error:", error);
    return res.status(500).json({ message: "Server error deleting account" });
  }
};

/**
 * @desc    Get dashboard summary statistics (total customers, service providers, active bookings, complaints, etc.)
 * @route   GET /api/admin/dashboard-stats
 * @access  Private (Admin only)
 */
const getDashboardStats = async (req, res) => {
  try {
    const Booking = require("../models/Booking");
    const Complaint = require("../models/Complaint");

    const totalCustomers = await User.countDocuments({ role: "customer" });
    const serviceProviders = await User.countDocuments({ role: "provider" });
    const verifiedProviders = await User.countDocuments({
      role: "provider",
      isApprovedByAdmin: true,
    });
    const pendingVerifications = await User.countDocuments({
      role: "provider",
      "providerDetails.approvalStatus": "pending",
    });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const newApplicationsToday = await User.countDocuments({
      role: "provider",
      createdAt: { $gte: startOfToday },
    });

    // Active Bookings (confirmed, ongoing, inspecting, etc.)
    const activeBookings = await Booking.countDocuments({
      status: { $in: ["confirmed", "ongoing", "inspecting", "inspection_confirmed", "time_proposed", "awaiting_quote"] },
    });

    const bookingsToday = await Booking.countDocuments({
      createdAt: { $gte: startOfToday },
    });

    // Complaints
    const openComplaints = await Complaint.countDocuments({
      status: { $in: ["Submitted", "Under Review"] },
    });

    return res.status(200).json({
      totalCustomers,
      serviceProviders,
      verifiedProviders,
      pendingVerifications,
      newApplicationsToday,
      activeBookings,
      bookingsToday,
      openComplaints,
    });
  } catch (error) {
    console.error("Get Dashboard Stats Error:", error);
    return res.status(500).json({ message: "Server error fetching dashboard statistics" });
  }
};

/**
 * @desc    Get reports & analytics data (Last 7 days, Last 30 days, Last 90 days) from Database
 * @route   GET /api/admin/reports-analytics
 * @access  Private (Admin only)
 */
const getReportsAnalytics = async (req, res) => {
  try {
    const Booking = require('../models/Booking');
    const now = new Date(), day = 86400000;
    const earliest = new Date(now.getTime() - 180 * day);
    // Read only report fields; avoid dozens of sequential database round trips.
    const [bookings, users] = await Promise.all([
      Booking.find({ createdAt: { $gte: earliest, $lte: now } }).select('createdAt status review.rating').lean(),
      User.find({ role: { $in: ['customer', 'provider'] }, createdAt: { $gte: earliest, $lte: now } }).select('createdAt role').lean(),
    ]);
    const result = {};
    const metric = (value, prior, inverse = false) => ({
      value: value.toLocaleString('en-US'),
      dir: value >= prior ? 'up' : 'down',
      good: inverse ? value <= prior : value >= prior,
      note: prior ? Math.abs((value - prior) / prior * 100).toFixed(1) + '% vs prior' : 'No prior-period baseline',
    });
    const cancelled = b => ['cancelled', 'rejected'].includes(b.status);
    const average = rows => {
      const ratings = rows.filter(b => b.status === 'completed' && Number.isFinite(b.review?.rating)).map(b => b.review.rating);
      return ratings.length ? ratings.reduce((a,b) => a+b, 0) / ratings.length : null;
    };
    for (const days of [7, 30, 90]) {
      const from = now.getTime() - days * day;
      const current = bookings.filter(b => +new Date(b.createdAt) >= from);
      const prior = bookings.filter(b => +new Date(b.createdAt) >= from - days * day && +new Date(b.createdAt) < from);
      const rating = average(current), previousRating = average(prior);
      const counts = Array(7).fill(0), cancellations = Array(7).fill(0);
      for (const b of current) {
        const index = Math.min(6, Math.floor((+new Date(b.createdAt) - from) / (days * day) * 7));
        counts[index]++; if (cancelled(b)) cancellations[index]++;
      }
      const growth = role => Array.from({length:7}, (_,i) => users.filter(u => u.role === role && +new Date(u.createdAt) >= from && +new Date(u.createdAt) <= from + (i + 1) * days * day / 7).length);
      const label = time => new Intl.DateTimeFormat('en-GB', {day:'numeric', month:'short', timeZone:'Asia/Colombo'}).format(new Date(time));
      result['Last ' + days + ' days'] = {
        stats: {
          total: metric(current.length, prior.length),
          completed: metric(current.filter(b => b.status === 'completed').length, prior.filter(b => b.status === 'completed').length),
          cancelled: metric(current.filter(cancelled).length, prior.filter(cancelled).length, true),
          rating: {value: rating == null ? '—' : rating.toFixed(2), dir: rating >= previousRating ? 'up' : 'down', good: rating >= previousRating,
            note: rating == null ? 'No reviews in this booking period' : previousRating == null ? 'No prior-period reviews' : Math.abs(rating - previousRating).toFixed(2) + ' points'},
        },
        labels: [label(from), label(from + days * day / 2), label(now)],
        bookings: counts, cancellations, customers: growth('customer'), providers: growth('provider'),
      };
    }
    return res.status(200).json(result);
  } catch (error) {
    console.error('Reports analytics failed:', error.name);
    return res.status(503).json({message:'Reports are temporarily unavailable. Please try again.'});
  }
};

module.exports = {
  getProviders,
  verifyProvider,
  getAllUsers,
  createAdmin,
  updateAdminProfile,
  deleteAdminProfile,
  getDashboardStats,
  getReportsAnalytics,
};
