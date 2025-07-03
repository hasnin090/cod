import { neon } from '@neondatabase/serverless';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';

interface SyncProgress {
  stage: string;
  progress: number;
  total: number;
  errors: string[];
  successes: string[];
}

export class LocalToSupabaseSync {
  private sql = neon(process.env.DATABASE_URL!);
  private uploadsDir = './uploads';
  private progress: SyncProgress = {
    stage: 'ready',
    progress: 0,
    total: 0,
    errors: [],
    successes: []
  };

  async syncAllData(): Promise<SyncProgress> {
    try {
      console.log('🔄 بدء مزامنة البيانات المحلية...');
      
      // مرحلة 1: فحص البيانات المحلية
      this.progress.stage = 'scanning';
      await this.scanLocalData();
      
      // مرحلة 2: رفع الملفات
      this.progress.stage = 'uploading_files';
      await this.uploadFilesToSupabase();
      
      // مرحلة 3: مزامنة المعاملات
      this.progress.stage = 'syncing_transactions';
      await this.syncTransactionsToSupabase();
      
      // مرحلة 4: مزامنة البيانات الإضافية
      this.progress.stage = 'syncing_metadata';
      await this.syncMetadataToSupabase();
      
      this.progress.stage = 'completed';
      console.log('✅ اكتملت المزامنة بنجاح');
      
    } catch (error) {
      this.progress.stage = 'error';
      this.progress.errors.push(`خطأ عام: ${error}`);
      console.error('❌ خطأ في المزامنة:', error);
    }
    
    return this.progress;
  }

  private async scanLocalData(): Promise<void> {
    // فحص الملفات المحلية
    const files = this.findLocalFiles();
    console.log(`📁 تم العثور على ${files.length} ملف محلي`);
    
    // فحص المعاملات
    const transactions = await this.sql(`SELECT COUNT(*) as count FROM transactions`);
    console.log(`💾 ${transactions[0].count} معاملة في قاعدة البيانات`);
    
    this.progress.total = files.length + parseInt(transactions[0].count);
    this.progress.successes.push(`فحص البيانات: ${files.length} ملف، ${transactions[0].count} معاملة`);
  }

  private async uploadFilesToSupabase(): Promise<void> {
    const files = this.findLocalFiles();
    
    // محاولة رفع الملفات باستخدام النظام المدمج
    const { supabaseClient } = await import('./supabase-simple');
    
    if (!supabaseClient) {
      this.progress.errors.push('Supabase client غير متوفر');
      return;
    }

    for (const file of files) {
      try {
        const fileBuffer = readFileSync(file.path);
        const timestamp = Date.now();
        const fileName = `${timestamp}_${file.transactionId}_${file.name}`;
        
        // رفع الملف (استخدام application/octet-stream لجميع الملفات)
        const { data, error } = await supabaseClient.storage
          .from('files')
          .upload(fileName, fileBuffer, {
            contentType: 'application/octet-stream',
            upsert: true
          });

        if (!error) {
          // إنشاء رابط عام
          const { data: urlData } = supabaseClient.storage
            .from('files')
            .getPublicUrl(fileName);

          // تحديث رابط الملف في قاعدة البيانات المحلية
          if (file.transactionId > 0) {
            await this.sql(`
              UPDATE transactions 
              SET file_url = $1 
              WHERE id = $2
            `, [urlData.publicUrl, file.transactionId]);
          }

          this.progress.progress++;
          this.progress.successes.push(`رفع ملف: ${file.name}`);
          console.log(`✅ تم رفع ${file.name}`);
        } else {
          this.progress.errors.push(`فشل رفع ${file.name}: ${error.message}`);
          console.log(`❌ فشل رفع ${file.name}: ${error.message}`);
        }
      } catch (error) {
        this.progress.errors.push(`خطأ في رفع ${file.name}: ${error}`);
      }
    }
  }

  private async syncTransactionsToSupabase(): Promise<void> {
    const { supabaseClient } = await import('./supabase-simple');
    
    if (!supabaseClient) {
      this.progress.errors.push('Supabase client غير متوفر للمعاملات');
      return;
    }

    // جلب جميع المعاملات مع الأعمدة الموجودة فقط
    const transactions = await this.sql(`
      SELECT id, date, type, expense_type as expenseType, amount, description, 
             project_id as projectId, created_by as createdBy, employee_id as employeeId,
             file_url as fileUrl, file_type as fileType, archived
      FROM transactions 
      ORDER BY id
    `);

    // رفع بدفعات من 50 معاملة
    const batchSize = 50;
    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize);
      
      try {
        // تنظيف البيانات قبل الرفع
        const cleanBatch = batch.map(transaction => ({
          id: transaction.id,
          date: transaction.date,
          type: transaction.type,
          expenseType: transaction.expensetype || transaction.expenseType,
          amount: transaction.amount,
          description: transaction.description,
          projectId: transaction.projectid || transaction.projectId,
          createdBy: transaction.createdby || transaction.createdBy || 1,
          employeeId: transaction.employeeid || transaction.employeeId,
          fileUrl: transaction.fileurl || transaction.fileUrl,
          fileType: transaction.filetype || transaction.fileType,
          archived: transaction.archived || false
        }));

        const { error } = await supabaseClient
          .from('transactions')
          .upsert(cleanBatch, { onConflict: 'id' });

        if (!error) {
          this.progress.progress += batch.length;
          this.progress.successes.push(`مزامنة دفعة ${Math.floor(i/batchSize) + 1}: ${batch.length} معاملة`);
          console.log(`✅ دفعة ${Math.floor(i/batchSize) + 1}/${Math.ceil(transactions.length/batchSize)}`);
        } else {
          this.progress.errors.push(`فشل دفعة ${Math.floor(i/batchSize) + 1}: ${error.message}`);
        }
      } catch (error) {
        this.progress.errors.push(`خطأ في دفعة ${Math.floor(i/batchSize) + 1}: ${error}`);
      }
    }
  }

  private async syncMetadataToSupabase(): Promise<void> {
    const { supabaseClient } = await import('./supabase-simple');
    
    if (!supabaseClient) {
      this.progress.errors.push('Supabase client غير متوفر للبيانات الإضافية');
      return;
    }

    try {
      // مزامنة المشاريع
      const projects = await this.sql(`SELECT * FROM projects`);
      await supabaseClient.from('projects').upsert(projects, { onConflict: 'id' });
      this.progress.successes.push(`مزامنة ${projects.length} مشروع`);

      // مزامنة المستخدمين (بدون كلمات المرور لأمان)
      const users = await this.sql(`
        SELECT id, username, name, email, role, permissions, active 
        FROM users
      `);
      await supabaseClient.from('users').upsert(users, { onConflict: 'id' });
      this.progress.successes.push(`مزامنة ${users.length} مستخدم`);

      // مزامنة أنواع المصروفات
      const expenseTypes = await this.sql(`SELECT * FROM expense_types`);
      await supabaseClient.from('expense_types').upsert(expenseTypes, { onConflict: 'id' });
      this.progress.successes.push(`مزامنة ${expenseTypes.length} نوع مصروف`);

      // مزامنة الموظفين
      const employees = await this.sql(`SELECT * FROM employees`);
      if (employees.length > 0) {
        await supabaseClient.from('employees').upsert(employees, { onConflict: 'id' });
        this.progress.successes.push(`مزامنة ${employees.length} موظف`);
      }

      // مزامنة الإعدادات
      const settings = await this.sql(`SELECT * FROM settings`);
      await supabaseClient.from('settings').upsert(settings, { onConflict: 'id' });
      this.progress.successes.push(`مزامنة ${settings.length} إعداد`);

    } catch (error) {
      this.progress.errors.push(`خطأ في مزامنة البيانات الإضافية: ${error}`);
    }
  }

  private findLocalFiles(): Array<{path: string, name: string, transactionId: number}> {
    const files: Array<{path: string, name: string, transactionId: number}> = [];
    
    if (!existsSync(this.uploadsDir)) {
      return files;
    }

    const scanDirectory = (dir: string, transactionId = 0) => {
      try {
        const items = readdirSync(dir);
        
        for (const item of items) {
          const fullPath = path.join(dir, item);
          const stat = statSync(fullPath);
          
          if (stat.isDirectory()) {
            const possibleId = parseInt(item);
            if (!isNaN(possibleId)) {
              scanDirectory(fullPath, possibleId);
            } else {
              scanDirectory(fullPath, transactionId);
            }
          } else if (stat.isFile() && this.isValidFile(item)) {
            files.push({
              path: fullPath,
              name: item,
              transactionId
            });
          }
        }
      } catch (error) {
        console.error(`خطأ في فحص المجلد ${dir}:`, error);
      }
    };

    scanDirectory(this.uploadsDir);
    return files;
  }

  private isValidFile(fileName: string): boolean {
    const validExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.doc', '.docx'];
    return validExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
  }

  private getContentType(fileName: string): string {
    const extension = fileName.toLowerCase().split('.').pop();
    
    switch (extension) {
      case 'pdf': return 'application/pdf';
      case 'jpg':
      case 'jpeg': return 'image/jpeg';
      case 'png': return 'image/png';
      case 'gif': return 'image/gif';
      case 'doc':
      case 'docx': return 'application/msword';
      default: return 'application/octet-stream';
    }
  }

  getProgress(): SyncProgress {
    return this.progress;
  }
}

export const localToSupabaseSync = new LocalToSupabaseSync();