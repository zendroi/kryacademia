ALTER TABLE submission_deadlines ADD COLUMN IF NOT EXISTS request_timing TEXT NOT NULL DEFAULT ''
  CHECK (request_timing IN ('', 'Before class', 'Before semester'));

CREATE TABLE IF NOT EXISTS notification_jobs (
  id UUID PRIMARY KEY,
  dedupe_key TEXT NOT NULL UNIQUE CHECK (length(dedupe_key) BETWEEN 1 AND 600),
  teacher_email TEXT NOT NULL REFERENCES portal_users(email) ON DELETE CASCADE,
  record_id UUID REFERENCES teaching_records(id) ON DELETE CASCADE,
  class_id TEXT REFERENCES class_groups(id) ON DELETE CASCADE,
  deadline_id TEXT,
  due_date DATE,
  stage TEXT CHECK (stage IN ('h3', 'h1', 'overdue')),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 260),
  message TEXT NOT NULL CHECK (length(message) BETWEEN 1 AND 2400),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed', 'cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  last_error TEXT NOT NULL DEFAULT '',
  retried_by TEXT,
  retried_at TIMESTAMPTZ,
  CHECK ((deadline_id IS NULL AND due_date IS NULL AND stage IS NULL) OR (deadline_id IS NOT NULL AND due_date IS NOT NULL AND stage IS NOT NULL AND class_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS notification_jobs_due ON notification_jobs (available_at, created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS notification_jobs_recent ON notification_jobs (created_at DESC);

ALTER TABLE teacher_notifications ADD COLUMN IF NOT EXISTS source_job_id UUID REFERENCES notification_jobs(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS teacher_notifications_job ON teacher_notifications (source_job_id) WHERE source_job_id IS NOT NULL;

CREATE OR REPLACE VIEW notification_deadline_tasks AS
SELECT DISTINCT u.email AS teacher_email, d.id AS deadline_id, g.id AS class_id, t.title AS klass,
  d.kind, d.request_timing, d.meeting_date, d.due_date, r.id AS record_id
FROM submission_deadlines d
JOIN class_groups g ON g.id = d.class_group_id AND g.active
JOIN klass_types t ON t.id = g.klass_type_id AND t.active
JOIN coach_assignments a ON a.class_group_id = g.id
JOIN coach_profiles c ON c.id = a.coach_id AND c.active
JOIN portal_users u ON u.email = c.portal_email AND u.role = 'teacher' AND u.status = 'active'
LEFT JOIN teaching_records r ON r.teacher_email = u.email AND r.class_id = g.id AND r.kind = d.kind AND r.meeting_date = d.meeting_date
WHERE (r.id IS NULL OR r.status NOT IN ('Submitted', 'Approved', 'Fulfilled'))
  AND (d.kind != 'request' OR d.request_timing != '');
