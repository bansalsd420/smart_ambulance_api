const router = require('express').Router({ mergeParams: true });
const { authenticate, requireRole } = require('../middleware/auth');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const { ensureAmbulanceAccess } = require('../middleware/ownership');
const ctrl = require('../controllers/assignmentsController');

router.post(
  '/ambulances/:ambulanceId/assign',
  authenticate,
  requireRole(['superadmin','hospital_admin','fleet_admin']),
  ensureAmbulanceAccess(),
  [
    body('assignee_type').isIn(['doctor','paramedic']),
    body('assignee_id').optional().isInt(),
    body('assignee_ids').optional().isArray(),
    body('assignee_ids.*').optional().isInt(),
  ],
  validate,
  ctrl.assign
);

router.get('/ambulances/:ambulanceId/assignments', authenticate, ensureAmbulanceAccess(), [param('ambulanceId').isInt()], validate, ctrl.listByAmbulance);

router.delete('/assignments/:id', authenticate, requireRole(['superadmin','hospital_admin','fleet_admin']), [param('id').isInt()], validate, ctrl.remove);

module.exports = router;
