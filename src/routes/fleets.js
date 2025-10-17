const router = require('express').Router();
const { body, param } = require('express-validator');
const { authenticate, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/fleetsController');

router.get('/', authenticate, requireRole(['superadmin','fleet_admin']), ctrl.list);
router.get('/:id', authenticate, requireRole(['superadmin','fleet_admin']), ctrl.get);
router.post('/', authenticate, requireRole(['superadmin','fleet_admin']), [body('name').isString().notEmpty()], validate, ctrl.create);
router.put('/:id', authenticate, requireRole(['superadmin','fleet_admin']), [
	param('id').isInt(),
	body('name').optional().isString(),
	body('contact_phone').optional().isString(),
], validate, ctrl.update);
router.delete('/:id', authenticate, requireRole(['superadmin']), [param('id').isInt()], validate, ctrl.remove);

module.exports = router;
