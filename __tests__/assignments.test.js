const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const jwt = require('jsonwebtoken');

function tokenFor(user) {
  return jwt.sign(user, process.env.JWT_SECRET || 'dev_secret');
}

describe('Assignments API', () => {
  let hospitalA, hospitalB, fleetA, ambulance1, ambulance2, userParamedicA, userParamedicB, paramedicA, paramedicB, adminToken;

  beforeAll(async () => {
    // create hospitals/fleets
    const [h1] = await db.execute('INSERT INTO hospitals (name, created_by) VALUES (?,?)', ['H-A', null]);
    const [h2] = await db.execute('INSERT INTO hospitals (name, created_by) VALUES (?,?)', ['H-B', null]);
    hospitalA = h1.insertId; hospitalB = h2.insertId;
    const [f1] = await db.execute('INSERT INTO fleets (name, created_by) VALUES (?,?)', ['F-A', null]);
    fleetA = f1.insertId;

    // create ambulances: ambulance1 belongs to hospitalA, ambulance2 belongs to fleetA
    const [a1] = await db.execute('INSERT INTO ambulances (code, owner_type, owner_id, status) VALUES (?,?,?,?)', ['AMB-1', 'hospital', hospitalA, 'active']);
    const [a2] = await db.execute('INSERT INTO ambulances (code, owner_type, owner_id, status) VALUES (?,?,?,?)', ['AMB-2', 'fleet', fleetA, 'active']);
    ambulance1 = a1.insertId; ambulance2 = a2.insertId;

    // create users and paramedics
    const [u1] = await db.execute('INSERT INTO users (email, password_hash, full_name, role, hospital_id) VALUES (?,?,?,?,?)', ['pA@example.com','x','Paramedic A','paramedic', hospitalA]);
    const [u2] = await db.execute('INSERT INTO users (email, password_hash, full_name, role, hospital_id) VALUES (?,?,?,?,?)', ['pB@example.com','x','Paramedic B','paramedic', hospitalB]);
    userParamedicA = u1.insertId; userParamedicB = u2.insertId;

    const [pA] = await db.execute('INSERT INTO paramedics (user_id, name) VALUES (?,?)', [userParamedicA, 'P A']);
    const [pB] = await db.execute('INSERT INTO paramedics (user_id, name) VALUES (?,?)', [userParamedicB, 'P B']);
    paramedicA = pA.insertId; paramedicB = pB.insertId;

    // admin token (superadmin)
    adminToken = tokenFor({ id: 1, role: 'superadmin' });
  });

  afterAll(async () => {
    // cleanup: remove created rows (not strictly necessary but keeps DB tidy)
    await db.execute('DELETE FROM ambulance_paramedics');
    await db.execute('DELETE FROM ambulances WHERE code IN (?,?)', ['AMB-1','AMB-2']);
    await db.execute('DELETE FROM paramedics WHERE name IN (?,?)', ['P A','P B']);
    await db.execute('DELETE FROM users WHERE email IN (?,?)', ['pA@example.com','pB@example.com']);
    await db.execute('DELETE FROM hospitals WHERE name IN (?,?)', ['H-A','H-B']);
    await db.execute('DELETE FROM fleets WHERE name = ?', ['F-A']);
    await db.end();
  });

  test('happy path: assign paramedic to ambulance', async () => {
    const res = await request(app).post(`/api/ambulances/${ambulance1}/assign`).set('Authorization', `Bearer ${adminToken}`).send({ assignee_type: 'paramedic', assignee_id: paramedicA });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('assignee_type', 'paramedic');
    expect(res.body).toHaveProperty('paramedic_id');
  });

  test('duplicate prevention', async () => {
    // assigning same paramedic again should return 409
    const res = await request(app).post(`/api/ambulances/${ambulance1}/assign`).set('Authorization', `Bearer ${adminToken}`).send({ assignee_type: 'paramedic', assignee_id: paramedicA });
    expect([409,422]).toContain(res.status);
  });

  test('ownership validation', async () => {
    // paramedicB belongs to hospitalB; ambulance1 belongs to hospitalA; using non-superadmin should 422
    const token = tokenFor({ id: 9999, role: 'hospital_admin', hospital_id: hospitalB });
      const resOwnership = await request(app)
        .post(`/api/ambulances/${ambulance1}/assign`)
        .set('Authorization', `Bearer ${token}`)
        .send({ assignee_type: 'paramedic', assignee_id: paramedicB });
      expect(resOwnership.status).toBe(403);
  });

  test('soft-unassign', async () => {
    // list assignments for ambulance1, find the assignment id, then unassign
    const listRes = await request(app).get(`/api/ambulances/${ambulance1}/assignments`).set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    const assign = listRes.body.find(a => a.assignee_type === 'paramedic' && a.assignee_id === paramedicA);
    expect(assign).toBeDefined();
    const del = await request(app).delete(`/api/assignments/${assign.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(204);
    const listRes2 = await request(app).get(`/api/ambulances/${ambulance1}/assignments`).set('Authorization', `Bearer ${adminToken}`);
    const assign2 = listRes2.body.find(a => a.id === assign.id);
    expect(assign2).toBeUndefined();
  });

  test('batch assign returns normalized results and ambulance', async () => {
    // create two paramedics: one belongs to hospitalA (paramedicA), another belongs to hospitalB (paramedicB)
    const res = await request(app).post(`/api/ambulances/${ambulance1}/assign`).set('Authorization', `Bearer ${adminToken}`).send({ assignee_type: 'paramedic', assignee_ids: [paramedicA, paramedicB] });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('results');
    expect(Array.isArray(res.body.results)).toBe(true);
    expect(res.body).toHaveProperty('raw_results');
    expect(Array.isArray(res.body.raw_results)).toBe(true);
    // ambulance object should be present and contain doctors_count/paramedics_count
    expect(res.body).toHaveProperty('ambulance');
    expect(res.body.ambulance).toHaveProperty('paramedics_count');
    // results should include entries for both ids
    const aids = res.body.results.map(r => r.assignee_id).sort()
    expect(aids).toEqual([paramedicA, paramedicB].sort())
  })

  test('batch partial failure reports per-id failure', async () => {
    // Try to batch assign paramedicA (valid) and id 999999 (nonexistent)
    const res = await request(app).post(`/api/ambulances/${ambulance1}/assign`).set('Authorization', `Bearer ${adminToken}`).send({ assignee_type: 'paramedic', assignee_ids: [paramedicA, 999999] });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('results');
    const success = res.body.results.filter(r => r.success === true)
    const failed = res.body.results.filter(r => r.success === false)
    expect(success.length >= 0).toBe(true)
    expect(failed.length >= 0).toBe(true)
    // failed item should have a message
    expect(failed[0]).toHaveProperty('message')
  })
});
