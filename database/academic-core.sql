CREATE TABLE IF NOT EXISTS academy_core_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  catalog_hash TEXT NOT NULL DEFAULT '',
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS institutions (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 160),
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  logo TEXT NOT NULL DEFAULT '',
  about TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  contact_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS klass_types (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 160),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  image TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coach_profiles (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 160),
  name TEXT NOT NULL,
  specialty TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('Lead Coach', 'Coach')),
  image TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  portal_email TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS student_profiles (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 160),
  institution_id TEXT REFERENCES institutions(id),
  name TEXT NOT NULL,
  grade TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  attendance INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS academic_periods (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 220),
  institution_id TEXT REFERENCES institutions(id),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS class_groups (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 160),
  klass_type_id TEXT NOT NULL REFERENCES klass_types(id),
  institution_id TEXT REFERENCES institutions(id),
  academic_period_id TEXT REFERENCES academic_periods(id),
  mode TEXT NOT NULL CHECK (mode IN ('Online', 'Onsite', 'Hybrid')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS class_schedules (
  class_group_id TEXT PRIMARY KEY REFERENCES class_groups(id) ON DELETE CASCADE,
  schedule_text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS coach_assignments (
  class_group_id TEXT NOT NULL REFERENCES class_groups(id) ON DELETE CASCADE,
  coach_id TEXT NOT NULL REFERENCES coach_profiles(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (class_group_id, coach_id)
);

CREATE TABLE IF NOT EXISTS enrollments (
  class_group_id TEXT NOT NULL REFERENCES class_groups(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES student_profiles(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'withdrawn')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (class_group_id, student_id)
);

CREATE TABLE IF NOT EXISTS submission_deadlines (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 260),
  class_group_id TEXT NOT NULL REFERENCES class_groups(id) ON DELETE CASCADE,
  academic_period_id TEXT REFERENCES academic_periods(id),
  kind TEXT NOT NULL CHECK (kind IN ('syllabus', 'lesson-plan', 'meeting', 'request')),
  meeting_date DATE NOT NULL,
  due_date DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS academy_events (
  id UUID PRIMARY KEY,
  actor_email TEXT NOT NULL,
  entity_kind TEXT NOT NULL CHECK (entity_kind IN ('klasses', 'institutions', 'coaches', 'students')),
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update')),
  before_data JSONB NOT NULL DEFAULT '{}',
  after_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE institutions ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE klass_types ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE coach_profiles ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE class_groups ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS class_groups_institution ON class_groups (institution_id) WHERE active;
CREATE INDEX IF NOT EXISTS coach_assignments_coach ON coach_assignments (coach_id);
CREATE INDEX IF NOT EXISTS enrollments_student ON enrollments (student_id);
CREATE INDEX IF NOT EXISTS submission_deadlines_group ON submission_deadlines (class_group_id, meeting_date);
CREATE INDEX IF NOT EXISTS academy_events_entity ON academy_events (entity_kind, entity_id, created_at DESC);

INSERT INTO academy_core_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
