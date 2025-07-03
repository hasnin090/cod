import { neon } from '@neondatabase/serverless';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

interface BackupResult {
  success: boolean;
  files: string[];
  totalRecords: number;
  errors: string[];
}

export class JSONBackup {
  private sql = neon(process.env.DATABASE_URL!);
  private backupDir = './cloud-backup';

  async createFullBackup(): Promise<BackupResult> {
    const result: BackupResult = {
      success: false,
      files: [],
      totalRecords: 0,
      errors: []
    };

    try {
      // إنشاء مجلد النسخ الاحتياطية
      if (!existsSync(this.backupDir)) {
        mkdirSync(this.backupDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      // 1. نسخ احتياطية للمعاملات
      await this.backupTransactions(timestamp, result);
      
      // 2. نسخ احتياطية للمشاريع
      await this.backupProjects(timestamp, result);
      
      // 3. نسخ احتياطية للمستخدمين
      await this.backupUsers(timestamp, result);
      
      // 4. نسخ احتياطية لأنواع المصروفات
      await this.backupExpenseTypes(timestamp, result);
      
      // 5. نسخ احتياطية للموظفين
      await this.backupEmployees(timestamp, result);
      
      // 6. نسخ احتياطية للإعدادات
      await this.backupSettings(timestamp, result);

      // 7. إنشاء ملف فهرس شامل
      await this.createIndex(timestamp, result);

      result.success = result.errors.length === 0;
      console.log(`✅ تم إنشاء ${result.files.length} ملف نسخ احتياطية`);
      
    } catch (error) {
      result.errors.push(`خطأ عام: ${error}`);
      console.error('❌ خطأ في النسخ الاحتياطي:', error);
    }

    return result;
  }

  private async backupTransactions(timestamp: string, result: BackupResult): Promise<void> {
    try {
      const transactions = await this.sql(`
        SELECT t.*, p.name as project_name, u.name as created_by_name, e.name as employee_name
        FROM transactions t
        LEFT JOIN projects p ON t.project_id = p.id
        LEFT JOIN users u ON t.created_by = u.id
        LEFT JOIN employees e ON t.employee_id = e.id
        ORDER BY t.id
      `);

      const fileName = `transactions-${timestamp}.json`;
      const filePath = path.join(this.backupDir, fileName);
      
      writeFileSync(filePath, JSON.stringify({
        metadata: {
          table: 'transactions',
          count: transactions.length,
          exported_at: new Date().toISOString(),
          schema_version: '1.0'
        },
        data: transactions
      }, null, 2));

      result.files.push(fileName);
      result.totalRecords += transactions.length;
      console.log(`✅ تم حفظ ${transactions.length} معاملة`);
    } catch (error) {
      result.errors.push(`خطأ في المعاملات: ${error}`);
    }
  }

  private async backupProjects(timestamp: string, result: BackupResult): Promise<void> {
    try {
      const projects = await this.sql(`SELECT * FROM projects ORDER BY id`);
      
      const fileName = `projects-${timestamp}.json`;
      const filePath = path.join(this.backupDir, fileName);
      
      writeFileSync(filePath, JSON.stringify({
        metadata: {
          table: 'projects',
          count: projects.length,
          exported_at: new Date().toISOString(),
          schema_version: '1.0'
        },
        data: projects
      }, null, 2));

      result.files.push(fileName);
      result.totalRecords += projects.length;
      console.log(`✅ تم حفظ ${projects.length} مشروع`);
    } catch (error) {
      result.errors.push(`خطأ في المشاريع: ${error}`);
    }
  }

  private async backupUsers(timestamp: string, result: BackupResult): Promise<void> {
    try {
      const users = await this.sql(`
        SELECT id, username, name, email, role, permissions
        FROM users ORDER BY id
      `);
      
      const fileName = `users-${timestamp}.json`;
      const filePath = path.join(this.backupDir, fileName);
      
      writeFileSync(filePath, JSON.stringify({
        metadata: {
          table: 'users',
          count: users.length,
          exported_at: new Date().toISOString(),
          schema_version: '1.0',
          note: 'Passwords excluded for security'
        },
        data: users
      }, null, 2));

      result.files.push(fileName);
      result.totalRecords += users.length;
      console.log(`✅ تم حفظ ${users.length} مستخدم`);
    } catch (error) {
      result.errors.push(`خطأ في المستخدمين: ${error}`);
    }
  }

  private async backupExpenseTypes(timestamp: string, result: BackupResult): Promise<void> {
    try {
      const expenseTypes = await this.sql(`SELECT * FROM expense_types ORDER BY id`);
      
      const fileName = `expense-types-${timestamp}.json`;
      const filePath = path.join(this.backupDir, fileName);
      
      writeFileSync(filePath, JSON.stringify({
        metadata: {
          table: 'expense_types',
          count: expenseTypes.length,
          exported_at: new Date().toISOString(),
          schema_version: '1.0'
        },
        data: expenseTypes
      }, null, 2));

      result.files.push(fileName);
      result.totalRecords += expenseTypes.length;
      console.log(`✅ تم حفظ ${expenseTypes.length} نوع مصروف`);
    } catch (error) {
      result.errors.push(`خطأ في أنواع المصروفات: ${error}`);
    }
  }

  private async backupEmployees(timestamp: string, result: BackupResult): Promise<void> {
    try {
      const employees = await this.sql(`SELECT * FROM employees ORDER BY id`);
      
      if (employees.length > 0) {
        const fileName = `employees-${timestamp}.json`;
        const filePath = path.join(this.backupDir, fileName);
        
        writeFileSync(filePath, JSON.stringify({
          metadata: {
            table: 'employees',
            count: employees.length,
            exported_at: new Date().toISOString(),
            schema_version: '1.0'
          },
          data: employees
        }, null, 2));

        result.files.push(fileName);
        result.totalRecords += employees.length;
        console.log(`✅ تم حفظ ${employees.length} موظف`);
      }
    } catch (error) {
      result.errors.push(`خطأ في الموظفين: ${error}`);
    }
  }

  private async backupSettings(timestamp: string, result: BackupResult): Promise<void> {
    try {
      const settings = await this.sql(`SELECT * FROM settings ORDER BY id`);
      
      const fileName = `settings-${timestamp}.json`;
      const filePath = path.join(this.backupDir, fileName);
      
      writeFileSync(filePath, JSON.stringify({
        metadata: {
          table: 'settings',
          count: settings.length,
          exported_at: new Date().toISOString(),
          schema_version: '1.0'
        },
        data: settings
      }, null, 2));

      result.files.push(fileName);
      result.totalRecords += settings.length;
      console.log(`✅ تم حفظ ${settings.length} إعداد`);
    } catch (error) {
      result.errors.push(`خطأ في الإعدادات: ${error}`);
    }
  }

  private async createIndex(timestamp: string, result: BackupResult): Promise<void> {
    try {
      const indexData = {
        backup_info: {
          created_at: new Date().toISOString(),
          timestamp,
          total_files: result.files.length,
          total_records: result.totalRecords,
          version: '1.0'
        },
        files: result.files.map(file => ({
          name: file,
          path: `./${file}`,
          type: file.split('-')[0],
          size_mb: 'calculated_at_runtime'
        })),
        database_schema: {
          transactions: ['id', 'date', 'type', 'expense_type', 'amount', 'description', 'project_id', 'created_by', 'employee_id', 'file_url', 'file_type'],
          projects: ['id', 'name', 'description', 'budget', 'status'],
          users: ['id', 'username', 'name', 'email', 'role', 'permissions'],
          expense_types: ['id', 'name', 'description'],
          employees: ['id', 'name', 'position', 'salary', 'project_id'],
          settings: ['id', 'key', 'value']
        },
        restoration_notes: {
          transactions: 'Contains complete transaction history with project and user references',
          security: 'User passwords excluded for security reasons',
          files: 'Physical files stored separately in uploads/ directory'
        }
      };

      const indexFile = `backup-index-${timestamp}.json`;
      const indexPath = path.join(this.backupDir, indexFile);
      
      writeFileSync(indexPath, JSON.stringify(indexData, null, 2));
      result.files.push(indexFile);
      console.log(`✅ تم إنشاء فهرس النسخة الاحتياطية`);
    } catch (error) {
      result.errors.push(`خطأ في إنشاء الفهرس: ${error}`);
    }
  }
}

export const jsonBackup = new JSONBackup();