import { neon } from '@neondatabase/serverless';
import { getFirebaseStorage } from './firebase-storage';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';

interface MissingAttachment {
  transactionId: number;
  originalUrl: string;
  filename: string;
  fileType: string;
}

interface RecoveryResult {
  totalMissing: number;
  recoveredFromSupabase: number;
  recoveredFromFirebase: number;
  stillMissing: number;
  errors: string[];
}

export class AttachmentRecovery {
  private sql = neon(process.env.DATABASE_URL!);
  private uploadsDir = './uploads';

  /**
   * فحص المرفقات المفقودة ومحاولة استعادتها
   */
  async recoverMissingAttachments(): Promise<RecoveryResult> {
    const result: RecoveryResult = {
      totalMissing: 0,
      recoveredFromSupabase: 0,
      recoveredFromFirebase: 0,
      stillMissing: 0,
      errors: []
    };

    try {
      // العثور على المعاملات التي تحتوي على مرفقات مفقودة
      const missingAttachments = await this.findMissingAttachments();
      result.totalMissing = missingAttachments.length;

      console.log(`🔍 تم العثور على ${missingAttachments.length} مرفق مفقود`);

      for (const attachment of missingAttachments) {
        let recovered = false;

        // محاولة الاستعادة من Supabase
        try {
          const supabaseRecovered = await this.recoverFromSupabase(attachment);
          if (supabaseRecovered) {
            result.recoveredFromSupabase++;
            recovered = true;
            console.log(`✅ تم استعادة ${attachment.filename} من Supabase`);
          }
        } catch (error) {
          result.errors.push(`Supabase recovery failed for ${attachment.filename}: ${error}`);
        }

        // إذا فشلت استعادة Supabase، جرب Firebase
        if (!recovered) {
          try {
            const firebaseRecovered = await this.recoverFromFirebase(attachment);
            if (firebaseRecovered) {
              result.recoveredFromFirebase++;
              recovered = true;
              console.log(`✅ تم استعادة ${attachment.filename} من Firebase`);
            }
          } catch (error) {
            result.errors.push(`Firebase recovery failed for ${attachment.filename}: ${error}`);
          }
        }

        if (!recovered) {
          result.stillMissing++;
          console.log(`❌ فشل في استعادة ${attachment.filename}`);
        }
      }

      console.log(`📊 نتائج الاستعادة: ${result.recoveredFromSupabase} من Supabase، ${result.recoveredFromFirebase} من Firebase، ${result.stillMissing} لا يزال مفقود`);

    } catch (error) {
      console.error('خطأ في عملية استعادة المرفقات:', error);
      result.errors.push(`General error: ${error}`);
    }

    return result;
  }

  /**
   * العثور على المرفقات المفقودة
   */
  private async findMissingAttachments(): Promise<MissingAttachment[]> {
    // البحث في المعاملات التي تم تنظيفها مؤخراً
    const recentlyCleanedTransactions = await this.sql(`
      SELECT id, description, date, created_at
      FROM transactions 
      WHERE file_url IS NULL 
      AND file_type IS NULL
      AND created_at < NOW() - INTERVAL '1 week'
      AND (description ILIKE '%pdf%' OR description ILIKE '%صورة%' OR description ILIKE '%مرفق%')
      ORDER BY created_at DESC
      LIMIT 50
    `);

    const missingAttachments: MissingAttachment[] = [];

    // محاولة تخمين أسماء الملفات المحتملة بناءً على تاريخ المعاملة ومعرفها
    for (const transaction of recentlyCleanedTransactions) {
      const transactionDate = new Date(transaction.created_at);
      const timestamp = transactionDate.getTime();
      
      // أنماط أسماء الملفات المحتملة
      const possiblePatterns = [
        `${timestamp}_*_${transaction.id}_*.pdf`,
        `${timestamp}_*_${transaction.id}_*.jpg`,
        `${timestamp}_*_${transaction.id}_*.png`,
        `174686*_*_${transaction.id}_*.pdf`, // الملفات من يونيو 2025
        `174687*_*_${transaction.id}_*.pdf`
      ];

      for (const pattern of possiblePatterns) {
        missingAttachments.push({
          transactionId: transaction.id,
          originalUrl: `/uploads/${pattern}`,
          filename: pattern,
          fileType: pattern.includes('.pdf') ? 'application/pdf' : 'image/jpeg'
        });
      }
    }

    return missingAttachments;
  }

  /**
   * محاولة استعادة ملف من Supabase
   */
  private async recoverFromSupabase(attachment: MissingAttachment): Promise<boolean> {
    try {
      // محاولة استيراد عميل Supabase
      const { checkSupabaseSimpleHealth } = await import('./supabase-simple');
      const health = await checkSupabaseSimpleHealth();
      
      if (!health.storage) {
        return false;
      }

      // سيتم تنفيذ منطق استعادة Supabase هنا في المستقبل
      console.log(`⏭️ استعادة Supabase لـ ${attachment.filename} - قيد التطوير`);
      return false;

    } catch (error) {
      console.error(`خطأ في استعادة من Supabase:`, error);
      return false;
    }
  }

  /**
   * محاولة استعادة ملف من Firebase
   */
  private async recoverFromFirebase(attachment: MissingAttachment): Promise<boolean> {
    try {
      const storage = getFirebaseStorage();
      if (!storage) {
        return false;
      }

      // البحث عن الملف في Firebase Storage
      const bucket = storage.bucket();
      const [files] = await bucket.getFiles({
        prefix: `files/`,
        delimiter: '/'
      });

      // العثور على ملف مطابق
      const matchingFile = files.find((file: any) => 
        file.name.includes(attachment.transactionId.toString())
      );

      if (!matchingFile) {
        return false;
      }

      // تحميل الملف من Firebase
      const [fileBuffer] = await matchingFile.download();

      // حفظ الملف محلياً
      const newLocalPath = await this.saveRecoveredFile(attachment, fileBuffer);
      
      // تحديث قاعدة البيانات
      if (newLocalPath) {
        await this.updateTransactionAttachment(attachment.transactionId, newLocalPath, attachment.fileType);
        return true;
      }

    } catch (error) {
      console.error(`خطأ في استعادة من Firebase:`, error);
    }

    return false;
  }

  /**
   * حفظ الملف المستعاد محلياً
   */
  private async saveRecoveredFile(attachment: MissingAttachment, fileData: Buffer | Blob): Promise<string | null> {
    try {
      let buffer: Buffer;
      
      if (fileData instanceof Buffer) {
        buffer = fileData;
      } else {
        buffer = Buffer.from(await fileData.arrayBuffer());
      }
      
      // إنشاء مسار جديد منظم
      const timestamp = Date.now();
      const fileExtension = attachment.fileType === 'application/pdf' ? 'pdf' : 'jpg';
      const fileName = `${timestamp}_recovered_${attachment.transactionId}.${fileExtension}`;
      
      const transactionDir = path.join(this.uploadsDir, 'transactions', attachment.transactionId.toString());
      const filePath = path.join(transactionDir, fileName);

      // إنشاء المجلد إذا لم يكن موجوداً
      if (!existsSync(transactionDir)) {
        mkdirSync(transactionDir, { recursive: true });
      }

      // كتابة الملف
      writeFileSync(filePath, buffer);

      // إرجاع المسار النسبي
      return `/uploads/transactions/${attachment.transactionId}/${fileName}`;

    } catch (error) {
      console.error('خطأ في حفظ الملف المستعاد:', error);
      return null;
    }
  }

  /**
   * تحديث المعاملة بالمرفق المستعاد
   */
  private async updateTransactionAttachment(transactionId: number, fileUrl: string, fileType: string): Promise<void> {
    await this.sql(`
      UPDATE transactions 
      SET file_url = $1, file_type = $2, updated_at = NOW()
      WHERE id = $3
    `, [fileUrl, fileType, transactionId]);
  }

  /**
   * تقرير حالة المرفقات
   */
  async getAttachmentsStatus(): Promise<{
    totalTransactions: number;
    withAttachments: number;
    missingAttachments: number;
    availableAttachments: number;
  }> {
    const [stats] = await this.sql(`
      SELECT 
        COUNT(*) as total_transactions,
        COUNT(CASE WHEN file_url IS NOT NULL THEN 1 END) as with_attachments
      FROM transactions
    `);

    let missingAttachments = 0;
    let availableAttachments = 0;

    // فحص الملفات الموجودة فعلياً
    const transactionsWithFiles = await this.sql(`
      SELECT file_url FROM transactions WHERE file_url IS NOT NULL
    `);

    for (const transaction of transactionsWithFiles) {
      const localPath = transaction.file_url.replace('/uploads/', './uploads/');
      if (existsSync(localPath)) {
        availableAttachments++;
      } else {
        missingAttachments++;
      }
    }

    return {
      totalTransactions: stats.total_transactions,
      withAttachments: stats.with_attachments,
      missingAttachments,
      availableAttachments
    };
  }
}

export const attachmentRecovery = new AttachmentRecovery();