/* eslint-disable no-console */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../src/config/db');

async function seed() {
  const password = process.env.SEED_SUPERADMIN_PASSWORD || 'admin123';
  const hash = await bcrypt.hash(password, 10);
  const email = process.env.SEED_SUPERADMIN_EMAIL || 'superadmin@example.com';
  const [rows] = await db.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
  if (rows.length === 0) {
    await db.execute(
      `INSERT INTO users (email, password_hash, full_name, role, is_active) VALUES (?,?,?,?,1)`,
      [email, hash, 'Super Admin', 'superadmin']
    );
    console.log('Seeded superadmin:', email);
  } else {
    console.log('Superadmin already exists:', email);
  }
  console.log('Seeding complete');
}

seed()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
