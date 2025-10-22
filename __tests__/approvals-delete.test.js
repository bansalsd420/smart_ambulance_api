const request = require('supertest')
const app = require('../src/app')
const db = require('../src/config/db')
const jwt = require('jsonwebtoken')

function tokenFor(user) {
  return jwt.sign(user, process.env.JWT_SECRET || 'dev_secret')
}

describe('DELETE /ambulances/:id should mark approvals rejected', () => {
  let conn
  beforeAll(async () => {
    // ensure a fresh connection
    conn = db
  })
  afterAll(async () => {
    // close pool
    try { await db.end() } catch (e) {}
  })

  test('deleting an ambulance marks its approval as rejected', async () => {
  // Create ambulance and approval row with a unique code to avoid collisions
  const code = 'TEST-DEL-' + Date.now()
  const [r] = await db.execute("INSERT INTO ambulances (code, owner_type, owner_id, status) VALUES (?, ?, ?, ?)", [code, 'hospital', 1, 'pending_approval'])
    const ambId = r.insertId
    await db.execute("INSERT INTO ambulance_approvals (ambulance_id, approval_status, created_at) VALUES (?, ?, NOW())", [ambId, 'pending'])

  const adminToken = tokenFor({ id: 1, role: 'superadmin' })
  const res = await request(app).delete(`/api/ambulances/${ambId}`).set('Authorization', `Bearer ${adminToken}`).expect(204)

    // Verify approval row is now rejected
    const [rows] = await db.execute('SELECT * FROM ambulance_approvals WHERE ambulance_id=?', [ambId])
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0].approval_status).toBe('rejected')
  })
})
