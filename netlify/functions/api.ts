import serverless from 'serverless-http';
import express from 'express';
import { registerRoutes } from './server/routes-simple';

const app = express();

// استخدم body parsers بشكل مشروط: فعّل JSON/x-www-form-urlencoded فقط عندما لا يكون multipart
app.use((req, res, next) => {
  const ct = req.headers['content-type'] || '';
  if (typeof ct === 'string' && ct.includes('multipart/form-data')) {
    // اترك Multer يتولّى المعالجة لمسارات الرفع
    return next();
  }
  // فعّل JSON + urlencoded لباقي الطلبات
  // ملاحظة: نمرّر limit صغير لتفادي تضارب مع Netlify
  (express.json({ limit: '1mb' }) as any)(req, res, (err?: any) => {
    if (err) return next(err);
    (express.urlencoded({ extended: false }) as any)(req, res, next);
  });
});

await registerRoutes(app);

// فعّل binary لتفادي 502 مع multipart، واضبط basePath حتى تطابق المسارات /api/* بعد إزالة prefix الدالة
export const handler = serverless(app as any, {
  basePath: '/.netlify/functions',
  binary: ['multipart/form-data', 'application/octet-stream', 'image/*', '*/*'],
} as any);
