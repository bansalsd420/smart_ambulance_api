const db = require('../config/db');
const { logAudit } = require('../utils/audit');

exports.list = async (req, res, next) => {
  try {
    const { status } = req.query;
    const cond = [];
    const params = [];
    if (status) { cond.push('approval_status = ?'); params.push(status); }
    const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
    const [rows] = await db.query(`SELECT * FROM ambulance_approvals ${where} ORDER BY id DESC`, params);
    res.json(rows);
  } catch (e) { next(e); }
};

exports.get = async (req, res, next) => {
  try { const [rows] = await db.execute('SELECT * FROM ambulance_approvals WHERE id=?', [req.params.id]); if (!rows[0]) return res.status(404).json({ error: 'Not Found' }); res.json(rows[0]); } catch (e) { next(e); }
};

exports.approve = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    const { id } = req.params;
    await conn.beginTransaction();
    const [rows] = await conn.execute('SELECT * FROM ambulance_approvals WHERE id=? FOR UPDATE', [id]);
    const appr = rows[0];
    if (!appr) return res.status(404).json({ error: 'Not Found' });
    if (appr.approval_status === 'approved') return res.json(appr);
    await conn.execute('UPDATE ambulance_approvals SET approval_status=?, approved_by=? WHERE id=?', ['approved', req.user?.id || null, id]);
    await conn.execute('UPDATE ambulances SET status=? WHERE id=?', ['active', appr.ambulance_id]);
    await conn.commit();
    await logAudit({ user_id: req.user?.id || null, action: 'approve', resource_type: 'ambulance', resource_id: appr.ambulance_id, meta: { approval_id: Number(id) } });
    const [rows2] = await db.execute('SELECT * FROM ambulance_approvals WHERE id=?', [id]);
    res.json(rows2[0]);
  } catch (e) { await conn.rollback(); next(e); } finally { conn.release(); }
};

exports.reject = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    await conn.beginTransaction();
    const [rows] = await conn.execute('SELECT * FROM ambulance_approvals WHERE id=? FOR UPDATE', [id]);
    const appr = rows[0];
    if (!appr) return res.status(404).json({ error: 'Not Found' });
    await conn.execute('UPDATE ambulance_approvals SET approval_status=?, approved_by=?, reason=? WHERE id=?', ['rejected', req.user?.id || null, reason || null, id]);
    await conn.execute('UPDATE ambulances SET status=? WHERE id=?', ['disabled', appr.ambulance_id]);
    await conn.commit();
    await logAudit({ user_id: req.user?.id || null, action: 'reject', resource_type: 'ambulance', resource_id: appr.ambulance_id, meta: { approval_id: Number(id), reason } });
    const [rows2] = await db.execute('SELECT * FROM ambulance_approvals WHERE id=?', [id]);
    res.json(rows2[0]);
  } catch (e) { await conn.rollback(); next(e); } finally { conn.release(); }
};
