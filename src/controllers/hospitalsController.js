const db = require('../config/db');
const { logAudit } = require('../utils/audit');

exports.list = async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM hospitals ORDER BY id DESC');
    // merge metadata JSON into each row
    const mapped = (rows || []).map(r => {
      const m = r.metadata && typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata || {}
      return { ...r, ...m, metadata: undefined }
    })
    res.json(mapped);
  } catch (e) { next(e); }
};

exports.get = async (req, res, next) => {
  try {
    const [rows] = await db.execute('SELECT * FROM hospitals WHERE id = ?', [req.params.id]);
    const item = rows[0];
    if (!item) return res.status(404).json({ error: 'Not Found' });
    const m = item.metadata && typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata || {}
    res.json({ ...item, ...m, metadata: undefined });
  } catch (e) { next(e); }
};

exports.create = async (req, res, next) => {
  try {
    const { name, address, contact_phone, emergency_services, total_beds, available_beds, status, metadata } = req.body;
    const created_by = req.user?.id || null;
    const metaJson = metadata && typeof metadata === 'object' ? JSON.stringify(metadata) : (metadata || null)
    const [result] = await db.execute(
      'INSERT INTO hospitals (name, address, contact_phone, emergency_services, total_beds, available_beds, status, metadata, created_by) VALUES (?,?,?,?,?,?,?,?,?)',
      [name, address || null, contact_phone || null, emergency_services ? 1 : 0, total_beds || null, available_beds || null, status || 'active', metaJson, created_by]
    );
    await logAudit({ user_id: created_by, action: 'create', resource_type: 'hospital', resource_id: result.insertId, meta: { name } });
    const [rows] = await db.execute('SELECT * FROM hospitals WHERE id = ?', [result.insertId]);
    const item = rows[0];
    const m = item.metadata && typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata || {}
    res.status(201).json({ ...item, ...m, metadata: undefined });
  } catch (e) { next(e); }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, address, contact_phone, emergency_services, total_beds, available_beds, status, metadata } = req.body;
    const metaJson = metadata && typeof metadata === 'object' ? JSON.stringify(metadata) : (metadata || null)
    await db.execute('UPDATE hospitals SET name=?, address=?, contact_phone=?, emergency_services=?, total_beds=?, available_beds=?, status=?, metadata=? WHERE id=?', [
      name || null,
      address || null,
      contact_phone || null,
      emergency_services ? 1 : 0,
      total_beds || null,
      available_beds || null,
      status || 'active',
      metaJson,
      id,
    ]);
    await logAudit({ user_id: req.user?.id || null, action: 'update', resource_type: 'hospital', resource_id: Number(id), meta: { name } });
    const [rows] = await db.execute('SELECT * FROM hospitals WHERE id = ?', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not Found' });
    const item = rows[0];
    const m = item.metadata && typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata || {}
    res.json({ ...item, ...m, metadata: undefined });
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
