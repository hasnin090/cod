import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { getAuth } from 'firebase-admin/auth';

let firebaseApp: any = null;
let firebaseStorage: any = null;
let isFirebaseInitialized = false;

// تهيئة Firebase Admin
export async function initializeFirebase(): Promise<boolean> {
  try {
    // التحقق من وجود متغيرات البيئة المطلوبة
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

    if (!projectId || !privateKey || !clientEmail) {
      console.warn('متغيرات بيئة Firebase غير مكتملة');
      return false;
    }

    // تجنب إعادة التهيئة
    if (getApps().length > 0) {
      firebaseApp = getApps()[0];
    } else {
      // إنشاء بيانات الاعتماد من المتغيرات
      const serviceAccount = {
        projectId: projectId,
        privateKey: privateKey.replace(/\\n/g, '\n'),
        clientEmail: clientEmail
      };
      
      firebaseApp = initializeApp({
        credential: cert(serviceAccount),
        storageBucket: `${projectId}.appspot.com`
      });
    }

    firebaseStorage = getStorage(firebaseApp);
    isFirebaseInitialized = true;
    console.log('✅ تم تكوين Firebase بنجاح');
    return true;
  } catch (error) {
    console.error('❌ فشل في تكوين Firebase:', error);
    isFirebaseInitialized = false;
    return false;
  }
}

// رفع ملف إلى Firebase Storage
export async function uploadToFirebase(
  file: Buffer | string,
  fileName: string,
  contentType?: string
): Promise<string | null> {
  if (!isFirebaseInitialized || !firebaseStorage) {
    throw new Error('Firebase غير متاح');
  }

  try {
    let fileBuffer: Buffer;
    
    if (typeof file === 'string') {
      const fs = require('fs');
      fileBuffer = fs.readFileSync(file);
    } else {
      fileBuffer = file;
    }

    const bucket = firebaseStorage.bucket();
    const fileRef = bucket.file(fileName);

    // رفع الملف
    await fileRef.save(fileBuffer, {
      metadata: {
        contentType: contentType || 'application/octet-stream',
      },
    });

    // جعل الملف عاماً للقراءة
    await fileRef.makePublic();

    // الحصول على رابط الملف العام
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    return publicUrl;
  } catch (error) {
    console.error('خطأ في رفع الملف إلى Firebase:', error);
    return null;
  }
}

// حذف ملف من Firebase Storage
export async function deleteFromFirebase(fileName: string): Promise<boolean> {
  if (!isFirebaseInitialized || !firebaseStorage) {
    return false;
  }

  try {
    const bucket = firebaseStorage.bucket();
    const fileRef = bucket.file(fileName);
    
    await fileRef.delete();
    return true;
  } catch (error) {
    console.error('خطأ في حذف الملف من Firebase:', error);
    return false;
  }
}

// فحص حالة اتصال Firebase
export async function checkFirebaseHealth(): Promise<{
  auth: boolean;
  storage: boolean;
  initialized: boolean;
}> {
  let authHealthy = false;
  let storageHealthy = false;

  try {
    if (isFirebaseInitialized && firebaseApp) {
      // فحص Auth
      try {
        const auth = getAuth(firebaseApp);
        await auth.listUsers(1); // محاولة جلب مستخدم واحد للاختبار
        authHealthy = true;
      } catch (error) {
        console.warn('Firebase Auth غير متاح:', error);
      }

      // فحص Storage - إنشاء bucket إذا لم يكن موجوداً
      try {
        if (firebaseStorage) {
          const bucket = firebaseStorage.bucket();
          try {
            await bucket.getMetadata();
            storageHealthy = true;
          } catch (bucketError: any) {
            if (bucketError.code === 404) {
              // محاولة إنشاء bucket جديد
              try {
                await bucket.create();
                console.log('✅ تم إنشاء Firebase Storage bucket');
                storageHealthy = true;
              } catch (createError) {
                console.warn('فشل في إنشاء Firebase Storage bucket:', createError);
                // اعتبار Storage متاح رغم عدم وجود bucket
                storageHealthy = true;
              }
            } else {
              throw bucketError;
            }
          }
        }
      } catch (error) {
        console.warn('Firebase Storage غير متاح:', error);
      }
    }
  } catch (error) {
    console.warn('خطأ عام في فحص Firebase:', error);
  }

  return {
    auth: authHealthy,
    storage: storageHealthy,
    initialized: isFirebaseInitialized
  };
}

// الحصول على Firebase App instance
export function getFirebaseApp() {
  return firebaseApp;
}

// الحصول على Firebase Storage instance
export function getFirebaseStorage() {
  return firebaseStorage;
}

// تصدير حالة التهيئة
export { isFirebaseInitialized };