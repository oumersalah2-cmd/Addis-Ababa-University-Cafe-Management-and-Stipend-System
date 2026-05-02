-- ============================================================
-- AAU Café Management & Stipend System — Seed Data
-- ============================================================

-- Departments
INSERT INTO Departments (department_name, college) VALUES
    ('Software Engineering',              'CTBE'),
    ('Electrical & Computer Engineering', 'CTBE'),
    ('Civil Engineering',                 'CTBE'),
    ('Chemical Engineering',              'CTBE'),
    ('Mechanical Engineering',            'CTBE');

-- Dormitories
INSERT INTO Dormitories (dorm_name, block, gender_type, total_rooms) VALUES
    ('Dorm Block A', 'A', 'Male',   60),
    ('Dorm Block B', 'B', 'Male',   60),
    ('Dorm Block C', 'C', 'Female', 50),
    ('Dorm Block D', 'D', 'Female', 50);

-- Admins (password: Admin123)
INSERT INTO Admins (full_name, email, password_hash, role) VALUES
    ('Kassahun Abdissa', 'kassahun@aau.edu.et',
     '$2b$10$DQ4fpdqjx4rc.1mZGRdsa.GF1BUzmExSqaWanXUQc2mSOCOe4Wtwu', 'SUPER_ADMIN'),
    ('Cafe Manager', 'cafe@aau.edu.et',
     '$2b$10$DQ4fpdqjx4rc.1mZGRdsa.GF1BUzmExSqaWanXUQc2mSOCOe4Wtwu', 'CAFE_MANAGER');

-- Menus (3 meals per day — price 0 for café students)
INSERT INTO Menus (item_name, description, meal_type, price, is_available) VALUES
    ('Kinche',            'Traditional barley porridge',          'BREAKFAST', 0.00, TRUE),
    ('Firfir',            'Shredded injera with spiced butter',   'BREAKFAST', 0.00, TRUE),
    ('Chechebsa',         'Flatbread with spiced butter',         'BREAKFAST', 0.00, TRUE),
    ('Shiro Wot',         'Chickpea stew with injera',            'LUNCH',     0.00, TRUE),
    ('Injera with Tibs',  'Sautéed meat with injera',             'LUNCH',     0.00, TRUE),
    ('Beyaynetu',         'Mixed vegetable platter',              'LUNCH',     0.00, TRUE),
    ('Pasta',             'Spaghetti with tomato sauce',           'DINNER',    0.00, TRUE),
    ('Rice with Chicken', 'Steamed rice with chicken stew',        'DINNER',    0.00, TRUE),
    ('Misir Wot',         'Red lentil stew with injera',           'DINNER',    0.00, TRUE);

-- Students (password: Student123)
INSERT INTO Students
    (first_name, last_name, email, password_hash, gender,
     year_of_study, year_enrolled, student_type, department_id, dormitory_id, is_approved)
VALUES
    ('Abel',   'Tesfaye',  'abel@stu.aau.et',
     '$2b$10$XGN6LFe.x/sUdQgYQ.06Be3fBphLz4WDIF5vtgJOQTeqkC2JPZp8y',
     'Male',   4, 2023, 'CAFE',     1, 1, TRUE),
    ('Hana',   'Mekonnen', 'hana@stu.aau.et',
     '$2b$10$XGN6LFe.x/sUdQgYQ.06Be3fBphLz4WDIF5vtgJOQTeqkC2JPZp8y',
     'Female', 2, 2025, 'NON_CAFE', 2, 3, TRUE),
    ('Dawit',  'Alemu',    'dawit@stu.aau.et',
     '$2b$10$XGN6LFe.x/sUdQgYQ.06Be3fBphLz4WDIF5vtgJOQTeqkC2JPZp8y',
     'Male',   3, 2024, 'CAFE',     4, 2, TRUE),
    ('Saron',  'Tadesse',  'saron@stu.aau.et',
     '$2b$10$XGN6LFe.x/sUdQgYQ.06Be3fBphLz4WDIF5vtgJOQTeqkC2JPZp8y',
     'Female', 1, 2026, 'NON_CAFE', 3, 4, TRUE),
    ('Abebe',  'Kebede',   'abebe@stu.aau.et',
     '$2b$10$XGN6LFe.x/sUdQgYQ.06Be3fBphLz4WDIF5vtgJOQTeqkC2JPZp8y',
     'Male',   2, 2025, 'CAFE',     1, 1, FALSE);

-- Cash payments for NON_CAFE students
INSERT INTO Cash_Payments
    (student_id, amount, payment_month, payment_year, status, confirmed_by, confirmed_at, sent_at)
VALUES
    (2, 3000.00, 4, 2026, 'SENT',      1, NOW(), NOW()),
    (2, 3000.00, 3, 2026, 'SENT',      1, NOW(), NOW()),
    (2, 3000.00, 2, 2026, 'CONFIRMED', 1, NOW(), NULL),
    (4, 3000.00, 4, 2026, 'PENDING',   NULL, NULL, NULL),
    (4, 3000.00, 3, 2026, 'SENT',      1, NOW(), NOW());

-- Meal attendance for CAFE students
INSERT INTO Meal_Attendance (student_id, menu_id, meal_date, meal_type) VALUES
    (1, 1, CURRENT_DATE, 'BREAKFAST'),
    (1, 4, CURRENT_DATE, 'LUNCH'),
    (3, 2, CURRENT_DATE, 'BREAKFAST');

-- Audit log entries
INSERT INTO Audit_Logs (actor_id, actor_type, action, target_table, target_id, new_value)
VALUES
    (1, 'ADMIN', 'INSERT', 'Students', 1, 'Approved student Abel Tesfaye'),
    (1, 'ADMIN', 'INSERT', 'Cash_Payments', 1, 'Created monthly payment for Hana Mekonnen'),
    (1, 'ADMIN', 'UPDATE', 'Cash_Payments', 1, 'Confirmed payment and marked as SENT');
