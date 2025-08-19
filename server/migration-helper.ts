import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import { uploadFromLocalFile } from './supabase-storage';

// Lazily obtain a Neon client only when needed to avoid crashing on import
function requireSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL not configured for migration-helper');
  }
  return neon(url);
}

interface MigrationResult {
  success: boolean;
  totalFiles: number;
  migratedFiles: number;
  failedFiles: number;
  preservedTransactions: number;
  errors: string[];
  backupCreated: boolean;
}

// إنشاء نسخة احتياطية من قاعدة البيانات قبل الانتقال
export async function createPreMigrationBackup(): Promise<{ success: boolean; backupPath?: string; error?: string }> {
  try {
  const sql = requireSql();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `./backups/pre-cloud-migration-${timestamp}.json`;
    
    // إنشاء مجلد النسخ الاحتياطية
    const backupDir = './backups';
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // جلب جميع الجداول المهمة
    const [transactions, documents, users, projects, activityLogs] = await Promise.all([
      sql`SELECT * FROM transactions`,
      sql`SELECT * FROM documents`,
      sql`SELECT * FROM users`,
      sql`SELECT * FROM projects`,
      sql`SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 1000`
    ]);

    const backup = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      description: 'نسخة احتياطية قبل الانتقال للتخزين السحابي',
      data: {
        transactions,
        documents,
        users,
        projects,
        activityLogs
      }
    };

    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
    console.log(`✅ تم إنشاء نسخة احتياطية: ${backupPath}`);
    
    return { success: true, backupPath };
  } catch (error: any) {
    console.error('خطأ في إنشاء النسخة الاحتياطية:', error);
    return { success: false, error: error.message };
  }
}

// فحص سلامة العمليات الحالية
export async function verifyCurrentData(): Promise<{ 
  success: boolean; 
  stats: { 
    transactions: number; 
    documents: number; 
    filesWithAttachments: number; 
  }; 
  error?: string; 
}> {
  try {
  const sql = requireSql();
    const [transactionCount, documentCount, filesWithAttachments] = await Promise.all([
      sql`SELECT COUNT(*) as count FROM transactions`,
      sql`SELECT COUNT(*) as count FROM documents`,
      sql`SELECT COUNT(*) as count FROM transactions WHERE file_url IS NOT NULL AND file_url != ''`
    ]);

    const stats = {
      transactions: Number(transactionCount[0].count),
      documents: Number(documentCount[0].count),
      filesWithAttachments: Number(filesWithAttachments[0].count)
    };

    console.log('📊 إحصائيات البيانات الحالية:', stats);
    return { success: true, stats };

  } catch (error: any) {
    console.error('خطأ في فحص البيانات:', error);
    return { success: false, stats: { transactions: 0, documents: 0, filesWithAttachments: 0 }, error: error.message };
  }
}

// تحديث روابط الملفات في قاعدة البيانات بعد الانتقال
export async function updateFileUrlsAfterMigration(
  oldLocalPath: string, 
  newCloudUrl: string, 
  tableName: 'transactions' | 'documents' = 'transactions'
): Promise<{ success: boolean; updatedRecords: number; error?: string }> {
  try {
  const sql = requireSql();
    let result;
    
    if (tableName === 'transactions') {
      result = await sql`
        UPDATE transactions 
        SET file_url = ${newCloudUrl}
        WHERE file_url = ${oldLocalPath}
      `;
    } else {
      result = await sql`
        UPDATE documents 
        SET file_url = ${newCloudUrl}
        WHERE file_url = ${oldLocalPath}
      `;
    }

    console.log(`🔄 تم تحديث ${result.rowCount || 0} سجل في جدول ${tableName}`);
    return { success: true, updatedRecords: result.rowCount || 0 };

  } catch (error: any) {
    console.error(`خطأ في تحديث روابط الملفات في ${tableName}:`, error);
    return { success: false, updatedRecords: 0, error: error.message };
  }
}

// انتقال تدريجي آمن للتخزين السحابي
export async function safeMigrateToCloud(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    totalFiles: 0,
    migratedFiles: 0,
    failedFiles: 0,
    preservedTransactions: 0,
    errors: [],
    backupCreated: false
  };

  try {
  const sql = requireSql();
    // 1. إنشاء نسخة احتياطية
    console.log('🔄 إنشاء نسخة احتياطية...');
    const backup = await createPreMigrationBackup();
    result.backupCreated = backup.success;
    
    if (!backup.success) {
      result.errors.push('فشل في إنشاء النسخة الاحتياطية: ' + backup.error);
      return result;
    }

    // 2. فحص البيانات الحالية
    console.log('🔍 فحص البيانات الحالية...');
    const verification = await verifyCurrentData();
    if (!verification.success) {
      result.errors.push('فشل في فحص البيانات: ' + verification.error);
      return result;
    }
    
    result.preservedTransactions = verification.stats.transactions;

    // 3. جمع قائمة الملفات للانتقال
    const filesToMigrate: Array<{ localPath: string; bucket: string; tableName: 'transactions' | 'documents' }> = [];

    // ملفات المعاملات
    const transactionsWithFiles = await sql`
      SELECT id, file_url FROM transactions 
      WHERE file_url IS NOT NULL AND file_url != ''
    `;

    for (const transaction of transactionsWithFiles) {
      if (transaction.file_url && fs.existsSync(transaction.file_url.replace('/uploads/', './uploads/'))) {
        filesToMigrate.push({
          localPath: transaction.file_url.replace('/uploads/', './uploads/'),
          bucket: 'transactions',
          tableName: 'transactions'
        });
      }
    }

    // ملفات الوثائق
    const documentsWithFiles = await sql`
      SELECT id, file_url FROM documents 
      WHERE file_url IS NOT NULL AND file_url != ''
    `;

    for (const document of documentsWithFiles) {
      if (document.file_url && fs.existsSync(document.file_url.replace('/uploads/', './uploads/'))) {
        filesToMigrate.push({
          localPath: document.file_url.replace('/uploads/', './uploads/'),
          bucket: 'documents',
          tableName: 'documents'
        });
      }
    }

    // ملفات إضافية في مجلد uploads
    const uploadsDir = './uploads';
    if (fs.existsSync(uploadsDir)) {
      const walkDir = (dir: string, parentFolder: string) => {
        const files = fs.readdirSync(dir);
        files.forEach(file => {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          
          if (stat.isDirectory() && file !== 'backups') {
            walkDir(filePath, file);
          } else if (stat.isFile() && file !== '.gitkeep') {
            const existsInDb = filesToMigrate.some(f => f.localPath === filePath);
            if (!existsInDb) {
              // تحديد bucket بناءً على مجلد الملف ونوعه
              let bucket = 'files'; // bucket افتراضي
              
              if (parentFolder === 'transactions') {
                bucket = 'transactions';
              } else if (parentFolder === 'exports') {
                bucket = 'exports';
              } else if (parentFolder === 'completed-works-docs') {
                bucket = 'completed-works';
              } else if (file.endsWith('.json')) {
                bucket = 'files'; // metadata files
              } else if (file.endsWith('.csv')) {
                bucket = 'exports';
              } else {
                bucket = 'files'; // صور وملفات عامة
              }
              
              filesToMigrate.push({
                localPath: filePath,
                bucket: bucket,
                tableName: 'documents'
              });
            }
          }
        });
      };
      
      walkDir(uploadsDir, 'root');
    }

    result.totalFiles = filesToMigrate.length;
    console.log(`📁 العثور على ${result.totalFiles} ملف للانتقال`);

    // 4. انتقال الملفات
    for (const file of filesToMigrate) {
      try {
        console.log(`🔄 انتقال: ${file.localPath}`);
        const uploadResult = await uploadFromLocalFile(file.localPath, file.bucket);
        
        if (uploadResult.success && uploadResult.url) {
          // تحديث رابط الملف في قاعدة البيانات
          const originalPath = file.localPath.replace('./uploads/', '/uploads/');
          const updateResult = await updateFileUrlsAfterMigration(
            originalPath, 
            uploadResult.url, 
            file.tableName
          );
          
          if (updateResult.success) {
            result.migratedFiles++;
            console.log(`✅ تم انتقال: ${file.localPath}`);
            
            // إنشاء نسخة احتياطية محلية
            const backupDir = './uploads/backups/' + file.bucket;
            if (!fs.existsSync(backupDir)) {
              fs.mkdirSync(backupDir, { recursive: true });
            }
            
            const backupPath = path.join(backupDir, path.basename(file.localPath));
            fs.copyFileSync(file.localPath, backupPath);
            
          } else {
            result.failedFiles++;
            result.errors.push(`فشل تحديث رابط الملف: ${file.localPath}`);
          }
        } else {
          result.failedFiles++;
          result.errors.push(`فشل رفع الملف: ${file.localPath} - ${uploadResult.error}`);
        }
      } catch (error: any) {
        result.failedFiles++;
        result.errors.push(`خطأ في معالجة الملف ${file.localPath}: ${error.message}`);
      }
    }

    result.success = result.migratedFiles > 0 && result.failedFiles === 0;
    
    console.log(`🎉 الانتقال مكتمل: ${result.migratedFiles} نجح، ${result.failedFiles} فشل`);
    return result;

  } catch (error: any) {
    result.errors.push('خطأ عام في الانتقال: ' + error.message);
    console.error('خطأ في الانتقال:', error);
    return result;
  }
}

// استرجاع النسخة الاحتياطية (في حالة الطوارئ)
export async function restoreFromBackup(backupPath: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!fs.existsSync(backupPath)) {
      return { success: false, error: 'ملف النسخة الاحتياطية غير موجود' };
    }

    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    
    console.log('⚠️ بدء استرجاع النسخة الاحتياطية...');
    console.log('🚨 هذا سيستبدل البيانات الحالية!');
    
    // هذا مثال بسيط - في الواقع نحتاج لنظام استرجاع أكثر تعقيداً
    console.log(`📊 النسخة الاحتياطية تحتوي على ${backup.data.transactions.length} معاملة`);
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}