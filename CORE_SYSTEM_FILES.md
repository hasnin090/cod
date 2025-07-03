# الملفات الأساسية لتشغيل النظام المحاسبي العربي

## 🎯 الملفات الأساسية للتشغيل المحلي

### 1. الخادم (Server)
```
server/
├── index.ts                    # نقطة البداية الرئيسية
├── storage.ts                  # طبقة قاعدة البيانات
├── db.ts                       # اتصال قاعدة البيانات
├── supabase-storage.ts         # تخزين Supabase
├── firebase-storage.ts         # تخزين Firebase (احتياطي)
└── backup-system.ts            # نظام النسخ الاحتياطي
```

### 2. الواجهة الأمامية (Client)
```
client/
├── index.html                  # صفحة HTML الرئيسية
├── src/
│   ├── main.tsx               # نقطة البداية
│   ├── App.tsx                # التطبيق الرئيسي
│   ├── components/            # المكونات
│   │   ├── ui/sidebar.tsx     # الشريط الجانبي
│   │   ├── transaction-form.tsx # نموذج المعاملات
│   │   └── dashboard.tsx      # لوحة التحكم
│   ├── context/
│   │   └── auth-context.tsx   # سياق المصادقة
│   ├── lib/
│   │   └── queryClient.ts     # إعداد API
│   └── pages/                 # الصفحات
│       ├── login.tsx          # تسجيل الدخول
│       ├── dashboard.tsx      # الرئيسية
│       └── transactions.tsx   # المعاملات
```

### 3. الملفات المشتركة (Shared)
```
shared/
├── schema.ts                   # مخطط قاعدة البيانات
└── types.ts                   # أنواع البيانات
```

### 4. إعدادات النظام
```
├── package.json               # تبعيات النظام
├── tsconfig.json             # إعدادات TypeScript
├── vite.config.ts            # إعدادات Vite
├── drizzle.config.ts         # إعدادات قاعدة البيانات
├── postcss.config.js         # إعدادات CSS
└── .env                      # متغيرات البيئة
```

## 🌐 الملفات الأساسية للنشر السحابي

### 1. نشر Netlify + Supabase
```
├── netlify-supabase-build.js  # بناء النشر
├── netlify.toml              # إعدادات Netlify
├── public/
│   ├── index.html            # الواجهة الأمامية
│   └── _redirects           # توجيه الـ APIs
└── netlify/functions/
    └── api.js               # دوال الخادم
```

### 2. إعداد قاعدة البيانات
```
├── supabase-schema.sql       # مخطط Supabase
└── migrate-to-supabase.js    # نقل البيانات
```

## 📊 قاعدة البيانات الأساسية

### الجداول المطلوبة:
1. **users** - المستخدمون
2. **projects** - المشاريع
3. **transactions** - المعاملات المالية
4. **expense_types** - أنواع المصروفات
5. **employees** - الموظفون
6. **settings** - الإعدادات

### الجداول الإضافية:
- **documents** - المستندات
- **activity_logs** - سجل الأنشطة
- **completed_works** - الأعمال المنجزة
- **receivables** - المستحقات

## 🔧 متغيرات البيئة المطلوبة

```bash
# قاعدة البيانات الأساسية
DATABASE_URL=postgresql://user:password@host:port/database

# Supabase (اختياري)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Firebase (اختياري)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email

# إعدادات النظام
SESSION_SECRET=your-session-secret
NODE_ENV=production
PORT=5000
```

## 🚀 أوامر التشغيل

### التطوير المحلي:
```bash
npm install
npm run dev
```

### النشر الإنتاجي:
```bash
npm run build
npm start
```

### النشر السحابي:
```bash
node netlify-supabase-build.js
```

## 📁 المجلدات المطلوبة

### للتشغيل المحلي:
```
├── uploads/          # تخزين الملفات المرفقة
├── backups/          # النسخ الاحتياطية
└── node_modules/     # تبعيات النظام
```

### للنشر السحابي:
```
├── public/           # الملفات الثابتة
├── netlify/          # دوال Netlify
└── dist/            # الملفات المبنية
```

## 🔍 الملفات غير المطلوبة

### يمكن حذفها بأمان:
```
├── attached_assets/          # مرفقات قديمة
├── replit-files/            # ملفات Replit
├── functions/               # دوال قديمة
├── cloud-backup/            # نسخ احتياطية قديمة
├── netlify-deploy/          # نشر قديم
├── scripts/                 # سكريبت مساعدة
└── *.md                     # ملفات التوثيق
```

### ملفات التوثيق (اختيارية):
```
├── README.md
├── DEPLOYMENT_GUIDE.md
├── SYSTEM_AUDIT.md
└── CHANGELOG.md
```

## 🎛️ خيارات النشر

### 1. النشر المحلي (VPS/Dedicated Server)
- استخدم الملفات الأساسية + PostgreSQL
- قم بتشغيل `npm run dev` للتطوير
- قم بتشغيل `npm run build && npm start` للإنتاج

### 2. النشر السحابي (Netlify + Supabase)
- استخدم ملفات النشر السحابي
- قم بتشغيل `node netlify-supabase-build.js`
- ارفع إلى Netlify مع إعداد Supabase

### 3. النشر المختلط (Render/Railway + Supabase)
- استخدم الملفات الأساسية مع Supabase
- قم بإعداد متغيرات البيئة في منصة النشر

## 📝 ملاحظات مهمة

1. **قاعدة البيانات:** النظام يتطلب PostgreSQL لضمان الأداء الأمثل
2. **التخزين:** يدعم التخزين المحلي والسحابي (Supabase/Firebase)
3. **الأمان:** يستخدم جلسات مشفرة وكلمات مرور مُشفرة
4. **النسخ الاحتياطي:** نظام تلقائي للنسخ الاحتياطي كل 12 ساعة
5. **اللغة:** واجهة عربية كاملة مع دعم RTL

## 🎯 الحد الأدنى للتشغيل

للحصول على نظام يعمل بأقل الملفات:
```
├── server/index.ts
├── client/index.html
├── shared/schema.ts
├── package.json
├── .env
└── uploads/
```

هذه الملفات الأساسية تكفي لتشغيل النظام مع الوظائف الأساسية للمحاسبة.