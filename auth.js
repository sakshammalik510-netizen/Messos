const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { query, tx } = require('../db');
const validate = require('../middleware/validate');
const { JWT_SECRET, EMAIL_DOMAIN, REQUIRE_EMAIL_VERIFY, PORT } = require('../config');

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  regNo: z.string().trim().min(3).max(30),
  password: z.string().min(8, 'at least 8 characters').max(72),
});
const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

// POST /api/auth/register
router.post('/register', validate(registerSchema), async (req, res) => {
  const { name, email, regNo, password } = req.valid;
  if (!email.endsWith('@' + EMAIL_DOMAIN)) {
    return res.status(400).json({ error: `Please use your college email (@${EMAIL_DOMAIN})` });
  }
  const hash = await bcrypt.hash(password, 10); // never store the real password

  const user = await tx(async (db) => {
    const { rows } = await db.query(
      `INSERT INTO users (name, email, reg_no, password_hash, email_verified)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email`,
      [name, email, regNo, hash, !REQUIRE_EMAIL_VERIFY]
    );
    // give the new student a choice row for every meal that has not ended yet
    await db.query(
      `INSERT INTO opt_ins (user_id, slot_id)
       SELECT $1, id FROM meal_slots WHERE ends_at > now()`,
      [rows[0].id]
    );
    return rows[0];
  });

  if (REQUIRE_EMAIL_VERIFY) {
    const vt = jwt.sign({ id: user.id, purpose: 'verify' }, JWT_SECRET, { expiresIn: '1d' });
    // TODO (later): send this link with Nodemailer + Brevo. For now it prints in the terminal.
    console.log(`Verify link for ${email}: http://localhost:${PORT}/api/auth/verify?token=${vt}`);
  }
  res.status(201).json({ message: REQUIRE_EMAIL_VERIFY ? 'Account created. Check your email to verify it.' : 'Account created. You can log in.' });
});

// GET /api/auth/verify?token=...
router.get('/verify', async (req, res) => {
  try {
    const p = jwt.verify(String(req.query.token), JWT_SECRET);
    if (p.purpose !== 'verify') throw new Error();
    await query('UPDATE users SET email_verified = true WHERE id = $1', [p.id]);
    res.json({ message: 'Email verified. You can log in now.' });
  } catch {
    res.status(400).json({ error: 'This verification link is invalid or has expired' });
  }
});

// POST /api/auth/login
router.post('/login', validate(loginSchema), async (req, res) => {
  const { email, password } = req.valid;
  const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
  const user = rows[0];
  // same message for "no such email" and "wrong password" so attackers learn nothing
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Wrong email or password' });
  }
  if (!user.email_verified) return res.status(403).json({ error: 'Please verify your email first' });

  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

module.exports = router;
