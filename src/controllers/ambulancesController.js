const db = require('../config/db');
const { logAudit } = require('../utils/audit');

exports.create = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
  const { name, type, plate, owner_type, owner_id, device_ids = null, metadata = null, amb_data = null } = req.body;

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

    // generate unique ambulance code: AMB-<OWNER_INITIALS>-XXXX
    async function getOwnerName() {
      const tbl = owner_type === 'hospital' ? 'hospitals' : 'fleets';
      const [r] = await db.execute(`SELECT name FROM ${tbl} WHERE id=? LIMIT 1`, [owner_id]);
      return r[0] ? (r[0].name || '') : '';
    }

    function initialsFromName(n) {
      if (!n) return 'GEN';
      const parts = String(n).replace(/[^A-Za-z0-9 ]/g,' ').trim().split(/\s+/).filter(Boolean);
      if (parts.length === 0) return 'GEN';
      const letters = parts.map(p => p[0].toUpperCase()).join('');
      return letters.slice(0,3) || letters || 'GEN';
    }

    async function generateUniqueCode(ownerName) {
      const initials = initialsFromName(ownerName);
      for (let i = 0; i < 20; i++) {
        const num = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const candidate = `AMB-${initials}-${num}`;
        const [existing] = await db.execute('SELECT id FROM ambulances WHERE code=? LIMIT 1', [candidate]);
        if (!existing[0]) return candidate;
      }
      // fallback: use timestamp
      return `AMB-${initials}-${Date.now() % 100000}`;
    }

    const ownerName = await getOwnerName();
    const code = await generateUniqueCode(ownerName);

    await conn.beginTransaction();
    // merge provided type/plate into amb_data JSON column
    const dataObj = (amb_data && typeof amb_data === 'object') ? { ...amb_data } : (amb_data ? JSON.parse(String(amb_data)) : {});
    if (type) dataObj.type = type
    if (plate) dataObj.plate = plate

    const [r1] = await conn.execute(
      'INSERT INTO ambulances (code, name, owner_type, owner_id, device_ids, amb_data, metadata) VALUES (?,?,?,?,?,?,?)',
      [code, name || null, owner_type, owner_id, device_ids ? JSON.stringify(device_ids) : null, Object.keys(dataObj).length ? JSON.stringify(dataObj) : null, metadata ? JSON.stringify(metadata) : null]
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
    // expose type/plate from metadata for frontend convenience
    if (rows[0]) {
      try {
        const d = rows[0].amb_data ? JSON.parse(rows[0].amb_data) : {}
        rows[0].type = d?.type ?? null
        rows[0].plate = d?.plate ?? null
      } catch (_) { rows[0].type = null; rows[0].plate = null }
    }
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
    const [rows] = await db.query(`
      SELECT a.*,
        (SELECT COUNT(*) FROM ambulance_doctors ad WHERE ad.ambulance_id = a.id AND ad.removed_at IS NULL) AS doctors_count,
        (SELECT COUNT(*) FROM ambulance_paramedics ap WHERE ap.ambulance_id = a.id AND ap.removed_at IS NULL) AS paramedics_count
      FROM ambulances a ${where} ORDER BY a.id DESC`, params);
    // expose type/plate from amb_data for frontend convenience
    const parsed = rows.map(r => {
      try {
        const d = r.amb_data ? JSON.parse(r.amb_data) : {}
        return { ...r, type: d?.type ?? null, plate: d?.plate ?? null }
      } catch (_) {
        return { ...r, type: null, plate: null }
      }
    })
    res.json(parsed);
  } catch (e) { next(e); }
};

exports.get = async (req, res, next) => {
  try {
    const [rows] = await db.execute(`
      SELECT a.*,
        (SELECT COUNT(*) FROM ambulance_doctors ad WHERE ad.ambulance_id = a.id AND ad.removed_at IS NULL) AS doctors_count,
        (SELECT COUNT(*) FROM ambulance_paramedics ap WHERE ap.ambulance_id = a.id AND ap.removed_at IS NULL) AS paramedics_count
      FROM ambulances a WHERE a.id=?`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not Found' });
    try {
      const d = rows[0].amb_data ? JSON.parse(rows[0].amb_data) : {}
      rows[0].type = d?.type ?? null
      rows[0].plate = d?.plate ?? null
    } catch (_) { rows[0].type = null; rows[0].plate = null }
    res.json(rows[0]);
  } catch (e) { next(e); }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;

    // current user
    const user = req.user || {};

    const [existingRows] = await db.execute('SELECT * FROM ambulances WHERE id=?', [id]);
    if (!existingRows[0]) return res.status(404).json({ error: 'Not Found' });

    const { name, status, type, plate, device_ids, metadata, amb_data } = req.body;

    // merge updates into existing amb_data JSON
    let existingData = {}
    try { existingData = existingRows[0].amb_data ? JSON.parse(existingRows[0].amb_data) : {} } catch(_) { existingData = {} }
    const incomingData = (amb_data && typeof amb_data === 'object') ? { ...amb_data } : (amb_data ? JSON.parse(String(amb_data)) : {})
    if (type) incomingData.type = type
    if (plate) incomingData.plate = plate
    const mergedData = { ...existingData, ...incomingData }

    // allow owner changes but enforce role restrictions
    let newOwnerType = existingRows[0].owner_type
    let newOwnerId = existingRows[0].owner_id
    if (Object.prototype.hasOwnProperty.call(req.body, 'owner_type') || Object.prototype.hasOwnProperty.call(req.body, 'owner_id')) {
      // validate provided owner values
      if (!['hospital','fleet'].includes(req.body.owner_type)) return res.status(422).json({ error: 'owner_type must be hospital or fleet' })
      if (!req.body.owner_id || isNaN(Number(req.body.owner_id))) return res.status(422).json({ error: 'owner_id must be a valid integer' })
      newOwnerType = req.body.owner_type
      newOwnerId = Number(req.body.owner_id)
      // enforce role ownership rules
      if (user.role === 'hospital_admin' && (newOwnerType !== 'hospital' || Number(newOwnerId) !== Number(user.hospital_id))) {
        return res.status(403).json({ error: 'hospital_admin can only set owner to their hospital' })
      }
      if (user.role === 'fleet_admin' && (newOwnerType !== 'fleet' || Number(newOwnerId) !== Number(user.fleet_id))) {
        return res.status(403).json({ error: 'fleet_admin can only set owner to their fleet' })
      }
      // ensure target owner exists
      const ownerTable = newOwnerType === 'hospital' ? 'hospitals' : 'fleets';
      const [ownerRows] = await db.execute(`SELECT id FROM ${ownerTable} WHERE id=? LIMIT 1`, [newOwnerId]);
      if (!ownerRows[0]) return res.status(422).json({ error: 'Provided owner_id does not exist' })
    }

    await db.execute('UPDATE ambulances SET name=?, status=?, device_ids=?, amb_data=?, metadata=?, owner_type=?, owner_id=? WHERE id=?', [
      name ?? existingRows[0].name ?? null,
      status ?? existingRows[0].status ?? 'pending_approval',
      device_ids ? JSON.stringify(device_ids) : existingRows[0].device_ids,
      Object.keys(mergedData).length ? JSON.stringify(mergedData) : existingRows[0].amb_data,
      metadata ? JSON.stringify(metadata) : existingRows[0].metadata,
      newOwnerType,
      newOwnerId,
      id,
    ]);
    const [rows] = await db.execute('SELECT * FROM ambulances WHERE id=?', [id]);
    if (rows[0]) {
      try {
        const d = rows[0].amb_data ? JSON.parse(rows[0].amb_data) : {}
        rows[0].type = d?.type ?? null
        rows[0].plate = d?.plate ?? null
      } catch (_) { rows[0].type = null; rows[0].plate = null }
    }
    res.json(rows[0]);
  } catch (e) { next(e); }
};

// Atomically change owner and clear active assignments for the ambulance
exports.changeOwner = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    const id = req.params.id;
    const { owner_type, owner_id } = req.body;
    const user = req.user || {};
    if (!['hospital','fleet'].includes(owner_type)) return res.status(422).json({ error: 'owner_type must be hospital or fleet' })
    if (!owner_id || isNaN(Number(owner_id))) return res.status(422).json({ error: 'owner_id must be a valid integer' })

    // enforce role ownership rules
    if (user.role === 'hospital_admin' && (owner_type !== 'hospital' || Number(owner_id) !== Number(user.hospital_id))) {
      return res.status(403).json({ error: 'hospital_admin can only set owner to their hospital' })
    }
    if (user.role === 'fleet_admin' && (owner_type !== 'fleet' || Number(owner_id) !== Number(user.fleet_id))) {
      return res.status(403).json({ error: 'fleet_admin can only set owner to their fleet' })
    }

    // ensure ambulance exists
    const [existingRows] = await db.execute('SELECT * FROM ambulances WHERE id=?', [id]);
    if (!existingRows[0]) return res.status(404).json({ error: 'Not Found' });

    // ensure target owner exists
    const ownerTable = owner_type === 'hospital' ? 'hospitals' : 'fleets';
    const [ownerRows] = await db.execute(`SELECT id FROM ${ownerTable} WHERE id=? LIMIT 1`, [owner_id]);
    if (!ownerRows[0]) return res.status(422).json({ error: 'Provided owner_id does not exist' })

    await conn.beginTransaction();
    // update owner
    await conn.execute('UPDATE ambulances SET owner_type=?, owner_id=? WHERE id=?', [owner_type, owner_id, id]);
    // soft-clear assignments
    const [r1] = await conn.execute('UPDATE ambulance_paramedics SET removed_at = NOW() WHERE ambulance_id=? AND removed_at IS NULL', [id]);
    const [r2] = await conn.execute('UPDATE ambulance_doctors SET removed_at = NOW() WHERE ambulance_id=? AND removed_at IS NULL', [id]);
    await conn.commit();

    // log audit entry for owner change and cleared counts
    await logAudit({ user_id: req.user?.id || null, action: 'change_owner_and_clear_assignments', resource_type: 'ambulance', resource_id: Number(id), meta: { owner_type, owner_id, paramedics_cleared: r1.affectedRows || 0, doctors_cleared: r2.affectedRows || 0 } });

    // return updated ambulance (with counts)
    const [rows] = await db.execute(`
      SELECT a.*,
        (SELECT COUNT(*) FROM ambulance_doctors ad WHERE ad.ambulance_id = a.id AND ad.removed_at IS NULL) AS doctors_count,
        (SELECT COUNT(*) FROM ambulance_paramedics ap WHERE ap.ambulance_id = a.id AND ap.removed_at IS NULL) AS paramedics_count
      FROM ambulances a WHERE a.id=?
    `, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not Found' });
    try { const d = rows[0].amb_data ? JSON.parse(rows[0].amb_data) : {}; rows[0].type = d?.type ?? null; rows[0].plate = d?.plate ?? null } catch(_) { rows[0].type = null; rows[0].plate = null }
    res.json({ ambulance: rows[0], cleared: { paramedics: r1.affectedRows || 0, doctors: r2.affectedRows || 0 } });
  } catch (e) {
    try { await conn.rollback() } catch (_) {}
    next(e);
  } finally {
    conn.release();
  }
};

// Soft-clear all active assignments for an ambulance (both paramedics and doctors)
exports.clearAssignments = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    const id = req.params.id;
    const user = req.user || {};
    // ensure ambulance exists
    const [existingRows] = await db.execute('SELECT * FROM ambulances WHERE id=?', [id]);
    if (!existingRows[0]) return res.status(404).json({ error: 'Not Found' });

    await conn.beginTransaction();
    const [r1] = await conn.execute('UPDATE ambulance_paramedics SET removed_at = NOW() WHERE ambulance_id=? AND removed_at IS NULL', [id]);
    const [r2] = await conn.execute('UPDATE ambulance_doctors SET removed_at = NOW() WHERE ambulance_id=? AND removed_at IS NULL', [id]);
    await conn.commit();

    await logAudit({ user_id: req.user?.id || null, action: 'clear_assignments', resource_type: 'ambulance', resource_id: Number(id), meta: { paramedics_cleared: r1.affectedRows || 0, doctors_cleared: r2.affectedRows || 0 } });

    res.json({ cleared: { paramedics: r1.affectedRows || 0, doctors: r2.affectedRows || 0 } });
  } catch (e) {
    try { await conn.rollback() } catch (_) {}
    next(e);
  } finally {
    conn.release();
  }
}

exports.remove = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    const { id } = req.params;
    await conn.beginTransaction();

    const [existing] = await conn.execute('SELECT * FROM ambulances WHERE id=? FOR UPDATE', [id]);
    if (!existing[0]) {
      await conn.rollback();
      return res.status(404).json({ error: 'Not Found' });
    }

    // Mark any related approval record as rejected so history shows the deletion
    const [uResult] = await conn.execute(
      'UPDATE ambulance_approvals SET approval_status=?, approved_by=?, reason=? WHERE ambulance_id=? AND approval_status != ?',
      ['rejected', req.user?.id || null, 'Ambulance deleted', id, 'rejected']
    );

    // Delete the ambulance row
    await conn.execute('DELETE FROM ambulances WHERE id=?', [id]);
    await conn.commit();

    await logAudit({ user_id: req.user?.id || null, action: 'delete', resource_type: 'ambulance', resource_id: Number(id), meta: { approvals_updated: uResult.affectedRows || 0 } });
    res.status(204).send();
  } catch (e) {
    try { await conn.rollback() } catch (_) {}
    next(e);
  } finally {
    conn.release();
  }
};
