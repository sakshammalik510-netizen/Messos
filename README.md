# MessOS backend (Foundation tier)

Node.js + Express + PostgreSQL. Features: login with roles, meal opt-in/out with an atomic cut-off,
rotating HMAC QR codes, single-use scanning, consumption ledger, head-count forecast, dietary log.

## Run it
1. Install Node 18+ and PostgreSQL. Create an empty database:  `CREATE DATABASE messos;`
2. `npm install`
3. Copy `.env.example` to `.env` and fill in DATABASE_URL, JWT_SECRET, QR_SECRET.
   (While testing, set REQUIRE_EMAIL_VERIFY=false.)
4. `npm run db:init`   creates the tables (resets them if they exist)
5. `npm run db:seed`   adds test users and 3 demo meals
6. `npm run dev`       starts the API on http://localhost:5000

Test logins (password in brackets): admin@ (Admin@1234), staff@ (Staff@1234),
aarav@ / meera@ / kabir@ (Student@1234), all ending with your EMAIL_DOMAIN.
The seed makes BREAKFAST "serving now", LUNCH "locked", DINNER "open", so every feature can be tried.

## Endpoints
| Method | Path | Who | What |
|---|---|---|---|
| POST | /api/auth/register | anyone | sign up (college email only) |
| GET | /api/auth/verify?token= | anyone | confirm email |
| POST | /api/auth/login | anyone | get a JWT |
| GET | /api/meals?date= | student | today's meals, phase, countdown, my choice |
| POST | /api/meals/:slotId/optin | student | body {"optedIn": true/false}, rejected after cut-off |
| POST / GET | /api/diet, /api/diet/history | student | dietary log |
| GET | /api/qr/:slotId | student | fresh 30-second QR token (only while serving) |
| POST | /api/scan | staff, admin | body {"token": "..."}; returns {ok, code, message} |
| POST | /api/admin/slots | admin | create a meal slot |
| GET | /api/admin/forecast?date= | admin, staff | projected vs served |
| GET | /api/admin/diet-notes?slotId= | admin, staff | notes of opted-in students |
| GET | /api/admin/ledger?slotId=, /audit?slotId=, /users | admin | records |

Send the JWT as `Authorization: Bearer <token>` on every protected call.
Scan results always come back as HTTP 200 with `ok: true` or `ok: false`, so the scanner page shows green or red.

## Not done yet
Real email sending (the verify link prints in the terminal), offline queue, rebate billing, waste analytics.
