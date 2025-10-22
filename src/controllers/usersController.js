const bcrypt = require('bcryptjs');
const db = require('../config/db');

exports.list = async (req, res, next) => {
  try {
    const { role, hospital_id, fleet_id } = req.query;
    const cond = [];
    const params = [];
    if (role) { cond.push('role = ?'); params.push(role); }
    if (hospital_id) { cond.push('hospital_id = ?'); params.push(hospital_id); }
    if (fleet_id) { cond.push('fleet_id = ?'); params.push(fleet_id); }
    const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
    const [rows] = await db.query(`SELECT id, email, full_name, phone, role, hospital_id, fleet_id, is_active, created_at, updated_at FROM users ${where} ORDER BY id DESC`, params);
    res.json(rows);
  } catch (e) { next(e); }
};

exports.get = async (req, res, next) => {
  try {
    const [rows] = await db.execute('SELECT id, email, full_name, phone, role, hospital_id, fleet_id, is_active, created_at, updated_at FROM users WHERE id=?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not Found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
};

exports.create = async (req, res, next) => {
  try {
    const { email, password, full_name, phone, role, hospital_id = null, fleet_id = null } = req.body;
    // server-side either-or validation for paramedic/doctor
    if (role === 'paramedic' || role === 'doctor') {
      const hasHospital = hospital_id !== null && hospital_id !== '' && !Number.isNaN(Number(hospital_id))
      const hasFleet = fleet_id !== null && fleet_id !== '' && !Number.isNaN(Number(fleet_id))
      if (!hasHospital && !hasFleet) {
        return res.status(422).json({ errors: { hospital_id: 'Provide hospital or fleet', fleet_id: 'Provide hospital or fleet' }, message: 'Paramedic/Doctor must belong to a hospital or a fleet' })
      }
      if (hasHospital && hasFleet) {
        return res.status(422).json({ errors: { hospital_id: 'Provide either hospital or fleet, not both', fleet_id: 'Provide either hospital or fleet, not both' }, message: 'Paramedic/Doctor cannot belong to both a hospital and a fleet' })
      }
    }
    const hash = await bcrypt.hash(password, 10);
    const [r] = await db.execute(
      'INSERT INTO users (email, password_hash, full_name, phone, role, hospital_id, fleet_id) VALUES (?,?,?,?,?,?,?)',
      [email, hash, full_name || null, phone || null, role, hospital_id, fleet_id]
    );
    const [rows] = await db.execute('SELECT id, email, full_name, phone, role, hospital_id, fleet_id, is_active, created_at, updated_at FROM users WHERE id=?', [r.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e && e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email exists' });
    next(e);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { full_name, phone, role, hospital_id = null, fleet_id = null, is_active } = req.body;
    // server-side either-or validation for paramedic/doctor
    if (role === 'paramedic' || role === 'doctor') {
      const hasHospital = hospital_id !== null && hospital_id !== '' && !Number.isNaN(Number(hospital_id))
      const hasFleet = fleet_id !== null && fleet_id !== '' && !Number.isNaN(Number(fleet_id))
      if (!hasHospital && !hasFleet) {
        return res.status(422).json({ errors: { hospital_id: 'Provide hospital or fleet', fleet_id: 'Provide hospital or fleet' }, message: 'Paramedic/Doctor must belong to a hospital or a fleet' })
      }
      if (hasHospital && hasFleet) {
        return res.status(422).json({ errors: { hospital_id: 'Provide either hospital or fleet, not both', fleet_id: 'Provide either hospital or fleet, not both' }, message: 'Paramedic/Doctor cannot belong to both a hospital and a fleet' })
      }
    }
    await db.execute('UPDATE users SET full_name=?, phone=?, role=?, hospital_id=?, fleet_id=?, is_active=? WHERE id=?', [
      full_name || null,
      phone || null,
      role,
      hospital_id,
      fleet_id,
      is_active !== undefined ? (is_active ? 1 : 0) : 1,
      id,
    ]);
    const [rows] = await db.execute('SELECT id, email, full_name, phone, role, hospital_id, fleet_id, is_active, created_at, updated_at FROM users WHERE id=?', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not Found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
};

exports.remove = async (req, res, next) => {
  try { await db.execute('DELETE FROM users WHERE id=?', [req.params.id]); res.status(204).send(); } catch (e) { next(e); }
};
