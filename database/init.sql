CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS portal_users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('teacher', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO portal_users (email, password_hash, role) VALUES
  ('teacher@krya.global', '$2a$12$gjccHS/IAdCt0Nw3tneE0.Q/eFJJAF1POtzGFHGURFnuN1b7JgZPW', 'teacher'),
  ('admin@krya.global', '$2a$12$b9vsL7.tKN5dXFOpuMOylubG/D7SdV2X.4eBiRJs5FbW8YMNZSd9W', 'admin')
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role;
