import { pgTable, text, serial, integer, boolean, timestamp, jsonb, unique, pgEnum, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Roles and permissions
export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  USER: 'user',
  VIEWER: 'viewer'
} as const;

export const PERMISSIONS = {
  VIEW_DASHBOARD: 'view_dashboard',
  MANAGE_USERS: 'manage_users',
  VIEW_USERS: 'view_users',
  MANAGE_PROJECTS: 'manage_projects',
  VIEW_PROJECTS: 'view_projects',
  MANAGE_PROJECT_TRANSACTIONS: 'manage_project_transactions',
  VIEW_PROJECT_TRANSACTIONS: 'view_project_transactions',
  MANAGE_TRANSACTIONS: 'manage_transactions',
  VIEW_TRANSACTIONS: 'view_transactions',
  MANAGE_DOCUMENTS: 'manage_documents',
  VIEW_DOCUMENTS: 'view_documents',
  VIEW_REPORTS: 'view_reports',
  VIEW_ACTIVITY_LOGS: 'view_activity_logs',
  MANAGE_SETTINGS: 'manage_settings',
  VIEW_INCOME: 'view_income'
} as const;

// Users
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  plainPassword: text("plain_password"),
  name: text("name").notNull(),
  email: text("email"),
  role: text("role").notNull().default("user"),
  permissions: jsonb("permissions").default([]).notNull(),
  active: boolean("active").notNull().default(true),
});

// Projects
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  startDate: timestamp("start_date").notNull(),
  budget: integer("budget").default(0),
  spent: integer("spent").default(0),
  status: text("status").notNull().default("active"),
  progress: integer("progress").notNull().default(0),
  createdBy: integer("created_by").notNull().references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
});

// Employees
export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  salary: integer("salary").notNull().default(0),
  currentBalance: integer("current_balance").notNull().default(0),
  totalPaid: integer("total_paid").notNull().default(0),
  lastSalaryReset: timestamp("last_salary_reset").defaultNow(),
  assignedProjectId: integer("assigned_project_id").references(() => projects.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  active: boolean("active").notNull().default(true),
  hireDate: timestamp("hire_date").defaultNow(),
  notes: text("notes"),
  createdBy: integer("created_by").notNull().references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => {
  return {
    employeesAssignedProjectIdx: index("employees_assigned_project_idx").on(table.assignedProjectId),
    employeesActiveIdx: index("employees_active_idx").on(table.active),
  };
});

// Transactions
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  date: timestamp("date").notNull(),
  amount: integer("amount").notNull(),
  type: text("type").notNull(), // income, expense
  expenseType: text("expense_type"),
  description: text("description").notNull(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  createdBy: integer("created_by").notNull().references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  fileUrl: text("file_url"),
  fileType: text("file_type"),
  archived: boolean("archived").notNull().default(false),
}, (table) => {
  return {
    transactionsProjectIdx: index("transactions_project_idx").on(table.projectId),
    transactionsDateIdx: index("transactions_date_idx").on(table.date),
    transactionsEmployeeIdx: index("transactions_employee_idx").on(table.employeeId),
    transactionsArchivedIdx: index("transactions_archived_idx").on(table.archived),
  };
});

// UserProjects - assignments
export const userProjects = pgTable("user_projects", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
  assignedBy: integer("assigned_by").notNull().references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
}, (table) => {
  return {
    userProjectUnique: unique().on(table.userId, table.projectId),
    userProjectsUserIdx: index("user_projects_user_idx").on(table.userId),
    userProjectsProjectIdx: index("user_projects_project_idx").on(table.projectId),
  };
});

// Documents
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  fileUrl: text("file_url").notNull(),
  fileType: text("file_type").notNull(),
  uploadDate: timestamp("upload_date").notNull(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  uploadedBy: integer("uploaded_by").notNull().references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
  isManagerDocument: boolean("is_manager_document").default(false),
  category: text("category").default("general"),
  tags: jsonb("tags").default([]).notNull(),
}, (table) => {
  return {
    documentsProjectIdx: index("documents_project_idx").on(table.projectId),
    documentsUploadDateIdx: index("documents_upload_date_idx").on(table.uploadDate),
  };
});

// Link: Document <-> Transaction
export const documentTransactionLinks = pgTable("document_transaction_links", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull().references(() => documents.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  transactionId: integer("transaction_id").notNull().references(() => transactions.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  linkType: text("link_type").notNull().default("receipt"),
  linkedBy: integer("linked_by").notNull().references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
  linkedAt: timestamp("linked_at").notNull().defaultNow(),
  notes: text("notes"),
}, (table) => {
  return {
    documentTransactionUnique: unique().on(table.documentId, table.transactionId),
    documentTransactionLinkTypeIdx: index("document_transaction_link_type_idx").on(table.linkType),
  };
});

// Activity logs
export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  details: text("details").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
}, (table) => {
  return {
    activityLogsEntityIdx: index("activity_logs_entity_idx").on(table.entityType, table.entityId),
    activityLogsUserIdx: index("activity_logs_user_idx").on(table.userId),
  };
});

// Settings
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
});

// Transaction Edit Permissions
export const transactionEditPermissions = pgTable("transaction_edit_permissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  projectId: integer("project_id").references(() => projects.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  grantedBy: integer("granted_by").notNull().references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
  grantedAt: timestamp("granted_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  revokedBy: integer("revoked_by").references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  revokedAt: timestamp("revoked_at"),
  reason: text("reason"),
  notes: text("notes"),
}, (table) => {
  return {
    userEditPermissionUnique: unique().on(table.userId, table.isActive),
    projectEditPermissionUnique: unique().on(table.projectId, table.isActive),
  };
});

// Expense Types
export const expenseTypes = pgTable("expense_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  projectId: integer("project_id").references(() => projects.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => {
  return {
    nameProjectUnique: unique().on(table.name, table.projectId),
    expenseTypesProjectIdx: index("expense_types_project_idx").on(table.projectId),
    expenseTypesActiveIdx: index("expense_types_active_idx").on(table.isActive),
  };
});

// Ledger Entries
export const ledgerEntries = pgTable("ledger_entries", {
  id: serial("id").primaryKey(),
  date: timestamp("date").notNull(),
  transactionId: integer("transaction_id").references(() => transactions.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  expenseTypeId: integer("expense_type_id").references(() => expenseTypes.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  accountName: text("account_name"),
  amount: integer("amount").notNull(),
  debitAmount: integer("debit_amount").default(0),
  creditAmount: integer("credit_amount").default(0),
  description: text("description").notNull(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  entryType: text("entry_type").notNull(),
  entryDate: timestamp("entry_date").defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => {
  return {
    ledgerEntriesProjectIdx: index("ledger_entries_project_idx").on(table.projectId),
    ledgerEntriesDateIdx: index("ledger_entries_date_idx").on(table.date),
  };
});

// Funds
export const fundTypeEnum = pgEnum('fund_type', ['admin', 'project']);
export const funds = pgTable("funds", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  balance: integer("balance").notNull().default(0),
  type: fundTypeEnum("type").notNull(),
  ownerId: integer("owner_id").references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  projectId: integer("project_id").references(() => projects.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => {
  return {
    fundsTypeIdx: index("funds_type_idx").on(table.type),
    fundsProjectIdx: index("funds_project_idx").on(table.projectId),
  };
});

// Account Categories
export const accountCategories = pgTable("account_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  active: boolean("active").notNull().default(true),
  createdBy: integer("created_by").notNull().references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => {
  return {
    accountCategoriesActiveIdx: index("account_categories_active_idx").on(table.active),
  };
});

// Deferred Payments
export const deferredPayments = pgTable("deferred_payments", {
  id: serial("id").primaryKey(),
  beneficiaryName: text("beneficiary_name").notNull(),
  totalAmount: integer("total_amount").notNull(),
  paidAmount: integer("paid_amount").notNull().default(0),
  remainingAmount: integer("remaining_amount").notNull(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  userId: integer("user_id").references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }).notNull(),
  status: text("status").notNull().default("pending"),
  description: text("description"),
  dueDate: timestamp("due_date"),
  installments: integer("installments").notNull().default(1),
  paymentFrequency: text("payment_frequency").notNull().default("monthly"),
  notes: text("notes"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => {
  return {
    deferredPaymentsProjectIdx: index("deferred_payments_project_idx").on(table.projectId),
    deferredPaymentsStatusIdx: index("deferred_payments_status_idx").on(table.status),
    deferredPaymentsDueDateIdx: index("deferred_payments_due_date_idx").on(table.dueDate),
  };
});

// Completed Works
export const completedWorks = pgTable("completed_works", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  amount: integer("amount"),
  date: timestamp("date").notNull(),
  category: text("category"),
  status: text("status").notNull().default("active"),
  fileUrl: text("file_url"),
  fileType: text("file_type"),
  createdBy: integer("created_by").notNull().references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => {
  return {
    completedWorksStatusIdx: index("completed_works_status_idx").on(table.status),
    completedWorksDateIdx: index("completed_works_date_idx").on(table.date),
  };
});

// Completed Works Documents
export const completedWorksDocuments = pgTable("completed_works_documents", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  fileUrl: text("file_url").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size"),
  category: text("category"),
  tags: text("tags"),
  createdBy: integer("created_by").notNull().references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => {
  return {
    completedWorksDocsCategoryIdx: index("completed_works_docs_category_idx").on(table.category),
  };
});

// Payroll: salary payments
export const employeeSalaryPayments = pgTable("employee_salary_payments", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employees.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
  amount: integer("amount").notNull(),
  description: text("description"),
  transactionId: integer("transaction_id").references(() => transactions.id, { onDelete: 'set null', onUpdate: 'cascade' }),
  paidAt: timestamp("paid_at").notNull().defaultNow(),
  createdBy: integer("created_by").notNull().references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
}, (table) => {
  return {
    employeeSalaryPaymentsEmployeeIdx: index("employee_salary_payments_employee_idx").on(table.employeeId),
    employeeSalaryPaymentsPaidAtIdx: index("employee_salary_payments_paid_at_idx").on(table.paidAt),
  };
});

// Payroll: salary resets
export const salaryResets = pgTable("salary_resets", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employees.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
  previousBalance: integer("previous_balance").notNull(),
  newBalance: integer("new_balance").notNull(),
  resetAt: timestamp("reset_at").notNull().defaultNow(),
  resetBy: integer("reset_by").notNull().references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
  notes: text("notes"),
}, (table) => {
  return {
    salaryResetsEmployeeIdx: index("salary_resets_employee_idx").on(table.employeeId),
    salaryResetsResetAtIdx: index("salary_resets_reset_at_idx").on(table.resetAt),
  };
});

// ---------- Insert Schemas ----------
export const insertUserSchema = createInsertSchema(users)
  .omit({ id: true })
  .extend({
    password: z.string().min(6, "كلمة المرور يجب أن لا تقل عن 6 أحرف"),
    email: z.string().email("البريد الإلكتروني غير صالح").optional().or(z.literal("")),
    projectId: z.number().optional(),
    permissions: z.array(z.string()).optional(),
  });

export const insertProjectSchema = createInsertSchema(projects)
  .omit({ id: true, progress: true })
  .extend({
    startDate: z.coerce.date(),
    budget: z.number().optional().default(0),
    spent: z.number().optional().default(0),
    createdBy: z.number().optional(),
  });

export const insertEmployeeSchema = createInsertSchema(employees)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    hireDate: z.coerce.date().optional().default(() => new Date()),
    createdBy: z.number().optional(),
  });
export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;

export const insertTransactionSchema = createInsertSchema(transactions)
  .omit({ id: true })
  .extend({
    date: z.coerce.date(),
    createdBy: z.number().optional(),
  });

export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true })
  .extend({
    isManagerDocument: z.boolean().optional().default(false),
  });

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({ id: true, timestamp: true });
export const insertSettingSchema = createInsertSchema(settings).omit({ id: true });
export const insertUserProjectSchema = createInsertSchema(userProjects).omit({ id: true, assignedAt: true });

export const insertFundSchema = createInsertSchema(funds)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    type: z.enum(['admin', 'project']),
  });

export const insertExpenseTypeSchema = createInsertSchema(expenseTypes)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    projectId: z.number().optional(),
  });

export const insertLedgerEntrySchema = createInsertSchema(ledgerEntries)
  .omit({ id: true, createdAt: true })
  .extend({
    transactionId: z.number().nullable().optional(),
    accountName: z.string().optional(),
    debitAmount: z.number().optional().default(0),
    creditAmount: z.number().optional().default(0),
    entryDate: z.union([z.string(), z.date()]).optional(),
  });

export const insertAccountCategorySchema = createInsertSchema(accountCategories)
  .omit({ id: true, createdAt: true, updatedAt: true });

export const insertDeferredPaymentSchema = createInsertSchema(deferredPayments)
  .omit({ id: true, paidAmount: true, status: true, completedAt: true, createdAt: true, updatedAt: true })
  .extend({
    totalAmount: z.number().positive("المبلغ الإجمالي يجب أن يكون أكبر من الصفر"),
    beneficiaryName: z.string().min(1, "اسم المستفيد مطلوب"),
    remainingAmount: z.number().optional(),
    dueDate: z.union([z.string(), z.date()]).optional().nullable(),
    userId: z.number().optional(),
  });

export const insertCompletedWorkSchema = createInsertSchema(completedWorks)
  .omit({ id: true, createdBy: true, createdAt: true, updatedAt: true })
  .extend({
    date: z.union([z.string(), z.date()]),
    amount: z.number().optional().nullable(),
  });

export const insertCompletedWorksDocumentSchema = createInsertSchema(completedWorksDocuments)
  .omit({ id: true, createdBy: true, createdAt: true, updatedAt: true })
  .extend({
    fileSize: z.number().optional().nullable(),
  });

export const insertDocumentTransactionLinkSchema = createInsertSchema(documentTransactionLinks)
  .omit({ id: true, linkedAt: true });

export const insertEmployeeSalaryPaymentSchema = createInsertSchema(employeeSalaryPayments)
  .omit({ id: true, paidAt: true });

export const insertSalaryResetSchema = createInsertSchema(salaryResets)
  .omit({ id: true, resetAt: true });

export const insertTransactionEditPermissionSchema = createInsertSchema(transactionEditPermissions)
  .omit({ id: true, grantedAt: true });

// ---------- Types ----------
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

export type InsertDocumentTransactionLink = z.infer<typeof insertDocumentTransactionLinkSchema>;
export type DocumentTransactionLink = typeof documentTransactionLinks.$inferSelect;

export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;

export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type Setting = typeof settings.$inferSelect;

export type InsertUserProject = z.infer<typeof insertUserProjectSchema>;
export type UserProject = typeof userProjects.$inferSelect;

export type InsertFund = z.infer<typeof insertFundSchema>;
export type Fund = typeof funds.$inferSelect;

export type InsertExpenseType = z.infer<typeof insertExpenseTypeSchema>;
export type ExpenseType = typeof expenseTypes.$inferSelect;

export type InsertLedgerEntry = z.infer<typeof insertLedgerEntrySchema>;
export type LedgerEntry = typeof ledgerEntries.$inferSelect;

export type InsertAccountCategory = z.infer<typeof insertAccountCategorySchema>;
export type AccountCategory = typeof accountCategories.$inferSelect;

export type InsertDeferredPayment = z.infer<typeof insertDeferredPaymentSchema>;
export type DeferredPayment = typeof deferredPayments.$inferSelect;

export type InsertCompletedWork = z.infer<typeof insertCompletedWorkSchema>;
export type CompletedWork = typeof completedWorks.$inferSelect;

export type InsertCompletedWorksDocument = z.infer<typeof insertCompletedWorksDocumentSchema>;
export type CompletedWorksDocument = typeof completedWorksDocuments.$inferSelect;

export type InsertEmployeeSalaryPayment = z.infer<typeof insertEmployeeSalaryPaymentSchema>;
export type EmployeeSalaryPayment = typeof employeeSalaryPayments.$inferSelect;

export type InsertSalaryReset = z.infer<typeof insertSalaryResetSchema>;
export type SalaryReset = typeof salaryResets.$inferSelect;

export type InsertTransactionEditPermission = z.infer<typeof insertTransactionEditPermissionSchema>;
export type TransactionEditPermission = typeof transactionEditPermissions.$inferSelect;

// Auth types
export const loginSchema = z.object({
  username: z.string().min(1, "اسم المستخدم مطلوب"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});
export type LoginCredentials = z.infer<typeof loginSchema>;
