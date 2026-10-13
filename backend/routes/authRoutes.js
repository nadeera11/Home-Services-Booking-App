const express = require("express");
const router = express.Router();
const {
  register,
  verifyOtp,
  resendOtp,
  login,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  getMe,
  updateProfile,
  updateLocation,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

// Public routes
router.post("/register", register);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/verify-reset-otp", verifyResetOtp);
router.post("/reset-password", resetPassword);

// Protected routes
router.get("/me", protect, getMe);
router.patch("/profile", protect, updateProfile);
router.put("/location", protect, updateLocation);

const activity = require('../controllers/customerActivityController');
const { authorizeRoles } = require('../middleware/roleMiddleware');
router.get('/bookmarks', protect, authorizeRoles('customer'), activity.bookmarks);
router.put('/bookmarks/:id', protect, authorizeRoles('customer'), activity.save);
router.delete('/bookmarks/:id', protect, authorizeRoles('customer'), activity.save);
router.get('/notifications', protect, authorizeRoles('customer'), activity.notifications);
router.patch('/notifications/:id/read', protect, authorizeRoles('customer'), activity.read);
module.exports = router;
