import { neon } from '@neondatabase/serverless';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

interface MigrationResult {
  totalFiles: number;
  uploadedFiles: number;
  failedFiles: number;
  totalTransactions: number;
  syncedTransactions: number;
  errors: string[];
}

interface LocalFile {
  transactionId: number;
  filePath: string;
  fileName: string;
  fileSize: number;
  fileType: string;
}

export class SupabaseMigration {
  private sql = neon(process.env.DATABASE_URL!);
  private uploadsDir = './uploads';

  /**
   * رفع جميع العمليات والملفات المحلية إلى Supabase
   */
  async migrateToSupabase(): Promise<MigrationResult> {
    const result: MigrationResult = {
      totalFiles: 0,
      uploadedFiles: 0,
      failedFiles: 0,
      totalTransactions: 0,
      syncedTransactions: 0,
      errors: []
    };

    try {
      console.log('🔄 بدء عملية رفع البيانات إلى Supabase...');

      // 1. رفع الملفات المحلية إلى Supabase Storage
      const filesResult = await this.uploadLocalFilesToSupabase();
      result.totalFiles = filesResult.totalFiles;
      result.uploadedFiles = filesResult.uploadedFiles;
      result.failedFiles = filesResult.failedFiles;
      result.errors.push(...filesResult.errors);

      // 2. مزامنة المعاملات مع Supabase Database
      const transactionsResult = await this.syncTransactionsToSupabase();
      result.totalTransactions = transactionsResult.totalTransactions;
      result.syncedTransactions = transactionsResult.syncedTransactions;
      result.errors.push(...transactionsResult.errors);

      console.log(`✅ اكتملت العملية: ${result.uploadedFiles}/${result.totalFiles} ملف, ${result.syncedTransactions}/${result.totalTransactions} معاملة`);

    } catch (error) {
      console.error('خطأ في عملية الرفع:', error);
      result.errors.push(`General error: ${error}`);
    }

    return result;
  }

  /**
   * رفع الملفات المحلية إلى Supabase Storage
   */
  private async uploadLocalFilesToSupabase(): Promise<{ totalFiles: number; uploadedFiles: number; failedFiles: number; errors: string[] }> {
    const localFiles = await this.findLocalFiles();
    const result = {
      totalFiles: localFiles.length,
      uploadedFiles: 0,
      failedFiles: 0,
      errors: [] as string[]
    };

    console.log(`📁 تم العثور على ${localFiles.length} ملف محلي`);

    for (const file of localFiles) {
      try {
        const uploaded = await this.uploadFileToSupabase(file);
        if (uploaded) {
          result.uploadedFiles++;
          // تحديث رابط الملف في قاعدة البيانات
          await this.updateFileUrlInDatabase(file.transactionId, uploaded.url);
          console.log(`✅ تم رفع ${file.fileName}`);
        } else {
          result.failedFiles++;
          result.errors.push(`Failed to upload ${file.fileName}`);
        }
      } catch (error) {
        result.failedFiles++;
        result.errors.push(`Error uploading ${file.fileName}: ${error}`);
        console.error(`❌ فشل رفع ${file.fileName}:`, error);
      }
    }

    return result;
  }

  /**
   * البحث عن الملفات المحلية
   */
  private async findLocalFiles(): Promise<LocalFile[]> {
    const files: LocalFile[] = [];

    if (!existsSync(this.uploadsDir)) {
      return files;
    }

    const scanDirectory = (dir: string, transactionId?: number) => {
      try {
        const items = readdirSync(dir);
        
        for (const item of items) {
          const fullPath = join(dir, item);
          const stat = statSync(fullPath);
          
          if (stat.isDirectory()) {
            // إذا كان اسم المجلد رقم، فهو معرف المعاملة
            const possibleId = parseInt(item);
            if (!isNaN(possibleId)) {
              scanDirectory(fullPath, possibleId);
            } else {
              scanDirectory(fullPath, transactionId);
            }
          } else if (stat.isFile()) {
            // تحديد نوع الملف
            const fileType = this.getFileType(item);
            
            files.push({
              transactionId: transactionId || 0,
              filePath: fullPath,
              fileName: item,
              fileSize: stat.size,
              fileType
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

  /**
   * رفع ملف واحد إلى Supabase
   */
  private async uploadFileToSupabase(file: LocalFile): Promise<{ url: string } | null> {
    try {
      // استيراد Supabase client
      const { supabaseClient } = await import('./supabase-simple');
      
      if (!supabaseClient) {
        console.error('Supabase client غير متوفر');
        return null;
      }

      // قراءة الملف
      const fileBuffer = readFileSync(file.filePath);
      
      // إنشاء مسار الملف في Supabase
      const timestamp = Date.now();
      const fileName = `${timestamp}_${file.transactionId}_${file.fileName}`;
      
      // رفع الملف
      const { data, error } = await supabaseClient.storage
        .from('files')
        .upload(fileName, fileBuffer, {
          contentType: file.fileType,
          upsert: true
        });

      if (error) {
        console.error('خطأ في رفع الملف:', error);
        return null;
      }

      // إنشاء رابط عام للملف
      const { data: urlData } = supabaseClient.storage
        .from('files')
        .getPublicUrl(fileName);

      return { url: urlData.publicUrl };
      
    } catch (error) {
      console.error('خطأ في رفع الملف إلى Supabase:', error);
      return null;
    }
  }

  /**
   * مزامنة المعاملات مع Supabase Database
   */
  private async syncTransactionsToSupabase(): Promise<{ totalTransactions: number; syncedTransactions: number; errors: string[] }> {
    const result = {
      totalTransactions: 0,
      syncedTransactions: 0,
      errors: [] as string[]
    };

    try {
      // جلب جميع المعاملات من قاعدة البيانات المحلية
      const transactions = await this.sql(`
        SELECT * FROM transactions 
        ORDER BY created_at DESC
      `);

      result.totalTransactions = transactions.length;
      console.log(`💾 بدء مزامنة ${transactions.length} معاملة`);

      // رفع البيانات دفعة واحدة إلى Supabase
      const { supabaseClient } = await import('./supabase-simple');
      
      if (!supabaseClient) {
        result.errors.push('Supabase client غير متوفر');
        return result;
      }

      // رفع المعاملات بدفعات صغيرة لتجنب القيود
      const batchSize = 100;
      for (let i = 0; i < transactions.length; i += batchSize) {
        const batch = transactions.slice(i, i + batchSize);
        
        try {
          const { error } = await supabaseClient
            .from('transactions')
            .upsert(batch, { onConflict: 'id' });

          if (error) {
            result.errors.push(`Batch ${Math.floor(i/batchSize) + 1} error: ${error.message}`);
          } else {
            result.syncedTransactions += batch.length;
            console.log(`✅ تمت مزامنة دفعة ${Math.floor(i/batchSize) + 1}/${Math.ceil(transactions.length/batchSize)}`);
          }
        } catch (error) {
          result.errors.push(`Batch ${Math.floor(i/batchSize) + 1} exception: ${error}`);
        }
      }

    } catch (error) {
      result.errors.push(`Sync error: ${error}`);
      console.error('خطأ في مزامنة المعاملات:', error);
    }

    return result;
  }

  /**
   * تحديث رابط الملف في قاعدة البيانات
   */
  private async updateFileUrlInDatabase(transactionId: number, newUrl: string): Promise<void> {
    try {
      await this.sql(`
        UPDATE transactions 
        SET file_url = $1 
        WHERE id = $2
      `, [newUrl, transactionId]);
    } catch (error) {
      console.error('خطأ في تحديث رابط الملف:', error);
    }
  }

  /**
   * تحديد نوع الملف
   */
  private getFileType(fileName: string): string {
    const extension = fileName.toLowerCase().split('.').pop();
    
    switch (extension) {
      case 'pdf':
        return 'application/pdf';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'doc':
      case 'docx':
        return 'application/msword';
      case 'xls':
      case 'xlsx':
        return 'application/vnd.ms-excel';
      default:
        return 'application/octet-stream';
    }
  }

  /**
   * فحص حالة المزامنة
   */
  async getSyncStatus(): Promise<{
    localFiles: number;
    localTransactions: number;
    supabaseFiles: number;
    supabaseTransactions: number;
  }> {
    const localFiles = await this.findLocalFiles();
    
    const localTransactions = await this.sql(`SELECT COUNT(*) as count FROM transactions`);
    
    let supabaseFiles = 0;
    let supabaseTransactions = 0;

    try {
      const { supabaseClient } = await import('./supabase-simple');
      
      if (supabaseClient) {
        // فحص عدد الملفات في Supabase
        const { data: files } = await supabaseClient.storage
          .from('files')
          .list();
        supabaseFiles = files?.length || 0;

        // فحص عدد المعاملات في Supabase
        const { count } = await supabaseClient
          .from('transactions')
          .select('*', { count: 'exact', head: true });
        supabaseTransactions = count || 0;
      }
    } catch (error) {
      console.error('خطأ في فحص حالة Supabase:', error);
    }

    return {
      localFiles: localFiles.length,
      localTransactions: localTransactions[0].count,
      supabaseFiles,
      supabaseTransactions
    };
  }
}

export const supabaseMigration = new SupabaseMigration();