// Runs schema.sql against your database. WARNING: it resets (drops) the MessOS tables.
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/db');

(async () => {
  await pool.query(fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8'));
  console.log('Database tables created.');
  await pool.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
