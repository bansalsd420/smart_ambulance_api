const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { ensureAmbulanceAccess } = require('../middleware/ownership');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const deviceCtrl = require('../controllers/deviceDataController');
const db = require('../config/db');

// Ingest telemetry (assumes authenticated device/gateway via overarching auth)
router.post('/device-data', authenticate, requireRole(['superadmin','paramedic','hospital_admin','fleet_admin']), [
  body('ambulance_id').isInt(),
  body('payload').isObject(),
], validate, deviceCtrl.ingest);

router.get('/ambulances/:id/device-data', authenticate, ensureAmbulanceAccess(), [param('id').isInt()], validate, deviceCtrl.listForAmbulance);

// Dashboard: patient + devices + latest telemetry + assignments
router.get('/ambulances/:id/dashboard', authenticate, ensureAmbulanceAccess(), [param('id').isInt()], validate, async (req, res, next) => {
  try {
    const ambulance_id = req.params.id;
    const [[ambulanceRows], [assignRows], [onboardRows], [deviceRows]] = await Promise.all([
      db.execute('SELECT * FROM ambulances WHERE id=?', [ambulance_id]),
      db.execute('SELECT * FROM assignments WHERE ambulance_id=?', [ambulance_id]),
      db.execute("SELECT * FROM onboardings WHERE ambulance_id=? ORDER BY id DESC LIMIT 1", [ambulance_id]),
      db.execute('SELECT * FROM device_data WHERE ambulance_id=? ORDER BY id DESC LIMIT 50', [ambulance_id]),
    ]);
    const ambulance = ambulanceRows[0] || null;
    const assignmentList = assignRows || [];
    const latestOnboarding = onboardRows[0] || null;
    let patient = null;
    if (latestOnboarding) {
      const [p] = await db.execute('SELECT * FROM patients WHERE id=?', [latestOnboarding.patient_id]);
      patient = p[0] || null;
    }
    res.json({ ambulance, assignments: assignmentList, onboarding: latestOnboarding, patient, telemetry: deviceRows });
  } catch (e) { next(e); }
});

module.exports = router;
