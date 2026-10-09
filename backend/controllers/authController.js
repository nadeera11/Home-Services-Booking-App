const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const { generateOTP, getOtpExpiry, logOTP } = require("../services/otpService");

// Helper to sanitize user object for response
const sanitizeUser = (user) => {
  return {
    id: user._id,
    name: user.name,
    avatar: user.avatar || "",
    email: user.email,
    phone: user.phone,
    role: user.role,
    location: user.location || {},
    isVerified: user.isVerified,
    isApprovedByAdmin: user.isApprovedByAdmin,
    providerDetails: user.providerDetails || {},
    location: user.location || {},
  };
};

/**
 * @desc    Register a new user (Customer or Service Provider)
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res) => {
  try {
    const { name, email, phone, password, role, providerDetails, location } = req.body;

    if (!name || !email || !phone || !password || !role) {
      return res.status(400).json({ message: "Please fill in all required fields" });
    }

    // Security check: Admin role cannot be registered publicly
    if (role === "admin") {
      return res.status(400).json({
        message: "Admin accounts cannot be created through public registration",
      });
    }

    if (!["customer", "provider"].includes(role)) {
      return res.status(400).json({ message: "Invalid role selected" });
    }

    // Check if email or phone already exists
    const emailExists = await User.findOne({ email: email.toLowerCase().trim() });
    if (emailExists) {
      return res.status(400).json({ message: "An account with this email already exists" });
    }

    const phoneExists = await User.findOne({ phone: phone.trim() });
    if (phoneExists) {
      return res.status(400).json({ message: "An account with this phone number already exists" });
    }

    // Validation for Service Provider NIC requirement
    if (role === "provider") {
      if (!providerDetails || !providerDetails.nicFront || !providerDetails.nicBack) {
        return res.status(400).json({
          message: "NIC Front and NIC Back images are mandatory for Service Provider registration.",
        });
      }
    }

    // Generate 6-digit OTP
    const otp = generateOTP();
    const otpExpires = getOtpExpiry(10); // Valid for 10 minutes

    const isProvider = role === "provider";

    const userData = {
      name,
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      password,
      role,
      isVerified: false,
      isApprovedByAdmin: !isProvider, // Customers are auto-approved by admin, Providers require manual admin verification
      otp,
      otpExpires,
      otpAttempts: 0,
      otpLastSent: new Date(),
      location: {
        address: location?.address || "",
        city: location?.city || "",
        district: location?.district || "",
        latitude: location?.latitude ? Number(location.latitude) : null,
        longitude: location?.longitude ? Number(location.longitude) : null,
      },
    };

    if (isProvider) {
      userData.providerDetails = {
        category: providerDetails?.category || "",
        experience: providerDetails?.experience || "",
        qualifications: providerDetails?.qualifications || "",
        nicFront: providerDetails.nicFront,
        nicBack: providerDetails.nicBack,
        certificates: providerDetails?.certificates || [],
        approvalStatus: "pending",
      };
    }

    const user = await User.create(userData);

    // Log OTP to backend console for dev/testing
    logOTP(user.email, otp, "Account Registration Verification");

    return res.status(201).json({
      message: isProvider
        ? "Registration successful. Please verify OTP. Note: Your account will require Admin Approval before logging in."
        : "Registration successful. Please verify the OTP sent to your email/phone.",
      identifier: user.email,
      role: user.role,
      requiresAdminApproval: isProvider,
    });
  } catch (error) {
    console.error("Register Error:", error);
    return res.status(500).json({ message: error.message || "Server error during registration" });
  }
};

/**
 * @desc    Verify OTP for account activation
 * @route   POST /api/auth/verify-otp
 * @access  Public
 */
const verifyOtp = async (req, res) => {
  try {
    const { identifier, otp } = req.body;

    if (!identifier || !otp) {
      return res.status(400).json({ message: "Identifier and OTP code are required" });
    }

    const cleanIdentifier = identifier.toLowerCase().trim();
    const user = await User.findOne({
      $or: [{ email: cleanIdentifier }, { phone: cleanIdentifier }],
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check OTP expiration
    if (user.otpExpires && user.otpExpires < new Date()) {
      return res.status(400).json({ message: "OTP has expired. Please request a new code." });
    }

    // Check attempt limits (max 5)
    if (user.otpAttempts >= 5) {
      return res.status(400).json({
        message: "Too many failed attempts. Please click Resend OTP to get a new code.",
      });
    }

    // Strict OTP code validation
    if (user.otp && user.otp !== otp.toString().trim()) {
      user.otpAttempts += 1;
      await user.save();
      const remaining = 5 - user.otpAttempts;
      if (remaining <= 0) {
        return res.status(400).json({
          message: "OTP is incorrect. You have exceeded maximum attempts. Please click Resend OTP to get a new code.",
        });
      }
      return res.status(400).json({
        message: `OTP is incorrect. Please re-enter the code. (${remaining} attempt${remaining > 1 ? "s" : ""} remaining)`,
      });
    }

    if (user.isVerified && !user.otp) {
      // Check if provider needs admin approval
      if (user.role === "provider" && (!user.isApprovedByAdmin || user.providerDetails?.approvalStatus !== "approved")) {
        return res.status(200).json({
          message: "Account verified, but awaiting Admin approval before login.",
          requiresAdminApproval: true,
          user: sanitizeUser(user),
        });
      }

      const token = generateToken(user._id, user.role);
      return res.status(200).json({
        message: "Account is already verified",
        token,
        user: sanitizeUser(user),
      });
    }

    // Successful OTP verification
    user.isVerified = true;
    user.otp = null;
    user.otpExpires = null;
    user.otpAttempts = 0;
    await user.save();

    // If Service Provider, notify about admin review stage
    if (user.role === "provider" && (!user.isApprovedByAdmin || user.providerDetails?.approvalStatus !== "approved")) {
      return res.status(200).json({
        message: "OTP verified successfully! Your profile & NIC documents are now submitted for Admin Review.",
        requiresAdminApproval: true,
        user: sanitizeUser(user),
      });
    }

    const token = generateToken(user._id, user.role);

    return res.status(200).json({
      message: "Account verified successfully",
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Verify OTP Error:", error);
    return res.status(500).json({ message: "Server error during OTP verification" });
  }
};

/**
 * @desc    Resend OTP to user
 * @route   POST /api/auth/resend-otp
 * @access  Public
 */
const resendOtp = async (req, res) => {
  try {
    const { identifier } = req.body;

    if (!identifier) {
      return res.status(400).json({ message: "Identifier (email or phone) is required" });
    }

    const cleanIdentifier = identifier.toLowerCase().trim();
    const user = await User.findOne({
      $or: [{ email: cleanIdentifier }, { phone: cleanIdentifier }],
    });

    if (!user) {
      return res.status(404).json({ message: "User account not found" });
    }

    // Cooldown check (60 seconds)
    if (user.otpLastSent && new Date() - new Date(user.otpLastSent) < 60 * 1000) {
      const remainingSecs = Math.ceil(
        (60 * 1000 - (new Date() - new Date(user.otpLastSent))) / 1000
      );
      return res.status(400).json({
        message: `Please wait ${remainingSecs} seconds before requesting a new OTP.`,
      });
    }

    const newOtp = generateOTP();
    user.otp = newOtp;
    user.otpExpires = getOtpExpiry(10);
    user.otpAttempts = 0;
    user.otpLastSent = new Date();
    await user.save();

    logOTP(user.email, newOtp, "Resent Verification OTP");

    return res.status(200).json({
      message: "New OTP code sent successfully",
      identifier: user.email,
    });
  } catch (error) {
    console.error("Resend OTP Error:", error);
    return res.status(500).json({ message: "Server error while resending OTP" });
  }
};

/**
 * @desc    User Login
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ message: "Please provide email/phone and password" });
    }

    const cleanIdentifier = identifier.toLowerCase().trim();
    const user = await User.findOne({
      $or: [{ email: cleanIdentifier }, { phone: cleanIdentifier }],
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid email/phone or password" });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email/phone or password" });
    }

    // If account is not verified via OTP yet
    if (!user.isVerified) {
      const newOtp = generateOTP();
      user.otp = newOtp;
      user.otpExpires = getOtpExpiry(10);
      user.otpAttempts = 0;
      user.otpLastSent = new Date();
      await user.save();

      logOTP(user.email, newOtp, "Login Verification Required");

      return res.status(403).json({
        message: "Account not verified. A new OTP has been sent to your email/phone.",
        requiresVerification: true,
        identifier: user.email,
      });
    }

    // Check Admin Approval requirement for Service Providers
    if (user.role === "provider") {
      if (!user.isApprovedByAdmin || user.providerDetails?.approvalStatus !== "approved") {
        if (user.providerDetails?.approvalStatus === "rejected") {
          return res.status(403).json({
            message: `Your Service Provider account application was rejected by Admin.${
              user.providerDetails?.rejectionReason
                ? ` Reason: ${user.providerDetails.rejectionReason}`
                : ""
            }`,
            requiresAdminApproval: true,
            approvalStatus: "rejected",
          });
        }

        return res.status(403).json({
          message: "Your Service Provider account is currently under Admin Review. You will be able to log in once an administrator approves your NIC & documents.",
          requiresAdminApproval: true,
          approvalStatus: "pending",
        });
      }
    }

    const token = generateToken(user._id, user.role);

    return res.status(200).json({
      message: "Login successful",
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({ message: "Server error during login" });
  }
};

/**
 * @desc    Initiate Forgot Password flow
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
const forgotPassword = async (req, res) => {
  try {
    const { identifier } = req.body;

    if (!identifier) {
      return res.status(400).json({ message: "Please enter your email or phone number" });
    }

    const cleanIdentifier = identifier.toLowerCase().trim();
    const user = await User.findOne({
      $or: [{ email: cleanIdentifier }, { phone: cleanIdentifier }],
    });

    if (!user) {
      return res.status(404).json({ message: "No user found with provided email or phone" });
    }

    const resetOtp = generateOTP();
    user.otp = resetOtp;
    user.otpExpires = getOtpExpiry(15);
    user.otpAttempts = 0;
    user.otpLastSent = new Date();
    await user.save();

    logOTP(user.email, resetOtp, "Password Reset OTP");

    return res.status(200).json({
      message: "Password reset OTP sent successfully",
      identifier: user.email,
    });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    return res.status(500).json({ message: "Server error initiating password reset" });
  }
};

/**
 * @desc    Verify Reset Password OTP
 * @route   POST /api/auth/verify-reset-otp
 * @access  Public
 */
const verifyResetOtp = async (req, res) => {
  try {
    const { identifier, otp } = req.body;

    if (!identifier || !otp) {
      return res.status(400).json({ message: "Identifier and OTP code are required" });
    }

    const cleanIdentifier = identifier.toLowerCase().trim();
    const user = await User.findOne({
      $or: [{ email: cleanIdentifier }, { phone: cleanIdentifier }],
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.otpExpires || user.otpExpires < new Date()) {
      return res.status(400).json({ message: "Reset OTP has expired. Please request again." });
    }

    if (user.otp !== otp.toString().trim()) {
      return res.status(400).json({ message: "Invalid OTP code" });
    }

    return res.status(200).json({
      message: "OTP verified successfully. You can now reset your password.",
      identifier: user.email,
      otp,
    });
  } catch (error) {
    console.error("Verify Reset OTP Error:", error);
    return res.status(500).json({ message: "Server error verifying reset OTP" });
  }
};

/**
 * @desc    Reset Password with OTP
 * @route   POST /api/auth/reset-password
 * @access  Public
 */
const resetPassword = async (req, res) => {
  try {
    const { identifier, otp, newPassword } = req.body;

    if (!identifier || !otp || !newPassword) {
      return res.status(400).json({ message: "Identifier, OTP code, and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }

    const cleanIdentifier = identifier.toLowerCase().trim();
    const user = await User.findOne({
      $or: [{ email: cleanIdentifier }, { phone: cleanIdentifier }],
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.otp !== otp.toString().trim() || !user.otpExpires || user.otpExpires < new Date()) {
      return res.status(400).json({ message: "Invalid or expired OTP session" });
    }

    // Set new password (pre-save middleware handles hashing)
    user.password = newPassword;
    user.otp = null;
    user.otpExpires = null;
    user.otpAttempts = 0;
    await user.save();

    return res.status(200).json({
      message: "Password reset successfully. You can now login with your new password.",
    });
  } catch (error) {
    console.error("Reset Password Error:", error);
    return res.status(500).json({ message: "Server error resetting password" });
  }
};

/**
 * @desc    Update the current customer's or provider's profile
 * @route   PATCH /api/auth/profile
 * @access  Private
 */
const updateProfile = async (req, res) => {
  try {
    if (!["customer", "provider"].includes(req.user.role)) {
      return res.status(403).json({ message: "Use admin profile settings." });
    }

    const updates = {};
    if (req.body.avatar !== undefined) {
      if (req.user.role !== 'provider') return res.status(403).json({ message: 'Provider profile photos only.' });
      const photo = req.body.avatar;
      if (typeof photo !== 'string' || photo.length > 1400000) return res.status(400).json({ message: 'Choose a JPEG or PNG photo under 1 MB.' });
      if (photo) {
        const match = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/.exec(photo);
        if (!match) return res.status(400).json({ message: 'Only JPEG and PNG photos are supported.' });
        const bytes = Buffer.from(match[2], 'base64');
        const valid = bytes.toString('base64') === match[2] && bytes.length <= 1024 * 1024 && (match[1] === 'png'
          ? bytes.length >= 45 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) && bytes.toString('ascii', 12, 16) === 'IHDR' && bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(20) > 0 && bytes.subarray(-8, -4).toString() === 'IEND'
          : bytes.length >= 20 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217);
        if (!valid) return res.status(400).json({ message: 'This photo is invalid or larger than 1 MB. Choose another JPEG or PNG.' });
      }
      updates.avatar = photo;
    }


    if (req.user.role === "provider" && req.body.acceptingRequests !== undefined) {
      if (typeof req.body.acceptingRequests !== "boolean") {
        return res.status(400).json({ message: "Invalid request availability." });
      }
      updates["providerDetails.acceptingRequests"] = req.body.acceptingRequests;
    }

    for (const [field, maxLength] of [["name", 120], ["phone", 18]]) {
      if (req.body[field] === undefined) continue;
      const value = req.body[field];
      if (
        typeof value !== "string" ||
        !value.trim() ||
        value.trim().length > maxLength ||
        (field === "phone" && (!/^\+?[\d\s-]{7,18}$/.test(value.trim()) || value.replace(/\D/g, "").length < 7))
      ) {
        return res.status(400).json({ message: "Enter a valid name and phone number." });
      }
      updates[field] = value.trim();
    }

    if (req.body.location !== undefined) {
      const location = req.body.location;
      if (
        !location ||
        typeof location !== "object" ||
        typeof location.address !== "string" ||
        typeof location.city !== "string" ||
        location.address.trim().length > 300 ||
        location.city.trim().length > 120 ||
        (!location.address.trim() && !location.city.trim())
      ) {
        return res.status(400).json({ message: "Enter a street address or city." });
      }

      const validCoordinate = (value, max) =>
        value === null ||
        (typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= max);
      if (
        !validCoordinate(location.latitude, 90) ||
        !validCoordinate(location.longitude, 180) ||
        (location.latitude === null) !== (location.longitude === null)
      ) {
        return res.status(400).json({ message: "Enter valid latitude and longitude together." });
      }

      updates.location = {
        address: location.address.trim(),
        city: location.city.trim(),
        latitude: location.latitude,
        longitude: location.longitude,
      };
    }

    if (req.user.role === "provider" && req.body.providerDetails !== undefined) {
      const details = req.body.providerDetails;
      if (!details || typeof details !== "object") {
        return res.status(400).json({ message: "Invalid provider profile." });
      }

      for (const [field, maxLength] of [
        ["bio", 2000],
        ["serviceArea", 300],
        ["experience", 120],
      ]) {
        if (
          typeof details[field] !== "string" ||
          details[field].trim().length > maxLength
        ) {
          return res.status(400).json({ message: "Check your profile details." });
        }
        updates[`providerDetails.${field}`] = details[field].trim();
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: updates,
        ...(updates["providerDetails.acceptingRequests"] !== undefined
          ? { $inc: { "providerDetails.availabilityRevision": 1 } }
          : {}),
      },
      { returnDocument: "after", runValidators: true }
    );

    return res.status(200).json({ user: sanitizeUser(user) });
  } catch (error) {
    console.error("Update Profile Error:", error);
    return res.status(error.code === 11000 ? 409 : 503).json({
      message:
        error.code === 11000
          ? "This phone number belongs to another account."
          : "Unable to save your profile. Please try again.",
    });
  }
};

/**
 * @desc    Get Current Logged In User Profile
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(200).json({
      user: sanitizeUser(req.user),
    });
  } catch (error) {
    console.error("GetMe Error:", error);
    return res.status(500).json({ message: "Server error fetching user profile" });
  }
};

/**
 * @desc    Update user location in database
 * @route   PUT /api/auth/location
 * @access  Private
 */
const updateLocation = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const { address, city, district, latitude, longitude } = req.body;

    req.user.location = {
      address: address !== undefined ? address : req.user.location?.address || "",
      city: city !== undefined ? city : req.user.location?.city || "",
      district: district !== undefined ? district : req.user.location?.district || "",
      latitude: latitude !== undefined ? (latitude ? Number(latitude) : null) : req.user.location?.latitude || null,
      longitude: longitude !== undefined ? (longitude ? Number(longitude) : null) : req.user.location?.longitude || null,
    };

    await req.user.save();

    return res.status(200).json({
      message: "Location updated successfully",
      user: sanitizeUser(req.user),
    });
  } catch (error) {
    console.error("Update Location Error:", error);
    return res.status(500).json({ message: "Server error updating location" });
  }
};

module.exports = {
  updateProfile,
  register,
  verifyOtp,
  resendOtp,
  login,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  getMe,
  updateLocation,
};
