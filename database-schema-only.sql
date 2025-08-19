-- سكريبت سريع لإنشاء الجداول الأساسية فقط
-- Quick Database Schema Creation Script
-- For Cod Accounting System

-- إنشاء نوع التعداد للصناديق (مع التحقق من عدم الوجود)
DO $$ BEGIN
    CREATE TYPE fund_type AS ENUM ('admin', 'project');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;يبت سريع لإنشاء الجداول الأساسية فقط
-- Quick Database Schema Creation Script
-- For Cod Accounting System

-- إنشاء نوع التعداد للصناديق
CREATE TYPE fund_type AS ENUM ('admin', 'project');

-- الجداول الأساسية بالترتيب الصحيح (مع المراجع)

-- 1. المستخدمين
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    plain_password TEXT,
    name TEXT NOT NULL,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    permissions JSONB DEFAULT '[]'::jsonb NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true
);

-- 2. المشاريع
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    start_date TIMESTAMP NOT NULL,
    budget INTEGER DEFAULT 0,
    spent INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    progress INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER NOT NULL REFERENCES users(id)
);

-- 3. المعاملات
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    date TIMESTAMP NOT NULL,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL,
    expense_type TEXT,
    description TEXT NOT NULL,
    project_id INTEGER REFERENCES projects(id),
    created_by INTEGER NOT NULL REFERENCES users(id),
    employee_id INTEGER,
    file_url TEXT,
    file_type TEXT,
    archived BOOLEAN NOT NULL DEFAULT false
);

-- 4. ربط المستخدمين بالمشاريع
CREATE TABLE user_projects (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    project_id INTEGER NOT NULL REFERENCES projects(id),
    assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
    assigned_by INTEGER NOT NULL REFERENCES users(id),
    UNIQUE(user_id, project_id)
);

-- 5. المستندات
CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL,
    upload_date TIMESTAMP NOT NULL,
    project_id INTEGER REFERENCES projects(id),
    uploaded_by INTEGER NOT NULL REFERENCES users(id),
    is_manager_document BOOLEAN DEFAULT false,
    category TEXT DEFAULT 'general',
    tags JSONB DEFAULT '[]'::jsonb NOT NULL
);

-- 6. ربط المستندات بالمعاملات
CREATE TABLE document_transaction_links (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES documents(id),
    transaction_id INTEGER NOT NULL REFERENCES transactions(id),
    link_type TEXT NOT NULL DEFAULT 'receipt',
    linked_by INTEGER NOT NULL REFERENCES users(id),
    linked_at TIMESTAMP NOT NULL DEFAULT NOW(),
    notes TEXT,
    UNIQUE(document_id, transaction_id)
);

-- 7. سجل النشاطات
CREATE TABLE activity_logs (
    id SERIAL PRIMARY KEY,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    details TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    user_id INTEGER NOT NULL REFERENCES users(id)
);

-- 8. الإعدادات
CREATE TABLE settings (
    id SERIAL PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    description TEXT
);

-- 9. صلاحيات تعديل المعاملات
CREATE TABLE transaction_edit_permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    project_id INTEGER REFERENCES projects(id),
    granted_by INTEGER NOT NULL REFERENCES users(id),
    granted_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    revoked_by INTEGER REFERENCES users(id),
    revoked_at TIMESTAMP,
    reason TEXT,
    notes TEXT
);

-- 10. أنواع المصروفات
CREATE TABLE expense_types (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    project_id INTEGER REFERENCES projects(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(name, project_id)
);

-- 11. دفتر الأستاذ
CREATE TABLE ledger_entries (
    id SERIAL PRIMARY KEY,
    date TIMESTAMP NOT NULL,
    transaction_id INTEGER REFERENCES transactions(id),
    expense_type_id INTEGER REFERENCES expense_types(id),
    account_name TEXT,
    amount INTEGER NOT NULL,
    debit_amount INTEGER DEFAULT 0,
    credit_amount INTEGER DEFAULT 0,
    description TEXT NOT NULL,
    project_id INTEGER REFERENCES projects(id),
    entry_type TEXT NOT NULL,
    entry_date TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 12. الصناديق
CREATE TABLE funds (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    balance INTEGER NOT NULL DEFAULT 0,
    type fund_type NOT NULL,
    owner_id INTEGER REFERENCES users(id),
    project_id INTEGER REFERENCES projects(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 13. الموظفين
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    salary INTEGER NOT NULL DEFAULT 0,
    current_balance INTEGER NOT NULL DEFAULT 0,
    total_paid INTEGER NOT NULL DEFAULT 0,
    last_salary_reset TIMESTAMP DEFAULT NOW(),
    assigned_project_id INTEGER REFERENCES projects(id),
    active BOOLEAN NOT NULL DEFAULT true,
    hire_date TIMESTAMP NOT NULL DEFAULT NOW(),
    notes TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 14. تصنيفات الحسابات
CREATE TABLE account_categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 15. الدفعات المؤجلة
CREATE TABLE deferred_payments (
    id SERIAL PRIMARY KEY,
    beneficiary_name TEXT NOT NULL,
    total_amount INTEGER NOT NULL,
    paid_amount INTEGER NOT NULL DEFAULT 0,
    remaining_amount INTEGER NOT NULL,
    project_id INTEGER REFERENCES projects(id),
    user_id INTEGER REFERENCES users(id) NOT NULL,
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

-- 16. الأعمال المنجزة
CREATE TABLE completed_works (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    amount INTEGER,
    date TIMESTAMP NOT NULL,
    category TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    file_url TEXT,
    file_type TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 17. مستندات الأعمال المنجزة
CREATE TABLE completed_works_documents (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER,
    category TEXT,
    tags TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- الفهارس للأداء
CREATE INDEX idx_transactions_project_id ON transactions(project_id);
CREATE INDEX idx_transactions_created_by ON transactions(created_by);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_documents_project_id ON documents(project_id);
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_user_projects_user_id ON user_projects(user_id);
CREATE INDEX idx_user_projects_project_id ON user_projects(project_id);

-- اكتمل إنشاء الجداول
