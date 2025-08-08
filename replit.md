# Arabic Accounting System

## Overview
This is a comprehensive Arabic accounting system designed for businesses and organizations in the Arabic-speaking world. The system provides complete financial management capabilities including transaction tracking, project management, user management, document handling, and comprehensive reporting with full Arabic RTL interface support. Its business vision is to streamline financial operations for Arabic-speaking entities, offering robust features in a culturally appropriate interface.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes (Aug 2025)
- **Project-Specific Expense Types**: Implemented project-based expense type categorization where each project can have its own expense categories
- **Enhanced Expense Type Management**: Added ability to create, edit, and manage expense types with project associations
- **Role-Based Filtering**: Administrators see all expense types, regular users only see their project's expense types plus general ones
- **Password Display**: Enhanced admin functionality to view plain text passwords for user management

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Framework**: Tailwind CSS with custom Arabic-first design system
- **Component Library**: Radix UI primitives with Shadcn/UI styling
- **State Management**: TanStack React Query
- **Routing**: Wouter
- **Styling**: PostCSS with custom CSS variables
- **Language Support**: Arabic-first interface with complete RTL (Right-to-Left) support

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM
- **Session Management**: Express sessions with PostgreSQL session store
- **Authentication**: Session-based with bcrypt password hashing
- **File Upload**: Multer middleware
- **API Design**: RESTful endpoints

### Key Components
- **Database Schema**: Comprehensive PostgreSQL schema including Users, Projects, Transactions, Documents, Activity Logs, Settings, Expense Types (with project linking), Employees, Ledger Entries, and Deferred Payments.
- **Storage Management**: Hybrid approach utilizing local file system storage for primary files and cloud storage (Supabase) for backups and redundancy. Includes automated file organization and orphaned file cleanup.
- **Security & Permissions**: Secure session-based authentication, granular role-based authorization (admin, manager, user, viewer), bcrypt password hashing, HTTP-only cookies with CSRF protection, and Zod schema-based data validation.
- **Project-Based Expense Types**: System now supports linking expense types to specific projects. Administrators can view all expense types, while regular users only see expense types for their assigned projects plus general expense types.
- **Data Flow**:
    - **Authentication**: Secure session creation with HTTP-only cookies.
    - **Transaction Processing**: User-initiated transactions with optional file attachments, database storage, activity logging, and real-time updates.
    - **Project Management**: Project creation with budgets and user assignments, transaction association, real-time financial summaries, and role-based access control.

### UI/UX Decisions
The system prioritizes an Arabic-first design, supporting RTL layout throughout. It uses a custom design system built with Tailwind CSS and leverages Radix UI/Shadcn/UI for accessible components, ensuring a consistent and user-friendly experience.

### System Design Choices
The core architecture is project-centric, meaning operations and data are primarily linked to projects rather than individual users. Users are assigned to projects, and their access and permissions are determined by these assignments. This ensures robust multi-user project management and data isolation.

## External Dependencies

### Database Services
- **Primary**: Neon PostgreSQL
- **Backup**: Supabase PostgreSQL
- **Local Development**: PostgreSQL 14+

### Storage Services
- **Primary**: Local file system storage
- **Cloud Backup**: Supabase Storage

### Development Dependencies
- **TypeScript**
- **ESLint**
- **Prettier**
- **Drizzle Kit**

### Build Tools
- **Vite**
- **PostCSS**
- **esbuild**