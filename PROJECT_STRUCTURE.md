# بنية مشروع نظام المحاسبة العربي

## 📁 هيكل المجلدات

```
.
├── client/                 # واجهة المستخدم (React + TypeScript)
│   ├── public/            # ملفات ثابتة
│   ├── src/              # كود المصدر
│   │   ├── components/   # مكونات React
│   │   ├── pages/       # صفحات التطبيق
│   │   ├── lib/         # مكتبات مساعدة
│   │   └── styles/      # ملفات CSS
│   └── index.html       # نقطة الدخول HTML
│
├── server/                # الخادم الخلفي (Express + TypeScript)
│   ├── index.ts         # نقطة دخول الخادم
│   ├── routes.ts        # مسارات API
│   ├── storage.ts       # واجهة التخزين
│   ├── db.ts           # اتصال قاعدة البيانات
│   └── *.ts            # ملفات الخادم الأخرى
│
├── shared/               # كود مشترك بين الواجهة والخادم
│   └── schema.ts       # نماذج البيانات (Drizzle ORM)
│
├── scripts/              # سكريبتات مساعدة
│   └── *.ts           # سكريبتات TypeScript
│
├── netlify/             # إعدادات Netlify
│   └── functions/      # Netlify Functions
│
├── uploads/             # ملفات المرفقات (محلي)
├── backups/            # النسخ الاحتياطية (محلي)
├── cloud-backup/       # نسخ احتياطية سحابية
│
└── dist/               # ملفات البناء (تُنشأ تلقائياً)
```

## 📄 ملفات الإعداد الرئيسية

### ملفات Node.js
- `package.json` - تبعيات المشروع وأوامر البناء
- `package-lock.json` - قفل إصدارات التبعيات
- `.nvmrc` - إصدار Node.js المطلوب (v20)

### ملفات TypeScript
- `tsconfig.json` - إعدادات TypeScript

### ملفات البناء
- `vite.config.ts` - إعدادات Vite للواجهة
- `drizzle.config.ts` - إعدادات Drizzle ORM

### ملفات النشر
- `render.yaml` - إعدادات Render.com
- `railway.json` - إعدادات Railway.app
- `Dockerfile` - للنشر باستخدام Docker
- `docker-compose.yml` - للتطوير المحلي
- `netlify.toml` - إعدادات Netlify
- `vercel.json` - إعدادات Vercel

### ملفات أخرى
- `.env.example` - مثال لمتغيرات البيئة
- `.gitignore` - الملفات المستثناة من Git
- `.dockerignore` - الملفات المستثناة من Docker

## 🚀 أوامر مهمة

```bash
# تطوير
npm run dev          # تشغيل الخادم في وضع التطوير

# بناء
npm run build        # بناء للإنتاج

# إنتاج
npm start           # تشغيل في وضع الإنتاج

# قاعدة البيانات
npm run db:push     # تطبيق التغييرات على قاعدة البيانات
```

## 🔧 متطلبات النظام

- Node.js v20+
- PostgreSQL
- npm أو yarn

## 📦 التبعيات الرئيسية

### الواجهة (Frontend)
- React 18
- TypeScript
- Vite
- TanStack Query
- Tailwind CSS
- Shadcn/UI

### الخادم (Backend)
- Express.js
- TypeScript
- Drizzle ORM
- PostgreSQL (عبر Neon/Supabase)
- Express Sessions

## 🔐 متغيرات البيئة المطلوبة

```env
DATABASE_URL=postgresql://...
SESSION_SECRET=your-secret-key
NODE_ENV=production
PORT=3000

# اختياري
SUPABASE_URL=...
SUPABASE_KEY=...
FIREBASE_SERVICE_ACCOUNT=...
```