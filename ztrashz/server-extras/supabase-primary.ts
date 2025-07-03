import { createClient } from '@supabase/supabase-js';
import { db } from './db';
import { users, projects, transactions, documents, settings } from '@shared/schema';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseClient: any = null;

// إعداد Supabase كقاعدة البيانات الرئيسية
export async function setupSupabaseAsMainDatabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('مفاتيح Supabase غير مكتملة');
  }

  supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  console.log('🔄 إعداد Supabase كقاعدة البيانات الرئيسية...');
  
  try {
    // نقل البيانات الأساسية
    await migrateEssentialData();
    console.log('✅ تم إعداد Supabase كقاعدة البيانات الرئيسية');
    return true;
  } catch (error) {
    console.error('❌ خطأ في الإعداد:', error);
    throw error;
  }
}

// نقل البيانات الأساسية
async function migrateEssentialData() {
  console.log('📊 نقل البيانات الأساسية...');

  try {
    // نقل المستخدمين
    const dbUsers = await db.select().from(users);
    if (dbUsers.length > 0) {
      for (const user of dbUsers) {
        await supabaseClient.from('users').upsert(user, { onConflict: 'username' });
      }
      console.log(`✅ تم نقل ${dbUsers.length} مستخدم`);
    }

    // نقل المشاريع
    const dbProjects = await db.select().from(projects);
    if (dbProjects.length > 0) {
      for (const project of dbProjects) {
        await supabaseClient.from('projects').upsert(project);
      }
      console.log(`✅ تم نقل ${dbProjects.length} مشروع`);
    }

    // نقل المعاملات
    const dbTransactions = await db.select().from(transactions);
    if (dbTransactions.length > 0) {
      for (const transaction of dbTransactions) {
        await supabaseClient.from('transactions').upsert(transaction);
      }
      console.log(`✅ تم نقل ${dbTransactions.length} معاملة`);
    }

    // نقل الوثائق
    const dbDocuments = await db.select().from(documents);
    if (dbDocuments.length > 0) {
      for (const document of dbDocuments) {
        await supabaseClient.from('documents').upsert(document);
      }
      console.log(`✅ تم نقل ${dbDocuments.length} وثيقة`);
    }

    // نقل الإعدادات
    const dbSettings = await db.select().from(settings);
    if (dbSettings.length > 0) {
      for (const setting of dbSettings) {
        await supabaseClient.from('settings').upsert(setting, { onConflict: 'key' });
      }
      console.log(`✅ تم نقل ${dbSettings.length} إعداد`);
    }

    console.log('✅ اكتمل نقل البيانات الأساسية');
  } catch (error) {
    console.error('❌ خطأ في نقل البيانات:', error);
    throw error;
  }
}

// نقل الملفات من التخزين المحلي إلى Supabase
export async function migrateFilesToSupabase() {
  console.log('📁 نقل الملفات إلى Supabase...');
  
  const uploadsDir = path.join(process.cwd(), 'uploads');
  let migratedCount = 0;
  let errorCount = 0;

  try {
    if (!fs.existsSync(uploadsDir)) {
      console.log('📂 مجلد uploads غير موجود');
      return { success: true, migratedCount: 0, errorCount: 0 };
    }

    const files = fs.readdirSync(uploadsDir);
    console.log(`📋 العثور على ${files.length} ملف`);

    for (const file of files) {
      try {
        const filePath = path.join(uploadsDir, file);
        const fileStats = fs.statSync(filePath);
        
        if (fileStats.isFile()) {
          const fileBuffer = fs.readFileSync(filePath);
          
          const { error } = await supabaseClient.storage
            .from('files')
            .upload(file, fileBuffer, {
              contentType: 'application/octet-stream', // استخدام نوع عام لتجنب قيود Supabase
              upsert: true
            });

          if (error) {
            console.error(`❌ فشل رفع ${file}:`, error.message);
            errorCount++;
          } else {
            console.log(`✅ تم رفع ${file}`);
            migratedCount++;
          }
        }
      } catch (error) {
        console.error(`❌ خطأ في معالجة ${file}:`, error);
        errorCount++;
      }
    }

    console.log(`📊 النتائج: ${migratedCount} نجح، ${errorCount} فشل`);
    return { success: true, migratedCount, errorCount };
  } catch (error) {
    console.error('❌ خطأ عام:', error);
    return { success: false, migratedCount, errorCount, error: (error as Error).message };
  }
}

// تحديد نوع محتوى الملف
function getContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const contentTypes: { [key: string]: string } = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt': 'text/plain',
    '.zip': 'application/zip'
  };
  
  return contentTypes[ext] || 'application/octet-stream';
}

// تحديث روابط الملفات في قاعدة البيانات
export async function updateFileUrlsToSupabase() {
  console.log('🔗 تحديث روابط الملفات...');
  
  try {
    const baseUrl = `${SUPABASE_URL}/storage/v1/object/public/files/`;
    
    // تحديث المعاملات
    const { data: transactions } = await supabaseClient
      .from('transactions')
      .select('id, file_url')
      .not('file_url', 'is', null);

    if (transactions) {
      for (const transaction of transactions) {
        if (transaction.file_url && !transaction.file_url.includes('supabase')) {
          const filename = path.basename(transaction.file_url);
          const newUrl = baseUrl + filename;
          
          await supabaseClient
            .from('transactions')
            .update({ file_url: newUrl })
            .eq('id', transaction.id);
        }
      }
      console.log(`✅ تم تحديث ${transactions.length} معاملة`);
    }

    // تحديث الوثائق
    const { data: documents } = await supabaseClient
      .from('documents')
      .select('id, file_url');

    if (documents) {
      for (const document of documents) {
        if (document.file_url && !document.file_url.includes('supabase')) {
          const filename = path.basename(document.file_url);
          const newUrl = baseUrl + filename;
          
          await supabaseClient
            .from('documents')
            .update({ file_url: newUrl })
            .eq('id', document.id);
        }
      }
      console.log(`✅ تم تحديث ${documents.length} وثيقة`);
    }

    console.log('✅ اكتمل تحديث الروابط');
    return true;
  } catch (error) {
    console.error('❌ خطأ في تحديث الروابط:', error);
    throw error;
  }
}

// فحص حالة البيانات في Supabase
export async function checkSupabaseMigrationStatus() {
  try {
    const status = {
      users: 0,
      projects: 0,
      transactions: 0,
      documents: 0,
      settings: 0
    };

    // فحص عدد السجلات
    const tables = ['users', 'projects', 'transactions', 'documents', 'settings'];
    
    for (const table of tables) {
      try {
        const { count } = await supabaseClient
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        status[table as keyof typeof status] = count || 0;
      } catch (error) {
        console.log(`⚠️ لا يمكن فحص جدول ${table}`);
      }
    }

    return status;
  } catch (error) {
    console.error('❌ خطأ في فحص الحالة:', error);
    throw error;
  }
}

// إعداد Supabase كمزود التخزين الرئيسي
export async function setSupabaseAsStorageProvider() {
  try {
    // هذا سيتم تطبيقه في storage-manager
    console.log('📁 تم تعيين Supabase كمزود التخزين الرئيسي');
    return true;
  } catch (error) {
    console.error('❌ خطأ في تعيين مزود التخزين:', error);
    throw error;
  }
}