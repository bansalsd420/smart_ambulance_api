const db = require('../config/db');
const { logAudit } = require('../utils/audit');

exports.assign = async (req, res, next) => {
  try {
    const { ambulanceId } = req.params;
    const { assignee_type, assignee_id } = req.body;
    const [r] = await db.execute('INSERT INTO assignments (ambulance_id, assignee_type, assignee_id, assigned_by) VALUES (?,?,?,?)', [
      ambulanceId,
      assignee_type,
      assignee_id,
      req.user?.id || null,
    ]);
    await logAudit({ user_id: req.user?.id || null, action: 'assign', resource_type: 'ambulance', resource_id: Number(ambulanceId), meta: { assignee_type, assignee_id } });
    const [rows] = await db.execute('SELECT * FROM assignments WHERE id=?', [r.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
};

exports.listByAmbulance = async (req, res, next) => {
  try { const [rows] = await db.execute('SELECT * FROM assignments WHERE ambulance_id=? ORDER BY id DESC', [req.params.ambulanceId]); res.json(rows); } catch (e) { next(e); }
};

exports.remove = async (req, res, next) => {
  try { await db.execute('DELETE FROM assignments WHERE id=?', [req.params.id]); res.status(204).send(); } catch (e) { next(e); }
};
