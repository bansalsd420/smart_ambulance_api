const db = require('../config/db');
const { logAudit } = require('../utils/audit');

exports.list = async (_req, res, next) => {
  try { const [rows] = await db.query('SELECT * FROM fleets ORDER BY id DESC'); res.json(rows); } catch (e) { next(e); }
};
exports.get = async (req, res, next) => {
  try { const [rows] = await db.execute('SELECT * FROM fleets WHERE id=?', [req.params.id]); if (!rows[0]) return res.status(404).json({ error: 'Not Found' }); res.json(rows[0]); } catch (e) { next(e); }
};
exports.create = async (req, res, next) => {
  try {
    const { name, contact_phone } = req.body;
    const created_by = req.user?.id || null;
    const [r] = await db.execute('INSERT INTO fleets (name, contact_phone, created_by) VALUES (?,?,?)', [name, contact_phone || null, created_by]);
    await logAudit({ user_id: created_by, action: 'create', resource_type: 'fleet', resource_id: r.insertId, meta: { name } });
    const [rows] = await db.execute('SELECT * FROM fleets WHERE id=?', [r.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
};
exports.update = async (req, res, next) => {
  try { const { id } = req.params; const { name, contact_phone } = req.body; await db.execute('UPDATE fleets SET name=?, contact_phone=? WHERE id=?', [name, contact_phone || null, id]); const [rows] = await db.execute('SELECT * FROM fleets WHERE id=?', [id]); if (!rows[0]) return res.status(404).json({ error: 'Not Found' }); res.json(rows[0]); } catch (e) { next(e); }
};
exports.remove = async (req, res, next) => {
  try { const { id } = req.params; await db.execute('DELETE FROM fleets WHERE id=?', [id]); await logAudit({ user_id: req.user?.id || null, action: 'delete', resource_type: 'fleet', resource_id: Number(id) }); res.status(204).send(); } catch (e) { next(e); }
};
