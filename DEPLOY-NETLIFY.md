# Netlify + Supabase deployment

Required environment variables (set in Netlify Site settings > Environment):

- DATABASE_URL
- SESSION_SECRET
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

Build settings:
- Build command: npm run build
- Publish directory: dist/public

Functions:
- Functions directory: netlify/functions
- Redirects: /api/* -> /.netlify/functions/api/:splat

Local dev:
- npm run dev (Express + Vite)

Notes:
- Netlify Functions filesystem is ephemeral. We write to /tmp for uploads and skip local backups.
- Sessions use in-memory store by default; for production, prefer a DB-backed session or JWT.
