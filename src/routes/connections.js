const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { body, param, query } = require('express-validator');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/connectionsController');

router.post('/connection-requests', authenticate, requireRole(['superadmin','hospital_admin']), [
  body('ambulance_code').isString().notEmpty(),
  body('from_hospital_id').isInt(),
], validate, ctrl.requestConnection);

router.get('/connection-requests', authenticate, requireRole(['superadmin','fleet_admin']), [query('to_fleet_id').isInt()], validate, ctrl.listIncoming);

router.post('/connection-requests/:id/approve', authenticate, requireRole(['superadmin','fleet_admin']), [param('id').isInt()], validate, ctrl.approve);
router.post('/connection-requests/:id/reject', authenticate, requireRole(['superadmin','fleet_admin']), [param('id').isInt()], validate, ctrl.reject);

router.get('/ambulance-connections', authenticate, requireRole(['superadmin','hospital_admin']), [query('hospital_id').isInt()], validate, ctrl.listConnections);

module.exports = router;
