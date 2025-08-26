-- Migration for completed works and completed works documents
-- Run after 0001_init.sql

-- Completed works table
CREATE TABLE IF NOT EXISTS completed_works (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    amount INTEGER, -- Optional amount, doesn't affect system balance
    date TIMESTAMPTZ NOT NULL,
    category TEXT, -- Optional category
    status TEXT NOT NULL DEFAULT 'active', -- active, archived
    file_url TEXT, -- Attached file if any
    file_type TEXT, -- File type if any
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Completed works documents table
CREATE TABLE IF NOT EXISTS completed_works_documents (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL,
    category TEXT,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    upload_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_work_id INTEGER REFERENCES completed_works(id) ON DELETE SET NULL,
    uploaded_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_completed_works_status ON completed_works(status);
CREATE INDEX IF NOT EXISTS idx_completed_works_created_by ON completed_works(created_by);
CREATE INDEX IF NOT EXISTS idx_completed_works_date ON completed_works(date);
CREATE INDEX IF NOT EXISTS idx_completed_works_documents_category ON completed_works_documents(category);
CREATE INDEX IF NOT EXISTS idx_completed_works_documents_uploaded_by ON completed_works_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_completed_works_documents_work_id ON completed_works_documents(completed_work_id);

-- Update triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_completed_works_updated_at 
    BEFORE UPDATE ON completed_works 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_completed_works_documents_updated_at 
    BEFORE UPDATE ON completed_works_documents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
