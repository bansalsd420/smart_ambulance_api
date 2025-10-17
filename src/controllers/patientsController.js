const db = require('../config/db');

exports.create = async (req, res, next) => {
  try {
    const { patient_code, name, age, gender, contact, medical_history } = req.body;
    const [r] = await db.execute(
      'INSERT INTO patients (patient_code, name, age, gender, contact, medical_history) VALUES (?,?,?,?,?,?)',
      [patient_code, name || null, age || null, gender || null, contact ? JSON.stringify(contact) : null, medical_history ? JSON.stringify(medical_history) : null]
    );
    const [rows] = await db.execute('SELECT * FROM patients WHERE id=?', [r.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
};

exports.getByCode = async (req, res, next) => {
  try { const [rows] = await db.execute('SELECT * FROM patients WHERE patient_code=?', [req.params.patient_code]); if (!rows[0]) return res.status(404).json({ error: 'Not Found' }); res.json(rows[0]); } catch (e) { next(e); }
};

exports.get = async (req, res, next) => {
  try { const [rows] = await db.execute('SELECT * FROM patients WHERE id=?', [req.params.id]); if (!rows[0]) return res.status(404).json({ error: 'Not Found' }); res.json(rows[0]); } catch (e) { next(e); }
};

exports.list = async (_req, res, next) => {
  try { const [rows] = await db.query('SELECT * FROM patients ORDER BY id DESC'); res.json(rows); } catch (e) { next(e); }
};
