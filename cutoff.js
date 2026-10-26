// Runs every minute. It keeps the stored "status" column in step with the clock and
// saves the final head-count the moment a slot locks.
// (The routes do NOT depend on this job being on time. They check now() themselves.)
const cron = require('node-cron');
const { query } = require('../db');

async function tick() {
  // 1. OPEN -> LOCKED, and save the head-count in the same statement
  await query(
    `WITH locked AS (
       UPDATE meal_slots SET status = 'LOCKED'
       WHERE status = 'OPEN' AND now() >= cutoff_at RETURNING id)
     INSERT INTO headcount_snapshots (slot_id, projected)
     SELECT l.id, (SELECT count(*) FROM opt_ins o WHERE o.slot_id = l.id AND o.opted_in)
     FROM locked l ON CONFLICT (slot_id) DO NOTHING`
  );
  // 2. LOCKED -> SERVING
  await query(`UPDATE meal_slots SET status = 'SERVING' WHERE status = 'LOCKED' AND now() >= starts_at`);
  // 3. SERVING -> CLOSED
  await query(`UPDATE meal_slots SET status = 'CLOSED' WHERE status <> 'CLOSED' AND now() >= ends_at`);
}

function start() {
  tick().catch((e) => console.error('cut-off job failed:', e.message)); // once at startup
  cron.schedule('* * * * *', () => tick().catch((e) => console.error('cut-off job failed:', e.message)));
}

module.exports = { start };
