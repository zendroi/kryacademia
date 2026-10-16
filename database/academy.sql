CREATE TABLE IF NOT EXISTS academy_catalog (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  content JSONB NOT NULL CHECK (jsonb_typeof(content) = 'object'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS academy_images (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 180),
  mime TEXT NOT NULL CHECK (mime = 'image/webp'),
  bytes BYTEA NOT NULL CHECK (octet_length(bytes) BETWEEN 1 AND 524288),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
