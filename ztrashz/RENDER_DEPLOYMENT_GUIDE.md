# دليل نشر النظام على Render

## الخطوة 1: إعداد الملفات للنشر

### تأكد من وجود هذه الملفات:
- ✅ `render.yaml` (موجود الآن)
- ✅ `.gitignore` (تأكد من احتوائه على .env و uploads/)
- ✅ `package.json` مع أمر start

### أضف أمر start في package.json:
تأكد من وجود:
```json
"scripts": {
  "start": "node dist/index.js"
}
```

## الخطوة 2: رفع المشروع على GitHub

```bash
# 1. حل مشكلة Git lock إن وجدت
rm -f .git/index.lock

# 2. أضف الملفات الجديدة
git add render.yaml
git add RENDER_DEPLOYMENT_GUIDE.md
git add -A

# 3. اعمل commit
git commit -m "Add Render deployment configuration"

# 4. ارفع على GitHub
git push origin main
```

## الخطوة 3: إنشاء حساب على Render

1. اذهب إلى https://render.com
2. سجل حساب جديد (يمكنك التسجيل بـ GitHub)
3. تأكيد البريد الإلكتروني

## الخطوة 4: النشر على Render

### الطريقة 1: النشر بـ render.yaml (الأسهل)
1. في Render Dashboard، اضغط "New +"
2. اختر "Blueprint"
3. اربط حساب GitHub
4. اختر مستودعك
5. Render سيقرأ `render.yaml` تلقائياً
6. اضغط "Apply"

### الطريقة 2: النشر اليدوي
1. **إنشاء قاعدة البيانات:**
   - New + > PostgreSQL
   - Name: `accounting-db`
   - Database: `accounting_system`
   - User: `accounting_user`
   - Region: Frankfurt (الأقرب للشرق الأوسط)
   - اضغط "Create Database"

2. **إنشاء Web Service:**
   - New + > Web Service
   - Connect GitHub repository
   - Name: `arabic-accounting-system`
   - Region: Frankfurt
   - Branch: main
   - Runtime: Node
   - Build Command: `npm install && npm run build`
   - Start Command: `node dist/index.js`

3. **إضافة متغيرات البيئة:**
   - DATABASE_URL (سيتم إضافته تلقائياً)
   - SESSION_SECRET (أي نص عشوائي طويل)
   - NODE_ENV = production
   - PORT = 3000

## الخطوة 5: متغيرات البيئة الإضافية (اختيارية)

إذا كنت تستخدم خدمات خارجية، أضف:
```
SUPABASE_URL=your-supabase-url
SUPABASE_KEY=your-supabase-key
FIREBASE_SERVICE_ACCOUNT={"type":"service_account"...}
```

## الخطوة 6: بعد النشر

1. **انتظر البناء:**
   - ستظهر شاشة Logs
   - انتظر حتى ترى "Build successful"
   - ثم "Your service is live"

2. **الحصول على الرابط:**
   - سيكون مثل: `https://arabic-accounting-system.onrender.com`

3. **تشغيل migrations:**
   - في Render Dashboard > Shell
   - شغل: `npm run db:push`

## الخطوة 7: اختبار النظام

1. افتح رابط التطبيق
2. سجل دخول بـ:
   - Username: admin
   - Password: admin123

## مشاكل شائعة وحلولها

### 1. خطأ في البناء
- تأكد من أن `package.json` يحتوي على جميع المكتبات
- تحقق من وجود `build` script

### 2. خطأ في قاعدة البيانات
- تأكد من DATABASE_URL صحيح
- شغل `npm run db:push` من Shell

### 3. النظام بطيء في البداية
- الخطة المجانية تنام بعد 15 دقيقة
- اشترك في الخطة المدفوعة ($7/شهر) للحصول على أداء دائم

## الخطة المجانية vs المدفوعة

### المجانية:
- ✅ 750 ساعة شهرياً
- ✅ PostgreSQL 1GB
- ❌ ينام بعد 15 دقيقة عدم نشاط
- ❌ يحذف البيانات بعد 90 يوم

### المدفوعة ($7/شهر):
- ✅ لا ينام أبداً
- ✅ أداء أفضل
- ✅ نسخ احتياطي تلقائي
- ✅ دعم أولوية

## هل تحتاج مساعدة في:
1. رفع الملفات على GitHub؟
2. إعداد Render Dashboard؟
3. حل أي مشكلة تواجهك؟