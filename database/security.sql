ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT '';
ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'suspended', 'rejected'));
ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS review_note TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS portal_sessions (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL REFERENCES portal_users(email) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS portal_sessions_owner ON portal_sessions (email);
CREATE INDEX IF NOT EXISTS portal_sessions_expiry ON portal_sessions (expires_at);

CREATE TABLE IF NOT EXISTS portal_rate_limits (
  key TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempts INTEGER NOT NULL DEFAULT 1 CHECK (attempts > 0)
);
CREATE INDEX IF NOT EXISTS portal_rate_limits_expiry ON portal_rate_limits (window_start);

CREATE TABLE IF NOT EXISTS portal_account_events (
  id UUID PRIMARY KEY,
  actor_email TEXT NOT NULL,
  target_email TEXT NOT NULL,
  action TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
