# Netlify + Supabase deployment

Required environment variables (set in Netlify Site settings > Environment):

- DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<database>
- SESSION_SECRET=<a-very-long-random-secret>
- SUPABASE_URL=https://<project>.supabase.co
- SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

Security note:
- Do NOT commit real secrets into the repository. If any secrets were committed previously, rotate them immediately:
	- Supabase: Project Settings > API > regenerate Service Role and (optionally) anon keys, then update Netlify env vars.
	- Database password: rotate/reset in your DB provider (e.g., Supabase/Neon) and update DATABASE_URL.
	- SESSION_SECRET: generate a new random value and update it in Netlify and your local .env.

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
