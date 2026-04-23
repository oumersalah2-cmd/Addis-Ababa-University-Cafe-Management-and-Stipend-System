const express = require("express");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("./db");

const app = express();
const port = Number(process.env.PORT || 4000);
const jwtSecret = process.env.JWT_SECRET || "change_me_in_env";
const loginAttempts = new Map();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ ok: false, error: "Missing bearer token" });
  }
  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    return next();
  } catch (_error) {
    return res.status(401).json({ ok: false, error: "Invalid or expired token" });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "ADMIN") {
    return res.status(403).json({ ok: false, error: "Admin access required" });
  }
  return next();
}

function requireStudent(req, res, next) {
  if (!req.user || req.user.role !== "STUDENT") {
    return res.status(403).json({ ok: false, error: "Student access required" });
  }
  return next();
}

function normalizeDbError(error) {
  if (!error || !error.code) return null;
  if (error.code === "23505") {
    if (String(error.constraint).includes("app_user_username_key")) {
      return "Username already exists. Please choose another username.";
    }
    if (String(error.constraint).includes("student_pkey")) {
      return "Student ID already exists.";
    }
    if (String(error.constraint).includes("stipend_transaction_student_id_stipend_month_key")) {
      return "This student already has a stipend transaction for that month.";
    }
    return "Duplicate data is not allowed.";
  }
  if (error.code === "23503") return "Referenced record does not exist.";
  if (error.code === "23514") return "Submitted values do not meet required business rules.";
  return null;
}

function isStrongPassword(password) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password);
}

function isLoginBlocked(key) {
  const attempt = loginAttempts.get(key);
  if (!attempt) return false;
  if (Date.now() > attempt.blockUntil) {
    loginAttempts.delete(key);
    return false;
  }
  return true;
}

function registerLoginFailure(key) {
  const now = Date.now();
  const attempt = loginAttempts.get(key) || { count: 0, blockUntil: 0 };
  attempt.count += 1;
  if (attempt.count >= 5) {
    attempt.blockUntil = now + 10 * 60 * 1000;
    attempt.count = 0;
  }
  loginAttempts.set(key, attempt);
}

function clearLoginFailure(key) {
  loginAttempts.delete(key);
}

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    return res.json({ ok: true, message: "API and DB are reachable" });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/api/departments", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT dept_id, dept_name
       FROM department
       ORDER BY dept_name ASC`
    );
    return res.json({ ok: true, data: result.rows });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ ok: false, error: "username and password are required" });
  }
  const loginKey = `${String(username).toLowerCase()}|${req.ip}`;
  if (isLoginBlocked(loginKey)) {
    return res.status(429).json({ ok: false, error: "Too many failed login attempts. Try again in 10 minutes." });
  }

  try {
    const result = await pool.query(
      `SELECT user_id, username, password_hash, role, student_id
       FROM app_user
       WHERE username = $1`,
      [username]
    );
    if (result.rowCount === 0) {
      registerLoginFailure(loginKey);
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      registerLoginFailure(loginKey);
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }
    clearLoginFailure(loginKey);

    const token = jwt.sign(
      {
        user_id: user.user_id,
        username: user.username,
        role: user.role,
        student_id: user.student_id,
      },
      jwtSecret,
      { expiresIn: "8h" }
    );

    return res.json({
      ok: true,
      data: {
        token,
        user: {
          user_id: user.user_id,
          username: user.username,
          role: user.role,
          student_id: user.student_id,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/api/students/register", async (req, res) => {
  const {
    student_id,
    first_name,
    last_name,
    year_of_study,
    dept_id,
    cafe_status,
    bank_account_number,
    dorm_block,
    floor_number,
    dorm_number,
    username,
    password,
  } = req.body;

  if (!username || !password) {
    return res.status(400).json({ ok: false, error: "username and password are required" });
  }
  if (!isStrongPassword(password)) {
    return res.status(400).json({
      ok: false,
      error: "Password must be at least 8 chars and include uppercase, lowercase, and number.",
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const values = [
      student_id,
      first_name,
      last_name,
      year_of_study,
      dept_id,
      cafe_status,
      bank_account_number || null,
      dorm_block,
      floor_number,
      dorm_number,
    ];

    const studentResult = await client.query(
      `INSERT INTO student (
        student_id, first_name, last_name, year_of_study, dept_id,
        cafe_status, bank_account_number, dorm_block, floor_number, dorm_number
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING student_id, first_name, last_name, cafe_status, is_approved, registered_at`,
      values
    );

    const password_hash = await bcrypt.hash(password, 10);
    await client.query(
      `INSERT INTO app_user (username, password_hash, role, student_id)
       VALUES ($1, $2, 'STUDENT', $3)`,
      [username, password_hash, student_id]
    );

    await client.query("COMMIT");
    return res.status(201).json({
      ok: true,
      message: "Registration submitted. Waiting for admin approval.",
      data: studentResult.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(400).json({ ok: false, error: normalizeDbError(error) || error.message });
  } finally {
    client.release();
  }
});

app.get("/api/students/me", authenticate, requireStudent, async (req, res) => {
  try {
    const profileResult = await pool.query(
      `SELECT s.student_id, s.first_name, s.last_name, s.year_of_study, s.cafe_status,
              s.bank_account_number, s.dorm_block, s.floor_number, s.dorm_number,
              s.is_approved, d.dept_name
       FROM student s
       INNER JOIN department d ON d.dept_id = s.dept_id
       WHERE s.student_id = $1`,
      [req.user.student_id]
    );
    if (profileResult.rowCount === 0) {
      return res.status(404).json({ ok: false, error: "Student profile not found" });
    }

    const stipendResult = await pool.query(
      `SELECT stipend_month, amount, status, confirmed_at
       FROM stipend_transaction
       WHERE student_id = $1
       ORDER BY stipend_month DESC`,
      [req.user.student_id]
    );

    const mealResult = await pool.query(
      `SELECT date_time, meal_type
       FROM meal_log
       WHERE student_id = $1
       ORDER BY date_time DESC
       LIMIT 20`,
      [req.user.student_id]
    );

    return res.json({
      ok: true,
      data: {
        profile: profileResult.rows[0],
        stipend_history: stipendResult.rows,
        recent_meals: mealResult.rows,
      },
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/api/admin/students/pending", authenticate, requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.student_id, s.first_name, s.last_name, s.cafe_status, s.registered_at, d.dept_name
       FROM student s
       INNER JOIN department d ON d.dept_id = s.dept_id
       WHERE s.is_approved = FALSE
       ORDER BY s.registered_at ASC`
    );
    return res.json({ ok: true, count: result.rowCount, data: result.rows });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/api/admin/students/non-cafe-approved", authenticate, requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.student_id, s.first_name, s.last_name, s.bank_account_number, d.dept_name
       FROM student s
       INNER JOIN department d ON d.dept_id = s.dept_id
       WHERE s.cafe_status = 'NON_CAFE'
         AND s.is_approved = TRUE
       ORDER BY s.first_name ASC, s.last_name ASC`
    );
    return res.json({ ok: true, data: result.rows });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.patch("/api/admin/students/:studentId/approve", authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE student
       SET is_approved = TRUE
       WHERE student_id = $1
       RETURNING student_id, first_name, last_name, is_approved`,
      [req.params.studentId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, error: "Student not found" });
    }
    await pool.query(
      `INSERT INTO admin_audit_log (admin_user_id, action_type, target_student_id, details)
       VALUES ($1, 'APPROVE_STUDENT', $2, $3)`,
      [req.user.user_id, req.params.studentId, "Student profile approved"]
    );

    return res.json({
      ok: true,
      message: "Student approved successfully.",
      data: result.rows[0],
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/api/admin/stipends", authenticate, requireAdmin, async (req, res) => {
  const { student_id, stipend_month, amount } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO stipend_transaction (student_id, stipend_month, amount, status)
       VALUES ($1, $2, $3, 'PENDING')
       RETURNING transaction_id, student_id, stipend_month, amount, status`,
      [student_id, stipend_month, amount]
    );
    await pool.query(
      `INSERT INTO admin_audit_log (admin_user_id, action_type, target_student_id, target_transaction_id, details)
       VALUES ($1, 'CREATE_STIPEND', $2, $3, $4)`,
      [req.user.user_id, student_id, result.rows[0].transaction_id, `Created stipend for ${stipend_month}`]
    );
    return res.status(201).json({
      ok: true,
      message: "Stipend transaction created.",
      data: result.rows[0],
    });
  } catch (error) {
    return res.status(400).json({ ok: false, error: normalizeDbError(error) || error.message });
  }
});

app.get("/api/admin/stipends/pending", authenticate, requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT st.transaction_id, st.student_id, st.stipend_month, st.amount, st.status,
              s.first_name, s.last_name
       FROM stipend_transaction st
       INNER JOIN student s ON s.student_id = st.student_id
       WHERE st.status = 'PENDING'
       ORDER BY st.stipend_month ASC, st.transaction_id ASC`
    );
    return res.json({ ok: true, data: result.rows });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.patch("/api/admin/stipends/:transactionId/confirm", authenticate, requireAdmin, async (req, res) => {
  const admin_user_id = req.user.user_id;
  try {
    const result = await pool.query(
      `UPDATE stipend_transaction
       SET status = 'PAID',
           confirmed_by_user = $1,
           confirmed_at = CURRENT_TIMESTAMP
       WHERE transaction_id = $2
         AND status = 'PENDING'
       RETURNING transaction_id, student_id, stipend_month, amount, status, confirmed_at`,
      [admin_user_id, req.params.transactionId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        ok: false,
        error: "Pending transaction not found for confirmation",
      });
    }
    await pool.query(
      `INSERT INTO admin_audit_log (admin_user_id, action_type, target_student_id, target_transaction_id, details)
       VALUES ($1, 'CONFIRM_STIPEND_PAYMENT', $2, $3, $4)`,
      [
        admin_user_id,
        result.rows[0].student_id,
        Number(req.params.transactionId),
        "Confirmed pending stipend as paid",
      ]
    );

    return res.json({
      ok: true,
      message: "Payment confirmed successfully.",
      data: result.rows[0],
    });
  } catch (error) {
    return res.status(400).json({ ok: false, error: error.message });
  }
});

app.get("/api/admin/reports/monthly", authenticate, requireAdmin, async (req, res) => {
  const month = req.query.month;
  if (!month) {
    return res.status(400).json({ ok: false, error: "month is required (YYYY-MM-01)" });
  }

  try {
    const result = await pool.query(
      `SELECT st.stipend_month,
              COUNT(*) AS total_transactions,
              COUNT(*) FILTER (WHERE st.status = 'PAID') AS paid_count,
              COUNT(*) FILTER (WHERE st.status = 'PENDING') AS pending_count,
              COUNT(*) FILTER (WHERE st.status = 'FAILED') AS failed_count,
              COALESCE(SUM(st.amount) FILTER (WHERE st.status = 'PAID'), 0) AS paid_total
       FROM stipend_transaction st
       WHERE st.stipend_month = $1
       GROUP BY st.stipend_month`,
      [month]
    );
    return res.json({ ok: true, data: result.rows[0] || null });
  } catch (error) {
    return res.status(400).json({ ok: false, error: error.message });
  }
});

app.get("/api/admin/audit/recent", authenticate, requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT l.audit_id, l.action_type, l.target_student_id, l.target_transaction_id, l.details, l.created_at,
              u.username AS admin_username
       FROM admin_audit_log l
       INNER JOIN app_user u ON u.user_id = l.admin_user_id
       ORDER BY l.created_at DESC
       LIMIT 50`
    );
    return res.json({ ok: true, data: result.rows });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/", (_req, res) => {
  return res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.get("/student", (_req, res) => {
  return res.sendFile(path.join(__dirname, "..", "public", "student.html"));
});

app.get("/admin", (_req, res) => {
  return res.sendFile(path.join(__dirname, "..", "public", "admin.html"));
});

app.listen(port, () => {
  console.log(`AAU backend listening on http://localhost:${port}`);
});
