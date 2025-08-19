# Copilot Instructions for `cod` Monorepo

## Architecture Overview

- **Monorepo Structure**:  
  - `client/`: React (Vite) SPA, organized by features (`src/components`, `src/pages`, etc.).
  - `server/`: Express API, modularized by domain (`storage.ts`, `pg-storage.ts`, `routes-simple.ts`, etc.).
  - `shared/`: Drizzle ORM schema and shared types for both client and server.
  - `middleware/`: Shared authentication and utility middleware (JWT-based).
  - `netlify/functions/`: Netlify serverless function entrypoint (`api.ts`), with a shim for server route imports.

- **Data Flow**:  
  - Client interacts with `/api/*` endpoints (proxied to Netlify function).
  - Server routes are registered via `registerRoutes(app)` in `server/routes-simple.ts`.
  - Database access is abstracted via `PgStorage` (Postgres, Neon) and fallback memory storage.

## Build & Deploy

- **Build Commands**:
  - `npm run build`: Builds both client (Vite) and server (esbuild).
  - `npm run dev`: Starts Express server and Vite dev server.
  - Netlify deploys using `npm run build`, publishing `dist/public` and serving API via `netlify/functions/api.ts`.

- **CI/CD**:
  - GitHub Actions (`.github/workflows/ci.yml`) runs type-check, build, and security audit on push/PR.

- **Netlify**:
  - Environment variables required: `DATABASE_URL`, `SESSION_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
  - Functions directory: `netlify/functions`
  - API requests: `/api/*` → `/.netlify/functions/api/:splat`

## Key Patterns & Conventions

- **Authentication**:
  - JWT-based, with middleware in `middleware/auth.js` (imported in server routes).
  - `req.user` is injected and used for all permission checks.

- **Database**:
  - All DB access via `PgStorage` (`server/pg-storage.ts`), which disables itself if `DATABASE_URL` is missing (important for serverless).
  - Shared schema/types in `shared/schema.ts` (Drizzle ORM).
  - Use helper methods `getSql()`, `castResult<T>()`, and `getFirstResult<T>()` in PgStorage for type safety.

- **Serverless Function**:
  - Netlify function imports routes via a local shim (`netlify/functions/server/routes-simple.ts`) to ensure bundling.
  - Avoid dynamic imports for server code; use static imports and shims.

- **Error Handling**:
  - API health endpoints: `/api/health` and `/.netlify/functions/api/health` for diagnostics.
  - If routes fail to initialize, function falls back to 503 with diagnostic JSON.

- **Environment**:
  - Secrets and DB URLs must be set in Netlify; do not commit real secrets.
  - Local dev uses `.env` and `.env.example`.

## Examples

- **Registering Routes**:
  ```ts
  // server/routes-simple.ts
  export async function registerRoutes(app: Express): Promise<Server> { ... }
  ```

- **Netlify Function Shim**:
  ```ts
  // netlify/functions/server/routes-simple.ts
  export { registerRoutes } from '../../../server/routes-simple';
  ```

- **Static Import in Function**:
  ```ts
  // netlify/functions/api.ts
  import { registerRoutes } from './server/routes-simple';
  ```

- **Database Operations in PgStorage**:
  ```ts
  async getUser(id: number): Promise<User | undefined> {
    return this.executeWithRetry(async () => {
      const sql = this.getSql();
      const result = await sql`SELECT * FROM users WHERE id = ${id}`;
      return this.getFirstResult<User>(result);
    });
  }
  ```

## Tips for AI Agents

- Always check for required environment variables before initializing DB/storage.
- Use static imports for server code in Netlify functions; avoid dynamic imports.
- When adding new API endpoints, register them in `server/routes-simple.ts` and ensure they use `authenticate` and `authorize` middleware as needed.
- For new shared types or schema changes, update `shared/schema.ts` and ensure both client and server are type-aligned.
- In PgStorage methods, always use `this.getSql()` to get the SQL instance and helper methods for type-safe result handling.
- Missing modules should be implemented as placeholder stubs to maintain build compatibility.
