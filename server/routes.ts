import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import { 
  loginSchema, 
  insertUserSchema, 
  insertProjectSchema, 
  insertTransactionSchema,
  insertDocumentSchema,
  insertActivityLogSchema,
  insertSettingSchema,
  insertAccountCategorySchema,
  insertDeferredPaymentSchema,
  funds,
  employees,
  type Transaction
} from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcryptjs";
import MemoryStore from "memorystore";
import connectPgSimple from "connect-pg-simple";
import { db } from "./db";
import { neon } from '@neondatabase/serverless';
import { storageManager } from './storage-manager';
import multer from "multer";
import * as fs from "fs";
import * as path from "path";

const sql = neon(process.env.DATABASE_URL!);

// إعداد multer لتحميل الملفات
const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    // قبول جميع أنواع الملفات
    cb(null, true);
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);

  // إعداد الجلسات
  const pgStore = connectPgSimple(session);
  
  // استخدام Memory Store إذا فشل اتصال قاعدة البيانات
  let sessionStore;
  try {
    sessionStore = new pgStore({
      conString: process.env.DATABASE_URL!,
      tableName: 'session',
      createTableIfMissing: true
    });
  } catch (error) {
    console.log('استخدام Memory Store المحسن للجلسات');
    const MemoryStoreConstructor = MemoryStore(session);
    sessionStore = new MemoryStoreConstructor({
      checkPeriod: 86400000 // 24 ساعة
    });
  }

  app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'fallback-secret-for-development',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 ساعة
    }
  }));

  // Middleware للمصادقة
  function requireAuth(req: Request, res: Response, next: NextFunction) {
    if (!req.session?.user) {
      return res.status(401).json({ message: "غير مصرح" });
    }
    next();
  }

  // تسجيل الدخول
  app.post("/api/login", async (req, res) => {
    try {
      const { username, password } = loginSchema.parse(req.body);
      
      const user = await storage.getUserByUsername(username);
      if (!user || !await bcrypt.compare(password, user.passwordHash)) {
        return res.status(401).json({ message: "معلومات تسجيل الدخول غير صحيحة" });
      }

      if (!user.active) {
        return res.status(401).json({ message: "الحساب غير نشط" });
      }

      req.session.user = {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions
      };

      res.json({
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions
      });
    } catch (error) {
      console.error('خطأ في تسجيل الدخول:', error);
      res.status(500).json({ message: "خطأ في الخادم" });
    }
  });

  // تسجيل الخروج
  app.post("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "خطأ في تسجيل الخروج" });
      }
      res.json({ message: "تم تسجيل الخروج بنجاح" });
    });
  });

  // الحصول على الجلسة الحالية
  app.get("/api/auth/session", (req, res) => {
    if (req.session?.user) {
      res.json(req.session.user);
    } else {
      res.status(401).json({ message: "غير مصرح" });
    }
  });

  // لوحة التحكم
  app.get("/api/dashboard", requireAuth, async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error('خطأ في لوحة التحكم:', error);
      res.status(500).json({ message: "خطأ في جلب البيانات" });
    }
  });

  // المعاملات
  app.get("/api/transactions", requireAuth, async (req, res) => {
    try {
      const transactions = await storage.getTransactions();
      res.json(transactions);
    } catch (error) {
      console.error('خطأ في جلب المعاملات:', error);
      res.status(500).json({ message: "خطأ في جلب المعاملات" });
    }
  });

  app.post("/api/transactions", requireAuth, upload.single('file'), async (req, res) => {
    try {
      const transactionData = insertTransactionSchema.parse(req.body);
      
      // إضافة معرف المستخدم
      const fullData = {
        ...transactionData,
        createdBy: req.session.user!.id
      };

      // معالجة الملف المرفق إن وجد
      if (req.file) {
        const fileName = `${Date.now()}-${req.file.originalname}`;
        const filePath = path.join('uploads', fileName);
        
        fs.renameSync(req.file.path, filePath);
        
        fullData.fileUrl = `/uploads/${fileName}`;
        fullData.fileType = req.file.mimetype;
        fullData.fileSize = req.file.size;
      }

      const transaction = await storage.createTransaction(fullData);
      res.json(transaction);
    } catch (error) {
      console.error('خطأ في إنشاء المعاملة:', error);
      res.status(500).json({ message: "خطأ في إنشاء المعاملة" });
    }
  });

  // المشاريع
  app.get("/api/projects", requireAuth, async (req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error) {
      console.error('خطأ في جلب المشاريع:', error);
      res.status(500).json({ message: "خطأ في جلب المشاريع" });
    }
  });

  app.post("/api/projects", requireAuth, async (req, res) => {
    try {
      const projectData = insertProjectSchema.parse(req.body);
      const fullData = {
        ...projectData,
        createdBy: req.session.user!.id
      };

      const project = await storage.createProject(fullData);
      res.json(project);
    } catch (error) {
      console.error('خطأ في إنشاء المشروع:', error);
      res.status(500).json({ message: "خطأ في إنشاء المشروع" });
    }
  });

  // المستخدمون
  app.get("/api/users", requireAuth, async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      console.error('خطأ في جلب المستخدمين:', error);
      res.status(500).json({ message: "خطأ في جلب المستخدمين" });
    }
  });

  // أنواع المصروفات
  app.get("/api/expense-types", requireAuth, async (req, res) => {
    try {
      const expenseTypes = await storage.getExpenseTypes();
      res.json(expenseTypes);
    } catch (error) {
      console.error('خطأ في جلب أنواع المصروفات:', error);
      res.status(500).json({ message: "خطأ في جلب أنواع المصروفات" });
    }
  });

  // الموظفون
  app.get("/api/employees", requireAuth, async (req, res) => {
    try {
      const employees = await storage.getEmployees();
      res.json(employees);
    } catch (error) {
      console.error('خطأ في جلب الموظفين:', error);
      res.status(500).json({ message: "خطأ في جلب الموظفين" });
    }
  });

  // الإعدادات
  app.get("/api/settings", requireAuth, async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error) {
      console.error('خطأ في جلب الإعدادات:', error);
      res.status(500).json({ message: "خطأ في جلب الإعدادات" });
    }
  });

  // فحص حالة قاعدة البيانات
  app.get("/api/database/status", async (req, res) => {
    try {
      const start = Date.now();
      await sql`SELECT 1`;
      const responseTime = Date.now() - start;
      
      res.json({
        connected: true,
        responseTime,
        timestamp: new Date().toISOString(),
        tablesAccessible: true
      });
    } catch (error) {
      console.error('خطأ في فحص قاعدة البيانات:', error);
      res.status(500).json({
        connected: false,
        error: 'فشل الاتصال بقاعدة البيانات',
        timestamp: new Date().toISOString()
      });
    }
  });

  // مشاريع المستخدم
  app.get("/api/user-projects", requireAuth, async (req, res) => {
    try {
      const userId = req.session.user!.id;
      const userRole = req.session.user!.role;
      
      let projects;
      if (userRole === 'admin' || userRole === 'manager') {
        projects = await storage.getProjects();
      } else {
        projects = await storage.getUserProjects(userId);
      }
      
      res.json(projects);
    } catch (error) {
      console.error('خطأ في جلب مشاريع المستخدم:', error);
      res.status(500).json({ message: "خطأ في جلب المشاريع" });
    }
  });

  // تقديم الملفات الثابتة
  app.use('/uploads', (req, res, next) => {
    const filePath = path.join(process.cwd(), 'uploads', req.path);
    
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ message: 'الملف غير موجود' });
    }
  });

  return httpServer;
}