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
} from "@shared/schema";
import bcrypt from "bcryptjs";
import { pgStorage } from './pg-storage.js';

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
  listDocuments(): Promise<Document[]>;
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
  listExpenseTypes(): Promise<ExpenseType[]>;
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
  createEmployee(employee: InsertEmployee): Promise<Employee>;
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
  grantTransactionEditPermission(permission: InsertTransactionEditPermission): Promise<TransactionEditPermission>;
  revokeTransactionEditPermission(id: number, revokedBy: number): Promise<boolean>;
  checkTransactionEditPermission(userId: number, projectId?: number): Promise<TransactionEditPermission | undefined>;
  listActiveTransactionEditPermissions(): Promise<TransactionEditPermission[]>;
  expireTransactionEditPermissions(): Promise<number>;
  getTransactionEditPermissionsByUser(userId: number): Promise<TransactionEditPermission[]>;
  getTransactionEditPermissionsByProject(projectId: number): Promise<TransactionEditPermission[]>;
  
  // Transaction Edit Permissions - إدارة صلاحيات تعديل المعاملات
  grantTransactionEditPermission(permission: InsertTransactionEditPermission): Promise<TransactionEditPermission>;
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

  constructor() {
    this.usersData = new Map();
    this.projectsData = new Map();
    this.transactionsData = new Map();
    this.documentsData = new Map();
    this.activityLogsData = new Map();
    this.settingsData = new Map();
    this.userProjectsData = new Map();
    this.fundsData = new Map();
    this.userIdCounter = 1;
    this.projectIdCounter = 1;
    this.transactionIdCounter = 1;
    this.documentIdCounter = 1;
    this.activityLogIdCounter = 1;
    this.settingIdCounter = 1;
    this.userProjectIdCounter = 1;
    this.fundIdCounter = 1;

    // Add default admin user
    this.createUser({
      username: "admin",
      password: bcrypt.hashSync("admin123", 10),
      name: "مدير النظام",
      email: "admin@example.com",
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
      ...user, 
      id,
      role: user.role || "user",
      permissions: [],
      active: true
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
      // التحقق من وجود صندوق مرتبط بالمشروع وحذفه
      const projectFund = await this.getFundByProject(id);
      if (projectFund) {
        // حذف الصندوق إذا كان رصيده صفر
        if (projectFund.balance === 0) {
          await db.delete(funds).where(eq(funds.id, projectFund.id));
        } else {
          throw new Error("لا يمكن حذف المشروع لأن الصندوق المرتبط به يحتوي على رصيد");
        }
      }

      // حذف كل المستندات المرتبطة بالمشروع
      await db.delete(documents).where(eq(documents.projectId, id));
      
      // حذف علاقات المستخدمين بالمشروع
      await db.delete(userProjects).where(eq(userProjects.projectId, id));
      
      // حذف المشروع نفسه
      await db.delete(projects).where(eq(projects.id, id));
      
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
      ...transaction, 
      id,
      projectId: transaction.projectId || null,
      createdBy: 1 // Default to admin user if not provided
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
      ...document, 
      id,
      description: document.description || null,
      projectId: document.projectId || null
    };
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

  async listDocuments(): Promise<Document[]> {
    return Array.from(this.documentsData.values());
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
      ...fund, 
      id,
      createdAt: now,
      updatedAt: now
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
  async getExpenseType(id: number): Promise<any> {
    return undefined;
  }

  async getExpenseTypeByName(name: string): Promise<any> {
    return undefined;
  }

  async createExpenseType(expenseType: any): Promise<any> {
    throw new Error("MemStorage لا يدعم أنواع المصروفات");
  }

  async updateExpenseType(id: number, expenseType: any): Promise<any> {
    return undefined;
  }

  async listExpenseTypes(): Promise<any[]> {
    return [];
  }

  async deleteExpenseType(id: number): Promise<boolean> {
    return false;
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
    return undefined;
  }

  async createEmployee(employee: InsertEmployee): Promise<Employee> {
    throw new Error("MemStorage لا يدعم إدارة الموظفين");
  }

  async updateEmployee(id: number, employee: Partial<InsertEmployee>): Promise<Employee> {
    throw new Error("MemStorage لا يدعم تحديث الموظفين");
  }

  async getEmployees(): Promise<Employee[]> {
    return [];
  }

  async deleteEmployee(id: number): Promise<boolean> {
    return false;
  }

  async getEmployeesByProject(projectId: number): Promise<Employee[]> {
    return [];
  }

  async getActiveEmployees(): Promise<Employee[]> {
    return [];
  }

  // Completed Works - Independent section (MemStorage implementations)
  async createCompletedWork(work: InsertCompletedWork): Promise<CompletedWork> {
    throw new Error("MemStorage لا يدعم الأعمال المنجزة");
  }

  async listCompletedWorks(): Promise<CompletedWork[]> {
    return [];
  }

  async getCompletedWork(id: number): Promise<CompletedWork | undefined> {
    return undefined;
  }

  async updateCompletedWork(id: number, updates: Partial<CompletedWork>): Promise<CompletedWork | undefined> {
    return undefined;
  }

  async deleteCompletedWork(id: number): Promise<boolean> {
    return false;
  }

  async archiveCompletedWork(id: number): Promise<boolean> {
    return false;
  }

  // Completed Works Documents - Independent document management (MemStorage implementations)
  async createCompletedWorksDocument(document: InsertCompletedWorksDocument): Promise<CompletedWorksDocument> {
    throw new Error("MemStorage لا يدعم مستندات الأعمال المنجزة");
  }

  async listCompletedWorksDocuments(): Promise<CompletedWorksDocument[]> {
    return [];
  }

  async getCompletedWorksDocument(id: number): Promise<CompletedWorksDocument | undefined> {
    return undefined;
  }

  async updateCompletedWorksDocument(id: number, updates: Partial<CompletedWorksDocument>): Promise<CompletedWorksDocument | undefined> {
    return undefined;
  }

  async deleteCompletedWorksDocument(id: number): Promise<boolean> {
    return false;
  }

  // Transaction Edit Permissions - للذاكرة المؤقتة فقط
  async grantTransactionEditPermission(permission: InsertTransactionEditPermission): Promise<TransactionEditPermission> {
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

// تحديد فئة التخزين النشطة
// يمكن تغيير هذا لاستخدام MemStorage للتطوير المحلي أو PgStorage للإنتاج
export const storage: IStorage = pgStorage;
