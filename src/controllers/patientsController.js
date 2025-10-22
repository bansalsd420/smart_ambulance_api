const db = require('../config/db');
const { randomUUID } = require('crypto');

exports.create = async (req, res, next) => {
  try {
    // server generates unique 6-digit patient_code based on auto-increment id
    const { name, age, gender, contact, bio, treatment, hospital_id, fleet_id } = req.body;
    // insert with a temporary unique code to satisfy NOT NULL/UNIQUE constraints if present
    const tmp = `TMP-${randomUUID().slice(0,8)}`
    const [r] = await db.execute(
      'INSERT INTO patients (patient_code, name, age, gender, contact, medical_history, created_at) VALUES (?,?,?,?,?,?,NOW())',
      [tmp, name || null, age || null, gender || null, contact ? JSON.stringify(contact) : null, null]
    );
    // derive code from id
    let code = String(r.insertId).padStart(6, '0');
    try {
      await db.execute('UPDATE patients SET patient_code=? WHERE id=?', [code, r.insertId]);
    } catch (e) {
      // if duplicate (very unlikely), append a short suffix and retry a few times
      if (e && (e.code === 'ER_DUP_ENTRY' || e.errno === 1062)) {
        let attempts = 0;
        let success = false;
        while (attempts < 5 && !success) {
          const suffix = randomUUID().slice(0,4).toUpperCase();
          const alt = `${code}-${suffix}`;
          try {
            await db.execute('UPDATE patients SET patient_code=? WHERE id=?', [alt, r.insertId]);
            code = alt; success = true; break;
          } catch (err2) {
            attempts++;
            if (!(err2 && (err2.code === 'ER_DUP_ENTRY' || err2.errno === 1062))) throw err2;
          }
        }
        if (!success) throw e;
      } else throw e;
    }
    // update JSON fields and optional associations
    await db.execute('UPDATE patients SET contact=?, bio=?, treatment=?, hospital_id=?, fleet_id=? WHERE id=?', [
      contact ? JSON.stringify(contact) : null,
      bio ? JSON.stringify(bio) : null,
      treatment ? JSON.stringify(treatment) : null,
      hospital_id || null,
      fleet_id || null,
      r.insertId
    ]);
    const [rows] = await db.execute('SELECT * FROM patients WHERE id=?', [r.insertId]);
    const p = rows[0];
    // parse JSON fields for response
    if (p.contact && typeof p.contact === 'string') p.contact = JSON.parse(p.contact);
    if (p.bio && typeof p.bio === 'string') p.bio = JSON.parse(p.bio);
    if (p.treatment && typeof p.treatment === 'string') p.treatment = JSON.parse(p.treatment);
    res.status(201).json(p);
  } catch (e) {
    if (e && (e.code === 'ER_DUP_ENTRY' || e.errno === 1062 || (e.sqlState && e.sqlState === '23000'))) {
      return res.status(409).json({ error: 'Patient code already exists' });
    }
    next(e);
  }
};

exports.getByCode = async (req, res, next) => {
  try {
    const [rows] = await db.execute('SELECT * FROM patients WHERE patient_code=?', [req.params.patient_code]);
    if (!rows[0]) return res.status(404).json({ error: 'Not Found' });
    const p = rows[0];
    if (p.contact && typeof p.contact === 'string') {
      try { p.contact = JSON.parse(p.contact) } catch { /* leave as string */ }
    }
    if (p.bio && typeof p.bio === 'string') p.bio = JSON.parse(p.bio);
    if (p.treatment && typeof p.treatment === 'string') p.treatment = JSON.parse(p.treatment);
    res.json(p);
  } catch (e) { next(e); }
};

exports.get = async (req, res, next) => {
  try {
    const [rows] = await db.execute('SELECT * FROM patients WHERE id=?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not Found' });
    const p = rows[0];
    if (p.contact && typeof p.contact === 'string') {
      try { p.contact = JSON.parse(p.contact) } catch { /* leave as string */ }
    }
    if (p.bio && typeof p.bio === 'string') p.bio = JSON.parse(p.bio);
    if (p.treatment && typeof p.treatment === 'string') p.treatment = JSON.parse(p.treatment);
    res.json(p);
  } catch (e) { next(e); }
};

exports.list = async (req, res, next) => {
  try {
    // support optional q param for searching
    const q = (req.query.q || '').trim();
    if (q) {
      const like = `%${q}%`;
      const [rows] = await db.execute('SELECT * FROM patients WHERE name LIKE ? OR patient_code LIKE ? OR contact LIKE ? ORDER BY id DESC', [like, like, like]);
      // parse JSON fields
      rows.forEach(p => {
        if (p.contact && typeof p.contact === 'string') {
          try { p.contact = JSON.parse(p.contact) } catch { /* leave as string */ }
        }
        if (p.bio && typeof p.bio === 'string') p.bio = JSON.parse(p.bio);
        if (p.treatment && typeof p.treatment === 'string') p.treatment = JSON.parse(p.treatment);
      })
      return res.json(rows);
    }
    const [rows] = await db.query('SELECT * FROM patients ORDER BY id DESC');
    rows.forEach(p => {
      if (p.contact && typeof p.contact === 'string') {
        try { p.contact = JSON.parse(p.contact) } catch { /* leave as string */ }
      }
      if (p.bio && typeof p.bio === 'string') p.bio = JSON.parse(p.bio);
      if (p.treatment && typeof p.treatment === 'string') p.treatment = JSON.parse(p.treatment);
    })
    res.json(rows);
  } catch (e) { next(e); }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
  const { name, contact, bio, hospital_id, fleet_id, status, age, gender } = req.body;
    // merge age/gender into bio if provided
    let bioObj = bio || null;
    if ((age !== undefined || gender !== undefined)) {
      bioObj = bioObj || {};
      if (age !== undefined) bioObj.age = age;
      if (gender !== undefined) bioObj.gender = gender;
    }
    await db.execute('UPDATE patients SET name=?, contact=?, bio=?, hospital_id=?, fleet_id=?, status=?, age=?, gender=? WHERE id=?', [
      name || null,
      contact ? JSON.stringify(contact) : null,
      bioObj ? JSON.stringify(bioObj) : null,
      hospital_id || null,
      fleet_id || null,
      status || null,
      age || null,
      gender || null,
      id,
    ]);
    const [rows] = await db.execute('SELECT * FROM patients WHERE id=?', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not Found' });
    const p = rows[0];
    if (p.contact && typeof p.contact === 'string') p.contact = JSON.parse(p.contact);
    if (p.bio && typeof p.bio === 'string') p.bio = JSON.parse(p.bio);
    if (p.treatment && typeof p.treatment === 'string') p.treatment = JSON.parse(p.treatment);
    res.json(p);
  } catch (e) { next(e); }
};

exports.remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.execute('DELETE FROM patients WHERE id=?', [id]);
    res.status(204).send();
  } catch (e) { next(e); }
};
