import { 
  users, type User, type InsertUser,
  projects, type Project, type InsertProject,
  transactions, type Transaction, type InsertTransaction,
  documents, type Document, type InsertDocument,
  activityLogs, type ActivityLog, type InsertActivityLog,
  settings, type Setting, type InsertSetting,
  userProjects, type UserProject, type InsertUserProject,
  funds, type Fund, type InsertFund,
  expenseTypes, type ExpenseType, type InsertExpenseType,
  ledgerEntries, type LedgerEntry, type InsertLedgerEntry,
  accountCategories, type AccountCategory, type InsertAccountCategory,
  deferredPayments, type DeferredPayment, type InsertDeferredPayment,
  employees, type Employee, type InsertEmployee,
  completedWorks, type CompletedWork, type InsertCompletedWork,
  completedWorksDocuments, type CompletedWorksDocument, type InsertCompletedWorksDocument,
  transactionEditPermissions, type TransactionEditPermission, type InsertTransactionEditPermission
} from "../shared/schema";
import bcrypt from "bcryptjs";
// import { PgStorage } from './pg-storage.js'; // تعطيل مؤقت لسلامة الإنتاج
import { SupabaseStorage } from './supabase-storage-class.js';

// Flexible input for granting transaction edit permissions from routes (expiresAt computed in DB)
export type GrantTransactionEditPermissionInput = {
  userId?: number | null;
  projectId?: number | null;
  grantedBy: number;
  reason?: string | null;
  notes?: string | null;
};

export interface IStorage {
  // Database health check
  checkTableExists(tableName: string): Promise<boolean>;
  
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<User>): Promise<User | undefined>;
  listUsers(): Promise<User[]>;
  deleteUser(id: number): Promise<boolean>;
  validatePassword(storedPassword: string, inputPassword: string): Promise<boolean>;

  // Projects
  getProject(id: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, project: Partial<Project>): Promise<Project | undefined>;
  listProjects(): Promise<Project[]>;
  deleteProject(id: number): Promise<boolean>;
  
  // User Projects (علاقات المستخدمين والمشاريع)
  assignUserToProject(userProject: InsertUserProject): Promise<UserProject>;
  removeUserFromProject(userId: number, projectId: number): Promise<boolean>;
  getUserProjects(userId: number): Promise<Project[]>;
  getProjectUsers(projectId: number): Promise<User[]>;
  checkUserProjectAccess(userId: number, projectId: number): Promise<boolean>;

  // Transactions
  getTransaction(id: number): Promise<Transaction | undefined>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: number, transaction: Partial<Transaction>): Promise<Transaction | undefined>;
  listTransactions(): Promise<Transaction[]>;
  getTransactionsByProject(projectId: number): Promise<Transaction[]>;
  // Get all transactions visible to a user across assigned projects (and admin-only ones if admin)
  getTransactionsForUserProjects(userId: number): Promise<Transaction[]>;
  // Check if a user can access a specific transaction
  canUserAccessTransaction(userId: number, transactionId: number): Promise<boolean>;
  deleteTransaction(id: number): Promise<boolean>;

  // Funds
  getFund(id: number): Promise<Fund | undefined>;
  getFundByOwner(ownerId: number): Promise<Fund | undefined>;
  getFundByProject(projectId: number): Promise<Fund | undefined>;
  createFund(fund: InsertFund): Promise<Fund>;
  updateFundBalance(id: number, amount: number): Promise<Fund | undefined>;
  listFunds(): Promise<Fund[]>;
  processDeposit(userId: number, projectId: number, amount: number, description: string): Promise<{ transaction: Transaction, adminFund?: Fund, projectFund?: Fund }>;
  processWithdrawal(userId: number, projectId: number, amount: number, description: string, expenseType?: string): Promise<{ transaction: Transaction, adminFund?: Fund, projectFund?: Fund }>;
  processAdminTransaction(userId: number, type: string, amount: number, description: string): Promise<{ transaction: Transaction, adminFund?: Fund }>;

  // Documents
  getDocument(id: number): Promise<Document | undefined>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: number, document: Partial<Document>): Promise<Document | undefined>;
  listDocuments(filters: {
    projectId?: number;
    isManagerDocument?: boolean;
    fileType?: string;
    searchQuery?: string;
    dateRange?: { from?: Date; to?: Date };
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ documents: Document[], total: number }>;
  getDocumentsByProject(projectId: number): Promise<Document[]>;
  deleteDocument(id: number): Promise<boolean>;

  // ActivityLogs
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  listActivityLogs(): Promise<ActivityLog[]>;
  getActivityLogsByUser(userId: number): Promise<ActivityLog[]>;
  getActivityLogsByEntity(entityType: string, entityId: number): Promise<ActivityLog[]>;

  // Settings
  getSetting(key: string): Promise<Setting | undefined>;
  updateSetting(key: string, value: string): Promise<Setting | undefined>;
  listSettings(): Promise<Setting[]>;

  // Expense Types
  getExpenseType(id: number): Promise<ExpenseType | undefined>;
  getExpenseTypeByName(name: string): Promise<ExpenseType | undefined>;
  createExpenseType(expenseType: InsertExpenseType): Promise<ExpenseType>;
  updateExpenseType(id: number, expenseType: Partial<ExpenseType>): Promise<ExpenseType | undefined>;
  // Optional filter by project
  listExpenseTypes(projectId?: number): Promise<ExpenseType[]>;
  // List expense types available for a user (based on project assignments)
  listExpenseTypesForUser(userId: number): Promise<ExpenseType[]>;
  deleteExpenseType(id: number): Promise<boolean>;

  // Ledger Entries
  createLedgerEntry(entry: InsertLedgerEntry): Promise<LedgerEntry>;
  updateLedgerEntry(id: number, entry: Partial<LedgerEntry>): Promise<LedgerEntry | undefined>;
  getLedgerEntriesByType(entryType: string): Promise<LedgerEntry[]>;
  getLedgerEntriesByProject(projectId: number): Promise<LedgerEntry[]>;
  getLedgerEntriesByExpenseType(expenseTypeId: number): Promise<LedgerEntry[]>;
  listLedgerEntries(): Promise<LedgerEntry[]>;
  
  // Classification
  classifyExpenseTransaction(transaction: Transaction, forceClassify?: boolean): Promise<void>;
  
  // Account Categories
  getAccountCategory(id: number): Promise<AccountCategory | undefined>;
  createAccountCategory(category: InsertAccountCategory): Promise<AccountCategory>;
  updateAccountCategory(id: number, category: Partial<AccountCategory>): Promise<AccountCategory | undefined>;
  listAccountCategories(): Promise<AccountCategory[]>;
  deleteAccountCategory(id: number): Promise<boolean>;

  // Deferred Payments
  getDeferredPayment(id: number): Promise<DeferredPayment | undefined>;
  createDeferredPayment(payment: InsertDeferredPayment): Promise<DeferredPayment>;
  updateDeferredPayment(id: number, payment: Partial<DeferredPayment>): Promise<DeferredPayment | undefined>;
  listDeferredPayments(): Promise<DeferredPayment[]>;
  deleteDeferredPayment(id: number): Promise<boolean>;
  getDeferredPaymentsForUserProjects(userId: number): Promise<DeferredPayment[]>;
  payDeferredPaymentInstallment(id: number, amount: number, userId: number): Promise<{ payment: DeferredPayment; transaction?: Transaction }>;

  // Employees
  getEmployee(id: number): Promise<Employee | undefined>;
  createEmployee(employee: InsertEmployee & { createdBy: number }): Promise<Employee>;
  updateEmployee(id: number, employee: Partial<InsertEmployee>): Promise<Employee>;
  getEmployees(): Promise<Employee[]>;
  deleteEmployee(id: number): Promise<boolean>;
  getEmployeesByProject(projectId: number): Promise<Employee[]>;
  getActiveEmployees(): Promise<Employee[]>;

  // Completed Works - Independent section
  createCompletedWork(work: InsertCompletedWork): Promise<CompletedWork>;
  listCompletedWorks(): Promise<CompletedWork[]>;
  getCompletedWork(id: number): Promise<CompletedWork | undefined>;
  updateCompletedWork(id: number, updates: Partial<CompletedWork>): Promise<CompletedWork | undefined>;
  deleteCompletedWork(id: number): Promise<boolean>;
  archiveCompletedWork(id: number): Promise<boolean>;

  // Completed Works Documents - Independent document management
  createCompletedWorksDocument(document: InsertCompletedWorksDocument): Promise<CompletedWorksDocument>;
  listCompletedWorksDocuments(): Promise<CompletedWorksDocument[]>;
  getCompletedWorksDocument(id: number): Promise<CompletedWorksDocument | undefined>;
  updateCompletedWorksDocument(id: number, updates: Partial<CompletedWorksDocument>): Promise<CompletedWorksDocument | undefined>;
  deleteCompletedWorksDocument(id: number): Promise<boolean>;

  // Transaction Edit Permissions
  grantTransactionEditPermission(permission: GrantTransactionEditPermissionInput): Promise<TransactionEditPermission>;
  revokeTransactionEditPermission(id: number, revokedBy: number): Promise<boolean>;
  checkTransactionEditPermission(userId: number, projectId?: number): Promise<TransactionEditPermission | undefined>;
  listActiveTransactionEditPermissions(): Promise<TransactionEditPermission[]>;
  expireTransactionEditPermissions(): Promise<number>;
  getTransactionEditPermissionsByUser(userId: number): Promise<TransactionEditPermission[]>;
  getTransactionEditPermissionsByProject(projectId: number): Promise<TransactionEditPermission[]>;
  
  // Transaction Edit Permissions - إدارة صلاحيات تعديل المعاملات
  grantTransactionEditPermission(permission: GrantTransactionEditPermissionInput): Promise<TransactionEditPermission>;
  revokeTransactionEditPermission(id: number, revokedBy: number): Promise<boolean>;
  checkTransactionEditPermission(userId: number, projectId?: number): Promise<TransactionEditPermission | undefined>;
  listActiveTransactionEditPermissions(): Promise<TransactionEditPermission[]>;
  expireTransactionEditPermissions(): Promise<number>; // عدد الصلاحيات المنتهية
  getTransactionEditPermissionsByUser(userId: number): Promise<TransactionEditPermission[]>;
  getTransactionEditPermissionsByProject(projectId: number): Promise<TransactionEditPermission[]>;
}

export class MemStorage implements IStorage {
  async checkTableExists(tableName: string): Promise<boolean> {
    // For memory storage, we'll assume tables always exist
    return true;
  }

  private usersData: Map<number, User>;
  private projectsData: Map<number, Project>;
  private transactionsData: Map<number, Transaction>;
  private documentsData: Map<number, Document>;
  private activityLogsData: Map<number, ActivityLog>;
  private settingsData: Map<number, Setting>;
  private userProjectsData: Map<number, UserProject>;
  private fundsData: Map<number, Fund>;
  private userIdCounter: number;
  private projectIdCounter: number;
  private transactionIdCounter: number;
  private documentIdCounter: number;
  private activityLogIdCounter: number;
  private settingIdCounter: number;
  private userProjectIdCounter: number;
  private fundIdCounter: number;
  private expenseTypesData: Map<number, ExpenseType>;
  private employeesData: Map<number, Employee>;
  private expenseTypeIdCounter: number;
  private employeeIdCounter: number;

  constructor() {
    this.usersData = new Map();
    this.projectsData = new Map();
    this.transactionsData = new Map();
    this.documentsData = new Map();
    this.activityLogsData = new Map();
    this.settingsData = new Map();
    this.userProjectsData = new Map();
    this.fundsData = new Map();
    this.expenseTypesData = new Map();
    this.employeesData = new Map();
    this.completedWorksData = new Map();
    this.completedWorksDocumentsData = new Map();
    this.userIdCounter = 1;
    this.projectIdCounter = 1;
    this.transactionIdCounter = 1;
    this.documentIdCounter = 1;
    this.activityLogIdCounter = 1;
    this.settingIdCounter = 1;
    this.userProjectIdCounter = 1;
    this.fundIdCounter = 1;
    this.expenseTypeIdCounter = 1;
    this.employeeIdCounter = 1;
    this.completedWorkIdCounter = 1;
    this.completedWorksDocumentIdCounter = 1;

    // Add default admin user
    this.createUser({
      username: "admin",
      password: bcrypt.hashSync("admin123", 10),
      name: "مدير النظام",
  email: "admin@admin.com",
      role: "admin"
    });

    // Add default settings
    this.settingsData.set(1, {
      id: this.settingIdCounter++,
      key: "companyName",
      value: "شركة تقنية للمقاولات",
      description: "اسم الشركة"
    });
    this.settingsData.set(2, {
      id: this.settingIdCounter++,
      key: "currency",
      value: "د.ع",
      description: "رمز العملة"
    });
    
    // إنشاء صندوق المدير الافتراضي
    this.createFund({
      name: "صندوق المدير الرئيسي",
      balance: 1000000, // رصيد افتراضي مليون وحدة
      type: "admin",
      ownerId: 1, // المدير الافتراضي
      projectId: null
    });
  }

  // Users
  async getUser(id: number): Promise<User | undefined> {
    return this.usersData.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.usersData.values()).find(
      (user) => user.username === username
    );
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.usersData.values()).find(
      (user) => user.email === email
    );
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const newUser: User = {
      // Required shape of User from shared/schema
      id,
      username: user.username,
      // Store hashed password as provided (caller should hash for MemStorage as in constructor)
      password: user.password,
      plainPassword: null,
      name: user.name,
      email: user.email ?? null,
      role: user.role || "user",
      permissions: (user as any).permissions ?? [],
      active: true,
    };
    this.usersData.set(id, newUser);
    return newUser;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const user = this.usersData.get(id);
    if (!user) return undefined;
    
    const updatedUser: User = { ...user, ...userData };
    this.usersData.set(id, updatedUser);
    return updatedUser;
  }

  async listUsers(): Promise<User[]> {
    return Array.from(this.usersData.values());
  }

  async deleteUser(id: number): Promise<boolean> {
    return this.usersData.delete(id);
  }

  async validatePassword(storedPassword: string, inputPassword: string): Promise<boolean> {
    try {
      console.log('Comparing passwords:', { inputPassword, storedHashLength: storedPassword?.length || 0 });
      if (!storedPassword) return false;
      return await bcrypt.compare(inputPassword, storedPassword);
    } catch (error) {
      console.error('Password validation error:', error);
      return false;
    }
  }

  // Projects
  async getProject(id: number): Promise<Project | undefined> {
    return this.projectsData.get(id);
  }

  async createProject(project: InsertProject): Promise<Project> {
    const id = this.projectIdCounter++;
    const newProject: Project = { 
      ...project, 
      id, 
      progress: 0,
      status: project.status || "active",
      createdBy: 1 // Default to admin user if not provided
    };
    this.projectsData.set(id, newProject);
    return newProject;
  }

  async updateProject(id: number, projectData: Partial<Project>): Promise<Project | undefined> {
    const project = this.projectsData.get(id);
    if (!project) return undefined;
    
    const updatedProject: Project = { ...project, ...projectData };
    this.projectsData.set(id, updatedProject);
    return updatedProject;
  }

  async listProjects(): Promise<Project[]> {
    return Array.from(this.projectsData.values());
  }

  async deleteProject(id: number): Promise<boolean> {
    try {
      // حذف جميع البيانات المرتبطة في الذاكرة فقط
      // حذف الصندوق المرتبط بالمشروع إن وجد بشرط أن يكون رصيده صفراً
      const fund = await this.getFundByProject(id);
      if (fund) {
        if (fund.balance !== 0) {
          throw new Error("لا يمكن حذف المشروع لأن الصندوق المرتبط به يحتوي على رصيد");
        }
        this.fundsData.delete(fund.id);
      }

      // حذف المستندات المرتبطة بالمشروع
      for (const [docId, doc] of Array.from(this.documentsData.entries())) {
        if (doc.projectId === id) this.documentsData.delete(docId);
      }

      // حذف علاقات المستخدمين بالمشروع
      for (const [linkId, link] of Array.from(this.userProjectsData.entries())) {
        if (link.projectId === id) this.userProjectsData.delete(linkId);
      }

      // حذف المشروع نفسه
      this.projectsData.delete(id);
      return true;
    } catch (error) {
      console.error("خطأ في حذف المشروع:", error);
      throw error;
    }
  }

  // User Projects
  async assignUserToProject(userProject: InsertUserProject): Promise<UserProject> {
    const id = this.userProjectIdCounter++;
    const now = new Date();
    const newUserProject: UserProject = {
      ...userProject,
      id,
      assignedAt: now
    };
    this.userProjectsData.set(id, newUserProject);
    return newUserProject;
  }

  async removeUserFromProject(userId: number, projectId: number): Promise<boolean> {
    const userProject = Array.from(this.userProjectsData.values()).find(
      up => up.userId === userId && up.projectId === projectId
    );
    
    if (!userProject) return false;
    return this.userProjectsData.delete(userProject.id);
  }

  async getUserProjects(userId: number): Promise<Project[]> {
    const userProjectIds = Array.from(this.userProjectsData.values())
      .filter(up => up.userId === userId)
      .map(up => up.projectId);
    
    return Array.from(this.projectsData.values())
      .filter(project => userProjectIds.includes(project.id));
  }

  async getProjectUsers(projectId: number): Promise<User[]> {
    const projectUserIds = Array.from(this.userProjectsData.values())
      .filter(up => up.projectId === projectId)
      .map(up => up.userId);
    
    return Array.from(this.usersData.values())
      .filter(user => projectUserIds.includes(user.id));
  }

  async checkUserProjectAccess(userId: number, projectId: number): Promise<boolean> {
    // المدير لديه صلاحية للوصول لجميع المشاريع
    const user = await this.getUser(userId);
    if (user?.role === "admin") return true;
    
    // التحقق من وجود علاقة بين المستخدم والمشروع
    const userProject = Array.from(this.userProjectsData.values()).find(
      up => up.userId === userId && up.projectId === projectId
    );
    
    return !!userProject;
  }

  // Transactions
  async getTransaction(id: number): Promise<Transaction | undefined> {
    return this.transactionsData.get(id);
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const id = this.transactionIdCounter++;
    const newTransaction: Transaction = {
      // Required Transaction shape from schema
      id,
      date: transaction.date,
      type: transaction.type,
      amount: transaction.amount,
      description: transaction.description,
      projectId: transaction.projectId ?? null,
      createdBy: (transaction as any).createdBy ?? 1,
      expenseType: (transaction as any).expenseType ?? null,
      employeeId: transaction.employeeId ?? null,
      fileUrl: transaction.fileUrl ?? null,
      fileType: transaction.fileType ?? null,
      archived: transaction.archived ?? false,
    };
    this.transactionsData.set(id, newTransaction);
    return newTransaction;
  }

  async updateTransaction(id: number, transactionData: Partial<Transaction>): Promise<Transaction | undefined> {
    const transaction = this.transactionsData.get(id);
    if (!transaction) return undefined;
    
    const updatedTransaction: Transaction = { ...transaction, ...transactionData };
    this.transactionsData.set(id, updatedTransaction);
    return updatedTransaction;
  }

  async listTransactions(): Promise<Transaction[]> {
    return Array.from(this.transactionsData.values());
  }

  async getTransactionsByProject(projectId: number): Promise<Transaction[]> {
    return Array.from(this.transactionsData.values()).filter(
      (transaction) => transaction.projectId === projectId
    );
  }

  async getTransactionsForUserProjects(userId: number): Promise<Transaction[]> {
    // Determine projects assigned to user
    const assignedProjectIds = new Set(
      Array.from(this.userProjectsData.values())
        .filter(up => up.userId === userId)
        .map(up => up.projectId)
    );
    // If user is admin, return all
    const user = await this.getUser(userId);
    const all = Array.from(this.transactionsData.values());
    if (user?.role === 'admin') return all;
    return all.filter(t => t.projectId != null && assignedProjectIds.has(t.projectId));
  }

  async canUserAccessTransaction(userId: number, transactionId: number): Promise<boolean> {
    const tx = await this.getTransaction(transactionId);
    if (!tx) return false;
    const user = await this.getUser(userId);
    if (user?.role === 'admin') return true;
    if (tx.projectId == null) return false;
    return this.checkUserProjectAccess(userId, tx.projectId);
  }

  async deleteTransaction(id: number): Promise<boolean> {
    return this.transactionsData.delete(id);
  }

  // Documents
  async getDocument(id: number): Promise<Document | undefined> {
    return this.documentsData.get(id);
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const id = this.documentIdCounter++;
    const newDocument: Document = {
      id,
      projectId: document.projectId ?? null,
      title: (document as any).title ?? (document as any).name ?? "",
      description: document.description || null,
      fileUrl: (document as any).fileUrl ?? null,
      fileType: (document as any).fileType ?? null,
      uploadedBy: (document as any).uploadedBy ?? 1,
      createdAt: (document as any).createdAt ?? new Date(),
      updatedAt: (document as any).updatedAt ?? new Date(),
      category: (document as any).category ?? null,
      tags: (document as any).tags ?? [],
    } as unknown as Document;
    this.documentsData.set(id, newDocument);
    return newDocument;
  }

  async updateDocument(id: number, documentData: Partial<Document>): Promise<Document | undefined> {
    const document = this.documentsData.get(id);
    if (!document) return undefined;
    
    const updatedDocument: Document = { ...document, ...documentData };
    this.documentsData.set(id, updatedDocument);
    return updatedDocument;
  }

  async listDocuments(filters: {
    projectId?: number;
    isManagerDocument?: boolean;
    fileType?: string;
    searchQuery?: string;
    dateRange?: { from?: Date; to?: Date };
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ documents: Document[], total: number }> {
    let results = Array.from(this.documentsData.values());

    // Apply filters
    if (filters.projectId != null) {
      results = results.filter(doc => doc.projectId === filters.projectId);
    }
    if (filters.isManagerDocument) {
      results = results.filter(doc => doc.uploadedBy === 1); // Assuming 1 is the admin user ID
    }
    if (filters.fileType) {
      results = results.filter(doc => doc.fileType === filters.fileType);
    }
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      results = results.filter(doc => 
        (doc.title && doc.title.toLowerCase().includes(query)) ||
        (doc.description && doc.description.toLowerCase().includes(query))
      );
    }
    if (filters.dateRange?.from) {
      results = results.filter(doc => new Date(doc.createdAt) >= new Date(filters.dateRange.from));
    }
    if (filters.dateRange?.to) {
      results = results.filter(doc => new Date(doc.createdAt) <= new Date(filters.dateRange.to));
    }

    // Sort results
    if (filters.sortBy) {
      results.sort((a, b) => {
        const aVal = a[filters.sortBy as keyof Document];
        const bVal = b[filters.sortBy as keyof Document];
        
        if (aVal < bVal) return filters.sortOrder === 'asc' ? -1 : 1;
        if (aVal > bVal) return filters.sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    // Pagination
    const total = results.length;
    if (filters.page != null && filters.pageSize != null) {
      const start = (filters.page - 1) * filters.pageSize;
      const end = start + filters.pageSize;
      results = results.slice(start, end);
    }

    return { documents: results, total };
  }

  async getDocumentsByProject(projectId: number): Promise<Document[]> {
    return Array.from(this.documentsData.values()).filter(
      (document) => document.projectId === projectId
    );
  }

  async deleteDocument(id: number): Promise<boolean> {
    return this.documentsData.delete(id);
  }

  // ActivityLogs
  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const id = this.activityLogIdCounter++;
    const newLog: ActivityLog = { 
      ...log, 
      id, 
      timestamp: new Date()
    };
    this.activityLogsData.set(id, newLog);
    return newLog;
  }

  async listActivityLogs(): Promise<ActivityLog[]> {
    return Array.from(this.activityLogsData.values());
  }

  async getActivityLogsByUser(userId: number): Promise<ActivityLog[]> {
    return Array.from(this.activityLogsData.values()).filter(
      (log) => log.userId === userId
    );
  }

  async getActivityLogsByEntity(entityType: string, entityId: number): Promise<ActivityLog[]> {
    return Array.from(this.activityLogsData.values()).filter(
      (log) => log.entityType === entityType && log.entityId === entityId
    );
  }

  // Settings
  async getSetting(key: string): Promise<Setting | undefined> {
    return Array.from(this.settingsData.values()).find(
      (setting) => setting.key === key
    );
  }

  async updateSetting(key: string, value: string): Promise<Setting | undefined> {
    const setting = Array.from(this.settingsData.values()).find(
      (s) => s.key === key
    );
    
    if (!setting) return undefined;
    
    const updatedSetting: Setting = { ...setting, value };
    this.settingsData.set(setting.id, updatedSetting);
    return updatedSetting;
  }

  async listSettings(): Promise<Setting[]> {
    return Array.from(this.settingsData.values());
  }

  // Funds
  async getFund(id: number): Promise<Fund | undefined> {
    return this.fundsData.get(id);
  }

  async getFundByOwner(ownerId: number): Promise<Fund | undefined> {
    return Array.from(this.fundsData.values()).find(
      (fund) => fund.type === 'admin' && fund.ownerId === ownerId
    );
  }

  async getFundByProject(projectId: number): Promise<Fund | undefined> {
    return Array.from(this.fundsData.values()).find(
      (fund) => fund.type === 'project' && fund.projectId === projectId
    );
  }

  async createFund(fund: InsertFund): Promise<Fund> {
    const id = this.fundIdCounter++;
    const now = new Date();
    const newFund: Fund = {
      id,
      name: fund.name,
      type: fund.type,
      projectId: fund.projectId ?? null,
      balance: (fund as any).balance ?? 0,
      ownerId: (fund as any).ownerId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.fundsData.set(id, newFund);
    return newFund;
  }

  async updateFundBalance(id: number, amount: number): Promise<Fund | undefined> {
    const fund = this.fundsData.get(id);
    if (!fund) return undefined;
    
    const updatedFund: Fund = { 
      ...fund, 
      balance: fund.balance + amount,
      updatedAt: new Date()
    };
    this.fundsData.set(id, updatedFund);
    return updatedFund;
  }

  async listFunds(): Promise<Fund[]> {
    return Array.from(this.fundsData.values());
  }

  // عملية الإيداع: يستقطع المبلغ من حساب المدير ويذهب إلى حساب المشروع
  async processDeposit(userId: number, projectId: number, amount: number, description: string): Promise<{ transaction: Transaction, adminFund?: Fund, projectFund?: Fund }> {
    // التحقق من صلاحية المشروع
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error("المشروع غير موجود");
    }

    // التحقق من صلاحية المستخدم للوصول للمشروع
    const hasAccess = await this.checkUserProjectAccess(userId, projectId);
    if (!hasAccess) {
      throw new Error("غير مصرح للمستخدم بالوصول لهذا المشروع");
    }

    // البحث عن صندوق المدير
    let adminFund = await this.getFundByOwner(1); // المدير الافتراضي
    if (!adminFund) {
      throw new Error("صندوق المدير غير موجود");
    }

    // التحقق من رصيد المدير
    if (adminFund.balance < amount) {
      throw new Error("رصيد المدير غير كافي لإجراء العملية");
    }

    // البحث عن صندوق المشروع أو إنشاء صندوق جديد
    let projectFund = await this.getFundByProject(projectId);
    if (!projectFund) {
      projectFund = await this.createFund({
        name: `صندوق المشروع: ${project.name}`,
        balance: 0,
        type: "project",
        ownerId: null,
        projectId
      });
    }

    // خصم المبلغ من صندوق المدير
    adminFund = await this.updateFundBalance(adminFund.id, -amount);

    // إضافة المبلغ إلى صندوق المشروع
    projectFund = await this.updateFundBalance(projectFund.id, amount);

    // إنشاء معاملة جديدة
    const transaction = await this.createTransaction({
      date: new Date(),
      amount,
      type: "income",
      description: description || `إيداع مبلغ في المشروع: ${project.name}`,
      projectId,
      createdBy: userId
    });

    // إنشاء سجل نشاط
    await this.createActivityLog({
      action: "create",
      entityType: "transaction",
      entityId: transaction.id,
      details: `إيداع مبلغ ${amount} في المشروع: ${project.name}`,
      userId
    });

    return {
      transaction,
      adminFund,
      projectFund
    };
  }

  // عملية السحب: يستقطع المبلغ من حساب المشروع
  async processWithdrawal(userId: number, projectId: number, amount: number, description: string, expenseType?: string): Promise<{ transaction: Transaction, adminFund?: Fund, projectFund?: Fund }> {
    // التحقق من صلاحية المشروع
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error("المشروع غير موجود");
    }

    // التحقق من صلاحية المستخدم للوصول للمشروع
    const hasAccess = await this.checkUserProjectAccess(userId, projectId);
    if (!hasAccess) {
      throw new Error("غير مصرح للمستخدم بالوصول لهذا المشروع");
    }

    // البحث عن صندوق المشروع
    const projectFund = await this.getFundByProject(projectId);
    if (!projectFund) {
      throw new Error("صندوق المشروع غير موجود");
    }

    // التحقق من رصيد المشروع
    if (projectFund.balance < amount) {
      throw new Error("رصيد المشروع غير كافي لإجراء العملية");
    }

    // خصم المبلغ من صندوق المشروع
    const updatedProjectFund = await this.updateFundBalance(projectFund.id, -amount);

    // إنشاء معاملة جديدة
    const transaction = await this.createTransaction({
      date: new Date(),
      amount,
      type: "expense",
      expenseType: expenseType || "مصروف عام",
      description: description || `صرف مبلغ من المشروع: ${project.name}`,
      projectId,
      createdBy: userId,
      fileUrl: null,
      fileType: null
    });

    // إنشاء سجل نشاط
    await this.createActivityLog({
      action: "create",
      entityType: "transaction",
      entityId: transaction.id,
      details: `صرف مبلغ ${amount} من المشروع: ${project.name}`,
      userId
    });

    return {
      transaction,
      projectFund: updatedProjectFund
    };
  }

  // عملية المدير: إيراد يضاف للصندوق، صرف يخصم من الصندوق
  async processAdminTransaction(userId: number, type: string, amount: number, description: string): Promise<{ transaction: Transaction, adminFund?: Fund }> {
    // التحقق من أن المستخدم مدير
    const user = await this.getUser(userId);
    if (!user || user.role !== "admin") {
      throw new Error("هذه العملية متاحة للمدير فقط");
    }

    // البحث عن صندوق المدير
    let adminFund = await this.getFundByOwner(userId);
    if (!adminFund) {
      // إنشاء صندوق افتراضي للمدير إذا لم يكن موجودا
      adminFund = await this.createFund({
        name: `صندوق المدير: ${user.name}`,
        balance: type === "income" ? amount : 0, // إذا كانت العملية إيداع، ابدأ برصيد العملية
        type: "admin",
        ownerId: userId,
        projectId: null
      });
    } else {
      // التحقق من الرصيد في حالة الصرف
      if (type === "expense" && adminFund.balance < amount) {
        throw new Error("رصيد الصندوق غير كافي لإجراء العملية");
      }

      // تحديث رصيد صندوق المدير
      const updateAmount = type === "income" ? amount : -amount;
      adminFund = await this.updateFundBalance(adminFund.id, updateAmount);
    }

    // إنشاء معاملة جديدة
    const transaction = await this.createTransaction({
      date: new Date(),
      amount,
      type,
      description: description || `${type === "income" ? "إيراد" : "مصروف"} للمدير`,
      projectId: null, // لا يرتبط بمشروع
      createdBy: userId
    });

    // إنشاء سجل نشاط
    await this.createActivityLog({
      action: "create",
      entityType: "transaction",
      entityId: transaction.id,
      details: `${type === "income" ? "إيراد" : "مصروف"} للمدير: ${amount}`,
      userId
    });

    return {
      transaction,
      adminFund
    };
  }

  // دالة التصنيف للـ MemStorage (دالة فارغة لأن MemStorage لا يدعم دفتر الأستاذ)
  async classifyExpenseTransaction(transaction: Transaction, forceClassify: boolean = false): Promise<void> {
    // MemStorage لا يدعم دفتر الأستاذ، لذا هذه الدالة فارغة
    console.log(`MemStorage: تم تجاهل تصنيف المعاملة ${transaction.id} - غير مدعوم في MemStorage`);
  }

  // دعم دفتر الأستاذ الأساسي للـ MemStorage
  async createLedgerEntry(entry: any): Promise<any> {
    throw new Error("MemStorage لا يدعم دفتر الأستاذ");
  }

  async updateLedgerEntry(id: number, entry: any): Promise<any> {
    throw new Error("MemStorage لا يدعم تحديث دفتر الأستاذ");
  }

  async getLedgerEntriesByType(entryType: string): Promise<any[]> {
    return [];
  }

  async getLedgerEntriesByProject(projectId: number): Promise<any[]> {
    return [];
  }

  async getLedgerEntriesByExpenseType(expenseTypeId: number): Promise<any[]> {
    return [];
  }

  async listLedgerEntries(): Promise<any[]> {
    return [];
  }

  // دعم أنواع المصروفات الأساسي للـ MemStorage
  async getExpenseType(id: number): Promise<ExpenseType | undefined> {
    return this.expenseTypesData.get(id);
  }

  async getExpenseTypeByName(name: string): Promise<ExpenseType | undefined> {
    return Array.from(this.expenseTypesData.values()).find(
      (type) => type.name === name
    );
  }

  async createExpenseType(expenseType: InsertExpenseType): Promise<ExpenseType> {
    const id = this.expenseTypeIdCounter++;
    const newExpenseType: ExpenseType = {
      id,
      name: expenseType.name,
      description: expenseType.description || null,
      projectId: expenseType.projectId || null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.expenseTypesData.set(id, newExpenseType);
    return newExpenseType;
  }

  async updateExpenseType(id: number, expenseType: Partial<ExpenseType>): Promise<ExpenseType | undefined> {
    const existing = this.expenseTypesData.get(id);
    if (!existing) return undefined;
    
    const updated: ExpenseType = { 
      ...existing, 
      ...expenseType, 
      updatedAt: new Date() 
    };
    this.expenseTypesData.set(id, updated);
    return updated;
  }

  async listExpenseTypes(projectId?: number): Promise<ExpenseType[]> {
    const all = Array.from(this.expenseTypesData.values());
    if (projectId) {
      return all.filter(type => type.projectId === projectId);
    }
    return all;
  }

  async listExpenseTypesForUser(userId: number): Promise<ExpenseType[]> {
    const user = await this.getUser(userId);
    if (user?.role === 'admin') {
      return this.listExpenseTypes();
    }
    
    // Get user's project IDs
    const userProjectIds = Array.from(this.userProjectsData.values())
      .filter(up => up.userId === userId)
      .map(up => up.projectId);
    
    return Array.from(this.expenseTypesData.values()).filter(type => 
      type.projectId === null || userProjectIds.includes(type.projectId!)
    );
  }

  async deleteExpenseType(id: number): Promise<boolean> {
    return this.expenseTypesData.delete(id);
  }

  // دعم تصنيفات أنواع الحسابات الأساسي للـ MemStorage
  async getAccountCategory(id: number): Promise<any> {
    return undefined;
  }

  async createAccountCategory(category: any): Promise<any> {
    throw new Error("MemStorage لا يدعم تصنيفات أنواع الحسابات");
  }

  async updateAccountCategory(id: number, categoryData: any): Promise<any> {
    return undefined;
  }

  async listAccountCategories(): Promise<any[]> {
    return [];
  }

  async deleteAccountCategory(id: number): Promise<boolean> {
    return false;
  }

  // Deferred Payments implementation for MemStorage
  async getDeferredPayment(id: number): Promise<DeferredPayment | undefined> {
    return undefined;
  }

  async createDeferredPayment(payment: InsertDeferredPayment): Promise<DeferredPayment> {
    throw new Error("MemStorage لا يدعم الدفعات المؤجلة");
  }

  async updateDeferredPayment(id: number, payment: Partial<DeferredPayment>): Promise<DeferredPayment | undefined> {
    return undefined;
  }

  async listDeferredPayments(): Promise<DeferredPayment[]> {
    return [];
  }
  
  async getDeferredPaymentsForUserProjects(userId: number): Promise<DeferredPayment[]> {
    return [];
  }

  async deleteDeferredPayment(id: number): Promise<boolean> {
    return false;
  }

  async payDeferredPaymentInstallment(id: number, amount: number, userId: number): Promise<{ payment: DeferredPayment; transaction?: Transaction }> {
    throw new Error("MemStorage لا يدعم دفع أقساط الدفعات المؤجلة");
  }

  // Employees implementation for MemStorage
  async getEmployee(id: number): Promise<Employee | undefined> {
    return this.employeesData.get(id);
  }

  async createEmployee(employee: InsertEmployee & { createdBy: number }): Promise<Employee> {
    const id = this.employeeIdCounter++;
    const newEmployee: Employee = {
      id,
      name: employee.name,
      salary: employee.salary || 0,
      hireDate: employee.hireDate || new Date(),
      active: employee.active !== false,
      assignedProjectId: employee.assignedProjectId || null,
      notes: employee.notes || null,
      createdBy: employee.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
      currentBalance: 0,
      totalPaid: 0,
      lastSalaryReset: null,
    };
    this.employeesData.set(id, newEmployee);
    return newEmployee;
  }

  async updateEmployee(id: number, employee: Partial<InsertEmployee>): Promise<Employee> {
    const existing = this.employeesData.get(id);
    if (!existing) {
      throw new Error("الموظف غير موجود");
    }
    
    const updated: Employee = { 
      ...existing, 
      ...employee, 
      updatedAt: new Date() 
    };
    this.employeesData.set(id, updated);
    return updated;
  }

  async getEmployees(): Promise<Employee[]> {
    return Array.from(this.employeesData.values());
  }

  async deleteEmployee(id: number): Promise<boolean> {
    return this.employeesData.delete(id);
  }

  async getEmployeesByProject(projectId: number): Promise<Employee[]> {
    return Array.from(this.employeesData.values()).filter(
      emp => emp.assignedProjectId === projectId
    );
  }

  async getActiveEmployees(): Promise<Employee[]> {
    return Array.from(this.employeesData.values()).filter(
      emp => emp.active
    );
  }

  // Completed Works - Independent section (MemStorage implementations)
  async createCompletedWork(work: InsertCompletedWork): Promise<CompletedWork> {
    const id = this.completedWorkIdCounter++;
    const now = new Date();
    const newWork: CompletedWork = {
      id,
      title: work.title,
      description: work.description || null,
      amount: work.amount || null,
      date: work.date,
      category: work.category || null,
      status: work.status || 'active',
      fileUrl: work.fileUrl || null,
      fileType: work.fileType || null,
      createdBy: work.createdBy,
      createdAt: now,
      updatedAt: now,
    };
    this.completedWorksData.set(id, newWork);
    return newWork;
  }

  async listCompletedWorks(): Promise<CompletedWork[]> {
    return Array.from(this.completedWorksData.values());
  }

  async getCompletedWork(id: number): Promise<CompletedWork | undefined> {
    return this.completedWorksData.get(id);
  }

  async updateCompletedWork(id: number, updates: Partial<CompletedWork>): Promise<CompletedWork | undefined> {
    const work = this.completedWorksData.get(id);
    if (!work) return undefined;
    
    const updatedWork: CompletedWork = { 
      ...work, 
      ...updates, 
      updatedAt: new Date()
    };
    this.completedWorksData.set(id, updatedWork);
    return updatedWork;
  }

  async deleteCompletedWork(id: number): Promise<boolean> {
    // Also delete associated documents
    const documents = Array.from(this.completedWorksDocumentsData.values())
      .filter(doc => doc.completedWorkId === id);
    documents.forEach(doc => this.completedWorksDocumentsData.delete(doc.id));
    
    return this.completedWorksData.delete(id);
  }

  async archiveCompletedWork(id: number): Promise<boolean> {
    const work = this.completedWorksData.get(id);
    if (!work) return false;
    
    work.status = 'archived';
    work.updatedAt = new Date();
    return true;
  }

  private completedWorksData: Map<number, CompletedWork>;
  private completedWorksDocumentsData: Map<number, CompletedWorksDocument>;
  private completedWorkIdCounter: number;
  private completedWorksDocumentIdCounter: number;

  // Completed Works Documents - Independent document management (MemStorage implementations)
  async createCompletedWorksDocument(document: InsertCompletedWorksDocument): Promise<CompletedWorksDocument> {
    const id = this.completedWorksDocumentIdCounter++;
    const now = new Date();
    const newDocument: CompletedWorksDocument = {
      id,
      title: document.title,
      description: document.description || null,
      fileUrl: document.fileUrl,
      fileType: document.fileType,
      category: document.category || null,
      tags: document.tags || null,
      uploadDate: now,
      completedWorkId: document.completedWorkId || null,
      uploadedBy: document.uploadedBy,
      createdAt: now,
      updatedAt: now,
    };
    this.completedWorksDocumentsData.set(id, newDocument);
    return newDocument;
  }

  async listCompletedWorksDocuments(): Promise<CompletedWorksDocument[]> {
    return Array.from(this.completedWorksDocumentsData.values());
  }

  async getCompletedWorksDocument(id: number): Promise<CompletedWorksDocument | undefined> {
    return this.completedWorksDocumentsData.get(id);
  }

  async updateCompletedWorksDocument(id: number, updates: Partial<CompletedWorksDocument>): Promise<CompletedWorksDocument | undefined> {
    const document = this.completedWorksDocumentsData.get(id);
    if (!document) return undefined;
    
    const updatedDocument: CompletedWorksDocument = { 
      ...document, 
      ...updates, 
      updatedAt: new Date()
    };
    this.completedWorksDocumentsData.set(id, updatedDocument);
    return updatedDocument;
  }

  async deleteCompletedWorksDocument(id: number): Promise<boolean> {
    return this.completedWorksDocumentsData.delete(id);
  }

  // Transaction Edit Permissions - للذاكرة المؤقتة فقط
  async grantTransactionEditPermission(permission: GrantTransactionEditPermissionInput): Promise<TransactionEditPermission> {
    throw new Error("Transaction edit permissions not supported in memory storage");
  }

  async revokeTransactionEditPermission(id: number, revokedBy: number): Promise<boolean> {
    throw new Error("Transaction edit permissions not supported in memory storage");
  }

  async checkTransactionEditPermission(userId: number, projectId?: number): Promise<TransactionEditPermission | undefined> {
    return undefined; // لا توجد صلاحيات في الذاكرة المؤقتة
  }

  async listActiveTransactionEditPermissions(): Promise<TransactionEditPermission[]> {
    return []; // لا توجد صلاحيات في الذاكرة المؤقتة
  }

  async expireTransactionEditPermissions(): Promise<number> {
    return 0; // لا توجد صلاحيات لإنهائها في الذاكرة المؤقتة
  }

  async getTransactionEditPermissionsByUser(userId: number): Promise<TransactionEditPermission[]> {
    return []; // لا توجد صلاحيات في الذاكرة المؤقتة
  }

  async getTransactionEditPermissionsByProject(projectId: number): Promise<TransactionEditPermission[]> {
    return []; // لا توجد صلاحيات في الذاكرة المؤقتة
  }
}

// استيراد نظام التسجيل
import { logger } from '../shared/logger';

// تحديد فئة التخزين النشطة
// الترتيب: Supabase (إذا توفرت مفاتيحها) ثم PostgreSQL (إذا توفر DATABASE_URL) ثم ذاكرة مؤقتة

// Internal singleton instance (typed as any to allow different backends at runtime)
let _storage: any = null;
let _storageType: string | null = null;

function createStorage(): IStorage {
  if (_storage) {
    logger.log(`📌 Reusing existing storage type: ${_storageType}`);
    return _storage;
  }

  const hasSupabaseEnv = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const hasDatabaseUrl = !!process.env.DATABASE_URL && !!process.env.DATABASE_URL.trim();
  const preferDirectDb = (process.env.USE_DIRECT_DB || '').toLowerCase() === 'true';

  logger.log(`🔍 Storage initialization check:
    - SUPABASE_URL: ${hasSupabaseEnv ? '✅ Present' : '❌ Missing'}
    - DATABASE_URL: ${hasDatabaseUrl ? '✅ Present' : '❌ Missing'}  
    - USE_DIRECT_DB: ${preferDirectDb}`);

  // 1) Supabase (PostgREST) storage - الأولوية الأولى
  if (hasSupabaseEnv) {
    try {
      logger.log('🚀 Supabase environment variables found. Initializing SupabaseStorage...');
      _storage = new SupabaseStorage();
      _storageType = 'Supabase';
      logger.log('✅ Successfully initialized SupabaseStorage for data persistence');
      logger.log(`🎯 ACTIVE STORAGE TYPE: ${_storageType}`);
      return _storage as IStorage;
    } catch (error) {
      logger.error('❌ Failed to initialize SupabaseStorage, will try PgStorage next:', error);
    }
  } else {
    logger.warn('⚠️ Supabase environment variables not found (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
  }

  // 2) PostgreSQL DISABLED for production safety (تعطيل مؤقتاً لسلامة الإنتاج)
  // if (preferDirectDb && hasDatabaseUrl) {
  //   try {
  //     logger.log('USE_DIRECT_DB=true: Initializing PgStorage (direct DB)');
  //     _storage = new PgStorage();
  //     _storageType = 'PostgreSQL';
  //     return _storage as IStorage;
  //   } catch (error) {
  //     logger.error('❌ Failed to initialize PgStorage (direct). Falling back...', error);
  //   }
  // }

  // 3) PostgreSQL DISABLED for production safety (تعطيل مؤقتاً لسلامة الإنتاج)
  // if (hasDatabaseUrl) {
  //   try {
  //     logger.log('Attempting to initialize PgStorage with database connection...');
  //     _storage = new PgStorage();
  //     _storageType = 'PostgreSQL';
  //     logger.log('✅ Successfully initialized PgStorage with database connection');
  //     return _storage as IStorage;
  //   } catch (error) {
  //     logger.error('❌ Failed to initialize PgStorage, falling back to MemStorage:', error);
  //   }
  // } else {
  //   logger.warn('⚠️ DATABASE_URL not configured');
  // }

  // 4) Fallback to in-memory (non-persistent)
  const warningMsg = 'No persistent storage configured (missing SUPABASE_* or DATABASE_URL). Using MemStorage (ephemeral). Data will be lost on server restart.';
  logger.warn(`⚠️ ${warningMsg}`);
  _storage = new MemStorage();
  _storageType = 'Memory';
  logger.log(`🎯 ACTIVE STORAGE TYPE: ${_storageType} (FALLBACK)`);
  return _storage as IStorage;
}

export const storage: IStorage = new Proxy({} as IStorage, {
  get(target, prop) {
    try {
      const actualStorage = createStorage();
      const value = (actualStorage as any)[prop];
      
      // تسجيل الوصول إلى الطرق الرئيسية مع نوع التخزين
      if (typeof value === 'function' && [
        'createUser', 'createProject', 'createTransaction', 
        'updateUser', 'updateProject', 'updateTransaction',
        'listTransactions', 'getTransaction'
      ].includes(prop.toString())) {
        logger.log(`🔄 ${_storageType} Storage: Accessing method ${prop.toString()}`);
      }
      
      return typeof value === 'function' ? value.bind(actualStorage) : value;
    } catch (error) {
      logger.error(`❌ Error accessing storage property ${String(prop)}:`, error);
      throw new Error(`Storage operation failed for ${String(prop)}. Please check server logs for details.`);
    }
  },
});
