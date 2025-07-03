# البدء السريع - نظام المحاسبة العربي

## 1. تثبيت المشروع

```bash
# استنساخ المشروع
git clone https://github.com/YOUR_USERNAME/arabic-accounting-system.git
cd arabic-accounting-system

# تثبيت التبعيات
npm install
```

## 2. إعداد قاعدة البيانات

### خيار 1: استخدام Neon (مجاني)
1. أنشئ حساب على https://neon.tech
2. أنشئ قاعدة بيانات جديدة
3. انسخ رابط الاتصال

### خيار 2: PostgreSQL محلي
```bash
# إنشاء قاعدة بيانات
createdb accounting_system
```

## 3. إعداد متغيرات البيئة

```bash
# انسخ ملف المثال
cp .env.example .env

# عدل الملف بمعلوماتك
nano .env
```

أضف على الأقل:
```env
DATABASE_URL=postgresql://...
SESSION_SECRET=random-32-character-string
```

## 4. تشغيل قاعدة البيانات

```bash
# تطبيق الـ schema
npm run db:push
```

## 5. تشغيل التطبيق

### وضع التطوير
```bash
npm run dev
```

### بناء للإنتاج
```bash
npm run build
npm start
```

## 6. الوصول للنظام

- افتح المتصفح على http://localhost:5000
- سجل دخول بـ:
  - **المستخدم:** admin
  - **كلمة المرور:** admin123

## 📱 الميزات الرئيسية

- ✅ نظام محاسبة متكامل بالعربية
- ✅ إدارة المشاريع والمعاملات
- ✅ إدارة المستخدمين والصلاحيات
- ✅ تقارير مالية شاملة
- ✅ نسخ احتياطي تلقائي
- ✅ تخزين الملفات محلياً وسحابياً

## 🚀 النشر

### Render (موصى به)
```bash
# استخدم render.yaml الموجود
# اتبع RENDER_DEPLOYMENT_GUIDE.md
```

### Docker
```bash
docker-compose up -d
```

### Railway
```bash
# استخدم railway.json الموجود
railway up
```

## 📚 المزيد من المعلومات

- [دليل النشر الكامل](DEPLOYMENT_DOCUMENTATION.md)
- [بنية المشروع](PROJECT_STRUCTURE.md)
- [دليل المساهمة](README.md)

## 🆘 المساعدة

إذا واجهت مشاكل:
1. تحقق من السجلات: `npm run dev`
2. تأكد من DATABASE_URL صحيح
3. تأكد من تشغيل `npm run db:push`