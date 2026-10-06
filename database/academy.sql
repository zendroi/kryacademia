CREATE TABLE IF NOT EXISTS academy_catalog (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  content JSONB NOT NULL CHECK (jsonb_typeof(content) = 'object'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
