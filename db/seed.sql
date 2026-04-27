-- AAU Cafe Management and Stipend System Mock Data
-- Exactly 10 records per core table

-- 1. Departments (6 records)
INSERT INTO department (dept_name) VALUES
('Software Engineering'),
('Civil Engineering'),
('Chemical Engineering'),
('Biomedical Engineering'),
('Electrical and Computer Engineering'),
('Mechanical Engineering');

-- 2. Dormitories (only Block A and Block B; students type dorm number)
INSERT INTO dormitory (block_name, dorm_number) VALUES
('A', 'A-101'),
('A', 'A-102'),
('A', 'A-201'),
('A', 'A-202'),
('B', 'B-101'),
('B', 'B-102'),
('B', 'B-201'),
('B', 'B-202'),
('B', 'B-301'),
('B', 'B-302');

-- 3. Students (10 records: 5 CAFE, 5 NON_CAFE)
INSERT INTO student (student_id, first_name, last_name, year_of_study, cafe_status, bank_account_number, dept_id, dorm_id, meal_card_number, is_approved, registered_by) VALUES
('UGR/1001/18', 'Abebe', 'Bikila', 3, 'CAFE', NULL, 1, 1, 'MC-10001', TRUE, 'ADMIN'),
('UGR/1002/18', 'Derartu', 'Tulu', 2, 'NON_CAFE', '1000123456789', 2, 2, NULL, TRUE, 'ADMIN'),
('UGR/1003/18', 'Haile', 'Gebrselassie', 4, 'CAFE', NULL, 5, 3, 'MC-10002', TRUE, 'ADMIN'),
('UGR/1004/18', 'Tirunesh', 'Dibaba', 1, 'NON_CAFE', '1000987654321', 6, 4, NULL, TRUE, 'ADMIN'),
('UGR/1005/18', 'Kenenisa', 'Bekele', 5, 'CAFE', NULL, 3, 5, 'MC-10003', TRUE, 'ADMIN'),
('UGR/1006/18', 'Meseret', 'Defar', 3, 'NON_CAFE', '1000554433221', 4, 6, NULL, TRUE, 'ADMIN'),
('UGR/1007/18', 'Sileshi', 'Sihine', 2, 'CAFE', NULL, 2, 7, 'MC-10004', FALSE, 'ADMIN'),
('UGR/1008/18', 'Genzebe', 'Dibaba', 1, 'NON_CAFE', '1000112233445', 1, 8, NULL, TRUE, 'ADMIN'),
('UGR/1009/18', 'Lamecha', 'Girma', 4, 'CAFE', NULL, 5, 9, 'MC-10005', TRUE, 'ADMIN'),
('UGR/1010/18', 'Letesenbet', 'Gidey', 2, 'NON_CAFE', '1000998877665', 6, 10, NULL, TRUE, 'ADMIN');

-- App Users (For Auth - linking to some students)
INSERT INTO app_user (username, password_hash, role, student_id) VALUES
('admin', '$2b$10$OjUMAwKU1b4.DqXoVwLPOeMRFx1RtQBoubvsWa1yXRe5oXvZe2.32', 'ADMIN', NULL),
('abebe1001', '$2b$10$Uk5ZjvaKnq.IqVXjqBzzZeMD3y314Klg5PQBMC0KX0C04dslEhoau', 'STUDENT', 'UGR/1001/18'),
('derartu1002', '$2b$10$Uk5ZjvaKnq.IqVXjqBzzZeMD3y314Klg5PQBMC0KX0C04dslEhoau', 'STUDENT', 'UGR/1002/18');

-- 4. Meal Logs (10 records)
INSERT INTO meal_log (student_id, date_time, meal_type) VALUES
('UGR/1001/18', '2026-04-24 07:30:00', 'BREAKFAST'),
('UGR/1001/18', '2026-04-24 12:45:00', 'LUNCH'),
('UGR/1003/18', '2026-04-24 08:00:00', 'BREAKFAST'),
('UGR/1005/18', '2026-04-24 13:00:00', 'LUNCH'),
('UGR/1009/18', '2026-04-24 19:15:00', 'DINNER'),
('UGR/1001/18', '2026-04-23 18:30:00', 'DINNER'),
('UGR/1003/18', '2026-04-23 12:00:00', 'LUNCH'),
('UGR/1005/18', '2026-04-23 07:15:00', 'BREAKFAST'),
('UGR/1009/18', '2026-04-23 12:30:00', 'LUNCH'),
('UGR/1001/18', '2026-04-22 07:45:00', 'BREAKFAST');

-- 5. Stipend Transactions (10 records) - cost sharing is 3000 monthly
INSERT INTO stipend_transaction (student_id, stipend_month, amount, status) VALUES
('UGR/1002/18', '2026-04-01', 3000.00, 'PAID'),
('UGR/1004/18', '2026-04-01', 3000.00, 'PAID'),
('UGR/1006/18', '2026-04-01', 3000.00, 'PENDING'),
('UGR/1008/18', '2026-04-01', 3000.00, 'PENDING'),
('UGR/1010/18', '2026-04-01', 3000.00, 'FAILED'),
('UGR/1002/18', '2026-03-01', 3000.00, 'PAID'),
('UGR/1004/18', '2026-03-01', 3000.00, 'PAID'),
('UGR/1006/18', '2026-03-01', 3000.00, 'PAID'),
('UGR/1008/18', '2026-03-01', 3000.00, 'PAID'),
('UGR/1010/18', '2026-03-01', 3000.00, 'PAID');

-- 6. Menu Items (10 records)
INSERT INTO menu_item (item_name, description, price, category) VALUES
('Injera with Shiro', 'Traditional Ethiopian chickpea stew', 0.00, 'Lunch'),
('Firfir', 'Spiced shredded injera', 0.00, 'Breakfast'),
('Tibs', 'Sautéed meat with onions and peppers', 0.00, 'Dinner'),
('Pasta with Tomato Sauce', 'Simple Italian style pasta', 0.00, 'Lunch'),
('Lentil Soup', 'Nutritious lentil stew', 0.00, 'Dinner'),
('Bread with Jam', 'Classic breakfast option', 0.00, 'Breakfast'),
('Fruit Salad', 'Fresh seasonal fruits', 25.00, 'Snack'),
('Coffee', 'Premium Ethiopian coffee', 15.00, 'Drink'),
('Tea', 'Hot black tea', 10.00, 'Drink'),
('Samosa', 'Crispy pastry with lentil filling', 10.00, 'Snack');

-- 7. Cafe Orders (10 records)
INSERT INTO cafe_order (student_id, status, total_amount, is_cafe_meal) VALUES
('UGR/1001/18', 'COMPLETED', 0.00, TRUE),
('UGR/1003/18', 'COMPLETED', 0.00, TRUE),
('UGR/1005/18', 'READY', 0.00, TRUE),
('UGR/1009/18', 'PREPARING', 0.00, TRUE),
('UGR/1001/18', 'PENDING', 0.00, TRUE),
('UGR/1002/18', 'COMPLETED', 40.00, FALSE),
('UGR/1004/18', 'READY', 25.00, FALSE),
('UGR/1006/18', 'PREPARING', 15.00, FALSE),
('UGR/1008/18', 'PENDING', 10.00, FALSE),
('UGR/1010/18', 'CANCELLED', 0.00, FALSE);

-- 8. Order Items (Linking orders to menu)
INSERT INTO order_item (order_id, item_id, quantity) VALUES
(1, 1, 1),
(2, 2, 1),
(3, 3, 1),
(4, 4, 1),
(5, 5, 1),
(6, 7, 1),
(6, 8, 1),
(7, 7, 1),
(8, 8, 1),
(9, 9, 1);
