import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

/**
 * أداة إصلاح الملفات المفقودة وتنظيف قاعدة البيانات
 */
export class MissingFilesFixer {
  private sql = neon(process.env.DATABASE_URL!);
  private uploadsDir = './uploads';

  /**
   * فحص وإصلاح الملفات المفقودة
   */
  async fixMissingFiles(): Promise<{
    checkedTransactions: number;
    checkedDocuments: number;
    fixedTransactions: number;
    fixedDocuments: number;
    missingFiles: string[];
  }> {
    const result = {
      checkedTransactions: 0,
      checkedDocuments: 0,
      fixedTransactions: 0,
      fixedDocuments: 0,
      missingFiles: [] as string[]
    };

    console.log('🔍 بدء فحص الملفات المفقودة...');

    // فحص وإصلاح المعاملات
    await this.fixTransactionFiles(result);
    
    // فحص وإصلاح المستندات
    await this.fixDocumentFiles(result);

    console.log('✅ انتهى فحص وإصلاح الملفات المفقودة');
    
    return result;
  }

  /**
   * فحص وإصلاح ملفات المعاملات
   */
  private async fixTransactionFiles(result: any): Promise<void> {
    const transactions = await this.sql`
      SELECT id, file_url, file_type, description
      FROM transactions 
      WHERE file_url IS NOT NULL AND file_url != ''
    `;

    result.checkedTransactions = transactions.length;
    console.log(`📋 فحص ${transactions.length} معاملة تحتوي على مرفقات...`);

    for (const transaction of transactions) {
      const fileUrl = transaction.file_url;
      
      if (this.isFileUrl(fileUrl)) {
        const filePath = this.extractLocalPath(fileUrl);
        
        if (filePath && !fs.existsSync(filePath)) {
          console.log(`❌ ملف مفقود: ${filePath} - المعاملة ${transaction.id}`);
          result.missingFiles.push(filePath);
          
          // إزالة المرجع الخاطئ من قاعدة البيانات
          await this.sql`
            UPDATE transactions 
            SET file_url = NULL, file_type = NULL
            WHERE id = ${transaction.id}
          `;
          
          result.fixedTransactions++;
          console.log(`🔧 تم تنظيف المرجع للمعاملة ${transaction.id}`);
        }
      }
    }
  }

  /**
   * فحص وإصلاح ملفات المستندات
   */
  private async fixDocumentFiles(result: any): Promise<void> {
    const documents = await this.sql`
      SELECT id, file_url, name
      FROM documents 
      WHERE file_url IS NOT NULL AND file_url != ''
    `;

    result.checkedDocuments = documents.length;
    console.log(`📋 فحص ${documents.length} مستند...`);

    for (const document of documents) {
      const fileUrl = document.file_url;
      
      if (this.isFileUrl(fileUrl)) {
        const filePath = this.extractLocalPath(fileUrl);
        
        if (filePath && !fs.existsSync(filePath)) {
          console.log(`❌ ملف مفقود: ${filePath} - المستند ${document.id}`);
          result.missingFiles.push(filePath);
          
          // إزالة المرجع الخاطئ من قاعدة البيانات
          await this.sql`
            UPDATE documents 
            SET file_url = NULL
            WHERE id = ${document.id}
          `;
          
          result.fixedDocuments++;
          console.log(`🔧 تم تنظيف المرجع للمستند ${document.id}`);
        }
      }
    }
  }

  /**
   * فحص إذا كان الرابط ملف محلي
   */
  private isFileUrl(url: string): boolean {
    return url && (
      url.includes('./uploads/') || 
      url.includes('/uploads/') ||
      url.startsWith('uploads/')
    );
  }

  /**
   * استخراج مسار الملف المحلي من URL
   */
  private extractLocalPath(url: string): string | null {
    if (!url) return null;
    
    // إزالة domain والبروتوكول إذا وجد
    let cleanPath = url.replace(/^https?:\/\/[^\/]+/, '');
    
    // إزالة المعاملات من URL
    cleanPath = cleanPath.split('?')[0];
    
    // التأكد من أن المسار يبدأ بـ uploads
    if (cleanPath.includes('/uploads/')) {
      cleanPath = cleanPath.substring(cleanPath.indexOf('/uploads/') + 1);
    } else if (cleanPath.startsWith('./uploads/')) {
      cleanPath = cleanPath.substring(2);
    } else if (cleanPath.startsWith('uploads/')) {
      // المسار صحيح كما هو
    } else {
      return null;
    }
    
    // إنشاء المسار الكامل
    return path.join(process.cwd(), cleanPath);
  }

  /**
   * إنشاء تقرير بالملفات المفقودة
   */
  async generateMissingFilesReport(): Promise<{
    totalTransactions: number;
    transactionsWithFiles: number;
    totalDocuments: number;
    documentsWithFiles: number;
    existingFiles: string[];
    missingReferences: string[];
  }> {
    console.log('📊 إنشاء تقرير الملفات المفقودة...');

    const [transactions, documents] = await Promise.all([
      this.sql`SELECT id, file_url FROM transactions WHERE file_url IS NOT NULL AND file_url != ''`,
      this.sql`SELECT id, file_url FROM documents WHERE file_url IS NOT NULL AND file_url != ''`
    ]);

    const existingFiles: string[] = [];
    const missingReferences: string[] = [];

    // فحص ملفات المعاملات
    for (const transaction of transactions) {
      const filePath = this.extractLocalPath(transaction.file_url);
      if (filePath) {
        if (fs.existsSync(filePath)) {
          existingFiles.push(filePath);
        } else {
          missingReferences.push(`معاملة ${transaction.id}: ${filePath}`);
        }
      }
    }

    // فحص ملفات المستندات
    for (const document of documents) {
      const filePath = this.extractLocalPath(document.file_url);
      if (filePath) {
        if (fs.existsSync(filePath)) {
          existingFiles.push(filePath);
        } else {
          missingReferences.push(`مستند ${document.id}: ${filePath}`);
        }
      }
    }

    return {
      totalTransactions: (await this.sql`SELECT COUNT(*) as count FROM transactions`)[0].count,
      transactionsWithFiles: transactions.length,
      totalDocuments: (await this.sql`SELECT COUNT(*) as count FROM documents`)[0].count,
      documentsWithFiles: documents.length,
      existingFiles,
      missingReferences
    };
  }
}

export const missingFilesFixer = new MissingFilesFixer();