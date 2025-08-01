import multer from "multer";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

// إعداد مشترك لـ multer
export const createMulterConfig = (destination: string = './uploads') => {
  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        if (!fs.existsSync(destination)) {
          fs.mkdirSync(destination, { recursive: true });
        }
        cb(null, destination);
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