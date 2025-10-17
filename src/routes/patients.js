const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/patientsController');

router.post('/', authenticate, requireRole(['superadmin','hospital_admin','fleet_admin','paramedic','doctor']), [body('patient_code').isString().notEmpty()], validate, ctrl.create);
router.get('/by-code/:patient_code', authenticate, requireRole(['superadmin','hospital_admin','fleet_admin','paramedic','doctor']), [param('patient_code').isString()], validate, ctrl.getByCode);
router.get('/:id', authenticate, requireRole(['superadmin','hospital_admin','fleet_admin','paramedic','doctor']), [param('id').isInt()], validate, ctrl.get);
router.get('/', authenticate, requireRole(['superadmin','hospital_admin','fleet_admin']), ctrl.list);

module.exports = router;
