# دليل رفع النظام على GitHub

## التحضير قبل الرفع

### 1. التأكد من ملف .gitignore
تأكد من وجود هذه الملفات في .gitignore:
```
node_modules/
dist/
.env
.env.local
uploads/
backups/
cookies*.txt
*.log
.DS_Store
```

### 2. الملفات المهمة للرفع
- جميع ملفات الكود (client/, server/, shared/)
- package.json و package-lock.json
- render.yaml (لـ Render)
- Dockerfile و docker-compose.yml
- vite.config.ts
- drizzle.config.ts
- tsconfig.json
- README.md

## الأوامر السريعة للرفع

```bash
# 1. حل مشكلة Git lock إن وجدت
rm -f .git/index.lock

# 2. تحقق من الحالة
git status

# 3. أضف الملفات
git add -A

# 4. اعمل commit
git commit -m "Clean up project and prepare for deployment"

# 5. ارفع على GitHub
git push origin main
```

## إذا لم يكن لديك مستودع

### 1. إنشاء مستودع جديد على GitHub
1. اذهب إلى https://github.com/new
2. اختر اسم للمستودع (مثل: arabic-accounting-system)
3. اجعله Private إذا أردت
4. لا تضع README أو .gitignore (موجودين بالفعل)

### 2. ربط المستودع
```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

## ملاحظات مهمة

- **لا ترفع ملف .env** - احتفظ به محلياً فقط
- **المرفقات في uploads/** - لن تُرفع على Git
- **النسخ الاحتياطية** - موجودة محلياً فقط

## بعد الرفع

1. تأكد من ظهور جميع الملفات على GitHub
2. للنشر على Render: اتبع دليل RENDER_DEPLOYMENT_GUIDE.md
3. للنشر على Railway: استخدم railway.json
4. للنشر على VPS: استخدم docker-compose.yml