// Dietary preference log: every change is a NEW row, so the history is kept.
const router = require('express').Router();
const { z } = require('zod');
const { query } = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.use(authRequired, requireRole('STUDENT'));

const dietSchema = z.object({
  preference: z.string().trim().max(200).optional(),
  allergies: z.string().trim().max(200).optional(),
});

// POST /api/diet   body: { "preference": "no onion or garlic", "allergies": "peanuts" }
router.post('/', validate(dietSchema), async (req, res) => {
  const { preference, allergies } = req.valid;
  const { rows } = await query(
    `INSERT INTO diet_logs (user_id, preference, allergies)
     VALUES ($1, NULLIF($2, ''), NULLIF($3, '')) RETURNING id, preference, allergies, created_at`,
    [req.user.id, preference || null, allergies || null]
  );
  res.status(201).json(rows[0]);
});

// GET /api/diet  -> the current (latest) entry
router.get('/', async (req, res) => {
  const { rows } = await query(
    'SELECT id, preference, allergies, created_at FROM diet_logs WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1',
    [req.user.id]
  );
  res.json(rows[0] || null);
});

// GET /api/diet/history -> all entries, newest first
router.get('/history', async (req, res) => {
  const { rows } = await query(
    'SELECT id, preference, allergies, created_at FROM diet_logs WHERE user_id = $1 ORDER BY created_at DESC, id DESC',
    [req.user.id]
  );
  res.json(rows);
});

module.exports = router;
