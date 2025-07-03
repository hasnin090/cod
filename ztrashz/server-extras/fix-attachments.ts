import { neon } from '@neondatabase/serverless';
import { existsSync, readdirSync, statSync } from 'fs';
import path from 'path';

export class AttachmentFixer {
  private sql = neon(process.env.DATABASE_URL!);

  async fixOrphanedAttachments() {
    console.log('🔍 فحص المرفقات المفقودة...');
    
    // البحث عن الملفات في المجلد الجذر
    const orphanedFiles = this.findOrphanedFiles();
    console.log(`📁 تم العثور على ${orphanedFiles.length} ملف منفصل`);
    
    // البحث عن المعاملات التي تحتاج مرفقات
    const transactionsNeedingFiles = await this.findTransactionsWithoutFiles();
    console.log(`📋 ${transactionsNeedingFiles.length} معاملة بدون مرفقات`);
    
    // ربط الملفات بالمعاملات المناسبة
    const results = await this.linkFilesToTransactions(orphanedFiles, transactionsNeedingFiles);
    
    return {
      orphanedFiles: orphanedFiles.length,
      transactionsWithoutFiles: transactionsNeedingFiles.length,
      linked: results.linked,
      errors: results.errors
    };
  }

  private findOrphanedFiles() {
    const uploadsDir = './uploads';
    const orphanedFiles: any[] = [];
    
    if (!existsSync(uploadsDir)) return orphanedFiles;
    
    const items = readdirSync(uploadsDir);
    
    for (const item of items) {
      const fullPath = path.join(uploadsDir, item);
      const stat = statSync(fullPath);
      
      if (stat.isFile() && this.isValidFileType(item)) {
        const timestamp = this.extractTimestamp(item);
        orphanedFiles.push({
          name: item,
          path: fullPath,
          timestamp,
          size: stat.size
        });
      }
    }
    
    return orphanedFiles.sort((a, b) => a.timestamp - b.timestamp);
  }

  private async findTransactionsWithoutFiles() {
    const transactions = await this.sql(`
      SELECT id, date, description, type, amount 
      FROM transactions 
      WHERE (file_url IS NULL OR file_url = '') 
      AND date >= '2025-01-01'
      ORDER BY date DESC
    `);
    
    return transactions;
  }

  private async linkFilesToTransactions(files: any[], transactions: any[]) {
    const results = { linked: 0, errors: [] as string[] };
    
    for (const file of files) {
      try {
        // البحث عن أقرب معاملة زمنياً
        const fileDate = new Date(file.timestamp);
        let bestMatch = null;
        let minTimeDiff = Infinity;
        
        for (const transaction of transactions) {
          const transactionDate = new Date(transaction.date);
          const timeDiff = Math.abs(fileDate.getTime() - transactionDate.getTime());
          
          if (timeDiff < minTimeDiff) {
            minTimeDiff = timeDiff;
            bestMatch = transaction;
          }
        }
        
        // ربط الملف بالمعاملة إذا كان الفرق الزمني أقل من 24 ساعة
        if (bestMatch && minTimeDiff < 24 * 60 * 60 * 1000) {
          const fileUrl = `/uploads/${file.name}`;
          const fileType = this.getFileType(file.name);
          
          await this.sql(`
            UPDATE transactions 
            SET file_url = $1, file_type = $2 
            WHERE id = $3
          `, [fileUrl, fileType, bestMatch.id]);
          
          results.linked++;
          console.log(`✅ ربط ${file.name} بالمعاملة ${bestMatch.id}`);
          
          // إزالة المعاملة من القائمة لتجنب الربط المتكرر
          const index = transactions.indexOf(bestMatch);
          if (index > -1) transactions.splice(index, 1);
        }
      } catch (error) {
        results.errors.push(`خطأ في ربط ${file.name}: ${error}`);
      }
    }
    
    return results;
  }

  private extractTimestamp(fileName: string): number {
    const match = fileName.match(/^(\d{13})/);
    return match ? parseInt(match[1]) : 0;
  }

  private isValidFileType(fileName: string): boolean {
    const validExtensions = ['.jpg', '.jpeg', '.png', '.pdf', '.webp', '.txt'];
    return validExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
  }

  private getFileType(fileName: string): string {
    const extension = fileName.toLowerCase().split('.').pop();
    
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'pdf':
        return 'application/pdf';
      case 'webp':
        return 'image/webp';
      case 'txt':
        return 'text/plain';
      default:
        return 'application/octet-stream';
    }
  }

  async getAttachmentStatus() {
    const totalFiles = await this.countAllFiles();
    const transactionsWithFiles = await this.sql(`
      SELECT COUNT(*) as count 
      FROM transactions 
      WHERE file_url IS NOT NULL AND file_url != ''
    `);
    
    const orphaned = this.findOrphanedFiles();
    
    return {
      totalFiles,
      transactionsWithFiles: transactionsWithFiles[0].count,
      orphanedFiles: orphaned.length,
      fileList: orphaned.map(f => f.name)
    };
  }

  private async countAllFiles(): Promise<number> {
    let count = 0;
    
    const scanDir = (dir: string) => {
      if (!existsSync(dir)) return;
      
      const items = readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = statSync(fullPath);
        
        if (stat.isFile() && this.isValidFileType(item)) {
          count++;
        } else if (stat.isDirectory()) {
          scanDir(fullPath);
        }
      }
    };
    
    scanDir('./uploads');
    return count;
  }
}

export const attachmentFixer = new AttachmentFixer();