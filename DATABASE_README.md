# دليل قاعدة البيانات - نظام المحاسبة
# Database Setup Guide - Cod Accounting System

**آخر تحديث:** 2023-06-15

## ملفات SQL المتوفرة

### 1. `database-safe-setup.sql` - الإعداد الآمن المُحسَّن (مُوصى به)
- إنشاء جميع الجداول مع فحوصات الوجود
- معالجة آمنة للأعمدة والقيود المفقودة
- يعمل على قواعد البيانات الجديدة والموجودة
- حماية من أخطاء التكرار والقيود المفقودة
- مناسب لـ Supabase والـ PostgreSQL المستضاف

### 2. `database-setup.sql` - الإعداد الكامل
- إنشاء جميع الجداول مع القيود والعلاقات
- البيانات الافتراضية (مستخدم المدير، الإعدادات، إلخ)
- الفهارس لتحسين الأداء
- الدوال والـ Triggers
- التعليقات والوثائق

### 3. `database-schema-only.sql` - الجداول فقط
- إنشاء الجداول الأساسية فقط
- بدون بيانات افتراضية
- مناسب للتطوير أو البيئات الاختبارية

## تثبيت الجداول في Supabase

### الطريقة الأولى: عبر Supabase Dashboard (مُوصى بها)

1. **الدخول إلى Supabase Dashboard:**
   - اذهب إلى [supabase.com](https://supabase.com)
   - سجل الدخول وانتقل إلى مشروعك

2. **فتح SQL Editor:**
   - من القائمة الجانبية، اختر "SQL Editor"
   - انقر على "New Query"

3. **تنفيذ السكريبت:**
   ```sql
   -- انسخ محتوى ملف database-safe-setup.sql والصقه هنا
   -- ثم انقر على "Run" أو اضغط Ctrl+Enter
   ```

4. **التحقق من النجاح:**
   - اذهب إلى "Table Editor" للتأكد من إنشاء الجداول
   - تحقق من "Database" > "Tables" لرؤية جميع الجداول

### الطريقة الثانية: عبر psql (سطر الأوامر)

1. **الحصول على connection string:**
   - من Supabase Dashboard > Settings > Database
   - انسخ "Connection string" في قسم "Connection parameters"

2. **تنفيذ السكريبت:**
   ```bash
   # استبدل [YOUR-PASSWORD] بكلمة المرور الفعلية
   psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-REF].supabase.co:5432/postgres" -f database-safe-setup.sql
   ```

### الطريقة الثالثة: عبر أدوات قاعدة البيانات

1. **استخدام DBeaver أو pgAdmin:**
   - أضف connection جديد إلى Supabase
   - استخدم المعاملات من Supabase Dashboard
   - افتح ملف `database-safe-setup.sql` ونفذه

2. **استخدام VS Code مع PostgreSQL Extension:**
   - ثبت امتداد PostgreSQL
   - أضف connection إلى Supabase
   - انقر بالزر الأيمن على قاعدة البيانات > "Execute SQL File"

## متطلبات Supabase

### متغيرات البيئة المطلوبة:
```env
# Supabase Configuration
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Client Configuration  
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Database Connection (للاتصال المباشر)
DATABASE_URL=postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres
```

### صلاحيات Row Level Security (RLS):

بعد إنشاء الجداول، ستحتاج لتكوين صلاحيات RLS:

```sql
-- تفعيل RLS على الجداول الحساسة
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- مثال على سياسة للمستخدمين
CREATE POLICY "Users can view their own data" ON users
  FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Admins can view all users" ON users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id::text = auth.uid()::text 
      AND role = 'admin'
    )
  );
```

## هيكل قاعدة البيانات

### الجداول الرئيسية:

#### 1. **users** - المستخدمين
- إدارة المستخدمين والصلاحيات
- أدوار: admin, manager, user, viewer
- نظام الصلاحيات المرن (JSON)

#### 2. **projects** - المشاريع
- معلومات المشاريع والميزانيات
- تتبع التقدم والحالة
- ربط بالمستخدمين المسؤولين

#### 3. **transactions** - المعاملات المالية
- الإيرادات والمصروفات
- ربط بالمشاريع والموظفين
- دعم المرفقات

#### 4. **documents** - المستندات
- إدارة الملفات والمستندات
- ربط بالمشاريع والمعاملات
- تصنيف وعلامات

#### 5. **employees** - الموظفين
- إدارة الرواتب والحسابات
- ربط بالمشاريع
- تتبع المدفوعات

#### 6. **funds** - الصناديق
- صناديق الإدارة والمشاريع
- إدارة الأرصدة
- نوعين: admin, project

#### 7. **expense_types** - أنواع المصروفات
- تصنيف المصروفات
- ربط بمشاريع محددة أو عامة

#### 8. **deferred_payments** - الدفعات المؤجلة
- إدارة الدفعات على أقساط
- تتبع المدفوع والمتبقي

### الجداول المساعدة:

- **user_projects**: ربط المستخدمين بالمشاريع
- **document_transaction_links**: ربط المستندات بالمعاملات
- **activity_logs**: سجل النشاطات
- **settings**: إعدادات النظام
- **transaction_edit_permissions**: صلاحيات التعديل المؤقتة
- **ledger_entries**: دفتر الأستاذ
- **account_categories**: تصنيفات الحسابات
- **completed_works**: الأعمال المنجزة
- **completed_works_documents**: مستندات الأعمال المنجزة

## البيانات الافتراضية

### المستخدم الافتراضي:
- **Username**: admin
- **Password**: admin123
- **Role**: admin

## استكشاف الأخطاء الشائعة في Supabase

### 1. خطأ "relation already exists"
```sql
-- الحل: استخدم database-safe-setup.sql بدلاً من database-setup.sql
-- أو استخدم IF NOT EXISTS في الاستعلامات
```

### 2. خطأ "column does not exist"
```sql
-- تحقق من أن العمود موجود قبل إنشاء القيد:
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'table_name' AND column_name = 'column_name') THEN
        -- إنشاء القيد هنا
    END IF;
END $$;
```

### 3. خطأ "type already exists"
```sql
-- استخدم DO $$ blocks لفحص وجود النوع:
DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM('income', 'expense');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
```

### 4. مشاكل الصلاحيات
- تأكد من أن المستخدم له صلاحيات CREATE TABLE
- في Supabase، استخدم postgres user للإعداد الأولي
- فعل RLS بعد إنشاء الجداول، ليس قبلها

### 5. مشاكل الاتصال
```bash
# تحقق من صحة connection string
psql "postgresql://postgres:password@db.ref.supabase.co:5432/postgres" -c "SELECT version();"
```

## نصائح لـ Supabase

### 1. **استخدام SQL Editor المدمج:**
- أسرع وأضمن من الاتصال الخارجي
- يدعم syntax highlighting
- تاريخ الاستعلامات محفوظ

### 2. **تقسيم السكريبت الكبير:**
```sql
-- نفذ الأجزاء بشكل منفصل إذا كان السكريبت كبير جداً
-- 1. إنشاء الأنواع (ENUMs)
-- 2. إنشاء الجداول
-- 3. إنشاء الفهارس والقيود
-- 4. إدراج البيانات الافتراضية
```

### 3. **استخدام Transactions:**
```sql
BEGIN;
-- سكريبت إنشاء الجداول
COMMIT;
-- في حالة الخطأ، سيتم التراجع تلقائياً
```

### 4. **تفعيل Real-time (اختياري):**
```sql
-- لتفعيل real-time updates على الجداول
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE documents;
```

## الإعداد للإنتاج

### 1. **النسخ الاحتياطي قبل النشر:**
```bash
# تصدير البيانات الموجودة (إن وجدت)
pg_dump "postgresql://postgres:password@db.ref.supabase.co:5432/postgres" > backup.sql
```

### 2. **اختبار السكريبت على بيئة اختبارية:**
- أنشئ مشروع Supabase منفصل للاختبار
- نفذ السكريبت عليه أولاً
- تأكد من عمل جميع الوظائف

### 3. **مراقبة الأداء:**
```sql
-- فحص حجم الجداول
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size(tablename::regclass)) as size
FROM pg_tables 
WHERE schemaname = 'public';

-- فحص استخدام الفهارس
SELECT 
    indexname,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes;
```

### 4. **تحسين الأداء:**
```sql
-- تحليل الجداول لتحديث إحصائيات المحسن
ANALYZE;

-- إعادة بناء الفهارس (إذا لزم الأمر)
REINDEX DATABASE postgres;
```

## الخطوات التفصيلية للنشر في Supabase

### التحضير:
1. تأكد من وجود نسخة احتياطية
2. جهز ملف `database-safe-setup.sql`
3. اجمع معلومات الاتصال من Supabase Dashboard

### التنفيذ:
1. **افتح Supabase SQL Editor**
2. **انسخ والصق محتوى `database-safe-setup.sql`**
3. **نفذ السكريبت بالنقر على "Run"**
4. **انتظر رسالة النجاح**
5. **تحقق من الجداول في Table Editor**

### التحقق:
```sql
-- تحقق من إنشاء جميع الجداول
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- تحقق من وجود البيانات الافتراضية
SELECT count(*) as user_count FROM users;
SELECT count(*) as settings_count FROM settings;
```

### استكمال الإعداد:
```sql
-- إعداد صلاحيات Row Level Security
-- إعداد سياسات الوصول للبيانات
-- تكوين Real-time subscriptions (إن أردت)
```

## دعم وصيانة

### المراقبة المستمرة:
- راقب استخدام المساحة في Supabase Dashboard
- تحقق من سجلات الأخطاء في Logs
- راقب أداء الاستعلامات في Performance

### التحديثات المستقبلية:
- استخدم migration scripts للتحديثات
- احتفظ بنسخ احتياطية قبل أي تحديث
- اختبر التحديثات على بيئة اختبارية أولاً

---

## ملاحظات مهمة

⚠️ **تحذير**: تأكد من إعداد صلاحيات RLS قبل النشر في الإنتاج
🔒 **أمان**: غير كلمة مرور المستخدم الافتراضي فوراً
📊 **مراقبة**: فعل مراقبة الأداء من اليوم الأول
🔄 **نسخ احتياطي**: جدول نسخ احتياطية دورية
- **Email**: admin@admin.com

### الإعدادات الافتراضية:
- اسم الشركة: شركة تقنية للمقاولات
- العملة: د.ع
- الميزانية الافتراضية: 1,000,000
- حجم الملف الأقصى: 20MB

### أنواع المصروفات الافتراضية:
1. راتب
2. مواد بناء
3. نقل ومواصلات
4. أدوات ومعدات
5. خدمات عامة
6. صيانة

## الفهارس والأداء

الفهارس المنشأة لتحسين الأداء:
- فهارس على المعاملات (المشروع، المنشئ، التاريخ)
- فهارس على المستندات (المشروع)
- فهارس على سجل النشاطات (المستخدم، التاريخ)
- فهارس على الربطات (المستخدم-المشروع)

## الدوال والـ Triggers

### دالة تحديث updated_at:
- تحديث تلقائي لعمود `updated_at` عند التعديل
- مطبقة على: projects, funds, employees, expense_types, إلخ

### دالة التحقق من الأرصدة:
- منع الأرصدة السالبة في الصناديق
- التحقق قبل الإدراج والتحديث

## متطلبات النظام

- **PostgreSQL** 12 أو أحدث
- دعم **JSON/JSONB**
- دعم **ENUM types**
- دعم **Triggers والدوال**

## الاستخدام مع التطبيق

يستخدم التطبيق:
- **Drizzle ORM** للتفاعل مع قاعدة البيانات
- **Neon Database** للإنتاج (اختياري)
- **Environment Variables** للاتصال

### متغيرات البيئة المطلوبة:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
```

## النسخ الاحتياطية

ينصح بإنشاء نسخ احتياطية دورية:
```bash
pg_dump -U username database_name > backup_$(date +%Y%m%d_%H%M%S).sql
```

## الصيانة

### تنظيف سجل النشاطات:
```sql
DELETE FROM activity_logs WHERE timestamp < NOW() - INTERVAL '6 months';
```

### إعادة فهرسة دورية:
```sql
REINDEX DATABASE database_name;
```

### تحليل الإحصائيات:
```sql
ANALYZE;
```

---

**ملاحظة**: تأكد من وجود صلاحيات كافية لإنشاء الجداول والفهارس والدوال قبل تشغيل السكريبتات.

**الدعم**: للاستفسارات أو المشاكل، راجع documentation أو اتصل بفريق التطوير.
