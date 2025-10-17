const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/approvalsController');

router.get('/', authenticate, requireRole(['superadmin']), ctrl.list);
router.get('/:id', authenticate, requireRole(['superadmin']), ctrl.get);
router.post('/:id/approve', authenticate, requireRole(['superadmin']), [param('id').isInt()], validate, ctrl.approve);
router.post('/:id/reject', authenticate, requireRole(['superadmin']), [param('id').isInt(), body('reason').optional().isString()], validate, ctrl.reject);

module.exports = router;
