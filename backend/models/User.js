const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
    },
    role: {
      type: String,
      enum: ["customer", "provider", "admin"],
      default: "customer",
    },
    location: {
      address: { type: String, default: '', maxlength: 300 },
      city: { type: String, default: '', maxlength: 120 },
      latitude: { type: Number, default: null, min: -90, max: 90 },
      longitude: { type: Number, default: null, min: -180, max: 180 },
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isApprovedByAdmin: {
      type: Boolean,
      default: true, // Customers and Admin default to true, Providers default to false upon registration
    },
    otp: {
      type: String,
      default: null,
    },
    otpExpires: {
      type: Date,
      default: null,
    },
    otpAttempts: {
      type: Number,
      default: 0,
    },
    otpLastSent: {
      type: Date,
      default: null,
    },
    providerDetails: {
      acceptingRequests: { type: Boolean, default: true },
      category: { type: String, default: "" },
      experience: { type: String, default: "" },
      qualifications: { type: String, default: "" },
      bio: { type: String, default: "", maxlength: 2000 },
      serviceArea: { type: String, default: "" },
      // Public service location, not a customer's address.
      latitude: { type: Number, min: -90, max: 90, default: null },
      longitude: { type: Number, min: -180, max: 180, default: null },
      price: { type: Number, min: 0, default: null },
      priceUnit: { type: String, enum: ["visit", "hour", "session", "appliance"], default: "visit" },
      pricing: { type: mongoose.Schema.Types.Mixed, default: null },
      rating: { type: Number, min: 0, max: 5, default: null },
      reviewCount: { type: Number, min: 0, default: 0 },
      nextAvailableAt: { type: Date, default: null },
      // Explicitly published appointment starts; never inferred from working days.
      bookingSlots: [{ type: Date }],
      availabilityRevision: { type: Number, default: 0 },
      appointmentDurationMinutes: { type: Number, min: 30, max: 480, default: 60 },
      travelBufferMinutes: { type: Number, min: 0, max: 120, default: 30 },
      nicFront: { type: String, default: "" }, // Base64 or Image URI (Required for Provider)
      nicBack: { type: String, default: "" },  // Base64 or Image URI (Required for Provider)
      certificates: [{ type: String }],         // Array of Base64 or Image URIs (Optional)
      approvalStatus: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "approved",
      },
      rejectionReason: { type: String, default: "" },
    },
    location: {
      address: { type: String, default: "" },
      city: { type: String, default: "" },
      district: { type: String, default: "" },
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
    },
  },
  {
    timestamps: true,
  }
);

// Encrypt password before saving (Mongoose async pre-save hook)
userSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare entered password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);

module.exports = User;
