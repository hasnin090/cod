import { createClient, SupabaseClient } from '@supabase/supabase-js';

// نظام Supabase مبسط يركز على الوظائف الأساسية
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://yieyqusnciiithjtlgod.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

let supabaseClient: SupabaseClient | null = null;
let isInitialized = false;

// تهيئة مبسطة تركز على API فقط
export async function initializeSupabaseFallback(): Promise<boolean> {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.warn('مفاتيح Supabase غير متوفرة');
      return false;
    }

    // إنشاء عميل API فقط
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      realtime: {
        params: {
          eventsPerSecond: 2
        }
      }
    });

    isInitialized = true;
    console.log('✅ تم تهيئة Supabase (وضع API)');
    return true;
  } catch (error) {
    console.error('❌ فشل في تهيئة Supabase:', error);
    return false;
  }
}

// فحص سريع للحالة
export async function checkSupabaseFallbackHealth(): Promise<{
  client: boolean;
  storage: boolean;
  api: boolean;
}> {
  let clientHealthy = false;
  let storageHealthy = false;
  let apiHealthy = false;

  if (!supabaseClient) {
    return { client: false, storage: false, api: false };
  }

  try {
    // فحص API مع timeout قصير
    const { error } = await Promise.race([
      supabaseClient.from('test').select('*').limit(1),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
    ]);
    
    apiHealthy = true; // حتى لو فشل الاستعلام، العميل يعمل
    clientHealthy = true;
  } catch (error) {
    // لا مشكلة، نستمر بدون قاعدة البيانات
  }

  try {
    // فحص التخزين
    const { error } = await Promise.race([
      supabaseClient.storage.listBuckets(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
    ]);
    
    storageHealthy = !error;
  } catch (error) {
    // التخزين غير متاح
  }

  return {
    client: clientHealthy,
    storage: storageHealthy,
    api: apiHealthy
  };
}

// رفع ملف إلى Supabase Storage
export async function uploadToSupabaseFallback(
  fileBuffer: Buffer, 
  fileName: string, 
  bucket: string = 'files'
): Promise<string | null> {
  if (!supabaseClient) {
    throw new Error('Supabase غير مُهيأ');
  }

  try {
    // إنشاء bucket إذا لم يكن موجوداً
    const { error: bucketError } = await supabaseClient.storage.createBucket(bucket, {
      public: true,
      allowedMimeTypes: ['*/*'],
      fileSizeLimit: 50 * 1024 * 1024 // 50MB
    });

    if (bucketError && !bucketError.message.includes('already exists')) {
      console.warn('تحذير bucket:', bucketError.message);
    }

    // رفع الملف
    const { data, error } = await supabaseClient.storage
      .from(bucket)
      .upload(fileName, fileBuffer, {
        upsert: true,
        contentType: 'application/octet-stream'
      });

    if (error) {
      console.error('خطأ في رفع الملف:', error);
      return null;
    }

    // الحصول على URL عام
    const { data: urlData } = supabaseClient.storage
      .from(bucket)
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (error) {
    console.error('خطأ في uploadToSupabaseFallback:', error);
    return null;
  }
}

// حذف ملف من Supabase Storage
export async function deleteFromSupabaseFallback(fileName: string, bucket: string = 'files'): Promise<boolean> {
  if (!supabaseClient) {
    return false;
  }

  try {
    const { error } = await supabaseClient.storage
      .from(bucket)
      .remove([fileName]);

    return !error;
  } catch (error) {
    console.error('خطأ في حذف الملف:', error);
    return false;
  }
}

export { supabaseClient };
export const isSupabaseReady = () => isInitialized;