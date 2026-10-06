CREATE TABLE IF NOT EXISTS teaching_records (
  id UUID PRIMARY KEY,
  teacher_email TEXT NOT NULL REFERENCES portal_users(email),
  kind TEXT NOT NULL CHECK (kind IN ('meeting', 'lesson-plan', 'syllabus', 'slides', 'request')),
  class_id TEXT NOT NULL,
  meeting_date DATE NOT NULL,
  title TEXT NOT NULL,
  content JSONB NOT NULL,
  files JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL CHECK (status IN ('Draft', 'Submitted', 'Approved', 'Needs revision', 'Rejected', 'Fulfilled')),
  reviewer_note TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (teacher_email, kind, class_id, meeting_date)
);

CREATE TABLE IF NOT EXISTS teaching_files (
  id UUID PRIMARY KEY,
  record_id UUID NOT NULL REFERENCES teaching_records(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  bytes BYTEA NOT NULL
);

CREATE TABLE IF NOT EXISTS teacher_notifications (
  id UUID PRIMARY KEY,
  teacher_email TEXT NOT NULL REFERENCES portal_users(email),
  record_id UUID REFERENCES teaching_records(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS teacher_notifications_owner ON teacher_notifications (teacher_email, created_at DESC);
