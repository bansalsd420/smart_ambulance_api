const db = require('../config/db');
const { logAudit } = require('../utils/audit');

exports.create = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    const { code, name, owner_type, owner_id, device_ids = null, metadata = null } = req.body;

    // Validate owner exists and (for non-superadmin) that it matches the creator's org
    const user = req.user || {};
    if (!['hospital', 'fleet'].includes(owner_type)) {
      return res.status(422).json({ errors: [{ msg: 'owner_type must be hospital or fleet', param: 'owner_type', location: 'body' }] });
    }
    if (!owner_id || isNaN(Number(owner_id))) {
      return res.status(422).json({ errors: [{ msg: 'owner_id must be a valid integer', param: 'owner_id', location: 'body' }] });
    }

    // Enforce role-to-ownership rules
    if (user.role === 'hospital_admin') {
      if (owner_type !== 'hospital' || Number(owner_id) !== Number(user.hospital_id)) {
        return res.status(403).json({ error: 'hospital_admin can only create ambulances for their hospital' });
      }
    }
    if (user.role === 'fleet_admin') {
      if (owner_type !== 'fleet' || Number(owner_id) !== Number(user.fleet_id)) {
        return res.status(403).json({ error: 'fleet_admin can only create ambulances for their fleet' });
      }
    }

    // Check referenced owner exists
    const ownerTable = owner_type === 'hospital' ? 'hospitals' : 'fleets';
    const [ownerRows] = await db.execute(`SELECT id FROM ${ownerTable} WHERE id=? LIMIT 1`, [owner_id]);
    if (!ownerRows[0]) {
      return res.status(422).json({ errors: [{ msg: `owner_id does not exist in ${ownerTable}`, param: 'owner_id', location: 'body' }] });
    }

    await conn.beginTransaction();
    const [r1] = await conn.execute(
      'INSERT INTO ambulances (code, name, owner_type, owner_id, device_ids, metadata) VALUES (?,?,?,?,?,?)',
      [code, name || null, owner_type, owner_id, device_ids ? JSON.stringify(device_ids) : null, metadata ? JSON.stringify(metadata) : null]
    );
    const ambulance_id = r1.insertId;
    const requested_by = req.user?.id || null;
    await conn.execute(
      'INSERT INTO ambulance_approvals (ambulance_id, requested_by, approval_status) VALUES (?,?,?)',
      [ambulance_id, requested_by, 'pending']
    );
    await conn.commit();
    await logAudit({ user_id: requested_by, action: 'create', resource_type: 'ambulance', resource_id: ambulance_id, meta: { code } });
    const [rows] = await db.execute('SELECT * FROM ambulances WHERE id=?', [ambulance_id]);
    res.status(201).json(rows[0]);
  } catch (e) {
    await conn.rollback();
    if (e && e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ambulance code already exists' });
    next(e);
  } finally {
    conn.release();
  }
};

exports.list = async (req, res, next) => {
  try {
    const { owner_type, owner_id, status } = req.query;
    const cond = [];
    const params = [];
    if (owner_type) { cond.push('owner_type = ?'); params.push(owner_type); }
    if (owner_id) { cond.push('owner_id = ?'); params.push(owner_id); }
    if (status) { cond.push('status = ?'); params.push(status); }
    const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
    const [rows] = await db.query(`SELECT * FROM ambulances ${where} ORDER BY id DESC`, params);
    res.json(rows);
  } catch (e) { next(e); }
};

exports.get = async (req, res, next) => {
  try { const [rows] = await db.execute('SELECT * FROM ambulances WHERE id=?', [req.params.id]); if (!rows[0]) return res.status(404).json({ error: 'Not Found' }); res.json(rows[0]); } catch (e) { next(e); }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Do not allow changing ownership via update for now
    if (Object.prototype.hasOwnProperty.call(req.body, 'owner_type') || Object.prototype.hasOwnProperty.call(req.body, 'owner_id')) {
      return res.status(422).json({ error: 'Changing ambulance ownership is not allowed via update' });
    }

    const [existingRows] = await db.execute('SELECT * FROM ambulances WHERE id=?', [id]);
    if (!existingRows[0]) return res.status(404).json({ error: 'Not Found' });

    const { name, status, device_ids, metadata } = req.body;

    await db.execute('UPDATE ambulances SET name=?, status=?, device_ids=?, metadata=? WHERE id=?', [
      name ?? existingRows[0].name ?? null,
      status ?? existingRows[0].status ?? 'pending_approval',
      device_ids ? JSON.stringify(device_ids) : existingRows[0].device_ids,
      metadata ? JSON.stringify(metadata) : existingRows[0].metadata,
      id,
    ]);
    const [rows] = await db.execute('SELECT * FROM ambulances WHERE id=?', [id]);
    res.json(rows[0]);
  } catch (e) { next(e); }
};

exports.remove = async (req, res, next) => {
  try { const { id } = req.params; await db.execute('DELETE FROM ambulances WHERE id=?', [id]); await logAudit({ user_id: req.user?.id || null, action: 'delete', resource_type: 'ambulance', resource_id: Number(id) }); res.status(204).send(); } catch (e) { next(e); }
};
