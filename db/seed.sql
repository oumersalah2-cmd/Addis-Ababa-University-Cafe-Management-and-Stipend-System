INSERT INTO department (dept_name) VALUES
('Civil Engineering'),
('Software Engineering'),
('Electrical and Computer Engineering'),
('Mechanical Engineering'),
('Biomedical Engineering'),
('Chemical Engineering');

INSERT INTO student (
  student_id, first_name, last_name, year_of_study, dept_id,
  cafe_status, bank_account_number, dorm_block, floor_number, dorm_number, is_approved
) VALUES
('UGR/2001/18', 'Abel', 'Getachew', 1, 2, 'NON_CAFE', '10009988776655', 'A', 2, 'A-214', TRUE),
('UGR/2002/18', 'Sara', 'Teshome', 1, 1, 'CAFE', NULL, 'B', 1, 'B-109', TRUE),
('UGR/2003/18', 'Nahom', 'Kebede', 2, 3, 'CAFE', NULL, 'A', 3, 'A-301', FALSE),
('UGR/2004/18', 'Betelhem', 'Wolde', 3, 4, 'NON_CAFE', '10006789012345', 'B', 2, 'B-206', TRUE),
('UGR/2005/18', 'Dagmawi', 'Mekonen', 4, 5, 'NON_CAFE', '10004321098765', 'A', 4, 'A-410', TRUE);

INSERT INTO app_user (username, password_hash, role, student_id) VALUES
('admin_main', '$2b$10$OjUMAwKU1b4.DqXoVwLPOeMRFx1RtQBoubvsWa1yXRe5oXvZe2.32', 'ADMIN', NULL),
('abel2001', '$2b$10$Uk5ZjvaKnq.IqVXjqBzzZeMD3y314Klg5PQBMC0KX0C04dslEhoau', 'STUDENT', 'UGR/2001/18'),
('sara2002', '$2b$10$Uk5ZjvaKnq.IqVXjqBzzZeMD3y314Klg5PQBMC0KX0C04dslEhoau', 'STUDENT', 'UGR/2002/18');

INSERT INTO meal_log (student_id, date_time, meal_type) VALUES
('UGR/2002/18', '2026-04-20 07:30:00', 'BREAKFAST'),
('UGR/2002/18', '2026-04-20 12:15:00', 'LUNCH'),
('UGR/2003/18', '2026-04-20 18:05:00', 'DINNER');

INSERT INTO stipend_transaction (
  student_id, stipend_month, amount, status, confirmed_by_user, confirmed_at
) VALUES
('UGR/2001/18', '2026-04-01', 1800.00, 'PAID', 1, CURRENT_TIMESTAMP),
('UGR/2004/18', '2026-04-01', 1800.00, 'PENDING', NULL, NULL),
('UGR/2005/18', '2026-04-01', 1800.00, 'PENDING', NULL, NULL);
