-- 1) Pending approvals for admin dashboard
SELECT s.student_id, s.first_name, s.last_name, d.dept_name, s.registered_at
FROM student s
INNER JOIN department d ON d.dept_id = s.dept_id
WHERE s.is_approved = FALSE
ORDER BY s.registered_at ASC;

-- 2) Monthly stipend status summary
SELECT stipend_month, status, COUNT(*) AS tx_count, SUM(amount) AS total_amount
FROM stipend_transaction
GROUP BY stipend_month, status
ORDER BY stipend_month, status;

-- 3) Students with no stipend created for a month
SELECT s.student_id, s.first_name, s.last_name
FROM student s
LEFT JOIN stipend_transaction st
  ON st.student_id = s.student_id
 AND st.stipend_month = DATE '2026-05-01'
WHERE s.cafe_status = 'NON_CAFE' AND st.transaction_id IS NULL;

-- 4) Verify one stipend row per month per student (should return zero rows)
SELECT student_id, stipend_month, COUNT(*) AS duplicated_rows
FROM stipend_transaction
GROUP BY student_id, stipend_month
HAVING COUNT(*) > 1;
