CREATE TABLE IF NOT EXISTS inquiries (
  id UUID PRIMARY KEY,
  submission_hash TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  email TEXT NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
  phone TEXT NOT NULL CHECK (length(phone) BETWEEN 8 AND 30),
  place TEXT NOT NULL CHECK (length(place) BETWEEN 1 AND 120),
  type TEXT NOT NULL CHECK (type IN ('Workshop', 'Klass', 'Program', 'School Partnership', 'Event', 'Other')),
  affiliation TEXT NOT NULL CHECK (affiliation IN ('Institution', 'Parent', 'Non-institution')),
  institution TEXT NOT NULL DEFAULT '' CHECK (length(institution) <= 180),
  message TEXT NOT NULL CHECK (length(message) BETWEEN 1 AND 5000),
  language TEXT NOT NULL CHECK (language IN ('en', 'id', 'zh')),
  details JSONB NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(details) = 'object'),
  consent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Contacted', 'Resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (affiliation != 'Institution' OR length(institution) > 0)
);

CREATE INDEX IF NOT EXISTS inquiries_received ON inquiries (created_at DESC);
CREATE INDEX IF NOT EXISTS inquiries_email_received ON inquiries (email, created_at DESC);
