CREATE TABLE IF NOT EXISTS portal_file_objects (
  id UUID PRIMARY KEY,
  pathname TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL CHECK (provider IN ('blob', 'local')),
  size INTEGER NOT NULL CHECK (size BETWEEN 1 AND 1048576),
  sha256 TEXT NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  ready BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE teaching_files ALTER COLUMN bytes DROP NOT NULL;
ALTER TABLE teaching_files ADD COLUMN IF NOT EXISTS object_id UUID REFERENCES portal_file_objects(id);
ALTER TABLE academy_images ALTER COLUMN bytes DROP NOT NULL;
ALTER TABLE academy_images ADD COLUMN IF NOT EXISTS object_id UUID REFERENCES portal_file_objects(id);
ALTER TABLE teaching_records ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0);
CREATE INDEX IF NOT EXISTS teaching_files_object ON teaching_files (object_id);
CREATE INDEX IF NOT EXISTS academy_images_object ON academy_images (object_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'teaching_files'::regclass AND conname = 'teaching_files_source') THEN
    ALTER TABLE teaching_files ADD CONSTRAINT teaching_files_source CHECK ((bytes IS NULL) <> (object_id IS NULL));
    ALTER TABLE academy_images ADD CONSTRAINT academy_images_source CHECK ((bytes IS NULL) <> (object_id IS NULL));
  END IF;
END $$;
