// Staff scans a student's QR. Every scan, accepted or rejected, is written to scan_audit.
const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const { query } = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { phase } = require('../phase');
const { verifyToken } = require('../qr');

router.use(authRequired, requireRole('STAFF', 'ADMIN'));
router.use(rateLimit({ windowMs: 60 * 1000, limit: 180 })); // generous: the lunch rush is busy

const MESSAGES = {
  MALFORMED: 'Not a MessOS QR code',
  BAD_SIGNATURE: 'Fake or tampered QR code',
  EXPIRED: 'QR code expired. Ask the student to refresh it',
  UNKNOWN_STUDENT: 'Student not found',
  NOT_SERVING: 'This meal is not being served right now',
  OPTED_OUT: 'Student opted out of this meal',
  ALREADY_SERVED: 'Already served. Do not give another meal',
};

const audit = (userId, slotId, staffId, result, reason) =>
  query('INSERT INTO scan_audit (user_id, slot_id, staff_id, result, reason) VALUES ($1,$2,$3,$4,$5)',
    [userId, slotId, staffId, result, reason]);

// Expected outcomes (accepted OR rejected) return HTTP 200 with { ok: true/false },
// so the scanner page only has to look at "ok" and show green or red.
async function reject(res, staffId, code, userId = null, slotId = null, name = null) {
  await audit(userId, slotId, staffId, 'REJECTED', code);
  res.json({ ok: false, code, message: MESSAGES[code], student: name });
}

router.post('/', validate(z.object({ token: z.string().min(5).max(200) })), async (req, res) => {
  const staffId = req.user.id;

  // 1. Is the token genuine and fresh?
  const v = verifyToken(req.valid.token);
  if (!v.ok) return reject(res, staffId, v.reason);

  // 2. Who is it, and is this meal being served and did they opt in?
  const { rows } = await query(
    `SELECT u.name, u.reg_no, s.meal, ${phase('s')} AS phase, COALESCE(o.opted_in, false) AS opted_in
     FROM users u
     CROSS JOIN meal_slots s
     LEFT JOIN opt_ins o ON o.user_id = u.id AND o.slot_id = s.id
     WHERE u.id = $1 AND s.id = $2`,
    [v.userId, v.slotId]
  );
  if (!rows.length) return reject(res, staffId, 'UNKNOWN_STUDENT');
  const info = rows[0];
  if (info.phase !== 'SERVING') return reject(res, staffId, 'NOT_SERVING', v.userId, v.slotId, info.name);
  if (!info.opted_in) return reject(res, staffId, 'OPTED_OUT', v.userId, v.slotId, info.name);

  // 3. The single-use rule. UNIQUE(user_id, slot_id) means only ONE insert can ever win,
  //    even if two staff scan the same student in the same millisecond.
  const ins = await query(
    `INSERT INTO consumption_ledger (user_id, slot_id, staff_id) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, slot_id) DO NOTHING RETURNING id`,
    [v.userId, v.slotId, staffId]
  );
  if (!ins.rowCount) return reject(res, staffId, 'ALREADY_SERVED', v.userId, v.slotId, info.name);

  await audit(v.userId, v.slotId, staffId, 'ACCEPTED', null);
  res.json({ ok: true, message: 'Meal approved', student: info.name, regNo: info.reg_no, meal: info.meal });
});

module.exports = router;
