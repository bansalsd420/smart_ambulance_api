const db = require('../config/db');
const { getAmbulanceById, getCurrentActiveOnboarding } = require('../middleware/ownership');
const { logAudit } = require('../utils/audit');
const { randomUUID } = require('crypto');

async function ensurePatient(input) {
  if (Number.isInteger(input.patient_id)) return input.patient_id;
  // Create a patient with generated code if not provided
  const patient = input.patient || input;
  const code = patient.patient_code || `P-${randomUUID().slice(0, 8).toUpperCase()}`;
  const [r] = await db.execute(
    'INSERT INTO patients (patient_code, name, age, gender, contact, medical_history) VALUES (?,?,?,?,?,?)',
    [code, patient.name || null, patient.age || null, patient.gender || null, patient.contact ? JSON.stringify(patient.contact) : null, patient.medical_history ? JSON.stringify(patient.medical_history) : null]
  );
  return r.insertId;
}

exports.create = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
  const { ambulance_id, patient, patient_id, initiated_by, selected_hospital_id, initial_vitals, notes } = req.body;
    const amb = await getAmbulanceById(ambulance_id);
    if (!amb) return res.status(404).json({ error: 'Ambulance not found' });
    await conn.beginTransaction();
  const new_patient_id = await ensurePatient({ patient, patient_id });
    const status = amb.owner_type === 'fleet' ? 'requested' : 'approved';
    const [r] = await conn.execute(
  'INSERT INTO onboardings (ambulance_id, patient_id, initiated_by, selected_hospital_id, status, notes, audit) VALUES (?,?,?,?,?,?,?)',
  [ambulance_id, new_patient_id, initiated_by || req.user?.id || null, selected_hospital_id || null, status, notes || null, initial_vitals ? JSON.stringify({ initial_vitals }) : null]
    );
    await conn.commit();
    await logAudit({ user_id: req.user?.id || null, action: 'onboarding_create', resource_type: 'onboarding', resource_id: r.insertId, meta: { ambulance_id } });
    const [rows] = await db.execute('SELECT * FROM onboardings WHERE id=?', [r.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) { await conn.rollback(); next(e); } finally { conn.release(); }
};

exports.get = async (req, res, next) => {
  try { const [rows] = await db.execute('SELECT * FROM onboardings WHERE id=?', [req.params.id]); if (!rows[0]) return res.status(404).json({ error: 'Not Found' }); res.json(rows[0]); } catch (e) { next(e); }
};

exports.approve = async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.execute("UPDATE onboardings SET status='approved' WHERE id=? AND status='requested'", [id]);
    const [rows] = await db.execute('SELECT * FROM onboardings WHERE id=?', [id]);
    res.json(rows[0] || { error: 'Not Found' });
  } catch (e) { next(e); }
};

exports.reject = async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.execute("UPDATE onboardings SET status='rejected' WHERE id=? AND status IN ('requested','approved')", [id]);
    const [rows] = await db.execute('SELECT * FROM onboardings WHERE id=?', [id]);
    res.json(rows[0] || { error: 'Not Found' });
  } catch (e) { next(e); }
};

exports.start = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    const { id } = req.params;
    await conn.beginTransaction();
    const [rows] = await conn.execute('SELECT * FROM onboardings WHERE id=? FOR UPDATE', [id]);
    const ob = rows[0];
    if (!ob) return res.status(404).json({ error: 'Not Found' });
    // Lock ambulance usage by setting status 'in_transit'
    await conn.execute("UPDATE onboardings SET status='in_transit', start_time=NOW() WHERE id=? AND status IN ('approved')", [id]);
    await conn.commit();
    const [rows2] = await db.execute('SELECT * FROM onboardings WHERE id=?', [id]);
    res.json(rows2[0]);
  } catch (e) { await conn.rollback(); next(e); } finally { conn.release(); }
};

exports.offboard = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    const { id } = req.params;
    await conn.beginTransaction();
    await conn.execute("UPDATE onboardings SET status='offboarded', end_time=NOW() WHERE id=? AND status IN ('in_transit','approved','requested')", [id]);
    await conn.commit();
    const [rows] = await db.execute('SELECT * FROM onboardings WHERE id=?', [id]);
    res.json(rows[0]);
  } catch (e) { await conn.rollback(); next(e); } finally { conn.release(); }
};

exports.setPrescription = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { prescriptions, updated_by } = req.body;
    const [rows0] = await db.execute('SELECT * FROM onboardings WHERE id=?', [id]);
    if (!rows0[0]) return res.status(404).json({ error: 'Not Found' });
    await db.execute('UPDATE onboardings SET prescription=?, updated_at=NOW() WHERE id=?', [JSON.stringify(prescriptions || {}), id]);
    await logAudit({ user_id: updated_by || req.user?.id || null, action: 'prescription_update', resource_type: 'onboarding', resource_id: Number(id) });
    const [rows] = await db.execute('SELECT id, prescription FROM onboardings WHERE id=?', [id]);
    res.json(rows[0]);
  } catch (e) { next(e); }
};

exports.getPrescription = async (req, res, next) => {
  try { const [rows] = await db.execute('SELECT id, prescription FROM onboardings WHERE id=?', [req.params.id]); if (!rows[0]) return res.status(404).json({ error: 'Not Found' }); res.json(rows[0]); } catch (e) { next(e); }
};
