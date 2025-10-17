const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/paramedicsController');

router.post('/', authenticate, requireRole(['superadmin','hospital_admin','fleet_admin']), [body('user_id').isInt()], validate, ctrl.create);
router.get('/:id', authenticate, requireRole(['superadmin','hospital_admin','fleet_admin']), [param('id').isInt()], validate, ctrl.get);
router.put('/:id', authenticate, requireRole(['superadmin','hospital_admin','fleet_admin']), [
	param('id').isInt(),
	body('code').optional().isString(),
	body('qualifications').optional().isArray(),
	body('profile').optional().isObject(),
], validate, ctrl.update);
router.get('/', authenticate, requireRole(['superadmin','hospital_admin','fleet_admin']), ctrl.list);

module.exports = router;
