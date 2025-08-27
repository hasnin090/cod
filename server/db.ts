// استيراد المكتبات اللازمة
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
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
    const maskedUrl = url.replace(/:[^:]*@/, '****@' );
    logger.log(`Connecting to database... URL format: ${maskedUrl.substring(0, 50)}...`);
    
    const sql = neon(url);
    const db = drizzle(sql, { 
      schema,
      logger: {
        query: (query, params) => {
          logger.log(`Executing query: ${query} with params:`, params);
        },
        error: (error) => {
          logger.error(`Database error:`, error);
        }
      }
    });
    
    // اختبار الاتصال
    sql`SELECT 1;`.then(() => {
      logger.log('Database connection successful');
    }).catch(err => {
      logger.error('Database connection test failed:', err);
    });
    
    return db;
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