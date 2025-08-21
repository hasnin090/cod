# هيكل المشروع المنظم

```
cod/
├── client/                          # تطبيق العميل (React)
│   ├── public/                      # الملفات العامة
│   ├── src/                        # مصادر العميل
│   │   ├── components/             # المكونات
│   │   │   ├── ui/                 # مكونات واجهة المستخدم
│   │   │   ├── auth/               # مكونات المصادقة
│   │   │   ├── forms/              # مكونات النماذج
│   │   │   └── layout/             # مكونات التخطيط
│   │   ├── context/                # سياق React
│   │   │   ├── auth-context.tsx     # سياق المصادقة
│   │   │   └── app-context.tsx     # سياق التطبيق
│   │   ├── hooks/                  # Hooks مخصصة
│   │   │   ├── use-auth.ts         # hook للمصادقة
│   │   │   └── use-api.ts          # hook لطلبات API
│   │   ├── lib/                    # المكتبات المساعدة
│   │   │   ├── supabase.ts         # إعدادات Supabate
│   │   │   ├── api.ts              # إعدادات API
│   │   │   └── utils.ts            # أدوات مساعدة
│   │   ├── pages/                  # صفحات التطبيق
│   │   ├── services/               # خدمات API
│   │   ├── types/                  # تعريفات TypeScript
│   │   └── App.tsx                 # المكون الرئيسي
│   ├── package.json                # إعدادات الحزم
│   └── vite.config.ts              # إعدادات Vite
├── server/                         # خادم التطبيق (Node.js/Express)
│   ├── controllers/                # وحدات التحكم
│   │   ├── auth.controller.ts      # وحدة تحكم المصادقة
│   │   ├── user.controller.ts     # وحدة تحكم المستخدمين
│   │   ├── project.controller.ts  # وحدة تحكم المشاريع
│   │   └── transaction.controller.ts # وحدة تحكم المعاملات
│   ├── middleware/                 # الوسيط البرمجي
│   │   ├── auth.ts                 # مصادقة الوسيط
│   │   ├── validation.ts           # التحقق من صحة البيانات
│   │   └── upload.ts               # رفع الملفات
│   ├── models/                     # نماذج البيانات
│   │   ├── user.model.ts           # نموذج المستخدم
│   │   ├── project.model.ts        # نموذج المشروع
│   │   └── transaction.model.ts    # نموذج المعاملة
│   ├── routes/                     # مسارات API
│   │   ├── auth.routes.ts          # مسارات المصادقة
│   │   ├── user.routes.ts          # مسارات المستخدمين
│   │   ├── project.routes.ts       # مسارات المشاريع
│   │   └── transaction.routes.ts   # مسارات المعاملات
│   ├── services/                  # الخدمات
│   │   ├── auth.service.ts         # خدمة المصادقة
│   │   ├── user.service.ts         # خدمة المستخدمين
│   │   ├── project.service.ts      # خدمة المشاريع
│   │   └── storage.service.ts     # خدمة التخزين
│   ├── storage/                   # طبقة التخزين
│   │   ├── storage.interface.ts   # واجهة التخزين
│   │   ├── supabase-storage.ts    # تخزين Supabate
│   │   ├── pg-storage.ts          # تخزين PostgreSQL
│   │   └── memory-storage.ts      # تخزين الذاكرة
│   ├── utils/                     # أدوات مساعدة
│   │   ├── auth.utils.ts           # أدوات المصادقة
│   │   └── validation.utils.ts     # أدوات التحقق
│   ├── config/                    # إعدادات التطبيق
│   │   ├── database.config.ts      # إعدادات قاعدة البيانات
│   │   └── supabase.config.ts      # إعدادات Supabate
│   ├── tests/                     # الاختبارات
│   ├── uploads/                   # مجلد الرفعات
│   ├── .env                       # متغيرات البيئة
│   ├── package.json               # إعدادات الحزم
│   ├── tsconfig.json              # إعدادات TypeScript
│   └── server.ts                  # ملف الخادم الرئيسي
├── shared/                        # المشاركة بين العميل والخادم
│   ├── schema.ts                  # تعريفات البيانات
│   ├── types.ts                   # تعريفات TypeScript
│   └── constants.ts               # الثوابت
├── docs/                          # الوثائق
├── scripts/                       # النصوص البرمجية
└── README.md                     # ملف README
```
