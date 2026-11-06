CREATE TABLE IF NOT EXISTS teacher_onboarding (
  email TEXT PRIMARY KEY REFERENCES portal_users(email) ON DELETE CASCADE,
  invitation_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  bank_name TEXT NOT NULL DEFAULT '' CHECK (length(bank_name) <= 100),
  bank_account TEXT NOT NULL DEFAULT '' CHECK (length(bank_account) <= 40),
  account_holder TEXT NOT NULL DEFAULT '' CHECK (length(account_holder) <= 120),
  identity_object_id UUID REFERENCES portal_file_objects(id),
  CHECK (completed_at IS NULL OR identity_object_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS teacher_onboarding_identity ON teacher_onboarding (identity_object_id);

ALTER TABLE class_meetings ADD COLUMN IF NOT EXISTS canva_url TEXT NOT NULL DEFAULT '';
ALTER TABLE class_meetings ADD COLUMN IF NOT EXISTS worksheet_url TEXT NOT NULL DEFAULT '';
