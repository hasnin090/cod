
import { createClient, SupabaseClient } from '@supabase/supabase-js';
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
  completedWorksDocuments, type CompletedWorksDocument, type InsertCompletedWorksDocument,
  transactionEditPermissions, type TransactionEditPermission, type InsertTransactionEditPermission
} from '../shared/schema';
import { IStorage, type GrantTransactionEditPermissionInput } from './storage';
import { getSupabaseClient } from './supabase-storage';

export class SupabaseStorage {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL or Service Role Key not configured');
    }
    
    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  private checkConnection() {
    if (!this.supabase) {
      throw new Error('Supabase client is not initialized');
    }
  }

  // Helpers to map snake_case (DB) -> camelCase (API)
  private mapTransaction(row: any): Transaction {
    return {
      id: row.id,
      date: row.date,
      type: row.type,
      amount: row.amount,
      description: row.description,
      projectId: row.project_id ?? row.projectId ?? null,
      createdBy: row.created_by ?? row.createdBy,
      expenseType: row.expense_type ?? row.expenseType ?? null,
      employeeId: row.employee_id ?? row.employeeId ?? null,
      fileUrl: row.file_url ?? row.fileUrl ?? null,
      fileType: row.file_type ?? row.fileType ?? null,
      archived: row.archived ?? false,
    } as Transaction;
  }

  private mapExpenseType(row: any): ExpenseType {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? null,
      projectId: row.project_id ?? row.projectId ?? null,
      isActive: (row.is_active ?? row.isActive ?? true) as boolean,
      // timestamps omitted
    } as ExpenseType;
  }

  private mapEmployee(row: any): Employee {
    return {
      id: row.id,
      name: row.name,
      salary: row.salary ?? 0,
      currentBalance: row.current_balance ?? row.currentBalance ?? 0,
      totalPaid: row.total_paid ?? row.totalPaid ?? 0,
      lastSalaryReset: row.last_salary_reset ?? row.lastSalaryReset ?? null,
      assignedProjectId: row.assigned_project_id ?? row.assignedProjectId ?? null,
      assignedProject: undefined as any,
      active: row.active ?? true,
      hireDate: row.hire_date ?? row.hireDate ?? null,
      notes: row.notes ?? null,
      createdBy: row.created_by ?? row.createdBy,
      createdAt: row.created_at ?? row.createdAt ?? null,
      updatedAt: row.updated_at ?? row.updatedAt ?? null,
    } as unknown as Employee;
  }

  // Users
  async getUser(id: number): Promise<User | undefined> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // No rows returned
          return undefined;
        }
        console.error('SupabaseStorage: Error getting user:', error);
        return undefined;
      }
      return data as User;
    } catch (error) {
      console.error('SupabaseStorage: Exception getting user:', error);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // No rows returned
          return undefined;
        }
        console.error('SupabaseStorage: Error getting user by username:', error);
        return undefined;
      }
      return data as User;
    } catch (error) {
      console.error('SupabaseStorage: Exception getting user by username:', error);
      return undefined;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // No rows returned
          return undefined;
        }
        console.error('SupabaseStorage: Error getting user by email:', error);
        return undefined;
      }
      return data as User;
    } catch (error) {
      console.error('SupabaseStorage: Exception getting user by email:', error);
      return undefined;
    }
  }

  async createUser(user: InsertUser): Promise<User> {
    this.checkConnection();
    try {
      // Hash password before storing
      if (user.password) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }

      const { data, error } = await this.supabase
        .from('users')
        .insert([user])
        .select()
        .single();

      if (error) {
        console.error('SupabaseStorage: Error creating user:', error);
        throw new Error(`Failed to create user: ${error.message}`);
      }
      return data as User;
    } catch (error) {
      console.error('SupabaseStorage: Exception creating user:', error);
      throw error;
    }
  }

  async updateUser(id: number, user: Partial<User>): Promise<User | undefined> {
    this.checkConnection();
    try {
      // Hash password if provided
      if (user.password) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }

      const { data, error } = await this.supabase
        .from('users')
        .update(user)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('SupabaseStorage: Error updating user:', error);
        return undefined;
      }
      return data as User;
    } catch (error) {
      console.error('SupabaseStorage: Exception updating user:', error);
      return undefined;
    }
  }

  async listUsers(): Promise<User[]> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*');

      if (error) {
        console.error('SupabaseStorage: Error listing users:', error);
        return [];
      }
      return data as User[];
    } catch (error) {
      console.error('SupabaseStorage: Exception listing users:', error);
      return [];
    }
  }

  async deleteUser(id: number): Promise<boolean> {
    this.checkConnection();
    try {
      const { error } = await this.supabase
        .from('users')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('SupabaseStorage: Error deleting user:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('SupabaseStorage: Exception deleting user:', error);
      return false;
    }
  }

  async validatePassword(storedPassword: string, inputPassword: string): Promise<boolean> {
    this.checkConnection();
    try {
      return await bcrypt.compare(inputPassword, storedPassword);
    } catch (error) {
      console.error('SupabaseStorage: Exception validating password:', error);
      return false;
    }
  }

  // Projects
  async getProject(id: number): Promise<Project | undefined> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // No rows returned
          return undefined;
        }
        console.error('SupabaseStorage: Error getting project:', error);
        return undefined;
      }
      return data as Project;
    } catch (error) {
      console.error('SupabaseStorage: Exception getting project:', error);
      return undefined;
    }
  }

  async createProject(project: InsertProject): Promise<Project> {
    this.checkConnection();
    try {
      const payload: any = {
        name: (project as any).name,
        description: (project as any).description,
        start_date: ((project as any).startDate instanceof Date) ? ((project as any).startDate as Date).toISOString() : (project as any).startDate,
        budget: (project as any).budget ?? 0,
        spent: (project as any).spent ?? 0,
        status: (project as any).status ?? 'active',
        progress: (project as any).progress ?? 0,
        created_by: (project as any).createdBy,
      };
      const { data, error } = await this.supabase
        .from('projects')
        .insert([payload])
        .select()
        .single();

      if (error) {
        console.error('SupabaseStorage: Error creating project:', error);
        throw new Error(`Failed to create project: ${error.message}`);
      }
      return data as Project;
    } catch (error) {
      console.error('SupabaseStorage: Exception creating project:', error);
      throw error;
    }
  }

  async updateProject(id: number, project: Partial<Project>): Promise<Project | undefined> {
    this.checkConnection();
    try {
      const updates: Record<string, any> = {};
      if ((project as any).name !== undefined) updates.name = (project as any).name;
      if ((project as any).description !== undefined) updates.description = (project as any).description;
      if ((project as any).startDate !== undefined) updates.start_date = ((project as any).startDate instanceof Date) ? ((project as any).startDate as Date).toISOString() : (project as any).startDate;
      if ((project as any).budget !== undefined) updates.budget = (project as any).budget;
      if ((project as any).spent !== undefined) updates.spent = (project as any).spent;
      if ((project as any).status !== undefined) updates.status = (project as any).status;
      if ((project as any).progress !== undefined) updates.progress = (project as any).progress;
      if ((project as any).createdBy !== undefined) updates.created_by = (project as any).createdBy;

      const { data, error } = await this.supabase
        .from('projects')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('SupabaseStorage: Error updating project:', error);
        return undefined;
      }
      return data as Project;
    } catch (error) {
      console.error('SupabaseStorage: Exception updating project:', error);
      return undefined;
    }
  }

  async listProjects(): Promise<Project[]> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('projects')
        .select('*');

      if (error) {
        console.error('SupabaseStorage: Error listing projects:', error);
        return [];
      }
      return data as Project[];
    } catch (error) {
      console.error('SupabaseStorage: Exception listing projects:', error);
      return [];
    }
  }

  async deleteProject(id: number): Promise<boolean> {
    this.checkConnection();
    try {
      const { error } = await this.supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('SupabaseStorage: Error deleting project:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('SupabaseStorage: Exception deleting project:', error);
      return false;
    }
  }

  // Transactions
  async getTransaction(id: number): Promise<Transaction | undefined> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('transactions')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // No rows returned
          return undefined;
        }
        console.error('SupabaseStorage: Error getting transaction:', error);
        return undefined;
      }
      return data as Transaction;
    } catch (error) {
      console.error('SupabaseStorage: Exception getting transaction:', error);
      return undefined;
    }
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    this.checkConnection();
    try {
      // Map camelCase -> snake_case for DB insert
      const payload: any = {
        date: (transaction.date as any) instanceof Date ? (transaction.date as any as Date).toISOString() : (transaction as any).date,
        amount: (transaction as any).amount,
        type: (transaction as any).type,
        expense_type: (transaction as any).expenseType ?? null,
        description: (transaction as any).description,
        project_id: (transaction as any).projectId ?? null,
        created_by: (transaction as any).createdBy,
        employee_id: (transaction as any).employeeId ?? null,
        file_url: (transaction as any).fileUrl ?? null,
        file_type: (transaction as any).fileType ?? null,
        archived: (transaction as any).archived ?? false,
      };

      const { data, error } = await this.supabase
        .from('transactions')
        .insert([payload])
        .select()
        .single();

      if (error) {
        console.error('SupabaseStorage: Error creating transaction:', error);
        throw new Error(`Failed to create transaction: ${error.message}`);
      }
      return data as Transaction;
    } catch (error) {
      console.error('SupabaseStorage: Exception creating transaction:', error);
      throw error;
    }
  }

  async updateTransaction(id: number, transaction: Partial<Transaction>): Promise<Transaction | undefined> {
    this.checkConnection();
    try {
      // Map camelCase -> snake_case for DB update, include only provided fields
      const updates: Record<string, any> = {};
      if (transaction.date !== undefined) updates.date = (transaction.date as any) instanceof Date ? (transaction.date as any as Date).toISOString() : (transaction as any).date;
      if (transaction.amount !== undefined) updates.amount = transaction.amount;
      if (transaction.type !== undefined) updates.type = transaction.type as any;
      if ((transaction as any).expenseType !== undefined) updates.expense_type = (transaction as any).expenseType;
      if (transaction.description !== undefined) updates.description = transaction.description;
      if ((transaction as any).projectId !== undefined) updates.project_id = (transaction as any).projectId;
      if ((transaction as any).createdBy !== undefined) updates.created_by = (transaction as any).createdBy;
      if ((transaction as any).employeeId !== undefined) updates.employee_id = (transaction as any).employeeId;
      if ((transaction as any).fileUrl !== undefined) updates.file_url = (transaction as any).fileUrl;
      if ((transaction as any).fileType !== undefined) updates.file_type = (transaction as any).fileType;
      if (transaction.archived !== undefined) updates.archived = transaction.archived;

      const { data, error } = await this.supabase
        .from('transactions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('SupabaseStorage: Error updating transaction:', error);
        return undefined;
      }
      return data as Transaction;
    } catch (error) {
      console.error('SupabaseStorage: Exception updating transaction:', error);
      return undefined;
    }
  }

  async listTransactions(): Promise<Transaction[]> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('transactions')
        .select('*');

      if (error) {
        console.error('SupabaseStorage: Error listing transactions:', error);
        return [];
      }
      return (data || []).map(row => this.mapTransaction(row));
    } catch (error) {
      console.error('SupabaseStorage: Exception listing transactions:', error);
      return [];
    }
  }

  async getTransactionsByProject(projectId: number): Promise<Transaction[]> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('transactions')
        .select('*')
        .eq('project_id', projectId);

      if (error) {
        console.error('SupabaseStorage: Error getting transactions by project:', error);
        return [];
      }
      return (data || []).map(row => this.mapTransaction(row));
    } catch (error) {
      console.error('SupabaseStorage: Exception getting transactions by project:', error);
      return [];
    }
  }

  async getTransactionsForUserProjects(userId: number): Promise<Transaction[]> {
    this.checkConnection();
    try {
      const user = await this.getUser(userId);
      if (user?.role === 'admin') return this.listTransactions();

      const { data: upRows, error: upErr } = await this.supabase
        .from('user_projects')
        .select('project_id')
        .eq('user_id', userId);
      if (upErr) {
        console.error('SupabaseStorage: Error getting user projects for transactions:', upErr);
        return [];
      }
      if (!upRows || upRows.length === 0) return [];
      const ids = upRows.map((r: any) => r.project_id);
      const { data, error } = await this.supabase
        .from('transactions')
        .select('*')
        .in('project_id', ids);
      if (error) {
        console.error('SupabaseStorage: Error getting transactions for user projects:', error);
        return [];
      }
      return (data || []).map(row => this.mapTransaction(row));
    } catch (error) {
      console.error('SupabaseStorage: Exception getting transactions for user projects:', error);
      return [];
    }
  }

  async canUserAccessTransaction(userId: number, transactionId: number): Promise<boolean> {
    this.checkConnection();
    try {
      const user = await this.getUser(userId);
      if (user?.role === 'admin') return true;
      const tx = await this.getTransaction(transactionId);
      if (!tx || !tx.projectId) return false;
      return this.checkUserProjectAccess(userId, tx.projectId);
    } catch (error) {
      console.error('SupabaseStorage: Exception checking transaction access:', error);
      return false;
    }
  }

  async deleteTransaction(id: number): Promise<boolean> {
    this.checkConnection();
    try {
      const { error } = await this.supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('SupabaseStorage: Error deleting transaction:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('SupabaseStorage: Exception deleting transaction:', error);
      return false;
    }
  }

  // Documents
  async getDocument(id: number): Promise<Document | undefined> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('documents')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // No rows returned
          return undefined;
        }
        console.error('SupabaseStorage: Error getting document:', error);
        return undefined;
      }
      return data as Document;
    } catch (error) {
      console.error('SupabaseStorage: Exception getting document:', error);
      return undefined;
    }
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('documents')
        .insert([document])
        .select()
        .single();

      if (error) {
        console.error('SupabaseStorage: Error creating document:', error);
        throw new Error(`Failed to create document: ${error.message}`);
      }
      return data as Document;
    } catch (error) {
      console.error('SupabaseStorage: Exception creating document:', error);
      throw error;
    }
  }

  async getDocumentsByProject(projectId: number): Promise<Document[]> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('documents')
        .select('*')
        .eq('project_id', projectId);

      if (error) {
        console.error('SupabaseStorage: Error getting documents by project:', error);
        return [];
      }
      return data as Document[];
    } catch (error) {
      console.error('SupabaseStorage: Exception getting documents by project:', error);
      return [];
    }
  }

  async updateDocument(id: number, document: Partial<Document>): Promise<Document | undefined> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('documents')
        .update(document)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('SupabaseStorage: Error updating document:', error);
        return undefined;
      }
      return data as Document;
    } catch (error) {
      console.error('SupabaseStorage: Exception updating document:', error);
      return undefined;
    }
  }

  async listDocuments(): Promise<Document[]> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('documents')
        .select('*');

      if (error) {
        console.error('SupabaseStorage: Error listing documents:', error);
        return [];
      }
      return data as Document[];
    } catch (error) {
      console.error('SupabaseStorage: Exception listing documents:', error);
      return [];
    }
  }

  async deleteDocument(id: number): Promise<boolean> {
    this.checkConnection();
    try {
      const { error } = await this.supabase
        .from('documents')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('SupabaseStorage: Error deleting document:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('SupabaseStorage: Exception deleting document:', error);
      return false;
    }
  }

  // Activity Logs
  async createActivityLog(activityLog: InsertActivityLog): Promise<ActivityLog> {
    this.checkConnection();
    try {
      const payload: any = {
        action: (activityLog as any).action,
        entity_type: (activityLog as any).entityType,
        entity_id: (activityLog as any).entityId,
        details: (activityLog as any).details,
        user_id: (activityLog as any).userId,
        // timestamp defaults in DB
      };
      const { data, error } = await this.supabase
        .from('activity_logs')
        .insert([payload])
        .select()
        .single();

      if (error) {
        console.error('SupabaseStorage: Error creating activity log:', error);
        throw new Error(`Failed to create activity log: ${error.message}`);
      }
      return data as ActivityLog;
    } catch (error) {
      console.error('SupabaseStorage: Exception creating activity log:', error);
      throw error;
    }
  }

  async listActivityLogs(): Promise<ActivityLog[]> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('activity_logs')
        .select('*');

      if (error) {
        console.error('SupabaseStorage: Error listing activity logs:', error);
        return [];
      }
      return data as ActivityLog[];
    } catch (error) {
      console.error('SupabaseStorage: Exception listing activity logs:', error);
      return [];
    }
  }

  // Settings
  async getSetting(key: string): Promise<Setting | undefined> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('settings')
        .select('*')
        .eq('key', key)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // No rows returned
          return undefined;
        }
        console.error('SupabaseStorage: Error getting setting:', error);
        return undefined;
      }
      return data as Setting;
    } catch (error) {
      console.error('SupabaseStorage: Exception getting setting:', error);
      return undefined;
    }
  }

  async createSetting(setting: InsertSetting): Promise<Setting> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('settings')
        .insert([setting])
        .select()
        .single();

      if (error) {
        console.error('SupabaseStorage: Error creating setting:', error);
        throw new Error(`Failed to create setting: ${error.message}`);
      }
      return data as Setting;
    } catch (error) {
      console.error('SupabaseStorage: Exception creating setting:', error);
      throw error;
    }
  }

  async updateSetting(key: string, value: string): Promise<Setting | undefined> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('settings')
        .update({ value })
        .eq('key', key)
        .select()
        .single();

      if (error) {
        if ((error as any).code === 'PGRST116') {
          return undefined;
        }
        console.error('SupabaseStorage: Error updating setting:', error);
        return undefined;
      }
      return data as Setting;
    } catch (error) {
      console.error('SupabaseStorage: Exception updating setting:', error);
      return undefined;
    }
  }

  async listSettings(): Promise<Setting[]> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('settings')
        .select('*');

      if (error) {
        console.error('SupabaseStorage: Error listing settings:', error);
        return [];
      }
      return data as Setting[];
    } catch (error) {
      console.error('SupabaseStorage: Exception listing settings:', error);
      return [];
    }
  }

  // Database health check
  async checkTableExists(tableName: string): Promise<boolean> {
    this.checkConnection();
    try {
      const { count, error } = await this.supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.error(`SupabaseStorage: Error checking table ${tableName}:`, error);
        return false;
      }
      return count !== null && count >= 0;
    } catch (error) {
      console.error(`SupabaseStorage: Exception checking table ${tableName}:`, error);
      return false;
    }
  }

  // User Projects
  async getUserProjects(userId: number): Promise<Project[]> {
    this.checkConnection();
    try {
      const { data: upRows, error: upErr } = await this.supabase
        .from('user_projects')
        .select('project_id')
        .eq('user_id', userId);

      if (upErr) {
        console.error('SupabaseStorage: Error getting user_projects:', upErr);
        return [];
      }
      if (!upRows || upRows.length === 0) return [];

      const ids = upRows.map((r: any) => r.project_id);
      const { data: projects, error } = await this.supabase
        .from('projects')
        .select('*')
        .in('id', ids);

      if (error) {
        console.error('SupabaseStorage: Error getting projects for user:', error);
        return [];
      }
      return projects as Project[];
    } catch (error) {
      console.error('SupabaseStorage: Exception getting user projects:', error);
      return [];
    }
  }

  async createUserProject(userProject: InsertUserProject): Promise<UserProject> {
    this.checkConnection();
    try {
      const payload = {
        user_id: (userProject as any).userId,
        project_id: (userProject as any).projectId,
        assigned_by: (userProject as any).assignedBy ?? 1,
        assigned_at: (userProject as any).assignedAt ?? new Date().toISOString(),
      };
      const { data, error } = await this.supabase
        .from('user_projects')
        .insert([payload])
        .select()
        .single();

      if (error) {
        console.error('SupabaseStorage: Error creating user project:', error);
        throw new Error(`Failed to create user project: ${error.message}`);
      }
      return data as UserProject;
    } catch (error) {
      console.error('SupabaseStorage: Exception creating user project:', error);
      throw error;
    }
  }

  async deleteUserProject(userId: number, projectId: number): Promise<boolean> {
    this.checkConnection();
    try {
      const { error } = await this.supabase
        .from('user_projects')
        .delete()
        .eq('user_id', userId)
        .eq('project_id', projectId);

      if (error) {
        console.error('SupabaseStorage: Error deleting user project:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('SupabaseStorage: Exception deleting user project:', error);
      return false;
    }
  }

  // IStorage aliases and helpers for user-projects
  async assignUserToProject(userProject: InsertUserProject): Promise<UserProject> {
    return this.createUserProject(userProject);
  }

  async removeUserFromProject(userId: number, projectId: number): Promise<boolean> {
    return this.deleteUserProject(userId, projectId);
  }

  async getProjectUsers(projectId: number): Promise<User[]> {
    this.checkConnection();
    try {
      const { data: upRows, error: upErr } = await this.supabase
        .from('user_projects')
        .select('user_id')
        .eq('project_id', projectId);
      if (upErr) {
        console.error('SupabaseStorage: Error getting user_projects by project:', upErr);
        return [];
      }
      if (!upRows || upRows.length === 0) return [];
      const ids = upRows.map((r: any) => r.user_id);
      const { data: users, error } = await this.supabase
        .from('users')
        .select('*')
        .in('id', ids);
      if (error) {
        console.error('SupabaseStorage: Error getting users for project:', error);
        return [];
      }
      return users as User[];
    } catch (error) {
      console.error('SupabaseStorage: Exception getting project users:', error);
      return [];
    }
  }

  async checkUserProjectAccess(userId: number, projectId: number): Promise<boolean> {
    this.checkConnection();
    try {
      const user = await this.getUser(userId);
      if (user?.role === 'admin') return true;
      const { count, error } = await this.supabase
        .from('user_projects')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('project_id', projectId);
      if (error) {
        console.error('SupabaseStorage: Error checking user project access:', error);
        return false;
      }
      return !!(count && count > 0);
    } catch (error) {
      console.error('SupabaseStorage: Exception checking user project access:', error);
      return false;
    }
  }

  // Funds
  async getFunds(): Promise<Fund[]> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('funds')
        .select('*');

      if (error) {
        console.error('SupabaseStorage: Error getting funds:', error);
        return [];
      }
      return data as Fund[];
    } catch (error) {
      console.error('SupabaseStorage: Exception getting funds:', error);
      return [];
    }
  }

  async createFund(fund: InsertFund): Promise<Fund> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('funds')
        .insert([fund])
        .select()
        .single();

      if (error) {
        console.error('SupabaseStorage: Error creating fund:', error);
        throw new Error(`Failed to create fund: ${error.message}`);
      }
      return data as Fund;
    } catch (error) {
      console.error('SupabaseStorage: Exception creating fund:', error);
      throw error;
    }
  }

  async updateFund(id: number, fund: Partial<Fund>): Promise<Fund | undefined> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('funds')
        .update(fund)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('SupabaseStorage: Error updating fund:', error);
        return undefined;
      }
      return data as Fund;
    } catch (error) {
      console.error('SupabaseStorage: Exception updating fund:', error);
      return undefined;
    }
  }

  // Expense Types
  async createExpenseType(expenseType: InsertExpenseType): Promise<ExpenseType> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('expense_types')
        .insert([expenseType])
        .select()
        .single();

      if (error) {
        console.error('SupabaseStorage: Error creating expense type:', error);
        throw new Error(`Failed to create expense type: ${error.message}`);
      }
      return data as ExpenseType;
    } catch (error) {
      console.error('SupabaseStorage: Exception creating expense type:', error);
      throw error;
    }
  }

  async getExpenseType(id: number): Promise<ExpenseType | undefined> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('expense_types')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // No rows returned
          return undefined;
        }
        console.error('SupabaseStorage: Error getting expense type:', error);
        return undefined;
      }
      return data as ExpenseType;
    } catch (error) {
      console.error('SupabaseStorage: Exception getting expense type:', error);
      return undefined;
    }
  }

  async getExpenseTypeByName(name: string): Promise<ExpenseType | undefined> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('expense_types')
        .select('*')
        .eq('name', name)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // No rows returned
          return undefined;
        }
        console.error('SupabaseStorage: Error getting expense type by name:', error);
        return undefined;
      }
      return data as ExpenseType;
    } catch (error) {
      console.error('SupabaseStorage: Exception getting expense type by name:', error);
      return undefined;
    }
  }

  async updateExpenseType(id: number, expenseType: Partial<ExpenseType>): Promise<ExpenseType | undefined> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('expense_types')
        .update(expenseType)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('SupabaseStorage: Error updating expense type:', error);
        return undefined;
      }
      return data as ExpenseType;
    } catch (error) {
      console.error('SupabaseStorage: Exception updating expense type:', error);
      return undefined;
    }
  }

  async listExpenseTypes(projectId?: number): Promise<ExpenseType[]> {
    this.checkConnection();
    try {
      let query = this.supabase.from('expense_types').select('*');
      
      if (projectId !== undefined) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('SupabaseStorage: Error listing expense types:', error);
        return [];
      }
      return data as ExpenseType[];
    } catch (error) {
      console.error('SupabaseStorage: Exception listing expense types:', error);
      return [];
    }
  }

  async listExpenseTypesForUser(userId: number): Promise<ExpenseType[]> {
    this.checkConnection();
    try {
      // Get projects for the user, then get expense types for those projects
      const { data: userProjects, error: userError } = await this.supabase
        .from('user_projects')
        .select('project_id')
        .eq('user_id', userId);

      if (userError) {
        console.error('SupabaseStorage: Error getting user projects:', userError);
        return [];
      }

      if (!userProjects || userProjects.length === 0) {
        return [];
      }

      const projectIds = userProjects.map(up => up.project_id);
      
      const { data, error } = await this.supabase
        .from('expense_types')
        .select('*')
        .in('project_id', projectIds);

      if (error) {
        console.error('SupabaseStorage: Error listing expense types for user:', error);
        return [];
      }
      return data as ExpenseType[];
    } catch (error) {
      console.error('SupabaseStorage: Exception listing expense types for user:', error);
      return [];
    }
  }

  async deleteExpenseType(id: number): Promise<boolean> {
    this.checkConnection();
    try {
      const { error } = await this.supabase
        .from('expense_types')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('SupabaseStorage: Error deleting expense type:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('SupabaseStorage: Exception deleting expense type:', error);
      return false;
    }
  }

  // Ledger Entries
  async createLedgerEntry(ledgerEntry: InsertLedgerEntry): Promise<LedgerEntry> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('ledger_entries')
        .insert([ledgerEntry])
        .select()
        .single();

      if (error) {
        console.error('SupabaseStorage: Error creating ledger entry:', error);
        throw new Error(`Failed to create ledger entry: ${error.message}`);
      }
      return data as LedgerEntry;
    } catch (error) {
      console.error('SupabaseStorage: Exception creating ledger entry:', error);
      throw error;
    }
  }

  async listLedgerEntries(): Promise<LedgerEntry[]> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('ledger_entries')
        .select('*');

      if (error) {
        console.error('SupabaseStorage: Error listing ledger entries:', error);
        return [];
      }
      return data as LedgerEntry[];
    } catch (error) {
      console.error('SupabaseStorage: Exception listing ledger entries:', error);
      return [];
    }
  }

  // Account Categories
  async getAccountCategories(): Promise<AccountCategory[]> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('account_categories')
        .select('*');

      if (error) {
        console.error('SupabaseStorage: Error getting account categories:', error);
        return [];
      }
      return data as AccountCategory[];
    } catch (error) {
      console.error('SupabaseStorage: Exception getting account categories:', error);
      return [];
    }
  }

  async createAccountCategory(category: InsertAccountCategory): Promise<AccountCategory> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('account_categories')
        .insert([category])
        .select()
        .single();

      if (error) {
        console.error('SupabaseStorage: Error creating account category:', error);
        throw new Error(`Failed to create account category: ${error.message}`);
      }
      return data as AccountCategory;
    } catch (error) {
      console.error('SupabaseStorage: Exception creating account category:', error);
      throw error;
    }
  }

  // Deferred Payments
  async getDeferredPayments(): Promise<DeferredPayment[]> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('deferred_payments')
        .select('*');

      if (error) {
        console.error('SupabaseStorage: Error getting deferred payments:', error);
        return [];
      }
      return data as DeferredPayment[];
    } catch (error) {
      console.error('SupabaseStorage: Exception getting deferred payments:', error);
      return [];
    }
  }

  // IStorage expects listDeferredPayments (admin gets all)
  async listDeferredPayments(): Promise<DeferredPayment[]> {
    return this.getDeferredPayments();
  }

  async getDeferredPayment(id: number): Promise<DeferredPayment | undefined> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('deferred_payments')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if ((error as any).code === 'PGRST116') return undefined;
        console.error('SupabaseStorage: Error getting deferred payment:', error);
        return undefined;
      }
      return data as DeferredPayment;
    } catch (error) {
      console.error('SupabaseStorage: Exception getting deferred payment:', error);
      return undefined;
    }
  }

  async createDeferredPayment(payment: InsertDeferredPayment): Promise<DeferredPayment> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('deferred_payments')
        .insert([payment])
        .select()
        .single();

      if (error) {
        console.error('SupabaseStorage: Error creating deferred payment:', error);
        throw new Error(`Failed to create deferred payment: ${error.message}`);
      }
      return data as DeferredPayment;
    } catch (error) {
      console.error('SupabaseStorage: Exception creating deferred payment:', error);
      throw error;
    }
  }

  async updateDeferredPayment(id: number, payment: Partial<DeferredPayment>): Promise<DeferredPayment | undefined> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('deferred_payments')
        .update(payment)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('SupabaseStorage: Error updating deferred payment:', error);
        return undefined;
      }
      return data as DeferredPayment;
    } catch (error) {
      console.error('SupabaseStorage: Exception updating deferred payment:', error);
      return undefined;
    }
  }

  async deleteDeferredPayment(id: number): Promise<boolean> {
    this.checkConnection();
    try {
      const { error } = await this.supabase
        .from('deferred_payments')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('SupabaseStorage: Error deleting deferred payment:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('SupabaseStorage: Exception deleting deferred payment:', error);
      return false;
    }
  }

  async getDeferredPaymentsForUserProjects(userId: number): Promise<DeferredPayment[]> {
    this.checkConnection();
    try {
      // Admin can see all deferred payments
      const user = await this.getUser(userId);
      if (user?.role === 'admin') return this.listDeferredPayments();

      const { data: upRows, error: upErr } = await this.supabase
        .from('user_projects')
        .select('project_id')
        .eq('user_id', userId);
      if (upErr) {
        console.error('SupabaseStorage: Error querying user projects for deferred payments:', upErr);
        return [];
      }
      if (!upRows || upRows.length === 0) return [];
      const projectIds = (upRows as any[]).map(r => r.project_id);

      const { data, error } = await this.supabase
        .from('deferred_payments')
        .select('*')
        .in('project_id', projectIds);

      if (error) {
        console.error('SupabaseStorage: Error getting deferred payments for user projects:', error);
        return [];
      }
      return (data || []) as DeferredPayment[];
    } catch (error) {
      console.error('SupabaseStorage: Exception getting deferred payments for user projects:', error);
      return [];
    }
  }

  async payDeferredPaymentInstallment(id: number, amount: number, userId: number): Promise<{ payment: DeferredPayment; transaction?: Transaction }> {
    this.checkConnection();
    try {
      const payment = await this.getDeferredPayment(id);
      if (!payment) throw new Error('Deferred payment not found');

      const currentPaid = Number((payment as any).paidAmount ?? (payment as any).paid_amount ?? 0);
      const total = Number((payment as any).totalAmount ?? (payment as any).total_amount ?? 0);
      const payAmt = Number(amount);
      if (!payAmt || isNaN(payAmt) || payAmt <= 0) throw new Error('Invalid payment amount');

      const newPaidAmount = currentPaid + payAmt;
      const newRemainingAmount = total - newPaidAmount;
      const newStatus = newRemainingAmount <= 0 ? 'completed' : (currentPaid === 0 ? 'partial' : 'partial');

      const updated = await this.updateDeferredPayment(id, {
        paidAmount: newPaidAmount,
        remainingAmount: newRemainingAmount,
        status: newStatus,
      } as any);

      // Prepare expense type: try beneficiary name, else fallback to 'دفعات آجلة'
      let expenseTypeName: string | null = null;
      try {
        const beneficiaryName = (payment as any).beneficiaryName || (payment as any).beneficiary_name || null;
        if (beneficiaryName) {
          const { data: et, error: etErr } = await this.supabase
            .from('expense_types')
            .select('*')
            .eq('name', beneficiaryName)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();
          if (!etErr && et) expenseTypeName = (et as any).name;
        }
        if (!expenseTypeName) {
          const { data: fallback, error: fbErr } = await this.supabase
            .from('expense_types')
            .select('*')
            .eq('name', 'دفعات آجلة')
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();
          if (!fbErr && fallback) expenseTypeName = (fallback as any).name;
          if (!expenseTypeName) {
            const { data: created, error: cErr } = await this.supabase
              .from('expense_types')
              .insert([{ name: 'دفعات آجلة', description: 'المدفوعات للمستحقات والأقساط المؤجلة', is_active: true, created_by: userId }])
              .select()
              .single();
            if (!cErr && created) expenseTypeName = (created as any).name;
          }
        }
      } catch (etError) {
        console.warn('SupabaseStorage: Expense type resolution failed for deferred payment:', etError);
      }

      // Create linked expense transaction
      let transaction: Transaction | undefined;
      try {
        const beneficiary = (payment as any).beneficiaryName || (payment as any).beneficiary_name || 'غير محدد';
        const description = (payment as any).description
          ? `دفع قسط من: ${(payment as any).description} (${beneficiary})`
          : `دفع قسط للمستفيد: ${beneficiary}`;

        const insertTx: InsertTransaction = {
          date: new Date(),
          amount: payAmt,
          type: 'expense' as const,
          expenseType: expenseTypeName || null,
          description,
          projectId: (payment as any).projectId ?? (payment as any).project_id ?? null,
          createdBy: userId,
          employeeId: null,
          fileUrl: null,
          fileType: null,
          archived: false,
        } as any;

        const { data: tx, error: txErr } = await this.supabase
          .from('transactions')
          .insert([{
            date: (insertTx.date as Date).toISOString(),
            amount: insertTx.amount,
            type: insertTx.type,
            expense_type: insertTx.expenseType,
            description: insertTx.description,
            project_id: insertTx.projectId,
            created_by: insertTx.createdBy,
            employee_id: insertTx.employeeId,
            file_url: insertTx.fileUrl,
            file_type: insertTx.fileType,
            archived: insertTx.archived,
          }])
          .select()
          .single();
        if (!txErr && tx) transaction = this.mapTransaction(tx);
      } catch (txError) {
        console.warn('SupabaseStorage: Failed to create transaction for deferred payment installment:', txError);
      }

      return { payment: updated || (payment as DeferredPayment), transaction };
    } catch (error) {
      console.error('SupabaseStorage: Error paying deferred payment installment:', error);
      throw error;
    }
  }

  // Employees
  async getEmployees(): Promise<Employee[]> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('employees')
        .select('*');

      if (error) {
        console.error('SupabaseStorage: Error getting employees:', error);
        return [];
      }
      return data as Employee[];
    } catch (error) {
      console.error('SupabaseStorage: Exception getting employees:', error);
      return [];
    }
  }

  async createEmployee(employee: InsertEmployee, createdBy: number): Promise<Employee> {
    this.checkConnection();
    try {
      // Map to snake_case for Supabase / PostgREST
      const payload: any = {
        name: employee.name,
        salary: employee.salary ?? 0,
        current_balance: employee.currentBalance ?? 0,
        total_paid: employee.totalPaid ?? 0,
        last_salary_reset: employee.lastSalaryReset ?? null,
        assigned_project_id: employee.assignedProjectId ?? null,
        active: employee.active ?? true,
        hire_date: employee.hireDate ?? null,
        notes: employee.notes ?? null,
        created_by: createdBy,
      };

      const { data, error } = await this.supabase
        .from('employees')
        .insert([payload])
        .select()
        .single();

      if (error) {
        console.error('SupabaseStorage: Error creating employee:', error);
        throw new Error(`Failed to create employee: ${error.message}`);
      }
      return this.mapEmployee(data);
    } catch (error) {
      console.error('SupabaseStorage: Exception creating employee:', error);
      throw error;
    }
  }

  async updateEmployee(id: number, employee: Partial<InsertEmployee>): Promise<Employee> {
    this.checkConnection();
    try {
      // Only send columns that exist and map to snake_case
      const updates: any = {};
      if (employee.name !== undefined) updates.name = employee.name;
      if (employee.salary !== undefined) updates.salary = employee.salary as any;
      if (employee.currentBalance !== undefined) updates.current_balance = employee.currentBalance as any;
      if (employee.totalPaid !== undefined) updates.total_paid = employee.totalPaid as any;
      if (employee.lastSalaryReset !== undefined) updates.last_salary_reset = employee.lastSalaryReset as any;
      if (employee.assignedProjectId !== undefined) updates.assigned_project_id = employee.assignedProjectId as any;
      if (employee.active !== undefined) updates.active = employee.active as any;
      if (employee.hireDate !== undefined) updates.hire_date = employee.hireDate as any;
      if (employee.notes !== undefined) updates.notes = employee.notes as any;
      updates.updated_at = new Date().toISOString();

      const { data, error } = await this.supabase
        .from('employees')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('SupabaseStorage: Error updating employee:', error);
        throw error;
      }
      return this.mapEmployee(data);
    } catch (error) {
      console.error('SupabaseStorage: Exception updating employee:', error);
      throw error as any;
    }
  }

  async getEmployee(id: number): Promise<Employee | undefined> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('employees')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // No rows returned
          return undefined;
        }
        console.error('SupabaseStorage: Error getting employee:', error);
        return undefined;
      }
      return data as Employee;
    } catch (error) {
      console.error('SupabaseStorage: Exception getting employee:', error);
      return undefined;
    }
  }

  async deleteEmployee(id: number): Promise<boolean> {
    this.checkConnection();
    try {
      const { error } = await this.supabase
        .from('employees')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('SupabaseStorage: Error deleting employee:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('SupabaseStorage: Exception deleting employee:', error);
      return false;
    }
  }

  async getEmployeesByProject(projectId: number): Promise<Employee[]> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('employees')
        .select('*')
  .eq('assigned_project_id', projectId);

      if (error) {
        console.error('SupabaseStorage: Error getting employees by project:', error);
        return [];
      }
      return data as Employee[];
    } catch (error) {
      console.error('SupabaseStorage: Exception getting employees by project:', error);
      return [];
    }
  }

  async getActiveEmployees(): Promise<Employee[]> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('employees')
        .select('*')
        .eq('active', true);

      if (error) {
        console.error('SupabaseStorage: Error getting active employees:', error);
        return [];
      }
      return data as Employee[];
    } catch (error) {
      console.error('SupabaseStorage: Exception getting active employees:', error);
      return [];
    }
  }

  // Completed Works
  async getCompletedWorks(): Promise<CompletedWork[]> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('completed_works')
        .select('*');

      if (error) {
        console.error('SupabaseStorage: Error getting completed works:', error);
        return [];
      }
      return data as CompletedWork[];
    } catch (error) {
      console.error('SupabaseStorage: Exception getting completed works:', error);
      return [];
    }
  }

  async createCompletedWork(work: InsertCompletedWork): Promise<CompletedWork> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('completed_works')
        .insert([work])
        .select()
        .single();

      if (error) {
        console.error('SupabaseStorage: Error creating completed work:', error);
        throw new Error(`Failed to create completed work: ${error.message}`);
      }
      return data as CompletedWork;
    } catch (error) {
      console.error('SupabaseStorage: Exception creating completed work:', error);
      throw error;
    }
  }

  async updateCompletedWork(id: number, work: Partial<CompletedWork>): Promise<CompletedWork | undefined> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('completed_works')
        .update(work)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('SupabaseStorage: Error updating completed work:', error);
        return undefined;
      }
      return data as CompletedWork;
    } catch (error) {
      console.error('SupabaseStorage: Exception updating completed work:', error);
      return undefined;
    }
  }

  async deleteCompletedWork(id: number): Promise<boolean> {
    this.checkConnection();
    try {
      const { error } = await this.supabase
        .from('completed_works')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('SupabaseStorage: Error deleting completed work:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('SupabaseStorage: Exception deleting completed work:', error);
      return false;
    }
  }

  // Completed Works Documents
  async getCompletedWorksDocuments(workId: number): Promise<CompletedWorksDocument[]> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('completed_works_documents')
        .select('*')
        // If there is a foreign key, the correct column is likely completed_work_id
        .eq('completed_work_id', workId);

      if (error) {
        console.error('SupabaseStorage: Error getting completed works documents:', error);
        return [];
      }
      return data as CompletedWorksDocument[];
    } catch (error) {
      console.error('SupabaseStorage: Exception getting completed works documents:', error);
      return [];
    }
  }

  async createCompletedWorksDocument(document: InsertCompletedWorksDocument): Promise<CompletedWorksDocument> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('completed_works_documents')
        .insert([document])
        .select()
        .single();

      if (error) {
        console.error('SupabaseStorage: Error creating completed works document:', error);
        throw new Error(`Failed to create completed works document: ${error.message}`);
      }
      return data as CompletedWorksDocument;
    } catch (error) {
      console.error('SupabaseStorage: Exception creating completed works document:', error);
      throw error;
    }
  }

  async deleteCompletedWorksDocument(id: number): Promise<boolean> {
    this.checkConnection();
    try {
      const { error } = await this.supabase
        .from('completed_works_documents')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('SupabaseStorage: Error deleting completed works document:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('SupabaseStorage: Exception deleting completed works document:', error);
      return false;
    }
  }

  // Transaction Edit Permissions
  async grantTransactionEditPermission(permission: GrantTransactionEditPermissionInput): Promise<TransactionEditPermission> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('transaction_edit_permissions')
        .insert([{
          userId: permission.userId,
          projectId: permission.projectId,
          grantedBy: permission.grantedBy,
          reason: permission.reason,
          notes: permission.notes,
          // expiresAt intentionally omitted; not part of the input type here
        }])
        .select()
        .single();

      if (error) {
        console.error('SupabaseStorage: Error granting transaction edit permission:', error);
        throw new Error(`Failed to grant transaction edit permission: ${error.message}`);
      }
      return data as TransactionEditPermission;
    } catch (error) {
      console.error('SupabaseStorage: Exception granting transaction edit permission:', error);
      throw error;
    }
  }

  async revokeTransactionEditPermission(id: number, revokedBy: number): Promise<boolean> {
    this.checkConnection();
    try {
      const { error } = await this.supabase
        .from('transaction_edit_permissions')
        .delete()
        .eq('id', id)
        .eq('grantedBy', revokedBy);

      if (error) {
        console.error('SupabaseStorage: Error revoking transaction edit permission:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('SupabaseStorage: Exception revoking transaction edit permission:', error);
      return false;
    }
  }

  async checkTransactionEditPermission(userId: number, projectId?: number): Promise<TransactionEditPermission | undefined> {
    this.checkConnection();
    try {
      let query = this.supabase
        .from('transaction_edit_permissions')
        .select('*')
        .eq('userId', userId)
        .eq('isActive', true);

      if (projectId) {
        query = query.eq('projectId', projectId);
      }

      const { data, error } = await query.single();

      if (error) {
        if (error.code === 'PGRST116') { // No rows returned
          return undefined;
        }
        console.error('SupabaseStorage: Error checking transaction edit permission:', error);
        return undefined;
      }
      return data as TransactionEditPermission;
    } catch (error) {
      console.error('SupabaseStorage: Exception checking transaction edit permission:', error);
      return undefined;
    }
  }

  async listActiveTransactionEditPermissions(): Promise<TransactionEditPermission[]> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('transaction_edit_permissions')
        .select('*')
        .eq('isActive', true);

      if (error) {
        console.error('SupabaseStorage: Error listing active transaction edit permissions:', error);
        return [];
      }
      return data as TransactionEditPermission[];
    } catch (error) {
      console.error('SupabaseStorage: Exception listing active transaction edit permissions:', error);
      return [];
    }
  }

  async expireTransactionEditPermissions(): Promise<number> {
    this.checkConnection();
    try {
      const nowIso = new Date().toISOString();
      const { count, error: countErr } = await this.supabase
        .from('transaction_edit_permissions')
        .select('*', { head: true, count: 'exact' })
        .lt('expiresAt', nowIso);
      if (countErr) {
        console.error('SupabaseStorage: Error counting expiring permissions:', countErr);
      }
      const { error } = await this.supabase
        .from('transaction_edit_permissions')
        .update({ isActive: false })
        .lt('expiresAt', nowIso);
      if (error) {
        console.error('SupabaseStorage: Error expiring transaction edit permissions:', error);
        return 0;
      }
      return count ?? 0;
    } catch (error) {
      console.error('SupabaseStorage: Exception expiring transaction edit permissions:', error);
      return 0;
    }
  }

  async getTransactionEditPermissionsByUser(userId: number): Promise<TransactionEditPermission[]> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('transaction_edit_permissions')
        .select('*')
        .eq('userId', userId);

      if (error) {
        console.error('SupabaseStorage: Error getting transaction edit permissions by user:', error);
        return [];
      }
      return data as TransactionEditPermission[];
    } catch (error) {
      console.error('SupabaseStorage: Exception getting transaction edit permissions by user:', error);
      return [];
    }
  }

  async getTransactionEditPermissionsByProject(projectId: number): Promise<TransactionEditPermission[]> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('transaction_edit_permissions')
        .select('*')
        .eq('projectId', projectId);

      if (error) {
        console.error('SupabaseStorage: Error getting transaction edit permissions by project:', error);
        return [];
      }
      return data as TransactionEditPermission[];
    } catch (error) {
      console.error('SupabaseStorage: Exception getting transaction edit permissions by project:', error);
      return [];
    }
  }
}
