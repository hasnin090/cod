import multer from "multer";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

// On Netlify Functions, only /tmp is writable. Use it as base when detected.
const isNetlify = !!process.env.NETLIFY || !!process.env.NETLIFY_LOCAL;
const baseWritableDir = isNetlify ? '/tmp' : '.';

// إعداد مشترك لـ multer
export const createMulterConfig = (destination: string = './uploads') => {
  // Resolve to writable base (handles Netlify)
  const resolvedDest = destination.startsWith('.') ? `${baseWritableDir}${destination.slice(1)}` : destination;
  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        if (!fs.existsSync(resolvedDest)) {
          fs.mkdirSync(resolvedDest, { recursive: true });
        }
        cb(null, resolvedDest);
      },
      filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}_${uuidv4()}_${file.originalname.replace(/\s+/g, '_')}`;
        cb(null, uniqueName);
      }
    }),
    limits: {
      fileSize: 20 * 1024 * 1024, // 20MB
    },
    fileFilter: (req, file, cb) => {
      cb(null, true);
    }
  });
};

// إعدادات محددة للمعاملات
export const transactionUpload = createMulterConfig('./uploads/transactions');

// إعدادات محددة للمستندات
export const documentUpload = createMulterConfig('./uploads');