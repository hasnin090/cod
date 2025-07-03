const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Building production system for Netlify...\n');

try {
  // 1. بناء Frontend فقط
  console.log('1. Building frontend...');
  execSync('npx vite build --outDir dist/public', { stdio: 'inherit' });

  // 2. نسخ الملفات المبنية
  console.log('\n2. Preparing files for Netlify...');
  
  // تأكد من وجود مجلد public
  if (!fs.existsSync('./public')) {
    fs.mkdirSync('./public', { recursive: true });
  }

  // نسخ الملفات من dist/public إلى public
  const copyDir = (src, dest) => {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (let entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        copyDir(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  };

  if (fs.existsSync('./dist/public')) {
    copyDir('./dist/public', './public');
  }

  // 3. إنشاء _redirects
  console.log('\n3. Creating redirects...');
  fs.writeFileSync('./public/_redirects', 
`/api/* https://your-replit-backend.replit.app/api/:splat 200
/* /index.html 200`);

  // 4. إنشاء تعليمات النشر
  console.log('\n4. Creating deployment instructions...');
  fs.writeFileSync('./NETLIFY-DEPLOY-INSTRUCTIONS.md', 
`# تعليمات نشر النظام على Netlify

## الخطوة 1: تحديث _redirects
افتح ملف public/_redirects واستبدل:
\`https://your-replit-backend.replit.app\`
برابط مشروعك على Replit

## الخطوة 2: رفع الملفات على GitHub
\`\`\`bash
git add .
git commit -m "Production build for Netlify"
git push
\`\`\`

## الخطوة 3: في Netlify
1. Build command: \`npm run build:netlify\`
2. Publish directory: \`public\`

## ملاحظة مهمة
هذا الإعداد يستخدم:
- Netlify للواجهة الأمامية (Frontend)
- Replit للخادم (Backend API)

تأكد من أن مشروعك على Replit يعمل دائماً!`);

  console.log('\n✅ Build completed successfully!');
  console.log('📁 Files are ready in ./public');
  console.log('📋 Read NETLIFY-DEPLOY-INSTRUCTIONS.md for next steps');

} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}