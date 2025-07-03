import { storage } from './storage';
import fs from 'fs';
import path from 'path';

interface CleanupResult {
  totalTransactions: number;
  processedTransactions: number;
  brokenLinksRemoved: number;
  validFilesFound: number;
  organizableFiles: number;
  errors: string[];
}

export class DatabaseCleanup {
  private uploadsDir = './uploads';

  /**
   * تنظيف قاعدة البيانات من الروابط المعطلة وتنظيم الملفات الموجودة
   */
  async cleanupDatabase(): Promise<CleanupResult> {
    const result: CleanupResult = {
      totalTransactions: 0,
      processedTransactions: 0,
      brokenLinksRemoved: 0,
      validFilesFound: 0,
      organizableFiles: 0,
      errors: []
    };

    try {
      const transactions = await storage.listTransactions();
      result.totalTransactions = transactions.length;

      console.log(`🔍 فحص ${result.totalTransactions} معاملة...`);

      for (const transaction of transactions) {
        if (!transaction.fileUrl) {
          continue; // تجاهل المعاملات بدون مرفقات
        }

        result.processedTransactions++;

        try {
          // فحص الروابط المعطلة
          if (this.isBrokenLink(transaction.fileUrl)) {
            await storage.updateTransaction(transaction.id, {
              fileUrl: null,
              fileType: null
            });
            result.brokenLinksRemoved++;
            console.log(`🗑️ إزالة رابط معطل للمعاملة ${transaction.id}`);
            continue;
          }

          // فحص الملفات المحلية الموجودة
          if (this.isLocalFile(transaction.fileUrl)) {
            const filePath = this.getLocalFilePath(transaction.fileUrl);
            if (fs.existsSync(filePath)) {
              result.validFilesFound++;
              
              // تحقق إذا كان الملف يحتاج لإعادة تنظيم
              if (!transaction.fileUrl.includes('/uploads/transactions/')) {
                result.organizableFiles++;
              }
            } else {
              // الملف المحلي غير موجود، إزالة المرجع
              await storage.updateTransaction(transaction.id, {
                fileUrl: null,
                fileType: null
              });
              result.brokenLinksRemoved++;
              console.log(`🗑️ إزالة مرجع ملف مفقود للمعاملة ${transaction.id}`);
            }
          } else {
            result.validFilesFound++; // ملف سحابي صالح
          }

        } catch (error) {
          result.errors.push(`خطأ في معالجة المعاملة ${transaction.id}: ${error}`);
        }

        // توقف قصير كل 50 معاملة
        if (result.processedTransactions % 50 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      console.log(`✅ اكتمل التنظيف: ${result.brokenLinksRemoved} رابط معطل تم حذفه، ${result.validFilesFound} ملف صالح`);
      return result;

    } catch (error) {
      result.errors.push(`خطأ عام في التنظيف: ${error}`);
      return result;
    }
  }

  /**
   * تنظيم الملفات الموجودة إلى بنية مجلدات محسنة
   */
  async organizeExistingFiles(): Promise<{ organized: number; errors: string[] }> {
    const result = { organized: 0, errors: [] };

    try {
      const transactions = await storage.listTransactions();

      for (const transaction of transactions) {
        if (!transaction.fileUrl || !this.isLocalFile(transaction.fileUrl)) {
          continue;
        }

        // تجاهل الملفات المنظمة بالفعل
        if (transaction.fileUrl.includes('/uploads/transactions/')) {
          continue;
        }

        try {
          const oldPath = this.getLocalFilePath(transaction.fileUrl);
          if (!fs.existsSync(oldPath)) {
            continue;
          }

          // إنشاء مجلد للمعاملة
          const newDir = path.join(this.uploadsDir, 'transactions', transaction.id.toString());
          if (!fs.existsSync(newDir)) {
            fs.mkdirSync(newDir, { recursive: true });
          }

          // تحديد اسم الملف الجديد
          const originalFileName = path.basename(oldPath);
          const newFileName = `${Date.now()}_${originalFileName}`;
          const newPath = path.join(newDir, newFileName);

          // نسخ الملف
          fs.copyFileSync(oldPath, newPath);

          // تحديث قاعدة البيانات
          const newUrl = `/uploads/transactions/${transaction.id}/${newFileName}`;
          await storage.updateTransaction(transaction.id, {
            fileUrl: newUrl
          });

          // حذف الملف القديم
          fs.unlinkSync(oldPath);

          result.organized++;
          console.log(`📁 تنظيم ملف المعاملة ${transaction.id}: ${newUrl}`);

        } catch (error) {
          result.errors.push(`خطأ في تنظيم المعاملة ${transaction.id}: ${String(error)}`);
        }
      }

      return result;
    } catch (error) {
      result.errors.push(`خطأ عام في التنظيم: ${String(error)}`);
      return result;
    }
  }

  /**
   * فحص إذا كان الرابط معطلاً
   */
  private isBrokenLink(fileUrl: string): boolean {
    return fileUrl.includes('firebasestorage.googleapis.com') ||
           fileUrl.includes('firebase') ||
           fileUrl.startsWith('http') && !fileUrl.includes('/uploads/');
  }

  /**
   * فحص إذا كان الملف محلياً
   */
  private isLocalFile(fileUrl: string): boolean {
    return fileUrl.startsWith('/uploads/') || !fileUrl.startsWith('http');
  }

  /**
   * الحصول على مسار الملف المحلي
   */
  private getLocalFilePath(fileUrl: string): string {
    let cleanPath = fileUrl;
    if (cleanPath.startsWith('/uploads/')) {
      cleanPath = cleanPath.substring(9); // إزالة /uploads/
    }
    return path.join(this.uploadsDir, cleanPath);
  }

  /**
   * تقرير حالة النظام
   */
  async getSystemStatus(): Promise<{
    totalTransactions: number;
    transactionsWithFiles: number;
    brokenLinks: number;
    validLocalFiles: number;
    validCloudFiles: number;
    unorganizedFiles: number;
    diskUsage: { totalSize: number; fileCount: number };
  }> {
    try {
      const transactions = await storage.listTransactions();
      const status = {
        totalTransactions: transactions.length,
        transactionsWithFiles: 0,
        brokenLinks: 0,
        validLocalFiles: 0,
        validCloudFiles: 0,
        unorganizedFiles: 0,
        diskUsage: { totalSize: 0, fileCount: 0 }
      };

      for (const transaction of transactions) {
        if (!transaction.fileUrl) continue;
        
        status.transactionsWithFiles++;

        if (this.isBrokenLink(transaction.fileUrl)) {
          status.brokenLinks++;
        } else if (this.isLocalFile(transaction.fileUrl)) {
          const filePath = this.getLocalFilePath(transaction.fileUrl);
          if (fs.existsSync(filePath)) {
            status.validLocalFiles++;
            if (!transaction.fileUrl.includes('/uploads/transactions/')) {
              status.unorganizedFiles++;
            }
            // حساب حجم الملف
            try {
              const stats = fs.statSync(filePath);
              status.diskUsage.totalSize += stats.size;
              status.diskUsage.fileCount++;
            } catch (e) {
              // تجاهل أخطاء قراءة حجم الملف
            }
          }
        } else {
          status.validCloudFiles++;
        }
      }

      return status;
    } catch (error) {
      console.error('خطأ في جلب حالة النظام:', error);
      return {
        totalTransactions: 0,
        transactionsWithFiles: 0,
        brokenLinks: 0,
        validLocalFiles: 0,
        validCloudFiles: 0,
        unorganizedFiles: 0,
        diskUsage: { totalSize: 0, fileCount: 0 }
      };
    }
  }
}

export const databaseCleanup = new DatabaseCleanup();