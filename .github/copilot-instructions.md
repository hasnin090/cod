# AI Coding Assistant Instructions

## Architecture Overview

This is a full-stack accounting/financial management system built with:
- **Frontend**: React 18 + TypeScript + Vite + Shadcn/ui + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL (Neon) with Drizzle ORM
- **Storage**: Hybrid system (Supabase primary + local fallback)
- **Deployment**: Netlify with serverless functions
- **Auth**: JWT + session-based with role permissions

**Key directories**:
- `client/src/` - React frontend with pages, components, hooks, lib
- `server/` - Express backend with routes, storage, middleware
- `shared/` - Common schema/types between client/server
- `netlify/functions/` - Serverless API handlers

## Critical Workflows

### Development
```bash
npm run dev          # Runs client (port 5173) + server (port 3001) concurrently
npm run dev:client   # Frontend only
npm run dev:server   # Backend only
```

### Build & Deploy
```bash
npm run build        # Bundles client + server for Netlify
npm run build:netlify # Same as build
npm start            # Production server (after build)
```

### Database
```bash
npm run db:push      # Push schema changes to database
npm run check        # TypeScript type checking
```

## Project-Specific Patterns

### 1. Hybrid Storage System
- **Primary**: Supabase for cloud storage and database
- **Fallback**: Local file system when Supabase unavailable
- **Migration**: Tools in `server/migration-helper.ts` for data migration
- **Example**: `server/supabase-storage.ts` shows upload/download patterns

### 2. Authentication & Permissions
- **Context**: `client/src/context/auth-context.tsx` manages auth state
- **Middleware**: `server/middleware/auth.js` validates requests
- **Roles**: admin/manager/user/viewer with granular permissions
- **Pattern**: Check `user?.role === 'admin'` before admin operations

### 3. API Communication
- **Client**: `client/src/lib/api.ts` determines base URL (/api for all)
- **Server**: All routes in `server/routes-simple.ts` (4000+ lines)
- **Data fetching**: React Query with `queryClient.invalidateQueries()`
- **Error handling**: 401 auto-redirects to /login

### 4. File Upload System
- **Config**: `server/multer-config.ts` with separate configs per upload type
- **Storage**: Automatic Supabase upload with local fallback
- **Limits**: 20MB max, organized by type (transactions/, documents/, etc.)
- **Pattern**: Use `transactionUpload.single('file')` middleware

### 5. Arabic Localization
- **UI Text**: All user-facing text in Arabic
- **Date handling**: `react-datepicker` with Arabic locale
- **Comments**: Mix of Arabic/English comments in code
- **RTL**: Right-to-left layout considerations

### 6. Component Patterns
- **Forms**: React Hook Form + Zod validation
- **UI**: Shadcn/ui components with Radix primitives
- **State**: React Query for server state, Context for auth
- **Styling**: Tailwind with CSS variables for theming

### 7. Database Schema
- **Location**: `shared/schema.ts` defines all tables
- **ORM**: Drizzle with PostgreSQL
- **Migrations**: `server/migrations/` with SQL files
- **Indexes**: Optimized for common queries (project_id, date, etc.)

## Common Tasks

### Adding New Features
1. Add schema to `shared/schema.ts`
2. Create API routes in `server/routes-simple.ts`
3. Add React components in `client/src/components/`
4. Create page in `client/src/pages/`
5. Update navigation in `client/src/App.tsx`

### Database Changes
1. Modify `shared/schema.ts`
2. Run `npm run db:push` to update database
3. Update storage layer in `server/storage.ts` or `server/supabase-storage-class.ts`

### Adding Permissions
1. Define permission in `shared/schema.ts` PERMISSIONS object
2. Check permission in component: `user?.permissions?.includes('permission_name')`
3. Add to role logic in backend routes

### File Upload Integration
1. Import appropriate upload config from `server/multer-config.ts`
2. Add middleware: `app.post('/api/endpoint', uploadConfig.single('field'), handler)`
3. Handle in component with FormData and fetch

## Key Files to Reference

- `server/routes-simple.ts` - All API endpoints and business logic
- `shared/schema.ts` - Database schema and types
- `client/src/lib/api.ts` - API client configuration
- `server/supabase-storage-class.ts` - Storage implementation
- `client/src/context/auth-context.tsx` - Authentication state
- `client/src/App.tsx` - Main app routing and layout