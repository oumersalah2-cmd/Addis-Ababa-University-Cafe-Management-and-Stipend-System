require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("./db");

const app = express();
const port = Number(process.env.PORT || 4000);
const jwtSecret = process.env.JWT_SECRET || "change_me_in_env";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// ── Helpers ──────────────────────────────────────────────────

function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, error: "Missing bearer token" });
  try {
    req.user = jwt.verify(token, jwtSecret);
    return next();
  } catch (_) {
    return res.status(401).json({ ok: false, error: "Invalid or expired token" });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "ADMIN") return res.status(403).json({ ok: false, error: "Admin access required" });
  return next();
}

function requireStudent(req, res, next) {
  if (!req.user || req.user.role !== "STUDENT") return res.status(403).json({ ok: false, error: "Student access required" });
  return next();
}

function isStrongPassword(pw) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(pw);
}

function normalizeDbError(error) {
  if (!error || !error.code) return null;
  if (error.code === "23505") {
    if (String(error.constraint).includes("students_email_key")) return "Email already registered.";
    if (String(error.constraint).includes("one_payment_per_month")) return "Payment already exists for this student/month.";
    return "Duplicate data is not allowed.";
  }
  if (error.code === "23503") return "Referenced record does not exist.";
  if (error.code === "23514") return "Submitted values do not meet required rules.";
  return null;
}

// ── Public API ───────────────────────────────────────────────

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    return res.json({ ok: true, message: "API and DB are reachable" });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/departments", async (_req, res) => {
  try {
    const r = await pool.query("SELECT department_id, department_name, college FROM Departments ORDER BY department_name");
    return res.json({ ok: true, data: r.rows });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/dormitories", async (_req, res) => {
  try {
    const r = await pool.query("SELECT dormitory_id, dorm_name, block, gender_type FROM Dormitories ORDER BY block");
    return res.json({ ok: true, data: r.rows });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Auth ─────────────────────────────────────────────────────

app.post("/api/auth/login", async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password) return res.status(400).json({ ok: false, error: "Email and password required" });

  try {
    if (role === "admin") {
      const r = await pool.query("SELECT * FROM Admins WHERE email = $1 AND is_active = TRUE", [email]);
      if (!r.rowCount) return res.status(401).json({ ok: false, error: "Invalid credentials" });
      const admin = r.rows[0];
      if (!(await bcrypt.compare(password, admin.password_hash)))
        return res.status(401).json({ ok: false, error: "Invalid credentials" });
      // Update last login
      await pool.query("UPDATE Admins SET last_login = NOW() WHERE admin_id = $1", [admin.admin_id]);
      const token = jwt.sign({ id: admin.admin_id, email: admin.email, role: "ADMIN", full_name: admin.full_name }, jwtSecret, { expiresIn: "8h" });
      return res.json({ ok: true, data: { token, user: { id: admin.admin_id, email: admin.email, role: "ADMIN", full_name: admin.full_name } } });
    } else {
      const r = await pool.query("SELECT * FROM Students WHERE email = $1", [email]);
      if (!r.rowCount) return res.status(401).json({ ok: false, error: "Invalid credentials" });
      const student = r.rows[0];
      if (!(await bcrypt.compare(password, student.password_hash)))
        return res.status(401).json({ ok: false, error: "Invalid credentials" });
      const token = jwt.sign({ id: student.student_id, email: student.email, role: "STUDENT" }, jwtSecret, { expiresIn: "8h" });
      return res.json({ ok: true, data: { token, user: { id: student.student_id, email: student.email, role: "STUDENT" } } });
    }
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Student Registration ─────────────────────────────────────

app.post("/api/students/register", async (req, res) => {
  const { first_name, last_name, email, password, gender, year_of_study, year_enrolled, student_type, department_id, dormitory_id } = req.body;
  if (!email || !password) return res.status(400).json({ ok: false, error: "Email and password are required" });
  if (!isStrongPassword(password)) return res.status(400).json({ ok: false, error: "Password must be 8+ chars with uppercase, lowercase, and number." });

  try {
    const password_hash = await bcrypt.hash(password, 10);
    const r = await pool.query(
      `INSERT INTO Students (first_name, last_name, email, password_hash, gender, year_of_study, year_enrolled, student_type, department_id, dormitory_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING student_id, first_name, last_name, email, student_type, is_approved, created_at`,
      [first_name, last_name, email, password_hash, gender, year_of_study, year_enrolled, student_type, department_id, dormitory_id]
    );
    // Audit log
    await pool.query(
      "INSERT INTO Audit_Logs (actor_id, actor_type, action, target_table, target_id, new_value) VALUES ($1,'STUDENT','INSERT','Students',$2,$3)",
      [r.rows[0].student_id, r.rows[0].student_id, `New student registered: ${first_name} ${last_name}`]
    );
    return res.status(201).json({ ok: true, message: "Registration submitted. Waiting for admin approval.", data: r.rows[0] });
  } catch (e) {
    return res.status(400).json({ ok: false, error: normalizeDbError(e) || e.message });
  }
});

// ── Student Portal ───────────────────────────────────────────

app.get("/api/students/me", authenticate, requireStudent, async (req, res) => {
  try {
    const profile = await pool.query(
      `SELECT s.*, d.department_name, dr.dorm_name, dr.block
       FROM Students s
       LEFT JOIN Departments d ON d.department_id = s.department_id
       LEFT JOIN Dormitories dr ON dr.dormitory_id = s.dormitory_id
       WHERE s.student_id = $1`, [req.user.id]
    );
    if (!profile.rowCount) return res.status(404).json({ ok: false, error: "Student not found" });

    const p = profile.rows[0];
    let payments = [], meals = [];

    if (p.student_type === "NON_CAFE") {
      const pr = await pool.query("SELECT * FROM Cash_Payments WHERE student_id = $1 ORDER BY payment_year DESC, payment_month DESC", [req.user.id]);
      payments = pr.rows;
    }

    if (p.student_type === "CAFE") {
      const mr = await pool.query(
        `SELECT a.meal_date, a.meal_type, a.recorded_at, m.item_name
         FROM Meal_Attendance a LEFT JOIN Menus m ON m.menu_id = a.menu_id
         WHERE a.student_id = $1 ORDER BY a.meal_date DESC, a.meal_type LIMIT 30`, [req.user.id]
      );
      meals = mr.rows;
    }

    return res.json({ ok: true, data: { profile: p, payments, meals } });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Admin: Students ──────────────────────────────────────────

app.get("/api/admin/students/pending", authenticate, requireAdmin, async (_req, res) => {
  try {
    const r = await pool.query(
      `SELECT s.student_id, s.first_name, s.last_name, s.email, s.student_type, s.year_of_study, s.year_enrolled, d.department_name
       FROM Students s LEFT JOIN Departments d ON d.department_id = s.department_id
       WHERE s.is_approved = FALSE ORDER BY s.created_at ASC`
    );
    return res.json({ ok: true, data: r.rows });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/admin/students/non-cafe-approved", authenticate, requireAdmin, async (_req, res) => {
  try {
    const r = await pool.query(
      `SELECT s.student_id, s.first_name, s.last_name, s.email
       FROM Students s WHERE s.student_type = 'NON_CAFE' AND s.is_approved = TRUE ORDER BY s.first_name`
    );
    return res.json({ ok: true, data: r.rows });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

app.patch("/api/admin/students/:id/approve", authenticate, requireAdmin, async (req, res) => {
  try {
    const r = await pool.query("UPDATE Students SET is_approved = TRUE WHERE student_id = $1 RETURNING *", [req.params.id]);
    if (!r.rowCount) return res.status(404).json({ ok: false, error: "Student not found" });
    await pool.query(
      "INSERT INTO Audit_Logs (actor_id, actor_type, action, target_table, target_id, new_value) VALUES ($1,'ADMIN','UPDATE','Students',$2,$3)",
      [req.user.id, req.params.id, `Approved student ${r.rows[0].first_name} ${r.rows[0].last_name}`]
    );
    return res.json({ ok: true, message: "Student approved.", data: r.rows[0] });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Admin: Cash Payments ─────────────────────────────────────

app.post("/api/admin/payments", authenticate, requireAdmin, async (req, res) => {
  const { student_id, payment_month, payment_year } = req.body;
  try {
    const r = await pool.query(
      `INSERT INTO Cash_Payments (student_id, amount, payment_month, payment_year, status) VALUES ($1, 3000.00, $2, $3, 'PENDING') RETURNING *`,
      [student_id, payment_month, payment_year]
    );
    await pool.query(
      "INSERT INTO Audit_Logs (actor_id, actor_type, action, target_table, target_id, new_value) VALUES ($1,'ADMIN','INSERT','Cash_Payments',$2,$3)",
      [req.user.id, r.rows[0].payment_id, `Created pending payment for student ${student_id}, month ${payment_month}/${payment_year}`]
    );
    return res.status(201).json({ ok: true, data: r.rows[0] });
  } catch (e) {
    return res.status(400).json({ ok: false, error: normalizeDbError(e) || e.message });
  }
});

app.get("/api/admin/payments/pending", authenticate, requireAdmin, async (_req, res) => {
  try {
    const r = await pool.query(
      `SELECT cp.*, s.first_name, s.last_name FROM Cash_Payments cp
       INNER JOIN Students s ON s.student_id = cp.student_id
       WHERE cp.status = 'PENDING' ORDER BY cp.payment_year, cp.payment_month`
    );
    return res.json({ ok: true, data: r.rows });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/admin/payments/sent-count", authenticate, requireAdmin, async (_req, res) => {
  try {
    const r = await pool.query("SELECT COUNT(*) as count FROM Cash_Payments WHERE status = 'SENT'");
    return res.json({ ok: true, data: { count: parseInt(r.rows[0].count) } });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

app.patch("/api/admin/payments/:id/confirm", authenticate, requireAdmin, async (req, res) => {
  try {
    const r = await pool.query(
      "UPDATE Cash_Payments SET status = 'CONFIRMED', confirmed_by = $1, confirmed_at = NOW() WHERE payment_id = $2 AND status = 'PENDING' RETURNING *",
      [req.user.id, req.params.id]
    );
    if (!r.rowCount) return res.status(404).json({ ok: false, error: "Pending payment not found" });
    await pool.query(
      "INSERT INTO Audit_Logs (actor_id, actor_type, action, target_table, target_id, new_value) VALUES ($1,'ADMIN','UPDATE','Cash_Payments',$2,'Confirmed payment')",
      [req.user.id, req.params.id]
    );
    return res.json({ ok: true, data: r.rows[0] });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

app.patch("/api/admin/payments/:id/send", authenticate, requireAdmin, async (req, res) => {
  try {
    const r = await pool.query(
      "UPDATE Cash_Payments SET status = 'SENT', sent_at = NOW() WHERE payment_id = $1 AND status IN ('PENDING','CONFIRMED') RETURNING *",
      [req.params.id]
    );
    if (!r.rowCount) return res.status(404).json({ ok: false, error: "Payment not found or already sent" });
    await pool.query(
      "INSERT INTO Audit_Logs (actor_id, actor_type, action, target_table, target_id, new_value) VALUES ($1,'ADMIN','UPDATE','Cash_Payments',$2,'Marked payment as SENT')",
      [req.user.id, req.params.id]
    );
    return res.json({ ok: true, data: r.rows[0] });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Admin: Reports ───────────────────────────────────────────

app.get("/api/admin/reports/department-summary", authenticate, requireAdmin, async (_req, res) => {
  try {
    const r = await pool.query(
      `SELECT d.department_name,
              COUNT(cp.payment_id) AS total_payments,
              SUM(cp.amount) AS total_amount,
              COUNT(*) FILTER (WHERE cp.status = 'PENDING') AS pending_count,
              COUNT(*) FILTER (WHERE cp.status = 'CONFIRMED') AS confirmed_count,
              COUNT(*) FILTER (WHERE cp.status = 'SENT') AS sent_count
       FROM Cash_Payments cp
       INNER JOIN Students s ON cp.student_id = s.student_id
       INNER JOIN Departments d ON s.department_id = d.department_id
       GROUP BY d.department_name ORDER BY total_amount DESC`
    );
    return res.json({ ok: true, data: r.rows });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Admin: Audit Log ─────────────────────────────────────────

app.get("/api/admin/audit/recent", authenticate, requireAdmin, async (_req, res) => {
  try {
    const r = await pool.query("SELECT * FROM Audit_Logs ORDER BY logged_at DESC LIMIT 50");
    return res.json({ ok: true, data: r.rows });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Menu (public) ────────────────────────────────────────────

app.get("/api/menu", async (_req, res) => {
  try {
    const r = await pool.query("SELECT * FROM Menus WHERE is_available = TRUE ORDER BY meal_type, item_name");
    return res.json({ ok: true, data: r.rows });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// ── SPA Routes ───────────────────────────────────────────────

app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "..", "public", "index.html")));
app.get("/student", (_req, res) => res.sendFile(path.join(__dirname, "..", "public", "student.html")));
app.get("/admin", (_req, res) => res.sendFile(path.join(__dirname, "..", "public", "admin.html")));

app.use((req, res) => {
  if (req.method === "GET" && !req.path.startsWith("/api")) {
    res.sendFile(path.join(__dirname, "..", "public", "index.html"));
  } else {
    res.status(404).json({ error: "Not Found" });
  }
});

app.listen(port, () => {
  console.log(`AAU backend listening on http://localhost:${port}`);
});
