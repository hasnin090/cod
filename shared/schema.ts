-- Enum for fund types
DO $$
BEGIN
   IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fund_type') THEN
      CREATE TYPE fund_type AS ENUM ('admin', 'project');
   END IF;
END$$;

-- Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE,
    password TEXT,
    plain_password TEXT,
    name TEXT NOT NULL,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    permissions JSONB NOT NULL DEFAULT '[]',
    active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    start_date TIMESTAMP NOT NULL,
    budget INTEGER DEFAULT 0,
    spent INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    progress INTEGER NOT NULL DEFAULT 0,
    created_by UUID NOT NULL REFERENCES users(id)
);

-- Employees
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    salary INTEGER NOT NULL DEFAULT 0,
    current_balance INTEGER NOT NULL DEFAULT 0,
    total_paid INTEGER NOT NULL DEFAULT 0,
    last_salary_reset TIMESTAMP DEFAULT NOW(),
    assigned_project_id UUID REFERENCES projects(id),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    hire_date TIMESTAMP NOT NULL DEFAULT NOW(),
    notes TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL,
    upload_date TIMESTAMP NOT NULL,
    project_id UUID REFERENCES projects(id),
    uploaded_by UUID NOT NULL REFERENCES users(id),
    is_manager_document BOOLEAN DEFAULT FALSE,
    category TEXT DEFAULT 'general',
    tags JSONB NOT NULL DEFAULT '[]'
);

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date TIMESTAMP NOT NULL,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL,
    expense_type TEXT,
    description TEXT NOT NULL,
    project_id UUID REFERENCES projects(id),
    created_by UUID NOT NULL REFERENCES users(id),
    employee_id UUID REFERENCES employees(id),
    file_url TEXT,
    file_type TEXT,
    archived BOOLEAN NOT NULL DEFAULT FALSE
);

-- Expense Types
CREATE TABLE IF NOT EXISTS expense_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    project_id UUID REFERENCES projects(id),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT name_project_unique UNIQUE(name, project_id)
);

-- UserProjects
CREATE TABLE IF NOT EXISTS user_projects (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    project_id UUID NOT NULL REFERENCES projects(id),
    assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
    assigned_by UUID NOT NULL REFERENCES users(id),
    CONSTRAINT user_project_unique UNIQUE(user_id, project_id)
);

-- Document-Transaction Links
CREATE TABLE IF NOT EXISTS document_transaction_links (
    id SERIAL PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES documents(id),
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    link_type TEXT NOT NULL DEFAULT 'receipt',
    linked_by UUID NOT NULL REFERENCES users(id),
    linked_at TIMESTAMP NOT NULL DEFAULT NOW(),
    notes TEXT,
    CONSTRAINT document_transaction_unique UNIQUE(document_id, transaction_id)
);

-- Activity Logs
CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    details TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    user_id UUID NOT NULL REFERENCES users(id)
);

-- Settings
CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    description TEXT
);

-- Transaction Edit Permissions
CREATE TABLE IF NOT EXISTS transaction_edit_permissions (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    project_id UUID REFERENCES projects(id),
    granted_by UUID NOT NULL REFERENCES users(id),
    granted_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    revoked_by UUID REFERENCES users(id),
    revoked_at TIMESTAMP,
    reason TEXT,
    notes TEXT,
    CONSTRAINT user_edit_permission_unique UNIQUE(user_id, is_active),
    CONSTRAINT project_edit_permission_unique UNIQUE(project_id, is_active)
);

-- Ledger Entries
CREATE TABLE IF NOT EXISTS ledger_entries (
    id SERIAL PRIMARY KEY,
    date TIMESTAMP NOT NULL,
    transaction_id UUID REFERENCES transactions(id),
    expense_type_id UUID REFERENCES expense_types(id),
    account_name TEXT,
    amount INTEGER NOT NULL,
    debit_amount INTEGER DEFAULT 0,
    credit_amount INTEGER DEFAULT 0,
    description TEXT NOT NULL,
    project_id UUID REFERENCES projects(id),
    entry_type TEXT NOT NULL,
    entry_date TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Funds
CREATE TABLE IF NOT EXISTS funds (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    balance INTEGER NOT NULL DEFAULT 0,
    type fund_type NOT NULL,
    owner_id UUID REFERENCES users(id),
    project_id UUID REFERENCES projects(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Account Categories
CREATE TABLE IF NOT EXISTS account_categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Deferred Payments
CREATE TABLE IF NOT EXISTS deferred_payments (
    id SERIAL PRIMARY KEY,
    beneficiary_name TEXT NOT NULL,
    total_amount INTEGER NOT NULL,
    paid_amount INTEGER NOT NULL DEFAULT 0,
    remaining_amount INTEGER NOT NULL,
    project_id UUID REFERENCES projects(id),
    user_id UUID NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'pending',
    description TEXT,
    due_date TIMESTAMP,
    installments INTEGER NOT NULL DEFAULT 1,
    payment_frequency TEXT NOT NULL DEFAULT 'monthly',
    notes TEXT,
    completed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Completed Works
CREATE TABLE IF NOT EXISTS completed_works (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    amount INTEGER,
    date TIMESTAMP NOT NULL,
    category TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    file_url TEXT,
    file_type TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Completed Works Documents
CREATE TABLE IF NOT EXISTS completed_works_documents (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER,
    category TEXT,
    tags TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
