-- AAU Cafe Management and Stipend System Schema
-- Designed for Addis Ababa University

-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS order_item;
DROP TABLE IF EXISTS cafe_order;
DROP TABLE IF EXISTS menu_item;
DROP TABLE IF EXISTS stipend_transaction;
DROP TABLE IF EXISTS meal_log;
DROP TABLE IF EXISTS admin_audit_log;
DROP TABLE IF EXISTS app_user;
DROP TABLE IF EXISTS student;
DROP TABLE IF EXISTS dormitory;
DROP TABLE IF EXISTS department;

-- Drop custom types
DROP TYPE IF EXISTS order_status_enum;
DROP TYPE IF EXISTS user_role_enum;
DROP TYPE IF EXISTS cafe_status_enum;
DROP TYPE IF EXISTS meal_type_enum;
DROP TYPE IF EXISTS stipend_status_enum;

-- Custom Types
CREATE TYPE user_role_enum AS ENUM ('STUDENT', 'ADMIN');
CREATE TYPE cafe_status_enum AS ENUM ('CAFE', 'NON_CAFE');
CREATE TYPE meal_type_enum AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER');
CREATE TYPE stipend_status_enum AS ENUM ('PENDING', 'PAID', 'FAILED');

-- 2. Department Table
CREATE TABLE department (
    dept_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dept_name VARCHAR(120) NOT NULL UNIQUE
);

-- 3. Dormitory Table
CREATE TABLE dormitory (
    dorm_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    block_name VARCHAR(50) NOT NULL,
    floor_number INT NOT NULL CHECK (floor_number >= 0),
    room_number VARCHAR(20) NOT NULL,
    UNIQUE(block_name, floor_number, room_number)
);

-- 1. Student Table
CREATE TABLE student (
    student_id VARCHAR(20) PRIMARY KEY, -- AAU ID format e.g. UGR/1234/18
    first_name VARCHAR(60) NOT NULL,
    last_name VARCHAR(60) NOT NULL,
    year_of_study INT NOT NULL CHECK (year_of_study BETWEEN 1 AND 7),
    cafe_status cafe_status_enum NOT NULL,
    bank_account_number VARCHAR(30),
    dept_id INT NOT NULL REFERENCES department(dept_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    dorm_id INT REFERENCES dormitory(dorm_id) ON UPDATE CASCADE ON DELETE SET NULL,
    registered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_approved BOOLEAN NOT NULL DEFAULT FALSE,
    -- Constraint: Students cannot have both Cafe and Stipend status at the same time in theory,
    -- but here we use the cafe_status flag.
    -- Strict rule: Non-cafe students MUST have a bank account for stipend.
    CHECK (
        (cafe_status = 'NON_CAFE' AND bank_account_number IS NOT NULL)
        OR
        (cafe_status = 'CAFE' AND bank_account_number IS NULL)
    )
);

-- User Table (for Auth)
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

-- Admin Audit Log
CREATE TABLE admin_audit_log (
    audit_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    admin_user_id BIGINT NOT NULL REFERENCES app_user(user_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    action_type VARCHAR(40) NOT NULL,
    target_student_id VARCHAR(20),
    target_transaction_id BIGINT,
    details TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Meal_Log Table
CREATE TABLE meal_log (
    log_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id VARCHAR(20) NOT NULL REFERENCES student(student_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    date_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    meal_type meal_type_enum NOT NULL
);
-- Business Rule: A student can only log a specific meal once per day
CREATE UNIQUE INDEX uq_meal_per_student_per_day ON meal_log (student_id, (date_time::date), meal_type);

-- 5. Stipend_Transaction Table
CREATE TABLE stipend_transaction (
    transaction_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id VARCHAR(20) NOT NULL REFERENCES student(student_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    stipend_month DATE NOT NULL, -- Stored as first day of month
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    status stipend_status_enum NOT NULL DEFAULT 'PENDING',
    processed_at TIMESTAMP,
    confirmed_at TIMESTAMP,
    confirmed_by_user BIGINT REFERENCES app_user(user_id),
    -- Business Rule: Only one stipend transaction per month per student
    UNIQUE (student_id, stipend_month),
    -- Business Rule: Only non-cafe students can have stipend transactions (handled at application level or trigger)
    CHECK (date_trunc('month', stipend_month) = stipend_month)
);

-- 6. Menu Table
CREATE TABLE menu_item (
    item_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    item_name VARCHAR(100) NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00, -- 0 for cafe students
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    category VARCHAR(50) CHECK (category IN ('Breakfast', 'Lunch', 'Dinner', 'Snack', 'Drink'))
);

-- 7. Order Table (Real-time tracking)
CREATE TYPE order_status_enum AS ENUM ('PENDING', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED');

CREATE TABLE cafe_order (
    order_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id VARCHAR(20) NOT NULL REFERENCES student(student_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    order_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status order_status_enum NOT NULL DEFAULT 'PENDING',
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    is_cafe_meal BOOLEAN NOT NULL DEFAULT TRUE -- TRUE if using daily meal entitlement
);

-- 8. Order Items
CREATE TABLE order_item (
    order_item_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES cafe_order(order_id) ON UPDATE CASCADE ON DELETE CASCADE,
    item_id INT NOT NULL REFERENCES menu_item(item_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0)
);


