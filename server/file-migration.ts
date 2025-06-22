import { storage } from './storage';
import { storageManager } from './storage-manager';
import { uploadToSupabase } from './supabase-db';
import { uploadToFirebase } from './firebase-storage';
import fs from 'fs';
import path from 'path';

interface MigrationResult {
  totalFiles: number;
  migratedFiles: number;
  failedFiles: number;
  errors: string[];
}

interface FileInfo {
  transactionId: number;
  oldPath: string;
  newPath: string;
  fileName: string;
  fileType: string;
}

export class FileMigration {
  private uploadsDir = './uploads';

  /**
   * البحث عن جميع المعاملات التي تحتوي على مرفقات
   */
  async findTransactionsWithAttachments(): Promise<FileInfo[]> {
    try {
      const transactions = await storage.listTransactions();
      const filesInfo: FileInfo[] = [];

      for (const transaction of transactions) {
        if (transaction.fileUrl) {
          // تحديد المسار القديم والجديد
          const oldPath = transaction.fileUrl.startsWith('/') 
            ? transaction.fileUrl.substring(1) // إزالة / من البداية
            : transaction.fileUrl;

          const fileName = path.basename(oldPath);
          const newPath = `transactions/${transaction.id}/${fileName}`;

          filesInfo.push({
            transactionId: transaction.id,
            oldPath,
            newPath,
            fileName,
            fileType: transaction.fileType || 'application/octet-stream'
          });
        }
      }

      return filesInfo;
    } catch (error) {
      console.error('خطأ في البحث عن المعاملات:', error);
      return [];
    }
  }

  /**
   * نسخ ملف واحد إلى التخزين السحابي
   */
  async migrateFile(fileInfo: FileInfo): Promise<boolean> {
    try {
      const fullOldPath = path.join(this.uploadsDir, fileInfo.oldPath);
      
      // التحقق من وجود الملف
      if (!fs.existsSync(fullOldPath)) {
        console.log(`الملف غير موجود: ${fullOldPath}`);
        return false;
      }

      // محاولة رفع الملف باستخدام مدير التخزين
      const migrationResult = await storageManager.uploadFile(
        fullOldPath,
        fileInfo.newPath,
        fileInfo.fileType
      );

      if (migrationResult.success && migrationResult.url) {
        // تحديث URL في قاعدة البيانات
        await storage.updateTransaction(fileInfo.transactionId, {
          fileUrl: migrationResult.url
        });
        
        console.log(`✅ تم نقل الملف: ${fileInfo.oldPath} → ${migrationResult.provider}: ${migrationResult.url}`);
        return true;
      } else {
        console.error(`فشل نقل الملف: ${fileInfo.oldPath} - ${migrationResult.error}`);
        return false;
      }
    } catch (error) {
      console.error(`خطأ في نقل الملف ${fileInfo.oldPath}:`, error);
      return false;
    }
  }

  /**
   * نسخ جميع الملفات إلى التخزين السحابي
   */
  async migrateAllFiles(): Promise<MigrationResult> {
    const result: MigrationResult = {
      totalFiles: 0,
      migratedFiles: 0,
      failedFiles: 0,
      errors: []
    };

    try {
      const filesInfo = await this.findTransactionsWithAttachments();
      result.totalFiles = filesInfo.length;

      console.log(`🔄 بدء نقل ${result.totalFiles} ملف إلى التخزين السحابي...`);

      for (const fileInfo of filesInfo) {
        try {
          const success = await this.migrateFile(fileInfo);
          if (success) {
            result.migratedFiles++;
          } else {
            result.failedFiles++;
            result.errors.push(`فشل نقل الملف: ${fileInfo.oldPath}`);
          }
        } catch (error) {
          result.failedFiles++;
          result.errors.push(`خطأ في الملف ${fileInfo.oldPath}: ${error}`);
        }

        // توقف قصير لتجنب إرهاق الخادم
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`✅ اكتمل النقل: ${result.migratedFiles} نجح، ${result.failedFiles} فشل`);
      return result;
    } catch (error) {
      result.errors.push(`خطأ عام في النقل: ${error}`);
      return result;
    }
  }

  /**
   * تنظيف الملفات القديمة بعد النقل الناجح
   */
  async cleanupOldFiles(): Promise<number> {
    try {
      const transactions = await storage.listTransactions();
      let cleanedFiles = 0;

      for (const transaction of transactions) {
        if (transaction.fileUrl && !transaction.fileUrl.startsWith('/uploads/transactions/')) {
          // هذا ملف قديم تم نقله، يمكن حذفه
          const oldPath = transaction.fileUrl.startsWith('/') 
            ? transaction.fileUrl.substring(1)
            : transaction.fileUrl;
          
          const fullOldPath = path.join(this.uploadsDir, oldPath);
          
          if (fs.existsSync(fullOldPath)) {
            try {
              fs.unlinkSync(fullOldPath);
              cleanedFiles++;
              console.log(`🗑️ تم حذف الملف القديم: ${oldPath}`);
            } catch (error) {
              console.error(`فشل حذف الملف القديم: ${oldPath}`, error);
            }
          }
        }
      }

      return cleanedFiles;
    } catch (error) {
      console.error('خطأ في تنظيف الملفات القديمة:', error);
      return 0;
    }
  }

  /**
   * تقرير حالة الملفات
   */
  async getFilesStatus(): Promise<{
    totalTransactions: number;
    transactionsWithFiles: number;
    oldFormatFiles: number;
    newFormatFiles: number;
    missingFiles: number;
  }> {
    try {
      const transactions = await storage.listTransactions();
      const status = {
        totalTransactions: transactions.length,
        transactionsWithFiles: 0,
        oldFormatFiles: 0,
        newFormatFiles: 0,
        missingFiles: 0
      };

      for (const transaction of transactions) {
        if (transaction.fileUrl) {
          status.transactionsWithFiles++;
          
          if (transaction.fileUrl.includes('/uploads/transactions/')) {
            status.newFormatFiles++;
          } else {
            status.oldFormatFiles++;
          }

          // التحقق من وجود الملف
          const filePath = transaction.fileUrl.startsWith('/') 
            ? transaction.fileUrl.substring(1)
            : transaction.fileUrl;
          
          if (!fs.existsSync(path.join(this.uploadsDir, filePath))) {
            status.missingFiles++;
          }
        }
      }

      return status;
    } catch (error) {
      console.error('خطأ في جلب حالة الملفات:', error);
      return {
        totalTransactions: 0,
        transactionsWithFiles: 0,
        oldFormatFiles: 0,
        newFormatFiles: 0,
        missingFiles: 0
      };
    }
  }
}

export const fileMigration = new FileMigration();