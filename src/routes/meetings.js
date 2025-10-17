const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/meetingsController');

router.post('/meetings/token', authenticate, requireRole(['superadmin','doctor','paramedic','hospital_admin','fleet_admin']), [
  body('onboarding_id').isInt(),
  body('user_id').isInt(),
  body('role').isString(),
], validate, ctrl.token);

module.exports = router;
