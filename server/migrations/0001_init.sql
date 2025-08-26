-- Initial schema for accounting system (snake_case), aligned with shared/schema.ts
-- Users
create table if not exists users (
  id serial primary key,
  username text not null unique,
  password text not null,
  plain_password text,
  name text not null,
  email text,
  role text not null default 'user',
  permissions jsonb not null default '[]'::jsonb,
  active boolean not null default true
);

-- Projects
create table if not exists projects (
  id serial primary key,
  name text not null,
  description text not null,
  start_date timestamptz not null,
  budget integer default 0,
  spent integer default 0,
  status text not null default 'active',
  progress integer not null default 0,
  created_by integer not null references users(id)
);

-- Transactions
create table if not exists transactions (
  id serial primary key,
  date timestamptz not null,
  amount integer not null,
  type text not null,
  expense_type text,
  description text not null,
  project_id integer references projects(id),
  created_by integer not null references users(id),
  employee_id integer,
  file_url text,
  file_type text,
  archived boolean not null default false
);

-- User projects
create table if not exists user_projects (
  id serial primary key,
  user_id integer not null references users(id),
  project_id integer not null references projects(id),
  assigned_at timestamptz not null default now(),
  assigned_by integer not null references users(id),
  constraint user_project_unique unique (user_id, project_id)
);

-- Documents
create table if not exists documents (
  id serial primary key,
  name text not null,
  description text,
  file_url text not null,
  file_type text not null,
  upload_date timestamptz not null,
  project_id integer references projects(id),
  uploaded_by integer not null references users(id),
  is_manager_document boolean default false,
  category text default 'general',
  tags jsonb not null default '[]'::jsonb
);

-- Document ↔ Transaction links
create table if not exists document_transaction_links (
  id serial primary key,
  document_id integer not null references documents(id),
  transaction_id integer not null references transactions(id),
  link_type text not null default 'receipt',
  linked_by integer not null references users(id),
  linked_at timestamptz not null default now(),
  notes text,
  constraint document_transaction_unique unique (document_id, transaction_id)
);

-- Activity logs
create table if not exists activity_logs (
  id serial primary key,
  action text not null,
  entity_type text not null,
  entity_id integer not null,
  details text not null,
  timestamp timestamptz not null default now(),
  user_id integer not null references users(id)
);

-- Settings
create table if not exists settings (
  id serial primary key,
  key text not null unique,
  value text not null,
  description text
);

-- Transaction edit permissions
create table if not exists transaction_edit_permissions (
  id serial primary key,
  user_id integer references users(id),
  project_id integer references projects(id),
  granted_by integer not null references users(id),
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  is_active boolean not null default true,
  revoked_by integer references users(id),
  revoked_at timestamptz,
  reason text,
  notes text
);
create unique index if not exists transaction_edit_permissions_user_active_idx on transaction_edit_permissions(user_id, is_active);
create unique index if not exists transaction_edit_permissions_project_active_idx on transaction_edit_permissions(project_id, is_active);

-- Expense types
create table if not exists expense_types (
  id serial primary key,
  name text not null,
  description text,
  project_id integer references projects(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists expense_types_name_project_unique_idx on expense_types(name, coalesce(project_id, -1));

-- Ledger entries
create table if not exists ledger_entries (
  id serial primary key,
  date timestamptz not null,
  transaction_id integer references transactions(id),
  expense_type_id integer references expense_types(id),
  account_name text,
  amount integer not null,
  debit_amount integer default 0,
  credit_amount integer default 0,
  description text not null,
  project_id integer references projects(id),
  entry_type text not null,
  entry_date timestamptz default now(),
  created_at timestamptz not null default now()
);

-- Funds
create type if not exists fund_type as enum ('admin', 'project');
create table if not exists funds (
  id serial primary key,
  name text not null,
  balance integer not null default 0,
  type fund_type not null,
  owner_id integer references users(id),
  project_id integer references projects(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Employees
create table if not exists employees (
  id serial primary key,
  name text not null,
  salary integer not null default 0,
  current_balance integer not null default 0,
  total_paid integer not null default 0,
  last_salary_reset timestamptz default now(),
  assigned_project_id integer references projects(id),
  active boolean not null default true,
  hire_date timestamptz not null default now(),
  notes text,
  created_by integer not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Account categories
create table if not exists account_categories (
  id serial primary key,
  name text not null unique,
  description text,
  active boolean not null default true,
  created_by integer not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Deferred payments
create table if not exists deferred_payments (
  id serial primary key,
  beneficiary_name text not null,
  total_amount integer not null,
  paid_amount integer not null default 0,
  remaining_amount integer not null,
  project_id integer references projects(id),
  user_id integer not null references users(id),
  status text not null default 'pending',
  description text,
  due_date timestamptz,
  installments integer not null default 1,
  payment_frequency text not null default 'monthly',
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
