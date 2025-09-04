// استيراد المكتبات اللازمة
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../shared/schema';
import { logger } from '../shared/logger';

// إنشاء دالة للاتصال بقاعدة البيانات
function createDatabaseConnection() {
  const url = process.env.DATABASE_URL;
  
  if (!url) {
    logger.warn('DATABASE_URL is not set. Running in limited mode. DB calls will throw if invoked.');
    return null;
  }
  
  try {
    // طباعة معلومات الاتصال للتصحيح (مع إخفاء البيانات الحساسة)
    const maskedUrl = url.replace(/:[^:]*@/, ':****@');
    logger.log(`Connecting to database (direct)… URL: ${maskedUrl.substring(0, 60)}...`);

    const sql = postgres(url, { ssl: 'require' });
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