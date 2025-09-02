-- حل مشكلة تكرار أنواع المصروفات فقط
-- Fix for duplicate expense types issue

-- 1. حذف المكررات مع الاحتفاظ بالأحدث
DELETE FROM expense_types a USING expense_types b 
WHERE a.id < b.id 
AND a.name = b.name 
AND (a.project_id IS NULL AND b.project_id IS NULL 
     OR a.project_id = b.project_id);

-- 2. إدراج الأنواع المفقودة فقط
INSERT INTO expense_types (name, description, is_active) 
SELECT name, description, is_active FROM (VALUES 
    ('راتب', 'مصروفات الرواتب والأجور', true),
    ('مواد بناء', 'مواد البناء والإنشاء', true),
    ('نقل ومواصلات', 'مصروفات النقل والمواصلات', true),
    ('أدوات ومعدات', 'الأدوات والمعدات المختلفة', true),
    ('خدمات عامة', 'الخدمات العامة والاستشارات', true),
    ('صيانة', 'أعمال الصيانة والإصلاح', true)
) AS new_data(name, description, is_active)
WHERE NOT EXISTS (
    SELECT 1 FROM expense_types 
    WHERE expense_types.name = new_data.name 
    AND expense_types.project_id IS NULL
);

-- 3. عرض النتيجة للتأكد
SELECT 'Fixed expense types successfully' as message;
SELECT name, project_id, description FROM expense_types ORDER BY name;
