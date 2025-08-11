import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
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
  completedWorksDocuments, type CompletedWorksDocument, type InsertCompletedWorksDocument
} from '../shared/schema';
import { IStorage } from './storage';

export class PgStorage implements IStorage {
  private sql = neon(process.env.DATABASE_URL!);
  private connectionRetries = 0;
  private maxRetries = 5;
  private retryDelay = 1000; // 1 second
  private isConnected = false;

  constructor() {
    this.initializeConnection();
    // Start periodic connection health check
    this.startHealthCheck();
  }

  private async initializeConnection() {
    try {
      // Test the connection
      await this.testConnection();
      this.isConnected = true;
      this.connectionRetries = 0;
      console.log('PgStorage: Successfully connected to PostgreSQL database');
    } catch (error) {
      console.error('PgStorage: Failed to connect to database:', error);
      await this.retryConnection();
    }
  }

  private async testConnection(): Promise<void> {
    await this.sql`SELECT 1`;
  }

  private async retryConnection(): Promise<void> {
    if (this.connectionRetries >= this.maxRetries) {
      console.error(`PgStorage: Max retries (${this.maxRetries}) reached. Connection failed.`);
      return;
    }

    this.connectionRetries++;
    console.log(`PgStorage: Retrying connection... Attempt ${this.connectionRetries}/${this.maxRetries}`);
    
    await new Promise(resolve => setTimeout(resolve, this.retryDelay * this.connectionRetries));
    
    try {
      await this.testConnection();
      this.isConnected = true;
      this.connectionRetries = 0;
      console.log('PgStorage: Reconnected to PostgreSQL database successfully');
    } catch (error) {
      console.error(`PgStorage: Retry ${this.connectionRetries} failed:`, error);
      await this.retryConnection();
    }
  }

  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    try {
      const result = await operation();
      // Reset connection status on successful operation
      if (!this.isConnected) {
        this.isConnected = true;
        this.connectionRetries = 0;
        console.log('PgStorage: Connection restored');
      }
      return result;
    } catch (error: any) {
      console.error('PgStorage: Database operation failed:', error);
      
      // Check if it's a connection error
      if (error.code === 'ECONNREFUSED' || 
          error.code === 'ENOTFOUND' || 
          error.code === 'ETIMEDOUT' ||
          error.message?.includes('connection') ||
          error.message?.includes('timeout') ||
          error.message?.includes('network')) {
        
        this.isConnected = false;
        console.log('PgStorage: Connection lost, attempting to reconnect...');
        await this.retryConnection();
        
        // Retry the operation if reconnected
        if (this.isConnected) {
          console.log('PgStorage: Retrying failed operation after reconnection');
          return await operation();
        }
      }
      
      throw error;
    }
  }

  // Add a public method to check connection status
  public getConnectionStatus(): { connected: boolean; retries: number } {
    return {
      connected: this.isConnected,
      retries: this.connectionRetries
    };
  }

  // Add a method to manually trigger reconnection
  public async reconnect(): Promise<boolean> {
    try {
      await this.testConnection();
      this.isConnected = true;
      this.connectionRetries = 0;
      console.log('PgStorage: Manual reconnection successful');
      return true;
    } catch (error) {
      console.error('PgStorage: Manual reconnection failed:', error);
      this.isConnected = false;
      return false;
    }
  }

  // Start periodic health check
  private startHealthCheck(): void {
    // Check connection every 30 seconds
    setInterval(async () => {
      try {
        await this.testConnection();
        if (!this.isConnected) {
          this.isConnected = true;
          this.connectionRetries = 0;
          console.log('PgStorage: Health check - connection restored');
        }
      } catch (error) {
        if (this.isConnected) {
          console.log('PgStorage: Health check - connection lost');
          this.isConnected = false;
          // Don't start full retry process in health check, just mark as disconnected
        }
      }
    }, 30000);
  }

  async checkTableExists(tableName: string): Promise<boolean> {
    return this.executeWithRetry(async () => {
      const result = await this.sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ${tableName}
        );
      `;
      return result[0]?.exists || false;
    });
  }

  // Users
  async getUser(id: number): Promise<User | undefined> {
    return this.executeWithRetry(async () => {
      const result = await this.sql`SELECT * FROM users WHERE id = ${id}`;
      return result[0] as User | undefined;
    });
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const result = await this.sql`SELECT * FROM users WHERE username = ${username}`;
      return result[0] as User | undefined;
    } catch (error) {
      console.error('Error getting user by username:', error);
      return undefined;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const result = await this.sql`SELECT * FROM users WHERE email = ${email}`;
      return result[0] as User | undefined;
    } catch (error) {
      console.error('Error getting user by email:', error);
      return undefined;
    }
  }

  async createUser(user: InsertUser): Promise<User> {
    try {
      const plainPassword = user.password;
      const hashedPassword = await bcrypt.hash(user.password, 12);
      
      const result = await this.sql`
        INSERT INTO users (username, password, plain_password, name, email, role, permissions, active)
        VALUES (${user.username}, ${hashedPassword}, ${plainPassword}, ${user.name}, ${user.email || null}, ${user.role || 'user'}, ${JSON.stringify(user.permissions || [])}, ${true})
        RETURNING *
      `;
      return result[0] as User;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async updateUser(id: number, user: Partial<User>): Promise<User | undefined> {
    try {
      const setParts = [];
      const values = [];
      
      if (user.username !== undefined) {
        setParts.push(`username = $${setParts.length + 1}`);
        values.push(user.username);
      }
      if (user.password !== undefined) {
        const hashedPassword = await bcrypt.hash(user.password, 12);
        setParts.push(`password = $${setParts.length + 1}`);
        values.push(hashedPassword);
        setParts.push(`plain_password = $${setParts.length + 1}`);
        values.push(user.password);
      }
      if (user.name !== undefined) {
        setParts.push(`name = $${setParts.length + 1}`);
        values.push(user.name);
      }
      if (user.email !== undefined) {
        setParts.push(`email = $${setParts.length + 1}`);
        values.push(user.email);
      }
      if (user.role !== undefined) {
        setParts.push(`role = $${setParts.length + 1}`);
        values.push(user.role);
      }
      if (user.permissions !== undefined) {
        setParts.push(`permissions = $${setParts.length + 1}`);
        values.push(JSON.stringify(user.permissions));
      }
      if (user.active !== undefined) {
        setParts.push(`active = $${setParts.length + 1}`);
        values.push(user.active);
      }

      if (setParts.length === 0) return this.getUser(id);

      const query = `UPDATE users SET ${setParts.join(', ')} WHERE id = $${setParts.length + 1} RETURNING *`;
      values.push(id);
      
      const result = await this.sql(query, values);
      return result[0] as User | undefined;
    } catch (error) {
      console.error('Error updating user:', error);
      return undefined;
    }
  }

  async listUsers(): Promise<User[]> {
    try {
      const result = await this.sql`SELECT *, plain_password FROM users ORDER BY id`;
      return result as User[];
    } catch (error) {
      console.error('Error listing users:', error);
      return [];
    }
  }

  async deleteUser(id: number): Promise<boolean> {
    try {
      console.log(`Starting delete process for user ${id}`);
      
      // التحقق من وجود المستخدم أولاً
      const existing = await this.sql`SELECT id FROM users WHERE id = ${id}`;
      if (existing.length === 0) {
        console.log(`User ${id} not found`);
        return false;
      }
      
      // حذف القيود المرتبطة أولاً بترتيب معين
      
      // حذف سجلات النشاط
      const activityLogsResult = await this.sql`DELETE FROM activity_logs WHERE user_id = ${id}`;
      console.log(`Deleted ${activityLogsResult.length} activity logs for user ${id}`);
      
      // حذف روابط المستندات والمعاملات
      const docLinksResult = await this.sql`DELETE FROM document_transaction_links WHERE linked_by = ${id}`;
      console.log(`Deleted ${docLinksResult.length} document links for user ${id}`);
      
      // حذف الأعمال المنجزة والمستندات المرتبطة
      const completedWorksDocsResult = await this.sql`DELETE FROM completed_works_documents WHERE created_by = ${id}`;
      console.log(`Deleted ${completedWorksDocsResult.length} completed work documents for user ${id}`);
      
      const completedWorksResult = await this.sql`DELETE FROM completed_works WHERE created_by = ${id}`;
      console.log(`Deleted ${completedWorksResult.length} completed works for user ${id}`);
      
      // حذف المدفوعات المؤجلة
      const deferredPaymentsResult = await this.sql`DELETE FROM deferred_payments WHERE user_id = ${id}`;
      console.log(`Deleted ${deferredPaymentsResult.length} deferred payments for user ${id}`);
      
      // حذف الأموال المملوكة
      const fundsResult = await this.sql`DELETE FROM funds WHERE owner_id = ${id}`;
      console.log(`Deleted ${fundsResult.length} funds for user ${id}`);
      
      // حذف ارتباطات المشاريع (assigned_by و user_id)
      const projectLinksAssignedResult = await this.sql`DELETE FROM user_projects WHERE assigned_by = ${id}`;
      console.log(`Deleted ${projectLinksAssignedResult.length} project assignments by user ${id}`);
      
      const projectLinksResult = await this.sql`DELETE FROM user_projects WHERE user_id = ${id}`;
      console.log(`Deleted ${projectLinksResult.length} project links for user ${id}`);
      
      // تحديث created_by إلى المدير بدلاً من حذف البيانات المهمة
      const updateTransactionsResult = await this.sql`UPDATE transactions SET created_by = 1 WHERE created_by = ${id}`;
      console.log(`Updated ${updateTransactionsResult.length} transactions creator to admin for user ${id}`);
      
      const updateProjectsResult = await this.sql`UPDATE projects SET created_by = 1 WHERE created_by = ${id}`;
      console.log(`Updated ${updateProjectsResult.length} projects creator to admin for user ${id}`);
      
      const updateDocumentsResult = await this.sql`UPDATE documents SET uploaded_by = 1 WHERE uploaded_by = ${id}`;
      console.log(`Updated ${updateDocumentsResult.length} documents uploader to admin for user ${id}`);
      
      const updateEmployeesResult = await this.sql`UPDATE employees SET created_by = 1 WHERE created_by = ${id}`;
      console.log(`Updated ${updateEmployeesResult.length} employees creator to admin for user ${id}`);
      
      const updateCategoriesResult = await this.sql`UPDATE account_categories SET created_by = 1 WHERE created_by = ${id}`;
      console.log(`Updated ${updateCategoriesResult.length} account categories creator to admin for user ${id}`);
      
      // حذف المستخدم نفسه
      const result = await this.sql`DELETE FROM users WHERE id = ${id} RETURNING id`;
      console.log(`Delete user result:`, result);
      
      const success = result.length > 0;
      console.log(`User ${id} deletion ${success ? 'successful' : 'failed'}`);
      return success;
    } catch (error) {
      console.error('Error deleting user:', error);
      return false;
    }
  }

  async validatePassword(storedPassword: string, inputPassword: string): Promise<boolean> {
    return bcrypt.compare(inputPassword, storedPassword);
  }

  // Projects
  async getProject(id: number): Promise<Project | undefined> {
    try {
      const result = await this.sql`SELECT * FROM projects WHERE id = ${id}`;
      return result[0] as Project | undefined;
    } catch (error) {
      console.error('Error getting project:', error);
      return undefined;
    }
  }

  async createProject(project: InsertProject): Promise<Project> {
    try {
      const result = await this.sql`
        INSERT INTO projects (name, description, start_date, status, progress, budget, spent, created_by)
        VALUES (
          ${project.name}, 
          ${project.description || null}, 
          ${project.startDate || new Date()}, 
          ${project.status || 'active'},
          ${0},
          ${project.budget || 0}, 
          ${project.spent || 0}, 
          ${project.createdBy}
        )
        RETURNING *
      `;
      return result[0] as Project;
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  }

  async updateProject(id: number, project: Partial<Project>): Promise<Project | undefined> {
    try {
      const setParts = [];
      const values = [];
      
      if (project.name !== undefined) {
        setParts.push(`name = $${setParts.length + 1}`);
        values.push(project.name);
      }
      if (project.description !== undefined) {
        setParts.push(`description = $${setParts.length + 1}`);
        values.push(project.description);
      }
      if (project.budget !== undefined) {
        setParts.push(`budget = $${setParts.length + 1}`);
        values.push(project.budget);
      }
      if (project.spent !== undefined) {
        setParts.push(`spent = $${setParts.length + 1}`);
        values.push(project.spent);
      }

      if (setParts.length === 0) return this.getProject(id);

      const query = `UPDATE projects SET ${setParts.join(', ')} WHERE id = $${setParts.length + 1} RETURNING *`;
      values.push(id);
      
      const result = await this.sql(query, values);
      return result[0] as Project | undefined;
    } catch (error) {
      console.error('Error updating project:', error);
      return undefined;
    }
  }

  async listProjects(): Promise<Project[]> {
    try {
      const result = await this.sql`SELECT * FROM projects ORDER BY id DESC`;
      return result as Project[];
    } catch (error) {
      console.error('Error listing projects:', error);
      return [];
    }
  }

  async deleteProject(id: number): Promise<boolean> {
    try {
      console.log(`Attempting to delete project with ID: ${id}`);
      const result = await this.sql`DELETE FROM projects WHERE id = ${id} RETURNING id`;
      console.log(`Delete project result:`, result);
      return result.length > 0;
    } catch (error) {
      console.error('Error deleting project:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      throw error; // إعادة رفع الخطأ بدلاً من إرجاع false
    }
  }

  // User Projects
  async assignUserToProject(userProject: InsertUserProject): Promise<UserProject> {
    try {
      const result = await this.sql`
        INSERT INTO user_projects (user_id, project_id, assigned_by)
        VALUES (${userProject.userId}, ${userProject.projectId}, ${userProject.assignedBy || 1})
        RETURNING *
      `;
      return result[0] as UserProject;
    } catch (error) {
      console.error('Error assigning user to project:', error);
      throw error;
    }
  }

  async removeUserFromProject(userId: number, projectId: number): Promise<boolean> {
    try {
      // أولاً، تحقق من وجود الربط
      const checkResult = await this.sql`
        SELECT id FROM user_projects WHERE user_id = ${userId} AND project_id = ${projectId}
      `;
      
      if (checkResult.length === 0) {
        return false; // الربط غير موجود
      }
      
      // إذا كان موجوداً، احذفه
      await this.sql`
        DELETE FROM user_projects WHERE user_id = ${userId} AND project_id = ${projectId}
      `;
      return true;
    } catch (error) {
      console.error('Error removing user from project:', error);
      return false;
    }
  }

  async getUserProjects(userId: number): Promise<Project[]> {
    try {
      const result = await this.sql`
        SELECT p.* FROM projects p
        JOIN user_projects up ON p.id = up.project_id
        WHERE up.user_id = ${userId}
        ORDER BY p.id DESC
      `;
      return result as Project[];
    } catch (error) {
      console.error('Error getting user projects:', error);
      return [];
    }
  }

  async getProjectUsers(projectId: number): Promise<User[]> {
    try {
      const result = await this.sql`
        SELECT u.* FROM users u
        JOIN user_projects up ON u.id = up.user_id
        WHERE up.project_id = ${projectId}
        ORDER BY u.id
      `;
      return result as User[];
    } catch (error) {
      console.error('Error getting project users:', error);
      return [];
    }
  }

  async checkUserProjectAccess(userId: number, projectId: number): Promise<boolean> {
    try {
      const result = await this.sql`
        SELECT 1 FROM user_projects WHERE user_id = ${userId} AND project_id = ${projectId}
      `;
      return result.length > 0;
    } catch (error) {
      console.error('Error checking user project access:', error);
      return false;
    }
  }

  // Transactions
  async getTransaction(id: number): Promise<Transaction | undefined> {
    try {
      const result = await this.sql`SELECT * FROM transactions WHERE id = ${id}`;
      return result[0] as Transaction | undefined;
    } catch (error) {
      console.error('Error getting transaction:', error);
      return undefined;
    }
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    try {
      const result = await this.sql`
        INSERT INTO transactions (date, type, project_id, description, created_by, amount, expense_type, employee_id, file_url, file_type, archived)
        VALUES (${transaction.date}, ${transaction.type}, ${transaction.projectId || null}, ${transaction.description}, ${transaction.createdBy}, ${transaction.amount}, ${transaction.expenseType || null}, ${transaction.employeeId || null}, ${transaction.fileUrl || null}, ${transaction.fileType || null}, ${transaction.archived || false})
        RETURNING *
      `;
      
      const rawTransaction = result[0];
      
      // تحويل أسماء الأعمدة من snake_case إلى camelCase
      const createdTransaction: Transaction = {
        id: rawTransaction.id,
        date: rawTransaction.date,
        type: rawTransaction.type,
        amount: rawTransaction.amount,
        description: rawTransaction.description,
        projectId: rawTransaction.project_id,
        createdBy: rawTransaction.created_by,
        expenseType: rawTransaction.expense_type,
        employeeId: rawTransaction.employee_id,
        fileUrl: rawTransaction.file_url,
        fileType: rawTransaction.file_type,
        archived: rawTransaction.archived
      };
      
      // التصنيف التلقائي للمصروفات في دفتر الأستاذ
      if (createdTransaction.type === 'expense' && createdTransaction.expenseType) {
        console.log(`Auto-classifying expense transaction: ${createdTransaction.id} - ${createdTransaction.expenseType}`);
        try {
          await this.classifyExpenseTransaction(createdTransaction);
        } catch (classifyError) {
          console.error('Error auto-classifying transaction:', classifyError);
          // لا نرمي الخطأ هنا حتى لا نمنع إنشاء المعاملة
        }
      }
      
      return createdTransaction;
    } catch (error) {
      console.error('Error creating transaction:', error);
      throw error;
    }
  }

  async updateTransaction(id: number, transaction: Partial<Transaction>): Promise<Transaction | undefined> {
    try {
      const setParts = [];
      const values = [];
      
      if (transaction.date !== undefined) {
        setParts.push(`date = $${setParts.length + 1}`);
        values.push(transaction.date);
      }
      if (transaction.type !== undefined) {
        setParts.push(`type = $${setParts.length + 1}`);
        values.push(transaction.type);
      }
      if (transaction.projectId !== undefined) {
        setParts.push(`project_id = $${setParts.length + 1}`);
        values.push(transaction.projectId);
      }
      if (transaction.description !== undefined) {
        setParts.push(`description = $${setParts.length + 1}`);
        values.push(transaction.description);
      }
      if (transaction.amount !== undefined) {
        setParts.push(`amount = $${setParts.length + 1}`);
        values.push(transaction.amount);
      }
      if (transaction.expenseType !== undefined) {
        setParts.push(`expense_type = $${setParts.length + 1}`);
        values.push(transaction.expenseType);
      }
      if (transaction.employeeId !== undefined) {
        setParts.push(`employee_id = $${setParts.length + 1}`);
        values.push(transaction.employeeId);
      }
      if (transaction.fileUrl !== undefined) {
        setParts.push(`file_url = $${setParts.length + 1}`);
        values.push(transaction.fileUrl);
      }
      if (transaction.fileType !== undefined) {
        setParts.push(`file_type = $${setParts.length + 1}`);
        values.push(transaction.fileType);
      }
      if (transaction.archived !== undefined) {
        setParts.push(`archived = $${setParts.length + 1}`);
        values.push(transaction.archived);
      }

      if (setParts.length === 0) return this.getTransaction(id);

      const query = `UPDATE transactions SET ${setParts.join(', ')} WHERE id = $${setParts.length + 1} RETURNING *`;
      values.push(id);
      
      const result = await this.sql(query, values);
      const updatedTransaction = result[0] as Transaction | undefined;
      
      // إعادة تصنيف المعاملة إذا تم تحديث نوع المصروف
      if (updatedTransaction && updatedTransaction.type === 'expense' && transaction.expenseType !== undefined) {
        console.log(`Re-classifying updated expense transaction: ${updatedTransaction.id} - ${updatedTransaction.expenseType}`);
        try {
          await this.classifyExpenseTransaction(updatedTransaction, true); // force reclassify
        } catch (classifyError) {
          console.error('Error re-classifying updated transaction:', classifyError);
        }
      }
      
      return updatedTransaction;
    } catch (error) {
      console.error('Error updating transaction:', error);
      return undefined;
    }
  }

  async listTransactions(): Promise<Transaction[]> {
    try {
      const result = await this.sql`
        SELECT 
          id, date, type, project_id as "projectId", description, created_by as "createdBy", 
          amount, expense_type as "expenseType", employee_id as "employeeId", 
          file_url as "fileUrl", file_type as "fileType", archived
        FROM transactions 
        ORDER BY date DESC, id DESC
      `;
      return result as Transaction[];
    } catch (error) {
      console.error('Error listing transactions:', error);
      return [];
    }
  }

  async getTransactionsByProject(projectId: number): Promise<Transaction[]> {
    try {
      const result = await this.sql`
        SELECT 
          id, date, type, project_id as "projectId", description, created_by as "createdBy", 
          amount, expense_type as "expenseType", employee_id as "employeeId", 
          file_url as "fileUrl", file_type as "fileType", archived
        FROM transactions 
        WHERE project_id = ${projectId} 
        ORDER BY date DESC, id DESC
      `;
      return result as Transaction[];
    } catch (error) {
      console.error('Error getting transactions by project:', error);
      return [];
    }
  }

  /**
   * جلب المعاملات للمشاريع المخصصة للمستخدم
   * هذا يضمن أن المستخدم يرى فقط المعاملات للمشاريع التي يعمل عليها
   */
  async getTransactionsForUserProjects(userId: number): Promise<Transaction[]> {
    try {
      const result = await this.sql`
        SELECT DISTINCT
          t.id, t.date, t.type, t.project_id as "projectId", t.description, t.created_by as "createdBy", 
          t.amount, t.expense_type as "expenseType", t.employee_id as "employeeId", 
          t.file_url as "fileUrl", t.file_type as "fileType", t.archived
        FROM transactions t
        INNER JOIN user_projects up ON t.project_id = up.project_id
        WHERE up.user_id = ${userId}
        ORDER BY t.date DESC, t.id DESC
      `;
      return result as Transaction[];
    } catch (error) {
      console.error('Error getting transactions for user projects:', error);
      return [];
    }
  }

  /**
   * تحقق من صلاحية المستخدم للوصول لمعاملة معينة
   * بناءً على تخصيصه للمشروع وليس على إنشائه للمعاملة
   */
  async canUserAccessTransaction(userId: number, transactionId: number): Promise<boolean> {
    try {
      const result = await this.sql`
        SELECT t.id
        FROM transactions t
        INNER JOIN user_projects up ON t.project_id = up.project_id
        WHERE t.id = ${transactionId} AND up.user_id = ${userId}
      `;
      return result.length > 0;
    } catch (error) {
      console.error('Error checking user transaction access:', error);
      return false;
    }
  }

  async deleteTransaction(id: number): Promise<boolean> {
    try {
      console.log(`Starting delete process for transaction ${id}`);
      
      // أولاً: حذف جميع القيود المرتبطة من جدول ledger_entries
      const ledgerResult = await this.sql`DELETE FROM ledger_entries WHERE transaction_id = ${id}`;
      console.log(`Deleted ${ledgerResult.length || 0} ledger entries for transaction ${id}`);
      
      // ثانياً: حذف جميع الروابط من جدول document_transaction_links
      const linksResult = await this.sql`DELETE FROM document_transaction_links WHERE transaction_id = ${id}`;
      console.log(`Deleted ${linksResult.length || 0} document links for transaction ${id}`);
      
      // ثالثاً: حذف المعاملة نفسها
      const result = await this.sql`DELETE FROM transactions WHERE id = ${id} RETURNING id`;
      console.log(`Delete transaction result:`, result);
      
      const success = result.length > 0;
      console.log(`Transaction ${id} deletion ${success ? 'successful' : 'failed'}`);
      return success;
    } catch (error) {
      console.error('Error deleting transaction:', error);
      return false;
    }
  }

  // Funds
  async getFund(id: number): Promise<Fund | undefined> {
    try {
      const result = await this.sql`SELECT * FROM funds WHERE id = ${id}`;
      return result[0] as Fund | undefined;
    } catch (error) {
      console.error('Error getting fund:', error);
      return undefined;
    }
  }

  async getFundByOwner(ownerId: number): Promise<Fund | undefined> {
    try {
      const result = await this.sql`SELECT * FROM funds WHERE owner_id = ${ownerId} AND type = 'admin'`;
      return result[0] as Fund | undefined;
    } catch (error) {
      console.error('Error getting fund by owner:', error);
      return undefined;
    }
  }

  async getFundByProject(projectId: number): Promise<Fund | undefined> {
    try {
      const result = await this.sql`SELECT * FROM funds WHERE project_id = ${projectId} AND type = 'project'`;
      return result[0] as Fund | undefined;
    } catch (error) {
      console.error('Error getting fund by project:', error);
      return undefined;
    }
  }

  async createFund(fund: InsertFund): Promise<Fund> {
    try {
      const result = await this.sql`
        INSERT INTO funds (name, type, project_id, balance, owner_id, created_at, updated_at)
        VALUES (${fund.name}, ${fund.type}, ${fund.projectId || null}, ${fund.balance || 0}, ${fund.ownerId || null}, NOW(), NOW())
        RETURNING *
      `;
      return result[0] as Fund;
    } catch (error) {
      console.error('Error creating fund:', error);
      throw error;
    }
  }

  async updateFundBalance(id: number, amount: number): Promise<Fund | undefined> {
    try {
      const result = await this.sql`
        UPDATE funds SET balance = balance + ${amount}, updated_at = NOW() WHERE id = ${id} RETURNING *
      `;
      return result[0] as Fund | undefined;
    } catch (error) {
      console.error('Error updating fund balance:', error);
      return undefined;
    }
  }

  async listFunds(): Promise<Fund[]> {
    try {
      const result = await this.sql`SELECT * FROM funds ORDER BY id`;
      return result as Fund[];
    } catch (error) {
      console.error('Error listing funds:', error);
      return [];
    }
  }

  async processDeposit(userId: number, projectId: number, amount: number, description: string): Promise<{ transaction: Transaction, adminFund?: Fund, projectFund?: Fund }> {
    try {
      // Create transaction
      const transaction = await this.createTransaction({
        date: new Date(),
        amount,
        type: "income",
        description,
        projectId,
        createdBy: userId
      });

      // Update fund balances if needed
      let adminFund, projectFund;
      
      if (projectId) {
        projectFund = await this.getFundByProject(projectId);
        if (projectFund) {
          projectFund = await this.updateFundBalance(projectFund.id, amount);
        }
      } else {
        adminFund = await this.getFundByOwner(userId);
        if (adminFund) {
          adminFund = await this.updateFundBalance(adminFund.id, amount);
        }
      }

      return { transaction, adminFund, projectFund };
    } catch (error) {
      console.error('Error processing deposit:', error);
      throw error;
    }
  }

  async processWithdrawal(userId: number, projectId: number, amount: number, description: string, expenseType?: string): Promise<{ transaction: Transaction, adminFund?: Fund, projectFund?: Fund }> {
    try {
      // Create transaction
      const transaction = await this.createTransaction({
        date: new Date(),
        amount,
        type: "expense",
        description,
        projectId,
        createdBy: userId,
        expenseType
      });

      // Update fund balances if needed
      let adminFund, projectFund;
      
      if (projectId) {
        projectFund = await this.getFundByProject(projectId);
        if (projectFund) {
          projectFund = await this.updateFundBalance(projectFund.id, -amount);
        }
      } else {
        adminFund = await this.getFundByOwner(userId);
        if (adminFund) {
          adminFund = await this.updateFundBalance(adminFund.id, -amount);
        }
      }

      return { transaction, adminFund, projectFund };
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      throw error;
    }
  }

  async processAdminTransaction(userId: number, type: string, amount: number, description: string): Promise<{ transaction: Transaction, adminFund?: Fund }> {
    try {
      // Create transaction
      const transaction = await this.createTransaction({
        date: new Date(),
        amount,
        type,
        description,
        projectId: null,
        createdBy: userId
      });

      // Update admin fund
      let adminFund = await this.getFundByOwner(userId);
      if (adminFund) {
        const updateAmount = type === "income" ? amount : -amount;
        adminFund = await this.updateFundBalance(adminFund.id, updateAmount);
      }

      return { transaction, adminFund };
    } catch (error) {
      console.error('Error processing admin transaction:', error);
      throw error;
    }
  }

  // Documents
  async getDocument(id: number): Promise<Document | undefined> {
    try {
      const result = await this.sql`
        SELECT 
          id,
          name,
          description,
          file_url as "fileUrl",
          file_type as "fileType",
          upload_date as "uploadDate",
          project_id as "projectId",
          uploaded_by as "uploadedBy",
          is_manager_document as "isManagerDocument",
          category,
          tags
        FROM documents 
        WHERE id = ${id}
      `;
      return result[0] as Document | undefined;
    } catch (error) {
      console.error('Error getting document:', error);
      return undefined;
    }
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    try {
      const result = await this.sql`
        INSERT INTO documents (name, project_id, description, file_url, file_type, upload_date, uploaded_by, is_manager_document, category, tags)
        VALUES (${document.name}, ${document.projectId || null}, ${document.description || null}, ${document.fileUrl}, ${document.fileType}, ${document.uploadDate}, ${document.uploadedBy}, ${document.isManagerDocument || false}, ${document.category || null}, ${JSON.stringify(document.tags || {})})
        RETURNING *
      `;
      return result[0] as Document;
    } catch (error) {
      console.error('Error creating document:', error);
      throw error;
    }
  }

  async updateDocument(id: number, document: Partial<Document>): Promise<Document | undefined> {
    try {
      const setParts = [];
      const values = [];
      
      if (document.name !== undefined) {
        setParts.push(`name = $${setParts.length + 1}`);
        values.push(document.name);
      }
      if (document.projectId !== undefined) {
        setParts.push(`project_id = $${setParts.length + 1}`);
        values.push(document.projectId);
      }
      if (document.description !== undefined) {
        setParts.push(`description = $${setParts.length + 1}`);
        values.push(document.description);
      }
      if (document.category !== undefined) {
        setParts.push(`category = $${setParts.length + 1}`);
        values.push(document.category);
      }
      if (document.tags !== undefined) {
        setParts.push(`tags = $${setParts.length + 1}`);
        values.push(JSON.stringify(document.tags));
      }
      if (document.isManagerDocument !== undefined) {
        setParts.push(`is_manager_document = $${setParts.length + 1}`);
        values.push(document.isManagerDocument);
      }

      if (setParts.length === 0) return this.getDocument(id);

      const query = `UPDATE documents SET ${setParts.join(', ')} WHERE id = $${setParts.length + 1} RETURNING *`;
      values.push(id);
      
      const result = await this.sql(query, values);
      return result[0] as Document | undefined;
    } catch (error) {
      console.error('Error updating document:', error);
      return undefined;
    }
  }

  async listDocuments(): Promise<Document[]> {
    try {
      const result = await this.sql`
        SELECT 
          id,
          name,
          description,
          file_url as "fileUrl",
          file_type as "fileType",
          upload_date as "uploadDate",
          project_id as "projectId",
          uploaded_by as "uploadedBy",
          is_manager_document as "isManagerDocument",
          category,
          tags
        FROM documents 
        ORDER BY upload_date DESC
      `;
      return result as Document[];
    } catch (error) {
      console.error('Error listing documents:', error);
      return [];
    }
  }

  async getDocumentsByProject(projectId: number): Promise<Document[]> {
    try {
      const result = await this.sql`
        SELECT 
          id,
          name,
          description,
          file_url as "fileUrl",
          file_type as "fileType",
          upload_date as "uploadDate",
          project_id as "projectId",
          uploaded_by as "uploadedBy",
          is_manager_document as "isManagerDocument",
          category,
          tags
        FROM documents 
        WHERE project_id = ${projectId} 
        ORDER BY upload_date DESC
      `;
      return result as Document[];
    } catch (error) {
      console.error('Error getting documents by project:', error);
      return [];
    }
  }

  async deleteDocument(id: number): Promise<boolean> {
    try {
      const result = await this.sql`DELETE FROM documents WHERE id = ${id}`;
      return result.length > 0;
    } catch (error) {
      console.error('Error deleting document:', error);
      return false;
    }
  }

  // Activity Logs
  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    try {
      const result = await this.sql`
        INSERT INTO activity_logs (action, entity_type, entity_id, details, user_id, timestamp)
        VALUES (${log.action}, ${log.entityType}, ${log.entityId || null}, ${log.details || null}, ${log.userId}, NOW())
        RETURNING *
      `;
      return result[0] as ActivityLog;
    } catch (error) {
      console.error('Error creating activity log:', error);
      throw error;
    }
  }

  async listActivityLogs(): Promise<ActivityLog[]> {
    try {
      const result = await this.sql`SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 100`;
      return result as ActivityLog[];
    } catch (error) {
      console.error('Error listing activity logs:', error);
      return [];
    }
  }

  async getActivityLogsByUser(userId: number): Promise<ActivityLog[]> {
    try {
      const result = await this.sql`
        SELECT * FROM activity_logs WHERE user_id = ${userId} ORDER BY timestamp DESC LIMIT 100
      `;
      return result as ActivityLog[];
    } catch (error) {
      console.error('Error getting activity logs by user:', error);
      return [];
    }
  }

  async getActivityLogsByEntity(entityType: string, entityId: number): Promise<ActivityLog[]> {
    try {
      const result = await this.sql`
        SELECT * FROM activity_logs WHERE entity_type = ${entityType} AND entity_id = ${entityId} ORDER BY timestamp DESC
      `;
      return result as ActivityLog[];
    } catch (error) {
      console.error('Error getting activity logs by entity:', error);
      return [];
    }
  }

  // Settings
  async getSetting(key: string): Promise<Setting | undefined> {
    try {
      const result = await this.sql`SELECT * FROM settings WHERE key = ${key}`;
      return result[0] as Setting | undefined;
    } catch (error) {
      console.error('Error getting setting:', error);
      return undefined;
    }
  }

  async updateSetting(key: string, value: string): Promise<Setting | undefined> {
    try {
      const result = await this.sql`
        INSERT INTO settings (key, value) VALUES (${key}, ${value})
        ON CONFLICT (key) DO UPDATE SET value = ${value}
        RETURNING *
      `;
      return result[0] as Setting | undefined;
    } catch (error) {
      console.error('Error updating setting:', error);
      return undefined;
    }
  }

  async listSettings(): Promise<Setting[]> {
    try {
      const result = await this.sql`SELECT * FROM settings ORDER BY key`;
      return result as Setting[];
    } catch (error) {
      console.error('Error listing settings:', error);
      return [];
    }
  }

  // Placeholder implementations for other methods
  async getExpenseType(id: number): Promise<ExpenseType | undefined> {
    try {
      const result = await this.sql`SELECT * FROM expense_types WHERE id = ${id}`;
      return result[0] as ExpenseType | undefined;
    } catch (error) {
      console.error('Error getting expense type:', error);
      return undefined;
    }
  }

  async getExpenseTypeByName(name: string): Promise<ExpenseType | undefined> {
    try {
      const result = await this.sql`SELECT * FROM expense_types WHERE name = ${name}`;
      return result[0] as ExpenseType | undefined;
    } catch (error) {
      console.error('Error getting expense type by name:', error);
      return undefined;
    }
  }

  async createExpenseType(expenseType: InsertExpenseType): Promise<ExpenseType> {
    try {
      // التحقق من عدم وجود الاسم مسبقاً في نفس المشروع
      const existing = await this.sql`
        SELECT id FROM expense_types 
        WHERE name = ${expenseType.name} 
        AND (project_id = ${expenseType.projectId || null} OR (project_id IS NULL AND ${expenseType.projectId || null} IS NULL))
      `;
      
      if (existing.length > 0) {
        const projectText = expenseType.projectId ? "في هذا المشروع" : "العام";
        throw new Error(`نوع المصروف "${expenseType.name}" موجود مسبقاً ${projectText}`);
      }

      const result = await this.sql`
        INSERT INTO expense_types (name, description, project_id)
        VALUES (${expenseType.name}, ${expenseType.description || null}, ${expenseType.projectId || null})
        RETURNING *
      `;
      return result[0] as ExpenseType;
    } catch (error) {
      console.error('Error creating expense type:', error);
      // إذا كان الخطأ من قاعدة البيانات بسبب الاسم المكرر
      if (error instanceof Error && error.message.includes('duplicate key value')) {
        throw new Error(`نوع المصروف "${expenseType.name}" موجود مسبقاً في هذا المشروع`);
      }
      throw error;
    }
  }

  async updateExpenseType(id: number, expenseType: Partial<ExpenseType>): Promise<ExpenseType | undefined> {
    try {
      const setParts = [];
      const values = [];
      
      if (expenseType.name !== undefined) {
        setParts.push(`name = $${setParts.length + 1}`);
        values.push(expenseType.name);
      }
      if (expenseType.description !== undefined) {
        setParts.push(`description = $${setParts.length + 1}`);
        values.push(expenseType.description);
      }
      if (expenseType.projectId !== undefined) {
        setParts.push(`project_id = $${setParts.length + 1}`);
        values.push(expenseType.projectId);
      }
      if (expenseType.isActive !== undefined) {
        setParts.push(`is_active = $${setParts.length + 1}`);
        values.push(expenseType.isActive);
      }

      if (setParts.length === 0) return this.getExpenseType(id);

      const query = `UPDATE expense_types SET ${setParts.join(', ')} WHERE id = $${setParts.length + 1} RETURNING *`;
      values.push(id);
      
      const result = await this.sql(query, values);
      return result[0] as ExpenseType | undefined;
    } catch (error) {
      console.error('Error updating expense type:', error);
      return undefined;
    }
  }

  async listExpenseTypes(projectId?: number): Promise<ExpenseType[]> {
    try {
      if (projectId !== undefined) {
        // إذا تم تحديد مشروع، إرجاع أنواع المصروفات الخاصة بالمشروع والعامة
        const result = await this.sql`
          SELECT * FROM expense_types 
          WHERE (project_id = ${projectId} OR project_id IS NULL) AND is_active = true
          ORDER BY name
        `;
        return result as ExpenseType[];
      } else {
        // إرجاع جميع أنواع المصروفات (للمدير)
        const result = await this.sql`SELECT * FROM expense_types ORDER BY name`;
        return result as ExpenseType[];
      }
    } catch (error) {
      console.error('Error listing expense types:', error);
      return [];
    }
  }

  // دالة جديدة لإرجاع أنواع المصروفات للمستخدم حسب مشاريعه
  async listExpenseTypesForUser(userId: number): Promise<ExpenseType[]> {
    try {
      const result = await this.sql`
        SELECT DISTINCT et.* FROM expense_types et
        LEFT JOIN user_projects up ON et.project_id = up.project_id
        WHERE (up.user_id = ${userId} OR et.project_id IS NULL) AND et.is_active = true
        ORDER BY et.name
      `;
      return result as ExpenseType[];
    } catch (error) {
      console.error('Error listing expense types for user:', error);
      return [];
    }
  }

  async deleteExpenseType(id: number): Promise<boolean> {
    try {
      // التحقق من وجود معاملات مرتبطة
      const linkedTransactions = await this.sql`
        SELECT COUNT(*) as count FROM transactions WHERE expense_type = ${id}
      `;
      
      const linkedLedgerEntries = await this.sql`
        SELECT COUNT(*) as count FROM ledger_entries WHERE expense_type_id = ${id}
      `;
      
      if (linkedTransactions[0].count > 0 || linkedLedgerEntries[0].count > 0) {
        throw new Error(`لا يمكن حذف نوع المصروف لأنه مرتبط بـ ${linkedTransactions[0].count} معاملة و ${linkedLedgerEntries[0].count} قيد محاسبي`);
      }

      const result = await this.sql`DELETE FROM expense_types WHERE id = ${id}`;
      return true;
    } catch (error) {
      console.error('Error deleting expense type:', error);
      throw error;
    }
  }

  async createLedgerEntry(entry: InsertLedgerEntry): Promise<LedgerEntry> {
    try {
      const result = await this.sql`
        INSERT INTO ledger_entries (transaction_id, entry_type, account_name, debit_amount, credit_amount, project_id, expense_type_id, description, entry_date)
        VALUES (${entry.transactionId}, ${entry.entryType}, ${entry.accountName || null}, ${entry.debitAmount || 0}, ${entry.creditAmount || 0}, ${entry.projectId || null}, ${entry.expenseTypeId || null}, ${entry.description || null}, ${entry.date || entry.entryDate || new Date().toISOString()})
        RETURNING *
      `;
      return result[0] as LedgerEntry;
    } catch (error) {
      console.error('Error creating ledger entry:', error);
      throw error;
    }
  }

  async updateLedgerEntry(id: number, entry: Partial<LedgerEntry>): Promise<LedgerEntry | undefined> {
    try {
      const setParts = [];
      const values = [];
      
      if (entry.entryType !== undefined) {
        setParts.push(`entry_type = $${setParts.length + 1}`);
        values.push(entry.entryType);
      }
      if (entry.accountName !== undefined) {
        setParts.push(`account_name = $${setParts.length + 1}`);
        values.push(entry.accountName);
      }
      if (entry.debitAmount !== undefined) {
        setParts.push(`debit_amount = $${setParts.length + 1}`);
        values.push(entry.debitAmount);
      }
      if (entry.creditAmount !== undefined) {
        setParts.push(`credit_amount = $${setParts.length + 1}`);
        values.push(entry.creditAmount);
      }
      if (entry.description !== undefined) {
        setParts.push(`description = $${setParts.length + 1}`);
        values.push(entry.description);
      }

      if (setParts.length === 0) return undefined;

      const query = `UPDATE ledger_entries SET ${setParts.join(', ')} WHERE id = $${setParts.length + 1} RETURNING *`;
      values.push(id);
      
      const result = await this.sql(query, values);
      return result[0] as LedgerEntry | undefined;
    } catch (error) {
      console.error('Error updating ledger entry:', error);
      return undefined;
    }
  }

  async getLedgerEntriesByType(entryType: string): Promise<LedgerEntry[]> {
    try {
      const result = await this.sql`
        SELECT * FROM ledger_entries WHERE entry_type = ${entryType} ORDER BY date DESC
      `;
      return result as LedgerEntry[];
    } catch (error) {
      console.error('Error getting ledger entries by type:', error);
      return [];
    }
  }

  async getLedgerEntriesByProject(projectId: number): Promise<LedgerEntry[]> {
    try {
      const result = await this.sql`
        SELECT * FROM ledger_entries WHERE project_id = ${projectId} ORDER BY date DESC
      `;
      return result as LedgerEntry[];
    } catch (error) {
      console.error('Error getting ledger entries by project:', error);
      return [];
    }
  }

  async getLedgerEntriesByExpenseType(expenseTypeId: number): Promise<LedgerEntry[]> {
    try {
      const result = await this.sql`
        SELECT * FROM ledger_entries WHERE expense_type_id = ${expenseTypeId} ORDER BY date DESC
      `;
      return result as LedgerEntry[];
    } catch (error) {
      console.error('Error getting ledger entries by expense type:', error);
      return [];
    }
  }

  async listLedgerEntries(): Promise<LedgerEntry[]> {
    try {
      const result = await this.sql`SELECT * FROM ledger_entries ORDER BY date DESC`;
      return result as LedgerEntry[];
    } catch (error) {
      console.error('Error listing ledger entries:', error);
      return [];
    }
  }

  async classifyExpenseTransaction(transaction: Transaction, forceClassify: boolean = false): Promise<void> {
    try {
      console.log(`PgStorage: Classifying transaction ${transaction.id} - ${transaction.description}`);
      
      // فقط للمصروفات
      if (transaction.type !== 'expense') {
        return;
      }

      // البحث عن نوع المصروف
      let expenseTypeId: number | null = null;
      
      if (transaction.expenseType) {
        console.log(`Looking up expense type: "${transaction.expenseType}"`);
        
        // البحث أولاً بالتطابق الدقيق
        let expenseTypeResult = await this.sql`
          SELECT id, name FROM expense_types 
          WHERE name = ${transaction.expenseType} AND is_active = true
          LIMIT 1
        `;
        
        // إذا لم نجد تطابق دقيق، نبحث بتجاهل المسافات الإضافية
        if (expenseTypeResult.length === 0) {
          console.log(`No exact match found, trying with trimmed names...`);
          expenseTypeResult = await this.sql`
            SELECT id, name FROM expense_types 
            WHERE TRIM(name) = TRIM(${transaction.expenseType}) AND is_active = true
            LIMIT 1
          `;
        }
        
        // إذا لم نجد تطابق بعد التقليم، نبحث بالمحتوى المشترك
        if (expenseTypeResult.length === 0) {
          console.log(`No trimmed match found, trying case-insensitive match...`);
          expenseTypeResult = await this.sql`
            SELECT id, name FROM expense_types 
            WHERE LOWER(TRIM(name)) = LOWER(TRIM(${transaction.expenseType})) 
            AND is_active = true
            LIMIT 1
          `;
        }
        
        // إذا لم نجد تطابق، نحاول البحث الجزئي
        if (expenseTypeResult.length === 0) {
          console.log(`No case-insensitive match found, trying partial match...`);
          expenseTypeResult = await this.sql`
            SELECT id, name FROM expense_types 
            WHERE (LOWER(TRIM(name)) LIKE '%' || LOWER(TRIM(${transaction.expenseType})) || '%' 
                  OR LOWER(TRIM(${transaction.expenseType})) LIKE '%' || LOWER(TRIM(name)) || '%')
            AND is_active = true
            LIMIT 1
          `;
        }
        
        console.log(`Expense type lookup result:`, expenseTypeResult);
        
        if (expenseTypeResult.length > 0) {
          expenseTypeId = expenseTypeResult[0].id;
          console.log(`Found expense type ID: ${expenseTypeId} for name: "${expenseTypeResult[0].name}"`);
        } else {
          console.log(`No expense type found for: "${transaction.expenseType}"`);
          // سجل جميع أنواع المصاريف المتاحة للتشخيص
          const allExpenseTypes = await this.sql`
            SELECT id, name FROM expense_types WHERE is_active = true
          `;
          console.log(`All active expense types:`, allExpenseTypes);
        }
      }

      // التحقق من وجود قيد سابق
      const existingEntry = await this.sql`
        SELECT id FROM ledger_entries 
        WHERE transaction_id = ${transaction.id}
        LIMIT 1
      `;

      if (existingEntry.length > 0 && !forceClassify) {
        console.log(`Transaction ${transaction.id} already has ledger entry`);
        return;
      }

      // إنشاء قيد في دفتر الأستاذ
      const ledgerEntry = {
        date: new Date(transaction.date),
        transactionId: transaction.id,
        expenseTypeId: expenseTypeId,
        amount: transaction.amount,
        description: transaction.description,
        projectId: transaction.projectId || null,
        entryType: expenseTypeId ? 'classified' : 'miscellaneous'
      };

      if (existingEntry.length > 0) {
        // تحديث القيد الموجود
        await this.sql`
          UPDATE ledger_entries 
          SET 
            expense_type_id = ${expenseTypeId},
            entry_type = ${ledgerEntry.entryType},
            amount = ${ledgerEntry.amount},
            description = ${ledgerEntry.description},
            project_id = ${ledgerEntry.projectId}
          WHERE transaction_id = ${transaction.id}
        `;
        console.log(`Updated ledger entry for transaction ${transaction.id}`);
      } else {
        // إنشاء قيد جديد
        await this.sql`
          INSERT INTO ledger_entries (
            date, transaction_id, expense_type_id, amount, 
            description, project_id, entry_type
          ) VALUES (
            ${ledgerEntry.date}, ${ledgerEntry.transactionId}, ${ledgerEntry.expenseTypeId},
            ${ledgerEntry.amount}, ${ledgerEntry.description}, ${ledgerEntry.projectId},
            ${ledgerEntry.entryType}
          )
        `;
        console.log(`Created new ledger entry for transaction ${transaction.id} with type: ${ledgerEntry.entryType}`);
      }

    } catch (error) {
      console.error('Error classifying expense transaction:', error);
      throw error;
    }
  }

  async getAccountCategory(id: number): Promise<AccountCategory | undefined> {
    try {
      const result = await this.sql`SELECT * FROM account_categories WHERE id = ${id}`;
      return result[0] as AccountCategory | undefined;
    } catch (error) {
      console.error('Error getting account category:', error);
      return undefined;
    }
  }

  async createAccountCategory(category: InsertAccountCategory): Promise<AccountCategory> {
    try {
      const result = await this.sql`
        INSERT INTO account_categories (name, description, category_type)
        VALUES (${category.name}, ${category.description || null}, 'expense')
        RETURNING *
      `;
      return result[0] as AccountCategory;
    } catch (error) {
      console.error('Error creating account category:', error);
      throw error;
    }
  }

  async updateAccountCategory(id: number, category: Partial<AccountCategory>): Promise<AccountCategory | undefined> {
    try {
      const setParts = [];
      const values = [];
      
      if (category.name !== undefined) {
        setParts.push(`name = $${setParts.length + 1}`);
        values.push(category.name);
      }
      if (category.description !== undefined) {
        setParts.push(`description = $${setParts.length + 1}`);
        values.push(category.description);
      }
      // categoryType is not used in current schema

      if (setParts.length === 0) return this.getAccountCategory(id);

      const query = `UPDATE account_categories SET ${setParts.join(', ')} WHERE id = $${setParts.length + 1} RETURNING *`;
      values.push(id);
      
      const result = await this.sql(query, values);
      return result[0] as AccountCategory | undefined;
    } catch (error) {
      console.error('Error updating account category:', error);
      return undefined;
    }
  }

  async listAccountCategories(): Promise<AccountCategory[]> {
    try {
      const result = await this.sql`SELECT * FROM account_categories ORDER BY name`;
      return result as AccountCategory[];
    } catch (error) {
      console.error('Error listing account categories:', error);
      return [];
    }
  }

  async deleteAccountCategory(id: number): Promise<boolean> {
    try {
      const result = await this.sql`DELETE FROM account_categories WHERE id = ${id}`;
      return result.length > 0;
    } catch (error) {
      console.error('Error deleting account category:', error);
      return false;
    }
  }

  async getDeferredPayment(id: number): Promise<DeferredPayment | undefined> {
    try {
      const result = await this.sql`SELECT * FROM deferred_payments WHERE id = ${id}`;
      const row = result[0];
      
      if (!row) return undefined;
      
      // تحويل من snake_case إلى camelCase
      return {
        id: row.id,
        beneficiaryName: row.beneficiary_name,
        totalAmount: row.total_amount,
        paidAmount: row.paid_amount,
        remainingAmount: row.remaining_amount,
        projectId: row.project_id,
        userId: row.user_id,
        status: row.status,
        description: row.description,
        dueDate: row.due_date,
        installments: row.installments,
        paymentFrequency: row.payment_frequency,
        notes: row.notes,
        completedAt: row.completed_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      } as DeferredPayment;
    } catch (error) {
      console.error('Error getting deferred payment:', error);
      return undefined;
    }
  }

  async createDeferredPayment(payment: InsertDeferredPayment): Promise<DeferredPayment> {
    try {
      const result = await this.sql`
        INSERT INTO deferred_payments (
          beneficiary_name, 
          total_amount, 
          paid_amount, 
          remaining_amount, 
          project_id, 
          user_id, 
          status,
          description, 
          due_date, 
          installments, 
          payment_frequency, 
          notes
        )
        VALUES (
          ${payment.beneficiaryName}, 
          ${payment.totalAmount}, 
          ${0}, 
          ${payment.remainingAmount || payment.totalAmount}, 
          ${payment.projectId || null}, 
          ${payment.userId}, 
          ${'pending'},
          ${payment.description || null}, 
          ${payment.dueDate || null}, 
          ${payment.installments || 1}, 
          ${payment.paymentFrequency || 'monthly'}, 
          ${payment.notes || null}
        )
        RETURNING *
      `;
      return result[0] as DeferredPayment;
    } catch (error) {
      console.error('Error creating deferred payment:', error);
      throw error;
    }
  }

  async updateDeferredPayment(id: number, payment: Partial<DeferredPayment>): Promise<DeferredPayment | undefined> {
    try {
      console.log('Updating deferred payment:', { id, payment });
      
      const setParts = [];
      const values = [];
      
      if (payment.description !== undefined) {
        setParts.push(`description = $${values.length + 1}`);
        values.push(payment.description);
      }
      if (payment.totalAmount !== undefined) {
        setParts.push(`total_amount = $${values.length + 1}`);
        values.push(Number(payment.totalAmount));
      }
      if (payment.paidAmount !== undefined) {
        setParts.push(`paid_amount = $${values.length + 1}`);
        values.push(Number(payment.paidAmount));
      }
      if (payment.remainingAmount !== undefined) {
        setParts.push(`remaining_amount = $${values.length + 1}`);
        values.push(Number(payment.remainingAmount));
      }
      if (payment.status !== undefined) {
        setParts.push(`status = $${values.length + 1}`);
        values.push(payment.status);
      }
      if (payment.dueDate !== undefined) {
        setParts.push(`due_date = $${values.length + 1}`);
        values.push(payment.dueDate);
      }

      if (setParts.length === 0) return this.getDeferredPayment(id);

      values.push(id);
      const query = `UPDATE deferred_payments SET ${setParts.join(', ')} WHERE id = $${values.length} RETURNING *`;
      
      console.log('Query:', query);
      console.log('Values:', values);
      
      const result = await this.sql(query, values);
      
      if (result.length === 0) {
        console.error('No rows returned from update');
        return undefined;
      }
      
      const updatedPayment = result[0] as any;
      console.log('Updated payment result:', updatedPayment);
      
      return {
        id: updatedPayment.id,
        beneficiaryName: updatedPayment.beneficiary_name,
        totalAmount: updatedPayment.total_amount,
        paidAmount: updatedPayment.paid_amount,
        remainingAmount: updatedPayment.remaining_amount,
        status: updatedPayment.status,
        description: updatedPayment.description,
        dueDate: updatedPayment.due_date,
        projectId: updatedPayment.project_id,
        createdAt: updatedPayment.created_at,
        updatedAt: updatedPayment.updated_at,
        createdBy: updatedPayment.created_by
      } as DeferredPayment;
    } catch (error) {
      console.error('Error updating deferred payment:', error);
      throw error;
    }
  }

  async listDeferredPayments(): Promise<DeferredPayment[]> {
    try {
      const result = await this.sql`
        SELECT 
          dp.*,
          p.name as project_name
        FROM deferred_payments dp
        LEFT JOIN projects p ON dp.project_id = p.id
        ORDER BY dp.created_at DESC
      `;
      return result.map(row => ({
        id: row.id,
        beneficiaryName: row.beneficiary_name,
        totalAmount: row.total_amount,
        paidAmount: row.paid_amount,
        remainingAmount: row.remaining_amount,
        projectId: row.project_id,
        userId: row.user_id,
        status: row.status,
        description: row.description,
        dueDate: row.due_date,
        installments: row.installments,
        paymentFrequency: row.payment_frequency,
        notes: row.notes,
        completedAt: row.completed_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        projectName: row.project_name
      })) as any[];
    } catch (error) {
      console.error('Error listing deferred payments:', error);
      return [];
    }
  }

  /**
   * استرجاع المستحقات للمشاريع المخصصة للمستخدم فقط
   * كل مستخدم يرى فقط مستحقات المشاريع التي هو مخصص لها
   */
  async getDeferredPaymentsForUserProjects(userId: number): Promise<DeferredPayment[]> {
    try {
      console.log(`Getting deferred payments for user ${userId} projects...`);
      
      const result = await this.sql`
        SELECT 
          dp.*,
          p.name as project_name
        FROM deferred_payments dp
        LEFT JOIN projects p ON dp.project_id = p.id
        INNER JOIN user_projects up ON dp.project_id = up.project_id
        WHERE up.user_id = ${userId}
        ORDER BY dp.created_at DESC
      `;
      
      const mappedResults = result.map(row => ({
        id: row.id,
        beneficiaryName: row.beneficiary_name,
        totalAmount: row.total_amount,
        paidAmount: row.paid_amount,
        remainingAmount: row.remaining_amount,
        projectId: row.project_id,
        userId: row.user_id,
        status: row.status,
        description: row.description,
        dueDate: row.due_date,
        installments: row.installments,
        paymentFrequency: row.payment_frequency,
        notes: row.notes,
        completedAt: row.completed_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        projectName: row.project_name
      })) as any[];

      console.log(`Found ${mappedResults.length} deferred payments for user ${userId}`);
      return mappedResults;
    } catch (error) {
      console.error('Error getting deferred payments for user projects:', error);
      return [];
    }
  }

  async deleteDeferredPayment(id: number): Promise<boolean> {
    try {
      // Check if payment exists first
      const existingPayment = await this.getDeferredPayment(id);
      if (!existingPayment) {
        return false;
      }
      
      await this.sql`DELETE FROM deferred_payments WHERE id = ${id}`;
      return true;
    } catch (error) {
      console.error('Error deleting deferred payment:', error);
      return false;
    }
  }

  async payDeferredPaymentInstallment(id: number, amount: number, userId: number): Promise<{ payment: DeferredPayment; transaction?: Transaction }> {
    try {
      console.log(`Starting payment installment for deferred payment ${id}, amount: ${amount}, user: ${userId}`);
      
      const payment = await this.getDeferredPayment(id);
      if (!payment) throw new Error('Deferred payment not found');

      // التأكد من أن المبالغ أرقام صحيحة
      const currentPaidAmount = Number(payment.paidAmount) || 0;
      const paymentAmount = Number(amount) || 0;
      const totalAmount = Number(payment.totalAmount) || 0;
      
      if (isNaN(paymentAmount) || paymentAmount <= 0) {
        throw new Error('Invalid payment amount');
      }

      const newPaidAmount = currentPaidAmount + paymentAmount;
      const newRemainingAmount = totalAmount - newPaidAmount;
      const newStatus = newRemainingAmount <= 0 ? 'completed' : 'partial';

      console.log(`Payment calculation: paid=${currentPaidAmount} + ${paymentAmount} = ${newPaidAmount}, remaining=${newRemainingAmount}, status=${newStatus}`);

      const updatedPayment = await this.updateDeferredPayment(id, {
        paidAmount: newPaidAmount,
        remainingAmount: newRemainingAmount,
        status: newStatus
      });

      // إنشاء معاملة مالية لتسجيل دفع المستحق
      let transaction;
      try {
        // استخدام اسم المستفيد من beneficiary_name
        const beneficiaryName = (payment as any).beneficiary_name || payment.beneficiaryName || 'غير محدد';
        const transactionDescription = payment.description 
          ? `دفع قسط من: ${payment.description} (${beneficiaryName})`
          : `دفع قسط للمستفيد: ${beneficiaryName}`;

        if (payment.projectId) {
          // إذا كان المستحق مرتبط بمشروع، نسجل الدفعة من صندوق المشروع
          const result = await this.processWithdrawal(userId, payment.projectId, paymentAmount, transactionDescription);
          transaction = result.transaction;
        } else {
          // إذا لم يكن مرتبط بمشروع، نسجل الدفعة كمصروف عام
          // البحث عن نوع المصروف المحدد لهذا المستحق
          let matchingExpenseType;
          try {
            const beneficiaryName = (payment as any).beneficiary_name || payment.beneficiaryName;
            console.log(`Looking for expense type matching beneficiary: ${beneficiaryName}`);
            
            // البحث عن نوع مصروف مطابق للمستفيد
            const existingTypes = await this.sql`
              SELECT * FROM expense_types 
              WHERE LOWER(TRIM(name)) = LOWER(TRIM(${beneficiaryName})) 
              AND is_active = true 
              LIMIT 1
            `;
            
            if (existingTypes.length > 0) {
              matchingExpenseType = existingTypes[0];
              console.log(`Found matching expense type: ${matchingExpenseType.name} (ID: ${matchingExpenseType.id})`);
            } else {
              // البحث عن نوع مصروف "دفعات آجلة" كاحتياطي
              const fallbackTypes = await this.sql`SELECT * FROM expense_types WHERE name = 'دفعات آجلة' AND is_active = true LIMIT 1`;
              if (fallbackTypes.length > 0) {
                matchingExpenseType = fallbackTypes[0];
                console.log(`Using fallback expense type: دفعات آجلة`);
              } else {
                // إنشاء نوع المصروف الاحتياطي إذا لم يكن موجوداً
                const newType = await this.sql`
                  INSERT INTO expense_types (name, description, is_active, created_by)
                  VALUES ('دفعات آجلة', 'المدفوعات للمستحقات والأقساط المؤجلة', true, ${userId})
                  RETURNING *
                `;
                matchingExpenseType = newType[0];
                console.log('Created fallback expense type for deferred payments:', matchingExpenseType);
              }
            }
          } catch (error) {
            console.error('Error getting/creating expense type:', error);
          }

          const transactionData = {
            type: 'expense' as const,
            amount: paymentAmount,
            description: transactionDescription,
            date: new Date(),
            createdBy: userId,
            projectId: null,
            expenseType: matchingExpenseType?.name || null,
            employeeId: null
          };

          transaction = await this.createTransaction(transactionData);
          console.log(`Created transaction for deferred payment: ${transaction.id} linked to expense type: ${matchingExpenseType?.name || 'none'}`);
          
          // إنشاء قيد دفتر الأستاذ مرتبط بنوع المصروف
          if (matchingExpenseType && transaction) {
            try {
              const ledgerEntry = {
                date: new Date(),
                description: transactionDescription,
                amount: paymentAmount,
                debitAmount: paymentAmount,
                creditAmount: 0,
                entryType: 'expense',
                projectId: null,
                transactionId: transaction.id,
                expenseTypeId: matchingExpenseType.id
              };
              
              await this.createLedgerEntry(ledgerEntry);
              console.log(`Created ledger entry for transaction ${transaction.id} with expense type ${matchingExpenseType.id}`);
            } catch (ledgerError) {
              console.error('Error creating ledger entry for deferred payment:', ledgerError);
            }
          }
        }
      } catch (transactionError) {
        console.error('Error creating transaction for deferred payment:', transactionError);
        // لا نفشل العملية كاملة إذا فشل تسجيل المعاملة، لكن نسجل الخطأ
      }

      return { payment: updatedPayment!, transaction };
    } catch (error) {
      console.error('Error paying deferred payment installment:', error);
      throw error;
    }
  }

  async getEmployee(id: number): Promise<Employee | undefined> {
    try {
      const result = await this.sql`SELECT * FROM employees WHERE id = ${id}`;
      return result[0] as Employee | undefined;
    } catch (error) {
      console.error('Error getting employee:', error);
      return undefined;
    }
  }

  async createEmployee(employee: InsertEmployee): Promise<Employee> {
    try {
      const result = await this.sql`
        INSERT INTO employees (name, salary, assigned_project_id, active, hire_date, notes, created_by)
        VALUES (${employee.name}, ${employee.salary || 0}, ${employee.assignedProjectId || null}, ${employee.active !== false}, ${employee.hireDate || new Date()}, ${employee.notes || null}, ${1})
        RETURNING *
      `;
      return result[0] as Employee;
    } catch (error) {
      console.error('Error creating employee:', error);
      throw error;
    }
  }

  async updateEmployee(id: number, employee: Partial<InsertEmployee>): Promise<Employee> {
    try {
      const setParts = [];
      const values = [];
      
      if (employee.name !== undefined) {
        setParts.push(`name = $${setParts.length + 1}`);
        values.push(employee.name);
      }
      if (employee.salary !== undefined) {
        setParts.push(`salary = $${setParts.length + 1}`);
        values.push(employee.salary);
      }
      if (employee.assignedProjectId !== undefined) {
        setParts.push(`assigned_project_id = $${setParts.length + 1}`);
        values.push(employee.assignedProjectId);
      }
      if (employee.active !== undefined) {
        setParts.push(`active = $${setParts.length + 1}`);
        values.push(employee.active);
      }
      if (employee.hireDate !== undefined) {
        setParts.push(`hire_date = $${setParts.length + 1}`);
        values.push(employee.hireDate);
      }
      if (employee.notes !== undefined) {
        setParts.push(`notes = $${setParts.length + 1}`);
        values.push(employee.notes);
      }

      if (setParts.length === 0) throw new Error('No fields to update');

      const query = `UPDATE employees SET ${setParts.join(', ')}, updated_at = NOW() WHERE id = $${setParts.length + 1} RETURNING *`;
      values.push(id);
      
      const result = await this.sql(query, values);
      return result[0] as Employee;
    } catch (error) {
      console.error('Error updating employee:', error);
      throw error;
    }
  }

  async getEmployees(): Promise<Employee[]> {
    try {
      const result = await this.sql`
        SELECT e.*, p.name as project_name 
        FROM employees e 
        LEFT JOIN projects p ON e.assigned_project_id = p.id 
        ORDER BY e.created_at DESC
      `;
      
      return result.map((row: any) => ({
        id: row.id,
        name: row.name,
        salary: row.salary,
        currentBalance: row.current_balance,
        totalPaid: row.total_paid,
        lastSalaryReset: row.last_salary_reset,
        assignedProjectId: row.assigned_project_id,
        assignedProject: row.project_name ? { id: row.assigned_project_id, name: row.project_name } : null,
        active: row.active,
        hireDate: row.hire_date,
        notes: row.notes,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      })) as Employee[];
    } catch (error) {
      console.error('Error getting employees:', error);
      return [];
    }
  }

  async deleteEmployee(id: number): Promise<boolean> {
    try {
      const result = await this.sql`DELETE FROM employees WHERE id = ${id}`;
      return result.length > 0;
    } catch (error) {
      console.error('Error deleting employee:', error);
      return false;
    }
  }

  /**
   * دفع راتب للموظف وخصمه من الرصيد المتبقي
   */
  async paySalaryToEmployee(employeeId: number, amount: number, userId: number, description?: string): Promise<{ employee: any; transaction: any } | null> {
    try {
      // التحقق من وجود الموظف والرصيد
      const employee = await this.sql`
        SELECT * FROM employees WHERE id = ${employeeId} AND active = true
      `;
      
      if (employee.length === 0) {
        throw new Error('الموظف غير موجود أو غير نشط');
      }
      
      const emp = employee[0];
      
      if (emp.current_balance < amount) {
        throw new Error(`الرصيد المتبقي غير كافي. الرصيد المتبقي: ${emp.current_balance}, المطلوب: ${amount}`);
      }
      
      // تحديث رصيد الموظف
      const updatedEmployee = await this.sql`
        UPDATE employees 
        SET current_balance = current_balance - ${amount},
            total_paid = total_paid + ${amount},
            updated_at = NOW()
        WHERE id = ${employeeId}
        RETURNING *
      `;
      
      // إنشاء معاملة راتب
      const transactionDescription = description || `دفع راتب للموظف: ${emp.name}`;
      const transaction = await this.sql`
        INSERT INTO transactions (
          date, amount, type, expense_type, description, 
          project_id, created_by, employee_id
        ) VALUES (
          NOW(), ${amount}, 'expense', 'راتب', ${transactionDescription},
          ${emp.assigned_project_id}, ${userId}, ${employeeId}
        ) RETURNING *
      `;
      
      return {
        employee: updatedEmployee[0],
        transaction: transaction[0]
      };
      
    } catch (error) {
      console.error('خطأ في دفع الراتب:', error);
      throw error;
    }
  }

  /**
   * إعادة تعيين رواتب جميع الموظفين النشطين في بداية الشهر
   */
  async resetAllEmployeeSalaries(): Promise<{ count: number; employees: any[] }> {
    try {
      const updatedEmployees = await this.sql`
        UPDATE employees 
        SET current_balance = salary,
            total_paid = 0,
            last_salary_reset = NOW(),
            updated_at = NOW()
        WHERE active = true
        RETURNING *
      `;
      
      console.log(`تم إعادة تعيين رواتب ${updatedEmployees.length} موظف`);
      
      return {
        count: updatedEmployees.length,
        employees: updatedEmployees
      };
      
    } catch (error) {
      console.error('خطأ في إعادة تعيين الرواتب:', error);
      throw error;
    }
  }

  /**
   * التحقق من الموظفين الذين يحتاجون إعادة تعيين راتب
   */
  async checkEmployeesForSalaryReset(): Promise<any[]> {
    try {
      const currentDate = new Date();
      const firstOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      
      const employees = await this.sql`
        SELECT * FROM employees 
        WHERE active = true 
        AND (last_salary_reset IS NULL OR last_salary_reset < ${firstOfMonth.toISOString()})
      `;
      
      return employees;
    } catch (error) {
      console.error('خطأ في التحقق من إعادة تعيين الرواتب:', error);
      return [];
    }
  }

  /**
   * الحصول على تفاصيل راتب موظف معين
   */
  async getEmployeeSalaryDetails(employeeId: number): Promise<any | null> {
    try {
      const result = await this.sql`
        SELECT 
          e.*,
          p.name as project_name,
          (SELECT COUNT(*) FROM transactions WHERE employee_id = e.id AND expense_type = 'راتب' 
           AND date >= DATE_TRUNC('month', CURRENT_DATE)) as payments_this_month
        FROM employees e
        LEFT JOIN projects p ON e.assigned_project_id = p.id
        WHERE e.id = ${employeeId}
      `;
      
      return result[0] || null;
    } catch (error) {
      console.error('خطأ في جلب تفاصيل راتب الموظف:', error);
      return null;
    }
  }

  async getEmployeesByProject(projectId: number): Promise<Employee[]> {
    try {
      const result = await this.sql`
        SELECT * FROM employees WHERE project_id = ${projectId} ORDER BY name
      `;
      return result as Employee[];
    } catch (error) {
      console.error('Error getting employees by project:', error);
      return [];
    }
  }

  async getActiveEmployees(): Promise<Employee[]> {
    try {
      const result = await this.sql`
        SELECT e.*, p.name as project_name 
        FROM employees e 
        LEFT JOIN projects p ON e.assigned_project_id = p.id 
        WHERE e.active = true 
        ORDER BY e.name
      `;
      
      return result.map((row: any) => ({
        id: row.id,
        name: row.name,
        salary: row.salary,
        currentBalance: row.current_balance || 0,
        totalPaid: row.total_paid || 0,
        lastSalaryReset: row.last_salary_reset,
        assignedProjectId: row.assigned_project_id,
        assignedProject: row.project_name ? { id: row.assigned_project_id, name: row.project_name } : null,
        active: row.active,
        hireDate: row.hire_date,
        notes: row.notes,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      })) as Employee[];
    } catch (error) {
      console.error('Error getting active employees:', error);
      return [];
    }
  }

  // Completed Works - Independent section
  async createCompletedWork(work: InsertCompletedWork): Promise<CompletedWork> {
    try {
      const result = await this.sql`
        INSERT INTO completed_works (title, description, amount, date, category, file_url, file_type, created_by)
        VALUES (${work.title}, ${work.description || null}, ${work.amount || null}, ${work.date}, ${work.category || null}, ${work.fileUrl || null}, ${work.fileType || null}, ${1})
        RETURNING *
      `;
      return result[0] as CompletedWork;
    } catch (error) {
      console.error('Error creating completed work:', error);
      throw error;
    }
  }

  async listCompletedWorks(): Promise<CompletedWork[]> {
    try {
      const result = await this.sql`
        SELECT cw.*, u.name as creator_name
        FROM completed_works cw
        LEFT JOIN users u ON cw.created_by = u.id
        WHERE cw.status = 'active'
        ORDER BY cw.created_at DESC
      `;
      return result as CompletedWork[];
    } catch (error) {
      console.error('Error listing completed works:', error);
      return [];
    }
  }

  async getCompletedWork(id: number): Promise<CompletedWork | undefined> {
    try {
      const result = await this.sql`
        SELECT cw.*, u.name as creator_name
        FROM completed_works cw
        LEFT JOIN users u ON cw.created_by = u.id
        WHERE cw.id = ${id}
      `;
      return result[0] as CompletedWork | undefined;
    } catch (error) {
      console.error('Error getting completed work:', error);
      return undefined;
    }
  }

  async updateCompletedWork(id: number, updates: Partial<CompletedWork>): Promise<CompletedWork | undefined> {
    try {
      const setParts = [];
      if (updates.title !== undefined) setParts.push(`title = '${updates.title}'`);
      if (updates.description !== undefined) setParts.push(`description = '${updates.description}'`);
      if (updates.amount !== undefined) setParts.push(`amount = ${updates.amount}`);
      if (updates.date !== undefined) setParts.push(`date = '${updates.date}'`);
      if (updates.category !== undefined) setParts.push(`category = '${updates.category}'`);
      if (updates.fileUrl !== undefined) setParts.push(`file_url = '${updates.fileUrl}'`);
      if (updates.fileType !== undefined) setParts.push(`file_type = '${updates.fileType}'`);

      if (setParts.length === 0) return undefined;

      const updateQuery = `UPDATE completed_works SET ${setParts.join(', ')}, updated_at = NOW() WHERE id = $${setParts.length + 1} RETURNING *`;
      const result = await this.sql(updateQuery, [...setParts.map(() => null), id]);
      
      return result[0] as CompletedWork | undefined;
    } catch (error) {
      console.error('Error updating completed work:', error);
      return undefined;
    }
  }

  async deleteCompletedWork(id: number): Promise<boolean> {
    try {
      console.log(`Starting delete process for completed work ${id}`);
      
      // التحقق من وجود العمل المنجز أولاً
      const existing = await this.sql`SELECT id FROM completed_works WHERE id = ${id}`;
      if (existing.length === 0) {
        console.log(`Completed work ${id} not found`);
        return false;
      }
      
      // حذف العمل المنجز
      const result = await this.sql`DELETE FROM completed_works WHERE id = ${id} RETURNING id`;
      console.log(`Delete completed work result:`, result);
      
      const success = result.length > 0;
      console.log(`Completed work ${id} deletion ${success ? 'successful' : 'failed'}`);
      return success;
    } catch (error) {
      console.error('Error deleting completed work:', error);
      return false;
    }
  }

  async archiveCompletedWork(id: number): Promise<boolean> {
    try {
      const result = await this.sql`
        UPDATE completed_works 
        SET status = 'archived', updated_at = NOW()
        WHERE id = ${id}
      `;
      return result.length > 0;
    } catch (error) {
      console.error('Error archiving completed work:', error);
      return false;
    }
  }

  // Completed Works Documents - Independent document management
  async createCompletedWorksDocument(document: InsertCompletedWorksDocument): Promise<CompletedWorksDocument> {
    try {
      const result = await this.sql`
        INSERT INTO completed_works_documents (title, description, file_url, file_type, file_size, category, tags, created_by)
        VALUES (${document.title}, ${document.description || null}, ${document.fileUrl}, ${document.fileType}, ${document.fileSize || null}, ${document.category || null}, ${document.tags || null}, ${1})
        RETURNING *
      `;
      return result[0] as CompletedWorksDocument;
    } catch (error) {
      console.error('Error creating completed works document:', error);
      throw error;
    }
  }

  async listCompletedWorksDocuments(): Promise<CompletedWorksDocument[]> {
    try {
      const result = await this.sql`
        SELECT cwd.*, u.name as creator_name
        FROM completed_works_documents cwd
        LEFT JOIN users u ON cwd.created_by = u.id
        ORDER BY cwd.created_at DESC
      `;
      return result as CompletedWorksDocument[];
    } catch (error) {
      console.error('Error listing completed works documents:', error);
      return [];
    }
  }

  async getCompletedWorksDocument(id: number): Promise<CompletedWorksDocument | undefined> {
    try {
      const result = await this.sql`
        SELECT cwd.*, u.name as creator_name
        FROM completed_works_documents cwd
        LEFT JOIN users u ON cwd.created_by = u.id
        WHERE cwd.id = ${id}
      `;
      return result[0] as CompletedWorksDocument | undefined;
    } catch (error) {
      console.error('Error getting completed works document:', error);
      return undefined;
    }
  }

  async updateCompletedWorksDocument(id: number, updates: Partial<CompletedWorksDocument>): Promise<CompletedWorksDocument | undefined> {
    try {
      const setParts = [];
      if (updates.title !== undefined) setParts.push(`title = '${updates.title}'`);
      if (updates.description !== undefined) setParts.push(`description = '${updates.description}'`);
      if (updates.category !== undefined) setParts.push(`category = '${updates.category}'`);
      if (updates.tags !== undefined) setParts.push(`tags = '${updates.tags}'`);

      if (setParts.length === 0) return undefined;

      const updateQuery = `UPDATE completed_works_documents SET ${setParts.join(', ')}, updated_at = NOW() WHERE id = $${setParts.length + 1} RETURNING *`;
      const result = await this.sql(updateQuery, [...setParts.map(() => null), id]);
      
      return result[0] as CompletedWorksDocument | undefined;
    } catch (error) {
      console.error('Error updating completed works document:', error);
      return undefined;
    }
  }

  async deleteCompletedWorksDocument(id: number): Promise<boolean> {
    try {
      const result = await this.sql`DELETE FROM completed_works_documents WHERE id = ${id}`;
      return result.length > 0;
    } catch (error) {
      console.error('Error deleting completed works document:', error);
      return false;
    }
  }

  // Transaction Edit Permissions - إدارة صلاحيات تعديل المعاملات
  async grantTransactionEditPermission(permission: InsertTransactionEditPermission): Promise<TransactionEditPermission> {
    try {
      // التحقق من وجود صلاحية نشطة مسبقاً
      if (permission.userId) {
        const existingPermissions = await this.sql`
          SELECT * FROM transaction_edit_permissions 
          WHERE user_id = ${permission.userId} AND is_active = true
        `;
        if (existingPermissions.length > 0) {
          throw new Error('يوجد صلاحية نشطة مسبقاً لهذا المستخدم');
        }
      }

      if (permission.projectId) {
        const existingPermissions = await this.sql`
          SELECT * FROM transaction_edit_permissions 
          WHERE project_id = ${permission.projectId} AND is_active = true
        `;
        if (existingPermissions.length > 0) {
          throw new Error('يوجد صلاحية نشطة مسبقاً لهذا المشروع');
        }
      }

      // حساب تاريخ انتهاء الصلاحية (42 ساعة من الآن)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 42);

      const result = await this.sql`
        INSERT INTO transaction_edit_permissions 
        (user_id, project_id, granted_by, expires_at, reason, notes)
        VALUES (${permission.userId || null}, ${permission.projectId || null}, 
                ${permission.grantedBy}, ${expiresAt}, ${permission.reason || null}, 
                ${permission.notes || null})
        RETURNING *
      `;
      
      return result[0] as TransactionEditPermission;
    } catch (error) {
      console.error('Error granting transaction edit permission:', error);
      throw error;
    }
  }

  async revokeTransactionEditPermission(id: number, revokedBy: number): Promise<boolean> {
    try {
      const result = await this.sql`
        UPDATE transaction_edit_permissions 
        SET is_active = false, revoked_at = NOW(), revoked_by = ${revokedBy}
        WHERE id = ${id} AND is_active = true
        RETURNING *
      `;
      return result.length > 0;
    } catch (error) {
      console.error('Error revoking transaction edit permission:', error);
      return false;
    }
  }

  async checkTransactionEditPermission(userId: number, projectId?: number): Promise<TransactionEditPermission | undefined> {
    try {
      // التحقق من صلاحية المستخدم المباشرة
      const userPermission = await this.sql`
        SELECT * FROM transaction_edit_permissions 
        WHERE user_id = ${userId} AND is_active = true AND expires_at > NOW()
        LIMIT 1
      `;

      if (userPermission.length > 0) {
        return userPermission[0] as TransactionEditPermission;
      }

      // التحقق من صلاحية المشروع إذا تم توفير معرف المشروع
      if (projectId) {
        const projectPermission = await this.sql`
          SELECT * FROM transaction_edit_permissions 
          WHERE project_id = ${projectId} AND is_active = true AND expires_at > NOW()
          LIMIT 1
        `;

        if (projectPermission.length > 0) {
          return projectPermission[0] as TransactionEditPermission;
        }
      }

      return undefined;
    } catch (error) {
      console.error('Error checking transaction edit permission:', error);
      return undefined;
    }
  }

  async listActiveTransactionEditPermissions(): Promise<TransactionEditPermission[]> {
    try {
      const result = await this.sql`
        SELECT tep.*, u.name as granted_by_name, 
               pu.name as user_name, p.name as project_name
        FROM transaction_edit_permissions tep
        LEFT JOIN users u ON tep.granted_by = u.id
        LEFT JOIN users pu ON tep.user_id = pu.id
        LEFT JOIN projects p ON tep.project_id = p.id
        WHERE tep.is_active = true AND tep.expires_at > NOW()
        ORDER BY tep.granted_at DESC
      `;
      return result as TransactionEditPermission[];
    } catch (error) {
      console.error('Error listing active transaction edit permissions:', error);
      return [];
    }
  }

  async expireTransactionEditPermissions(): Promise<number> {
    try {
      const result = await this.sql`
        UPDATE transaction_edit_permissions 
        SET is_active = false 
        WHERE is_active = true AND expires_at <= NOW()
      `;
      return result.count;
    } catch (error) {
      console.error('Error expiring transaction edit permissions:', error);
      return 0;
    }
  }

  async getTransactionEditPermissionsByUser(userId: number): Promise<TransactionEditPermission[]> {
    try {
      const result = await this.sql`
        SELECT tep.*, u.name as granted_by_name
        FROM transaction_edit_permissions tep
        LEFT JOIN users u ON tep.granted_by = u.id
        WHERE tep.user_id = ${userId}
        ORDER BY tep.granted_at DESC
      `;
      return result as TransactionEditPermission[];
    } catch (error) {
      console.error('Error getting transaction edit permissions by user:', error);
      return [];
    }
  }

  async getTransactionEditPermissionsByProject(projectId: number): Promise<TransactionEditPermission[]> {
    try {
      const result = await this.sql`
        SELECT tep.*, u.name as granted_by_name
        FROM transaction_edit_permissions tep
        LEFT JOIN users u ON tep.granted_by = u.id
        WHERE tep.project_id = ${projectId}
        ORDER BY tep.granted_at DESC
      `;
      return result as TransactionEditPermission[];
    } catch (error) {
      console.error('Error getting transaction edit permissions by project:', error);
      return [];
    }
  }
}

export const pgStorage = new PgStorage();