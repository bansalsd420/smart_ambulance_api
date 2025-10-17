const db = require('../config/db');
const { logAudit } = require('../utils/audit');

exports.requestConnection = async (req, res, next) => {
  try {
    const { ambulance_code, from_hospital_id } = req.body;
    // Find fleet owning this code
    const [amb] = await db.execute('SELECT * FROM ambulances WHERE code=?', [ambulance_code]);
    const ambulance = amb[0];
    if (!ambulance) return res.status(404).json({ error: 'Ambulance code not found' });
    if (ambulance.owner_type !== 'fleet') return res.status(400).json({ error: 'Ambulance is not fleet-owned' });
    const to_fleet_id = ambulance.owner_id;
    const [r] = await db.execute(
      'INSERT INTO connection_requests (ambulance_code, from_hospital_id, to_fleet_id, status, requested_by) VALUES (?,?,?,?,?)',
      [ambulance_code, from_hospital_id, to_fleet_id, 'pending', req.user?.id || null]
    );
    await logAudit({ user_id: req.user?.id || null, action: 'connect_request', resource_type: 'ambulance', resource_id: ambulance.id, meta: { request_id: r.insertId } });
    const [rows] = await db.execute('SELECT * FROM connection_requests WHERE id=?', [r.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
};

exports.listIncoming = async (req, res, next) => {
  try {
    const { to_fleet_id } = req.query;
    const [rows] = await db.execute('SELECT * FROM connection_requests WHERE to_fleet_id=? ORDER BY id DESC', [to_fleet_id]);
    res.json(rows);
  } catch (e) { next(e); }
};

exports.approve = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    const { id } = req.params;
    await conn.beginTransaction();
    const [rows] = await conn.execute('SELECT * FROM connection_requests WHERE id=? FOR UPDATE', [id]);
    const reqRow = rows[0];
    if (!reqRow) return res.status(404).json({ error: 'Not Found' });
    if (reqRow.status !== 'pending') return res.json(reqRow);
    // create ambulance_connections
    const [amb] = await conn.execute('SELECT * FROM ambulances WHERE code=?', [reqRow.ambulance_code]);
    const ambulance = amb[0];
    await conn.execute('INSERT INTO ambulance_connections (ambulance_id, hospital_id, connected_by, status) VALUES (?,?,?,"connected")', [
      ambulance.id,
      reqRow.from_hospital_id,
      req.user?.id || null,
    ]);
    await conn.execute('UPDATE connection_requests SET status="approved", responded_by=? WHERE id=?', [req.user?.id || null, id]);
    await conn.commit();
    await logAudit({ user_id: req.user?.id || null, action: 'connect_approve', resource_type: 'ambulance', resource_id: ambulance.id, meta: { request_id: Number(id) } });
    const [rows2] = await db.execute('SELECT * FROM connection_requests WHERE id=?', [id]);
    res.json(rows2[0]);
  } catch (e) { await conn.rollback(); next(e); } finally { conn.release(); }
};

exports.reject = async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.execute('UPDATE connection_requests SET status="rejected", responded_by=? WHERE id=?', [req.user?.id || null, id]);
    const [rows] = await db.execute('SELECT * FROM connection_requests WHERE id=?', [id]);
    res.json(rows[0]);
  } catch (e) { next(e); }
};

exports.listConnections = async (req, res, next) => {
  try {
    const { hospital_id } = req.query;
    const [rows] = await db.execute('SELECT * FROM ambulance_connections WHERE hospital_id=? AND status="connected" ORDER BY id DESC', [hospital_id]);
    res.json(rows);
  } catch (e) { next(e); }
};
