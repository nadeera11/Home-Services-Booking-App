const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const {
  list,
  detail,
  getAvailability,
  updateWorkingDays,
  toggleOffDate,
  addSlot,
  removeSlot,
} = require("../controllers/providerController");

// The directory requires authentication, but is available to customers and providers.
router.use(protect);

router.get("/", list);

// Provider management routes
router.get("/availability", authorizeRoles("provider"), getAvailability);
router.put("/availability/working-days", authorizeRoles("provider"), updateWorkingDays);
router.post("/availability/toggle-off-date", authorizeRoles("provider"), toggleOffDate);
router.post("/availability/slot", authorizeRoles("provider"), addSlot);
router.delete("/availability/slot/:slotId", authorizeRoles("provider"), removeSlot);

router.get("/:id", detail);

module.exports = router;
