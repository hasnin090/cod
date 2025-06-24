# نظام المحاسبة المتقدم

نظام محاسبة شامل باللغة العربية مع دعم متعدد قواعد البيانات وإدارة الملفات السحابية.

## المميزات الرئيسية

### 💰 إدارة المعاملات المالية
- تسجيل المعاملات الواردة والصادرة
- تصنيف المصروفات والإيرادات
- إدارة المشاريع والحسابات
- نظام الدفعات المؤجلة

### 📊 التقارير والإحصائيات
- تقارير مالية شاملة
- رسوم بيانية تفاعلية
- تصدير PDF و Excel
- تحليل الأداء المالي

### 👥 إدارة المستخدمين والصلاحيات
- نظام أدوار متقدم
- صلاحيات مخصصة لكل مستخدم
- مراجعة نشاطات النظام

### 📁 إدارة الملفات والمرفقات
- رفع وإدارة المرفقات
- تخزين سحابي متعدد (Supabase, Firebase)
- تنظيف وترحيل الملفات القديمة
- نسخ احتياطية تلقائية

### 🔄 النسخ الاحتياطي والاستعادة
- نسخ احتياطية تلقائية كل 12 ساعة
- نسخ احتياطية يدوية من الإعدادات
- استعادة كاملة للبيانات
- حماية الملفات والمرفقات

## التقنيات المستخدمة

- **Frontend**: React + TypeScript + Vite
- **Backend**: Express.js + Node.js
- **Database**: PostgreSQL + Drizzle ORM
- **Storage**: Supabase + Firebase (احتياطي)
- **UI**: Tailwind CSS + Shadcn/UI
- **Authentication**: Session-based Auth

## التثبيت والتشغيل

### المتطلبات
- Node.js 18+ 
- PostgreSQL 14+
- npm أو yarn

### خطوات التثبيت

1. **استنساخ المشروع**
```bash
git clone <repository-url>
cd accounting-system
```

2. **تثبيت التبعيات**
```bash
npm install
```

3. **إعداد قاعدة البيانات**
```bash
# إنشاء ملف البيئة
cp .env.example .env

# تحرير متغيرات البيئة
nano .env
```

4. **تشغيل النظام**
```bash
npm run dev
```

## متغيرات البيئة

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/database_name

# Supabase (اختياري)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_key

# Firebase (اختياري)
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
```

## الاستخدام

### تسجيل الدخول الافتراضي
- **اسم المستخدم**: admin
- **كلمة المرور**: admin123

### الصفحات الرئيسية
- `/` - لوحة التحكم الرئيسية
- `/transactions` - إدارة المعاملات
- `/projects` - إدارة المشاريع
- `/reports` - التقارير المالية
- `/settings` - إعدادات النظام
- `/file-migration` - أدوات ترحيل الملفات

## البنية المعمارية

```
├── client/           # تطبيق React Frontend
├── server/           # خادم Express Backend
├── shared/           # مخططات مشتركة (Drizzle)
├── uploads/          # ملفات المستخدمين
├── backups/          # النسخ الاحتياطية
└── attached_assets/  # الأصول المرفقة
```

## إدارة الملفات

النظام يدعم ثلاثة مستويات للتخزين:
1. **Supabase** - التخزين الرئيسي
2. **Firebase** - التخزين الاحتياطي  
3. **المحلي** - للنسخ الاحتياطية فقط

### ترحيل الملفات القديمة
استخدم صفحة "ترحيل الملفات" لـ:
- تنظيف الروابط المعطلة
- ترحيل الملفات للتخزين السحابي
- تنظيم بنية المجلدات

## الأمان

- تشفير كلمات المرور باستخدام bcrypt
- جلسات محمية بـ express-session
- التحقق من الصلاحيات على مستوى API
- تنظيف البيانات المدخلة بـ Zod

## النسخ الاحتياطي

### تلقائي
- نسخة احتياطية كل 12 ساعة
- تضمين الملفات والمرفقات
- حذف النسخ القديمة تلقائياً

### يدوي
- من صفحة الإعدادات
- إنشاء نسخ طوارئ قبل العمليات الحساسة
- تحميل واستعادة النسخ

## المساهمة

1. Fork المشروع
2. إنشاء فرع جديد (`git checkout -b feature/amazing-feature`)
3. Commit التغييرات (`git commit -m 'Add amazing feature'`)
4. Push للفرع (`git push origin feature/amazing-feature`)
5. فتح Pull Request

## الدعم

للمساعدة والدعم الفني، يرجى فتح issue في المستودع أو التواصل مع فريق التطوير.

## الترخيص

هذا المشروع مرخص تحت رخصة MIT - راجع ملف [LICENSE](LICENSE) للتفاصيل.