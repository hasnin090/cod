import { uploadFile as uploadToLocal, deleteFile as deleteFromLocal } from './firebase-utils';
import { uploadToSupabase, deleteFromSupabase, getSupabaseClient } from './supabase-db';
import { uploadToFirebase, deleteFromFirebase, checkFirebaseHealth, initializeFirebase } from './firebase-storage';

// تحديد نوع التخزين المتاح
export type StorageProvider = 'local' | 'supabase' | 'firebase';

interface StorageResult {
  success: boolean;
  url?: string;
  error?: string;
  provider: StorageProvider;
}

class StorageManager {
  private preferredProvider: StorageProvider = 'supabase';
  private fallbackProviders: StorageProvider[] = ['firebase'];

  constructor() {
    this.detectAvailableProviders();
  }

  private async detectAvailableProviders() {
    // تحديث قائمة مزودات التخزين المتاحة
    this.fallbackProviders = ['firebase']; // Firebase كاحتياطي أول
    
    // فحص توفر Supabase
    try {
      const supabaseClient = getSupabaseClient();
      if (supabaseClient) {
        const { data, error } = await supabaseClient.storage.listBuckets();
        if (!error) {
          console.log('✅ Supabase متاح كمزود تخزين أساسي');
          // Supabase هو المزود الأساسي دائماً إذا كان متاحاً
        } else {
          console.log('⚠️ Supabase غير متاح، سيتم استخدام Firebase');
        }
      }
    } catch (e) {
      console.log('⚠️ Supabase غير متاح كمزود تخزين');
    }

    // فحص توفر Firebase
    try {
      const firebaseInitialized = await initializeFirebase();
      if (firebaseInitialized) {
        console.log('✅ Firebase متاح كمزود احتياطي');
      }
    } catch (e) {
      console.log('⚠️ Firebase غير متاح كمزود تخزين');
    }

    console.log(`📁 مزود التخزين الأساسي: ${this.preferredProvider}`);
    console.log(`🔄 مزودات التخزين الاحتياطية: ${this.fallbackProviders.join(', ')}`);
    console.log(`💾 التخزين المحلي: نسخ احتياطية تلقائية فقط`);
  }

  /**
   * رفع ملف مع محاولة استخدام مزودات متعددة
   */
  async uploadFile(
    file: Buffer | string,
    fileName: string,
    contentType?: string,
    metadata?: Record<string, string>
  ): Promise<StorageResult> {
    // محاولة رفع الملف إلى Supabase أولاً
    try {
      const supabaseResult = await this.uploadToProvider('supabase', file, fileName, contentType, metadata);
      if (supabaseResult.success) {
        console.log(`✅ تم رفع الملف ${fileName} إلى Supabase`);
        
        // حفظ نسخة احتياطية محلية
        try {
          await this.uploadToProvider('local', file, fileName, contentType, metadata);
          console.log(`✅ تم حفظ نسخة احتياطية محلية للملف ${fileName}`);
        } catch (backupError) {
          console.warn(`⚠️ فشل في حفظ النسخة الاحتياطية المحلية للملف ${fileName}:`, backupError);
        }
        
        return supabaseResult;
      }
    } catch (error) {
      console.warn(`⚠️ فشل رفع الملف ${fileName} إلى Supabase:`, error);
    }

    // في حالة فشل Supabase، استخدم المزودات الاحتياطية
    for (const provider of this.fallbackProviders) {
      try {
        const result = await this.uploadToProvider(provider, file, fileName, contentType, metadata);
        if (result.success) {
          console.log(`✅ تم رفع الملف ${fileName} باستخدام ${provider} (احتياطي)`);
          return result;
        }
      } catch (error) {
        console.warn(`⚠️ فشل رفع الملف ${fileName} باستخدام ${provider}:`, error);
      }
    }

    return {
      success: false,
      error: 'فشل في رفع الملف باستخدام جميع مزودات التخزين',
      provider: 'local'
    };
  }

  /**
   * حذف ملف من مزود التخزين المحدد
   */
  async deleteFile(fileUrl: string, provider?: StorageProvider): Promise<boolean> {
    const detectedProvider = provider || this.detectProviderFromUrl(fileUrl);

    try {
      switch (detectedProvider) {
        case 'supabase':
          const fileName = this.extractFileNameFromUrl(fileUrl);
          return await deleteFromSupabase(fileName);
        
        case 'firebase':
          const firebaseFileName = this.extractFileNameFromUrl(fileUrl);
          return await deleteFromFirebase(firebaseFileName);
        
        case 'local':
        default:
          return await deleteFromLocal(fileUrl);
      }
    } catch (error) {
      console.error(`خطأ في حذف الملف ${fileUrl}:`, error);
      return false;
    }
  }

  /**
   * رفع ملف إلى مزود محدد
   */
  private async uploadToProvider(
    provider: StorageProvider,
    file: Buffer | string,
    fileName: string,
    contentType?: string,
    metadata?: Record<string, string>
  ): Promise<StorageResult> {
    switch (provider) {
      case 'supabase':
        const supabaseUrl = await uploadToSupabase(file, fileName, 'files', contentType);
        return {
          success: !!supabaseUrl,
          url: supabaseUrl || undefined,
          provider: 'supabase',
          error: supabaseUrl ? undefined : 'فشل في الرفع إلى Supabase'
        };

      case 'firebase':
        const firebaseUrl = await uploadToFirebase(file, fileName, contentType);
        return {
          success: !!firebaseUrl,
          url: firebaseUrl || undefined,
          provider: 'firebase',
          error: firebaseUrl ? undefined : 'فشل في الرفع إلى Firebase'
        };

      case 'local':
      default:
        const localUrl = await uploadToLocal(file, fileName, contentType, metadata);
        return {
          success: !!localUrl,
          url: localUrl,
          provider: 'local'
        };
    }
  }

  /**
   * تحديد مزود التخزين من URL الملف
   */
  private detectProviderFromUrl(fileUrl: string): StorageProvider {
    if (fileUrl.includes('supabase')) {
      return 'supabase';
    } else if (fileUrl.includes('firebase') || fileUrl.includes('googleapis')) {
      return 'firebase';
    }
    return 'local';
  }

  /**
   * استخراج اسم الملف من URL
   */
  private extractFileNameFromUrl(fileUrl: string): string {
    try {
      const url = new URL(fileUrl);
      const pathParts = url.pathname.split('/');
      return pathParts[pathParts.length - 1];
    } catch {
      // إذا فشل parsing، استخدم الجزء الأخير من المسار
      return fileUrl.split('/').pop() || 'unknown';
    }
  }

  /**
   * الحصول على URL صالح للملف
   */
  async getFileUrl(filePath: string): Promise<StorageResult> {
    // إذا كان المسار يحتوي على URL كامل، فقط تحقق من صحته
    if (filePath.startsWith('http')) {
      const provider = this.detectProviderFromUrl(filePath);
      return {
        success: true,
        url: filePath,
        provider
      };
    }

    // محاولة الحصول على URL من Supabase أولاً
    try {
      const supabaseClient = getSupabaseClient();
      if (supabaseClient) {
        const { data } = supabaseClient.storage
          .from('attachments')
          .getPublicUrl(filePath);
        
        if (data?.publicUrl) {
          return {
            success: true,
            url: data.publicUrl,
            provider: 'supabase'
          };
        }
      }
    } catch (error) {
      console.log('فشل في الحصول على URL من Supabase');
    }

    // إذا فشل Supabase، جرب Firebase
    try {
      // بناء URL Firebase إذا كان الملف موجود في Firebase
      const firebaseUrl = `https://firebasestorage.googleapis.com/v0/b/${process.env.VITE_FIREBASE_PROJECT_ID}.appspot.com/o/${encodeURIComponent(filePath)}?alt=media`;
      return {
        success: true,
        url: firebaseUrl,
        provider: 'firebase'
      };
    } catch (error) {
      console.log('فشل في بناء URL Firebase');
    }

    // كحل أخير، استخدم المسار المحلي
    return {
      success: true,
      url: `/uploads/${filePath}`,
      provider: 'local'
    };
  }

  /**
   * تغيير مزود التخزين المفضل
   */
  setPreferredProvider(provider: StorageProvider) {
    // التحقق من صحة مزود التخزين
    if (!['local', 'supabase', 'firebase'].includes(provider)) {
      console.log(`❌ مزود تخزين غير صالح: ${provider}`);
      return false;
    }

    const previousProvider = this.preferredProvider;
    this.preferredProvider = provider;
    
    console.log(`📁 تم تغيير مزود التخزين المفضل من ${previousProvider} إلى ${provider}`);
    
    // إعادة تحديد مزودات التخزين الاحتياطية بناءً على المزود الجديد
    this.updateFallbackProviders(provider);
    
    return true;
  }

  /**
   * تحديث مزودات التخزين الاحتياطية
   */
  private updateFallbackProviders(preferredProvider: StorageProvider) {
    switch (preferredProvider) {
      case 'supabase':
        this.fallbackProviders = ['firebase', 'local'];
        break;
      case 'firebase':
        this.fallbackProviders = ['supabase', 'local'];
        break;
      case 'local':
        this.fallbackProviders = ['supabase', 'firebase'];
        break;
      default:
        this.fallbackProviders = ['firebase', 'local'];
    }
    
    console.log(`🔄 مزودات التخزين الاحتياطية: ${this.fallbackProviders.join(', ')}`);
    
    // إعادة تشغيل فحص التوفر بعد التبديل
    setTimeout(() => {
      this.detectAvailableProviders();
    }, 2000);
  }

  /**
   * إعادة تقييم حالة جميع مزودات التخزين
   */
  async refreshProvidersStatus(): Promise<void> {
    console.log('🔄 إعادة تقييم حالة مزودات التخزين...');
    await this.detectAvailableProviders();
  }

  /**
   * الحصول على معلومات حالة التخزين
   */
  async getStorageStatus(): Promise<{
    preferred: StorageProvider;
    available: StorageProvider[];
    healthCheck: Record<StorageProvider, boolean>;
  }> {
    const healthCheck: Record<StorageProvider, boolean> = {
      local: true, // التخزين المحلي متاح دائماً
      supabase: false,
      firebase: false
    };

    // فحص Supabase
    try {
      const supabaseClient = getSupabaseClient();
      if (supabaseClient) {
        // فحص مباشر لقاعدة البيانات
        const { data, error } = await supabaseClient
          .from('users')
          .select('id')
          .limit(1);
        healthCheck.supabase = !error;
      }
    } catch {
      // في حالة الخطأ، نفترض أن Supabase متاح إذا كان العميل موجود
      const supabaseClient = getSupabaseClient();
      healthCheck.supabase = !!supabaseClient;
    }

    // فحص Firebase
    try {
      const firebaseHealth = await checkFirebaseHealth();
      // اعتبار Firebase متاح إذا كان مُهيّأً ومُصادقة تعمل (حتى لو كان Storage محدود)
      healthCheck.firebase = firebaseHealth.initialized && firebaseHealth.auth;
    } catch {
      healthCheck.firebase = false;
    }

    // إضافة Supabase للقائمة المتاحة إذا كان المزود الأساسي
    if (this.preferredProvider === 'supabase') {
      healthCheck.supabase = true;
    }

    const available = Object.entries(healthCheck)
      .filter(([_, isHealthy]) => isHealthy)
      .map(([provider, _]) => provider as StorageProvider);

    return {
      preferred: this.preferredProvider,
      available,
      healthCheck
    };
  }

  /**
   * مزامنة ملف بين مزودات التخزين المختلفة
   */
  async syncFileAcrossProviders(
    file: Buffer | string,
    fileName: string,
    targetProviders: StorageProvider[],
    contentType?: string
  ): Promise<Record<StorageProvider, StorageResult>> {
    const results: Record<StorageProvider, StorageResult> = {} as any;

    for (const provider of targetProviders) {
      try {
        results[provider] = await this.uploadToProvider(provider, file, fileName, contentType);
      } catch (error) {
        results[provider] = {
          success: false,
          error: `خطأ في ${provider}: ${error}`,
          provider
        };
      }
    }

    return results;
  }
}

// إنشاء instance وحيد من مدير التخزين
export const storageManager = new StorageManager();

// تصدير الدوال للاستخدام المباشر (للتوافق مع الكود الحالي)
export const uploadFile = async (
  file: Buffer | string,
  destination: string,
  contentType?: string,
  metadata?: Record<string, string>
): Promise<string> => {
  const result = await storageManager.uploadFile(file, destination, contentType, metadata);
  if (result.success && result.url) {
    return result.url;
  }
  throw new Error(result.error || 'فشل في رفع الملف');
};

export const deleteFile = async (fileUrl: string): Promise<boolean> => {
  return await storageManager.deleteFile(fileUrl);
};