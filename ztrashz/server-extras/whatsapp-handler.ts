import { Request, Response } from 'express';
import { neon } from '@neondatabase/serverless';
// استخدام fetch المدمج في Node.js 18+
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface WhatsAppMessage {
  id: string;
  from: string;
  timestamp: string;
  type: 'text' | 'image' | 'document' | 'audio' | 'video';
  text?: {
    body: string;
  };
  image?: {
    id: string;
    mime_type: string;
    sha256: string;
    caption?: string;
  };
  document?: {
    id: string;
    mime_type: string;
    sha256: string;
    filename: string;
    caption?: string;
  };
  audio?: {
    id: string;
    mime_type: string;
    sha256: string;
  };
  video?: {
    id: string;
    mime_type: string;
    sha256: string;
    caption?: string;
  };
}

interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        messages?: WhatsAppMessage[];
        statuses?: any[];
      };
      field: string;
    }>;
  }>;
}

export class WhatsAppHandler {
  private sql = neon(process.env.DATABASE_URL!);
  private readonly VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'your_verify_token';
  private readonly ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
  private readonly PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

  // التحقق من webhook (مطلوب لإعداد WhatsApp)
  async verifyWebhook(req: Request, res: Response) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === this.VERIFY_TOKEN) {
      console.log('✅ تم التحقق من webhook بنجاح');
      res.status(200).send(challenge);
    } else {
      console.log('❌ فشل في التحقق من webhook');
      res.sendStatus(403);
    }
  }

  // معالجة الرسائل الواردة
  async handleIncomingMessage(req: Request, res: Response) {
    try {
      const payload: WhatsAppWebhookPayload = req.body;

      // التحقق من صحة البيانات
      if (payload.object !== 'whatsapp_business_account') {
        return res.sendStatus(404);
      }

      // معالجة كل رسالة
      for (const entry of payload.entry) {
        for (const change of entry.changes) {
          if (change.field === 'messages' && change.value.messages) {
            for (const message of change.value.messages) {
              await this.processMessage(message);
            }
          }
        }
      }

      res.sendStatus(200);
    } catch (error) {
      console.error('خطأ في معالجة رسالة WhatsApp:', error);
      res.sendStatus(500);
    }
  }

  // معالجة رسالة واحدة
  private async processMessage(message: WhatsAppMessage) {
    console.log(`📱 رسالة جديدة من ${message.from}:`, message.type);

    try {
      // التحقق من وجود المستخدم في النظام
      const user = await this.findUserByPhone(message.from);
      if (!user) {
        await this.sendMessage(message.from, 'عذراً، رقم الهاتف غير مسجل في النظام. يرجى التواصل مع الإدارة.');
        return;
      }

      // معالجة حسب نوع الرسالة
      switch (message.type) {
        case 'image':
        case 'document':
        case 'audio':
        case 'video':
          await this.handleMediaMessage(message, user);
          break;
        case 'text':
          await this.handleTextMessage(message, user);
          break;
        default:
          await this.sendMessage(message.from, 'نوع الملف غير مدعوم. يرجى إرسال صور أو مستندات أو ملفات صوتية.');
      }
    } catch (error) {
      console.error('خطأ في معالجة الرسالة:', error);
      await this.sendMessage(message.from, 'حدث خطأ في معالجة رسالتك. يرجى المحاولة مرة أخرى.');
    }
  }

  // معالجة الملفات المرسلة
  private async handleMediaMessage(message: WhatsAppMessage, user: any) {
    let mediaInfo: any;
    let caption = '';

    // استخراج معلومات الملف حسب النوع
    switch (message.type) {
      case 'image':
        mediaInfo = message.image;
        caption = mediaInfo?.caption || '';
        break;
      case 'document':
        mediaInfo = message.document;
        caption = mediaInfo?.caption || '';
        break;
      case 'audio':
        mediaInfo = message.audio;
        break;
      case 'video':
        mediaInfo = message.video;
        caption = mediaInfo?.caption || '';
        break;
    }

    if (!mediaInfo) {
      await this.sendMessage(message.from, 'لم يتم العثور على الملف في الرسالة.');
      return;
    }

    try {
      // تحميل الملف من WhatsApp
      const fileBuffer = await this.downloadMedia(mediaInfo.id);
      
      // تحديد اسم الملف
      const timestamp = new Date().getTime();
      const extension = this.getFileExtension(mediaInfo.mime_type);
      const fileName = mediaInfo.filename || `whatsapp_${message.type}_${timestamp}${extension}`;
      
      // حفظ الملف محلياً
      const filePath = await this.saveFile(fileBuffer, fileName);
      
      // حفظ بيانات الملف في قاعدة البيانات
      await this.saveFileToDatabase({
        fileName,
        filePath,
        mimeType: mediaInfo.mime_type,
        size: fileBuffer.length,
        uploadedBy: user.id,
        uploadedVia: 'whatsapp',
        phoneNumber: message.from,
        caption: caption || '',
        whatsappMessageId: message.id,
        uploadDate: new Date()
      });

      // إرسال رسالة تأكيد
      let confirmationMessage = `✅ تم استلام الملف بنجاح!\n\n📁 اسم الملف: ${fileName}\n📏 الحجم: ${this.formatFileSize(fileBuffer.length)}\n👤 تم رفعه بواسطة: ${user.name}`;
      
      if (caption) {
        confirmationMessage += `\n💬 الوصف: ${caption}`;
      }

      await this.sendMessage(message.from, confirmationMessage);

      console.log(`✅ تم حفظ ملف WhatsApp: ${fileName} من المستخدم ${user.name}`);
    } catch (error) {
      console.error('خطأ في معالجة الملف:', error);
      await this.sendMessage(message.from, 'حدث خطأ في حفظ الملف. يرجى المحاولة مرة أخرى.');
    }
  }

  // معالجة الرسائل النصية
  private async handleTextMessage(message: WhatsAppMessage, user: any) {
    const text = message.text?.body?.toLowerCase() || '';

    if (text.includes('مساعدة') || text.includes('help')) {
      const helpMessage = `🤖 مساعدة النظام\n\nيمكنك إرسال:\n📷 الصور\n📄 المستندات (PDF, Word, Excel)\n🎵 الملفات الصوتية\n🎬 مقاطع الفيديو\n\nسيتم حفظ جميع الملفات تلقائياً في النظام مع ربطها بحسابك.`;
      await this.sendMessage(message.from, helpMessage);
    } else {
      await this.sendMessage(message.from, 'مرحباً! يمكنك إرسال الملفات والصور وسيتم حفظها تلقائياً في النظام.\n\nأرسل "مساعدة" لمزيد من المعلومات.');
    }
  }

  // البحث عن المستخدم بالهاتف
  private async findUserByPhone(phoneNumber: string): Promise<any> {
    // إزالة رمز البلد وتنسيق الرقم
    const cleanPhone = phoneNumber.replace(/^\+?966/, '').replace(/\D/g, '');
    
    try {
      const result = await this.sql`
        SELECT id, name, username, phone 
        FROM users 
        WHERE phone LIKE ${'%' + cleanPhone} 
        OR phone LIKE ${'%' + phoneNumber + '%'}
        LIMIT 1
      `;
      
      return result[0] || null;
    } catch (error) {
      console.error('خطأ في البحث عن المستخدم:', error);
      return null;
    }
  }

  // تحميل الملف من WhatsApp
  private async downloadMedia(mediaId: string): Promise<Buffer> {
    if (!this.ACCESS_TOKEN) {
      throw new Error('WhatsApp Access Token غير متوفر');
    }

    // الحصول على URL الملف
    const mediaUrlResponse = await fetch(
      `https://graph.facebook.com/v18.0/${mediaId}`,
      {
        headers: {
          'Authorization': `Bearer ${this.ACCESS_TOKEN}`
        }
      }
    );

    if (!mediaUrlResponse.ok) {
      throw new Error('فشل في الحصول على رابط الملف');
    }

    const mediaData = await mediaUrlResponse.json() as any;
    
    // تحميل الملف
    const fileResponse = await fetch(mediaData.url, {
      headers: {
        'Authorization': `Bearer ${this.ACCESS_TOKEN}`
      }
    });

    if (!fileResponse.ok) {
      throw new Error('فشل في تحميل الملف');
    }

    return Buffer.from(await fileResponse.arrayBuffer());
  }

  // حفظ الملف محلياً
  private async saveFile(fileBuffer: Buffer, fileName: string): Promise<string> {
    const uploadDir = path.join('./uploads/whatsapp');
    
    // إنشاء المجلد إذا لم يكن موجوداً
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, fileBuffer);
    
    return `/uploads/whatsapp/${fileName}`;
  }

  // حفظ بيانات الملف في قاعدة البيانات
  private async saveFileToDatabase(fileData: any) {
    await this.sql`
      INSERT INTO documents (
        name, file_path, file_type, file_size, 
        uploaded_by, uploaded_via, metadata, 
        created_at, updated_at
      ) VALUES (
        ${fileData.fileName},
        ${fileData.filePath},
        ${fileData.mimeType},
        ${fileData.size},
        ${fileData.uploadedBy},
        ${fileData.uploadedVia},
        ${JSON.stringify({
          phoneNumber: fileData.phoneNumber,
          caption: fileData.caption,
          whatsappMessageId: fileData.whatsappMessageId
        })},
        NOW(),
        NOW()
      )
    `;
  }

  // إرسال رسالة إلى WhatsApp
  private async sendMessage(to: string, message: string) {
    if (!this.ACCESS_TOKEN || !this.PHONE_NUMBER_ID) {
      console.log('WhatsApp credentials غير متوفرة، لا يمكن إرسال الرسالة');
      return;
    }

    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${this.PHONE_NUMBER_ID}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: to,
            type: 'text',
            text: {
              body: message
            }
          })
        }
      );

      if (!response.ok) {
        console.error('فشل في إرسال رسالة WhatsApp:', await response.text());
      }
    } catch (error) {
      console.error('خطأ في إرسال رسالة WhatsApp:', error);
    }
  }

  // تحديد امتداد الملف
  private getFileExtension(mimeType: string): string {
    const extensions: { [key: string]: string } = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'application/vnd.ms-excel': '.xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
      'audio/mpeg': '.mp3',
      'audio/ogg': '.ogg',
      'audio/wav': '.wav',
      'video/mp4': '.mp4',
      'video/3gpp': '.3gp',
      'text/plain': '.txt'
    };

    return extensions[mimeType] || '';
  }

  // تنسيق حجم الملف
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 بايت';
    
    const k = 1024;
    const sizes = ['بايت', 'كيلوبايت', 'ميجابايت', 'جيجابايت'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export const whatsappHandler = new WhatsAppHandler();