import { db } from './db';
import { writeFileSync, existsSync, mkdirSync, cpSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { storage } from './storage';
import { createWriteStream, createReadStream } from 'fs';
import archiver from 'archiver';

export class BackupSystem {
  private backupDir = path.join(process.cwd(), 'backups');
  private maxBackups = 30; // الاحتفاظ بـ 30 نسخة احتياطية

  constructor() {
    // إنشاء مجلد النسخ الاحتياطي إذا لم يكن موجوداً
    if (!existsSync(this.backupDir)) {
      mkdirSync(this.backupDir, { recursive: true });
    }
  }

  // إنشاء نسخة احتياطية كاملة مع المرفقات
  async createFullBackup(): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const archiveName = `backup-${timestamp}.zip`;
      const archivePath = path.join(this.backupDir, archiveName);

      // إنشاء أرشيف مضغوط
      const output = createWriteStream(archivePath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      return new Promise<string>((resolve, reject) => {
        output.on('close', () => {
          console.log(`تم إنشاء نسخة احتياطية مع المرفقات: ${archiveName} (${archive.pointer()} bytes)`);
          // تنظيف النسخ القديمة
          this.cleanOldBackups().finally(() => resolve(archiveName));
        });

        archive.on('error', (err) => {
          console.error('خطأ في إنشاء الأرشيف:', err);
          reject(err);
        });

        archive.pipe(output);

        this.createBackupContent(archive).then(() => {
          archive.finalize();
        }).catch(reject);
      });
    } catch (error) {
      console.error('خطأ في إنشاء النسخة الاحتياطية:', error);
      throw error;
    }
  }

  // إنشاء محتوى النسخة الاحتياطية
  private async createBackupContent(archive: archiver.Archiver): Promise<void> {
    // جمع جميع البيانات
    const backupData = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      data: {
        users: await storage.listUsers(),
        projects: await storage.listProjects(),
        transactions: await storage.listTransactions(),
        documents: await storage.listDocuments(),
        settings: await storage.listSettings(),
        funds: await storage.listFunds(),
        activityLogs: await storage.listActivityLogs()
      }
    };

    // إزالة كلمات المرور من النسخة الاحتياطية لأغراض الأمان
    backupData.data.users = backupData.data.users.map(user => ({
      ...user,
      password: '[ENCRYPTED]'
    }));

    // إضافة ملف البيانات JSON إلى الأرشيف
    archive.append(JSON.stringify(backupData, null, 2), { name: 'data.json' });

    // إضافة المرفقات
    await this.addAttachmentsToArchive(archive, backupData.data.transactions, backupData.data.documents);
  }

  // إضافة المرفقات إلى الأرشيف
  private async addAttachmentsToArchive(archive: archiver.Archiver, transactions: any[], documents: any[]): Promise<void> {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    
    if (!existsSync(uploadsDir)) {
      console.log('مجلد uploads غير موجود، سيتم تخطي المرفقات');
      return;
    }

    // إنشاء مجموعة من الملفات المطلوب نسخها لتجنب التكرار
    const filesToBackup = new Set<string>();

    // جمع ملفات المعاملات
    transactions.forEach(transaction => {
      if (transaction.fileUrl) {
        try {
          // استخراج المسار النسبي من URL
          const relativeFilePath = this.extractFilePathFromUrl(transaction.fileUrl);
          if (relativeFilePath) {
            filesToBackup.add(relativeFilePath);
          }
        } catch (error) {
          console.warn(`فشل في معالجة مرفق المعاملة ${transaction.id}:`, error);
        }
      }
    });

    // جمع ملفات المستندات
    documents.forEach(document => {
      if (document.fileUrl) {
        try {
          const relativeFilePath = this.extractFilePathFromUrl(document.fileUrl);
          if (relativeFilePath) {
            filesToBackup.add(relativeFilePath);
          }
        } catch (error) {
          console.warn(`فشل في معالجة مرفق المستند ${document.id}:`, error);
        }
      }
    });

    // إضافة الملفات إلى الأرشيف
    let addedFilesCount = 0;
    for (const relativeFilePath of Array.from(filesToBackup)) {
      try {
        const fullFilePath = path.join(uploadsDir, relativeFilePath);
        
        if (existsSync(fullFilePath)) {
          // التأكد من أن الملف قابل للقراءة
          const stats = statSync(fullFilePath);
          if (stats.isFile()) {
            archive.file(fullFilePath, { name: `attachments/${relativeFilePath}` });
            addedFilesCount++;
          }
        } else {
          console.warn(`الملف غير موجود: ${fullFilePath}`);
        }
      } catch (error) {
        console.warn(`فشل في إضافة الملف ${relativeFilePath} للأرشيف:`, error);
      }
    }

    console.log(`تم إضافة ${addedFilesCount} مرفق إلى النسخة الاحتياطية`);
  }

  // استخراج مسار الملف من URL
  private extractFilePathFromUrl(fileUrl: string): string | null {
    try {
      // إذا كان URL محلي يبدأ بـ /uploads/
      if (fileUrl.startsWith('/uploads/')) {
        return fileUrl.replace('/uploads/', '');
      }
      
      // إذا كان URL كامل
      const url = new URL(fileUrl);
      const pathname = url.pathname;
      
      if (pathname.includes('/uploads/')) {
        return pathname.split('/uploads/')[1];
      }
      
      return null;
    } catch (error) {
      console.warn('فشل في تحليل URL:', fileUrl, error);
      return null;
    }
  }

  // تنظيف النسخ الاحتياطية القديمة
  private async cleanOldBackups(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files
        .filter(file => file.startsWith('backup-') && (file.endsWith('.json') || file.endsWith('.zip')))
        .sort()
        .reverse();

      // حذف النسخ الزائدة
      if (backupFiles.length > this.maxBackups) {
        const filesToDelete = backupFiles.slice(this.maxBackups);
        for (const file of filesToDelete) {
          await fs.unlink(path.join(this.backupDir, file));
          console.log(`تم حذف النسخة الاحتياطية القديمة: ${file}`);
        }
      }
    } catch (error) {
      console.error('خطأ في تنظيف النسخ الاحتياطية:', error);
    }
  }

  // جدولة النسخ الاحتياطي التلقائي
  startAutoBackup(): void {
    // نسخة احتياطية كل 12 ساعة (لتقليل الضغط على النظام)
    const backupInterval = 12 * 60 * 60 * 1000; // 12 ساعة بالميلي ثانية

    setInterval(async () => {
      try {
        // تشغيل النسخ الاحتياطي في الخلفية دون التأثير على الأداء
        setImmediate(async () => {
          await this.createFullBackup();
          console.log('تم إجراء النسخ الاحتياطي التلقائي بنجاح');
        });
      } catch (error) {
        console.error('فشل في النسخ الاحتياطي التلقائي:', error);
      }
    }, backupInterval);

    // إنشاء أول نسخة احتياطية عند بدء النظام (مؤجل لتحسين الأداء)
    setTimeout(async () => {
      try {
        setImmediate(async () => {
          await this.createFullBackup();
          console.log('تم إنشاء النسخة الاحتياطية الأولى عند بدء النظام');
        });
      } catch (error) {
        console.error('فشل في إنشاء النسخة الاحتياطية الأولى:', error);
      }
    }, 30000); // بعد 30 ثانية من بدء النظام (بدلاً من 5 ثوان)

    console.log('تم تفعيل النسخ الاحتياطي التلقائي (كل 12 ساعة)');
  }

  // إنشاء نسخة احتياطية طوارئ قبل العمليات الحساسة (مع المرفقات)
  async createEmergencyBackup(operation: string): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const archiveName = `emergency-${operation}-${timestamp}.zip`;
      const archivePath = path.join(this.backupDir, archiveName);

      // إنشاء أرشيف مضغوط
      const output = createWriteStream(archivePath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      return new Promise<string>((resolve, reject) => {
        output.on('close', () => {
          console.log(`تم إنشاء نسخة احتياطية طوارئ مع المرفقات: ${archiveName} (${archive.pointer()} bytes)`);
          resolve(archiveName);
        });

        archive.on('error', (err) => {
          console.error('خطأ في إنشاء الأرشيف الطارئ:', err);
          reject(err);
        });

        archive.pipe(output);

        this.createEmergencyBackupContent(archive, operation).then(() => {
          archive.finalize();
        }).catch(reject);
      });
    } catch (error) {
      console.error('خطأ في إنشاء نسخة احتياطية طوارئ:', error);
      throw error;
    }
  }

  // إنشاء محتوى النسخة الاحتياطية الطارئة
  private async createEmergencyBackupContent(archive: archiver.Archiver, operation: string): Promise<void> {
    const backupData = {
      timestamp: new Date().toISOString(),
      type: 'emergency',
      operation: operation,
      version: '1.0.0',
      data: {
        users: await storage.listUsers(),
        projects: await storage.listProjects(),
        transactions: await storage.listTransactions(),
        documents: await storage.listDocuments(),
        settings: await storage.listSettings(),
        funds: await storage.listFunds()
      }
    };

    // إزالة كلمات المرور
    backupData.data.users = backupData.data.users.map(user => ({
      ...user,
      password: '[ENCRYPTED]'
    }));

    // إضافة ملف البيانات JSON إلى الأرشيف
    archive.append(JSON.stringify(backupData, null, 2), { name: 'emergency-data.json' });

    // إضافة المرفقات
    await this.addAttachmentsToArchive(archive, backupData.data.transactions, backupData.data.documents);
  }

  // الحصول على قائمة النسخ الاحتياطية المتاحة
  async getAvailableBackups(): Promise<Array<{name: string, date: Date, size: number, type: string, hasAttachments: boolean}>> {
    try {
      const fs = await import('fs/promises');
      const files = await fs.readdir(this.backupDir);
      const backupFiles = [];

      for (const file of files) {
        if ((file.endsWith('.json') || file.endsWith('.zip')) && (file.startsWith('backup-') || file.startsWith('emergency-'))) {
          const filepath = path.join(this.backupDir, file);
          const stats = await fs.stat(filepath);
          const isZip = file.endsWith('.zip');
          const isEmergency = file.startsWith('emergency-');
          
          backupFiles.push({
            name: file,
            date: stats.mtime,
            size: stats.size,
            type: isEmergency ? 'emergency' : 'regular',
            hasAttachments: isZip
          });
        }
      }

      return backupFiles.sort((a, b) => b.date.getTime() - a.date.getTime());
    } catch (error) {
      console.error('خطأ في جلب قائمة النسخ الاحتياطية:', error);
      return [];
    }
  }
}

// إنشاء مثيل واحد للنظام
export const backupSystem = new BackupSystem();