const db = require('../config/db');

exports.ingest = async (req, res, next) => {
  try {
    const { ambulance_id, device_id, payload } = req.body;
    const [r] = await db.execute('INSERT INTO device_data (ambulance_id, device_id, payload) VALUES (?,?,?)', [
      ambulance_id,
      device_id || null,
      payload ? JSON.stringify(payload) : null,
    ]);
    const [rows] = await db.execute('SELECT id, received_at FROM device_data WHERE id=?', [r.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
};

exports.listForAmbulance = async (req, res, next) => {
  try {
    const { from, to, limit = 100 } = req.query;
    const params = [req.params.id];
    let where = 'WHERE ambulance_id=?';
    if (from) { where += ' AND received_at >= ?'; params.push(from); }
    if (to) { where += ' AND received_at <= ?'; params.push(to); }
    const [rows] = await db.query(`SELECT * FROM device_data ${where} ORDER BY id DESC LIMIT ?`, [...params, Number(limit)]);
    res.json(rows);
  } catch (e) { next(e); }
};
