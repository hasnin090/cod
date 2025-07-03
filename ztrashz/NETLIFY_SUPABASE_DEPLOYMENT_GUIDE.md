# دليل نشر نظام المحاسبة العربي على Netlify + Supabase

## نظرة عامة

تم إنشاء نسخة محسنة من النظام للعمل بالكامل في السحابة باستخدام:
- **Netlify**: لاستضافة الواجهة الأمامية والدوال الخلفية
- **Supabase**: لقاعدة البيانات وإدارة المستخدمين

## الخطوات المطلوبة

### 1. إعداد Supabase

1. **إنشاء مشروع جديد:**
   - اذهب إلى [supabase.com](https://supabase.com)
   - أنشئ حساب جديد أو سجل دخول
   - اضغط "New Project"
   - اختر اسماً للمشروع مثل "arabic-accounting"

2. **إنشاء قاعدة البيانات:**
   - اذهب إلى SQL Editor في لوحة تحكم Supabase
   - انسخ محتوى ملف `supabase-schema.sql` والصقه
   - اضغط "Run" لتنفيذ الاستعلامات

3. **إعداد Authentication:**
   - اذهب إلى Authentication > Settings
   - فعل "Enable email confirmations" إذا كنت تريد
   - احفظ الـ URL الخاص بالمشروع و anon key

### 2. تحديث الكود

1. **تحديث معلومات الاتصال:**
   ```javascript
   // في ملف public/index.html
   const supabaseUrl = 'https://your-project-id.supabase.co';
   const supabaseAnonKey = 'your-anon-key-here';
   ```

2. **إنشاء مستخدم أولي:**
   ```sql
   -- في Supabase SQL Editor
   INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
   VALUES (
     gen_random_uuid(),
     'admin@example.com',
     crypt('your-password', gen_salt('bf')),
     now(),
     '{"provider": "email", "providers": ["email"]}',
     '{"name": "مدير النظام"}',
     now(),
     now()
   );
   ```

### 3. نشر على Netlify

1. **رفع الملفات:**
   - إنشاء repository جديد في GitHub
   - رفع جميع الملفات إلى الـ repository
   
2. **ربط مع Netlify:**
   - اذهب إلى [netlify.com](https://netlify.com)
   - اضغط "Add new site" > "Import from Git"
   - اختر الـ repository الخاص بك
   
3. **إعداد البناء:**
   - Build command: `node netlify-supabase-build.js`
   - Publish directory: `public`
   - Functions directory: `netlify/functions`

4. **متغيرات البيئة:**
   في إعدادات Netlify، أضف:
   ```
   DATABASE_URL=postgresql://postgres:[password]@db.[project-id].supabase.co:5432/postgres
   SUPABASE_URL=https://[project-id].supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   ```

### 4. اختبار النظام

1. **الوصول للموقع:**
   - استخدم الرابط الذي يوفره Netlify
   - جرب تسجيل الدخول بالمستخدم الذي أنشأته

2. **اختبار الدوال:**
   ```
   https://your-site.netlify.app/api/database/status
   https://your-site.netlify.app/api/dashboard
   ```

## الميزات المتوفرة

### الواجهة الأمامية
- ✅ تسجيل دخول باستخدام Supabase Auth
- ✅ لوحة تحكم بالإحصائيات
- ✅ واجهة عربية بنظام RTL
- ✅ تصميم متجاوب لجميع الأجهزة

### الدوال الخلفية
- ✅ `/api/database/status` - فحص حالة قاعدة البيانات
- ✅ `/api/dashboard` - إحصائيات النظام
- ✅ `/api/users` - إدارة المستخدمين
- ✅ `/api/transactions` - إدارة المعاملات
- ✅ `/api/projects` - إدارة المشاريع

### قاعدة البيانات
- ✅ جداول كاملة للنظام المحاسبي
- ✅ أمان على مستوى الصفوف (RLS)
- ✅ فهارس محسنة للأداء
- ✅ دوال مساعدة ومحفزات

## التخصيص

### إضافة ميزات جديدة
1. أضف الدالة في `netlify/functions/api.js`
2. أضف الواجهة في `public/index.html`
3. اختبر محلياً ثم ارفع التحديث

### تخصيص التصميم
- عدل الـ CSS في `public/index.html`
- أضف مكتبات خارجية عبر CDN
- استخدم Tailwind CSS للتنسيق السريع

## الدعم والصيانة

### النسخ الاحتياطية
- Supabase يقوم بنسخ احتياطية تلقائية
- يمكن تصدير البيانات عبر SQL Editor

### المراقبة
- مراقبة الأداء عبر لوحة تحكم Netlify
- مراقبة قاعدة البيانات عبر Supabase Dashboard

### الأمان
- تشفير البيانات في النقل والتخزين
- أمان على مستوى الصفوف
- مصادقة قوية عبر Supabase Auth

## الملفات المطلوبة

```
public/
├── index.html          # الواجهة الأمامية
└── _redirects         # إعدادات التوجيه

netlify/
└── functions/
    ├── api.js         # دوال الواجهة الخلفية
    └── package.json   # تبعيات الدوال

netlify.toml           # إعدادات Netlify
supabase-schema.sql    # مخطط قاعدة البيانات
```

## استكشاف الأخطاء

### مشاكل شائعة
1. **خطأ CORS:** تأكد من إعدادات CORS في دوال Netlify
2. **خطأ قاعدة البيانات:** تحقق من صحة DATABASE_URL
3. **خطأ المصادقة:** تأكد من إعدادات Supabase Auth

### سجلات الأخطاء
- سجلات Netlify في Functions > Edge Functions
- سجلات Supabase في Logs section

---

**ملاحظة:** هذا النظام مُحسن للأداء والأمان في البيئة السحابية ويوفر جميع الميزات الأساسية للمحاسبة العربية.