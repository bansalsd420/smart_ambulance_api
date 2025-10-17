const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/auditController');

router.get('/audit-logs', authenticate, requireRole(['superadmin']), ctrl.list);
router.post('/audit-logs', authenticate, requireRole(['superadmin']), ctrl.create);

module.exports = router;
