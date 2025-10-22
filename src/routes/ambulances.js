const router = require('express').Router();
const { body, param } = require('express-validator');
const { authenticate, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/ambulancesController');

router.post(
  '/',
  authenticate,
  requireRole(['superadmin','hospital_admin','fleet_admin']),
  [
    body('owner_type').isIn(['hospital','fleet']),
    body('owner_id').isInt(),
    body('status').optional().isIn(['pending_approval','active','suspended','disabled']),
  ],
  validate,
  ctrl.create
);

router.get('/', authenticate, requireRole(['superadmin','hospital_admin','hospital_user','fleet_admin']), ctrl.list);
router.get('/:id', authenticate, requireRole(['superadmin','hospital_admin','hospital_user','fleet_admin']), ctrl.get);
router.put('/:id', authenticate, requireRole(['superadmin','hospital_admin','fleet_admin']), [
  param('id').isInt(),
  body('name').optional().isString(),
  body('status').optional().isIn(['pending_approval','active','suspended','disabled']),
  body('device_ids').optional().isArray(),
  body('metadata').optional().isObject(),
], validate, ctrl.update);
router.post('/:id/change-owner', authenticate, requireRole(['superadmin','hospital_admin','fleet_admin']), [
  param('id').isInt(),
  body('owner_type').isIn(['hospital','fleet']),
  body('owner_id').isInt(),
], validate, ctrl.changeOwner);
// clear all active assignments for an ambulance
router.delete('/:id/assignments', authenticate, requireRole(['superadmin','hospital_admin','fleet_admin']), [param('id').isInt()], validate, ctrl.clearAssignments);
router.delete('/:id', authenticate, requireRole(['superadmin']), [param('id').isInt()], validate, ctrl.remove);

module.exports = router;
