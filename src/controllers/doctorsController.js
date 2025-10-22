const db = require('../config/db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

exports.create = async (req, res, next) => {
  try {
    // Require email/password (route validator enforces this)
    const { email, password, license_no, specialization, profile = {}, department, posting, contact, owner_type, owner_id } = req.body;

    const hash = await bcrypt.hash(password, 10)

    // validate ownership provided explicitly: owner_type + owner_id required
    let hospitalId = null, fleetId = null;
    if (owner_type && owner_id) {
      if (owner_type === 'hospital') hospitalId = owner_id;
      else if (owner_type === 'fleet') fleetId = owner_id;
      else return res.status(422).json({ error: 'owner_type must be "hospital" or "fleet"' });
    } else {
      return res.status(422).json({ error: 'owner_type and owner_id are required; staff must belong to exactly one owner' });
    }

    // create user row with ownership mapped
    let u
    try {
      [u] = await db.execute('INSERT INTO users (email, password_hash, full_name, phone, role, hospital_id, fleet_id) VALUES (?,?,?,?,?,?,?)', [
        email, hash, profile.name || null, contact || null, 'doctor', hospitalId, fleetId
      ])
    } catch (e) {
      if (e && e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email already exists' })
      throw e
    }

    const newUserId = u.insertId

    // insert doctor row with owner columns
    const [r] = await db.execute(
      'INSERT INTO doctors (user_id, license_no, specialization, profile, department, posting, contact, hospital_id, fleet_id) VALUES (?,?,?,?,?,?,?,?,?)',
      [newUserId, license_no || null, specialization || null, profile ? JSON.stringify(profile) : null, department || null, posting || null, contact || null, hospitalId, fleetId]
    )
    const [rows] = await db.query('SELECT d.*, u.email as user_email FROM doctors d JOIN users u ON u.id = d.user_id WHERE d.id=?', [r.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
};

exports.get = async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT d.*, u.email as user_email FROM doctors d JOIN users u ON u.id = d.user_id WHERE d.id=?', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Not Found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { license_no, specialization, profile = {}, department, posting, contact } = req.body;
    // allow updating ownership via owner_type/owner_id
    let sets = [];
    const params = [];
    sets.push('license_no=?'); params.push(license_no || null);
    sets.push('specialization=?'); params.push(specialization || null);
    sets.push('profile=?'); params.push(profile ? JSON.stringify(profile) : null);
    sets.push('department=?'); params.push(department || null);
    sets.push('posting=?'); params.push(posting || null);
    sets.push('contact=?'); params.push(contact || null);

    // ownership handling
    if (Object.prototype.hasOwnProperty.call(req.body, 'owner_type') || Object.prototype.hasOwnProperty.call(req.body, 'owner_id')) {
      const ownerType = req.body.owner_type;
      const ownerId = req.body.owner_id;
      if ((ownerType && !ownerId) || (!ownerType && ownerId)) return res.status(422).json({ error: 'Both owner_type and owner_id are required to update ownership' });
      if (ownerType && ownerId) {
        if (ownerType !== 'hospital' && ownerType !== 'fleet') return res.status(422).json({ error: 'owner_type must be hospital or fleet' });
        if (ownerType === 'hospital') {
          sets.push('hospital_id=?'); params.push(ownerId);
          sets.push('fleet_id=?'); params.push(null);
        } else {
          sets.push('fleet_id=?'); params.push(ownerId);
          sets.push('hospital_id=?'); params.push(null);
        }
        // update linked user as well
        const [existing] = await db.execute('SELECT user_id FROM doctors WHERE id=?', [id]);
        if (existing && existing[0] && existing[0].user_id) {
          const uid = existing[0].user_id;
          if (ownerType === 'hospital') await db.execute('UPDATE users SET hospital_id=?, fleet_id=NULL WHERE id=?', [ownerId, uid]);
          else await db.execute('UPDATE users SET fleet_id=?, hospital_id=NULL WHERE id=?', [ownerId, uid]);
        }
      }
    }

    const sql = `UPDATE doctors SET ${sets.join(', ')} WHERE id=?`;
    params.push(id);
    await db.execute(sql, params);
    const [rows] = await db.execute('SELECT * FROM doctors WHERE id=?', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not Found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
};

exports.remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    // find associated doctor and user
    const [rows] = await db.execute('SELECT * FROM doctors WHERE id=?', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not Found' });
    const userId = rows[0].user_id
    await db.execute('DELETE FROM doctors WHERE id=?', [id]);
    // delete user as well if exists
    if (userId) await db.execute('DELETE FROM users WHERE id=?', [userId]);
    res.status(204).send();
  } catch (e) { next(e); }
}

exports.list = async (req, res, next) => {
  try {
    const { hospital_id, fleet_id, q } = req.query;
    const cond = [];
    const params = [];
    if (hospital_id) { cond.push('u.hospital_id = ?'); params.push(hospital_id); }
    if (fleet_id) { cond.push('u.fleet_id = ?'); params.push(fleet_id); }
    if (q) {
      // search across user full_name, email, license_no
      cond.push('(u.full_name LIKE ? OR u.email LIKE ? OR d.license_no LIKE ? OR d.specialization LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }
    const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
    const [rows] = await db.query(
      `SELECT d.*, u.hospital_id, u.fleet_id, u.email as user_email, u.full_name as name,
        (
          SELECT COUNT(*) FROM ambulance_doctors ad WHERE ad.doctor_id = d.id AND ad.removed_at IS NULL
        ) as assigned_count
       FROM doctors d JOIN users u ON u.id = d.user_id ${where} ORDER BY d.id DESC`,
      params
    );
    res.json(rows);
  } catch (e) { next(e); }
};
