DROP TABLE IF EXISTS stipend_transaction;
DROP TABLE IF EXISTS meal_log;
DROP TABLE IF EXISTS admin_audit_log;
DROP TABLE IF EXISTS app_user;
DROP TABLE IF EXISTS student;
DROP TABLE IF EXISTS department;
DROP TYPE IF EXISTS user_role_enum;
DROP TYPE IF EXISTS cafe_status_enum;
DROP TYPE IF EXISTS meal_type_enum;
DROP TYPE IF EXISTS stipend_status_enum;
DROP TYPE IF EXISTS dorm_block_enum;

CREATE TYPE user_role_enum AS ENUM ('STUDENT', 'ADMIN');
CREATE TYPE cafe_status_enum AS ENUM ('CAFE', 'NON_CAFE');
CREATE TYPE meal_type_enum AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER');
CREATE TYPE stipend_status_enum AS ENUM ('PENDING', 'PAID', 'FAILED');
CREATE TYPE dorm_block_enum AS ENUM ('A', 'B');

CREATE TABLE department (
  dept_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dept_name VARCHAR(120) NOT NULL UNIQUE
);

CREATE TABLE student (
  student_id VARCHAR(20) PRIMARY KEY,
  first_name VARCHAR(60) NOT NULL,
  last_name VARCHAR(60) NOT NULL,
  year_of_study INT NOT NULL CHECK (year_of_study BETWEEN 1 AND 7),
  dept_id INT NOT NULL REFERENCES department(dept_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  cafe_status cafe_status_enum NOT NULL,
  bank_account_number VARCHAR(30),
  dorm_block dorm_block_enum NOT NULL,
  floor_number INT NOT NULL CHECK (floor_number >= 0),
  dorm_number VARCHAR(20) NOT NULL,
  registered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_approved BOOLEAN NOT NULL DEFAULT FALSE,
  CHECK (
    (cafe_status = 'NON_CAFE' AND bank_account_number IS NOT NULL)
    OR
    (cafe_status = 'CAFE' AND bank_account_number IS NULL)
  )
);

CREATE TABLE app_user (
  user_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username VARCHAR(60) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role user_role_enum NOT NULL,
  student_id VARCHAR(20) UNIQUE REFERENCES student(student_id) ON UPDATE CASCADE ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (role = 'STUDENT' AND student_id IS NOT NULL)
    OR
    (role = 'ADMIN' AND student_id IS NULL)
  )
);

CREATE TABLE admin_audit_log (
  audit_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_user_id BIGINT NOT NULL REFERENCES app_user(user_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  action_type VARCHAR(40) NOT NULL,
  target_student_id VARCHAR(20),
  target_transaction_id BIGINT,
  details TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE meal_log (
  log_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id VARCHAR(20) NOT NULL REFERENCES student(student_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  date_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  meal_type meal_type_enum NOT NULL,
  UNIQUE (student_id, (date_time::date), meal_type)
);

CREATE TABLE stipend_transaction (
  transaction_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id VARCHAR(20) NOT NULL REFERENCES student(student_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  stipend_month DATE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  status stipend_status_enum NOT NULL DEFAULT 'PENDING',
  confirmed_by_user BIGINT REFERENCES app_user(user_id) ON UPDATE CASCADE ON DELETE SET NULL,
  confirmed_at TIMESTAMP,
  CHECK (date_trunc('month', stipend_month) = stipend_month),
  UNIQUE (student_id, stipend_month),
  CHECK (
    (status <> 'PAID')
    OR
    (status = 'PAID' AND confirmed_by_user IS NOT NULL AND confirmed_at IS NOT NULL)
  )
);
