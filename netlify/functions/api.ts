import serverless from 'serverless-http';
import express from 'express';
// Use the app's server routes directly
import { registerRoutes } from '../../server/routes-simple';

let serverlessHandler: any | null = null;

async function buildHandler() {
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

  // سجّل جميع المسارات/الوسائط
  try {
    await registerRoutes(app);
  } catch (e: any) {
    console.error('Failed to initialize routes in Netlify function:', e?.message || e);
    // صحة بسيطة بدلاً من الفشل الكامل
    app.get('/health', (_req, res) => {
      res.status(200).json({ status: 'DEGRADED', reason: 'routes_init_failed', message: e?.message || String(e) });
    });
    app.all('*', (_req, res) => {
      res.status(503).json({ ok: false, reason: 'routes_init_failed' });
    });
  }

  // Health ثابتة داخل الدالة
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'OK', platform: 'netlify', ts: new Date().toISOString() });
  });

  // Optional: allow unauth upload in serverless by forwarding to route if a special header is set
  // This avoids 502 from auth on Netlify proxies if cookies are stripped. Keep disabled unless needed.
  /*
  app.post('/api/upload-document', async (req, res, next) => {
    if (req.headers['x-netlify-bypass-auth'] === '1') {
      // trust upstream to have authenticated; continue to registered handler
      return next();
    }
    return next();
  });
  */

  serverlessHandler = serverless(app as any, {
    basePath: '/.netlify/functions',
    // دعم multipart بشكل صريح
    binary: ['multipart/form-data', 'application/octet-stream', 'image/*', '*/*'],
    request: {
      binary: {
        contentTypes: ['multipart/form-data', 'application/octet-stream', 'image/*']
      }
    }
  } as any);
  return serverlessHandler;
}

export const handler = async (event: any, context: any) => {
  try {
    const h = serverlessHandler ?? (await buildHandler());
    return await h(event, context);
  } catch (err: any) {
    console.error('Netlify function handler failed:', err);
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: false, reason: 'init_failed', message: err?.message || 'unknown', path: event?.path }),
    };
  }
};
