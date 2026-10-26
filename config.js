// Reads settings from the .env file and stops early if something important is missing.
require('dotenv').config();

function need(name) {
  if (!process.env[name]) {
    console.error(`Missing ${name} in .env (see .env.example)`);
    process.exit(1);
  }
  return process.env[name];
}

module.exports = {
  PORT: process.env.PORT || 5000,
  DATABASE_URL: need('DATABASE_URL'),
  JWT_SECRET: need('JWT_SECRET'),
  QR_SECRET: need('QR_SECRET'),
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  EMAIL_DOMAIN: (process.env.EMAIL_DOMAIN || 'college.edu.in').toLowerCase(),
  REQUIRE_EMAIL_VERIFY: process.env.REQUIRE_EMAIL_VERIFY !== 'false',
};
