# AAU Cafe Management and Stipend System

Full-stack real-time campus café ordering and stipend management system for Addis Ababa University (5 Kilo).

## Core Features

- **Relational Database**: PostgreSQL with strict constraints (Dormitory, Student, Department, Menu, Orders, Stipends).
- **Student Portal**: Self-registration, profile management, stipend tracking, and **real-time menu ordering**.
- **Admin Dashboard**: Student approval, stipend creation, payment confirmation, and **menu management**.
- **Kitchen Dashboard**: Real-time order tracking (PENDING -> PREPARING -> READY -> COMPLETED).
- **Security**: JWT authentication, hashed passwords, audit logging, and failed login protection.

## Setup

1. Create a PostgreSQL database:
   - `aau_cafe`
2. Run SQL scripts in order:
   - `db/schema.sql`
   - `db/seed.sql`
3. In `backend`:
   - Copy `.env.example` to `.env` and update credentials.
   - Run `npm install`
   - Run `npm run dev`

## Browser Pages

- **Registration**: `http://localhost:4000/`
- **Student Portal**: `http://localhost:4000/student`
- **Admin Dashboard**: `http://localhost:4000/admin`
- **Kitchen Dashboard**: `http://localhost:4000/kitchen`

## Seed Login Credentials (from `seed.sql`)

- **Admin**: `admin` / `admin123`
- **Student**: `abebe1001` / `student123`

## Technical Architecture

- **Backend**: Node.js, Express, `pg` (PostgreSQL client).
- **Frontend**: Vanilla JavaScript, HTML5, CSS3.
- **Real-time**: Simple polling mechanism for live order status.

## Complex Queries

The `db/queries.sql` file contains 10 advanced business queries:
1. Student & Dorm onboarding.
2. Status transitions (Cafe -> Stipend).
3. Automated log cleanup.
4. Active student reports (Multi-join).
5. Missing payment identification (Left Join).
6. Department distribution (Right Join).
7. Data integrity audits (Full Join).
8. Resource allocation reports (Aggregation).
9. Student welfare checks (Subquery).
10. Comprehensive student dossiers.

