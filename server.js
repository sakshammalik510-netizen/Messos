const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { PORT, CLIENT_URL } = require('./config');
const cutoffJob = require('./jobs/cutoff');

const app = express();
app.use(helmet());
app.use(cors({ origin: [CLIENT_URL,'http://localhost:5000', 'http://127.0.0.1:5000' ] }));   // lets the React app talk to this server
app.use(express.json());                  // lets us read JSON request bodies

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 50 }), require('./routes/auth'));
app.use('/api/meals', require('./routes/meals'));
app.use('/api/diet', require('./routes/diet'));
app.use('/api/qr', require('./routes/qr'));
app.use('/api/scan', require('./routes/scan'));
app.use('/api/admin', require('./routes/admin'));

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// One place that turns errors into clean JSON (Express 5 sends async errors here automatically)
app.use((err, req, res, next) => {
  if (err.code === '23505') return res.status(409).json({ error: 'That already exists (duplicate)' });
  if (err.code === '23514') return res.status(400).json({ error: 'A value breaks a database rule' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

app.listen(PORT, () => {
  console.log(`MessOS API running on http://localhost:${PORT}`);
  cutoffJob.start();
});
