import serverless from 'serverless-http';
import express from 'express';

let serverlessHandler: any | null = null;

async function buildHandler() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // Register all routes/middleware lazily to prevent top-level import failures from causing 502
  try {
    const mod = await import('../../server/routes-simple.js').catch(async () => {
      // When bundling TS, the .js extension might not resolve; try TS path too
      return await import('../../server/routes-simple');
    });
    const registerRoutes = (mod as any).registerRoutes as (app: any) => Promise<any>;
    if (typeof registerRoutes !== 'function') throw new Error('registerRoutes not found');
    await registerRoutes(app);
  } catch (e: any) {
    console.error('Failed to initialize full routes:', e?.message || e);
    // Provide minimal health and diagnostics instead of hard 502
    app.get('/health', (_req, res) => {
      res.status(200).json({ status: 'DEGRADED', reason: 'routes_init_failed', message: e?.message || String(e) });
    });
    app.all('*', (_req, res) => {
      res.status(503).json({ ok: false, reason: 'routes_init_failed', message: e?.message || 'Server initialization failed' });
    });
  }

  // Health (will be served under /.netlify/functions/api/health via basePath)
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'OK', platform: 'netlify', ts: new Date().toISOString() });
  });

  // Ensure Express sees paths without the Netlify function prefix
  serverlessHandler = serverless(app, { basePath: '/.netlify/functions/api' } as any);
  return serverlessHandler;
}

export const handler = async (event: any, context: any) => {
  try {
    const h = serverlessHandler ?? await buildHandler();
    return await h(event, context);
  } catch (err: any) {
    console.error('Netlify function init failed:', err);
    // Fallback plain response to avoid 502 and expose diagnostics
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ok: false,
        reason: 'init_failed',
        message: err?.message || 'unknown',
        path: event?.path,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        hasSupabase: !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      }),
    };
  }
};
