const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { pool } = require("./db");

const app = express();
const port = Number(process.env.PORT || 4000);
const jwtSecret = process.env.JWT_SECRET || "change_me_in_env";
const loginAttempts = new Map();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

const uploadsDir = path.join(__dirname, "..", "public", "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use("/uploads", express.static(uploadsDir));

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const safeExt = path.extname(file.originalname || "").slice(0, 10) || ".bin";
      cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${safeExt}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
});

async function getStudentSnapshot(studentId) {
  const result = await pool.query(
    `SELECT student_id, cafe_status, is_approved, meal_card_number
     FROM student
     WHERE student_id = $1`,
    [studentId]
  );
  return result.rows[0] || null;
}

async function findOrCreateDormitory(client, block_name, dorm_number) {
  const block = String(block_name || "").trim().toUpperCase();
  const dorm = String(dorm_number || "").trim().toUpperCase();
  if (!["A", "B"].includes(block)) throw new Error("Dorm block must be A or B");
  if (!dorm) return null;

  const existing = await client.query(
    `SELECT dorm_id FROM dormitory WHERE block_name = $1 AND dorm_number = $2`,
    [block, dorm]
  );
  if (existing.rowCount) return existing.rows[0].dorm_id;

  const inserted = await client.query(
    `INSERT INTO dormitory (block_name, dorm_number) VALUES ($1, $2) RETURNING dorm_id`,
    [block, dorm]
  );
  return inserted.rows[0].dorm_id;
}

function generateMealCardNumber() {
  return `MC-${Math.floor(100000 + Math.random() * 900000)}`;
}

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

app.get("/api/dormitories", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT dorm_id, block_name, dorm_number
       FROM dormitory
       ORDER BY block_name ASC, dorm_number ASC`
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

    const resolvedDormId = await findOrCreateDormitory(client, dorm_block, dorm_number);
    const normalizedCafeStatus = String(cafe_status || "").toUpperCase();

    let mealCardNumber = null;
    if (normalizedCafeStatus === "CAFE") {
      // retry a few times in case of rare collisions
      for (let i = 0; i < 5; i += 1) {
        const candidate = generateMealCardNumber();
        const exists = await client.query(`SELECT 1 FROM student WHERE meal_card_number = $1`, [candidate]);
        if (exists.rowCount === 0) {
          mealCardNumber = candidate;
          break;
        }
      }
      if (!mealCardNumber) throw new Error("Could not generate meal card number. Please try again.");
    }

    const values = [
      student_id,
      first_name,
      last_name,
      year_of_study,
      dept_id,
      normalizedCafeStatus,
      bank_account_number || null,
      resolvedDormId,
      mealCardNumber,
      'SELF', // registered_by
    ];

    const studentResult = await client.query(
      `INSERT INTO student (
        student_id, first_name, last_name, year_of_study, dept_id,
        cafe_status, bank_account_number, dorm_id, meal_card_number, registered_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING student_id, first_name, last_name, cafe_status, meal_card_number, is_approved, registered_at`,
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
              s.bank_account_number, s.meal_card_number, dr.block_name, dr.dorm_number,
              s.is_approved, d.dept_name
       FROM student s
       INNER JOIN department d ON d.dept_id = s.dept_id
       LEFT JOIN dormitory dr ON dr.dorm_id = s.dorm_id
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

app.get("/api/students/notifications", authenticate, requireStudent, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT notification_id, title, message, is_read, created_at
       FROM student_notification
       WHERE student_id = $1
       ORDER BY created_at DESC`,
      [req.user.student_id]
    );
    return res.json({ ok: true, data: result.rows });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.patch("/api/students/notifications/:notificationId/read", authenticate, requireStudent, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE student_notification
       SET is_read = TRUE
       WHERE notification_id = $1 AND student_id = $2
       RETURNING notification_id`,
      [req.params.notificationId, req.user.student_id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, error: "Notification not found" });
    }
    return res.json({ ok: true, message: "Notification marked as read" });
  } catch (error) {
    return res.status(400).json({ ok: false, error: error.message });
  }
});

app.get("/api/admin/students/pending", authenticate, requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.student_id, s.first_name, s.last_name, s.cafe_status, s.registered_at, d.dept_name
       FROM student s
       INNER JOIN department d ON d.dept_id = s.dept_id
       WHERE s.is_approved = FALSE AND s.registered_by = 'SELF'
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
  const { student_id, stipend_month } = req.body;
  try {
    const student = await getStudentSnapshot(student_id);
    if (!student) {
      return res.status(404).json({ ok: false, error: "Student not found" });
    }
    if (!student.is_approved) {
      return res.status(400).json({ ok: false, error: "Student is not approved yet." });
    }
    if (student.cafe_status !== "NON_CAFE") {
      return res.status(400).json({ ok: false, error: "Only NON_CAFE students can receive stipends." });
    }

    const result = await pool.query(
      `INSERT INTO stipend_transaction (student_id, stipend_month, amount, status)
       VALUES ($1, $2, 3000.00, 'PENDING')
       RETURNING transaction_id, student_id, stipend_month, amount, status`,
      [student_id, stipend_month]
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

    // Notify the student
    await pool.query(
      `INSERT INTO student_notification (student_id, title, message)
       VALUES ($1, 'Stipend Payment Confirmed', 'Your stipend payment for ${result.rows[0].stipend_month.slice(0, 7)} has been confirmed and sent to your bank account.')`,
      [result.rows[0].student_id]
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

// --- Menu API ---
app.get("/api/menu", async (_req, res) => {
  try {
    const result = await pool.query("SELECT * FROM menu_item WHERE is_available = TRUE ORDER BY category, item_name");
    return res.json({ ok: true, data: result.rows });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/api/admin/menu", authenticate, requireAdmin, async (req, res) => {
  const { item_name, description, price, category } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO menu_item (item_name, description, price, category) VALUES ($1, $2, $3, $4) RETURNING *",
      [item_name, description, price, category]
    );
    return res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.patch("/api/admin/menu/:itemId", authenticate, requireAdmin, async (req, res) => {
  const { item_name, description, price, category, is_available } = req.body;
  try {
    const result = await pool.query(
      `UPDATE menu_item 
       SET item_name = COALESCE($1, item_name), 
           description = COALESCE($2, description), 
           price = COALESCE($3, price), 
           category = COALESCE($4, category),
           is_available = COALESCE($5, is_available)
       WHERE item_id = $6 RETURNING *`,
      [item_name, description, price, category, is_available, req.params.itemId]
    );
    if (result.rowCount === 0) return res.status(404).json({ ok: false, error: "Item not found" });
    return res.json({ ok: true, data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// --- Orders API ---
app.post("/api/orders", authenticate, requireStudent, async (req, res) => {
  const { items, total_amount, is_cafe_meal } = req.body;
  // items: [{ item_id, quantity }]
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const student = await getStudentSnapshot(req.user.student_id);
    if (!student) {
      await client.query("ROLLBACK");
      return res.status(404).json({ ok: false, error: "Student profile not found" });
    }
    if (!student.is_approved) {
      await client.query("ROLLBACK");
      return res.status(403).json({ ok: false, error: "Your account is not approved yet." });
    }
    if (is_cafe_meal && student.cafe_status !== "CAFE") {
      await client.query("ROLLBACK");
      return res.status(400).json({ ok: false, error: "Only CAFE students can place cafe-meal orders." });
    }
    if (!is_cafe_meal && student.cafe_status === "CAFE") {
      await client.query("ROLLBACK");
      return res.status(400).json({ ok: false, error: "CAFE students cannot place cost-sharing (paid) orders." });
    }
    
    // Create Order
    const orderResult = await client.query(
      "INSERT INTO cafe_order (student_id, total_amount, is_cafe_meal) VALUES ($1, $2, $3) RETURNING *",
      [req.user.student_id, total_amount, is_cafe_meal]
    );
    const orderId = orderResult.rows[0].order_id;

    // Create Order Items
    for (const item of items) {
      await client.query(
        "INSERT INTO order_item (order_id, item_id, quantity) VALUES ($1, $2, $3)",
        [orderId, item.item_id, item.quantity]
      );
    }

    await client.query("COMMIT");
    return res.status(201).json({ ok: true, data: orderResult.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(500).json({ ok: false, error: error.message });
  } finally {
    client.release();
  }
});

app.get("/api/orders/me", authenticate, requireStudent, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.*, 
              (SELECT json_agg(json_build_object('item_name', mi.item_name, 'quantity', oi.quantity))
               FROM order_item oi 
               JOIN menu_item mi ON mi.item_id = oi.item_id 
               WHERE oi.order_id = o.order_id) as items
       FROM cafe_order o 
       WHERE o.student_id = $1 
       ORDER BY o.order_time DESC`,
      [req.user.student_id]
    );
    return res.json({ ok: true, data: result.rows });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Kitchen Dashboard API
app.get("/api/admin/orders/active", authenticate, requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.*, s.first_name, s.last_name,
              (SELECT json_agg(json_build_object('item_name', mi.item_name, 'quantity', oi.quantity))
               FROM order_item oi 
               JOIN menu_item mi ON mi.item_id = oi.item_id 
               WHERE oi.order_id = o.order_id) as items
       FROM cafe_order o
       JOIN student s ON s.student_id = o.student_id
       WHERE o.status IN ('PENDING', 'PREPARING', 'READY')
       ORDER BY o.order_time ASC`
    );
    return res.json({ ok: true, data: result.rows });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.patch("/api/admin/orders/:orderId/status", authenticate, requireAdmin, async (req, res) => {
  const { status } = req.body;
  try {
    const result = await pool.query(
      "UPDATE cafe_order SET status = $1 WHERE order_id = $2 RETURNING *",
      [status, req.params.orderId]
    );
    if (result.rowCount === 0) return res.status(404).json({ ok: false, error: "Order not found" });
    return res.json({ ok: true, data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// --- Student feedback / complaints ---
app.post("/api/feedback", authenticate, requireStudent, upload.single("photo"), async (req, res) => {
  const category = String(req.body.category || "").toUpperCase();
  const message = String(req.body.message || "").trim();
  if (!["FOOD", "PAYMENT"].includes(category)) {
    return res.status(400).json({ ok: false, error: "category must be FOOD or PAYMENT" });
  }
  if (!message) {
    return res.status(400).json({ ok: false, error: "message is required" });
  }

  try {
    const student = await getStudentSnapshot(req.user.student_id);
    if (!student) return res.status(404).json({ ok: false, error: "Student profile not found" });
    if (!student.is_approved) return res.status(403).json({ ok: false, error: "Your account is not approved yet." });

    const photo_path = req.file ? `/uploads/${req.file.filename}` : null;
    const result = await pool.query(
      `INSERT INTO student_feedback (student_id, category, message, photo_path)
       VALUES ($1, $2, $3, $4)
       RETURNING feedback_id, category, message, photo_path, status, created_at`,
      [req.user.student_id, category, message, photo_path]
    );
    return res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/api/feedback/me", authenticate, requireStudent, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT feedback_id, category, message, photo_path, status, admin_note, created_at, updated_at
       FROM student_feedback
       WHERE student_id = $1
       ORDER BY created_at DESC
       LIMIT 30`,
      [req.user.student_id]
    );
    return res.json({ ok: true, data: result.rows });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/api/admin/feedback/recent", authenticate, requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT f.feedback_id, f.category, f.message, f.photo_path, f.status, f.admin_note, f.created_at,
              s.student_id, s.first_name, s.last_name, s.cafe_status
       FROM student_feedback f
       INNER JOIN student s ON s.student_id = f.student_id
       ORDER BY f.created_at DESC
       LIMIT 50`
    );
    return res.json({ ok: true, data: result.rows });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.patch("/api/admin/feedback/:feedbackId", authenticate, requireAdmin, async (req, res) => {
  const { status, admin_note } = req.body;
  const nextStatus = status ? String(status).toUpperCase() : null;
  if (nextStatus && !["OPEN", "IN_REVIEW", "RESOLVED"].includes(nextStatus)) {
    return res.status(400).json({ ok: false, error: "status must be OPEN, IN_REVIEW, or RESOLVED" });
  }
  try {
    const result = await pool.query(
      `UPDATE student_feedback
       SET status = COALESCE($1, status),
           admin_note = COALESCE($2, admin_note),
           updated_at = CURRENT_TIMESTAMP
       WHERE feedback_id = $3
       RETURNING feedback_id, status, admin_note, updated_at`,
      [nextStatus, admin_note || null, req.params.feedbackId]
    );
    if (!result.rowCount) return res.status(404).json({ ok: false, error: "Feedback not found" });
    return res.json({ ok: true, data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// --- Meal logging (CAFE students) ---
app.post("/api/meals/log", authenticate, requireStudent, async (req, res) => {
  const { meal_type } = req.body;
  const allowed = new Set(["BREAKFAST", "LUNCH", "DINNER"]);
  if (!allowed.has(String(meal_type || "").toUpperCase())) {
    return res.status(400).json({ ok: false, error: "meal_type must be BREAKFAST, LUNCH, or DINNER" });
  }

  try {
    const student = await getStudentSnapshot(req.user.student_id);
    if (!student) {
      return res.status(404).json({ ok: false, error: "Student profile not found" });
    }
    if (!student.is_approved) {
      return res.status(403).json({ ok: false, error: "Your account is not approved yet." });
    }
    if (student.cafe_status !== "CAFE") {
      return res.status(400).json({ ok: false, error: "Only CAFE students can log meals." });
    }

    const result = await pool.query(
      `INSERT INTO meal_log (student_id, meal_type)
       VALUES ($1, $2)
       RETURNING log_id, date_time, meal_type`,
      [req.user.student_id, String(meal_type).toUpperCase()]
    );
    return res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (error) {
    if (error && error.code === "23505") {
      return res.status(400).json({ ok: false, error: "You already logged this meal for today." });
    }
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

app.get("/kitchen", (_req, res) => {
  return res.sendFile(path.join(__dirname, "..", "public", "kitchen.html"));
});

app.use((req, res) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
    res.sendFile(path.join(__dirname, "..", "public", "index.html"));
  } else {
    res.status(404).json({ error: 'Not Found' });
  }
});

app.listen(port, () => {
  console.log(`AAU backend listening on http://localhost:${port}`);
});
