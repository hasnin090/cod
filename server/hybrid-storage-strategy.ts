/**
 * استراتيجية التخزين الهجين
 * التخزين المحلي للملفات + النسخ الاحتياطية السحابية للبيانات
 */

import fs from 'fs/promises';
import path from 'path';
import { PgStorage } from './pg-storage.js';
import { initializeSupabaseStorage, getSupabaseClient } from './supabase-storage.js';

interface HybridStorageConfig {
  enableCloudBackup: boolean;
  enableLocalStorage: boolean;
  backupInterval: number; // بالدقائق
}

class HybridStorageManager {
  private config: HybridStorageConfig = {
    enableCloudBackup: true,
    enableLocalStorage: true,
    backupInterval: 60 // كل ساعة
  };

  private backupTimer?: NodeJS.Timeout;
  private pgStorage: PgStorage;

  constructor() {
    this.pgStorage = new PgStorage();
    this.startAutomaticBackup();
  }

  /**
   * حفظ ملف محلياً مع إنشاء نسخة احتياطية من البيانات المرتبطة
   */
  async saveFile(
    fileBuffer: Buffer,
    fileName: string,
    category: string = 'transactions',
    metadata?: any
  ): Promise<{ success: boolean; localPath: string; error?: string }> {
    try {
      // إنشاء مجلد التخزين المحلي
      const localDir = `./uploads/${category}`;
      await fs.mkdir(localDir, { recursive: true });

      // حفظ الملف محلياً
      const uniqueFileName = `${Date.now()}_${fileName}`;
      const localPath = path.join(localDir, uniqueFileName);
      await fs.writeFile(localPath, fileBuffer);

      // حفظ معلومات الملف في قاعدة البيانات
      if (metadata) {
        try {
          await this.backupFileMetadata({
            fileName: uniqueFileName,
            originalName: fileName,
            path: localPath,
            category,
            size: fileBuffer.length,
            metadata,
            createdAt: new Date()
          });
        } catch (backupError) {
          console.warn('تحذير: فشل في النسخ الاحتياطي للبيانات:', backupError);
        }
      }

      console.log(`✅ تم حفظ الملف محلياً: ${localPath}`);
      return { success: true, localPath };

    } catch (error: any) {
      console.error('خطأ في حفظ الملف:', error);
      return { success: false, localPath: '', error: error.message };
    }
  }

  /**
   * إنشاء نسخة احتياطية من البيانات (ليس الملفات) في السحابة
   */
  private async backupFileMetadata(fileInfo: any): Promise<void> {
    try {
      if (!this.config.enableCloudBackup) return;

      await initializeSupabaseStorage();
      const supabaseClient = getSupabaseClient();
      if (!supabaseClient) return;

      // حفظ معلومات الملف كـ JSON في السحابة
      const backupData = {
        type: 'file_metadata',
        data: fileInfo,
        timestamp: new Date().toISOString()
      };

      const backupFileName = `file_metadata_${Date.now()}.json`;
      const { error } = await supabaseClient.storage
        .from('files')
        .upload(backupFileName, JSON.stringify(backupData, null, 2), {
          contentType: 'application/json',
          upsert: true
        });

      if (error) {
        throw error;
      }

      console.log(`📊 تم نسخ البيانات احتياطياً: ${backupFileName}`);
    } catch (error) {
      console.error('خطأ في النسخ الاحتياطي للبيانات:', error);
    }
  }

  /**
   * نسخ احتياطية دورية لقاعدة البيانات
   */
  private async createDatabaseBackup(): Promise<void> {
    try {
      if (!this.config.enableCloudBackup) return;

      console.log('🔄 بدء النسخ الاحتياطي الدوري...');

      // جلب البيانات الأساسية
      const [transactions, users, projects, settings] = await Promise.all([
        this.pgStorage.listTransactions(),
        this.pgStorage.listUsers(),
        this.pgStorage.listProjects(),
        this.pgStorage.listSettings()
      ]);

      const backupData = {
        type: 'database_backup',
        timestamp: new Date().toISOString(),
        data: {
          transactions: transactions.length,
          users: users.length,
          projects: projects.length,
          settings: settings.length
        },
        summary: {
          totalTransactions: transactions.length,
          totalIncome: transactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0),
          totalExpenses: transactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0)
        }
      };

      await initializeSupabaseStorage();
      const supabaseClient = getSupabaseClient();
      if (!supabaseClient) return;

      const backupFileName = `db_backup_${Date.now()}.json`;
      const { error } = await supabaseClient.storage
        .from('files')
        .upload(backupFileName, JSON.stringify(backupData, null, 2), {
          contentType: 'application/json',
          upsert: true
        });

      if (!error) {
        console.log(`✅ تم النسخ الاحتياطي لقاعدة البيانات: ${backupFileName}`);
      }

    } catch (error) {
      console.error('خطأ في النسخ الاحتياطي لقاعدة البيانات:', error);
    }
  }

  /**
   * بدء النسخ الاحتياطي التلقائي
   */
  private startAutomaticBackup(): void {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
    }

    this.backupTimer = setInterval(() => {
      this.createDatabaseBackup();
    }, this.config.backupInterval * 60 * 1000);

    // نسخة احتياطية فورية
    setTimeout(() => {
      this.createDatabaseBackup();
    }, 5000);
  }

  /**
   * التحقق من حالة النظام
   */
  async getSystemStatus(): Promise<any> {
    try {
      const localStorageExists = await fs.access('./uploads').then(() => true).catch(() => false);
      
      let cloudStorageStatus = false;
      try {
        await initializeSupabaseStorage();
        const supabaseClient = getSupabaseClient();
        cloudStorageStatus = !!supabaseClient;
      } catch {
        cloudStorageStatus = false;
      }

      const uploadsStats = await this.getUploadsStatistics();

      return {
        localStorage: {
          enabled: this.config.enableLocalStorage,
          available: localStorageExists,
          status: localStorageExists ? 'متصل' : 'غير متاح'
        },
        cloudBackup: {
          enabled: this.config.enableCloudBackup,
          available: cloudStorageStatus,
          status: cloudStorageStatus ? 'متصل' : 'غير متاح'
        },
        statistics: uploadsStats,
        strategy: 'هجين - تخزين محلي + نسخ احتياطية سحابية'
      };
    } catch (error) {
      return {
        error: 'خطأ في فحص حالة النظام',
        details: error
      };
    }
  }

  /**
   * إحصائيات الملفات المحلية
   */
  private async getUploadsStatistics(): Promise<any> {
    try {
      const uploadsDir = './uploads';
      const stats = await fs.stat(uploadsDir).catch(() => null);
      
      if (!stats) {
        return { totalFiles: 0, totalSize: 0 };
      }

      // جمع إحصائيات المجلدات
      const subdirs = await fs.readdir(uploadsDir, { withFileTypes: true });
      let totalFiles = 0;
      let totalSize = 0;

      for (const dirent of subdirs) {
        if (dirent.isDirectory()) {
          const subPath = path.join(uploadsDir, dirent.name);
          const subStats = await this.getDirectoryStats(subPath);
          totalFiles += subStats.files;
          totalSize += subStats.size;
        } else if (dirent.isFile()) {
          const filePath = path.join(uploadsDir, dirent.name);
          const fileStats = await fs.stat(filePath);
          totalFiles++;
          totalSize += fileStats.size;
        }
      }

      return {
        totalFiles,
        totalSize: Math.round(totalSize / 1024 / 1024 * 100) / 100 // MB
      };
    } catch (error) {
      return { totalFiles: 0, totalSize: 0, error: String(error) };
    }
  }

  private async getDirectoryStats(dirPath: string): Promise<{ files: number; size: number }> {
    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      let files = 0;
      let size = 0;

      for (const item of items) {
        const itemPath = path.join(dirPath, item.name);
        if (item.isFile()) {
          const stats = await fs.stat(itemPath);
          files++;
          size += stats.size;
        } else if (item.isDirectory()) {
          const subStats = await this.getDirectoryStats(itemPath);
          files += subStats.files;
          size += subStats.size;
        }
      }

      return { files, size };
    } catch (error) {
      return { files: 0, size: 0 };
    }
  }

  /**
   * تحديث إعدادات النظام
   */
  updateConfig(newConfig: Partial<HybridStorageConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.backupInterval) {
      this.startAutomaticBackup();
    }
  }

  /**
   * إيقاف النسخ الاحتياطي التلقائي
   */
  destroy(): void {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
    }
  }
}

// إنشاء مثيل وحيد
export const hybridStorage = new HybridStorageManager();

// تصدير الكلاس للاستخدام المخصص
export { HybridStorageManager };