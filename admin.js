// Admin and kitchen: create meal slots, head-count forecast, ledger, notes, users.
const router = require('express').Router();
const { z } = require('zod');
const { query, tx } = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { phase, TODAY_IST } = require('../phase');

router.use(authRequired);

const slotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  meal: z.enum(['BREAKFAST', 'LUNCH', 'DINNER']),
  menu: z.string().trim().max(300).optional(),
  // ISO times WITH the offset, e.g. 2026-10-25T10:30:00+05:30
  cutoffAt: z.string().datetime({ offset: true }),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
}).refine((d) => new Date(d.cutoffAt) < new Date(d.startsAt) && new Date(d.startsAt) < new Date(d.endsAt),
  { message: 'cutoffAt must be before startsAt, and startsAt before endsAt' });

const dateQuery = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  slotId: z.coerce.number().int().optional(),
});

// POST /api/admin/slots   (admin) creates a slot and opts every student in by default
router.post('/slots', requireRole('ADMIN'), validate(slotSchema), async (req, res) => {
  const d = req.valid;
  const slot = await tx(async (db) => {
    const { rows } = await db.query(
      `INSERT INTO meal_slots (slot_date, meal, menu, cutoff_at, starts_at, ends_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [d.date, d.meal, d.menu || null, d.cutoffAt, d.startsAt, d.endsAt]
    );
    await db.query(
      `INSERT INTO opt_ins (user_id, slot_id)
       SELECT id, $1 FROM users WHERE role = 'STUDENT'`,
      [rows[0].id]
    );
    return rows[0];
  });
  res.status(201).json(slot);
});

// GET /api/admin/forecast?date=...   (admin + kitchen staff) projected vs served
router.get('/forecast', requireRole('ADMIN', 'STAFF'), validate(dateQuery, 'query'), async (req, res) => {
  const { rows } = await query(
    `SELECT s.id, s.meal, s.menu, ${phase('s')} AS phase,
       (SELECT count(*) FROM opt_ins o WHERE o.slot_id = s.id AND o.opted_in)::int AS projected,
       (SELECT count(*) FROM consumption_ledger c WHERE c.slot_id = s.id)::int AS served,
       h.projected AS locked_headcount
     FROM meal_slots s
     LEFT JOIN headcount_snapshots h ON h.slot_id = s.id
     WHERE s.slot_date = COALESCE($1::date, ${TODAY_IST})
     ORDER BY s.starts_at`,
    [req.valid.date || null]
  );
  res.json(rows);
});

// GET /api/admin/diet-notes?slotId=1   latest dietary note / allergy of every opted-in student
router.get('/diet-notes', requireRole('ADMIN', 'STAFF'), validate(dateQuery, 'query'), async (req, res) => {
  if (!req.valid.slotId) return res.status(400).json({ error: 'slotId is required' });
  const { rows } = await query(
    `SELECT u.name, u.reg_no, d.preference, d.allergies
     FROM opt_ins o
     JOIN users u ON u.id = o.user_id
     JOIN LATERAL (SELECT preference, allergies FROM diet_logs
                   WHERE user_id = u.id ORDER BY created_at DESC, id DESC LIMIT 1) d ON true
     WHERE o.slot_id = $1 AND o.opted_in AND (d.preference IS NOT NULL OR d.allergies IS NOT NULL)
     ORDER BY u.name`,
    [req.valid.slotId]
  );
  res.json(rows);
});

// GET /api/admin/ledger?slotId=1   who was served, when, by whom
router.get('/ledger', requireRole('ADMIN'), validate(dateQuery, 'query'), async (req, res) => {
  if (!req.valid.slotId) return res.status(400).json({ error: 'slotId is required' });
  const { rows } = await query(
    `SELECT c.id, u.name, u.reg_no, st.name AS staff, c.scanned_at
     FROM consumption_ledger c
     JOIN users u ON u.id = c.user_id
     JOIN users st ON st.id = c.staff_id
     WHERE c.slot_id = $1 ORDER BY c.scanned_at DESC`,
    [req.valid.slotId]
  );
  res.json(rows);
});

// GET /api/admin/audit?slotId=1   every scan including rejected ones
router.get('/audit', requireRole('ADMIN'), validate(dateQuery, 'query'), async (req, res) => {
  if (!req.valid.slotId) return res.status(400).json({ error: 'slotId is required' });
  const { rows } = await query(
    `SELECT a.id, u.name AS student, a.result, a.reason, a.scanned_at
     FROM scan_audit a LEFT JOIN users u ON u.id = a.user_id
     WHERE a.slot_id = $1 OR a.slot_id IS NULL
     ORDER BY a.scanned_at DESC LIMIT 200`,
    [req.valid.slotId]
  );
  res.json(rows);
});

// GET /api/admin/users
router.get('/users', requireRole('ADMIN'), async (req, res) => {
  const { rows } = await query('SELECT id, name, email, reg_no, role, email_verified, created_at FROM users ORDER BY id');
  res.json(rows);
});

module.exports = router;
