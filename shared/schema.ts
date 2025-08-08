import { pgTable, text, serial, integer, boolean, timestamp, jsonb, unique, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// تعريف قيم وأنواع الأدوار والصلاحيات للاستخدام في التطبيق
// ملاحظة: نحتفظ بهذه الأنواع كمرجع ولكن لا ننشئ الجداول الآن بسبب قيود الترحيل

// قائمة الأدوار المتاحة (للاستخدام البرمجي فقط، لا تنشئ جدولاً)
export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  USER: 'user',
  VIEWER: 'viewer'
} as const;

// قائمة الصلاحيات المتاحة (للاستخدام البرمجي فقط، لا تنشئ جدولاً)
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

// Users table - نستخدم البنية الحالية
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  plainPassword: text("plain_password"), // كلمة المرور الأصلية للمديرين
  name: text("name").notNull(),
  email: text("email"), // Haciendo el correo electrónico opcional (puede ser nulo o vacío)
  role: text("role").notNull().default("user"), // admin, user, manager, viewer
  permissions: jsonb("permissions").default([]).notNull(),
  active: boolean("active").notNull().default(true),
});

// Projects table
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  startDate: timestamp("start_date").notNull(),
  budget: integer("budget").default(0), // ميزانية المشروع
  spent: integer("spent").default(0), // المبلغ المُنفق
  status: text("status").notNull().default("active"), // active, completed, paused
  progress: integer("progress").notNull().default(0),
  createdBy: integer("created_by").notNull().references(() => users.id),
});

// Transactions table
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  date: timestamp("date").notNull(),
  amount: integer("amount").notNull(),
  type: text("type").notNull(), // income, expense
  expenseType: text("expense_type"), // نوع المصروف: راتب، سفة، مشتريات، اجور تشغيلية، مصروف عام
  description: text("description").notNull(),
  projectId: integer("project_id").references(() => projects.id),
  createdBy: integer("created_by").notNull().references(() => users.id),
  employeeId: integer("employee_id"), // معرف الموظف في حالة معاملات الرواتب
  fileUrl: text("file_url"), // URL للملف المرفق (اختياري)
  fileType: text("file_type"), // نوع الملف المرفق (اختياري)
  archived: boolean("archived").notNull().default(false), // حقل الأرشفة
});

// UserProjects table - for managing user project assignments
export const userProjects = pgTable("user_projects", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  projectId: integer("project_id").notNull().references(() => projects.id),
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
  assignedBy: integer("assigned_by").notNull().references(() => users.id),
}, (table) => {
  return {
    userProjectUnique: unique().on(table.userId, table.projectId),
  };
});

// Documents table
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  fileUrl: text("file_url").notNull(),
  fileType: text("file_type").notNull(),
  uploadDate: timestamp("upload_date").notNull(),
  projectId: integer("project_id").references(() => projects.id),
  uploadedBy: integer("uploaded_by").notNull().references(() => users.id),
  isManagerDocument: boolean("is_manager_document").default(false), // إضافة حقل للإشارة إلى المستندات الإدارية
  category: text("category").default("general"), // تصنيف المستند: receipt, contract, general, etc.
  tags: jsonb("tags").default([]).notNull(), // علامات للبحث والتصنيف
});

// جدول ربط المستندات بالعمليات المالية
export const documentTransactionLinks = pgTable("document_transaction_links", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull().references(() => documents.id),
  transactionId: integer("transaction_id").notNull().references(() => transactions.id),
  linkType: text("link_type").notNull().default("receipt"), // receipt, contract, invoice, etc.
  linkedBy: integer("linked_by").notNull().references(() => users.id),
  linkedAt: timestamp("linked_at").notNull().defaultNow(),
  notes: text("notes"), // ملاحظات إضافية عن الربط
}, (table) => {
  return {
    documentTransactionUnique: unique().on(table.documentId, table.transactionId),
  };
});

// Activity Logs table
export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(), // create, update, delete
  entityType: text("entity_type").notNull(), // transaction, project, user, document
  entityId: integer("entity_id").notNull(),
  details: text("details").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  userId: integer("user_id").notNull().references(() => users.id),
});

// Settings table
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
});

// Transaction Edit Permissions table - إدارة صلاحيات تعديل المعاملات المؤقتة
export const transactionEditPermissions = pgTable("transaction_edit_permissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id), // للمستخدم المحدد
  projectId: integer("project_id").references(() => projects.id), // أو للمشروع المحدد
  grantedBy: integer("granted_by").notNull().references(() => users.id), // من منح الصلاحية
  grantedAt: timestamp("granted_at").notNull().defaultNow(), // وقت منح الصلاحية
  expiresAt: timestamp("expires_at").notNull(), // انتهاء الصلاحية (42 ساعة)
  isActive: boolean("is_active").notNull().default(true), // نشط أم لا
  revokedBy: integer("revoked_by").references(() => users.id), // من ألغى الصلاحية
  revokedAt: timestamp("revoked_at"), // وقت إلغاء الصلاحية
  reason: text("reason"), // سبب منح الصلاحية
  notes: text("notes"), // ملاحظات إضافية
}, (table) => {
  return {
    // التأكد من عدم تكرار الصلاحية للمستخدم أو المشروع النشط
    userEditPermissionUnique: unique().on(table.userId, table.isActive),
    projectEditPermissionUnique: unique().on(table.projectId, table.isActive),
  };
});

// جدول أنواع المصروفات لدفتر الأستاذ
export const expenseTypes = pgTable("expense_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  projectId: integer("project_id").references(() => projects.id), // ربط نوع المصروف بالمشروع
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => {
  return {
    // التأكد من عدم تكرار اسم نوع المصروف في نفس المشروع
    nameProjectUnique: unique().on(table.name, table.projectId),
  };
});

// دفتر الأستاذ - المصروفات المصنفة حسب النوع
export const ledgerEntries = pgTable("ledger_entries", {
  id: serial("id").primaryKey(),
  date: timestamp("date").notNull(),
  transactionId: integer("transaction_id").references(() => transactions.id),
  expenseTypeId: integer("expense_type_id").references(() => expenseTypes.id),
  accountName: text("account_name"), // اسم الحساب للربط مع المستحقات
  amount: integer("amount").notNull(),
  debitAmount: integer("debit_amount").default(0), // المبلغ المدين
  creditAmount: integer("credit_amount").default(0), // المبلغ الدائن
  description: text("description").notNull(),
  projectId: integer("project_id").references(() => projects.id),
  entryType: text("entry_type").notNull(), // "classified" أو "miscellaneous" أو "deferred"
  entryDate: timestamp("entry_date").defaultNow(), // تاريخ الإدخال
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// نوع الصندوق: صندوق المدير أو صندوق مشروع
export const fundTypeEnum = pgEnum('fund_type', ['admin', 'project']);

// Funds table - لإدارة الصناديق والأرصدة
export const funds = pgTable("funds", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  balance: integer("balance").notNull().default(0),
  type: fundTypeEnum("type").notNull(),
  ownerId: integer("owner_id").references(() => users.id), // لصندوق المدير
  projectId: integer("project_id").references(() => projects.id), // لصندوق المشروع
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Employees table - جدول الموظفين منفصل عن المستخدمين
export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  salary: integer("salary").notNull().default(0), // الراتب الشهري الأساسي
  currentBalance: integer("current_balance").notNull().default(0), // الرصيد المتبقي من الراتب
  totalPaid: integer("total_paid").notNull().default(0), // إجمالي المدفوع هذا الشهر
  lastSalaryReset: timestamp("last_salary_reset").defaultNow(), // آخر إعادة تعيين للراتب
  assignedProjectId: integer("assigned_project_id").references(() => projects.id),
  active: boolean("active").notNull().default(true),
  hireDate: timestamp("hire_date").notNull().defaultNow(),
  notes: text("notes"), // ملاحظات إضافية
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Account Categories table - تصنيفات أنواع الحسابات المخصصة
export const accountCategories = pgTable("account_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  active: boolean("active").notNull().default(true),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Insertion schemas
export const insertUserSchema = createInsertSchema(users)
  .omit({ id: true })
  .extend({
    password: z.string().min(6, "كلمة المرور يجب أن تحتوي على الأقل 6 أحرف"),
    email: z.string().email("البريد الإلكتروني غير صالح").optional().or(z.literal("")),
    projectId: z.number().optional(), // إضافة حقل projectId كخاصية إضافية لا تتطابق مع الجدول
    permissions: z.array(z.string()).optional(), // صلاحيات المستخدم
  });

export const insertProjectSchema = createInsertSchema(projects)
  .omit({ id: true, progress: true })
  .extend({
    startDate: z.coerce.date(), // تحويل التاريخ تلقائياً من السلسلة النصية
    budget: z.number().optional().default(0), // ميزانية اختيارية
    spent: z.number().optional().default(0), // المبلغ المُنفق اختياري
    createdBy: z.number().optional(), // سيتم تعيينه في الخلفية
  });

export const insertTransactionSchema = createInsertSchema(transactions)
  .omit({ id: true })
  .extend({
    date: z.coerce.date(), // تحويل التاريخ تلقائياً من السلسلة النصية
    createdBy: z.number().optional(), // سيتم تعيينه في الخلفية
  });

export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true })
  .extend({
    isManagerDocument: z.boolean().optional().default(false),
  });

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({ id: true, timestamp: true });

export const insertSettingSchema = createInsertSchema(settings).omit({ id: true });

export const insertUserProjectSchema = createInsertSchema(userProjects).omit({ id: true, assignedAt: true });

export const insertEmployeeSchema = createInsertSchema(employees)
  .omit({ id: true, createdBy: true, createdAt: true, updatedAt: true })
  .extend({
    hireDate: z.coerce.date().optional(),
  });

export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;

export const insertFundSchema = createInsertSchema(funds)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    type: z.enum(['admin', 'project']),
  });

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

export const insertDocumentTransactionLinkSchema = createInsertSchema(documentTransactionLinks)
  .omit({ id: true, linkedAt: true });

export type InsertDocumentTransactionLink = z.infer<typeof insertDocumentTransactionLinkSchema>;
export type DocumentTransactionLink = typeof documentTransactionLinks.$inferSelect;

export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;

export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type Setting = typeof settings.$inferSelect;

// Transaction Edit Permission types
export const insertTransactionEditPermissionSchema = createInsertSchema(transactionEditPermissions).omit({
  id: true,
  grantedAt: true,
});
export type InsertTransactionEditPermission = z.infer<typeof insertTransactionEditPermissionSchema>;
export type TransactionEditPermission = typeof transactionEditPermissions.$inferSelect;

export type InsertUserProject = z.infer<typeof insertUserProjectSchema>;
export type UserProject = typeof userProjects.$inferSelect;

export type InsertFund = z.infer<typeof insertFundSchema>;
export type Fund = typeof funds.$inferSelect;

export const insertExpenseTypeSchema = createInsertSchema(expenseTypes)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    projectId: z.number().optional(), // معرف المشروع اختياري
  });

export const insertLedgerEntrySchema = createInsertSchema(ledgerEntries)
  .omit({ id: true, createdAt: true })
  .extend({
    transactionId: z.number().nullable().optional(),
    accountName: z.string().optional(), // اسم الحساب اختياري
    debitAmount: z.number().optional().default(0), // المبلغ المدين
    creditAmount: z.number().optional().default(0), // المبلغ الدائن
    entryDate: z.union([z.string(), z.date()]).optional(), // تاريخ الإدخال
  });

export const insertAccountCategorySchema = createInsertSchema(accountCategories)
  .omit({ id: true, createdAt: true, updatedAt: true });

export type InsertExpenseType = z.infer<typeof insertExpenseTypeSchema>;
export type ExpenseType = typeof expenseTypes.$inferSelect;

export type InsertLedgerEntry = z.infer<typeof insertLedgerEntrySchema>;
export type LedgerEntry = typeof ledgerEntries.$inferSelect;

export type InsertAccountCategory = z.infer<typeof insertAccountCategorySchema>;
export type AccountCategory = typeof accountCategories.$inferSelect;

// Deferred Payments table - الدفعات المؤجلة
export const deferredPayments = pgTable("deferred_payments", {
  id: serial("id").primaryKey(),
  beneficiaryName: text("beneficiary_name").notNull(), // اسم المستفيد
  totalAmount: integer("total_amount").notNull(), // المبلغ الإجمالي
  paidAmount: integer("paid_amount").notNull().default(0), // المبلغ المدفوع
  remainingAmount: integer("remaining_amount").notNull(), // المبلغ المتبقي
  projectId: integer("project_id").references(() => projects.id),
  userId: integer("user_id").references(() => users.id).notNull(), // من أنشأ الدفعة
  status: text("status").notNull().default("pending"), // pending, completed
  description: text("description"), // وصف إضافي
  dueDate: timestamp("due_date"), // تاريخ الاستحقاق
  installments: integer("installments").notNull().default(1), // عدد الأقساط
  paymentFrequency: text("payment_frequency").notNull().default("monthly"), // monthly, quarterly, yearly
  notes: text("notes"), // ملاحظات إضافية
  completedAt: timestamp("completed_at"), // تاريخ الإكمال
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDeferredPaymentSchema = createInsertSchema(deferredPayments)
  .omit({ id: true, paidAmount: true, status: true, completedAt: true, createdAt: true, updatedAt: true })
  .extend({
    totalAmount: z.number().positive("المبلغ يجب أن يكون أكبر من صفر"),
    beneficiaryName: z.string().min(1, "اسم المستفيد مطلوب"),
    remainingAmount: z.number().optional(),
    dueDate: z.union([z.string(), z.date()]).optional().nullable(),
  });

export type InsertDeferredPayment = z.infer<typeof insertDeferredPaymentSchema>;
export type DeferredPayment = typeof deferredPayments.$inferSelect;



// Permission types
export type Permission = keyof typeof PERMISSIONS;
export type Role = keyof typeof ROLES;

// Auth types
export const loginSchema = z.object({
  username: z.string().min(1, "اسم المستخدم مطلوب"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});

export type LoginCredentials = z.infer<typeof loginSchema>;

// Completed Works - Independent section for manager-only operations
export const completedWorks = pgTable("completed_works", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  amount: integer("amount"), // Optional amount, doesn't affect system balance
  date: timestamp("date").notNull(),
  category: text("category"), // Optional categorization
  status: text("status").notNull().default("active"), // active, archived
  fileUrl: text("file_url"), // Attached file if any
  fileType: text("file_type"), // File type if any
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Completed Works Documents - Independent document management
export const completedWorksDocuments = pgTable("completed_works_documents", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  fileUrl: text("file_url").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size"),
  category: text("category"), // Optional categorization
  tags: text("tags"), // Comma-separated tags for organization
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Completed Works schemas
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

export type InsertCompletedWork = z.infer<typeof insertCompletedWorkSchema>;
export type CompletedWork = typeof completedWorks.$inferSelect;

export type InsertCompletedWorksDocument = z.infer<typeof insertCompletedWorksDocumentSchema>;
export type CompletedWorksDocument = typeof completedWorksDocuments.$inferSelect;
