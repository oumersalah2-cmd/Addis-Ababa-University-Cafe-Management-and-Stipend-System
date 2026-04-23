# AAU Cafe Management and Stipend System

Starter implementation for the College of Technology and Built Environment (5 Kilo).

## What is included

- PostgreSQL schema with strict constraints in `db/schema.sql`
- Seed data in `db/seed.sql`
- Useful admin/report SQL in `db/queries.sql`
- Minimal Node/Express API in `backend/src/server.js`
- Browser UI in `backend/public/index.html`

## Setup

1. Create a PostgreSQL database:
   - `aau_cafe`
2. Run:
   - `db/schema.sql`
   - `db/seed.sql`
3. In `backend`:
   - Copy `.env.example` to `.env`
   - Update DB credentials
   - Run `npm install`
   - Run `npm run dev`

## Main API Endpoints

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/students/register`
- `GET /api/admin/students/pending`
- `PATCH /api/admin/students/:studentId/approve`
- `POST /api/admin/stipends`
- `PATCH /api/admin/stipends/:transactionId/confirm`
- `GET /api/admin/audit/recent`

## Browser pages

- Student registration page: `http://localhost:4000/`
- Student portal page: `http://localhost:4000/student`
- Admin page: `http://localhost:4000/admin`

Admin UI is separated from student pages so regular users do not see admin tools.
Both admin and student portals keep login session in browser storage until logout or token expiry.

## Seed login credentials

- Admin username: `admin_main`
- Admin password: `admin123`
- Student username: `abel2001`
- Student password: `student123`

## Registration rules

- Student registration requires a unique `student_id` and unique `username`.
- Password must be at least 8 characters and include uppercase, lowercase, and number.

## Security and audit additions

- Login endpoint has basic failed-attempt protection (temporary block after repeated failures).
- Admin actions are logged in `admin_audit_log`:
  - student approval
  - stipend creation
  - stipend payment confirmation

## Next build steps

- Move JWT from localStorage to HTTP-only cookies.
- Add forgot/reset password flow.
- Add export for monthly reports (CSV/PDF).
