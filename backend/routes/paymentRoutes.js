const router = require('express').Router();
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
router.use(protect, authorizeRoles('customer', 'provider'));
router.patch('/:id', require('../controllers/paymentController').createPaymentController(require('../models/Booking')));
module.exports = router;
