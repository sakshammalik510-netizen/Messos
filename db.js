const { Pool } = require('pg');
const { DATABASE_URL } = require('./config');

const pool = new Pool({ connectionString: DATABASE_URL });

// Simple helper: query('SELECT * FROM users WHERE id = $1', [5])
// The $1, $2 placeholders keep user input out of the SQL text (this blocks SQL injection).
const query = (text, params) => pool.query(text, params);

// Runs several queries as ONE transaction: all succeed or none do.
async function tx(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, tx };
