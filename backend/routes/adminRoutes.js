const express = require("express");
const router = express.Router();
const {
  getProviders,
  verifyProvider,
  getAllUsers,
  createAdmin,
  updateAdminProfile,
  deleteAdminProfile,
  getDashboardStats,
  getReportsAnalytics,
} = require("../controllers/adminController");
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

// All admin routes require JWT authentication and Admin role
router.use(protect);
router.use(authorizeRoles("admin"));

router.get("/dashboard-stats", getDashboardStats);
router.get("/reports-analytics", getReportsAnalytics);
router.get("/providers", getProviders);
router.put("/verify-provider/:id", verifyProvider);
router.get("/users", getAllUsers);
router.post("/create-admin", createAdmin);
router.put("/profile", updateAdminProfile);
router.delete("/profile", deleteAdminProfile);

module.exports = router;
