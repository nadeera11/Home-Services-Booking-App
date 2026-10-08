const router = require('express').Router();
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const controller = require('../controllers/complaintController');
router.use(protect);
router.get('/', authorizeRoles('customer', 'admin'), controller.list);
router.post('/', authorizeRoles('customer'), controller.create);
router.patch('/:id', authorizeRoles('admin'), controller.update);
module.exports = router;
