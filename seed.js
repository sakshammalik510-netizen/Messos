// Adds test users and three demo meals so you can try every feature straight away.
const bcrypt = require('bcryptjs');
const { pool } = require('../src/db');
const { EMAIL_DOMAIN } = require('../src/config');

(async () => {
  const d = (name) => `${name}@${EMAIL_DOMAIN}`;
  const people = [
    ['Admin', d('admin'), 'ADM001', 'Admin@1234', 'ADMIN'],
    ['Counter Staff', d('staff'), 'STF001', 'Staff@1234', 'STAFF'],
    ['Aarav', d('aarav'), 'REG001', 'Student@1234', 'STUDENT'],
    ['Meera', d('meera'), 'REG002', 'Student@1234', 'STUDENT'],
    ['Kabir', d('kabir'), 'REG003', 'Student@1234', 'STUDENT'],
  ];
  for (const [name, email, reg, pw, role] of people) {
    await pool.query(
      `INSERT INTO users (name, email, reg_no, password_hash, role, email_verified)
       VALUES ($1,$2,$3,$4,$5,true) ON CONFLICT (email) DO NOTHING`,
      [name, email, reg, await bcrypt.hash(pw, 10), role]
    );
  }
  // Three demo slots for today, each in a different phase:
  //   BREAKFAST = serving now, LUNCH = locked, DINNER = still open
  await pool.query(`
    INSERT INTO meal_slots (slot_date, meal, menu, cutoff_at, starts_at, ends_at) VALUES
    ((now() AT TIME ZONE 'Asia/Kolkata')::date, 'BREAKFAST', 'Poha, tea', now() - interval '3 hours', now() - interval '1 hour',  now() + interval '1 hour'),
    ((now() AT TIME ZONE 'Asia/Kolkata')::date, 'LUNCH',     'Dal, rice, roti', now() - interval '1 hour', now() + interval '1 hour', now() + interval '3 hours'),
    ((now() AT TIME ZONE 'Asia/Kolkata')::date, 'DINNER',    'Paneer, roti',   now() + interval '2 hours', now() + interval '4 hours', now() + interval '6 hours')
    ON CONFLICT (slot_date, meal) DO NOTHING`);
  await pool.query(`INSERT INTO opt_ins (user_id, slot_id)
    SELECT u.id, s.id FROM users u CROSS JOIN meal_slots s WHERE u.role = 'STUDENT' ON CONFLICT DO NOTHING`);
  console.log('Seeded. Logins: admin / staff / aarav / meera / kabir @' + EMAIL_DOMAIN);
  await pool.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
