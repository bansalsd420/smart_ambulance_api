const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/paramedicsController');

router.post('/', authenticate, requireRole(['superadmin','hospital_admin','fleet_admin']), [
	body('email').isEmail(),
	body('password').isLength({ min: 6 }),
	body('name').isString().notEmpty(),
], validate, ctrl.create);
router.get('/:id', authenticate, requireRole(['superadmin','hospital_admin','fleet_admin']), [param('id').isInt()], validate, ctrl.get);
router.put('/:id', authenticate, requireRole(['superadmin','hospital_admin','fleet_admin']), [
	param('id').isInt(),
	body('name').optional().isString(),
	body('posting').optional().isString(),
	body('department').optional().isString(),
], validate, ctrl.update);
router.delete('/:id', authenticate, requireRole(['superadmin','hospital_admin','fleet_admin']), [param('id').isInt()], validate, ctrl.remove);
router.get('/', authenticate, requireRole(['superadmin','hospital_admin','fleet_admin']), ctrl.list);
// assignment endpoints removed (deferred)

module.exports = router;
