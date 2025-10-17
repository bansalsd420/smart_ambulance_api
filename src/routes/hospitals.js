const router = require('express').Router();
const { body, param } = require('express-validator');
const { authenticate, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/hospitalsController');

router.get('/', authenticate, requireRole(['superadmin','hospital_admin','hospital_user']), ctrl.list);
router.get('/:id', authenticate, requireRole(['superadmin','hospital_admin','hospital_user']), ctrl.get);
router.post('/', authenticate, requireRole(['superadmin','hospital_admin']), [body('name').isString().notEmpty()], validate, ctrl.create);
router.put('/:id', authenticate, requireRole(['superadmin','hospital_admin']), [
	param('id').isInt(),
	body('name').optional().isString(),
	body('address').optional().isString(),
	body('contact_phone').optional().isString(),
], validate, ctrl.update);
router.delete('/:id', authenticate, requireRole(['superadmin']), [param('id').isInt()], validate, ctrl.remove);

module.exports = router;
