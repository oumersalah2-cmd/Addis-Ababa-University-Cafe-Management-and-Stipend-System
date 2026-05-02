# AAU Café Management & Stipend System

> Full-Stack Real-Time Web Application for Campus Dining & Payment Tracking

![Tech Stack](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white) ![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white) ![Express](https://img.shields.io/badge/Express-000000?style=flat&logo=express&logoColor=white) ![JWT](https://img.shields.io/badge/JWT-000000?style=flat&logo=jsonwebtokens&logoColor=white)

---

## Overview

A production-ready campus café management system designed for Addis Ababa University's 5 Kilo campus (~2,000 students). The system digitises meal attendance tracking, automates monthly 3,000 ETB stipend payments for non-café students, and provides real-time dashboards for students, admins, and finance.

**Key problem solved:** Eliminates dual-claiming fraud (students claiming both café meals AND cash payments) through database-level constraints.

---

## Features

### Student Portal
- Self-registration with email/password (bcrypt hashed)
- Real-time payment status tracking (PENDING → CONFIRMED → SENT)
- Meal attendance history for café users
- Profile management with department & dormitory info

### Admin Dashboard
- Approve/reject student registrations
- Create & confirm monthly cash payments (3,000 ETB)
- Department-level payment summary reports
- Full audit trail of every admin action

### Security
- JWT-based authentication with 8-hour session tokens
- bcrypt password hashing (10 salt rounds)
- Role-based access control (STUDENT / ADMIN)
- Immutable audit log (PostgreSQL RULE protection)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Database** | PostgreSQL 18 with custom ENUMs, CHECK constraints, partial indexes |
| **Backend** | Node.js + Express.js REST API |
| **Auth** | JWT tokens + bcrypt password hashing |
| **Frontend** | Vanilla JavaScript, HTML5, CSS3 (dark glassmorphism UI) |
| **Deployment** | Vercel (frontend) + Render/Railway (backend + DB) |

---

## Database Schema (8 Tables, 3NF)

```
Departments ──┐
              ├── Students ──┬── Cash_Payments
Dormitories ──┘              ├── Meal_Attendance ── Menus
                             └── Audit_Logs
Admins ──────────────────────┘
```

- **5 custom ENUM types** — student_type, meal_type, payment_status, admin_role, gender
- **10+ complex SQL queries** — INNER/LEFT/RIGHT/FULL OUTER JOINs, subqueries, window functions, aggregations
- **Referential integrity** — ON DELETE CASCADE/RESTRICT/SET NULL across all FK relationships

---

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 15+

### Setup

```bash
# 1. Clone & install
git clone https://github.com/YOUR_USERNAME/aau-cafe-system.git
cd aau-cafe-system
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your PostgreSQL credentials

# 3. Initialize database
psql -U postgres -d aau_cafe -f db/schema.sql
psql -U postgres -d aau_cafe -f db/seed.sql

# 4. Start server
node src/server.js
# → http://localhost:4000
```

### Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | kassahun@aau.edu.et | Admin123 |
| CAFE Student | abel@stu.aau.et | Student123 |
| NON_CAFE Student | hana@stu.aau.et | Student123 |

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | — | Login (student or admin) |
| POST | `/api/students/register` | — | Student self-registration |
| GET | `/api/students/me` | Student | Profile + payments/meals |
| GET | `/api/departments` | — | List departments |
| GET | `/api/dormitories` | — | List dormitories |
| GET | `/api/admin/students/pending` | Admin | Pending approvals |
| PATCH | `/api/admin/students/:id/approve` | Admin | Approve student |
| POST | `/api/admin/payments` | Admin | Create payment record |
| PATCH | `/api/admin/payments/:id/confirm` | Admin | Confirm payment |
| PATCH | `/api/admin/payments/:id/send` | Admin | Mark as sent |
| GET | `/api/admin/reports/department-summary` | Admin | Payment report |
| GET | `/api/admin/audit/recent` | Admin | Audit log |

---

## Screenshots

The application features a modern dark glassmorphism UI with:
- Animated gradient background orbs
- Glass-effect cards with subtle glow borders
- Responsive design (mobile/tablet/desktop)
- Micro-animations and smooth transitions
- Color-coded status badges (PENDING / CONFIRMED / SENT)

---

## Author

**Abdusalam Oumer**

Full-stack developer specializing in PostgreSQL database design, Node.js backends, and modern responsive UIs.

---

## License

MIT
