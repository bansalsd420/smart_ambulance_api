const db = require('../config/db');

async function getAmbulanceById(id) {
  const [rows] = await db.execute('SELECT * FROM ambulances WHERE id=?', [id]);
  return rows[0] || null;
}

async function getCurrentActiveOnboarding(ambulance_id) {
  const [rows] = await db.execute(
    "SELECT * FROM onboardings WHERE ambulance_id=? AND status IN ('requested','approved','in_transit') ORDER BY id DESC LIMIT 1",
    [ambulance_id]
  );
  return rows[0] || null;
}

// Restrict ambulance access for non-superadmin users to owner or connected hospital rules
async function canAccessAmbulance(req, ambulance) {
  const user = req.user;
  if (!user) return false;
  if (user.role === 'superadmin') return true;
  if (user.role === 'fleet_admin') {
    return ambulance.owner_type === 'fleet' && Number(ambulance.owner_id) === Number(user.fleet_id);
  }
  if (user.role === 'hospital_admin' || user.role === 'hospital_user' || user.role === 'doctor' || user.role === 'paramedic') {
    if (ambulance.owner_type === 'hospital' && Number(ambulance.owner_id) === Number(user.hospital_id)) return true;
    // If ambulance is fleet-owned, check connection
    const [rows] = await db.execute(
      'SELECT 1 FROM ambulance_connections WHERE ambulance_id=? AND hospital_id=? AND status="connected" LIMIT 1',
      [ambulance.id, user.hospital_id]
    );
    if (!rows[0]) return false;
    // If there is an active onboarding locked to a different hospital, deny
    const active = await getCurrentActiveOnboarding(ambulance.id);
    if (!active) return true;
    if (!active.selected_hospital_id) return true; // not locked
    return Number(active.selected_hospital_id) === Number(user.hospital_id);
  }
  return false;
}

function ensureAmbulanceAccess() {
  return async (req, res, next) => {
    try {
      const id = Number(req.params.ambulanceId || req.params.id || req.body.ambulance_id);
      if (!id) return res.status(400).json({ error: 'ambulance id required' });
      const amb = await getAmbulanceById(id);
      if (!amb) return res.status(404).json({ error: 'Ambulance not found' });
      const ok = await canAccessAmbulance(req, amb);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
      req.ambulance = amb;
      next();
    } catch (e) { next(e); }
  };
}

module.exports = { ensureAmbulanceAccess, getAmbulanceById, getCurrentActiveOnboarding };
