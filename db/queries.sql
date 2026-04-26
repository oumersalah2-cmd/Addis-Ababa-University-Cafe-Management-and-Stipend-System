-- AAU Cafe Management System: 10 Complex Business Queries

-- 1. INSERT: Register a new student and assign them to a dormitory
-- Problem: Efficiently onboarding new students with their living arrangements.
INSERT INTO student (student_id, first_name, last_name, year_of_study, cafe_status, bank_account_number, dept_id, dorm_id)
VALUES ('UGR/5555/18', 'Solomon', 'Tekle', 1, 'CAFE', NULL, 1, 1);

-- 2. UPDATE: Change student status from CAFE to NON_CAFE
-- Problem: A student wants to switch to receiving money instead of eating at the cafe.
-- This requires adding a bank account and updating the status.
UPDATE student 
SET cafe_status = 'NON_CAFE', 
    bank_account_number = '1000777888999'
WHERE student_id = 'UGR/1001/18';

-- 3. DELETE: Remove meal logs older than 1 year
-- Problem: Database maintenance to keep the meal_log table from growing indefinitely.
DELETE FROM meal_log 
WHERE date_time < CURRENT_TIMESTAMP - INTERVAL '1 year';

-- 4. INNER JOIN: List all CAFE students with their Department and Dorm details
-- Problem: Generating a daily list for the kitchen staff to verify eligible students.
SELECT s.student_id, s.first_name, s.last_name, d.dept_name, dr.block_name, dr.room_number
FROM student s
INNER JOIN department d ON s.dept_id = d.dept_id
INNER JOIN dormitory dr ON s.dorm_id = dr.dorm_id
WHERE s.cafe_status = 'CAFE' AND s.is_approved = TRUE;

-- 5. LEFT JOIN: Identify students who haven't received their stipend for a specific month
-- Problem: Finance office needs to find "NON_CAFE" students missing their monthly payment.
SELECT s.student_id, s.first_name, s.last_name, st.amount, st.status
FROM student s
LEFT JOIN stipend_transaction st ON s.student_id = st.student_id AND st.stipend_month = '2026-04-01'
WHERE s.cafe_status = 'NON_CAFE' AND st.transaction_id IS NULL;

-- 6. RIGHT JOIN: Show all departments and the count of students in each (including empty ones)
-- Problem: Academic planning needs to see student distribution across all departments.
SELECT d.dept_name, COUNT(s.student_id) as student_count
FROM student s
RIGHT JOIN department d ON s.dept_id = d.dept_id
GROUP BY d.dept_name;

-- 7. FULL OUTER JOIN: Audit between student records and stipend transactions
-- Problem: Finding orphans (transactions without students) or students without any transaction history.
SELECT s.student_id, s.first_name, st.transaction_id, st.stipend_month
FROM student s
FULL OUTER JOIN stipend_transaction st ON s.student_id = st.student_id
WHERE s.student_id IS NULL OR st.transaction_id IS NULL;

-- 8. INNER JOIN + GROUP BY: Total meals served per department today
-- Problem: Kitchen manager needs to know which departments are the "heaviest" users for resource allocation.
SELECT d.dept_name, COUNT(ml.log_id) as total_meals
FROM meal_log ml
INNER JOIN student s ON ml.student_id = s.student_id
INNER JOIN department d ON s.dept_id = d.dept_id
WHERE ml.date_time::date = CURRENT_DATE
GROUP BY d.dept_name
ORDER BY total_meals DESC;

-- 9. JOIN + Subquery: Find CAFE students who have NOT eaten any meal today
-- Problem: Proactive identification of students who might be missing meals for health or welfare checks.
SELECT s.student_id, s.first_name, s.last_name
FROM student s
WHERE s.cafe_status = 'CAFE' 
AND s.student_id NOT IN (
    SELECT student_id 
    FROM meal_log 
    WHERE date_time::date = CURRENT_DATE
);

-- 10. Multi-Join Complex Report: Comprehensive Admin Student Dossier
-- Problem: Admin needs a full view of a student's status, including their last meal and total stipend received.
SELECT 
    s.student_id, 
    s.first_name || ' ' || s.last_name as full_name,
    d.dept_name,
    dr.block_name || ' Room ' || dr.room_number as dorm_info,
    (SELECT MAX(date_time) FROM meal_log WHERE student_id = s.student_id) as last_meal_time,
    COALESCE(SUM(st.amount), 0) as total_stipend_paid
FROM student s
JOIN department d ON s.dept_id = d.dept_id
JOIN dormitory dr ON s.dorm_id = dr.dorm_id
LEFT JOIN stipend_transaction st ON s.student_id = st.student_id AND st.status = 'PAID'
GROUP BY s.student_id, s.first_name, s.last_name, d.dept_name, dr.block_name, dr.room_number;
