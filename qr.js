// Student asks for a fresh QR token. The React page calls this every ~25 seconds.
const router = require('express').Router();
const { query } = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');
const { phase } = require('../phase');
const { makeToken } = require('../qr');

router.use(authRequired, requireRole('STUDENT'));

// GET /api/qr/:slotId   -> { token, expiresIn }
router.get('/:slotId', async (req, res) => {
  const slotId = Number(req.params.slotId);
  if (!Number.isInteger(slotId)) return res.status(400).json({ error: 'Bad slot id' });

  const { rows } = await query(
    `SELECT ${phase('s')} AS phase, COALESCE(o.opted_in, false) AS opted_in
     FROM meal_slots s
     LEFT JOIN opt_ins o ON o.slot_id = s.id AND o.user_id = $1
     WHERE s.id = $2`,
    [req.user.id, slotId]
  );
  if (!rows.length) return res.status(404).json({ error: 'Meal not found' });
  if (rows[0].phase !== 'SERVING') return res.status(409).json({ error: 'The QR code is available only while the meal is being served' });
  if (!rows[0].opted_in) return res.status(403).json({ error: 'You opted out of this meal' });

  res.json(makeToken(req.user.id, slotId));
});

module.exports = router;
