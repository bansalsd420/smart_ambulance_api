const request = require('supertest');
const app = require('../src/app');
const jwt = require('jsonwebtoken');

function tokenFor(user) {
  return jwt.sign(user, process.env.JWT_SECRET || 'dev_secret');
}

const adminToken = tokenFor({ id: 1, role: 'superadmin' });
const db = require('../src/config/db');

describe('Staff ownership validation', () => {
  let hospitalId, fleetId
  const createdEmails = []
  beforeAll(async () => {
    const [h] = await db.execute('INSERT INTO hospitals (name, created_by) VALUES (?,?)', ['Test-H', null]);
    hospitalId = h.insertId
    const [f] = await db.execute('INSERT INTO fleets (name, created_by) VALUES (?,?)', ['Test-F', null]);
    fleetId = f.insertId
  })
  afterAll(async () => {
    if (createdEmails.length) {
      await db.execute('DELETE FROM users WHERE email IN (?)', [createdEmails]);
    }
    if (hospitalId) await db.execute('DELETE FROM hospitals WHERE id=?', [hospitalId]);
    if (fleetId) await db.execute('DELETE FROM fleets WHERE id=?', [fleetId]);
    await db.end();
  })
  test('create paramedic with valid owner', async () => {
    const email = `p${Date.now()}@example.com`
    const payload = { email, password: 'pass123', name: 'Test P', owner_type: 'hospital', owner_id: hospitalId }
  const res = await request(app).post('/api/paramedics').set('Authorization', `Bearer ${adminToken}`).send(payload)
  createdEmails.push(email)
  expect([201,200]).toContain(res.status)
  })

  test('create paramedic missing owner -> 422', async () => {
    const email = `p${Date.now()}x@example.com`
    const payload = { email, password: 'pass123', name: 'Test P2' }
  const res = await request(app).post('/api/paramedics').set('Authorization', `Bearer ${adminToken}`).send(payload)
  createdEmails.push(email)
  expect(res.status).toBe(422)
  })

  test('create doctor invalid owner_type -> 422', async () => {
    const email = `d${Date.now()}@example.com`
    const payload = { email, password: 'pass123', license_no: 'L-1', specialization: 'Gen', owner_type: 'invalid', owner_id: hospitalId }
  const res = await request(app).post('/api/doctors').set('Authorization', `Bearer ${adminToken}`).send(payload)
  createdEmails.push(email)
  expect(res.status).toBe(422)
  })

  test('update doctor owner requires both fields', async () => {
    // create a doctor first
  const email = `d${Date.now()}x@example.com`
  const payload = { email, password: 'pass123', license_no: 'L-2', specialization: 'Gen', owner_type: 'hospital', owner_id: hospitalId }
  const created = await request(app).post('/api/doctors').set('Authorization', `Bearer ${adminToken}`).send(payload)
  createdEmails.push(email)
    expect([201,200]).toContain(created.status)
    const id = created.body && created.body.id
    if (!id) return
    // attempt to update with only owner_type
    const res = await request(app).put(`/api/doctors/${id}`).set('Authorization', `Bearer ${adminToken}`).send({ owner_type: 'fleet' })
    expect(res.status).toBe(422)
    // now update correctly
  const res2 = await request(app).put(`/api/doctors/${id}`).set('Authorization', `Bearer ${adminToken}`).send({ owner_type: 'fleet', owner_id: fleetId })
  expect([200,204]).toContain(res2.status)
  })
})
