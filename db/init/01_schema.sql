-- Initial schema for College Application Management System

-- Core tables

CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    preferred_name VARCHAR(100),
    email VARCHAR(255),
    hs_grad_year INTEGER NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS colleges (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    short_name VARCHAR(50),
    city VARCHAR(100),
    state VARCHAR(50),
    timezone VARCHAR(50),
    usnews_rank INTEGER,
    admissions_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TYPE round_type AS ENUM ('ED', 'ED2', 'EA', 'REA', 'RD', 'ROLLING');
CREATE TYPE data_source AS ENUM ('CRAWLER', 'ADMIN');
CREATE TYPE app_status AS ENUM ('PLANNED', 'IN_PROGRESS', 'SUBMITTED', 'ADMITTED', 'DENIED', 'DEFERRED', 'WAITLISTED');
CREATE TYPE crawl_freq AS ENUM ('daily', 'weekly', 'monthly');

CREATE TABLE IF NOT EXISTS college_rounds (
    id SERIAL PRIMARY KEY,
    college_id INTEGER NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
    round_type round_type NOT NULL,
    cycle VARCHAR(20) NOT NULL,
    deadline_date DATE,
    deadline_time TIME,
    decision_date DATE,
    decision_start_date DATE,
    decision_end_date DATE,
    decision_notes TEXT,
    source data_source NOT NULL DEFAULT 'ADMIN',
    admin_confirmed BOOLEAN DEFAULT FALSE,
    last_crawled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(college_id, round_type, cycle)
);

CREATE TABLE IF NOT EXISTS student_applications (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    college_id INTEGER NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
    round_type round_type NOT NULL,
    cycle VARCHAR(20) NOT NULL,
    status app_status NOT NULL DEFAULT 'PLANNED',
    submitted_at TIMESTAMP,
    decision_result_date TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, college_id, round_type, cycle)
);

-- Logging tables

CREATE TABLE IF NOT EXISTS crawl_logs (
    id SERIAL PRIMARY KEY,
    run_started_at TIMESTAMP NOT NULL,
    run_finished_at TIMESTAMP,
    colleges_attempted INTEGER DEFAULT 0,
    colleges_successful INTEGER DEFAULT 0,
    colleges_failed INTEGER DEFAULT 0,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS college_round_change_logs (
    id SERIAL PRIMARY KEY,
    college_round_id INTEGER NOT NULL REFERENCES college_rounds(id) ON DELETE CASCADE,
    field_changed VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    changed_by data_source NOT NULL
);

-- System settings (single row)

CREATE TABLE IF NOT EXISTS system_settings (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    current_cycle VARCHAR(20) NOT NULL,
    crawl_frequency crawl_freq DEFAULT 'monthly',
    dashboard_deadline_window_days INTEGER DEFAULT 30,
    default_export_folder TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance

CREATE INDEX IF NOT EXISTS idx_student_applications_student ON student_applications(student_id);
CREATE INDEX IF NOT EXISTS idx_student_applications_college ON student_applications(college_id);
CREATE INDEX IF NOT EXISTS idx_student_applications_cycle ON student_applications(cycle);
CREATE INDEX IF NOT EXISTS idx_student_applications_status ON student_applications(status);
CREATE INDEX IF NOT EXISTS idx_college_rounds_college ON college_rounds(college_id);
CREATE INDEX IF NOT EXISTS idx_college_rounds_cycle ON college_rounds(cycle);
CREATE INDEX IF NOT EXISTS idx_colleges_rank ON colleges(usnews_rank);
CREATE INDEX IF NOT EXISTS idx_students_name ON students(last_name, first_name);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_colleges_updated_at BEFORE UPDATE ON colleges
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_college_rounds_updated_at BEFORE UPDATE ON college_rounds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_student_applications_updated_at BEFORE UPDATE ON student_applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Initialize system settings with current cycle
INSERT INTO system_settings (id, current_cycle, crawl_frequency, dashboard_deadline_window_days)
VALUES (1,
    CASE
        WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 9
        THEN CONCAT(EXTRACT(YEAR FROM CURRENT_DATE), '-', EXTRACT(YEAR FROM CURRENT_DATE) + 1)
        ELSE CONCAT(EXTRACT(YEAR FROM CURRENT_DATE) - 1, '-', EXTRACT(YEAR FROM CURRENT_DATE))
    END,
    'monthly',
    30
) ON CONFLICT (id) DO NOTHING;
