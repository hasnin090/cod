-- سكريبت آمن لإنشاء الجداول (مع التحقق من عدم الوجود)
-- Safe Database Creation Script - Won't fail if tables exist
-- For Cod Accounting System

-- إنشاء نوع التعداد للصناديق (مع التحقق من عدم الوجود)
DO $$ BEGIN
    CREATE TYPE fund_type AS ENUM ('admin', 'project');
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'Type fund_type already exists, skipping...';
END $$;

-- 1. جدول المستخدمين (users)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    plain_password TEXT, -- كلمة المرور الأصلية للعرض
    name TEXT NOT NULL,
    email TEXT, -- البريد الإلكتروني اختياري
    role TEXT NOT NULL DEFAULT 'user', -- admin, user, manager, viewer
    permissions JSONB DEFAULT '[]'::jsonb NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true
);

-- إضافة الأعمدة المفقودة إذا لم تكن موجودة
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'plain_password') THEN
        ALTER TABLE users ADD COLUMN plain_password TEXT;
        RAISE NOTICE 'Added plain_password column to users table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'permissions') THEN
        ALTER TABLE users ADD COLUMN permissions JSONB DEFAULT '[]'::jsonb NOT NULL;
        RAISE NOTICE 'Added permissions column to users table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'active') THEN
        ALTER TABLE users ADD COLUMN active BOOLEAN NOT NULL DEFAULT true;
        RAISE NOTICE 'Added active column to users table';
    END IF;
END $$;

-- 2. جدول المشاريع (projects)
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    start_date TIMESTAMP NOT NULL,
    budget INTEGER DEFAULT 0, -- الميزانية المخطط لها
    spent INTEGER DEFAULT 0, -- المبلغ المنفق
    status TEXT NOT NULL DEFAULT 'active', -- active, completed, paused
    progress INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER NOT NULL REFERENCES users(id)
);

-- إضافة الأعمدة المفقودة للمشاريع إذا لم تكن موجودة
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'projects' AND column_name = 'budget') THEN
        ALTER TABLE projects ADD COLUMN budget INTEGER DEFAULT 0;
        RAISE NOTICE 'Added budget column to projects table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'projects' AND column_name = 'spent') THEN
        ALTER TABLE projects ADD COLUMN spent INTEGER DEFAULT 0;
        RAISE NOTICE 'Added spent column to projects table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'projects' AND column_name = 'progress') THEN
        ALTER TABLE projects ADD COLUMN progress INTEGER NOT NULL DEFAULT 0;
        RAISE NOTICE 'Added progress column to projects table';
    END IF;
END $$;

-- 3. جدول المعاملات (transactions)
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    date TIMESTAMP NOT NULL,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL, -- income, expense
    expense_type TEXT, -- نوع المصروف: راتب أو صرف مشروع أو عادي
    description TEXT NOT NULL,
    project_id INTEGER REFERENCES projects(id),
    created_by INTEGER NOT NULL REFERENCES users(id),
    employee_id INTEGER, -- مرجع للموظف في حالة الراتب
    file_url TEXT, -- URL للملف المرفق (اختياري)
    file_type TEXT, -- نوع الملف المرفق (اختياري)
    archived BOOLEAN NOT NULL DEFAULT false -- أرشفة المعاملة
);

-- إضافة الأعمدة المفقودة للمعاملات إذا لم تكن موجودة
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'transactions' AND column_name = 'file_url') THEN
        ALTER TABLE transactions ADD COLUMN file_url TEXT;
        RAISE NOTICE 'Added file_url column to transactions table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'transactions' AND column_name = 'file_type') THEN
        ALTER TABLE transactions ADD COLUMN file_type TEXT;
        RAISE NOTICE 'Added file_type column to transactions table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'transactions' AND column_name = 'archived') THEN
        ALTER TABLE transactions ADD COLUMN archived BOOLEAN NOT NULL DEFAULT false;
        RAISE NOTICE 'Added archived column to transactions table';
    END IF;
END $$;

-- 4. جدول ربط المستخدمين بالمشاريع (user_projects)
CREATE TABLE IF NOT EXISTS user_projects (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    project_id INTEGER NOT NULL REFERENCES projects(id),
    assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
    assigned_by INTEGER NOT NULL REFERENCES users(id)
);

-- إضافة القيد الفريد إذا لم يكن موجوداً
DO $$ BEGIN
    ALTER TABLE user_projects ADD CONSTRAINT user_projects_user_id_project_id_unique UNIQUE(user_id, project_id);
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'Constraint user_projects_user_id_project_id_unique already exists, skipping...';
END $$;

-- 5. جدول المستندات (documents)
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL,
    upload_date TIMESTAMP NOT NULL,
    project_id INTEGER REFERENCES projects(id),
    uploaded_by INTEGER NOT NULL REFERENCES users(id),
    is_manager_document BOOLEAN DEFAULT false, -- مستند خاص بالإدارة أم المشاريع
    category TEXT DEFAULT 'general', -- تصنيف المستند: receipt, contract, general, etc.
    tags JSONB DEFAULT '[]'::jsonb NOT NULL -- علامات للتنظيم
);

-- إضافة الأعمدة المفقودة إذا لم تكن موجودة
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'documents' AND column_name = 'is_manager_document') THEN
        ALTER TABLE documents ADD COLUMN is_manager_document BOOLEAN DEFAULT false;
        RAISE NOTICE 'Added is_manager_document column to documents table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'documents' AND column_name = 'category') THEN
        ALTER TABLE documents ADD COLUMN category TEXT DEFAULT 'general';
        RAISE NOTICE 'Added category column to documents table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'documents' AND column_name = 'tags') THEN
        ALTER TABLE documents ADD COLUMN tags JSONB DEFAULT '[]'::jsonb NOT NULL;
        RAISE NOTICE 'Added tags column to documents table';
    END IF;
END $$;

-- 6. جدول ربط المستندات بالمعاملات (document_transaction_links)
CREATE TABLE IF NOT EXISTS document_transaction_links (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES documents(id),
    transaction_id INTEGER NOT NULL REFERENCES transactions(id),
    link_type TEXT NOT NULL DEFAULT 'receipt', -- receipt, contract, invoice, etc.
    linked_by INTEGER NOT NULL REFERENCES users(id),
    linked_at TIMESTAMP NOT NULL DEFAULT NOW(),
    notes TEXT -- ملاحظات إضافية عن الربط
);

-- إضافة القيد الفريد للربط
DO $$ BEGIN
    ALTER TABLE document_transaction_links ADD CONSTRAINT document_transaction_links_unique UNIQUE(document_id, transaction_id);
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'Constraint document_transaction_links_unique already exists, skipping...';
END $$;

-- 7. جدول سجل النشاطات (activity_logs)
CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    action TEXT NOT NULL, -- create, update, delete
    entity_type TEXT NOT NULL, -- transaction, project, user, document
    entity_id INTEGER NOT NULL,
    details TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    user_id INTEGER NOT NULL REFERENCES users(id)
);

-- 8. جدول الإعدادات (settings)
CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    description TEXT
);

-- 9. جدول صلاحيات تعديل المعاملات (transaction_edit_permissions)
CREATE TABLE IF NOT EXISTS transaction_edit_permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id), -- المستخدم المخول
    project_id INTEGER REFERENCES projects(id), -- أو المشروع المخول
    granted_by INTEGER NOT NULL REFERENCES users(id), -- من منح الصلاحية
    granted_at TIMESTAMP NOT NULL DEFAULT NOW(), -- متى منح الصلاحية
    expires_at TIMESTAMP NOT NULL, -- انتهاء الصلاحية (42 ساعة)
    is_active BOOLEAN NOT NULL DEFAULT true, -- فعال أم لا
    revoked_by INTEGER REFERENCES users(id), -- من ألغى الصلاحية
    revoked_at TIMESTAMP, -- متى ألغيت الصلاحية
    reason TEXT, -- سبب منح الصلاحية
    notes TEXT -- ملاحظات إضافية
);

-- 10. جدول أنواع المصروفات (expense_types)
CREATE TABLE IF NOT EXISTS expense_types (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    project_id INTEGER REFERENCES projects(id), -- نوع خاص بمشروع محدد
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- إضافة عمود project_id إذا لم يكن موجوداً
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'expense_types' AND column_name = 'project_id') THEN
        ALTER TABLE expense_types ADD COLUMN project_id INTEGER REFERENCES projects(id);
        RAISE NOTICE 'Added project_id column to expense_types table';
    END IF;
END $$;

-- إضافة القيد الفريد لأنواع المصروفات
DO $$ BEGIN
    ALTER TABLE expense_types ADD CONSTRAINT expense_types_name_project_id_unique UNIQUE(name, project_id);
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'Constraint expense_types_name_project_id_unique already exists, skipping...';
END $$;

-- 11. جدول دفتر الأستاذ (ledger_entries)
CREATE TABLE IF NOT EXISTS ledger_entries (
    id SERIAL PRIMARY KEY,
    date TIMESTAMP NOT NULL,
    transaction_id INTEGER REFERENCES transactions(id),
    expense_type_id INTEGER REFERENCES expense_types(id),
    account_name TEXT, -- اسم الحساب الدفتري أو التصنيفي
    amount INTEGER NOT NULL,
    debit_amount INTEGER DEFAULT 0, -- المبلغ المدين
    credit_amount INTEGER DEFAULT 0, -- المبلغ الدائن
    description TEXT NOT NULL,
    project_id INTEGER REFERENCES projects(id),
    entry_type TEXT NOT NULL, -- "classified" أو "miscellaneous" أو "deferred"
    entry_date TIMESTAMP DEFAULT NOW(), -- تاريخ الإدخال
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 12. جدول الصناديق (funds)
CREATE TABLE IF NOT EXISTS funds (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    balance INTEGER NOT NULL DEFAULT 0,
    type fund_type NOT NULL,
    owner_id INTEGER REFERENCES users(id), -- مالك الصندوق
    project_id INTEGER REFERENCES projects(id), -- مالك المشروع
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 13. جدول الموظفين (employees)
CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    salary INTEGER NOT NULL DEFAULT 0, -- المرتب الشهري المحدد
    current_balance INTEGER NOT NULL DEFAULT 0, -- الرصيد الحالي من المرتب
    total_paid INTEGER NOT NULL DEFAULT 0, -- إجمالي المدفوع منذ البداية
    last_salary_reset TIMESTAMP DEFAULT NOW(), -- آخر إعادة تصفير المرتب
    assigned_project_id INTEGER REFERENCES projects(id),
    active BOOLEAN NOT NULL DEFAULT true,
    hire_date TIMESTAMP NOT NULL DEFAULT NOW(),
    notes TEXT, -- ملاحظات إضافية
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- إضافة الأعمدة المفقودة للموظفين إذا لم تكن موجودة
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'employees' AND column_name = 'current_balance') THEN
        ALTER TABLE employees ADD COLUMN current_balance INTEGER NOT NULL DEFAULT 0;
        RAISE NOTICE 'Added current_balance column to employees table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'employees' AND column_name = 'total_paid') THEN
        ALTER TABLE employees ADD COLUMN total_paid INTEGER NOT NULL DEFAULT 0;
        RAISE NOTICE 'Added total_paid column to employees table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'employees' AND column_name = 'last_salary_reset') THEN
        ALTER TABLE employees ADD COLUMN last_salary_reset TIMESTAMP DEFAULT NOW();
        RAISE NOTICE 'Added last_salary_reset column to employees table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'employees' AND column_name = 'notes') THEN
        ALTER TABLE employees ADD COLUMN notes TEXT;
        RAISE NOTICE 'Added notes column to employees table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'employees' AND column_name = 'updated_at') THEN
        ALTER TABLE employees ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT NOW();
        RAISE NOTICE 'Added updated_at column to employees table';
    END IF;
END $$;

-- 14. جدول تصنيفات الحسابات (account_categories)
CREATE TABLE IF NOT EXISTS account_categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 15. جدول الدفعات المؤجلة (deferred_payments)
CREATE TABLE IF NOT EXISTS deferred_payments (
    id SERIAL PRIMARY KEY,
    beneficiary_name TEXT NOT NULL, -- اسم المستفيد
    total_amount INTEGER NOT NULL, -- المبلغ الإجمالي
    paid_amount INTEGER NOT NULL DEFAULT 0, -- المبلغ المدفوع
    remaining_amount INTEGER NOT NULL, -- المبلغ المتبقي
    project_id INTEGER REFERENCES projects(id),
    user_id INTEGER REFERENCES users(id) NOT NULL, -- من أنشأ الدفعة
    status TEXT NOT NULL DEFAULT 'pending', -- pending, completed
    description TEXT, -- وصف الدفعة
    due_date TIMESTAMP, -- تاريخ الاستحقاق
    installments INTEGER NOT NULL DEFAULT 1, -- عدد الأقساط
    payment_frequency TEXT NOT NULL DEFAULT 'monthly', -- monthly, quarterly, yearly
    notes TEXT, -- ملاحظات إضافية
    completed_at TIMESTAMP, -- تاريخ الإكمال
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 16. جدول الأعمال المنجزة (completed_works)
CREATE TABLE IF NOT EXISTS completed_works (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    amount INTEGER, -- مبلغ اختياري، لا يؤثر على رصيد النظام
    date TIMESTAMP NOT NULL,
    category TEXT, -- تصنيف اختياري
    status TEXT NOT NULL DEFAULT 'active', -- active, archived
    file_url TEXT, -- ملف مرفق إن وجد
    file_type TEXT, -- نوع الملف إن وجد
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 17. جدول مستندات الأعمال المنجزة (completed_works_documents)
CREATE TABLE IF NOT EXISTS completed_works_documents (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER,
    category TEXT, -- تصنيف اختياري
    tags TEXT, -- علامات مفصولة بفواصل للتنظيم
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- إنشاء فهارس للأداء (مع التحقق من عدم الوجود)
CREATE INDEX IF NOT EXISTS idx_transactions_project_id ON transactions(project_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_by ON transactions(created_by);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_user_projects_user_id ON user_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_user_projects_project_id ON user_projects(project_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_transaction_id ON ledger_entries(transaction_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_project_id ON ledger_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_expense_types_project_id ON expense_types(project_id);
CREATE INDEX IF NOT EXISTS idx_employees_assigned_project_id ON employees(assigned_project_id);

-- إدراج البيانات الافتراضية (مع تجنب التكرار)
-- إنشاء مستخدم المدير الافتراضي
INSERT INTO users (username, password, name, email, role, permissions) 
SELECT 'admin', '$2a$10$tGpYHuFdhQ1w6gXLGwlO3.7BxP/4uKfCOHlJv6b5Dy5L1M8cQw8we', 'مدير النظام', 'admin@admin.com', 'admin', '["manage_users", "manage_projects", "manage_transactions", "view_reports"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin');

-- إنشاء الإعدادات الافتراضية
INSERT INTO settings (key, value, description) VALUES 
('companyName', 'شركة تقنية للمقاولات', 'اسم الشركة'),
('currency', 'د.ع', 'رمز العملة'),
('defaultProjectBudget', '1000000', 'الميزانية الافتراضية للمشاريع'),
('maxFileSize', '20971520', 'أقصى حجم للملفات المرفوعة (20MB)'),
('backupFrequency', 'daily', 'تكرار النسخ الاحتياطية')
ON CONFLICT (key) DO NOTHING;

-- إنشاء صندوق المدير الافتراضي
INSERT INTO funds (name, balance, type, owner_id) 
SELECT 'صندوق المدير الرئيسي', 1000000, 'admin', 1
WHERE NOT EXISTS (SELECT 1 FROM funds WHERE name = 'صندوق المدير الرئيسي');

-- إنشاء أنواع المصروفات الافتراضية
INSERT INTO expense_types (name, description, is_active) VALUES 
('راتب', 'مصروفات الرواتب والأجور', true),
('مواد بناء', 'مواد البناء والإنشاء', true),
('نقل ومواصلات', 'مصروفات النقل والمواصلات', true),
('أدوات ومعدات', 'الأدوات والمعدات المختلفة', true),
('خدمات عامة', 'الخدمات العامة والاستشارات', true),
('صيانة', 'أعمال الصيانة والإصلاح', true)
ON CONFLICT (name, project_id) DO NOTHING;

-- إنشاء تصنيفات الحسابات الافتراضية
INSERT INTO account_categories (name, description, created_by) 
SELECT * FROM (VALUES 
('الأصول', 'الأصول الثابتة والمتداولة', 1),
('الخصوم', 'الالتزامات والديون', 1),
('رأس المال', 'رؤوس الأموال والاستثمارات', 1),
('الإيرادات', 'إيرادات المشاريع والعمليات', 1),
('المصروفات', 'المصروفات التشغيلية والإدارية', 1)
) AS new_data(name, description, created_by)
WHERE NOT EXISTS (SELECT 1 FROM account_categories WHERE account_categories.name = new_data.name);

-- إنشاء دالة لتحديث الـ updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- تطبيق الدالة على الجداول المناسبة (مع تجنب التكرار)
DO $$ BEGIN
    CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'Trigger update_projects_updated_at already exists, skipping...';
END $$;

DO $$ BEGIN
    CREATE TRIGGER update_funds_updated_at BEFORE UPDATE ON funds FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'Trigger update_funds_updated_at already exists, skipping...';
END $$;

DO $$ BEGIN
    CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'Trigger update_employees_updated_at already exists, skipping...';
END $$;

DO $$ BEGIN
    CREATE TRIGGER update_expense_types_updated_at BEFORE UPDATE ON expense_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'Trigger update_expense_types_updated_at already exists, skipping...';
END $$;

DO $$ BEGIN
    CREATE TRIGGER update_account_categories_updated_at BEFORE UPDATE ON account_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'Trigger update_account_categories_updated_at already exists, skipping...';
END $$;

DO $$ BEGIN
    CREATE TRIGGER update_deferred_payments_updated_at BEFORE UPDATE ON deferred_payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'Trigger update_deferred_payments_updated_at already exists, skipping...';
END $$;

DO $$ BEGIN
    CREATE TRIGGER update_completed_works_updated_at BEFORE UPDATE ON completed_works FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'Trigger update_completed_works_updated_at already exists, skipping...';
END $$;

DO $$ BEGIN
    CREATE TRIGGER update_completed_works_documents_updated_at BEFORE UPDATE ON completed_works_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'Trigger update_completed_works_documents_updated_at already exists, skipping...';
END $$;

-- إنشاء دالة للتحقق من صحة الأرصدة
CREATE OR REPLACE FUNCTION validate_fund_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.balance < 0 THEN
        RAISE EXCEPTION 'رصيد الصندوق لا يمكن أن يكون سالباً';
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$ BEGIN
    CREATE TRIGGER validate_fund_balance_trigger 
        BEFORE INSERT OR UPDATE ON funds 
        FOR EACH ROW EXECUTE FUNCTION validate_fund_balance();
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'Trigger validate_fund_balance_trigger already exists, skipping...';
END $$;

-- اكتمل إنشاء قاعدة البيانات بنجاح
DO $$ BEGIN
    RAISE NOTICE 'تم إنشاء قاعدة البيانات بنجاح - Database created successfully!';
END $$;
