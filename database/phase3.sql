ALTER TABLE academy_core_state ADD COLUMN IF NOT EXISTS relational_ready BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS class_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_group_id TEXT NOT NULL REFERENCES class_groups(id),
  meeting_date DATE NOT NULL,
  configured BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (class_group_id, meeting_date)
);

CREATE TABLE IF NOT EXISTS teaching_documents (
  record_id UUID PRIMARY KEY REFERENCES teaching_records(id) ON DELETE CASCADE,
  workflow_version INTEGER CHECK (workflow_version = 2),
  syllabus_id UUID REFERENCES teaching_records(id) DEFERRABLE INITIALLY DEFERRED,
  meeting_number INTEGER CHECK (meeting_number BETWEEN 1 AND 36),
  main_coach TEXT,
  assistant_coach TEXT,
  room TEXT,
  notes TEXT,
  objectives TEXT,
  worksheet_url TEXT
);

CREATE TABLE IF NOT EXISTS teaching_syllabuses (
  record_id UUID PRIMARY KEY REFERENCES teaching_documents(record_id) ON DELETE CASCADE,
  academic_year TEXT,
  semester TEXT,
  deadline DATE,
  description TEXT,
  learning_values TEXT,
  projects TEXT,
  project_description TEXT,
  outline TEXT
);

CREATE TABLE IF NOT EXISTS syllabus_meetings (
  syllabus_id UUID NOT NULL REFERENCES teaching_syllabuses(record_id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 36),
  meeting_date DATE NOT NULL,
  start_time TIME NOT NULL,
  topic TEXT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('Inspiring', 'Creating', 'Dedicating')),
  PRIMARY KEY (syllabus_id, position),
  UNIQUE (syllabus_id, meeting_date)
);

CREATE TABLE IF NOT EXISTS teaching_lesson_plans (
  record_id UUID PRIMARY KEY REFERENCES teaching_documents(record_id) ON DELETE CASCADE,
  activities TEXT,
  resources TEXT,
  assessment TEXT
);

CREATE TABLE IF NOT EXISTS lesson_plan_steps (
  record_id UUID NOT NULL REFERENCES teaching_lesson_plans(record_id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 12),
  title TEXT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('Inspiring', 'Creating', 'Dedicating', 'Exploring', 'Applying')),
  minutes INTEGER CHECK (minutes BETWEEN 1 AND 240),
  purpose TEXT NOT NULL,
  teacher_activity TEXT NOT NULL,
  student_activity TEXT NOT NULL,
  PRIMARY KEY (record_id, position)
);

CREATE TABLE IF NOT EXISTS teaching_meeting_journals (
  record_id UUID PRIMARY KEY REFERENCES teaching_documents(record_id) ON DELETE CASCADE,
  meeting_id UUID REFERENCES class_meetings(id),
  teacher_attendance TEXT CHECK (teacher_attendance IN ('Present', 'Late', 'Excused', 'Absent')),
  reflection TEXT
);

CREATE TABLE IF NOT EXISTS student_meeting_feedback (
  record_id UUID NOT NULL REFERENCES teaching_meeting_journals(record_id) ON DELETE CASCADE,
  student_id TEXT NOT NULL,
  student_profile_id TEXT REFERENCES student_profiles(id),
  student_name TEXT,
  position INTEGER NOT NULL,
  attendance TEXT NOT NULL CHECK (attendance IN ('Present', 'Late', 'Excused', 'Absent')),
  score NUMERIC CHECK (score BETWEEN 0 AND 100),
  feedback TEXT NOT NULL,
  has_ratings BOOLEAN NOT NULL DEFAULT FALSE,
  affective INTEGER CHECK (affective BETWEEN 1 AND 4),
  problem_solving INTEGER CHECK (problem_solving BETWEEN 1 AND 4),
  storytelling INTEGER CHECK (storytelling BETWEEN 1 AND 4),
  performance INTEGER CHECK (performance BETWEEN 1 AND 4),
  PRIMARY KEY (record_id, student_id)
);

CREATE TABLE IF NOT EXISTS teaching_materials (
  record_id UUID PRIMARY KEY REFERENCES teaching_documents(record_id) ON DELETE CASCADE,
  canva_url TEXT
);

CREATE TABLE IF NOT EXISTS class_requests (
  record_id UUID PRIMARY KEY REFERENCES teaching_documents(record_id) ON DELETE CASCADE,
  items TEXT,
  reason TEXT,
  timing TEXT CHECK (timing IN ('Before class', 'Before semester'))
);

CREATE TABLE IF NOT EXISTS teaching_events (
  id UUID PRIMARY KEY,
  record_id UUID NOT NULL REFERENCES teaching_records(id) ON DELETE CASCADE,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'save', 'submit', 'review')),
  before_data JSONB NOT NULL DEFAULT '{}',
  after_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE teaching_records ALTER COLUMN content SET DEFAULT '{}';
ALTER TABLE teaching_files ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;
ALTER TABLE teaching_files ADD COLUMN IF NOT EXISTS size INTEGER CHECK (size BETWEEN 1 AND 1048576);
ALTER TABLE teaching_records ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0);
CREATE INDEX IF NOT EXISTS teaching_documents_syllabus ON teaching_documents (syllabus_id);
CREATE INDEX IF NOT EXISTS teaching_records_owner ON teaching_records (teacher_email, updated_at DESC);
CREATE INDEX IF NOT EXISTS teaching_records_class ON teaching_records (class_id, kind, meeting_date);
CREATE INDEX IF NOT EXISTS teaching_events_record ON teaching_events (record_id, created_at DESC);
ALTER TABLE teaching_documents ALTER CONSTRAINT teaching_documents_syllabus_id_fkey DEFERRABLE INITIALLY DEFERRED;

CREATE OR REPLACE VIEW teaching_record_details AS
SELECT r.id, r.teacher_email, r.kind, r.class_id, r.meeting_date, r.title, r.status, r.reviewer_note, r.updated_at,
  jsonb_strip_nulls(jsonb_build_object(
    'workflowVersion', d.workflow_version, 'syllabusId', d.syllabus_id, 'meetingNumber', d.meeting_number,
    'mainCoach', d.main_coach, 'assistantCoach', d.assistant_coach, 'room', d.room, 'notes', d.notes,
    'objectives', d.objectives, 'worksheetUrl', d.worksheet_url,
    'academicYear', s.academic_year, 'semester', s.semester, 'deadline', s.deadline::text,
    'description', s.description, 'values', s.learning_values, 'projects', s.projects,
    'projectDescription', s.project_description, 'outline', s.outline,
    'activities', l.activities, 'resources', l.resources, 'assessment', l.assessment,
    'teacherAttendance', j.teacher_attendance, 'reflection', j.reflection,
    'canvaUrl', m.canva_url, 'items', q.items, 'reason', q.reason, 'timing', q.timing
  )) || CASE WHEN r.kind = 'syllabus' AND (d.workflow_version = 2 OR EXISTS (SELECT 1 FROM syllabus_meetings sm WHERE sm.syllabus_id = r.id)) THEN jsonb_build_object('sessions', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('date', sm.meeting_date::text, 'time', to_char(sm.start_time, 'HH24:MI'), 'topic', sm.topic, 'phase', sm.phase) ORDER BY sm.position)
    FROM syllabus_meetings sm WHERE sm.syllabus_id = r.id
  ), '[]'::jsonb)) ELSE '{}'::jsonb END
  || CASE WHEN r.kind = 'lesson-plan' AND (d.workflow_version = 2 OR EXISTS (SELECT 1 FROM lesson_plan_steps ls WHERE ls.record_id = r.id)) THEN jsonb_build_object('steps', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('title', ls.title, 'phase', ls.phase, 'minutes', COALESCE(ls.minutes::text, ''), 'purpose', ls.purpose, 'teacherActivity', ls.teacher_activity, 'studentActivity', ls.student_activity) ORDER BY ls.position)
    FROM lesson_plan_steps ls WHERE ls.record_id = r.id
  ), '[]'::jsonb)) ELSE '{}'::jsonb END
  || CASE WHEN r.kind = 'meeting' THEN jsonb_build_object('students', COALESCE((
    SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id', sf.student_id, 'name', sf.student_name, 'attendance', sf.attendance, 'score', COALESCE(sf.score::text, ''), 'feedback', sf.feedback,
      'ratings', CASE WHEN sf.has_ratings THEN jsonb_build_object('affective', COALESCE(sf.affective::text, ''), 'problemSolving', COALESCE(sf.problem_solving::text, ''), 'storytelling', COALESCE(sf.storytelling::text, ''), 'performance', COALESCE(sf.performance::text, '')) END
    )) ORDER BY sf.position) FROM student_meeting_feedback sf WHERE sf.record_id = r.id
  ), '[]'::jsonb)) ELSE '{}'::jsonb END AS content,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name, 'mime', f.mime, 'size', COALESCE(f.size, octet_length(f.bytes))) ORDER BY f.position, f.id) FROM teaching_files f WHERE f.record_id = r.id), '[]'::jsonb) AS files,
  r.revision
FROM teaching_records r
JOIN teaching_documents d ON d.record_id = r.id
LEFT JOIN teaching_syllabuses s ON s.record_id = r.id
LEFT JOIN teaching_lesson_plans l ON l.record_id = r.id
LEFT JOIN teaching_meeting_journals j ON j.record_id = r.id
LEFT JOIN teaching_materials m ON m.record_id = r.id
LEFT JOIN class_requests q ON q.record_id = r.id;
