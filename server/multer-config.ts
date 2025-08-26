import multer from "multer";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

// On Netlify Functions, only /tmp is writable. Use it as base when detected.
const isNetlify = !!process.env.NETLIFY || !!process.env.NETLIFY_LOCAL;
const baseWritableDir = isNetlify ? "/tmp" : process.cwd();

export const createMulterConfig = (destination: string = "uploads") => {
  // On Netlify, prefer memory storage to avoid read-only FS errors during multipart parsing
  if (isNetlify) {
    return multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
    });
  }

  const resolvedDest = path.isAbsolute(destination)
    ? destination
    : path.join(baseWritableDir, destination);

  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        if (!fs.existsSync(resolvedDest)) {
          fs.mkdirSync(resolvedDest, { recursive: true });
        }
        cb(null, resolvedDest);
      },
      filename: (_req, file, cb) => {
        const uniqueName = `${Date.now()}_${uuidv4()}_${file.originalname.replace(
          /\s+/g,
          "_",
        )}`;
        cb(null, uniqueName);
      },
    }),
    limits: {
      fileSize: 20 * 1024 * 1024, // 20MB
    },
    fileFilter: (_req, _file, cb) => {
      cb(null, true);
    },
  });
};

export const transactionUpload = createMulterConfig("uploads/transactions");
export const documentUpload = createMulterConfig("uploads/documents");
export const completedWorksUpload = createMulterConfig("uploads/completed-works");
export const completedWorksDocsUpload = createMulterConfig("uploads/completed-works-docs");