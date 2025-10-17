/* eslint-disable no-console */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');

async function run() {
  const dir = path.join(__dirname, '..', 'migrations');
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const full = path.join(dir, file);
    const sql = fs.readFileSync(full, 'utf8');
    console.log('Applying migration:', file);
    // split on ; while keeping statements simple
    const statements = sql
      .split(/;\s*\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      for (const stmt of statements) {
        await conn.query(stmt);
      }
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      console.error('Migration failed at file', file, e.message);
      process.exitCode = 1;
      throw e;
    } finally {
      conn.release();
    }
  }
  console.log('Migrations complete');
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
