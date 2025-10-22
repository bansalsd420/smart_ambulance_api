const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/doctorsController');

router.post('/', authenticate, requireRole(['superadmin','hospital_admin']), [
	body('email').isEmail(),
	body('password').isString().isLength({ min: 6 }),
], validate, ctrl.create);
router.get('/:id', authenticate, requireRole(['superadmin','hospital_admin']), [param('id').isInt()], validate, ctrl.get);
router.put('/:id', authenticate, requireRole(['superadmin','hospital_admin']), [
	param('id').isInt(),
	body('license_no').optional().isString(),
	body('specialization').optional().isString(),
	body('profile').optional().isObject(),
], validate, ctrl.update);
router.get('/', authenticate, requireRole(['superadmin','hospital_admin']), ctrl.list);
router.delete('/:id', authenticate, requireRole(['superadmin','hospital_admin']), [param('id').isInt()], validate, ctrl.remove);

module.exports = router;
