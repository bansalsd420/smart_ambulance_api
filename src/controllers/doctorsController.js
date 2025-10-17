const db = require('../config/db');

exports.create = async (req, res, next) => {
  try {
    const { user_id, license_no, specialization, profile } = req.body;
    const [r] = await db.execute(
      'INSERT INTO doctors (user_id, license_no, specialization, profile) VALUES (?,?,?,?)',
      [user_id, license_no || null, specialization || null, profile ? JSON.stringify(profile) : null]
    );
    const [rows] = await db.execute('SELECT * FROM doctors WHERE id=?', [r.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
};

exports.get = async (req, res, next) => {
  try { const [rows] = await db.execute('SELECT * FROM doctors WHERE id=?', [req.params.id]); if (!rows[0]) return res.status(404).json({ error: 'Not Found' }); res.json(rows[0]); } catch (e) { next(e); }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { license_no, specialization, profile } = req.body;
    await db.execute('UPDATE doctors SET license_no=?, specialization=?, profile=? WHERE id=?', [
      license_no || null,
      specialization || null,
      profile ? JSON.stringify(profile) : null,
      id,
    ]);
    const [rows] = await db.execute('SELECT * FROM doctors WHERE id=?', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not Found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
};

exports.list = async (req, res, next) => {
  try {
    const { hospital_id, fleet_id } = req.query;
    const cond = [];
    const params = [];
    if (hospital_id) { cond.push('u.hospital_id = ?'); params.push(hospital_id); }
    if (fleet_id) { cond.push('u.fleet_id = ?'); params.push(fleet_id); }
    const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
    const [rows] = await db.query(`SELECT d.*, u.hospital_id, u.fleet_id FROM doctors d JOIN users u ON u.id = d.user_id ${where} ORDER BY d.id DESC`, params);
    res.json(rows);
  } catch (e) { next(e); }
};
