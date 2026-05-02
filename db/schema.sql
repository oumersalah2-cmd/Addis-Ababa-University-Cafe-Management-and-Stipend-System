-- ============================================================
-- AAU Café Management & Stipend System — Database Schema
-- Addis Ababa University · 5 Kilo Campus
-- Fundamentals of Database · Group Project 2026
-- ============================================================

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS Audit_Logs CASCADE;
DROP TABLE IF EXISTS Cash_Payments CASCADE;
DROP TABLE IF EXISTS Meal_Attendance CASCADE;
DROP TABLE IF EXISTS Menus CASCADE;
DROP TABLE IF EXISTS Students CASCADE;
DROP TABLE IF EXISTS Admins CASCADE;
DROP TABLE IF EXISTS Dormitories CASCADE;
DROP TABLE IF EXISTS Departments CASCADE;
-- Drop any leftover tables from previous schema versions
DROP TABLE IF EXISTS order_item CASCADE;
DROP TABLE IF EXISTS cafe_order CASCADE;
DROP TABLE IF EXISTS menu_item CASCADE;
DROP TABLE IF EXISTS stipend_transaction CASCADE;
DROP TABLE IF EXISTS meal_log CASCADE;
DROP TABLE IF EXISTS student_feedback CASCADE;
DROP TABLE IF EXISTS student_notification CASCADE;
DROP TABLE IF EXISTS admin_audit_log CASCADE;
DROP TABLE IF EXISTS app_user CASCADE;
DROP TABLE IF EXISTS student CASCADE;
DROP TABLE IF EXISTS dormitory CASCADE;
DROP TABLE IF EXISTS department CASCADE;

-- Drop custom ENUM types
DROP TYPE IF EXISTS student_type_enum CASCADE;
DROP TYPE IF EXISTS meal_type_enum CASCADE;
DROP TYPE IF EXISTS payment_status_enum CASCADE;
DROP TYPE IF EXISTS admin_role_enum CASCADE;
DROP TYPE IF EXISTS gender_enum CASCADE;
-- Also drop any leftover types from previous schema versions
DROP TYPE IF EXISTS user_role_enum CASCADE;
DROP TYPE IF EXISTS cafe_status_enum CASCADE;
DROP TYPE IF EXISTS stipend_status_enum CASCADE;
DROP TYPE IF EXISTS feedback_category_enum CASCADE;
DROP TYPE IF EXISTS feedback_status_enum CASCADE;
DROP TYPE IF EXISTS registered_by_enum CASCADE;
DROP TYPE IF EXISTS order_status_enum CASCADE;

-- ============================================================
-- Custom ENUM Types
-- ============================================================

-- Student type (controls which system a student uses)
CREATE TYPE student_type_enum AS ENUM ('CAFE', 'NON_CAFE');

-- Meal type
CREATE TYPE meal_type_enum AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER');

-- Cash payment status
CREATE TYPE payment_status_enum AS ENUM ('PENDING', 'CONFIRMED', 'SENT');

-- Admin role
CREATE TYPE admin_role_enum AS ENUM ('SUPER_ADMIN', 'CAFE_MANAGER');

-- Gender
CREATE TYPE gender_enum AS ENUM ('Male', 'Female', 'Other');

-- ============================================================
-- 1. Departments
-- ============================================================
CREATE TABLE Departments (
    department_id   SERIAL PRIMARY KEY,
    department_name VARCHAR(120) NOT NULL UNIQUE,
    college         VARCHAR(120)
);

-- ============================================================
-- 2. Dormitories
-- ============================================================
CREATE TABLE Dormitories (
    dormitory_id SERIAL PRIMARY KEY,
    dorm_name    VARCHAR(100) NOT NULL,
    block        VARCHAR(20),
    gender_type  gender_enum,
    total_rooms  INT CHECK (total_rooms > 0)
);

-- ============================================================
-- 3. Students
-- ============================================================
CREATE TABLE Students (
    student_id    SERIAL PRIMARY KEY,
    first_name    VARCHAR(80)  NOT NULL,
    last_name     VARCHAR(80)  NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    gender        gender_enum,
    year_of_study INT CHECK (year_of_study BETWEEN 1 AND 5),
    year_enrolled INT NOT NULL,
    student_type  student_type_enum NOT NULL,
    department_id INT REFERENCES Departments(department_id) ON DELETE SET NULL,
    dormitory_id  INT REFERENCES Dormitories(dormitory_id) ON DELETE SET NULL,
    is_approved   BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_students_dept ON Students(department_id);
CREATE INDEX idx_students_type ON Students(student_type);

-- ============================================================
-- 4. Admins
-- ============================================================
CREATE TABLE Admins (
    admin_id      SERIAL PRIMARY KEY,
    full_name     VARCHAR(150) NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          admin_role_enum DEFAULT 'CAFE_MANAGER',
    last_login    TIMESTAMP,
    is_active     BOOLEAN DEFAULT TRUE
);

-- ============================================================
-- 5. Menus
-- ============================================================
CREATE TABLE Menus (
    menu_id      SERIAL PRIMARY KEY,
    item_name    VARCHAR(120) NOT NULL,
    description  TEXT,
    meal_type    meal_type_enum NOT NULL,
    price        NUMERIC(8,2) NOT NULL CHECK (price >= 0),
    is_available BOOLEAN DEFAULT TRUE
);

-- ============================================================
-- 6. Meal_Attendance (replaces paper tick register)
-- ============================================================
CREATE TABLE Meal_Attendance (
    attendance_id SERIAL PRIMARY KEY,
    student_id    INT NOT NULL REFERENCES Students(student_id) ON DELETE CASCADE,
    menu_id       INT NOT NULL REFERENCES Menus(menu_id) ON DELETE RESTRICT,
    meal_date     DATE NOT NULL DEFAULT CURRENT_DATE,
    meal_type     meal_type_enum NOT NULL,
    recorded_at   TIMESTAMP DEFAULT NOW()
);

-- Prevent one student ticking in twice for the same meal on the same day
CREATE UNIQUE INDEX one_tick_per_meal
    ON Meal_Attendance (student_id, meal_date, meal_type);

CREATE INDEX idx_attendance_student ON Meal_Attendance(student_id);
CREATE INDEX idx_attendance_date    ON Meal_Attendance(meal_date);

-- ============================================================
-- 7. Cash_Payments (monthly 3,000 ETB for non-café students)
-- ============================================================
CREATE TABLE Cash_Payments (
    payment_id    SERIAL PRIMARY KEY,
    student_id    INT NOT NULL REFERENCES Students(student_id) ON DELETE CASCADE,
    amount        NUMERIC(10,2) NOT NULL DEFAULT 3000.00 CHECK (amount > 0),
    payment_month INT NOT NULL CHECK (payment_month BETWEEN 1 AND 12),
    payment_year  INT NOT NULL,
    status        payment_status_enum DEFAULT 'PENDING',
    confirmed_by  INT REFERENCES Admins(admin_id) ON DELETE SET NULL,
    confirmed_at  TIMESTAMP,
    sent_at       TIMESTAMP
);

-- One payment record per student per month per year
CREATE UNIQUE INDEX one_payment_per_month
    ON Cash_Payments (student_id, payment_month, payment_year);

-- ============================================================
-- 8. Audit_Logs (immutable action log)
-- ============================================================
CREATE TABLE Audit_Logs (
    log_id       SERIAL PRIMARY KEY,
    actor_id     INT,
    actor_type   VARCHAR(20) CHECK (actor_type IN ('STUDENT','ADMIN')),
    action       VARCHAR(20) CHECK (action IN ('INSERT','UPDATE','DELETE')),
    target_table VARCHAR(60),
    target_id    INT,
    old_value    TEXT,
    new_value    TEXT,
    logged_at    TIMESTAMP DEFAULT NOW()
);

-- Prevent any modification to the audit log
CREATE RULE no_update_audit AS ON UPDATE TO Audit_Logs DO INSTEAD NOTHING;
CREATE RULE no_delete_audit AS ON DELETE TO Audit_Logs DO INSTEAD NOTHING;
