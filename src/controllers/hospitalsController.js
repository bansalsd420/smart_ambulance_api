const db = require('../config/db');
const { logAudit } = require('../utils/audit');

exports.list = async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM hospitals ORDER BY id DESC');
    res.json(rows);
  } catch (e) { next(e); }
};

exports.get = async (req, res, next) => {
  try {
    const [rows] = await db.execute('SELECT * FROM hospitals WHERE id = ?', [req.params.id]);
    const item = rows[0];
    if (!item) return res.status(404).json({ error: 'Not Found' });
    res.json(item);
  } catch (e) { next(e); }
};

exports.create = async (req, res, next) => {
  try {
    const { name, address, contact_phone } = req.body;
    const created_by = req.user?.id || null;
    const [result] = await db.execute(
      'INSERT INTO hospitals (name, address, contact_phone, created_by) VALUES (?,?,?,?)',
      [name, address || null, contact_phone || null, created_by]
    );
    await logAudit({ user_id: created_by, action: 'create', resource_type: 'hospital', resource_id: result.insertId, meta: { name } });
    const [rows] = await db.execute('SELECT * FROM hospitals WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, address, contact_phone } = req.body;
    await db.execute('UPDATE hospitals SET name=?, address=?, contact_phone=? WHERE id=?', [name, address || null, contact_phone || null, id]);
    await logAudit({ user_id: req.user?.id || null, action: 'update', resource_type: 'hospital', resource_id: Number(id), meta: { name } });
    const [rows] = await db.execute('SELECT * FROM hospitals WHERE id = ?', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not Found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
};

exports.remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.execute('DELETE FROM hospitals WHERE id=?', [id]);
    await logAudit({ user_id: req.user?.id || null, action: 'delete', resource_type: 'hospital', resource_id: Number(id) });
    res.status(204).send();
  } catch (e) { next(e); }
};
