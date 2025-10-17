const db = require('../config/db');

async function logAudit({ user_id = null, action, resource_type, resource_id = null, meta = null }) {
  try {
    await db.execute(
      'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, meta) VALUES (?,?,?,?,?)',
      [user_id, action, resource_type, resource_id, meta ? JSON.stringify(meta) : null]
    );
  } catch (e) {
    // Don't crash the request on audit failures; just log.
    // eslint-disable-next-line no-console
    console.warn('Audit log failed:', e.message);
  }
}

module.exports = { logAudit };
