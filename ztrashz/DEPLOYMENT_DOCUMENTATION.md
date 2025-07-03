# دليل نشر النظام - شامل

## 1. النشر على Render (مُختار)

### ملفات الإعداد الجاهزة:
- `render.yaml` - إعدادات Render الكاملة
- `Dockerfile` - للنشر باستخدام Docker
- `docker-compose.yml` - للتطوير المحلي

### خطوات النشر:
1. ارفع المشروع على GitHub
2. سجل في https://render.com
3. اختر "New Blueprint"
4. اربط مستودع GitHub
5. Render سيقرأ render.yaml تلقائياً

### متغيرات البيئة المطلوبة:
- DATABASE_URL (تلقائي من Render)
- SESSION_SECRET (تلقائي)
- NODE_ENV = production

## 2. بدائل النشر الأخرى

### Railway ($5/شهر)
- ملف `railway.json` جاهز
- نشر سهل من GitHub
- PostgreSQL مدمج

### VPS (Hetzner/Contabo)
- استخدم `docker-compose up -d`
- أو انشر يدوياً مع PM2

### Netlify (للواجهة فقط)
- يحتاج backend منفصل على Replit/Railway
- ملف `netlify-production-build.js` جاهز

## 3. الأوامر المهمة

### بناء النظام:
```bash
npm run build
```

### تشغيل الإنتاج:
```bash
npm start
```

### تشغيل قاعدة البيانات:
```bash
npm run db:push
```

## 4. ملاحظات مهمة

- النظام يحتاج PostgreSQL
- المرفقات تُحفظ في مجلد uploads/
- النسخ الاحتياطية في backups/
- تأكد من إضافة .env في .gitignore

## 5. دعم وصيانة

- النسخ الاحتياطي التلقائي كل 12 ساعة
- السجلات متاحة في Dashboard
- يمكن استعادة النسخ الاحتياطية من backups/