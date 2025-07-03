-- إنشاء قاعدة بيانات Supabase للنظام المحاسبي العربي
-- يجب تنفيذ هذا الملف في Supabase SQL Editor

-- Enable Row Level Security
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret-here';

-- إنشاء جدول المستخدمين
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user', 'viewer')),
    permissions TEXT[] DEFAULT '{}',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- إنشاء جدول المشاريع
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    budget DECIMAL(15,2) DEFAULT 0,
    spent DECIMAL(15,2) DEFAULT 0,
    start_date DATE,
    end_date DATE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- إنشاء جدول أنواع المصروفات
CREATE TABLE IF NOT EXISTS expense_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- إنشاء جدول الموظفين
CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    salary DECIMAL(15,2) DEFAULT 0,
    assigned_project_id INTEGER REFERENCES projects(id),
    active BOOLEAN DEFAULT true,
    hire_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- إنشاء جدول المعاملات المالية
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
    amount DECIMAL(15,2) NOT NULL,
    description TEXT NOT NULL,
    date DATE NOT NULL,
    project_id INTEGER REFERENCES projects(id),
    expense_type_id INTEGER REFERENCES expense_types(id),
    employee_id INTEGER REFERENCES employees(id),
    file_url TEXT,
    file_type VARCHAR(50),
    file_size INTEGER,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- إنشاء جدول المستندات
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    file_type VARCHAR(50),
    file_size INTEGER,
    tags TEXT[] DEFAULT '{}',
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- إنشاء جدول ربط المستندات بالمعاملات
CREATE TABLE IF NOT EXISTS document_transaction_links (
    id SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
    transaction_id INTEGER REFERENCES transactions(id) ON DELETE CASCADE,
    linked_by INTEGER REFERENCES users(id),
    linked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(document_id, transaction_id)
);

-- إنشاء جدول الإعدادات
CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    type VARCHAR(20) DEFAULT 'string' CHECK (type IN ('string', 'number', 'boolean', 'json')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- إنشاء جدول سجل الأنشطة
CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INTEGER,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- إنشاء جدول دفتر الأستاذ
CREATE TABLE IF NOT EXISTS ledger_entries (
    id SERIAL PRIMARY KEY,
    account_name VARCHAR(100) NOT NULL,
    debit_amount DECIMAL(15,2) DEFAULT 0,
    credit_amount DECIMAL(15,2) DEFAULT 0,
    description TEXT,
    transaction_id INTEGER REFERENCES transactions(id),
    expense_type_id INTEGER REFERENCES expense_types(id),
    entry_date DATE NOT NULL,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- إنشاء جدول الأعمال المنجزة
CREATE TABLE IF NOT EXISTS completed_works (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    amount DECIMAL(15,2) DEFAULT 0,
    client_name VARCHAR(100),
    completion_date DATE,
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('completed', 'invoiced', 'paid')),
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- إنشاء جدول مستندات الأعمال المنجزة
CREATE TABLE IF NOT EXISTS completed_works_documents (
    id SERIAL PRIMARY KEY,
    completed_work_id INTEGER REFERENCES completed_works(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_type VARCHAR(50),
    file_size INTEGER,
    original_name VARCHAR(200),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- إنشاء جدول المستحقات
CREATE TABLE IF NOT EXISTS receivables (
    id SERIAL PRIMARY KEY,
    beneficiary_name VARCHAR(100) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    description TEXT,
    due_date DATE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'partially_paid', 'paid', 'overdue')),
    total_paid DECIMAL(15,2) DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- إنشاء جدول دفعات المستحقات
CREATE TABLE IF NOT EXISTS receivable_payments (
    id SERIAL PRIMARY KEY,
    receivable_id INTEGER REFERENCES receivables(id) ON DELETE CASCADE,
    amount DECIMAL(15,2) NOT NULL,
    payment_date DATE NOT NULL,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- إنشاء الفهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_project_id ON transactions(project_id);
CREATE INDEX IF NOT EXISTS idx_transactions_expense_type_id ON transactions(expense_type_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_date ON ledger_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_account ON ledger_entries(account_name);

-- إنشاء الدوال المساعدة
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- إنشاء المحفزات لتحديث updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_expense_types_updated_at BEFORE UPDATE ON expense_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_completed_works_updated_at BEFORE UPDATE ON completed_works FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_receivables_updated_at BEFORE UPDATE ON receivables FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- إدراج البيانات الأساسية
INSERT INTO users (username, name, email, password_hash, role, permissions) VALUES
('admin', 'مدير النظام', 'admin@example.com', '$2b$10$example_hash', 'admin', 
 ARRAY['view_dashboard', 'manage_users', 'view_users', 'manage_projects', 'view_projects', 
       'manage_project_transactions', 'view_project_transactions', 'manage_transactions', 
       'view_transactions', 'manage_documents', 'view_documents', 'view_reports', 
       'view_activity_logs', 'manage_settings'])
ON CONFLICT (username) DO NOTHING;

INSERT INTO settings (key, value, description, type) VALUES
('companyName', 'شركة العراق للمحاسبة', 'اسم الشركة', 'string'),
('currency', 'IQD', 'العملة الافتراضية', 'string'),
('backupEnabled', 'true', 'تفعيل النسخ الاحتياطي', 'boolean'),
('maxFileSize', '10485760', 'الحد الأقصى لحجم الملف (بايت)', 'number')
ON CONFLICT (key) DO NOTHING;

INSERT INTO expense_types (name, description) VALUES
('راتب', 'رواتب الموظفين والأجور'),
('قرطاسية', 'المواد المكتبية والقرطاسية'),
('وقود', 'تكاليف الوقود والنقل'),
('صيانة', 'أعمال الصيانة والإصلاح'),
('إيجار', 'إيجار المكاتب والمعدات')
ON CONFLICT DO NOTHING;

-- تفعيل Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- إنشاء سياسات الأمان (مبسطة للبداية)
CREATE POLICY "Enable read for authenticated users" ON users
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all for authenticated users" ON projects
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all for authenticated users" ON transactions
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all for authenticated users" ON documents
    FOR ALL USING (auth.role() = 'authenticated');

-- إنشاء view للإحصائيات
CREATE OR REPLACE VIEW financial_summary AS
SELECT 
    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expenses,
    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) as balance,
    COUNT(*) as transaction_count
FROM transactions;

-- إنشاء view للمشاريع مع الإحصائيات
CREATE OR REPLACE VIEW projects_with_stats AS
SELECT 
    p.*,
    COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) as total_income,
    COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as total_expenses,
    COUNT(t.id) as transaction_count
FROM projects p
LEFT JOIN transactions t ON p.id = t.project_id
GROUP BY p.id, p.name, p.description, p.budget, p.spent, p.start_date, p.end_date, p.status, p.created_by, p.created_at, p.updated_at;

COMMENT ON DATABASE postgres IS 'قاعدة بيانات نظام المحاسبة العربي - تم إنشاؤها للعمل مع Supabase';