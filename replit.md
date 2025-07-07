# Arabic Accounting System

## Overview

This is a comprehensive Arabic accounting system designed for businesses and organizations in the Arabic-speaking world. The system provides complete financial management capabilities including transaction tracking, project management, user management, document handling, and comprehensive reporting with full Arabic RTL interface support.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript for type safety and modern development
- **Build Tool**: Vite for fast development builds and optimized production bundles
- **UI Framework**: Tailwind CSS with custom Arabic-first design system
- **Component Library**: Radix UI primitives with Shadcn/UI styling for accessibility
- **State Management**: TanStack React Query for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Styling**: PostCSS with custom CSS variables for theme consistency
- **Language Support**: Arabic-first interface with complete RTL (Right-to-Left) support

### Backend Architecture
- **Runtime**: Node.js with Express.js web framework
- **Language**: TypeScript with ES modules for modern JavaScript features
- **Database ORM**: Drizzle ORM providing type-safe database queries
- **Session Management**: Express sessions with PostgreSQL session store
- **Authentication**: Session-based authentication with bcrypt password hashing
- **File Upload**: Multer middleware for handling multipart/form-data
- **API Design**: RESTful endpoints with comprehensive error handling

## Key Components

### Database Schema
The system uses a comprehensive PostgreSQL schema with the following core tables:

- **Users Table**: Role-based user management with granular permissions
- **Projects Table**: Financial project tracking with user assignments
- **Transactions Table**: Income/expense tracking with file attachments
- **Documents Table**: Document management system with metadata
- **Activity Logs Table**: Complete audit trail of all system actions
- **Settings Table**: Configurable system parameters
- **Expense Types Table**: Categorization system for expense tracking
- **Employees Table**: Staff management with project assignments
- **Ledger Entries Table**: Double-entry bookkeeping support
- **Deferred Payments Table**: Payment scheduling and tracking

### Storage Management
- **Primary Storage**: Local file system storage in uploads directory
- **Cloud Backup**: Supabase Storage integration for data redundancy
- **Alternative Storage**: Firebase Storage as secondary backup option
- **File Migration**: Automated file organization and recovery systems
- **Orphaned File Cleanup**: Automated cleanup of unlinked attachments

### Security & Permissions
- **Authentication**: Secure session-based authentication system
- **Authorization**: Granular role-based permission system (admin, manager, user, viewer)
- **Password Security**: bcrypt hashing with configurable salt rounds
- **Session Security**: HTTP-only cookies with CSRF protection
- **Data Validation**: Comprehensive input validation using Zod schemas

## Data Flow

### Authentication Flow
1. User submits credentials through login form
2. Server validates credentials against encrypted database passwords
3. Successful authentication creates secure session with user permissions
4. Session token stored in HTTP-only cookie for subsequent requests
5. Protected routes verify session validity before granting access

### Transaction Processing
1. User creates transaction through form interface
2. Optional file attachment uploaded to storage system
3. Transaction data validated and stored in database
4. Activity log entry created for audit trail
5. Real-time updates sent to connected clients
6. Automatic backup triggered for critical operations

### Project Management Flow
1. Projects created with financial budgets and user assignments
2. Transactions can be associated with specific projects
3. Project financial summaries calculated in real-time
4. User access controlled based on project assignments
5. Comprehensive reporting available for project analysis

## External Dependencies

### Database Services
- **Primary**: Neon PostgreSQL (serverless PostgreSQL)
- **Backup**: Supabase PostgreSQL with real-time features
- **Local Development**: PostgreSQL 14+ for local development

### Storage Services
- **Primary**: Local file system storage
- **Cloud Backup**: Supabase Storage for file redundancy
- **Alternative**: Firebase Storage for additional backup

### Development Dependencies
- **TypeScript**: Type safety and enhanced developer experience
- **ESLint**: Code quality and consistency enforcement
- **Prettier**: Automated code formatting
- **Drizzle Kit**: Database migration and schema management

### Build Tools
- **Vite**: Fast build tool with HMR for development
- **PostCSS**: CSS processing with Tailwind CSS
- **esbuild**: Fast JavaScript bundling for production

## Deployment Strategy

### Production Deployment Options
1. **Render** (Recommended): Automated deployment with PostgreSQL
2. **Railway**: Simple deployment with integrated database
3. **VPS Deployment**: Docker-based deployment for custom infrastructure
4. **Netlify + Supabase**: JAMstack deployment with serverless backend

### Environment Configuration
- **Development**: Local PostgreSQL with file storage
- **Staging**: Cloud database with local file storage
- **Production**: Cloud database with cloud storage redundancy

### Database Migration Strategy
- **Schema Management**: Drizzle migrations for version control
- **Data Backup**: Automated daily backups with point-in-time recovery
- **Rollback Strategy**: Schema versioning for safe rollbacks

### Monitoring and Maintenance
- **Health Checks**: Database connectivity and response time monitoring
- **Error Logging**: Comprehensive error tracking and alerting
- **Performance Monitoring**: Query performance and response time tracking
- **Automatic Backups**: Scheduled backups with configurable retention

## Changelog

- July 03, 2025. Initial setup
- July 03, 2025. Fixed application startup issues by removing problematic backup system imports and creating simplified routes. Application now running successfully with core functionality.
- July 04, 2025. Implemented cloud-first storage architecture transition:
  * Created cloud storage migration system with Supabase as primary storage
  * Added safe migration tools to protect existing 554 transactions and files
  * Implemented automatic local backup system for cloud-stored files
  * Added comprehensive migration interface for admin users (/cloud-migration)
  * Enhanced file upload system to use cloud storage with local fallback
  * Created protection mechanisms for existing operations during storage transition
  
- July 04, 2025. **Successfully implemented hybrid storage strategy** due to Supabase MIME type restrictions:
  * Discovered Supabase Storage rejects common file types (JPEG, CSV, JSON, even text/plain)
  * Created optimal hybrid approach: **Local file storage + Cloud data backups**
  * Implemented automatic hourly cloud backups for database summaries and metadata
  * Added real-time status monitoring for both local and cloud storage systems
  * Built comprehensive hybrid storage management API endpoints
  * System now supports 6 files (2.48 MB) locally with cloud data redundancy
  * **Recommendation**: Continue with hybrid approach as it's more reliable and cost-effective

- July 04, 2025. **Successfully fixed all critical API endpoints and functionality issues**:
  * Fixed missing delete endpoints for deferred payments, employees, documents, projects, and completed works
  * Added comprehensive CRUD operations for all major entities (create, read, update, delete)
  * Fixed project creation issue by handling required start_date field with default values
  * Implemented archived transactions functionality with archive/unarchive capabilities
  * Added proper error handling and activity logging for all new endpoints
  * Tested and verified all operations work correctly with proper authentication and authorization
  * Fixed false error display in project deletion - now only shows errors for actual failures
  * Fixed transaction creation issue by moving POST /api/transactions before Vite middleware in index.ts
  * Resolved Vite middleware interference with API endpoints - transactions now create successfully
  * Fixed deferred payment installment functionality by adding POST /api/deferred-payments/:id/pay to index.ts
  * Resolved deferred payment processing - payments now register correctly with automatic transaction creation
  * **Status**: All reported functionality issues have been resolved successfully

- July 05, 2025. **Fixed deferred payments permission issue for regular users**:
  * Identified that POST /api/deferred-payments was restricted to admin/manager roles only
  * Regular user "ضحئ" was getting 403 Forbidden when attempting to add receivables
  * Created new endpoint in server/index.ts that allows users to add deferred payments for their assigned projects
  * Moved custom endpoints before registerRoutes() to ensure proper priority over routes-simple.ts
  * Added project access validation - users can only add receivables for projects they're assigned to
  * Removed duplicate endpoint from routes-simple.ts to prevent conflicts
  * **Result**: User "ضحئ" successfully created deferred payment ID 21 for 50,000 in project "فندق المصايف"
  * **Status**: Deferred payments functionality now works correctly for all user roles with proper permissions

- July 07, 2025. **Implemented project-based access control system**:
  * Fixed user-form project selection display issue (SelectItem empty value error)
  * Fixed database schema conflicts in user_projects table (removed non-existent "role" column)
  * **Major Architecture Change**: Redesigned system to be project-centric instead of user-centric
  * Operations now belong to projects, not individual users - users are assigned to projects as "executors"
  * Added new functions: getTransactionsForUserProjects(), canUserAccessTransaction()
  * Updated /api/transactions endpoint: admins see all, users see only their assigned project transactions
  * Updated /api/projects endpoint: admins see all, users see only assigned projects
  * Enhanced permission system: users can modify/delete transactions for their assigned projects
  * **Result**: System now supports proper multi-user project management where operations persist regardless of user changes
  * **Status**: Project-based access control fully implemented and tested successfully

- July 07, 2025. **Fixed password hashing issue and prepared Supabase migration**:
  * Resolved password encryption bug where admin couldn't change user passwords properly
  * Fixed bcrypt hashing in user update endpoint - passwords now properly encrypted when changed
  * Created comprehensive Supabase migration files with all 559 transactions preserved
  * Generated manual import guide due to network connectivity issues with automated migration
  * **Files created**: supabase-import-simple.sql, manual-supabase-import-guide.md, full database backup
  * **User credentials**: admin/admin123, user "ضحئ"/90909090 (properly hashed)
  * **Status**: System ready for manual migration to Supabase with all data preserved

## User Preferences

Preferred communication style: Simple, everyday language.