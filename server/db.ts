// تم تعديل هذا الملف لاستخدام Supabase فقط في الإنتاج
import dotenv from 'dotenv';
dotenv.config({ override: true });
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../shared/schema';
import { logger } from '../shared/logger';

// إنشاء دالة للاتصال بقاعدة البيانات (للبيئات التي تحتاج اتصال مباشر فقط)
function createDatabaseConnection() {
  const url = process.env.DATABASE_URL;
  
  if (!url) {
    logger.warn('DATABASE_URL is not set. This is expected when using Supabase client API only.');
    return null;
  }
  
  try {
    // طباعة معلومات الاتصال للتصحيح (مع إخفاء البيانات الحساسة)
    const maskedUrl = url.replace(/:[^:]*@/, ':****@');
    logger.log(`Connecting to database (direct)… URL: ${maskedUrl.substring(0, 60)}...`);

    const sql = postgres(url, { 
      ssl: 'require',
      prepare: false,
      transform: {
        undefined: null,
      },
      connect_timeout: 10
    });
    const db = drizzle(sql, { schema });

    // اختبار الاتصال
    sql`SELECT 1`.then(() => {
      logger.log('Direct database connection successful');
    }).catch(err => {
      logger.error('Direct database connection test failed:', err);
    });

    return db as any;
  } catch (error) {
    logger.error('Failed to create database connection:', error);
    return null;
  }
}

// إنشاء اتصال قاعدة البيانات
const dbInstance = createDatabaseConnection();

// إنشاء كائن آمن للوصول إلى قاعدة البيانات
export const db = dbInstance ? dbInstance : new Proxy(
  {},
  {
    get(_target, prop) {
      throw new Error(
        `Database not configured or connection failed (DATABASE_URL missing or invalid). Attempted to access db.${String(prop)}. Set DATABASE_URL in environment.`
      );
    },
  }
);

// تصدير أنواع البيانات من المخطط
export * from '../shared/schema';