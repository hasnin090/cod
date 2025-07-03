import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@shared/schema';
import fs from 'fs';
import path from 'path';

// متغيرات البيئة لـ Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://yieyqusnciiithjtlgod.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_DATABASE_URL = process.env.SUPABASE_DATABASE_URL;

let supabaseClient: SupabaseClient | null = null;
let supabaseDb: any = null;
let supabaseConnection: any = null;
let isSupabaseConnected = false;

// تهيئة اتصال Supabase
export async function initializeSupabase(): Promise<boolean> {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.warn('متغيرات بيئة Supabase غير مكتملة');
      return false;
    }

    // إنشاء عميل Supabase (هذا يعمل دائماً)
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    let dbConnected = false;
    
    // محاولة اتصال قاعدة البيانات المباشر (اختياري)
    if (SUPABASE_DATABASE_URL) {
      try {
        supabaseConnection = postgres(SUPABASE_DATABASE_URL, {
          connect_timeout: 5, // تقليل timeout إلى 5 ثوانِ
          idle_timeout: 10,
          max_lifetime: 60 * 30,
          ssl: 'require',
          max: 3, // تقليل عدد الاتصالات المتزامنة
        });
        supabaseDb = drizzle(supabaseConnection, { schema });
        
        // اختبار سريع للاتصال
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database connection timeout')), 3000)
        );
        
        const testQuery = supabaseConnection`SELECT 1`;
        await Promise.race([testQuery, timeoutPromise]);
        dbConnected = true;
        console.log('✅ اتصال مباشر بقاعدة بيانات Supabase');
      } catch (dbError) {
        console.warn('⚠️ فشل الاتصال المباشر بقاعدة البيانات Supabase، استخدام API فقط:', dbError.message);
        supabaseConnection = null;
        supabaseDb = null;
      }
    }

    isSupabaseConnected = true;
    console.log(`✅ تم تكوين Supabase (عميل: نعم، قاعدة بيانات: ${dbConnected ? 'نعم' : 'لا'})`);
    return true;
  } catch (error) {
    console.error('❌ فشل في تكوين Supabase:', error);
    isSupabaseConnected = false;
    return false;
  }
}

// الحصول على عميل Supabase
export function getSupabaseClient(): SupabaseClient | null {
  return supabaseClient;
}

// الحصول على قاعدة بيانات Supabase
export function getSupabaseDatabase() {
  return supabaseDb;
}

// فحص حالة اتصال Supabase
export async function checkSupabaseHealth(): Promise<{
  client: boolean;
  database: boolean;
  storage: boolean;
}> {
  let clientHealthy = false;
  let databaseHealthy = false;
  let storageHealthy = false;

  try {
    // فحص العميل
    if (supabaseClient) {
      const { data, error } = await supabaseClient.from('users').select('count').limit(1);
      clientHealthy = !error;
    }
  } catch (error) {
    console.warn('عميل Supabase غير متاح:', error);
  }

  try {
    // فحص قاعدة البيانات
    if (supabaseConnection) {
      await supabaseConnection`SELECT 1`;
      databaseHealthy = true;
    }
  } catch (error) {
    console.warn('قاعدة بيانات Supabase غير متاحة:', error);
  }

  try {
    // فحص التخزين
    if (supabaseClient) {
      const { data, error } = await supabaseClient.storage.listBuckets();
      storageHealthy = !error;
    }
  } catch (error) {
    console.warn('تخزين Supabase غير متاح:', error);
  }

  return {
    client: clientHealthy,
    database: databaseHealthy,
    storage: storageHealthy
  };
}

// رفع ملف إلى Supabase Storage
export async function uploadToSupabase(
  file: Buffer | string,
  fileName: string,
  bucket: string = 'files',
  contentType?: string
): Promise<string | null> {
  if (!supabaseClient) {
    throw new Error('عميل Supabase غير متاح');
  }

  try {
    let fileBuffer: Buffer;
    
    if (typeof file === 'string') {
      // إذا كان المسار، قراءة الملف
      const fs = require('fs');
      fileBuffer = fs.readFileSync(file);
    } else {
      fileBuffer = file;
    }

    // رفع الملف
    const { data, error } = await supabaseClient.storage
      .from(bucket)
      .upload(fileName, fileBuffer, {
        contentType: contentType || 'application/octet-stream',
        upsert: true
      });

    if (error) {
      console.error('خطأ في رفع الملف إلى Supabase:', error);
      return null;
    }

    // الحصول على رابط الملف العام
    const { data: publicData } = supabaseClient.storage
      .from(bucket)
      .getPublicUrl(fileName);

    return publicData.publicUrl;
  } catch (error) {
    console.error('خطأ في رفع الملف:', error);
    return null;
  }
}

// حذف ملف من Supabase Storage
export async function deleteFromSupabase(
  fileName: string,
  bucket: string = 'files'
): Promise<boolean> {
  if (!supabaseClient) {
    return false;
  }

  try {
    const { error } = await supabaseClient.storage
      .from(bucket)
      .remove([fileName]);

    return !error;
  } catch (error) {
    console.error('خطأ في حذف الملف من Supabase:', error);
    return false;
  }
}

// مزامنة البيانات إلى Supabase
export async function syncToSupabase(): Promise<boolean> {
  if (!supabaseDb || !isSupabaseConnected) {
    console.warn('قاعدة بيانات Supabase غير متاحة للمزامنة');
    return false;
  }

  try {
    const { db } = require('./db');
    
    console.log('🔄 بدء مزامنة البيانات إلى Supabase...');
    
    // قائمة الجداول للمزامنة
    const tables = [
      'users', 'projects', 'transactions', 'documents', 
      'settings', 'funds', 'expenseTypes', 'ledgerEntries',
      'accountCategories', 'deferredPayments'
    ];
    
    for (const tableName of tables) {
      try {
        if (!schema[tableName]) continue;
        
        // قراءة البيانات من قاعدة البيانات المحلية
        const data = await db.select().from(schema[tableName]);
        
        if (data.length > 0) {
          // مسح البيانات القديمة من Supabase
          await supabaseDb.delete(schema[tableName]);
          
          // إدراج البيانات الجديدة
          await supabaseDb.insert(schema[tableName]).values(data);
          
          console.log(`✅ تم مزامنة جدول ${tableName} - ${data.length} سجل`);
        }
      } catch (error) {
        console.error(`❌ فشل في مزامنة جدول ${tableName}:`, error);
      }
    }
    
    console.log('✅ تمت مزامنة البيانات إلى Supabase');
    return true;
  } catch (error) {
    console.error('❌ فشل في مزامنة البيانات إلى Supabase:', error);
    return false;
  }
}

// نسخ الملفات المحلية إلى Supabase (الاحتفاظ بالنسخة الأصلية)
export async function copyFilesToSupabase(): Promise<{
  success: number;
  failed: number;
  errors: string[];
}> {
  if (!supabaseClient) {
    throw new Error('عميل Supabase غير متاح');
  }

  // استخدام fs و path المستوردين مسبقاً
  
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[]
  };

  try {
    // إنشاء bucket إذا لم يكن موجوداً
    const { error: bucketError } = await supabaseClient.storage.createBucket('files', {
      public: true,
      allowedMimeTypes: ['image/*', 'application/pdf', 'text/*', 'application/*'],
      fileSizeLimit: 50 * 1024 * 1024 // 50MB
    });

    if (bucketError && !bucketError.message.includes('already exists')) {
      console.warn('خطأ في إنشاء bucket:', bucketError);
    }

    const uploadsDir = path.join(process.cwd(), 'uploads');
    
    if (!fs.existsSync(uploadsDir)) {
      console.log('مجلد uploads غير موجود');
      return results;
    }

    const files = fs.readdirSync(uploadsDir);
    console.log(`🔄 بدء نقل ${files.length} ملف إلى Supabase...`);

    for (const fileName of files) {
      try {
        const filePath = path.join(uploadsDir, fileName);
        const stats = fs.statSync(filePath);
        
        if (stats.isFile()) {
          const fileBuffer = fs.readFileSync(filePath);
          const url = await uploadToSupabase(fileBuffer, fileName, 'files');
          
          if (url) {
            console.log(`✅ تم رفع ${fileName}`);
            results.success++;
          } else {
            console.error(`❌ فشل في رفع ${fileName}`);
            results.failed++;
            results.errors.push(`فشل في رفع ${fileName}`);
          }
        }
      } catch (error) {
        console.error(`خطأ في معالجة الملف ${fileName}:`, error);
        results.failed++;
        results.errors.push(`خطأ في ${fileName}: ${error}`);
      }
    }

    console.log(`✅ انتهاء النقل - نجح: ${results.success}, فشل: ${results.failed}`);
    return results;
  } catch (error) {
    console.error('خطأ عام في نقل الملفات:', error);
    results.errors.push(`خطأ عام: ${error}`);
    return results;
  }
}

// تحديث روابط الملفات في قاعدة البيانات
export async function updateFileUrlsToSupabase(): Promise<boolean> {
  if (!supabaseClient || !supabaseDb) {
    return false;
  }

  try {
    const { db } = require('./db');
    
    // تحديث روابط المستندات
    const documents = await db.select().from(schema.documents);
    
    for (const doc of documents) {
      if (doc.fileUrl && doc.fileUrl.includes('/uploads/')) {
        // استخراج اسم الملف من الرابط المحلي
        const fileName = doc.fileUrl.split('/uploads/')[1];
        
        // إنشاء رابط Supabase الجديد
        const { data } = supabaseClient.storage
          .from('files')
          .getPublicUrl(fileName);
        
        // تحديث الرابط في قاعدة البيانات
        await db.update(schema.documents)
          .set({ fileUrl: data.publicUrl })
          .where(schema.documents.id.eq(doc.id));
        
        console.log(`تم تحديث رابط المستند ${doc.id}`);
      }
    }

    // تحديث روابط المعاملات
    const transactions = await db.select().from(schema.transactions);
    
    for (const transaction of transactions) {
      if (transaction.fileUrl && transaction.fileUrl.includes('/uploads/')) {
        const fileName = transaction.fileUrl.split('/uploads/')[1];
        
        const { data } = supabaseClient.storage
          .from('files')
          .getPublicUrl(fileName);
        
        await db.update(schema.transactions)
          .set({ fileUrl: data.publicUrl })
          .where(schema.transactions.id.eq(transaction.id));
        
        console.log(`تم تحديث رابط المعاملة ${transaction.id}`);
      }
    }

    return true;
  } catch (error) {
    console.error('خطأ في تحديث روابط الملفات:', error);
    return false;
  }
}

// تصدير المتغيرات والدوال
export {
  supabaseClient,
  supabaseDb,
  isSupabaseConnected
};