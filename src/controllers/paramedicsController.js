const db = require('../config/db');

exports.create = async (req, res, next) => {
  try {
    const { user_id, code, qualifications, profile } = req.body;
    const [r] = await db.execute(
      'INSERT INTO paramedics (user_id, code, qualifications, profile) VALUES (?,?,?,?)',
      [user_id, code || null, qualifications ? JSON.stringify(qualifications) : null, profile ? JSON.stringify(profile) : null]
    );
    const [rows] = await db.execute('SELECT * FROM paramedics WHERE id=?', [r.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e && e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Duplicate' });
    next(e);
  }
};

exports.get = async (req, res, next) => {
  try { const [rows] = await db.execute('SELECT * FROM paramedics WHERE id=?', [req.params.id]); if (!rows[0]) return res.status(404).json({ error: 'Not Found' }); res.json(rows[0]); } catch (e) { next(e); }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { code, qualifications, profile } = req.body;
    await db.execute('UPDATE paramedics SET code=?, qualifications=?, profile=? WHERE id=?', [
      code || null,
      qualifications ? JSON.stringify(qualifications) : null,
      profile ? JSON.stringify(profile) : null,
      id,
    ]);
    const [rows] = await db.execute('SELECT * FROM paramedics WHERE id=?', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not Found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
};

exports.list = async (req, res, next) => {
  try {
    const { hospital_id, fleet_id } = req.query;
    // Join through users to filter by hospital/fleet
    const cond = [];
    const params = [];
    if (hospital_id) { cond.push('u.hospital_id = ?'); params.push(hospital_id); }
    if (fleet_id) { cond.push('u.fleet_id = ?'); params.push(fleet_id); }
    const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
    const [rows] = await db.query(`SELECT p.*, u.hospital_id, u.fleet_id FROM paramedics p JOIN users u ON u.id = p.user_id ${where} ORDER BY p.id DESC`, params);
    res.json(rows);
  } catch (e) { next(e); }
};
