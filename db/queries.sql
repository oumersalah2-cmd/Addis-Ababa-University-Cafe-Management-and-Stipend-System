-- ============================================================
-- AAU Café Management & Stipend System — SQL Queries
-- 10 Required Queries + Bonus (covering all JOIN types,
-- GROUP BY, subqueries, aggregation, DML, window functions)
-- ============================================================


-- ============================================================
-- Query 1 — Café Attendance with Student & Meal Details
-- Type: INNER JOIN
-- ============================================================
SELECT s.first_name || ' ' || s.last_name AS student_name,
       m.item_name, a.meal_type, a.meal_date
FROM Meal_Attendance a
    INNER JOIN Students s ON a.student_id = s.student_id
    INNER JOIN Menus    m ON a.menu_id    = m.menu_id
ORDER BY a.meal_date DESC, a.meal_type;


-- ============================================================
-- Query 2 — All Students with Their Cash Payment Status
-- Type: LEFT JOIN
-- ============================================================
SELECT s.first_name || ' ' || s.last_name AS student_name,
       d.department_name,
       cp.payment_month, cp.payment_year,
       COALESCE(cp.status::TEXT, 'NO RECORD') AS payment_status,
       cp.sent_at
FROM Students s
    LEFT JOIN Departments   d  ON s.department_id  = d.department_id
    LEFT JOIN Cash_Payments cp ON s.student_id     = cp.student_id
                               AND cp.payment_month = EXTRACT(MONTH FROM NOW())
                               AND cp.payment_year  = EXTRACT(YEAR  FROM NOW())
WHERE s.student_type = 'NON_CAFE'
  AND s.is_approved  = TRUE
ORDER BY cp.status NULLS LAST, s.last_name;


-- ============================================================
-- Query 3 — All Menus and Their Attendance Counts
-- Type: RIGHT JOIN
-- ============================================================
SELECT m.item_name, m.meal_type,
       COUNT(a.attendance_id)        AS total_ticks,
       COUNT(DISTINCT a.student_id)  AS unique_students
FROM Meal_Attendance a
    RIGHT JOIN Menus m ON a.menu_id = m.menu_id
GROUP BY m.menu_id, m.item_name, m.meal_type
ORDER BY total_ticks DESC;


-- ============================================================
-- Query 4 — Data Integrity Check: Orphan Records
-- Type: FULL OUTER JOIN
-- ============================================================
SELECT s.first_name || ' ' || s.last_name AS student_name,
       s.student_type, cp.payment_id, cp.status
FROM Students s
    FULL OUTER JOIN Cash_Payments cp ON s.student_id = cp.student_id
WHERE s.student_id IS NULL OR cp.payment_id IS NULL
ORDER BY s.student_type;


-- ============================================================
-- Query 5 — Monthly Payment Summary by Department
-- Type: GROUP BY + Aggregation
-- ============================================================
SELECT d.department_name,
       COUNT(cp.payment_id)                          AS total_payments,
       SUM(cp.amount)                                AS total_amount_sent,
       COUNT(*) FILTER (WHERE cp.status = 'PENDING') AS pending_count,
       COUNT(*) FILTER (WHERE cp.status = 'SENT')    AS sent_count
FROM Cash_Payments cp
    INNER JOIN Students    s ON cp.student_id   = s.student_id
    INNER JOIN Departments d ON s.department_id = d.department_id
WHERE cp.payment_year = EXTRACT(YEAR FROM NOW())
GROUP BY d.department_name
ORDER BY total_amount_sent DESC;


-- ============================================================
-- Query 6 — Students Who Have NOT Been Paid This Month
-- Type: Subquery
-- ============================================================
SELECT s.first_name || ' ' || s.last_name AS student_name,
       s.email, d.department_name
FROM Students s
    LEFT JOIN Departments d ON s.department_id = d.department_id
WHERE s.student_type = 'NON_CAFE'
  AND s.is_approved  = TRUE
  AND s.student_id NOT IN (
      SELECT student_id FROM Cash_Payments
      WHERE payment_month = EXTRACT(MONTH FROM NOW())
        AND payment_year  = EXTRACT(YEAR  FROM NOW())
        AND status = 'SENT'
  )
ORDER BY d.department_name, s.last_name;


-- ============================================================
-- Query 7 — Daily Café Attendance Dashboard
-- Type: Real-Time Query
-- ============================================================
SELECT meal_type,
       COUNT(DISTINCT student_id) AS students_attended,
       COUNT(attendance_id)       AS total_ticks
FROM Meal_Attendance
WHERE meal_date = CURRENT_DATE
GROUP BY meal_type
ORDER BY CASE meal_type
             WHEN 'BREAKFAST' THEN 1
             WHEN 'LUNCH'     THEN 2
             WHEN 'DINNER'    THEN 3
         END;


-- ============================================================
-- Query 8 — Confirm and Mark Payment as Sent
-- Type: UPDATE (DML)
-- ============================================================

-- Step 1: Confirm payment
UPDATE Cash_Payments
SET    status       = 'CONFIRMED',
       confirmed_by = 1,
       confirmed_at = NOW()
WHERE  student_id    = 2
  AND  payment_month = EXTRACT(MONTH FROM NOW())
  AND  payment_year  = EXTRACT(YEAR  FROM NOW());

-- Step 2: Mark as sent (money transferred)
UPDATE Cash_Payments
SET    status  = 'SENT',
       sent_at = NOW()
WHERE  student_id    = 2
  AND  payment_month = EXTRACT(MONTH FROM NOW())
  AND  payment_year  = EXTRACT(YEAR  FROM NOW());


-- ============================================================
-- Query 9 — Bulk Insert Monthly Payments + Audit Log
-- Type: INSERT (DML)
-- ============================================================

-- Step 1: Insert payment records for all eligible students
INSERT INTO Cash_Payments (student_id, amount, payment_month, payment_year, status)
SELECT student_id, 3000.00,
       EXTRACT(MONTH FROM NOW()),
       EXTRACT(YEAR  FROM NOW()),
       'PENDING'
FROM Students
WHERE student_type = 'NON_CAFE'
  AND is_approved  = TRUE
ON CONFLICT (student_id, payment_month, payment_year) DO NOTHING;

-- Step 2: Log the bulk insert
INSERT INTO Audit_Logs (actor_id, actor_type, action, target_table, new_value, logged_at)
VALUES (1, 'ADMIN', 'INSERT', 'Cash_Payments',
        'Bulk monthly payment records created for NON_CAFE students', NOW());


-- ============================================================
-- Query 10 — Year-by-Year Student Summary Report
-- Type: Analytics
-- ============================================================
SELECT year_enrolled,
       COUNT(*) FILTER (WHERE student_type = 'CAFE')     AS cafe_users,
       COUNT(*) FILTER (WHERE student_type = 'NON_CAFE') AS non_cafe_users,
       COUNT(*)                                           AS total_students,
       ROUND(COUNT(*) FILTER (WHERE student_type = 'CAFE')::NUMERIC
             / COUNT(*) * 100, 1)                        AS cafe_pct
FROM Students
WHERE is_approved = TRUE
GROUP BY year_enrolled
ORDER BY year_enrolled DESC;


-- ============================================================
-- Bonus Query — Full Student Payment History
-- Type: Multi-Year Analytics with Window Functions
-- ============================================================
SELECT s.first_name || ' ' || s.last_name AS student_name,
       d.department_name,
       cp.payment_year,
       COUNT(cp.payment_id)                         AS months_recorded,
       SUM(cp.amount)                               AS total_received,
       COUNT(*) FILTER (WHERE cp.status = 'SENT')    AS months_paid,
       COUNT(*) FILTER (WHERE cp.status = 'PENDING') AS months_pending,
       RANK() OVER (
           PARTITION BY cp.payment_year
           ORDER BY SUM(cp.amount) DESC
       ) AS rank_by_year
FROM Cash_Payments cp
    INNER JOIN Students    s ON cp.student_id   = s.student_id
    INNER JOIN Departments d ON s.department_id = d.department_id
GROUP BY s.student_id, s.first_name, s.last_name,
         d.department_name, cp.payment_year
ORDER BY cp.payment_year DESC, rank_by_year;
