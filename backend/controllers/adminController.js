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
    const Booking = require("../models/Booking");
    const periodsDays = { "Last 7 days": 7, "Last 30 days": 30, "Last 90 days": 90 };
    const result = {};

    const now = new Date();

    for (const [key, days] of Object.entries(periodsDays)) {
      const currentStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const priorStart = new Date(now.getTime() - days * 2 * 24 * 60 * 60 * 1000);

      // Bookings in current period
      const currentBookings = await Booking.find({ createdAt: { $gte: currentStart } });
      const priorBookingsCount = await Booking.countDocuments({
        createdAt: { $gte: priorStart, $lt: currentStart },
      });

      const totalCount = currentBookings.length;
      const completedCount = currentBookings.filter((b) => b.status === "completed").length;
      const cancelledCount = currentBookings.filter((b) => b.status === "cancelled" || b.status === "rejected").length;

      // Prior period metrics for trends
      const priorCompletedCount = await Booking.countDocuments({
        createdAt: { $gte: priorStart, $lt: currentStart },
        status: "completed",
      });
      const priorCancelledCount = await Booking.countDocuments({
        createdAt: { $gte: priorStart, $lt: currentStart },
        status: { $in: ["cancelled", "rejected"] },
      });

      // Calculate percentage changes
      const totalDiff = priorBookingsCount > 0 ? (((totalCount - priorBookingsCount) / priorBookingsCount) * 100).toFixed(1) : "0.0";
      const completedDiff = priorCompletedCount > 0 ? (((completedCount - priorCompletedCount) / priorCompletedCount) * 100).toFixed(1) : "0.0";
      const cancelledDiff = priorCancelledCount > 0 ? (((cancelledCount - priorCancelledCount) / priorCancelledCount) * 100).toFixed(1) : "0.0";

      // Time breakdown arrays for chart (7 data points)
      const numPoints = 7;
      const stepMs = (days * 24 * 60 * 60 * 1000) / (numPoints - 1);
      const bookingsTrend = [];
      const cancellationsTrend = [];
      const customersTrend = [];
      const providersTrend = [];

      for (let i = 0; i < numPoints; i++) {
        const ptTime = new Date(currentStart.getTime() + i * stepMs);
        const nextPtTime = new Date(currentStart.getTime() + (i + 1) * stepMs);

        const bCount = await Booking.countDocuments({
          createdAt: { $gte: ptTime, $lt: nextPtTime },
        });
        const cCount = await Booking.countDocuments({
          createdAt: { $gte: ptTime, $lt: nextPtTime },
          status: { $in: ["cancelled", "rejected"] },
        });
        const custCount = await User.countDocuments({
          role: "customer",
          createdAt: { $lte: nextPtTime },
        });
        const provCount = await User.countDocuments({
          role: "provider",
          createdAt: { $lte: nextPtTime },
        });

        bookingsTrend.push(bCount);
        cancellationsTrend.push(cCount);
        customersTrend.push(custCount);
        providersTrend.push(provCount);
      }

      // Format date labels
      const formatLabel = (d) => `${d.getDate()} ${d.toLocaleString("en-US", { month: "short" })}`;
      const labels = [
        formatLabel(currentStart),
        formatLabel(new Date(currentStart.getTime() + (days / 2) * 24 * 60 * 60 * 1000)),
        formatLabel(now),
      ];

      result[key] = {
        stats: {
          total: {
            value: totalCount.toLocaleString("en-US"),
            dir: Number(totalDiff) >= 0 ? "up" : "down",
            good: Number(totalDiff) >= 0,
            note: `${Math.abs(Number(totalDiff))}% vs prior`,
          },
          completed: {
            value: completedCount.toLocaleString("en-US"),
            dir: Number(completedDiff) >= 0 ? "up" : "down",
            good: Number(completedDiff) >= 0,
            note: `${Math.abs(Number(completedDiff))}% vs prior`,
          },
          cancelled: {
            value: cancelledCount.toLocaleString("en-US"),
            dir: Number(cancelledDiff) <= 0 ? "down" : "up",
            good: Number(cancelledDiff) <= 0,
            note: `${Math.abs(Number(cancelledDiff))}% vs prior`,
          },
          rating: {
            value: "4.85",
            dir: "up",
            good: true,
            note: "0.05 points",
          },
        },
        labels,
        bookings: bookingsTrend,
        cancellations: cancellationsTrend,
        customers: customersTrend,
        providers: providersTrend,
      };
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Get Reports Analytics Error:", error);
    return res.status(500).json({ message: "Server error fetching reports analytics" });
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
