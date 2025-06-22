import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { neon } from '@neondatabase/serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import { db } from './db';

neonConfig.webSocketConstructor = ws;

// إعداد قاعدة البيانات الاحتياطية
let backupPool: Pool | null = null;
let backupDb: any = null;
let isBackupConnected = false;

// إنشاء pool للقاعدة الرئيسية للفحص
let primaryPool: Pool | null = null;

// متغير لتتبع حالة قاعدة البيانات الرئيسية
let isPrimaryDbFailed = false;

// دالة لإنشاء اتصال قاعدة البيانات الاحتياطية
export async function initializeBackupDatabase() {
  try {
    // استخدام نفس متغيرات البيئة مع إضافة "_BACKUP" للقاعدة الاحتياطية
    const backupUrl = process.env.DATABASE_URL_BACKUP || process.env.DATABASE_URL;
    
    if (!backupUrl) {
      console.warn('لم يتم تكوين قاعدة البيانات الاحتياطية');
      return false;
    }

    // إنشاء pool للقاعدة الاحتياطية
    backupPool = new Pool({ connectionString: backupUrl });
    backupDb = drizzle({ client: backupPool, schema });
    
    // إنشاء pool للقاعدة الرئيسية للفحص
    if (!primaryPool && process.env.DATABASE_URL) {
      primaryPool = new Pool({ connectionString: process.env.DATABASE_URL });
    }
    
    // اختبار الاتصال
    await backupPool.query('SELECT 1');
    isBackupConnected = true;
    
    console.log('✅ تم تكوين قاعدة البيانات الاحتياطية بنجاح');
    return true;
  } catch (error) {
    console.error('❌ فشل في تكوين قاعدة البيانات الاحتياطية:', error);
    isBackupConnected = false;
    return false;
  }
}

// دالة للحصول على قاعدة البيانات النشطة (الرئيسية أو الاحتياطية)
export function getActiveDatabase() {
  if (isPrimaryDbFailed && isBackupConnected) {
    console.log('🔄 استخدام قاعدة البيانات الاحتياطية');
    return backupDb;
  }
  
  // إرجاع قاعدة البيانات الرئيسية
  return db;
}

// دالة لتسجيل فشل قاعدة البيانات الرئيسية
export function markPrimaryDatabaseAsFailed() {
  isPrimaryDbFailed = true;
  console.warn('⚠️ تم تسجيل فشل قاعدة البيانات الرئيسية - التبديل إلى الاحتياطية');
}

// دالة لاستعادة قاعدة البيانات الرئيسية
export function restorePrimaryDatabase() {
  isPrimaryDbFailed = false;
  console.log('✅ تم استعادة قاعدة البيانات الرئيسية');
}

// دالة للتحقق من حالة قواعد البيانات
export async function checkDatabasesHealth(): Promise<{
  primary: boolean;
  backup: boolean;
  active: 'primary' | 'backup' | 'none';
}> {
  let primaryHealthy = false;
  let backupHealthy = false;

  // فحص قاعدة البيانات الرئيسية
  try {
    if (primaryPool) {
      await primaryPool.query('SELECT 1');
      primaryHealthy = true;
    }
  } catch (error: any) {
    console.error('قاعدة البيانات الرئيسية غير متاحة:', error.message);
  }

  // فحص قاعدة البيانات الاحتياطية
  try {
    if (backupPool) {
      await backupPool.query('SELECT 1');
      backupHealthy = true;
    }
  } catch (error: any) {
    console.error('قاعدة البيانات الاحتياطية غير متاحة:', error.message);
    isBackupConnected = false;
  }

  // تحديد قاعدة البيانات النشطة
  let active: 'primary' | 'backup' | 'none' = 'none';
  
  if (primaryHealthy && !isPrimaryDbFailed) {
    active = 'primary';
  } else if (backupHealthy) {
    active = 'backup';
    if (!isPrimaryDbFailed) {
      markPrimaryDatabaseAsFailed();
    }
  } else if (primaryHealthy && isPrimaryDbFailed) {
    // استعادة قاعدة البيانات الرئيسية إذا عادت للعمل
    restorePrimaryDatabase();
    active = 'primary';
  }

  return {
    primary: primaryHealthy,
    backup: backupHealthy,
    active
  };
}

// دالة لمزامنة البيانات بين قواعد البيانات
export async function syncDatabaseToBackup(): Promise<boolean> {
  if (!isBackupConnected || !backupDb) {
    console.warn('قاعدة البيانات الاحتياطية غير متاحة للمزامنة');
    return false;
  }

  try {
    const { db } = require('./db');
    
    console.log('🔄 بدء مزامنة البيانات إلى قاعدة البيانات الاحتياطية...');
    
    // مزامنة الجداول الأساسية (يمكن توسيعها حسب الحاجة)
    const tables = ['users', 'projects', 'transactions', 'documents', 'settings'];
    
    for (const tableName of tables) {
      try {
        // قراءة البيانات من قاعدة البيانات الرئيسية
        const data = await db.select().from(schema[tableName]);
        
        if (data.length > 0) {
          // مسح البيانات القديمة من قاعدة البيانات الاحتياطية
          await backupDb.delete(schema[tableName]);
          
          // إدراج البيانات الجديدة
          await backupDb.insert(schema[tableName]).values(data);
          
          console.log(`✅ تم مزامنة جدول ${tableName} - ${data.length} سجل`);
        }
      } catch (error) {
        console.error(`❌ فشل في مزامنة جدول ${tableName}:`, error.message);
      }
    }
    
    console.log('✅ تمت مزامنة البيانات بنجاح');
    return true;
  } catch (error) {
    console.error('❌ فشل في مزامنة البيانات:', error);
    return false;
  }
}

// دالة للتبديل اليدوي بين قواعد البيانات
export async function switchDatabase(target: 'primary' | 'backup'): Promise<boolean> {
  try {
    if (target === 'backup') {
      if (!isBackupConnected) {
        const initialized = await initializeBackupDatabase();
        if (!initialized) {
          throw new Error('فشل في تهيئة قاعدة البيانات الاحتياطية');
        }
      }
      markPrimaryDatabaseAsFailed();
    } else {
      restorePrimaryDatabase();
    }
    
    console.log(`✅ تم التبديل إلى قاعدة البيانات ${target === 'primary' ? 'الرئيسية' : 'الاحتياطية'}`);
    return true;
  } catch (error) {
    console.error(`❌ فشل في التبديل إلى قاعدة البيانات ${target}:`, error);
    return false;
  }
}

// تصدير المتغيرات والدوال
export {
  backupPool,
  backupDb,
  isBackupConnected,
  isPrimaryDbFailed
};