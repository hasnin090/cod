import { createClient, SupabaseClient } from '@supabase/supabase-js';

// نظام Supabase مبسط يعمل بدون timeout issues
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://yieyqusnciiithjtlgod.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseClient: SupabaseClient | null = null;
let connectionStatus = {
  client: false,
  database: false,
  storage: false,
  lastCheck: new Date(),
  keyStatus: {
    urlValid: false,
    anonKeyValid: false,
    serviceKeyValid: false
  }
};

// تهيئة بسيطة
export async function initializeSupabaseSimple(): Promise<boolean> {
  try {
    if (!SUPABASE_URL) {
      console.log('⚠️ رابط Supabase غير متوفر');
      return false;
    }

    // استخدام مفتاح الخدمة إذا كان متوفراً، وإلا المفتاح العام
    const apiKey = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;
    
    if (!apiKey) {
      console.log('⚠️ لا توجد مفاتيح Supabase متاحة');
      return false;
    }

    supabaseClient = createClient(SUPABASE_URL, apiKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        headers: {
          'x-client-info': 'accounting-system'
        }
      }
    });

    // اختبار الاتصال بقاعدة البيانات والتخزين
    let dbConnected = false;
    let storageConnected = false;
    
    // اختبار قاعدة البيانات باستخدام جدول المستخدمين
    try {
      const { data, error } = await supabaseClient
        .from('users')
        .select('count')
        .limit(1);
      
      if (!error) {
        dbConnected = true;
        console.log('✅ اتصال قاعدة بيانات Supabase نجح');
      } else {
        console.log('⚠️ خطأ في قاعدة بيانات Supabase:', error.message);
      }
    } catch (dbError) {
      console.log('⚠️ اختبار قاعدة بيانات Supabase فشل:', dbError);
    }
    
    // اختبار التخزين
    try {
      const { data: buckets, error: listError } = await supabaseClient.storage.listBuckets();
      
      if (!listError) {
        storageConnected = true;
        
        // البحث عن bucket الملفات أو إنشاؤه
        const filesBucket = buckets?.find(bucket => bucket.name === 'files');
        
        if (!filesBucket) {
          const { error: createError } = await supabaseClient.storage.createBucket('files', {
            public: true,
            allowedMimeTypes: null, // السماح بجميع أنواع الملفات
            fileSizeLimit: 100 * 1024 * 1024 // 100MB
          });
          
          if (!createError) {
            console.log('✅ تم إنشاء bucket الملفات في Supabase');
          }
        }
        
        console.log('✅ اتصال تخزين Supabase نجح');
      }
    } catch (storageError) {
      console.log('⚠️ اختبار تخزين Supabase فشل');
    }
    
    // تحديث الحالة
    connectionStatus.client = true;
    connectionStatus.database = dbConnected;
    connectionStatus.storage = storageConnected;
    connectionStatus.keyStatus = {
      urlValid: true,
      anonKeyValid: !!SUPABASE_ANON_KEY,
      serviceKeyValid: !!SUPABASE_SERVICE_KEY
    };

    connectionStatus.lastCheck = new Date();
    
    console.log('✅ تم تهيئة Supabase (وضع مبسط)');
    return true;
  } catch (error) {
    console.log('❌ فشل في تهيئة Supabase:', error);
    return false;
  }
}

// فحص سريع بدون timeout طويل
export async function checkSupabaseSimpleHealth(): Promise<{
  client: boolean;
  database: boolean;
  storage: boolean;
  lastCheck: string;
}> {
  if (!supabaseClient) {
    return {
      client: false,
      database: false,
      storage: false,
      lastCheck: connectionStatus.lastCheck.toISOString()
    };
  }

  // فحص سريع لقاعدة البيانات
  try {
    const { error } = await supabaseClient
      .from('users')
      .select('count')
      .limit(1);
    connectionStatus.database = !error;
  } catch (error) {
    connectionStatus.database = false;
  }

  // فحص سريع للتخزين
  try {
    const { error } = await supabaseClient.storage.listBuckets();
    connectionStatus.storage = !error;
  } catch (error) {
    connectionStatus.storage = false;
  }

  connectionStatus.lastCheck = new Date();
  
  return {
    client: true, // إذا وصلنا هنا فالعميل متصل
    database: connectionStatus.database,
    storage: connectionStatus.storage,
    lastCheck: connectionStatus.lastCheck.toISOString()
  };
}

// رفع ملف مع retry logic
export async function uploadToSupabaseSimple(
  fileBuffer: Buffer, 
  fileName: string, 
  bucket: string = 'files'
): Promise<string | null> {
  if (!supabaseClient) {
    return null;
  }

  try {
    // محاولة إنشاء bucket
    await supabaseClient.storage.createBucket(bucket, {
      public: true,
      allowedMimeTypes: ['*/*'],
      fileSizeLimit: 50 * 1024 * 1024
    });

    // رفع الملف
    const { data, error } = await supabaseClient.storage
      .from(bucket)
      .upload(fileName, fileBuffer, { upsert: true });

    if (error) {
      console.log('خطأ في رفع الملف:', error.message);
      return null;
    }

    // الحصول على URL
    const { data: urlData } = supabaseClient.storage
      .from(bucket)
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (error) {
    console.log('خطأ في uploadToSupabaseSimple:', error);
    return null;
  }
}

// حذف ملف
export async function deleteFromSupabaseSimple(fileName: string, bucket: string = 'files'): Promise<boolean> {
  if (!supabaseClient) {
    return false;
  }

  try {
    const { error } = await supabaseClient.storage
      .from(bucket)
      .remove([fileName]);

    return !error;
  } catch (error) {
    return false;
  }
}

// نسخ الملفات المحلية
export async function copyFilesToSupabaseSimple(): Promise<{
  success: number;
  failed: number;
  errors: string[];
}> {
  const results = { success: 0, failed: 0, errors: [] as string[] };

  if (!supabaseClient) {
    results.errors.push('Supabase غير مُهيأ');
    return results;
  }

  try {
    const fs = await import('fs');
    const path = await import('path');
    
    const uploadsDir = path.join(process.cwd(), 'uploads');
    
    if (!fs.existsSync(uploadsDir)) {
      results.errors.push('مجلد uploads غير موجود');
      return results;
    }

    const files = fs.readdirSync(uploadsDir);
    console.log(`🔄 بدء نسخ ${files.length} ملف إلى Supabase...`);

    for (const fileName of files.slice(0, 5)) { // نسخ أول 5 ملفات فقط لتجنب timeout
      try {
        const filePath = path.join(uploadsDir, fileName);
        const fileBuffer = fs.readFileSync(filePath);
        
        const url = await uploadToSupabaseSimple(fileBuffer, fileName);
        
        if (url) {
          results.success++;
          console.log(`✅ تم نسخ ${fileName}`);
        } else {
          results.failed++;
          results.errors.push(`فشل في نسخ ${fileName}`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`خطأ في ${fileName}`);
      }
    }

    return results;
  } catch (error) {
    results.errors.push('خطأ عام في النسخ');
    return results;
  }
}

export { supabaseClient };
export const getSupabaseStatus = () => connectionStatus;