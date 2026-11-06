-- MySQL >=8.0.21 or MariaDB >=11.8.9. Empty migration target only; no demo users or seed rows.
-- All timestamps are UTC. Binary collation preserves case-sensitive source IDs.
CREATE TABLE portal_users (
 id BIGINT PRIMARY KEY AUTO_INCREMENT, email VARCHAR(254) NOT NULL UNIQUE, password_hash TEXT NOT NULL,
 role VARCHAR(16) NOT NULL CHECK (role IN ('teacher','admin')), created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 display_name TEXT NOT NULL, status VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('pending','active','suspended','rejected')),
 revision INT NOT NULL DEFAULT 0, review_note TEXT NOT NULL,
 ktp_number TEXT NOT NULL, bank_name TEXT NOT NULL, bank_account TEXT NOT NULL, phone TEXT NOT NULL, temp_password TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE portal_sessions (
 id CHAR(36) PRIMARY KEY, email VARCHAR(254) NOT NULL, expires_at DATETIME(6) NOT NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY (email) REFERENCES portal_users(email) ON DELETE CASCADE, INDEX (email), INDEX (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE portal_rate_limits (
 `key` VARCHAR(160) PRIMARY KEY, window_start DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), attempts INT NOT NULL DEFAULT 1 CHECK (attempts>0), INDEX (window_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE portal_account_events (
 id CHAR(36) PRIMARY KEY, actor_email VARCHAR(254) NOT NULL, target_email VARCHAR(254) NOT NULL, action VARCHAR(32) NOT NULL,
 note TEXT NOT NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE academy_catalog (
 id INT PRIMARY KEY CHECK (id=1), content JSON NOT NULL CHECK (JSON_TYPE(content)='OBJECT'), updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE academy_core_state (
 id INT PRIMARY KEY CHECK (id=1), catalog_hash TEXT NOT NULL, synced_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), relational_ready BOOLEAN NOT NULL DEFAULT FALSE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE institutions (
 id VARCHAR(160) PRIMARY KEY CHECK (CHAR_LENGTH(id)>=1), name TEXT NOT NULL, city TEXT NOT NULL, country TEXT NOT NULL,
 logo TEXT NOT NULL, about TEXT NOT NULL, address TEXT NOT NULL, contact_name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL, website TEXT NOT NULL,
 sort_order INT NOT NULL DEFAULT 0, revision INT NOT NULL DEFAULT 0 CHECK (revision>=0), active BOOLEAN NOT NULL DEFAULT TRUE,
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), reported_students INT CHECK (reported_students BETWEEN 0 AND 10000)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE klass_types (
 id VARCHAR(160) PRIMARY KEY CHECK (CHAR_LENGTH(id)>=1), title TEXT NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL, image TEXT NOT NULL,
 sort_order INT NOT NULL DEFAULT 0, active BOOLEAN NOT NULL DEFAULT TRUE, updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE coach_profiles (
 id VARCHAR(160) PRIMARY KEY CHECK (CHAR_LENGTH(id)>=1), name TEXT NOT NULL, specialty TEXT NOT NULL, level VARCHAR(16) NOT NULL CHECK (level IN ('Lead Coach','Coach')),
 image TEXT NOT NULL, email TEXT NOT NULL, portal_email VARCHAR(254) NOT NULL, bio TEXT NOT NULL,
 sort_order INT NOT NULL DEFAULT 0, revision INT NOT NULL DEFAULT 0 CHECK (revision>=0), active BOOLEAN NOT NULL DEFAULT TRUE, updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE student_profiles (
 id VARCHAR(160) PRIMARY KEY CHECK (CHAR_LENGTH(id)>=1), institution_id VARCHAR(160), name TEXT NOT NULL, grade TEXT NOT NULL,
 score INT NOT NULL DEFAULT 0, attendance INT NOT NULL DEFAULT 0, sort_order INT NOT NULL DEFAULT 0,
 revision INT NOT NULL DEFAULT 0 CHECK (revision>=0), active BOOLEAN NOT NULL DEFAULT TRUE, updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY (institution_id) REFERENCES institutions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE academic_periods (
 id VARCHAR(220) PRIMARY KEY CHECK (CHAR_LENGTH(id)>=1), institution_id VARCHAR(160), name TEXT NOT NULL, start_date DATE NOT NULL, end_date DATE,
 active BOOLEAN NOT NULL DEFAULT TRUE, CHECK (end_date IS NULL OR end_date>=start_date), FOREIGN KEY (institution_id) REFERENCES institutions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE class_groups (
 id VARCHAR(160) PRIMARY KEY CHECK (CHAR_LENGTH(id)>=1), klass_type_id VARCHAR(160) NOT NULL, institution_id VARCHAR(160), academic_period_id VARCHAR(220),
 mode VARCHAR(8) NOT NULL CHECK (mode IN ('Online','Onsite','Hybrid')), sort_order INT NOT NULL DEFAULT 0,
 revision INT NOT NULL DEFAULT 0 CHECK (revision>=0), active BOOLEAN NOT NULL DEFAULT TRUE, updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 group_name VARCHAR(140) NOT NULL DEFAULT '', planned_meetings INT CHECK (planned_meetings BETWEEN 1 AND 72), reported_students INT CHECK (reported_students BETWEEN 0 AND 10000),
 canva_url TEXT NOT NULL, target_meetings INT NOT NULL,
 FOREIGN KEY (klass_type_id) REFERENCES klass_types(id), FOREIGN KEY (institution_id) REFERENCES institutions(id), FOREIGN KEY (academic_period_id) REFERENCES academic_periods(id), INDEX (institution_id,active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE class_schedules (
 class_group_id VARCHAR(160) PRIMARY KEY, schedule_text TEXT NOT NULL, FOREIGN KEY (class_group_id) REFERENCES class_groups(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE coach_assignments (
 class_group_id VARCHAR(160) NOT NULL, coach_id VARCHAR(160) NOT NULL, assigned_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY (class_group_id,coach_id),
 FOREIGN KEY (class_group_id) REFERENCES class_groups(id) ON DELETE CASCADE, FOREIGN KEY (coach_id) REFERENCES coach_profiles(id), INDEX (coach_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE enrollments (
 class_group_id VARCHAR(160) NOT NULL, student_id VARCHAR(160) NOT NULL, status VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','withdrawn')),
 enrolled_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY (class_group_id,student_id),
 FOREIGN KEY (class_group_id) REFERENCES class_groups(id) ON DELETE CASCADE, FOREIGN KEY (student_id) REFERENCES student_profiles(id), INDEX (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE submission_deadlines (
 id VARCHAR(260) PRIMARY KEY CHECK (CHAR_LENGTH(id)>=1), class_group_id VARCHAR(160) NOT NULL, academic_period_id VARCHAR(220),
 kind VARCHAR(16) NOT NULL CHECK (kind IN ('syllabus','lesson-plan','meeting','request')), meeting_date DATE NOT NULL, due_date DATE NOT NULL,
 request_timing VARCHAR(20) NOT NULL DEFAULT '' CHECK (request_timing IN ('','Before class','Before semester')),
 FOREIGN KEY (class_group_id) REFERENCES class_groups(id) ON DELETE CASCADE, FOREIGN KEY (academic_period_id) REFERENCES academic_periods(id), INDEX (class_group_id,meeting_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE academy_events (
 id CHAR(36) PRIMARY KEY, actor_email VARCHAR(254) NOT NULL, entity_kind VARCHAR(16) NOT NULL CHECK (entity_kind IN ('klasses','institutions','coaches','students')),
 entity_id VARCHAR(160) NOT NULL, action VARCHAR(16) NOT NULL CHECK (action IN ('create','update')), before_data JSON NOT NULL, after_data JSON NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX (entity_kind,entity_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE portal_file_objects (
 id CHAR(36) PRIMARY KEY, pathname VARCHAR(100) NOT NULL UNIQUE, provider VARCHAR(8) NOT NULL CHECK (provider IN ('blob','local')),
 size INT NOT NULL CHECK (size BETWEEN 1 AND 1048576), sha256 CHAR(64) NOT NULL CHECK (sha256 COLLATE utf8mb4_bin REGEXP '^[a-f0-9]{64}$'),
 ready BOOLEAN NOT NULL DEFAULT FALSE, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE academy_images (
 id CHAR(36) PRIMARY KEY, name VARCHAR(180) NOT NULL CHECK (CHAR_LENGTH(name)>=1), mime VARCHAR(32) NOT NULL CHECK (mime='image/webp'),
 bytes MEDIUMBLOB CHECK (OCTET_LENGTH(bytes) BETWEEN 1 AND 524288), created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), object_id CHAR(36),
 CHECK ((bytes IS NULL)<>(object_id IS NULL)), FOREIGN KEY (object_id) REFERENCES portal_file_objects(id), INDEX (object_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE teacher_onboarding (
 email VARCHAR(254) PRIMARY KEY, invitation_hash VARCHAR(64) NOT NULL UNIQUE, expires_at DATETIME(6) NOT NULL, completed_at DATETIME(6),
 bank_name VARCHAR(100) NOT NULL DEFAULT '', bank_account VARCHAR(40) NOT NULL DEFAULT '', account_holder VARCHAR(120) NOT NULL DEFAULT '', identity_object_id CHAR(36),
 CHECK (completed_at IS NULL OR identity_object_id IS NOT NULL), FOREIGN KEY (email) REFERENCES portal_users(email) ON DELETE CASCADE,
 FOREIGN KEY (identity_object_id) REFERENCES portal_file_objects(id), INDEX (identity_object_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE teaching_records (
 id CHAR(36) PRIMARY KEY, teacher_email VARCHAR(254) NOT NULL, kind VARCHAR(16) NOT NULL CHECK (kind IN ('meeting','lesson-plan','syllabus','slides','request')),
 class_id VARCHAR(160) NOT NULL, meeting_date DATE NOT NULL, title TEXT NOT NULL, content JSON NOT NULL, files JSON NOT NULL,
 status VARCHAR(20) NOT NULL CHECK (status IN ('Draft','Submitted','Approved','Needs revision','Rejected','Fulfilled')), reviewer_note TEXT NOT NULL,
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), revision INT NOT NULL DEFAULT 0 CHECK (revision>=0),
 FOREIGN KEY (teacher_email) REFERENCES portal_users(email), UNIQUE (teacher_email,kind,class_id,meeting_date), INDEX (teacher_email,updated_at), INDEX (class_id,kind,meeting_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE teaching_files (
 id CHAR(36) PRIMARY KEY, record_id CHAR(36) NOT NULL, name TEXT NOT NULL, mime VARCHAR(100) NOT NULL, bytes MEDIUMBLOB, position INT NOT NULL DEFAULT 0,
 size INT CHECK (size BETWEEN 1 AND 1048576), object_id CHAR(36), CHECK ((bytes IS NULL)<>(object_id IS NULL)),
 FOREIGN KEY (record_id) REFERENCES teaching_records(id) ON DELETE CASCADE, FOREIGN KEY (object_id) REFERENCES portal_file_objects(id), INDEX (object_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE class_meetings (
 id CHAR(36) PRIMARY KEY DEFAULT (UUID()), class_group_id VARCHAR(160) NOT NULL, meeting_date DATE NOT NULL, configured BOOLEAN NOT NULL DEFAULT FALSE,
 canva_url TEXT NOT NULL, worksheet_url TEXT NOT NULL, UNIQUE (class_group_id,meeting_date), FOREIGN KEY (class_group_id) REFERENCES class_groups(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE teaching_documents (
 record_id CHAR(36) PRIMARY KEY, workflow_version INT CHECK (workflow_version=2), syllabus_id CHAR(36), meeting_number INT CHECK (meeting_number BETWEEN 1 AND 36),
 main_coach TEXT, assistant_coach TEXT, room TEXT, notes TEXT, objectives TEXT, worksheet_url TEXT,
 FOREIGN KEY (record_id) REFERENCES teaching_records(id) ON DELETE CASCADE, FOREIGN KEY (syllabus_id) REFERENCES teaching_records(id), INDEX (syllabus_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE teaching_syllabuses (
 record_id CHAR(36) PRIMARY KEY, academic_year TEXT, semester TEXT, deadline DATE, description TEXT, learning_values TEXT, projects TEXT, project_description TEXT, outline TEXT,
 FOREIGN KEY (record_id) REFERENCES teaching_documents(record_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE syllabus_meetings (
 syllabus_id CHAR(36) NOT NULL, position INT NOT NULL CHECK (position BETWEEN 1 AND 36), meeting_date DATE NOT NULL, start_time TIME NOT NULL,
 topic TEXT NOT NULL, phase VARCHAR(16) NOT NULL CHECK (phase IN ('Inspiring','Creating','Dedicating')),
 PRIMARY KEY (syllabus_id,position), UNIQUE (syllabus_id,meeting_date), FOREIGN KEY (syllabus_id) REFERENCES teaching_syllabuses(record_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE teaching_lesson_plans (
 record_id CHAR(36) PRIMARY KEY, activities TEXT, resources TEXT, assessment TEXT, FOREIGN KEY (record_id) REFERENCES teaching_documents(record_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE lesson_plan_steps (
 record_id CHAR(36) NOT NULL, position INT NOT NULL CHECK (position BETWEEN 1 AND 12), title TEXT NOT NULL,
 phase VARCHAR(16) NOT NULL CHECK (phase IN ('Inspiring','Creating','Dedicating','Exploring','Applying')), minutes INT CHECK (minutes BETWEEN 1 AND 240),
 purpose TEXT NOT NULL, teacher_activity TEXT NOT NULL, student_activity TEXT NOT NULL, PRIMARY KEY (record_id,position), FOREIGN KEY (record_id) REFERENCES teaching_lesson_plans(record_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE teaching_meeting_journals (
 record_id CHAR(36) PRIMARY KEY, meeting_id CHAR(36), teacher_attendance VARCHAR(16) CHECK (teacher_attendance IN ('Present','Late','Excused','Absent')), reflection TEXT,
 FOREIGN KEY (record_id) REFERENCES teaching_documents(record_id) ON DELETE CASCADE, FOREIGN KEY (meeting_id) REFERENCES class_meetings(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE student_meeting_feedback (
 record_id CHAR(36) NOT NULL, student_id VARCHAR(160) NOT NULL, student_profile_id VARCHAR(160), student_name TEXT, position INT NOT NULL,
 attendance VARCHAR(16) NOT NULL CHECK (attendance IN ('Present','Late','Excused','Absent')), score DECIMAL(5,2) CHECK (score BETWEEN 0 AND 100), feedback TEXT NOT NULL,
 has_ratings BOOLEAN NOT NULL DEFAULT FALSE, affective INT CHECK (affective BETWEEN 1 AND 4), problem_solving INT CHECK (problem_solving BETWEEN 1 AND 4),
 storytelling INT CHECK (storytelling BETWEEN 1 AND 4), performance INT CHECK (performance BETWEEN 1 AND 4), PRIMARY KEY (record_id,student_id),
 FOREIGN KEY (record_id) REFERENCES teaching_meeting_journals(record_id) ON DELETE CASCADE, FOREIGN KEY (student_profile_id) REFERENCES student_profiles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE teaching_materials (
 record_id CHAR(36) PRIMARY KEY, canva_url TEXT, FOREIGN KEY (record_id) REFERENCES teaching_documents(record_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE class_requests (
 record_id CHAR(36) PRIMARY KEY, items TEXT, reason TEXT, timing VARCHAR(20) CHECK (timing IN ('Before class','Before semester')),
 FOREIGN KEY (record_id) REFERENCES teaching_documents(record_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE class_request_items (
 record_id CHAR(36) NOT NULL, id CHAR(36) NOT NULL, position INT NOT NULL, name VARCHAR(200) NOT NULL, quantity VARCHAR(80) NOT NULL, admin_note VARCHAR(1000) NOT NULL DEFAULT '',
 PRIMARY KEY (record_id,id), FOREIGN KEY (record_id) REFERENCES class_requests(record_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE teaching_events (
 id CHAR(36) PRIMARY KEY, record_id CHAR(36) NOT NULL, actor_email VARCHAR(254) NOT NULL, action VARCHAR(16) NOT NULL CHECK (action IN ('create','save','submit','review')),
 before_data JSON NOT NULL, after_data JSON NOT NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), FOREIGN KEY (record_id) REFERENCES teaching_records(id) ON DELETE CASCADE, INDEX (record_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE notification_jobs (
 id CHAR(36) PRIMARY KEY, dedupe_key VARCHAR(600) NOT NULL UNIQUE CHECK (CHAR_LENGTH(dedupe_key)>=1), teacher_email VARCHAR(254) NOT NULL, record_id CHAR(36), class_id VARCHAR(160),
 deadline_id VARCHAR(260), due_date DATE, stage VARCHAR(8) CHECK (stage IN ('h3','h1','overdue')), title VARCHAR(260) NOT NULL CHECK (CHAR_LENGTH(title)>=1), message VARCHAR(2400) NOT NULL CHECK (CHAR_LENGTH(message)>=1),
 status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered','failed','cancelled')), attempts INT NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
 available_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), delivered_at DATETIME(6), last_error TEXT NOT NULL,
 retried_by VARCHAR(254), retried_at DATETIME(6), CHECK ((deadline_id IS NULL AND due_date IS NULL AND stage IS NULL) OR (deadline_id IS NOT NULL AND due_date IS NOT NULL AND stage IS NOT NULL AND class_id IS NOT NULL)),
 FOREIGN KEY (teacher_email) REFERENCES portal_users(email) ON DELETE CASCADE, FOREIGN KEY (record_id) REFERENCES teaching_records(id) ON DELETE CASCADE,
 FOREIGN KEY (class_id) REFERENCES class_groups(id) ON DELETE CASCADE, INDEX (status,available_at,created_at), INDEX (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE teacher_notifications (
 id CHAR(36) PRIMARY KEY, teacher_email VARCHAR(254) NOT NULL, record_id CHAR(36), title TEXT NOT NULL, message TEXT NOT NULL, `read` BOOLEAN NOT NULL DEFAULT FALSE,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), source_job_id CHAR(36) UNIQUE,
 FOREIGN KEY (teacher_email) REFERENCES portal_users(email), FOREIGN KEY (record_id) REFERENCES teaching_records(id) ON DELETE CASCADE,
 FOREIGN KEY (source_job_id) REFERENCES notification_jobs(id) ON DELETE SET NULL, INDEX (teacher_email,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE inquiries (
 id CHAR(36) PRIMARY KEY, submission_hash VARCHAR(64) NOT NULL, name VARCHAR(120) NOT NULL CHECK (CHAR_LENGTH(name)>=1), email VARCHAR(254) NOT NULL CHECK (CHAR_LENGTH(email)>=3),
 phone VARCHAR(30) NOT NULL CHECK (CHAR_LENGTH(phone)>=8), place VARCHAR(120) NOT NULL CHECK (CHAR_LENGTH(place)>=1),
 type VARCHAR(32) NOT NULL CHECK (type IN ('Workshop','Klass','Program','School Partnership','Event','Other')), affiliation VARCHAR(20) NOT NULL CHECK (affiliation IN ('Institution','Parent','Non-institution')),
 institution VARCHAR(180) NOT NULL DEFAULT '', message TEXT NOT NULL CHECK (CHAR_LENGTH(message) BETWEEN 1 AND 5000), language VARCHAR(2) NOT NULL CHECK (language IN ('en','id','zh')),
 details JSON NOT NULL CHECK (JSON_TYPE(details)='OBJECT'), consent_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), status VARCHAR(16) NOT NULL DEFAULT 'New' CHECK (status IN ('New','Contacted','Resolved')),
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), CHECK (affiliation!='Institution' OR CHAR_LENGTH(institution)>0),
 INDEX (created_at), INDEX (email,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
