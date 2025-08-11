import serverless from 'serverless-http';
import express from 'express';
import { registerRoutes } from '../../server/routes-simple';

let serverlessHandler: any | null = null;

async function buildHandler() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // Register all routes/middleware
  await registerRoutes(app);

  // Health under function prefix
  app.get('/.netlify/functions/api/health', (_req, res) => {
    res.status(200).json({ status: 'OK', platform: 'netlify', ts: new Date().toISOString() });
  });

  serverlessHandler = serverless(app, { requestId: false });
  return serverlessHandler;
}

export const handler = async (event: any, context: any) => {
  const h = serverlessHandler ?? await buildHandler();
  return h(event, context);
};
