// Student side: see today's meals with live countdowns, and opt in / out before the cut-off.
const router = require('express').Router();
const { z } = require('zod');
const { query } = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { phase, TODAY_IST } = require('../phase');

router.use(authRequired, requireRole('STUDENT'));

const dateQuery = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });
const optSchema = z.object({ optedIn: z.boolean() });

// GET /api/meals            (today)   or   GET /api/meals?date=2026-10-25
router.get('/', validate(dateQuery, 'query'), async (req, res) => {
  const { rows } = await query(
    `SELECT s.id, s.slot_date, s.meal, s.menu, s.cutoff_at, s.starts_at, s.ends_at,
            ${phase('s')} AS phase,
            GREATEST(0, floor(extract(epoch FROM s.cutoff_at - now())))::int AS seconds_to_cutoff,
            COALESCE(o.opted_in, false) AS opted_in
     FROM meal_slots s
     LEFT JOIN opt_ins o ON o.slot_id = s.id AND o.user_id = $1
     WHERE s.slot_date = COALESCE($2::date, ${TODAY_IST})
     ORDER BY s.starts_at`,
    [req.user.id, req.valid.date || null]
  );
  res.json(rows);
});

// POST /api/meals/:slotId/optin   body: { "optedIn": false }
// The WHERE now() < cutoff_at is the "atomic cut-off": the DATABASE decides, in one statement.
router.post('/:slotId/optin', validate(optSchema), async (req, res) => {
  const slotId = Number(req.params.slotId);
  if (!Number.isInteger(slotId)) return res.status(400).json({ error: 'Bad slot id' });

  const { rows } = await query(
    `INSERT INTO opt_ins (user_id, slot_id, opted_in)
     SELECT $1::int, s.id, $3::boolean FROM meal_slots s
     WHERE s.id = $2::int AND now() < s.cutoff_at
     ON CONFLICT (user_id, slot_id)
     DO UPDATE SET opted_in = EXCLUDED.opted_in, updated_at = now()
     RETURNING opted_in`,
    [req.user.id, slotId, req.valid.optedIn]
  );
  if (rows.length) return res.json({ slotId, optedIn: rows[0].opted_in });

  // nothing changed: either the slot does not exist, or the cut-off has passed
  const slot = await query('SELECT 1 FROM meal_slots WHERE id = $1', [slotId]);
  if (!slot.rowCount) return res.status(404).json({ error: 'Meal not found' });
  res.status(409).json({ error: 'This meal is locked. The cut-off time has passed.' });
});

module.exports = router;
