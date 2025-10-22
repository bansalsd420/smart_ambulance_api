const db = require('../config/db');
const bcrypt = require('bcryptjs');

async function generateParamedicCode(prefix = '') {
  // Simple generator: use timestamp + random to reduce collisions; caller should still handle duplicates
  const n = Math.floor(Math.random() * 900000) + 100000; // 6-digit
  return `${String(n)}`;
}

function parseJsonFields(row) {
  if (!row) return row;
  try { if (row.contact && typeof row.contact === 'string') row.contact = JSON.parse(row.contact); } catch (e) {}
  try { if (row.metadata && typeof row.metadata === 'string') row.metadata = JSON.parse(row.metadata); } catch (e) {}
  try { if (row.qualifications && typeof row.qualifications === 'string') row.qualifications = JSON.parse(row.qualifications); } catch (e) {}
  try { if (row.profile && typeof row.profile === 'string') row.profile = JSON.parse(row.profile); } catch (e) {}
  return row;
}

exports.create = async (req, res, next) => {
  try {
    // Expected body for creating a paramedic:
    // { email, password, name, contact, metadata, posting, department, qualifications, profile, owner_type, owner_id }
    const { email, password, name, contact, metadata, posting, department, qualifications, profile, owner_type, owner_id } = req.body;
    if (!email || !password || !name) return res.status(422).json({ error: 'email, password and name are required' });

    // validate ownership: exactly one of owner_type/owner_id must be provided and owner_type must be 'hospital' or 'fleet'
    let hospitalId = null, fleetId = null;
    if (owner_type && owner_id) {
      if (owner_type === 'hospital') hospitalId = owner_id;
      else if (owner_type === 'fleet') fleetId = owner_id;
      else return res.status(422).json({ error: 'owner_type must be "hospital" or "fleet"' });
    } else {
      return res.status(422).json({ error: 'owner_type and owner_id are required; staff must belong to exactly one owner' });
    }

    // create user (role paramedic)
    const hash = await bcrypt.hash(password, 10)
    // set ownership on user row as well based on provided owner_type/owner_id
    let u;
    try {
      [u] = await db.execute('INSERT INTO users (email, password_hash, full_name, phone, role, hospital_id, fleet_id) VALUES (?,?,?,?,?,?,?)', [
        email, hash, name || null, contact?.phone || null, 'paramedic', hospitalId, fleetId
      ])
    } catch (e) {
      if (e && e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email already exists' })
      throw e
    }
    const newUserId = u.insertId

    // insert paramedic row without code; we'll generate code deterministic from id after insert
    const [r] = await db.execute(
      `INSERT INTO paramedics (user_id, name, contact, metadata, posting, department, hospital_id, fleet_id)
       VALUES (?,?,?,?,?,?,?,?)`,
      [newUserId, name || null, contact ? JSON.stringify(contact) : null, metadata ? JSON.stringify(metadata) : null, posting || null, department || null, hospitalId, fleetId]
    )

  // generate deterministic code from id (LPAD style) in the DB and update
  const pid = r.insertId
  await db.execute("UPDATE paramedics SET paramedic_code = CONCAT('PM-', LPAD(id,6,'0')) WHERE id=?", [pid]);

    const [rows] = await db.query('SELECT p.*, u.email as user_email FROM paramedics p JOIN users u ON u.id = p.user_id WHERE p.id=?', [pid]);
    res.status(201).json(parseJsonFields(rows[0]));
  } catch (e) {
    if (e && e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Duplicate' });
    next(e);
  }
};

exports.get = async (req, res, next) => {
  try {
    const [rows] = await db.execute('SELECT * FROM paramedics WHERE id=?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not Found' });
    res.json(parseJsonFields(rows[0]));
  } catch (e) { next(e); }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
  // Disallow client-side attempts to change the linked user
  if (Object.prototype.hasOwnProperty.call(req.body, 'user_id')) {
    return res.status(422).json({ error: 'Changing user linkage is not allowed' });
  }
  // allow updating ownership as well via owner_type/owner_id
  const allowed = ['name','paramedic_code','contact','metadata','posting','department','owner_type','owner_id'];
    const sets = [];
    const params = [];
    for (const k of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, k)) {
        if (k === 'contact' || k === 'metadata' || k === 'qualifications' || k === 'profile') {
          sets.push(`${k} = ?`);
          params.push(req.body[k] ? JSON.stringify(req.body[k]) : null);
        } else if (k === 'owner_type' || k === 'owner_id') {
          // handled below after building sets
        } else {
          sets.push(`${k} = ?`);
          params.push(req.body[k] || null);
        }
      }
    }
    // handle ownership update if provided
    let ownerType = req.body.owner_type;
    let ownerId = req.body.owner_id;
    if ((ownerType && !ownerId) || (!ownerType && ownerId)) {
      return res.status(422).json({ error: 'Both owner_type and owner_id are required to update ownership' });
    }
    if (ownerType && ownerId) {
      if (ownerType !== 'hospital' && ownerType !== 'fleet') return res.status(422).json({ error: 'owner_type must be hospital or fleet' });
      if (ownerType === 'hospital') {
        sets.push('hospital_id = ?'); params.push(ownerId); sets.push('fleet_id = ?'); params.push(null);
      } else {
        sets.push('fleet_id = ?'); params.push(ownerId); sets.push('hospital_id = ?'); params.push(null);
      }
      // also update the linked users table hospital_id/fleet_id
      const [existing] = await db.execute('SELECT user_id FROM paramedics WHERE id=?', [id]);
      if (existing && existing[0] && existing[0].user_id) {
        const uid = existing[0].user_id;
        if (ownerType === 'hospital') {
          await db.execute('UPDATE users SET hospital_id=?, fleet_id=NULL WHERE id=?', [ownerId, uid]);
        } else {
          await db.execute('UPDATE users SET fleet_id=?, hospital_id=NULL WHERE id=?', [ownerId, uid]);
        }
      }
    }
    if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });
    const sql = `UPDATE paramedics SET ${sets.join(', ')} WHERE id=?`;
    params.push(id);
    await db.execute(sql, params);
    const [rows] = await db.execute('SELECT * FROM paramedics WHERE id=?', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not Found' });
    res.json(parseJsonFields(rows[0]));
  } catch (e) { next(e); }
};

exports.list = async (req, res, next) => {
  try {
    const { hospital_id, fleet_id, q } = req.query;
    // Join through users to filter by hospital/fleet
    const cond = [];
    const params = [];
    if (hospital_id) { cond.push('u.hospital_id = ?'); params.push(hospital_id); }
    if (fleet_id) { cond.push('u.fleet_id = ?'); params.push(fleet_id); }
    if (q) {
      const like = `%${q}%`;
      cond.push('(p.name LIKE ? OR p.paramedic_code LIKE ? OR u.email LIKE ? OR p.metadata LIKE ?)');
      params.push(like, like, like, like);
    }
    const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
    const [rows] = await db.query(
      `SELECT p.*, u.hospital_id, u.fleet_id,
        (
          SELECT COUNT(*) FROM ambulance_paramedics ap WHERE ap.paramedic_id = p.id AND ap.removed_at IS NULL
        ) as assigned_count
       FROM paramedics p JOIN users u ON u.id = p.user_id ${where} ORDER BY p.id DESC`,
      params
    );
    // parse JSON fields for each row
    rows.forEach(r => parseJsonFields(r));
    res.json(rows);
  } catch (e) { next(e); }
};

exports.assignments = async (req, res, next) => {
  try {
    const id = req.params.id;
    const [rows] = await db.execute(
      `SELECT ap.id as assignment_id, a.id as ambulance_id, a.code as ambulance_code, a.status as ambulance_status, a.owner_type, a.owner_id
       FROM ambulance_paramedics ap
       JOIN ambulances a ON a.id = ap.ambulance_id
       WHERE ap.paramedic_id = ? AND ap.removed_at IS NULL`,
      [id]
    );
    res.json(rows);
  } catch (e) { next(e); }
};

exports.remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await db.execute('SELECT * FROM paramedics WHERE id=?', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not Found' });
    const userId = rows[0].user_id;
    await db.execute('DELETE FROM paramedics WHERE id=?', [id]);
    if (userId) await db.execute('DELETE FROM users WHERE id=?', [userId]);
    res.status(204).send();
  } catch (e) { next(e); }
};
 
