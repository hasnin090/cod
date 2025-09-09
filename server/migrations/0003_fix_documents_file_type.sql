-- Ensure file_type column exists in documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_type text NOT NULL DEFAULT 'application/octet-stream';

-- Update existing records without file_type
UPDATE documents SET file_type = 'application/octet-stream' WHERE file_type IS NULL;

-- Make sure the column is not null
ALTER TABLE documents ALTER COLUMN file_type SET NOT NULL;
