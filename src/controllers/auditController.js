const db = require('../config/db');

exports.list = async (req, res, next) => {
  try {
    const { resource_type, resource_id } = req.query;
    const cond = [];
    const params = [];
    if (resource_type) { cond.push('resource_type = ?'); params.push(resource_type); }
    if (resource_id) { cond.push('resource_id = ?'); params.push(resource_id); }
    const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
    const [rows] = await db.query(`SELECT * FROM audit_logs ${where} ORDER BY id DESC LIMIT 200`, params);
    res.json(rows);
  } catch (e) { next(e); }
};

exports.create = async (req, res, next) => {
  try {
    const { user_id = null, action, resource_type, resource_id = null, meta = null } = req.body;
    const [r] = await db.execute(
      'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, meta) VALUES (?,?,?,?,?)',
      [user_id, action, resource_type, resource_id, meta ? JSON.stringify(meta) : null]
    );
    const [rows] = await db.execute('SELECT * FROM audit_logs WHERE id=?', [r.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
};
