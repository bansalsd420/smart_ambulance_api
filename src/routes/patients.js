const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/patientsController');

router.post('/', authenticate, requireRole(['superadmin','hospital_admin','fleet_admin','paramedic','doctor']), validate, ctrl.create);
router.get('/by-code/:patient_code', authenticate, requireRole(['superadmin','hospital_admin','fleet_admin','paramedic','doctor']), [param('patient_code').isString()], validate, ctrl.getByCode);
router.get('/:id', authenticate, requireRole(['superadmin','hospital_admin','fleet_admin','paramedic','doctor']), [param('id').isInt()], validate, ctrl.get);
router.put('/:id', authenticate, requireRole(['superadmin','hospital_admin','fleet_admin','paramedic','doctor']), [param('id').isInt()], validate, ctrl.update);
router.delete('/:id', authenticate, requireRole(['superadmin','hospital_admin','fleet_admin']), [param('id').isInt()], validate, ctrl.remove);
router.get('/', authenticate, requireRole(['superadmin','hospital_admin','fleet_admin']), ctrl.list);

module.exports = router;
