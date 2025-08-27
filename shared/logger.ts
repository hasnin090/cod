// نظام تسجيل الأحداث والأخطاء
export interface Logger {
  info: (message: string, meta?: any) => void;
  warn: (message: string, meta?: any) => void;
  error: (message: string, meta?: any) => void;
  debug: (message: string, meta?: any) => void;
  log: (message: string, meta?: any) => void;
}

// تنفيذ Logger باستخدام console
const consoleLogger: Logger = {
  info: (message, meta) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[INFO] ${new Date().toISOString()} - ${message}`, meta || '');
    }
  },
  warn: (message, meta) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, meta || '');
  },
  error: (message, meta) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, meta || '');
  },
  debug: (message, meta) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, meta || '');
    }
  },
  log: (message, meta) => {
    console.log(`[LOG] ${new Date().toISOString()} - ${message}`, meta || '');
  }
};

// Logger افتراضي
export const logger = consoleLogger;

// Logger للبيئة الإنتاجية
export const productionLogger: Logger = {
  info: (message, meta) => {
    // في الإنتاج، يمكن إرسال السجلات إلى خدمة خارجية مثل Sentry
    console.log(`[INFO] ${message}`, meta || '');
  },
  warn: (message, meta) => {
    console.warn(`[WARN] ${message}`, meta || '');
  },
  error: (message, meta) => {
    console.error(`[ERROR] ${message}`, meta || '');
    // في الإنتاج، يمكن إرسال الأخطاء إلى خدمة تتبع الأخطاء
  },
  debug: () => {}, // تعطيل التصحيح في الإنتاج
  log: (message, meta) => {
    console.log(`[LOG] ${message}`, meta || '');
  }
};

// اخت Logger بناءً على البيئة
export const getLogger = () => {
  return process.env.NODE_ENV === 'production' ? productionLogger : consoleLogger;
};
