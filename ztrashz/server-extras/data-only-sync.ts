import { neon } from '@neondatabase/serverless';

interface DataSyncResult {
  transactions: { synced: number; total: number };
  projects: { synced: number; total: number };
  users: { synced: number; total: number };
  expenseTypes: { synced: number; total: number };
  employees: { synced: number; total: number };
  settings: { synced: number; total: number };
  errors: string[];
  success: boolean;
}

export class DataOnlySync {
  private sql = neon(process.env.DATABASE_URL!);

  async syncAllData(): Promise<DataSyncResult> {
    const result: DataSyncResult = {
      transactions: { synced: 0, total: 0 },
      projects: { synced: 0, total: 0 },
      users: { synced: 0, total: 0 },
      expenseTypes: { synced: 0, total: 0 },
      employees: { synced: 0, total: 0 },
      settings: { synced: 0, total: 0 },
      errors: [],
      success: false
    };

    try {
      console.log('🔄 بدء مزامنة البيانات فقط (بدون ملفات)...');
      
      const { supabaseClient } = await import('./supabase-simple');
      
      if (!supabaseClient) {
        result.errors.push('Supabase client غير متوفر');
        return result;
      }

      // 1. مزامنة المعاملات
      await this.syncTransactions(supabaseClient, result);
      
      // 2. مزامنة المشاريع
      await this.syncProjects(supabaseClient, result);
      
      // 3. مزامنة المستخدمين
      await this.syncUsers(supabaseClient, result);
      
      // 4. مزامنة أنواع المصروفات
      await this.syncExpenseTypes(supabaseClient, result);
      
      // 5. مزامنة الموظفين
      await this.syncEmployees(supabaseClient, result);
      
      // 6. مزامنة الإعدادات
      await this.syncSettings(supabaseClient, result);

      result.success = result.errors.length === 0;
      console.log('✅ اكتملت مزامنة البيانات');
      
    } catch (error) {
      result.errors.push(`خطأ عام: ${error}`);
      console.error('❌ خطأ في المزامنة:', error);
    }

    return result;
  }

  private async syncTransactions(supabaseClient: any, result: DataSyncResult): Promise<void> {
    try {
      const transactions = await this.sql(`
        SELECT id, date, type, expense_type, amount, description, 
               project_id, created_by, employee_id, file_url, file_type, archived
        FROM transactions 
        ORDER BY id
      `);

      result.transactions.total = transactions.length;

      // رفع بدفعات من 50 معاملة
      const batchSize = 50;
      for (let i = 0; i < transactions.length; i += batchSize) {
        const batch = transactions.slice(i, i + batchSize);
        
        const cleanBatch = batch.map(t => ({
          id: t.id,
          date: t.date,
          type: t.type,
          expense_type: t.expense_type,
          amount: parseFloat(t.amount),
          description: t.description,
          project_id: t.project_id,
          created_by: t.created_by || 1,
          employee_id: t.employee_id,
          file_url: t.file_url,
          file_type: t.file_type
        }));

        const { error } = await supabaseClient
          .from('transactions')
          .upsert(cleanBatch, { onConflict: 'id' });

        if (!error) {
          result.transactions.synced += batch.length;
          console.log(`✅ معاملات - دفعة ${Math.floor(i/batchSize) + 1}/${Math.ceil(transactions.length/batchSize)}`);
        } else {
          result.errors.push(`فشل مزامنة المعاملات - دفعة ${Math.floor(i/batchSize) + 1}: ${error.message}`);
        }
      }
    } catch (error) {
      result.errors.push(`خطأ في مزامنة المعاملات: ${error}`);
    }
  }

  private async syncProjects(supabaseClient: any, result: DataSyncResult): Promise<void> {
    try {
      const projects = await this.sql(`
        SELECT id, name, description, budget, status FROM projects ORDER BY id
      `);
      result.projects.total = projects.length;

      const { error } = await supabaseClient
        .from('projects')
        .upsert(projects, { onConflict: 'id' });

      if (!error) {
        result.projects.synced = projects.length;
        console.log(`✅ تمت مزامنة ${projects.length} مشروع`);
      } else {
        result.errors.push(`فشل مزامنة المشاريع: ${error.message}`);
      }
    } catch (error) {
      result.errors.push(`خطأ في مزامنة المشاريع: ${error}`);
    }
  }

  private async syncUsers(supabaseClient: any, result: DataSyncResult): Promise<void> {
    try {
      const users = await this.sql(`
        SELECT id, username, name, email, role, permissions 
        FROM users ORDER BY id
      `);
      result.users.total = users.length;

      const { error } = await supabaseClient
        .from('users')
        .upsert(users, { onConflict: 'id' });

      if (!error) {
        result.users.synced = users.length;
        console.log(`✅ تمت مزامنة ${users.length} مستخدم`);
      } else {
        result.errors.push(`فشل مزامنة المستخدمين: ${error.message}`);
      }
    } catch (error) {
      result.errors.push(`خطأ في مزامنة المستخدمين: ${error}`);
    }
  }

  private async syncExpenseTypes(supabaseClient: any, result: DataSyncResult): Promise<void> {
    try {
      const expenseTypes = await this.sql(`
        SELECT id, name, description FROM expense_types ORDER BY id
      `);
      result.expenseTypes.total = expenseTypes.length;

      const { error } = await supabaseClient
        .from('expense_types')
        .upsert(expenseTypes, { onConflict: 'id' });

      if (!error) {
        result.expenseTypes.synced = expenseTypes.length;
        console.log(`✅ تمت مزامنة ${expenseTypes.length} نوع مصروف`);
      } else {
        result.errors.push(`فشل مزامنة أنواع المصروفات: ${error.message}`);
      }
    } catch (error) {
      result.errors.push(`خطأ في مزامنة أنواع المصروفات: ${error}`);
    }
  }

  private async syncEmployees(supabaseClient: any, result: DataSyncResult): Promise<void> {
    try {
      const employees = await this.sql(`SELECT * FROM employees ORDER BY id`);
      result.employees.total = employees.length;

      if (employees.length > 0) {
        const { error } = await supabaseClient
          .from('employees')
          .upsert(employees, { onConflict: 'id' });

        if (!error) {
          result.employees.synced = employees.length;
          console.log(`✅ تمت مزامنة ${employees.length} موظف`);
        } else {
          result.errors.push(`فشل مزامنة الموظفين: ${error.message}`);
        }
      }
    } catch (error) {
      result.errors.push(`خطأ في مزامنة الموظفين: ${error}`);
    }
  }

  private async syncSettings(supabaseClient: any, result: DataSyncResult): Promise<void> {
    try {
      const settings = await this.sql(`
        SELECT id, key, value FROM settings ORDER BY id
      `);
      result.settings.total = settings.length;

      const { error } = await supabaseClient
        .from('settings')
        .upsert(settings, { onConflict: 'id' });

      if (!error) {
        result.settings.synced = settings.length;
        console.log(`✅ تمت مزامنة ${settings.length} إعداد`);
      } else {
        result.errors.push(`فشل مزامنة الإعدادات: ${error.message}`);
      }
    } catch (error) {
      result.errors.push(`خطأ في مزامنة الإعدادات: ${error}`);
    }
  }
}

export const dataOnlySync = new DataOnlySync();