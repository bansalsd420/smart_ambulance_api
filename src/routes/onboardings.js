const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/onboardingsController');

router.post('/', authenticate, requireRole(['superadmin','hospital_admin','fleet_admin','paramedic']), [
  body('ambulance_id').isInt(),
  // either patient (object) or patient_id (int) must be present
  body().custom((value) => {
    const hasPatient = typeof value.patient === 'object' && value.patient !== null;
    const hasPatientId = Number.isInteger(value.patient_id);
    if (!hasPatient && !hasPatientId) {
      throw new Error('Provide patient object or patient_id');
    }
    return true;
  }),
], validate, ctrl.create);

router.get('/:id', authenticate, requireRole(['superadmin','hospital_admin','fleet_admin','paramedic','doctor']), [param('id').isInt()], validate, ctrl.get);
router.post('/:id/approve', authenticate, requireRole(['superadmin','fleet_admin','paramedic']), [param('id').isInt()], validate, ctrl.approve);
router.post('/:id/reject', authenticate, requireRole(['superadmin','fleet_admin','paramedic']), [param('id').isInt()], validate, ctrl.reject);
router.post('/:id/start', authenticate, requireRole(['superadmin','hospital_admin','fleet_admin','paramedic']), [param('id').isInt()], validate, ctrl.start);
router.post('/:id/offboard', authenticate, requireRole(['superadmin','hospital_admin','fleet_admin','paramedic','doctor']), [param('id').isInt()], validate, ctrl.offboard);

router.put('/:id/prescription', authenticate, requireRole(['superadmin','doctor']), [param('id').isInt(), body('prescriptions').isObject()], validate, ctrl.setPrescription);
router.get('/:id/prescription', authenticate, requireRole(['superadmin','doctor','hospital_admin']), [param('id').isInt()], validate, ctrl.getPrescription);

module.exports = router;
