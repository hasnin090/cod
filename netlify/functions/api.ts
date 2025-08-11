import serverless from 'serverless-http';
import express from 'express';
import { registerRoutes } from '../../server/routes-simple';

// Create an Express app and wire existing routes for Netlify Functions
const app = express();

// Basic parsers before routes
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Register all app routes/middleware (includes session)
// Note: registerRoutes returns an http.Server, but we only need it for middleware side-effects
await registerRoutes(app);

// Health at function root as well
app.get('/.netlify/functions/api/health', (_req, res) => {
  res.status(200).json({ status: 'OK', platform: 'netlify', ts: new Date().toISOString() });
});

export const handler = serverless(app, {
  requestId: false,
});
