import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// ضمان وجود مجلد التحميلات
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    console.log(`تم إنشاء مجلد التحميلات: ${UPLOADS_DIR}`);
  } catch (err: any) {
    console.error(`فشل في إنشاء مجلد التحميلات: ${err.message}`);
  }
}

// تم إلغاء استخدام Firebase واستبداله بنظام الملفات المحلي
console.log('جاري استخدام التخزين المحلي للملفات في مجلد uploads/');

/**
 * تحميل ملف إلى نظام الملفات المحلي
 * @param file الملف الذي سيتم تحميله (Buffer أو مسار)
 * @param destination مسار الوجهة في المجلد
 * @param contentType نوع محتوى الملف
 * @param metadata بيانات وصفية إضافية للملف
 * @returns وعد بعنوان URL الملف المحمل
 */
export const uploadFile = async (
  fileData: Buffer | string,
  destination: string,
  contentType?: string,
  metadata: Record<string, string> = {}
): Promise<string> => {
  try {
    // إعداد المسار المستهدف
    const fileName = destination.split('/').pop() || `file_${Date.now()}`;
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    
    // تحديد نوع المحتوى استناداً إلى امتداد الملف
    const extension = path.extname(fileName).toLowerCase();
    const detectedContentType = contentType || getContentTypeFromExtension(extension);
    
    // إضافة طابع زمني وهاش للتأكد من فريدية الملف
    const timestamp = Date.now();
    const randomHash = crypto.randomBytes(4).toString('hex');
    const uniqueFileName = `${path.parse(safeFileName).name}_${timestamp}_${randomHash}${extension}`;
    
    try {
      // تحضير Buffer إذا كان المدخل ملفاً
      let fileBuffer: Buffer;
      if (typeof fileData === 'string') {
        // التأكد من وجود الملف
        if (!fs.existsSync(fileData)) {
          throw new Error(`الملف غير موجود: ${fileData}`);
        }
        fileBuffer = fs.readFileSync(fileData);
      } else {
        fileBuffer = fileData;
      }
      
      // إنشاء مسار محلي للتخزين
      const uploadDirPath = path.join(UPLOADS_DIR, path.dirname(destination));
      if (!fs.existsSync(uploadDirPath)) {
        fs.mkdirSync(uploadDirPath, { recursive: true });
      }
      
      // حفظ الملف محلياً
      const localPath = path.join(UPLOADS_DIR, uniqueFileName);
      fs.writeFileSync(localPath, fileBuffer);
      console.log(`تم تخزين الملف محلياً في: ${localPath}`);
      
      // حفظ البيانات الوصفية في ملف متصل إذا كان هناك حاجة
      if (Object.keys(metadata).length > 0) {
        const metadataPath = `${localPath}.metadata.json`;
        const metadataContent = JSON.stringify({
          contentType: detectedContentType,
          metadata: {
            ...metadata,
            uploadTimestamp: timestamp.toString(),
            originalFileName: fileName
          }
        }, null, 2);
        fs.writeFileSync(metadataPath, metadataContent);
      }
      
      // إنشاء URL محلي
      return `/uploads/${uniqueFileName}`;
    } catch (localError: any) {
      console.error('خطأ في حفظ الملف محلياً:', localError);
      throw new Error(`فشل في حفظ الملف محلياً: ${localError.message}`);
    }
  } catch (error: any) {
    console.error('خطأ في عملية تحميل الملف:', error);
    throw new Error(`فشل في عملية تحميل الملف: ${error.message}`);
  }
};

/**
 * تحديد نوع المحتوى بناءً على امتداد الملف
 */
function getContentTypeFromExtension(extension: string): string {
  const contentTypeMap: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed',
    '.7z': 'application/x-7z-compressed',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.wmv': 'video/x-ms-wmv'
  };
  
  return contentTypeMap[extension] || 'application/octet-stream';
}

/**
 * حذف ملف من الملفات المحلية
 * @param fileUrl عنوان URL للملف المراد حذفه
 * @returns وعد يشير إلى اكتمال عملية الحذف
 */
export const deleteFile = async (fileUrl: string): Promise<boolean> => {
  if (!fileUrl) {
    console.warn('تم استدعاء deleteFile بدون عنوان URL للملف');
    return false;
  }
  
  try {
    // تنقية مسار الملف
    // تحويل المسار إلى تنسيق قياسي
    let sanitizedFileUrl = fileUrl;
    
    // التعامل فقط مع الملفات المحلية
    const isLocalPath = fileUrl.startsWith('./uploads/') || 
                        fileUrl.startsWith('/uploads/') || 
                        fileUrl.includes(UPLOADS_DIR);
    
    if (!isLocalPath) {
      console.log(`محاولة استخلاص اسم الملف من المسار: ${fileUrl}`);
      // محاولة استخراج اسم الملف واستخدامه فقط
      const fileName = path.basename(fileUrl);
      sanitizedFileUrl = path.join(UPLOADS_DIR, fileName);
      console.log(`تم استخلاص اسم الملف: ${fileName}, المسار الجديد: ${sanitizedFileUrl}`);
      fileUrl = sanitizedFileUrl;
    }
    
    try {
      // تحديد المسار الكامل للملف
      let fullPath = fileUrl;
      
      // إذا كان المسار نسبيًا، قم بتوسيعه
      if (fileUrl.startsWith('/uploads/')) {
        fullPath = path.join(process.cwd(), fileUrl);
      } else if (fileUrl.startsWith('./uploads/')) {
        fullPath = path.join(process.cwd(), fileUrl.substring(1));
      } else if (!fileUrl.includes(UPLOADS_DIR)) {
        // محاولة إضافة مجلد التحميلات كبادئة
        const fileName = fileUrl.split('/').pop();
        if (fileName) {
          fullPath = path.join(UPLOADS_DIR, fileName);
        }
      }
      
      // التحقق من وجود الملف قبل محاولة حذفه
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        console.log(`تم حذف الملف المحلي بنجاح: ${fullPath}`);
        
        // التحقق من وجود ملف البيانات الوصفية وحذفه أيضًا
        const metadataPath = `${fullPath}.metadata.json`;
        if (fs.existsSync(metadataPath)) {
          fs.unlinkSync(metadataPath);
          console.log(`تم حذف ملف البيانات الوصفية: ${metadataPath}`);
        }
        
        return true;
      } else {
        // محاولة البحث عن الملف في مجلد التحميلات مباشرة
        const uploadsFiles = fs.readdirSync(UPLOADS_DIR);
        // البحث عن الملف الذي ينتهي بنفس الاسم
        const fileName = fileUrl.split('/').pop();
        if (fileName) {
          const matchingFile = uploadsFiles.find(file => file.endsWith(fileName));
          if (matchingFile) {
            const matchingPath = path.join(UPLOADS_DIR, matchingFile);
            fs.unlinkSync(matchingPath);
            console.log(`تم حذف الملف المحلي بعد البحث: ${matchingPath}`);
            
            // التحقق من وجود ملف البيانات الوصفية وحذفه أيضًا
            const metadataPath = `${matchingPath}.metadata.json`;
            if (fs.existsSync(metadataPath)) {
              fs.unlinkSync(metadataPath);
              console.log(`تم حذف ملف البيانات الوصفية: ${metadataPath}`);
            }
            
            return true;
          }
        }
        
        console.warn(`الملف المحلي غير موجود: ${fullPath}`);
        return false;
      }
    } catch (localError: any) {
      console.error('خطأ في حذف الملف المحلي:', localError);
      throw new Error(`فشل في حذف الملف المحلي: ${localError.message}`);
    }
  } catch (error: any) {
    console.error('خطأ في حذف الملف:', error);
    throw new Error(`فشل في حذف الملف: ${error.message}`);
  }
};

/**
 * دالة مساعدة لفحص نوع الملف
 * @param fileType نوع الملف كسلسلة نصية
 * @returns نوع الملف بدون التفاصيل
 */
export const getFileType = (fileType: string): string => {
  // استخراج النوع الأساسي من سلسلة نوع الملف
  // مثال: 'image/jpeg' سترجع 'image'
  return fileType.split('/')[0] || 'unknown';
};

/**
 * دالة مساعدة لتحويل حجم الملف إلى تنسيق مقروء
 * @param sizeInBytes حجم الملف بالبايت
 * @returns حجم الملف بتنسيق مقروء (مثل KB, MB)
 */
export const getReadableFileSize = (sizeInBytes: number): string => {
  if (sizeInBytes < 1024) {
    return `${sizeInBytes} بايت`;
  } else if (sizeInBytes < 1024 * 1024) {
    return `${Math.round(sizeInBytes / 1024 * 10) / 10} كيلوبايت`;
  } else if (sizeInBytes < 1024 * 1024 * 1024) {
    return `${Math.round(sizeInBytes / (1024 * 1024) * 10) / 10} ميجابايت`;
  } else {
    return `${Math.round(sizeInBytes / (1024 * 1024 * 1024) * 10) / 10} جيجابايت`;
  }
};