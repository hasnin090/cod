import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

let supabaseClient: SupabaseClient | null = null;
let isInitialized = false;

// تهيئة عميل Supabase
export async function initializeSupabaseStorage(): Promise<boolean> {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.warn('❌ مفاتيح Supabase غير متوفرة');
      return false;
    }

    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // إنشاء buckets إذا لم تكن موجودة
    await createBucketsIfNotExist();
    
    isInitialized = true;
    console.log('✅ تم تهيئة Supabase Storage بنجاح');
    return true;
  } catch (error) {
    console.error('❌ فشل في تهيئة Supabase Storage:', error);
    return false;
  }
}

// إنشاء buckets المطلوبة
async function createBucketsIfNotExist(): Promise<void> {
  if (!supabaseClient) return;

  const buckets = [
    {
      id: 'transactions',
      name: 'Transaction Files',
      public: true
    },
    {
      id: 'documents',
      name: 'System Documents',
      public: true
    },
    {
      id: 'completed-works',
      name: 'Completed Works',
      public: true
    },
    {
      id: 'exports',
      name: 'Exported Files',
      public: true
    }
  ];

  for (const bucket of buckets) {
    try {
      const { error } = await supabaseClient.storage.createBucket(bucket.id, {
        public: bucket.public,
        allowedMimeTypes: ['*/*'],
        fileSizeLimit: 50 * 1024 * 1024 // 50MB
      });

      if (error && !error.message.includes('already exists')) {
        console.warn(`تحذير bucket ${bucket.id}:`, error.message);
      } else if (!error) {
        console.log(`✅ تم إنشاء bucket: ${bucket.id}`);
      }
    } catch (err) {
      console.warn(`خطأ في إنشاء bucket ${bucket.id}:`, err);
    }
  }
}

// رفع ملف للتخزين السحابي (الأساسي) مع نسخة احتياطية محلية
export async function uploadToSupabase(
  fileBuffer: Buffer,
  fileName: string,
  bucket: string = 'transactions',
  keepLocalBackup: boolean = true
): Promise<{ success: boolean; url?: string; localPath?: string; error?: string }> {
  try {
    if (!supabaseClient || !isInitialized) {
      await initializeSupabaseStorage();
    }

    if (!supabaseClient) {
      return { success: false, error: 'Supabase غير مهيأ' };
    }

    const uniqueFileName = `${Date.now()}_${fileName}`;

    // رفع الملف الأصلي كما هو بدون تحديد نوع المحتوى
    const { data, error } = await supabaseClient.storage
      .from(bucket)
      .upload(uniqueFileName, fileBuffer, {
        upsert: true
        // عدم تحديد contentType على الإطلاق
      });

    if (error) {
      console.error('خطأ في رفع الملف للسحابة:', error);
      return { success: false, error: error.message };
    }

    // الحصول على الرابط العام
    const { data: urlData } = supabaseClient.storage
      .from(bucket)
      .getPublicUrl(uniqueFileName);

    let localPath: string | undefined;

    // إنشاء نسخة احتياطية محلية (اختياري)
    if (keepLocalBackup) {
      try {
        const backupDir = `./uploads/backups/${bucket}`;
        if (!fs.existsSync(backupDir)) {
          fs.mkdirSync(backupDir, { recursive: true });
        }
        
        localPath = path.join(backupDir, uniqueFileName);
        fs.writeFileSync(localPath, fileBuffer);
        console.log(`📁 نسخة احتياطية محلية: ${localPath}`);
      } catch (backupError) {
        console.warn('تحذير: فشل في إنشاء النسخة الاحتياطية المحلية:', backupError);
        // لا نفشل العملية بسبب النسخة الاحتياطية
      }
    }

    console.log(`☁️ تم رفع الملف للسحابة: ${fileName} إلى ${bucket}`);
    return { 
      success: true, 
      url: urlData.publicUrl,
      localPath
    };

  } catch (error: any) {
    console.error('خطأ في رفع الملف لـ Supabase:', error);
    return { success: false, error: error.message };
  }
}

// رفع ملف من local path موجود (للمزامنة فقط)
export async function uploadFromLocalFile(
  localPath: string,
  bucket: string = 'transactions'
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    if (!fs.existsSync(localPath)) {
      return { success: false, error: 'الملف المحلي غير موجود' };
    }

    const fileBuffer = fs.readFileSync(localPath);
    const fileName = path.basename(localPath);
    
    const result = await uploadToSupabase(fileBuffer, fileName, bucket, false);
    return {
      success: result.success,
      url: result.url,
      error: result.error
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// تحميل ملف من السحابة للنسخ الاحتياطية المحلية
export async function downloadFromSupabase(
  fileName: string,
  bucket: string = 'transactions',
  localDir: string = './uploads/backups'
): Promise<{ success: boolean; localPath?: string; error?: string }> {
  try {
    if (!supabaseClient) {
      return { success: false, error: 'Supabase غير مهيأ' };
    }

    // تحميل الملف من السحابة
    const { data, error } = await supabaseClient.storage
      .from(bucket)
      .download(fileName);

    if (error) {
      return { success: false, error: error.message };
    }

    // حفظ الملف محلياً
    const backupDir = path.join(localDir, bucket);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const localPath = path.join(backupDir, fileName);
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    fs.writeFileSync(localPath, buffer);

    console.log(`📁 تم تحميل نسخة احتياطية: ${localPath}`);
    return { success: true, localPath };

  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// مزامنة جميع الملفات المحلية الموجودة للسحابة (للانتقال أو النسخ الاحتياطي)
export async function syncAllLocalFiles(): Promise<{
  synced: number;
  failed: number;
  results: Array<{ file: string; success: boolean; url?: string; error?: string }>;
}> {
  const results: Array<{ file: string; success: boolean; url?: string; error?: string }> = [];
  let synced = 0;
  let failed = 0;

  try {
    const uploadsDir = './uploads';
    if (!fs.existsSync(uploadsDir)) {
      return { synced: 0, failed: 0, results: [] };
    }

    // مزامنة ملفات المعاملات
    const transactionsDir = path.join(uploadsDir, 'transactions');
    if (fs.existsSync(transactionsDir)) {
      const transactionFolders = fs.readdirSync(transactionsDir);
      
      for (const folder of transactionFolders) {
        const folderPath = path.join(transactionsDir, folder);
        if (fs.statSync(folderPath).isDirectory()) {
          const files = fs.readdirSync(folderPath);
          
          for (const file of files) {
            const filePath = path.join(folderPath, file);
            const result = await uploadFromLocalFile(filePath, 'transactions');
            
            results.push({ file: filePath, ...result });
            if (result.success) synced++; else failed++;
          }
        }
      }
    }

    // مزامنة الوثائق
    const docsDir = path.join(uploadsDir, 'completed-works-docs');
    if (fs.existsSync(docsDir)) {
      const files = fs.readdirSync(docsDir);
      
      for (const file of files) {
        const filePath = path.join(docsDir, file);
        if (fs.statSync(filePath).isFile()) {
          const result = await uploadFromLocalFile(filePath, 'completed-works');
          
          results.push({ file: filePath, ...result });
          if (result.success) synced++; else failed++;
        }
      }
    }

    // مزامنة ملفات التصدير
    const exportsDir = path.join(uploadsDir, 'exports');
    if (fs.existsSync(exportsDir)) {
      const files = fs.readdirSync(exportsDir);
      
      for (const file of files) {
        const filePath = path.join(exportsDir, file);
        if (fs.statSync(filePath).isFile()) {
          const result = await uploadFromLocalFile(filePath, 'exports');
          
          results.push({ file: filePath, ...result });
          if (result.success) synced++; else failed++;
        }
      }
    }

    // مزامنة الملفات العامة
    const generalFiles = fs.readdirSync(uploadsDir)
      .filter(item => {
        const itemPath = path.join(uploadsDir, item);
        return fs.statSync(itemPath).isFile() && item !== '.gitkeep';
      });

    for (const file of generalFiles) {
      const filePath = path.join(uploadsDir, file);
      const result = await uploadFromLocalFile(filePath, 'documents');
      
      results.push({ file: filePath, ...result });
      if (result.success) synced++; else failed++;
    }

    console.log(`✅ مزامنة مكتملة: ${synced} نجحت، ${failed} فشلت`);
    return { synced, failed, results };

  } catch (error: any) {
    console.error('خطأ في مزامنة الملفات:', error);
    return { synced, failed, results };
  }
}

// فحص حالة Supabase Storage
export async function checkSupabaseStorageHealth(): Promise<{
  client: boolean;
  storage: boolean;
  buckets: string[];
  lastCheck: string;
}> {
  const result = {
    client: false,
    storage: false,
    buckets: [] as string[],
    lastCheck: new Date().toISOString()
  };

  try {
    if (!supabaseClient) {
      await initializeSupabaseStorage();
    }

    if (supabaseClient) {
      result.client = true;

      // فحص التخزين
      const { data: buckets, error } = await supabaseClient.storage.listBuckets();
      
      if (!error && buckets) {
        result.storage = true;
        result.buckets = buckets.map(b => b.name);
      }
    }
  } catch (error) {
    console.warn('خطأ في فحص Supabase Storage:', error);
  }

  return result;
}

// تحديد نوع المحتوى
function getContentType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  
  const mimeTypes: { [key: string]: string } = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.csv': 'application/octet-stream',
    '.txt': 'text/plain'
  };

  return mimeTypes[ext] || 'application/octet-stream';
}

// الحصول على عميل Supabase
export function getSupabaseClient(): SupabaseClient | null {
  return supabaseClient;
}

// التحقق من التهيئة
export function isSupabaseInitialized(): boolean {
  return isInitialized && supabaseClient !== null;
}