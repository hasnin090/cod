# حلول بديلة لمشكلة أنواع المصروفات المكررة

## المشكلة
```
ERROR: 23505: duplicate key value violates unique constraint "expense_types_name_project_unique_idx"
DETAIL: Key (name, COALESCE(project_id, '-1'::integer))=(راتب, -1) already exists.
```

## السبب
يوجد تكرار في جدول `expense_types` لنوع المصروف "راتب"

## الحلول المقترحة

### الحل 1: استخدام SQL مباشر (إذا كان لديك psql)
```sql
-- حذف المكررات
DELETE FROM expense_types a USING expense_types b 
WHERE a.id < b.id 
AND a.name = b.name 
AND (a.project_id IS NULL AND b.project_id IS NULL 
     OR a.project_id = b.project_id);
```

### الحل 2: استخدام pgAdmin أو أي واجهة قاعدة بيانات
1. اتصل بقاعدة البيانات عبر pgAdmin
2. نفذ الكود SQL أعلاه

### الحل 3: إصلاح URL قاعدة البيانات
تحقق من أن URL في ملف .env صحيح:
```
DATABASE_URL=postgresql://postgres:password@host:5432/database
```

### الحل 4: استخدام نسخة محلية من PostgreSQL
إذا كانت المشكلة في الاتصال بـ Supabase، يمكن:
1. تثبيت PostgreSQL محلياً
2. تطبيق المخطط محلياً
3. ثم نقل البيانات لاحقاً

## الخطوات للمتابعة:
1. تحقق من صحة DATABASE_URL
2. تأكد من أن Supabase project متاح
3. استخدم أحد الحلول أعلاه حسب الإمكانيات المتاحة

## ملفات الحل الجاهزة:
- `fix-expense-types-only.sql` - لحل مشكلة التكرار فقط
- `database-safe-setup.sql` - محدث ليتجنب التكرار
- `fix-database.cjs` - سكريبت Node.js (يحتاج اتصال قاعدة بيانات)
