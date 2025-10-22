const db = require('../config/db');
const { logAudit } = require('../utils/audit');

// Assign an assignee (doctor or paramedic) to an ambulance
exports.assign = async (req, res, next) => {
  try {
    const { ambulanceId } = req.params;
    const { assignee_type, assignee_id, assignee_ids } = req.body;
    // fetch ambulance owner info
    const [ambRows] = await db.execute('SELECT owner_type, owner_id FROM ambulances WHERE id=?', [ambulanceId]);
    if (!ambRows[0]) return res.status(404).json({ error: 'Ambulance not found' });
    const ambulance = ambRows[0];

    // allow superadmin to bypass ownership checks
    const requester = req.user || {};
    const isSuper = requester.role === 'superadmin';

    // If an array of assignee_ids is provided, process as batch and return aggregated results (200)
    if (Array.isArray(assignee_ids)) {
      const ids = assignee_ids
      if (!ids.length) return res.status(422).json({ error: 'No assignee id(s) provided' })
      if (!['paramedic','doctor'].includes(assignee_type)) return res.status(422).json({ error: 'Invalid assignee_type' })
      const results = []
      for (const idVal of ids) {
        const aid = Number(idVal)
        try {
          if (!isSuper) {
            if (assignee_type === 'paramedic') {
              const [rows] = await db.execute('SELECT p.id, u.hospital_id, u.fleet_id FROM paramedics p JOIN users u ON u.id = p.user_id WHERE p.id=?', [aid]);
              if (!rows[0]) { results.push({ id: aid, ok: false, error: 'Paramedic not found' }); continue }
              const u = rows[0];
              if (ambulance.owner_type === 'hospital' && (u.hospital_id === null || Number(u.hospital_id) !== Number(ambulance.owner_id))) { results.push({ id: aid, ok: false, error: 'Paramedic does not belong to this hospital' }); continue }
              if (ambulance.owner_type === 'fleet' && (u.fleet_id === null || Number(u.fleet_id) !== Number(ambulance.owner_id))) { results.push({ id: aid, ok: false, error: 'Paramedic does not belong to this fleet' }); continue }
            } else if (assignee_type === 'doctor') {
              const [rows] = await db.execute('SELECT d.id, u.hospital_id, u.fleet_id FROM doctors d JOIN users u ON u.id = d.user_id WHERE d.id=?', [aid]);
              if (!rows[0]) { results.push({ id: aid, ok: false, error: 'Doctor not found' }); continue }
              const u = rows[0];
              if (ambulance.owner_type === 'hospital' && (u.hospital_id === null || Number(u.hospital_id) !== Number(ambulance.owner_id))) { results.push({ id: aid, ok: false, error: 'Doctor does not belong to this hospital' }); continue }
              if (ambulance.owner_type === 'fleet' && (u.fleet_id === null || Number(u.fleet_id) !== Number(ambulance.owner_id))) { results.push({ id: aid, ok: false, error: 'Doctor does not belong to this fleet' }); continue }
            }
          }
            if (assignee_type === 'paramedic') {
            const [existing] = await db.execute('SELECT id FROM ambulance_paramedics WHERE ambulance_id=? AND paramedic_id=? AND removed_at IS NULL', [ambulanceId, aid]);
            if (existing && existing.length) { results.push({ id: aid, ok: false, error: 'Paramedic already assigned' }); continue }
            const [r] = await db.execute('INSERT INTO ambulance_paramedics (ambulance_id, paramedic_id, assigned_by) VALUES (?,?,?)', [ambulanceId, aid, req.user?.id || null]);
            await logAudit({ user_id: req.user?.id || null, action: 'assign_paramedic', resource_type: 'ambulance', resource_id: Number(ambulanceId), meta: { paramedic_id: aid } });
            const [rows] = await db.execute('SELECT ap.*, p.paramedic_code, p.name as paramedic_name, u.email as user_email FROM ambulance_paramedics ap JOIN paramedics p ON p.id = ap.paramedic_id LEFT JOIN users u ON u.id = p.user_id WHERE ap.id=?', [r.insertId]);
            // push the raw result (legacy) and a normalized result for clients
            results.push({ id: aid, ok: true, row: { ...rows[0], assignee_type: 'paramedic' } })
            continue
          } else if (assignee_type === 'doctor') {
            const [existing] = await db.execute('SELECT id FROM ambulance_doctors WHERE ambulance_id=? AND doctor_id=? AND removed_at IS NULL', [ambulanceId, aid]);
            if (existing && existing.length) { results.push({ id: aid, ok: false, error: 'Doctor already assigned' }); continue }
            const [r] = await db.execute('INSERT INTO ambulance_doctors (ambulance_id, doctor_id, assigned_by) VALUES (?,?,?)', [ambulanceId, aid, req.user?.id || null]);
            await logAudit({ user_id: req.user?.id || null, action: 'assign_doctor', resource_type: 'ambulance', resource_id: Number(ambulanceId), meta: { doctor_id: aid } });
            const [rows] = await db.execute('SELECT ad.*, d.license_no, d.specialization, u.email as user_email FROM ambulance_doctors ad JOIN doctors d ON d.id = ad.doctor_id LEFT JOIN users u ON u.id = d.user_id WHERE ad.id=?', [r.insertId]);
            // push the raw result (legacy) and a normalized result for clients
            results.push({ id: aid, ok: true, row: { ...rows[0], assignee_type: 'doctor' } })
            continue
          }
        } catch (err) {
          results.push({ id: aid, ok: false, error: String(err.message || err) })
        }
      }
      // Normalize results for clients while keeping the legacy raw entries available
      const normalized = results.map(r => {
        // legacy entries use id/ok/error/row
        const assignee_id = r.assignee_id ?? r.id ?? r.row?.assignee_id
        const success = (typeof r.success !== 'undefined') ? r.success : (typeof r.ok !== 'undefined' ? r.ok : false)
        const message = r.message ?? r.error ?? (success ? 'Assigned' : 'Failed')
        const assignment = r.row ?? null
        return { assignee_id, success, message, assignment }
      })
      // Fetch the updated ambulance row (with counts) to return to the client for immediate UI update
      let updatedAmbulance = null
      try {
        const [ambRows] = await db.execute(`
          SELECT a.*,
            (SELECT COUNT(*) FROM ambulance_doctors ad WHERE ad.ambulance_id = a.id AND ad.removed_at IS NULL) AS doctors_count,
            (SELECT COUNT(*) FROM ambulance_paramedics ap WHERE ap.ambulance_id = a.id AND ap.removed_at IS NULL) AS paramedics_count
          FROM ambulances a WHERE a.id = ?
        `, [ambulanceId])
        if (ambRows && ambRows[0]) updatedAmbulance = ambRows[0]
      } catch (e) { /* ignore fetch errors - we still return results */ }
      return res.status(200).json({ results: normalized, raw_results: results, ambulance: updatedAmbulance })
    }

    // Single-assignment path (legacy behavior): require assignee_id and return 201/409 as before
    if (!assignee_id) return res.status(422).json({ error: 'No assignee id provided' })
    const aid = Number(assignee_id)
    if (!['paramedic','doctor'].includes(assignee_type)) return res.status(422).json({ error: 'Invalid assignee_type' })

    if (!isSuper) {
      if (assignee_type === 'paramedic') {
        const [rows] = await db.execute('SELECT p.id, u.hospital_id, u.fleet_id FROM paramedics p JOIN users u ON u.id = p.user_id WHERE p.id=?', [aid]);
        if (!rows[0]) return res.status(404).json({ error: 'Paramedic not found' });
        const u = rows[0];
        if (ambulance.owner_type === 'hospital' && (u.hospital_id === null || Number(u.hospital_id) !== Number(ambulance.owner_id))) return res.status(422).json({ error: 'Paramedic does not belong to this hospital' });
        if (ambulance.owner_type === 'fleet' && (u.fleet_id === null || Number(u.fleet_id) !== Number(ambulance.owner_id))) return res.status(422).json({ error: 'Paramedic does not belong to this fleet' });
      } else if (assignee_type === 'doctor') {
        const [rows] = await db.execute('SELECT d.id, u.hospital_id, u.fleet_id FROM doctors d JOIN users u ON u.id = d.user_id WHERE d.id=?', [aid]);
        if (!rows[0]) return res.status(404).json({ error: 'Doctor not found' });
        const u = rows[0];
        if (ambulance.owner_type === 'hospital' && (u.hospital_id === null || Number(u.hospital_id) !== Number(ambulance.owner_id))) return res.status(422).json({ error: 'Doctor does not belong to this hospital' });
        if (ambulance.owner_type === 'fleet' && (u.fleet_id === null || Number(u.fleet_id) !== Number(ambulance.owner_id))) return res.status(422).json({ error: 'Doctor does not belong to this fleet' });
      }
    }

    if (assignee_type === 'paramedic') {
      const [existing] = await db.execute('SELECT id FROM ambulance_paramedics WHERE ambulance_id=? AND paramedic_id=? AND removed_at IS NULL', [ambulanceId, aid]);
      if (existing && existing.length) return res.status(409).json({ error: 'Paramedic already assigned to this ambulance' });
      const [r] = await db.execute('INSERT INTO ambulance_paramedics (ambulance_id, paramedic_id, assigned_by) VALUES (?,?,?)', [ambulanceId, aid, req.user?.id || null]);
      await logAudit({ user_id: req.user?.id || null, action: 'assign_paramedic', resource_type: 'ambulance', resource_id: Number(ambulanceId), meta: { paramedic_id: aid } });
      const [rows] = await db.execute('SELECT ap.*, p.paramedic_code, p.name as paramedic_name, u.email as user_email FROM ambulance_paramedics ap JOIN paramedics p ON p.id = ap.paramedic_id LEFT JOIN users u ON u.id = p.user_id WHERE ap.id=?', [r.insertId]);
      return res.status(201).json({ ...rows[0], assignee_type: 'paramedic' });
    } else if (assignee_type === 'doctor') {
      const [existing] = await db.execute('SELECT id FROM ambulance_doctors WHERE ambulance_id=? AND doctor_id=? AND removed_at IS NULL', [ambulanceId, aid]);
      if (existing && existing.length) return res.status(409).json({ error: 'Doctor already assigned to this ambulance' });
      const [r] = await db.execute('INSERT INTO ambulance_doctors (ambulance_id, doctor_id, assigned_by) VALUES (?,?,?)', [ambulanceId, aid, req.user?.id || null]);
      await logAudit({ user_id: req.user?.id || null, action: 'assign_doctor', resource_type: 'ambulance', resource_id: Number(ambulanceId), meta: { doctor_id: aid } });
      const [rows] = await db.execute('SELECT ad.*, d.license_no, d.specialization, u.email as user_email FROM ambulance_doctors ad JOIN doctors d ON d.id = ad.doctor_id LEFT JOIN users u ON u.id = d.user_id WHERE ad.id=?', [r.insertId]);
      return res.status(201).json({ ...rows[0], assignee_type: 'doctor' });
    }
  } catch (e) { next(e); }
};

// List assignments for an ambulance (combine paramedics and doctors)
exports.listByAmbulance = async (req, res, next) => {
  try {
    const ambulanceId = req.params.ambulanceId;
    const [paramedics] = await db.execute(
      `SELECT ap.id, 'paramedic' as assignee_type, ap.assigned_at, ap.removed_at, ap.assigned_by, ap.metadata, p.id as assignee_id, p.paramedic_code as code, p.name as name, u.email as user_email
       FROM ambulance_paramedics ap
       JOIN paramedics p ON p.id = ap.paramedic_id
       LEFT JOIN users u ON u.id = p.user_id
       WHERE ap.ambulance_id = ? AND ap.removed_at IS NULL`,
      [ambulanceId]
    );
    const [doctors] = await db.execute(
      `SELECT ad.id, 'doctor' as assignee_type, ad.assigned_at, ad.removed_at, ad.assigned_by, ad.metadata, d.id as assignee_id, d.license_no as code, d.specialization as name, u.email as user_email
       FROM ambulance_doctors ad
       JOIN doctors d ON d.id = ad.doctor_id
       LEFT JOIN users u ON u.id = d.user_id
       WHERE ad.ambulance_id = ? AND ad.removed_at IS NULL`,
      [ambulanceId]
    );
    // merge and return
    const rows = [...paramedics, ...doctors].sort((a,b)=> b.id - a.id);
    res.json(rows);
  } catch (e) { next(e); }
};

// Remove assignment by id (try both tables)
exports.remove = async (req, res, next) => {
  try {
    const id = req.params.id;
    // soft-unassign: set removed_at timestamp
    const [r1] = await db.execute('UPDATE ambulance_paramedics SET removed_at = NOW() WHERE id=? AND removed_at IS NULL', [id]);
    if (r1.affectedRows && r1.affectedRows > 0) return res.status(204).send();
    const [r2] = await db.execute('UPDATE ambulance_doctors SET removed_at = NOW() WHERE id=? AND removed_at IS NULL', [id]);
    if (r2.affectedRows && r2.affectedRows > 0) return res.status(204).send();
    return res.status(404).json({ error: 'Not Found' });
  } catch (e) { next(e); }
};
