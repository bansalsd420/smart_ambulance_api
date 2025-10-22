const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/usersController');

router.get('/', authenticate, requireRole(['superadmin','hospital_admin','fleet_admin']), ctrl.list);
router.get('/:id', authenticate, requireRole(['superadmin','hospital_admin','fleet_admin']), ctrl.get);
router.post('/', authenticate, requireRole(['superadmin','hospital_admin','fleet_admin']), [
  body('email').isEmail(),
  body('password').isString().isLength({ min: 6 }),
  body('role').isIn(['superadmin','hospital_admin','hospital_user','fleet_admin','paramedic','doctor']),
  body('hospital_id').optional().isInt(),
  body('fleet_id').optional().isInt(),
], validate, ctrl.create);
router.put('/:id', authenticate, requireRole(['superadmin','hospital_admin','fleet_admin']), [
  param('id').isInt(),
  body('role').optional().isIn(['superadmin','hospital_admin','hospital_user','fleet_admin','paramedic','doctor']),
  body('hospital_id').optional().isInt(),
  body('fleet_id').optional().isInt(),
  body('is_active').optional().isBoolean(),
], validate, ctrl.update);
router.delete('/:id', authenticate, requireRole(['superadmin']), [param('id').isInt()], validate, ctrl.remove);

module.exports = router;
