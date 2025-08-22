
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
import { IStorage } from './storage';
import { getSupabaseClient } from './supabase-storage';

export class SupabaseStorage implements IStorage {
  private supabase: SupabaseClient | null = null;

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
      const { data, error } = await this.supabase
        .from('projects')
        .insert([project])
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
      const { data, error } = await this.supabase
        .from('projects')
        .update(project)
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
      const { data, error } = await this.supabase
        .from('transactions')
        .insert([transaction])
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
      const { data, error } = await this.supabase
        .from('transactions')
        .update(transaction)
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
      return data as Transaction[];
    } catch (error) {
      console.error('SupabaseStorage: Exception listing transactions:', error);
      return [];
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
      const { data, error } = await this.supabase
        .from('activity_logs')
        .insert([activityLog])
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

  async updateSetting(id: number, setting: Partial<Setting>): Promise<Setting | undefined> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('settings')
        .update(setting)
        .eq('id', id)
        .select()
        .single();

      if (error) {
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
  async getUserProjects(userId: number): Promise<UserProject[]> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('user_projects')
        .select('*')
        .eq('userId', userId);

      if (error) {
        console.error('SupabaseStorage: Error getting user projects:', error);
        return [];
      }
      return data as UserProject[];
    } catch (error) {
      console.error('SupabaseStorage: Exception getting user projects:', error);
      return [];
    }
  }

  async createUserProject(userProject: InsertUserProject): Promise<UserProject> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('user_projects')
        .insert([userProject])
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
        .eq('userId', userId)
        .eq('projectId', projectId);

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

  async createEmployee(employee: InsertEmployee): Promise<Employee> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('employees')
        .insert([employee])
        .select()
        .single();

      if (error) {
        console.error('SupabaseStorage: Error creating employee:', error);
        throw new Error(`Failed to create employee: ${error.message}`);
      }
      return data as Employee;
    } catch (error) {
      console.error('SupabaseStorage: Exception creating employee:', error);
      throw error;
    }
  }

  async updateEmployee(id: number, employee: Partial<Employee>): Promise<Employee | undefined> {
    this.checkConnection();
    try {
      const { data, error } = await this.supabase
        .from('employees')
        .update(employee)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('SupabaseStorage: Error updating employee:', error);
        return undefined;
      }
      return data as Employee;
    } catch (error) {
      console.error('SupabaseStorage: Exception updating employee:', error);
      return undefined;
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
        .eq('assignedProjectId', projectId);

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
        .eq('completedWorkId', workId);

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
          expiresAt: permission.expiresAt || null
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
      const { data, error } = await this.supabase
        .from('transaction_edit_permissions')
        .update({ isActive: false })
        .lt('expiresAt', new Date().toISOString());

      if (error) {
        console.error('SupabaseStorage: Error expiring transaction edit permissions:', error);
        return 0;
      }
      return data ? data.length : 0;
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
