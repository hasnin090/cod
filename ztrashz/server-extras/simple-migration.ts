import { storage } from './storage';
import fs from 'fs';
import path from 'path';

interface SimpleMigrationResult {
  totalChecked: number;
  brokenLinksFixed: number;
  validFilesFound: number;
  organizedFiles: number;
  summary: string;
}

export class SimpleMigration {
  private uploadsDir = './uploads';

  /**
   * تنظيف شامل وبسيط لقاعدة البيانات والملفات
   */
  async performCompleteMigration(): Promise<SimpleMigrationResult> {
    const result: SimpleMigrationResult = {
      totalChecked: 0,
      brokenLinksFixed: 0,
      validFilesFound: 0,
      organizedFiles: 0,
      summary: ''
    };

    console.log('🔄 بدء التنظيف الشامل للنظام...');

    try {
      const transactions = await storage.listTransactions();
      result.totalChecked = transactions.length;

      for (const transaction of transactions) {
        if (!transaction.fileUrl) continue;

        // إصلاح الروابط المعطلة
        if (this.isBrokenFirebaseLink(transaction.fileUrl)) {
          await storage.updateTransaction(transaction.id, {
            fileUrl: null,
            fileType: null
          });
          result.brokenLinksFixed++;
          continue;
        }

        // معالجة الملفات المحلية
        if (this.isValidLocalFile(transaction.fileUrl)) {
          result.validFilesFound++;
          
          // تنظيم الملفات غير المنظمة
          if (!transaction.fileUrl.includes('/uploads/transactions/')) {
            const organized = await this.organizeFile(transaction);
            if (organized) {
              result.organizedFiles++;
            }
          }
        }
      }

      result.summary = `تم فحص ${result.totalChecked} معاملة، إصلاح ${result.brokenLinksFixed} رابط معطل، العثور على ${result.validFilesFound} ملف صالح، تنظيم ${result.organizedFiles} ملف`;
      
      console.log(`✅ ${result.summary}`);
      return result;

    } catch (error) {
      console.error('خطأ في التنظيف:', error);
      throw error;
    }
  }

  /**
   * فحص الروابط المعطلة من Firebase
   */
  private isBrokenFirebaseLink(fileUrl: string): boolean {
    return fileUrl.includes('firebasestorage.googleapis.com') ||
           fileUrl.includes('firebase.app') ||
           (fileUrl.startsWith('http') && !fileUrl.includes('/uploads/'));
  }

  /**
   * فحص الملفات المحلية الصالحة
   */
  private isValidLocalFile(fileUrl: string): boolean {
    if (!fileUrl.startsWith('/uploads/')) return false;
    
    const filePath = path.join('.', fileUrl);
    return fs.existsSync(filePath);
  }

  /**
   * تنظيم ملف واحد
   */
  private async organizeFile(transaction: any): Promise<boolean> {
    try {
      const oldPath = path.join('.', transaction.fileUrl);
      if (!fs.existsSync(oldPath)) return false;

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

      console.log(`📁 تنظيم ملف المعاملة ${transaction.id}`);
      return true;

    } catch (error) {
      console.error(`خطأ في تنظيم ملف المعاملة ${transaction.id}:`, error);
      return false;
    }
  }

  /**
   * حالة النظام المبسطة
   */
  async getSimpleStatus(): Promise<{
    totalTransactions: number;
    withFiles: number;
    brokenLinks: number;
    validFiles: number;
    organizedFiles: number;
  }> {
    try {
      const transactions = await storage.listTransactions();
      const status = {
        totalTransactions: transactions.length,
        withFiles: 0,
        brokenLinks: 0,
        validFiles: 0,
        organizedFiles: 0
      };

      for (const transaction of transactions) {
        if (!transaction.fileUrl) continue;
        
        status.withFiles++;

        if (this.isBrokenFirebaseLink(transaction.fileUrl)) {
          status.brokenLinks++;
        } else if (this.isValidLocalFile(transaction.fileUrl)) {
          status.validFiles++;
          if (transaction.fileUrl.includes('/uploads/transactions/')) {
            status.organizedFiles++;
          }
        }
      }

      return status;
    } catch (error) {
      console.error('خطأ في الحصول على الحالة:', error);
      return {
        totalTransactions: 0,
        withFiles: 0,
        brokenLinks: 0,
        validFiles: 0,
        organizedFiles: 0
      };
    }
  }
}

export const simpleMigration = new SimpleMigration();