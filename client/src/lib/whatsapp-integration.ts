import { getApiBase } from "@/lib/api";

/**
 * WhatsApp Integration Utilities
 * يوفر وظائف أساسية للتكامل مع واتساب لاستقبال الملفات وربطها بالمعاملات
 */

export interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  webhookVerifyToken: string;
  businessAccountId: string;
}

export interface WhatsAppMessage {
  id: string;
  from: string;
  timestamp: string;
  type: 'text' | 'image' | 'document' | 'audio' | 'video';
  content: {
    text?: string;
    media_url?: string;
    filename?: string;
    mime_type?: string;
    caption?: string;
  };
}

/**
 * تهيئة إعدادات واتساب
 */
export function initializeWhatsApp(config: WhatsAppConfig): boolean {
  try {
    // التحقق من صحة الإعدادات
    if (!config.accessToken || !config.phoneNumberId || !config.webhookVerifyToken) {
      console.error('WhatsApp: Missing required configuration');
      return false;
    }

    // حفظ الإعدادات في localStorage أو متغيرات البيئة
    localStorage.setItem('whatsapp_config', JSON.stringify(config));
    
    console.log('WhatsApp integration initialized successfully');
    return true;
  } catch (error) {
    console.error('WhatsApp: Failed to initialize:', error);
    return false;
  }
}

/**
 * التحقق من صحة إعدادات واتساب
 */
export async function validateWhatsAppConfig(config: WhatsAppConfig): Promise<boolean> {
  try {
    const response = await fetch(`https://graph.facebook.com/v18.0/${config.phoneNumberId}`, {
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
      },
    });

    return response.ok;
  } catch (error) {
    console.error('WhatsApp: Config validation failed:', error);
    return false;
  }
}

/**
 * معالجة رسالة واردة من واتساب
 */
export async function processIncomingMessage(message: WhatsAppMessage): Promise<{
  success: boolean;
  transactionId?: number;
  documentId?: number;
  error?: string;
}> {
  try {
    // إذا كانت الرسالة تحتوي على ملف
    if (message.type !== 'text' && message.content.media_url) {
      // تحميل الملف
      const fileResult = await downloadWhatsAppMedia(message.content.media_url, message.content.filename || 'whatsapp-file');
      
      if (!fileResult.success) {
        return { success: false, error: 'فشل في تحميل الملف' };
      }

      // محاولة ربط الملف بمعاملة إذا كان النص يحتوي على رقم معاملة
      if (message.content.caption) {
        const transactionMatch = message.content.caption.match(/معاملة\s*#?(\d+)/i) || 
                                message.content.caption.match(/transaction\s*#?(\d+)/i);
        
        if (transactionMatch) {
          const transactionId = parseInt(transactionMatch[1]);
          // ربط الملف بالمعاملة (يتطلب API endpoint)
          const linkResult = await linkFileToTransaction(fileResult.fileUrl!, transactionId);
          
          if (linkResult.success) {
            return { 
              success: true, 
              transactionId,
              documentId: linkResult.documentId 
            };
          }
        }
      }

      // إنشاء مستند عام إذا لم يتم ربطه بمعاملة
      const docResult = await createGeneralDocument({
        title: message.content.filename || `ملف واتساب ${new Date().toLocaleString('ar-SA')}`,
        description: message.content.caption || 'ملف مستلم عبر واتساب',
        fileUrl: fileResult.fileUrl!,
        fileType: message.content.mime_type || 'application/octet-stream',
        category: 'whatsapp',
      });

      return {
        success: true,
        documentId: docResult.documentId,
      };
    }

    // معالجة الرسائل النصية
    if (message.type === 'text' && message.content.text) {
      // يمكن إضافة منطق لمعالجة الأوامر النصية هنا
      console.log('WhatsApp text message received:', message.content.text);
      return { success: true };
    }

    return { success: false, error: 'نوع رسالة غير مدعوم' };
  } catch (error) {
    console.error('WhatsApp: Failed to process message:', error);
    return { success: false, error: 'خطأ في معالجة الرسالة' };
  }
}

/**
 * تحميل ملف من واتساب
 */
async function downloadWhatsAppMedia(mediaUrl: string, filename: string): Promise<{
  success: boolean;
  fileUrl?: string;
  error?: string;
}> {
  try {
    const config = JSON.parse(localStorage.getItem('whatsapp_config') || '{}') as WhatsAppConfig;
    
    // الحصول على URL الملف الفعلي
    const mediaResponse = await fetch(mediaUrl, {
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
      },
    });

    if (!mediaResponse.ok) {
      return { success: false, error: 'فشل في الحصول على الملف' };
    }

    const fileBlob = await mediaResponse.blob();
    
    // رفع الملف إلى النظام (يتطلب تنفيذ upload endpoint)
    const formData = new FormData();
    formData.append('file', fileBlob, filename);
    formData.append('source', 'whatsapp');

    const uploadResponse = await fetch(`${getApiBase()}/upload-whatsapp-file`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    if (uploadResponse.ok) {
      const result = await uploadResponse.json();
      return { success: true, fileUrl: result.fileUrl };
    }

    return { success: false, error: 'فشل في رفع الملف' };
  } catch (error) {
    console.error('WhatsApp: Media download failed:', error);
    return { success: false, error: 'خطأ في تحميل الملف' };
  }
}

/**
 * ربط ملف بمعاملة موجودة
 */
async function linkFileToTransaction(fileUrl: string, transactionId: number): Promise<{
  success: boolean;
  documentId?: number;
  error?: string;
}> {
  try {
    const response = await fetch(`${getApiBase()}/transactions/link-document`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transactionId,
        fileUrl,
        source: 'whatsapp',
      }),
    });

    if (response.ok) {
      const result = await response.json();
      return { success: true, documentId: result.documentId };
    }

    return { success: false, error: 'فشل في ربط الملف بالمعاملة' };
  } catch (error) {
    console.error('WhatsApp: Failed to link file to transaction:', error);
    return { success: false, error: 'خطأ في ربط الملف' };
  }
}

/**
 * إنشاء مستند عام
 */
async function createGeneralDocument(docData: {
  title: string;
  description: string;
  fileUrl: string;
  fileType: string;
  category: string;
}): Promise<{
  success: boolean;
  documentId?: number;
  error?: string;
}> {
  try {
    const response = await fetch(`${getApiBase()}/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(docData),
    });

    if (response.ok) {
      const result = await response.json();
      return { success: true, documentId: result.id };
    }

    return { success: false, error: 'فشل في إنشاء المستند' };
  } catch (error) {
    console.error('WhatsApp: Failed to create document:', error);
    return { success: false, error: 'خطأ في إنشاء المستند' };
  }
}

/**
 * إرسال رسالة واتساب
 */
export async function sendWhatsAppMessage(to: string, message: string): Promise<boolean> {
  try {
    const config = JSON.parse(localStorage.getItem('whatsapp_config') || '{}') as WhatsAppConfig;
    
    const response = await fetch(`https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to,
        text: { body: message },
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('WhatsApp: Failed to send message:', error);
    return false;
  }
}

/**
 * الحصول على حالة الاتصال
 */
export function getWhatsAppConnectionStatus(): {
  connected: boolean;
  configured: boolean;
  error?: string;
} {
  try {
    const config = localStorage.getItem('whatsapp_config');
    const configured = !!config;
    
    return {
      connected: configured, // يمكن تحسين هذا بفحص الاتصال الفعلي
      configured,
    };
  } catch (error) {
    return {
      connected: false,
      configured: false,
      error: 'خطأ في قراءة الإعدادات',
    };
  }
}
