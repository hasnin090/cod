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
import { eq, and } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// إنشاء متغير يحل محل __dirname مع ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// إعداد multer لمعالجة تحميل الملفات
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      // إنشاء مجلد التحميلات إذا لم يكن موجودًا
      const uploadDir = './uploads';
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      // إنشاء اسم فريد للملف
      const uniqueName = `${Date.now()}_${uuidv4()}_${file.originalname.replace(/\s+/g, '_')}`;
      cb(null, uniqueName);
    }
  }),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
  },
  fileFilter: (req, file, cb) => {
    // التحقق من نوع الملف (اختياري)
    cb(null, true);
  }
});

declare module "express-session" {
  interface SessionData {
    userId: number;
    username: string;
    role: string;
    lastActivity?: string;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  const MemoryStoreSession = MemoryStore(session);
  // تسجيل متغير PgStore من وحدة connect-pg-simple
  const PostgreSQLStore = connectPgSimple(session);
  
  // إعداد محسن للجلسات مع PostgreSQL Store للثبات
  let sessionStore;
  
  // استخدام Memory Store المحسن مع إعدادات متقدمة  
  sessionStore = new MemoryStoreSession({
    checkPeriod: 86400000, // فحص كل 24 ساعة
    max: 5000, // حد أقصى أعلى للجلسات
    ttl: 24 * 60 * 60 * 1000, // 24 ساعة
    dispose: (key: string, value: any) => {
      console.log(`تم حذف الجلسة: ${key}`);
    },
    stale: false // عدم إرجاع جلسات منتهية الصلاحية
  });
  console.log("استخدام Memory Store المحسن للجلسات");

  app.use(session({
    secret: process.env.SESSION_SECRET || "accounting-app-secret-key-2025",
    resave: false,
    saveUninitialized: false,
    cookie: { 
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/'
    },
    store: sessionStore,
    name: 'accounting.sid' // اسم مميز للجلسة
  }));
  
  // middleware للجلسة (تم إزالة التسجيل المفرط لتحسين الأداء)
  app.use((req, res, next) => {
    next();
  });

  // Authentication middleware with session timeout
  const authenticate = (req: Request, res: Response, next: Function) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: "غير مصرح" });
    }

    // تحديث آخر نشاط بدون فحص انتهاء الصلاحية
    req.session.lastActivity = new Date().toISOString();
    
    // إضافة معلومات المستخدم إلى الطلب
    (req as any).user = {
      id: req.session.userId,
      username: req.session.username,
      role: req.session.role
    };
    
    next();
  };

  // مسار لعرض الملفات المحفوظة محلياً مع دعم المجلدات الفرعية
  app.get("/uploads/*", (req: Request, res: Response) => {
    const filePath = req.params[0]; // الحصول على المسار الكامل
    const fullPath = path.join(__dirname, '../uploads', filePath);
    
    // التحقق من الأمان - منع الوصول خارج مجلد uploads
    const uploadsDir = path.resolve(__dirname, '../uploads');
    const requestedPath = path.resolve(fullPath);
    
    if (!requestedPath.startsWith(uploadsDir)) {
      return res.status(403).json({ message: "مسار غير مسموح" });
    }
    
    // التحقق من وجود الملف
    if (fs.existsSync(requestedPath)) {
      return res.sendFile(requestedPath);
    } else {
      return res.status(404).json({ message: "الملف غير موجود" });
    }
  });

  // Role-based authorization middleware
  const authorize = (roles: string[]) => {
    return (req: Request, res: Response, next: Function) => {
      if (!req.session.userId || !roles.includes(req.session.role as string)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      next();
    };
  };

  // Authentication routes
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const credentials = loginSchema.parse(req.body);
      const user = await storage.getUserByUsername(credentials.username);
      
      if (!user) {
        return res.status(401).json({ message: "معلومات تسجيل الدخول غير صحيحة" });
      }
      
      try {
        const isPasswordValid = await storage.validatePassword(user.password, credentials.password);
        console.log('Password validation result:', isPasswordValid);
        
        if (!isPasswordValid) {
          return res.status(401).json({ message: "معلومات تسجيل الدخول غير صحيحة" });
        }
        
        // Store user info in session
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.role = user.role;
        req.session.lastActivity = new Date().toISOString();
        // إضافة علامة للإشارة إلى تعديل الجلسة
        (req.session as any).modified = true;
        
        console.log('Session updated:', { 
          userId: req.session.userId, 
          username: req.session.username, 
          role: req.session.role 
        });
        
        // تخزين الجلسة بشكل صريح
        req.session.save((err) => {
          if (err) {
            console.error('Error saving session:', err);
          } else {
            console.log('Session saved successfully with ID:', req.sessionID);
          }
        });
        
        await storage.createActivityLog({
          action: "login",
          entityType: "user",
          entityId: user.id,
          details: "تسجيل دخول",
          userId: user.id
        });
        
        return res.status(200).json({
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          role: user.role,
          permissions: user.permissions
        });
      } catch (passwordError) {
        console.error('Password validation error:', passwordError);
        return res.status(500).json({ message: "خطأ في التحقق من كلمة المرور" });
      }
    } catch (error) {
      console.error('Login error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      return res.status(500).json({ message: "خطأ في تسجيل الدخول" });
    }
  });

  app.post("/api/auth/logout", authenticate, async (req: Request, res: Response) => {
    const userId = req.session.userId;
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "خطأ في تسجيل الخروج" });
      }
      
      if (userId) {
        storage.createActivityLog({
          action: "logout",
          entityType: "user",
          entityId: userId,
          details: "تسجيل خروج",
          userId: userId
        });
      }
      
      res.status(200).json({ message: "تم تسجيل الخروج بنجاح" });
    });
  });

  app.post("/api/auth/firebase-login", async (req: Request, res: Response) => {
    try {
      // التحقق من بيانات المستخدم القادمة من Firebase
      // في بيئة الإنتاج، يجب التحقق من token مع Firebase Admin SDK
      // لكن في هذا المثال البسيط، سنقبل المعلومات كما هي
      const { email, name } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "بريد إلكتروني غير صالح" });
      }
      
      // البحث عن المستخدم بواسطة البريد الإلكتروني
      let user = await storage.getUserByEmail(email);
      
      if (!user) {
        // إنشاء مستخدم جديد إذا لم يكن موجودًا بالفعل
        const username = email.split('@')[0]; // استخدام جزء من البريد الإلكتروني كاسم مستخدم
        
        // إنشاء مستخدم جديد
        // الحظ أن permissions غير متاح في نوع InsertUser ولكنه متاح في نوع User
        // لذلك نحتاج إلى تعديل كيفية إنشاء المستخدم
        user = await storage.createUser({
          username,
          password: '', // لا نحتاج إلى كلمة مرور مع مصادقة Firebase
          name: name || username,
          email,
          role: 'user',
          // نحذف permissions هنا
          active: true
        });
        
        await storage.createActivityLog({
          action: "register",
          entityType: "user",
          entityId: user.id,
          details: "تسجيل مستخدم جديد عبر Firebase",
          userId: user.id
        });
      }
      
      // حفظ معلومات المستخدم في الجلسة
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;
      // إضافة علامة للإشارة إلى تعديل الجلسة
      (req.session as any).modified = true;
      
      // تخزين الجلسة بشكل صريح
      req.session.save((err) => {
        if (err) {
          console.error('Error saving Firebase session:', err);
        } else {
          console.log('Firebase session saved successfully with ID:', req.sessionID);
        }
      });
      
      await storage.createActivityLog({
        action: "login",
        entityType: "user",
        entityId: user.id,
        details: "تسجيل دخول عبر Firebase",
        userId: user.id
      });
      
      return res.status(200).json({
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions
      });
    } catch (error) {
      console.error('Firebase login error:', error);
      return res.status(500).json({ message: "خطأ في تسجيل الدخول عبر Firebase" });
    }
  });

  app.get("/api/auth/session", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "غير مصرح" });
    }
    
    const user = await storage.getUser(req.session.userId);
    
    if (!user) {
      return res.status(401).json({ message: "غير مصرح" });
    }
    
    return res.status(200).json({
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: user.permissions
    });
  });

  // Users routes
  app.get("/api/users", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const users = await storage.listUsers();
      // Don't return password hashes
      const safeUsers = users.map(user => {
        const { password, ...safeUser } = user;
        return safeUser;
      });
      
      return res.status(200).json(safeUsers);
    } catch (error) {
      return res.status(500).json({ message: "خطأ في استرجاع المستخدمين" });
    }
  });

  app.post("/api/users", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      console.log("بدء إنشاء مستخدم جديد");
      const userData = insertUserSchema.parse(req.body);
      console.log("بيانات المستخدم بعد التحقق من المخطط:", userData);
      
      // Hash password
      userData.password = await bcrypt.hash(userData.password, 10);
      
      // استخراج معرف المشروع قبل إنشاء المستخدم إذا كان موجودًا
      const projectId = userData.projectId;
      delete userData.projectId; // إزالة الحقل غير المستخدم في إنشاء المستخدم
      
      // تأكد من أن مصفوفة الصلاحيات معرّفة
      if (!userData.permissions) {
        userData.permissions = [];
      }
      
      console.log("بيانات المستخدم قبل الإدخال في قاعدة البيانات:", {
        ...userData,
        password: "***مخفية***"
      });
      
      try {
        const user = await storage.createUser(userData);
        console.log("تم إنشاء المستخدم بنجاح:", { id: user.id, username: user.username });
        
        // إذا تم تحديد مشروع، يتم تخصيصه للمستخدم
        if (projectId) {
          try {
            await storage.assignUserToProject({
              userId: user.id,
              projectId: projectId,
              assignedBy: req.session.userId as number
            });
            
            await storage.createActivityLog({
              action: "update",
              entityType: "user_project",
              entityId: user.id,
              details: `تخصيص المستخدم ${user.name} للمشروع رقم ${projectId}`,
              userId: req.session.userId as number
            });
          } catch (err) {
            console.error("خطأ في تخصيص المشروع للمستخدم:", err);
            // استمر بدون توقف عند حدوث خطأ في تخصيص المشروع
          }
        }
        
        await storage.createActivityLog({
          action: "create",
          entityType: "user",
          entityId: user.id,
          details: `إضافة مستخدم جديد: ${user.name}`,
          userId: req.session.userId as number
        });
        
        const { password, ...safeUser } = user;
        return res.status(201).json(safeUser);
      } catch (dbError) {
        console.error("خطأ في قاعدة البيانات عند إنشاء المستخدم:", dbError);
        throw dbError;
      }
    } catch (error) {
      console.error("خطأ كامل عند إنشاء المستخدم:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      return res.status(500).json({ message: "خطأ في إنشاء المستخدم" });
    }
  });

  app.put("/api/users/:id", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const userData = req.body;
      
      // التحقق مما إذا كان المستخدم المراد تعديله هو المدير الرئيسي (معرف = 1)
      if (id === 1) {
        // اسمح فقط بتغيير اسم المستخدم أو كلمة المرور أو البريد الإلكتروني، ولكن ليس الدور أو الصلاحيات
        if (userData.role) {
          console.log("محاولة تغيير دور المدير الرئيسي - تم رفضها");
          return res.status(400).json({ message: "لا يمكن تغيير دور المدير الرئيسي للنظام" });
        }
        // إذا كان هناك محاولة لتعديل الصلاحيات، امنعها
        if (userData.permissions) {
          console.log("محاولة تغيير صلاحيات المدير الرئيسي - تم رفضها");
          return res.status(400).json({ message: "لا يمكن تغيير صلاحيات المدير الرئيسي للنظام" });
        }
        // إذا كان هناك محاولة لإلغاء تفعيل حساب المدير، امنعها
        if (userData.active === false) {
          console.log("محاولة إلغاء تفعيل حساب المدير الرئيسي - تم رفضها");
          return res.status(400).json({ message: "لا يمكن إلغاء تفعيل حساب المدير الرئيسي" });
        }
        
        console.log("محاولة تحديث بيانات المدير الرئيسي - السماح فقط بتغيير الاسم وكلمة المرور والبريد الإلكتروني");
      }
      
      // استخراج معرف المشروع قبل تحديث المستخدم إذا كان موجودًا
      const projectId = userData.projectId;
      delete userData.projectId; // إزالة الحقل غير المستخدم في تحديث المستخدم
      
      if (userData.password) {
        userData.password = await bcrypt.hash(userData.password, 10);
      }
      
      const updatedUser = await storage.updateUser(id, userData);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "المستخدم غير موجود" });
      }
      
      // إدارة تخصيص المشروع إذا تم تحديده
      if (projectId !== undefined) {
        try {
          // أولاً، نزيل أي علاقات موجودة للمستخدم مع المشاريع الأخرى
          // يمكن تغيير هذا السلوك لاحقًا إذا كان المستخدم يمكن أن ينتمي إلى عدة مشاريع
          
          // إذا كان معرف المشروع قيمة صالحة (ليس صفر أو null)، قم بتخصيص المشروع
          if (projectId) {
            // تحقق إذا كان المستخدم مخصص بالفعل لهذا المشروع
            const hasAccess = await storage.checkUserProjectAccess(id, projectId);
            
            if (!hasAccess) {
              // إذا لم يكن المستخدم مخصصًا بالفعل لهذا المشروع، قم بتخصيصه
              await storage.assignUserToProject({
                userId: id,
                projectId: projectId,
                assignedBy: req.session.userId as number
              });
              
              await storage.createActivityLog({
                action: "update",
                entityType: "user_project",
                entityId: id,
                details: `تخصيص المستخدم ${updatedUser.name} للمشروع رقم ${projectId}`,
                userId: req.session.userId as number
              });
            }
          } else {
            // إذا كان المستخدم يجب أن لا ينتمي إلى أي مشروع، فقم بإزالة جميع العلاقات
            // ملاحظة: يمكن تنفيذ ذلك لاحقًا إذا لزم الأمر
          }
        } catch (err) {
          console.error("خطأ في تخصيص المشروع للمستخدم:", err);
          // استمر بدون توقف عند حدوث خطأ في تخصيص المشروع
        }
      }
      
      await storage.createActivityLog({
        action: "update",
        entityType: "user",
        entityId: id,
        details: `تحديث بيانات المستخدم: ${updatedUser.name}`,
        userId: req.session.userId as number
      });
      
      const { password, ...safeUser } = updatedUser;
      return res.status(200).json(safeUser);
    } catch (error) {
      return res.status(500).json({ message: "خطأ في تحديث المستخدم" });
    }
  });

  app.delete("/api/users/:id", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // التحقق من عدم محاولة حذف المستخدم الحالي
      if (id === req.session.userId) {
        return res.status(400).json({ message: "لا يمكن حذف المستخدم الحالي" });
      }
      
      // التحقق من وجود المستخدم
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "المستخدم غير موجود" });
      }
      
      // لا يمكن حذف المستخدم الرئيسي (الأدمن الأساسي)
      if (id === 1) {
        return res.status(400).json({ message: "لا يمكن حذف المستخدم الرئيسي للنظام" });
      }
      
      try {
        // تنفيذ عملية الحذف
        const result = await storage.deleteUser(id);
        
        if (result) {
          await storage.createActivityLog({
            action: "delete",
            entityType: "user",
            entityId: id,
            details: `حذف المستخدم: ${user.name}`,
            userId: req.session.userId as number
          });
        }
        
        return res.status(200).json({ success: result });
      } catch (err) {
        console.error("خطأ في حذف المستخدم:", err);
        return res.status(500).json({ message: "حدث خطأ أثناء معالجة حذف المستخدم" });
      }
    } catch (error) {
      console.error("خطأ عام في حذف المستخدم:", error);
      return res.status(500).json({ message: "خطأ في حذف المستخدم" });
    }
  });

  // Projects routes
  app.get("/api/projects", authenticate, async (req: Request, res: Response) => {
    try {
      // اقتراب مختلف بناءً على دور المستخدم
      const userId = req.session.userId as number;
      const userRole = req.session.role as string;
      
      // المدير يمكنه رؤية جميع المشاريع
      if (userRole === "admin") {
        const projects = await storage.listProjects();
        return res.status(200).json(projects);
      } else {
        // المستخدم العادي يرى فقط المشاريع المخصصة له
        const projects = await storage.getUserProjects(userId);
        return res.status(200).json(projects);
      }
    } catch (error) {
      console.error("خطأ في استرجاع المشاريع:", error);
      return res.status(500).json({ message: "خطأ في استرجاع المشاريع" });
    }
  });
  
  // إضافة نقطة نهاية جديدة للحصول على المشاريع المخصصة للمستخدم
  app.get("/api/user-projects", authenticate, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId as number;
      const projects = await storage.getUserProjects(userId);
      return res.status(200).json(projects);
    } catch (error) {
      console.error("خطأ في استرجاع مشاريع المستخدم:", error);
      return res.status(500).json({ message: "خطأ في استرجاع مشاريع المستخدم" });
    }
  });

  app.post("/api/projects", authenticate, async (req: Request, res: Response) => {
    try {
      console.log("Project creation request:", req.body);

      if (!req.body.name || !req.body.description) {
        return res.status(400).json({ message: "البيانات المطلوبة غير مكتملة - الاسم والوصف مطلوبان" });
      }
      
      const projectData = insertProjectSchema.parse(req.body);
      projectData.createdBy = req.session.userId as number;
      
      console.log("Parsed project data:", projectData);
      
      const project = await storage.createProject(projectData);
      console.log("Created project:", project); // إضافة سجل للمشروع المنشأ
      
      await storage.createActivityLog({
        action: "create",
        entityType: "project",
        entityId: project.id,
        details: `إضافة مشروع جديد: ${project.name}`,
        userId: req.session.userId as number
      });
      
      // التأكد من أن كل البيانات موجودة في الاستجابة
      if (!project.name) {
        console.error("Warning: Project name is missing in the created project");
      }
      
      return res.status(201).json(project);
    } catch (error) {
      console.error("Project creation error:", error);
      if (error instanceof z.ZodError) {
        console.error("Validation error details:", error.errors);
        return res.status(400).json({ message: error.errors[0].message });
      }
      return res.status(500).json({ message: "خطأ في إنشاء المشروع" });
    }
  });

  app.put("/api/projects/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const projectData = req.body;
      
      const project = await storage.getProject(id);
      if (!project) {
        return res.status(404).json({ message: "المشروع غير موجود" });
      }
      
      // Only project creator or admin can update
      if (project.createdBy !== req.session.userId && req.session.role !== "admin") {
        return res.status(403).json({ message: "غير مصرح لك بتحديث هذا المشروع" });
      }
      
      const updatedProject = await storage.updateProject(id, projectData);
      
      if (updatedProject) {
        await storage.createActivityLog({
          action: "update",
          entityType: "project",
          entityId: id,
          details: `تحديث مشروع: ${updatedProject.name}`,
          userId: req.session.userId as number
        });
      }
      
      return res.status(200).json(updatedProject);
    } catch (error) {
      return res.status(500).json({ message: "خطأ في تحديث المشروع" });
    }
  });

  app.delete("/api/projects/:id", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const forceDelete = req.query.force === 'true';
      
      console.log(`محاولة حذف المشروع رقم: ${id} بواسطة المستخدم: ${req.session.userId}, الدور: ${req.session.role}, حذف قسري: ${forceDelete}`);
      
      const project = await storage.getProject(id);
      if (!project) {
        return res.status(404).json({ message: "المشروع غير موجود" });
      }
      
      // التحقق مما إذا كان المشروع مرتبط بأي معاملات مالية
      const projectTransactions = await storage.getTransactionsByProject(id);
      if (projectTransactions.length > 0 && !forceDelete) {
        return res.status(400).json({ 
          message: "لا يمكن حذف المشروع لأنه يحتوي على معاملات مالية مرتبطة به",
          transactionsCount: projectTransactions.length,
          canForceDelete: true
        });
      }
      
      // إذا كان حذف قسري، قم بحذف المعاملات أولاً
      if (forceDelete && projectTransactions.length > 0) {
        console.log(`حذف قسري: سيتم حذف ${projectTransactions.length} معاملة مالية`);
        for (const transaction of projectTransactions) {
          await storage.deleteTransaction(transaction.id);
        }
      }
      
      // التحقق مما إذا كان المشروع مرتبط بصندوق
      const projectFund = await storage.getFundByProject(id);
      if (projectFund) {
        try {
          // حذف الصندوق المرتبط بالمشروع
          console.log(`محاولة حذف الصندوق المرتبط بالمشروع: ${projectFund.id}`);
          
          const [deletedFund] = await db.delete(funds)
            .where(eq(funds.id, projectFund.id))
            .returning();
          
          console.log(`تم حذف الصندوق المرتبط بالمشروع: ${JSON.stringify(deletedFund)}`);
        } catch (error) {
          console.error("خطأ أثناء حذف الصندوق المرتبط بالمشروع:", error);
          return res.status(400).json({ 
            message: "لا يمكن حذف الصندوق المرتبط بالمشروع. يرجى التحقق من أنه لا توجد معاملات مرتبطة به",
            fundId: projectFund.id,
            error: error instanceof Error ? error.message : "خطأ غير معروف"
          });
        }
      }
      
      // حذف أي مستندات مرتبطة بالمشروع
      const projectDocuments = await storage.getDocumentsByProject(id);
      for (const document of projectDocuments) {
        await storage.deleteDocument(document.id);
      }
      
      // إزالة أي مستخدمين مرتبطين بالمشروع
      const projectUsers = await storage.getProjectUsers(id);
      for (const user of projectUsers) {
        await storage.removeUserFromProject(user.id, id);
      }
      
      // بعد التحقق من عدم وجود أي عناصر مرتبطة، يمكننا حذف المشروع
      const result = await storage.deleteProject(id);
      
      if (result) {
        await storage.createActivityLog({
          action: "delete",
          entityType: "project",
          entityId: id,
          details: `حذف مشروع: ${project.name}`,
          userId: req.session.userId as number
        });
        
        return res.status(200).json({ success: true, message: "تم حذف المشروع بنجاح" });
      } else {
        return res.status(500).json({ message: "فشل في حذف المشروع لسبب غير معروف" });
      }
    } catch (error) {
      console.error("خطأ في حذف المشروع:", error);
      return res.status(500).json({ 
        message: "خطأ في حذف المشروع", 
        error: error instanceof Error ? error.message : "خطأ غير معروف" 
      });
    }
  });

  // Transactions routes
  app.get("/api/transactions", authenticate, async (req: Request, res: Response) => {
    try {
      let transactions = await storage.listTransactions();
      const userId = req.session.userId as number;
      const userRole = req.session.role as string;
      const withAttachments = req.query.withAttachments === 'true';
      
      // المدير يمكنه رؤية جميع المعاملات، المستخدم العادي يرى فقط معاملات المشاريع التي لديه وصول إليها
      if (userRole !== "admin") {
        // احصل على قائمة المشاريع المسموح للمستخدم بالوصول إليها
        const userProjects = await storage.getUserProjects(userId);
        const projectIds = userProjects.map(project => project.id);
        
        // فلترة المعاملات بحيث تظهر فقط معاملات المشاريع التي يملك المستخدم وصولاً إليها
        if (projectIds.length > 0) {
          transactions = transactions.filter(t => {
            const hasProjectId = t.projectId !== null && t.projectId !== undefined;
            const isAuthorized = hasProjectId && projectIds.includes(t.projectId);
            return isAuthorized;
          });
        } else {
          // إذا لم يكن للمستخدم مشاريع، لا يرى أي معاملات
          transactions = [];
        }
      }
      
      // Filter by project if specified
      const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;
      if (projectId) {
        // إذا كان المستخدم غير مدير، تحقق من وصوله للمشروع
        if (userRole !== "admin") {
          const hasAccess = await storage.checkUserProjectAccess(userId, projectId);
          if (!hasAccess) {
            return res.status(403).json({ message: "غير مصرح لك بالوصول إلى هذا المشروع" });
          }
        }
        transactions = transactions.filter(t => t.projectId === projectId);
      }
      
      // Filter by type if specified
      const type = req.query.type as string | undefined;
      if (type) {
        transactions = transactions.filter(t => t.type === type);
      }
      
      // فلترة حسب وجود مرفقات
      if (withAttachments) {
        transactions = transactions.filter(t => t.fileUrl && t.fileUrl.trim() !== '');
      }
      
      // إخفاء معلومات المرفقات للمستخدمين غير المصرح لهم
      if (userRole !== "admin") {
        transactions = transactions.map(transaction => {
          // إذا كان المستخدم ليس منشئ المعاملة، أخف معلومات المرفق
          if (transaction.createdBy !== userId) {
            return {
              ...transaction,
              fileUrl: null,
              fileType: null
            };
          }
          return transaction;
        });
      }
      
      return res.status(200).json(transactions);
    } catch (error) {
      console.error("خطأ في استرجاع المعاملات:", error);
      return res.status(500).json({ message: "خطأ في استرجاع المعاملات" });
    }
  });

  // إضافة middleware لمعالجة الملفات المرفقة للمعاملات
  app.post("/api/transactions", authenticate, upload.single('file'), async (req: Request, res: Response) => {
    try {
      console.log("Transaction creation request:", req.body);
      console.log("File attachment:", req.file);

      if (!req.body.date || !req.body.amount || !req.body.type || !req.body.description) {
        // إزالة الملف المؤقت إذا وجد
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({ message: "جميع الحقول مطلوبة" });
      }

      // تحويل قيمة المشروع من none إلى undefined
      if (req.body.projectId === "none" || req.body.projectId === "") {
        req.body.projectId = undefined;
      }
      
      const userId = req.session.userId as number;
      const userRole = req.session.role as string;
      const amount = Number(req.body.amount);
      const type = req.body.type as string;
      const expenseType = req.body.expenseType as string || "مصروف عام";
      const description = req.body.description as string;
      const projectId = req.body.projectId ? Number(req.body.projectId) : undefined;
      const employeeId = req.body.employeeId ? Number(req.body.employeeId) : undefined;
      
      // التحقق من صلاحيات المستخدم
      // 1. إذا لم يتم تحديد مشروع، فقط المدير يمكنه إنشاء معاملات عامة
      if (!projectId && userRole !== "admin") {
        return res.status(403).json({ 
          message: "غير مصرح للمستخدم العادي بإنشاء معاملات بدون تحديد مشروع"
        });
      }
      
      // 2. إذا تم تحديد مشروع وكان المستخدم غير مدير، يجب التحقق من وصوله للمشروع
      if (projectId && userRole !== "admin") {
        try {
          const hasAccess = await storage.checkUserProjectAccess(userId, projectId);
          if (!hasAccess) {
            console.log(`المستخدم ${userId} ليس لديه صلاحية للوصول للمشروع ${projectId}`);
            return res.status(403).json({ 
              message: "غير مصرح لك بإنشاء معاملات لهذا المشروع"
            });
          }
          console.log(`المستخدم ${userId} لديه صلاحية للوصول للمشروع ${projectId}`);
        } catch (error) {
          console.error("خطأ في التحقق من صلاحية الوصول للمشروع:", error);
          return res.status(500).json({ 
            message: "خطأ في التحقق من صلاحية الوصول للمشروع"
          });
        }
      }

      // التحقق من صحة معاملة الراتب
      if (expenseType === "راتب" && employeeId) {
        // التحقق من وجود الموظف
        const sql = neon(process.env.DATABASE_URL!);
        const employeeResult = await sql(`SELECT * FROM employees WHERE id = $1 AND active = true`, [employeeId]);
        
        if (employeeResult.length === 0) {
          if (req.file) {
            fs.unlinkSync(req.file.path);
          }
          return res.status(400).json({ message: "الموظف غير موجود أو غير نشط" });
        }

        const employee = employeeResult[0];
        
        // التحقق من صلاحية المستخدم لدفع راتب هذا الموظف
        if (userRole !== 'admin') {
          // المستخدم العادي يمكنه دفع رواتب الموظفين المخصصين لنفس مشروعه فقط
          if (employee.assigned_project_id !== projectId) {
            if (req.file) {
              fs.unlinkSync(req.file.path);
            }
            return res.status(403).json({ 
              message: "يمكنك دفع رواتب الموظفين المخصصين لمشروعك فقط" 
            });
          }
        }
        
        console.log(`دفع راتب للموظف ${employee.name} (معرف: ${employeeId}) من المشروع ${projectId} بواسطة المستخدم ${userId}`);
      }
      
      let result: any;
      
      // معالجة العملية حسب نوعها ووجود مشروع ودور المستخدم
      if (userRole === 'admin') {
        // المدير له حق إجراء معاملات على الصندوق الرئيسي أو المشاريع
        if (type === "income") {
          // عندما يكون النوع "income" - إيراد
          if (projectId) {
            // إذا تم تحديد مشروع مع نوع إيراد، يجب أن يعتبر كمصروف من صندوق المدير
            result = await storage.processDeposit(userId, projectId, amount, description);
          } else {
            // عملية إيراد للصندوق الرئيسي
            result = await storage.processAdminTransaction(userId, type, amount, description);
          }
        } else if (type === "expense") {
          // عمليات مصروفات للمدير يمكن أن تكون على الصندوق الرئيسي أو المشاريع
          if (projectId) {
            // عملية صرف من المشروع
            result = await storage.processWithdrawal(userId, projectId, amount, description, expenseType);
          } else {
            // عملية صرف من الصندوق الرئيسي
            result = await storage.processAdminTransaction(userId, type, amount, description);
          }
        }
      } else {
        // المستخدم العادي لا يمكنه إجراء معاملات إلا على المشاريع المخصصة له
        if (!projectId) {
          return res.status(400).json({ message: "يجب تحديد مشروع للعملية" });
        }
        
        if (type === "income") {
          // عملية إيداع في المشروع (تستقطع من حساب المدير)
          // هذه العملية تعني أن المستخدم يقوم بتحويل مبلغ من صندوق المدير إلى صندوق المشروع
          result = await storage.processDeposit(userId, projectId, amount, description);
        } else if (type === "expense") {
          // عملية صرف من المشروع مع نوع المصروف
          result = await storage.processWithdrawal(userId, projectId, amount, description, expenseType);
        }
      }
      
      // إذا لم تتم معالجة العملية بأي من الطرق السابقة
      if (!result || !result.transaction) {
        // إذا كان هناك ملف مرفق، نقوم بحذفه
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({ message: "خطأ في معالجة العملية" });
      }

      // حفظ معرف الموظف إذا كانت معاملة راتب (حتى بدون ملف مرفق)
      if (expenseType === "راتب" && employeeId) {
        await storage.updateTransaction(result.transaction.id, { employeeId });
        result.transaction.employeeId = employeeId;
      }
      
      // معالجة الملف المرفق - نظام محلي موثوق مع تحسين المسارات
      if (req.file) {
        try {
          // نسخ الملف إلى مجلد منظم
          const targetDir = path.join('./uploads/transactions', result.transaction.id.toString());
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }
          
          const finalFileName = `${Date.now()}_${req.file.filename}`;
          const finalPath = path.join(targetDir, finalFileName);
          
          // نسخ الملف
          fs.copyFileSync(req.file.path, finalPath);
          
          // حذف الملف المؤقت
          fs.unlinkSync(req.file.path);
          
          // بناء URL الملف
          const fileUrl = `/uploads/transactions/${result.transaction.id}/${finalFileName}`;
          
          // تحديث المعاملة بعنوان URL للملف المرفق
          const updateData: any = { 
            fileUrl,
            fileType: req.file.mimetype
          };
          
          // إضافة معرف الموظف إذا كانت معاملة راتب
          if (expenseType === "راتب" && employeeId) {
            updateData.employeeId = employeeId;
          }
          
          await storage.updateTransaction(result.transaction.id, updateData);
          
          // تحديث كائن النتيجة بمعلومات الملف
          result.transaction.fileUrl = fileUrl;
          result.transaction.fileType = req.file.mimetype;
          
          console.log(`✅ تم حفظ الملف محلياً: ${fileUrl}`);
          
        } catch (fileError) {
          console.error("خطأ أثناء معالجة الملف المرفق:", fileError);
          // حذف الملف المؤقت في حالة الخطأ
          if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
        }
      }

      // تصنيف المعاملة تلقائياً في دفتر الأستاذ إذا كان لها نوع مصروف محدد
      console.log(`تحقق من التصنيف التلقائي: نوع المصروف = "${result.transaction?.expenseType}"`);
      if (result.transaction && result.transaction.expenseType && result.transaction.expenseType !== 'مصروف عام') {
        try {
          console.log(`بدء التصنيف التلقائي للمعاملة ${result.transaction.id} مع نوع المصروف: ${result.transaction.expenseType}`);
          await storage.classifyExpenseTransaction(result.transaction, false);
          console.log(`✅ تم تصنيف المعاملة ${result.transaction.id} تلقائياً في دفتر الأستاذ`);
        } catch (classifyError) {
          console.error('❌ خطأ في التصنيف التلقائي:', classifyError);
          // لا نوقف العملية إذا فشل التصنيف
        }
      } else {
        console.log(`❌ لم يتم التصنيف التلقائي: نوع المصروف غير مناسب أو مفقود`);
      }
      
      return res.status(201).json(result.transaction);
    } catch (error: any) {
      console.error("Transaction creation error:", error);
      if (error instanceof z.ZodError) {
        console.error("Validation error details:", error.errors);
        return res.status(400).json({ message: error.errors[0].message });
      }
      // إعادة رسالة الخطأ من الاستثناء إذا كانت متوفرة
      return res.status(500).json({ message: error.message || "خطأ في إنشاء المعاملة" });
    }
  });

  app.put("/api/transactions/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // التحقق من صحة البيانات المستلمة باستخدام Zod
      const transactionSchema = z.object({
        date: z.string().or(z.date()),
        type: z.enum(["income", "expense"]),
        expenseType: z.string().optional(),
        amount: z.number().positive(),
        description: z.string(),
        projectId: z.number().nullable().optional(),
      });
      
      // التحقق من البيانات وإرجاع أي أخطاء
      let transactionData;
      try {
        transactionData = transactionSchema.parse(req.body);
        console.log("البيانات المدخلة للتحديث:", transactionData);
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          return res.status(400).json({ 
            message: "بيانات غير صحيحة", 
            errors: validationError.errors.map(e => e.message)
          });
        }
        throw validationError;
      }
      
      const transaction = await storage.getTransaction(id);
      if (!transaction) {
        return res.status(404).json({ message: "المعاملة غير موجودة" });
      }
      
      // Only transaction creator or admin can update
      if (transaction.createdBy !== req.session.userId && req.session.role !== "admin") {
        return res.status(403).json({ message: "غير مصرح لك بتحديث هذه المعاملة" });
      }
      
      // تنسيق البيانات (التأكد من أن projectId هو null أو رقم وليس undefined)
      // تحويل البيانات إلى الصيغة المناسبة
      const formattedData = {
        date: new Date(transactionData.date.toString()),
        type: transactionData.type,
        expenseType: transactionData.expenseType,
        amount: transactionData.amount,
        description: transactionData.description,
        projectId: transactionData.projectId === undefined ? null : transactionData.projectId
      };
      
      const updatedTransaction = await storage.updateTransaction(id, formattedData);
      
      if (updatedTransaction) {
        // تصنيف المعاملة تلقائياً في دفتر الأستاذ
        try {
          await storage.classifyExpenseTransaction(updatedTransaction, true);
          console.log(`تم تحديث تصنيف المعاملة ${updatedTransaction.id} في دفتر الأستاذ`);
        } catch (ledgerError) {
          console.error("خطأ في تحديث تصنيف المعاملة في دفتر الأستاذ:", ledgerError);
          // لا نرمي خطأ هنا لأن تحديث المعاملة نجح
        }
        
        await storage.createActivityLog({
          action: "update",
          entityType: "transaction",
          entityId: id,
          details: `تحديث معاملة: ${updatedTransaction.description}`,
          userId: req.session.userId as number
        });
      }
      
      return res.status(200).json(updatedTransaction);
    } catch (error) {
      console.error("خطأ في تحديث المعاملة:", error);
      return res.status(500).json({ message: "خطأ في تحديث المعاملة" });
    }
  });

  app.delete("/api/transactions/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      const transaction = await storage.getTransaction(id);
      if (!transaction) {
        return res.status(404).json({ message: "المعاملة غير موجودة" });
      }
      
      // Only transaction creator or admin can delete
      if (transaction.createdBy !== req.session.userId && req.session.role !== "admin") {
        return res.status(403).json({ message: "غير مصرح لك بحذف هذه المعاملة" });
      }
      
      // فحص إذا كانت هذه المعاملة مرتبطة بدفعة مستحق
      let relatedReceivableId = null;
      if (transaction.description) {
        // البحث عن أنماط دفعات المستحقات
        const patterns = [
          /دفع قسط للمستفيد: (.+?)$/,
          /دفع قسط من: .+? \((.+?)\)/,
          /دفعة مستحق: (.+?) -/
        ];
        
        for (const pattern of patterns) {
          const match = transaction.description.match(pattern);
          if (match) {
            const beneficiaryName = match[1];
            console.log(`Found deferred payment transaction for beneficiary: ${beneficiaryName}`);
            
            // البحث عن المستحق المرتبط
            const allReceivables = await storage.listDeferredPayments();
            const relatedReceivable = allReceivables.find(r => r.beneficiaryName === beneficiaryName);
            if (relatedReceivable) {
              relatedReceivableId = relatedReceivable.id;
              console.log(`Found related receivable ID: ${relatedReceivableId}`);
              break;
            }
          }
        }
      }
      
      const result = await storage.deleteTransaction(id);
      
      if (result) {
        // إذا كانت المعاملة مرتبطة بدفعة مستحق، نحديث بيانات المستحق
        if (relatedReceivableId && transaction.amount) {
          try {
            const receivable = await storage.getDeferredPayment(relatedReceivableId);
            if (receivable) {
              const newPaidAmount = Math.max(0, (receivable.paidAmount || 0) - transaction.amount);
              const newRemainingAmount = (receivable.totalAmount || 0) - newPaidAmount;
              const newStatus = newRemainingAmount <= 0 ? 'completed' : newPaidAmount > 0 ? 'partial' : 'pending';
              
              await storage.updateDeferredPayment(relatedReceivableId, {
                paidAmount: newPaidAmount,
                remainingAmount: newRemainingAmount,
                status: newStatus
              });
              
              console.log(`Updated receivable ${relatedReceivableId}: paid=${newPaidAmount}, remaining=${newRemainingAmount}, status=${newStatus}`);
            }
          } catch (updateError) {
            console.error('Error updating receivable after transaction deletion:', updateError);
          }
        }
        
        await storage.createActivityLog({
          action: "delete",
          entityType: "transaction",
          entityId: id,
          details: `حذف معاملة: ${transaction.description}`,
          userId: req.session.userId as number
        });
      }
      
      return res.status(200).json({ success: result });
    } catch (error) {
      console.error('Error deleting transaction:', error);
      return res.status(500).json({ message: "خطأ في حذف المعاملة" });
    }
  });

  // نقطة النهاية لإعادة رفع مرفق للمعاملة
  app.post("/api/transactions/:id/reupload-attachment", authenticate, upload.single('file'), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // التحقق من وجود المعاملة
      const transaction = await storage.getTransaction(id);
      if (!transaction) {
        // حذف الملف المؤقت إذا وجد
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(404).json({ message: "المعاملة غير موجودة" });
      }
      
      // التحقق من صلاحيات المستخدم لتعديل المعاملة
      const userId = req.session.userId as number;
      const userRole = req.session.role as string;
      
      // فقط المدير أو المسؤول يمكنه إعادة رفع المرفقات
      if (userRole !== 'admin' && userRole !== 'manager') {
        // حذف الملف المؤقت إذا وجد
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(403).json({ message: "ليس لديك صلاحية لإعادة رفع مرفقات المعاملات" });
      }
      
      // التأكد من وجود ملف للرفع
      if (!req.file) {
        return res.status(400).json({ message: "لم يتم تقديم ملف للرفع" });
      }
      
      // محاولة حذف الملف المرفق السابق إذا وجد
      if (transaction.fileUrl) {
        try {
          console.log(`محاولة حذف الملف السابق: ${transaction.fileUrl}`);
          await storageManager.deleteFile(transaction.fileUrl);
          console.log("تم حذف الملف المرفق السابق بنجاح");
        } catch (fileError) {
          console.error("خطأ في حذف الملف المرفق السابق:", fileError);
          // استمر بعملية الرفع حتى لو فشل حذف الملف السابق
        }
      }
      
      // رفع الملف الجديد باستخدام نظام التخزين المتطور
      let fileUrl;
      try {
        const storageResult = await storageManager.uploadFile(
          req.file.path,
          `transactions/${id}/${req.file.filename}`,
          req.file.mimetype
        );
        
        if (storageResult.success && storageResult.url) {
          fileUrl = storageResult.url;
          console.log(`✅ تم رفع الملف الجديد بنجاح باستخدام ${storageResult.provider}: ${storageResult.url}`);
        } else {
          throw new Error(storageResult.error || 'فشل في رفع الملف');
        }
      } catch (uploadError) {
        console.error("خطأ في رفع الملف:", uploadError);
        return res.status(500).json({ message: "خطأ في رفع الملف" });
      }
      
      // تحديث المعاملة بعنوان URL للملف المرفق الجديد
      const updatedTransaction = await storage.updateTransaction(id, { 
        fileUrl,
        fileType: req.file.mimetype
      });
      
      // حذف الملف المؤقت
      fs.unlinkSync(req.file.path);
      
      // تسجيل نشاط إعادة رفع المرفق
      await storage.createActivityLog({
        action: "update",
        entityType: "transaction",
        entityId: id,
        details: `إعادة رفع مرفق للمعاملة: ${transaction.description}`,
        userId: userId
      });
      
      return res.status(200).json({
        message: "تم إعادة رفع مرفق المعاملة بنجاح",
        transaction: updatedTransaction
      });
      
    } catch (error) {
      console.error("خطأ في إعادة رفع مرفق المعاملة:", error);
      
      // حذف الملف المؤقت في حالة حدوث خطأ
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          console.error("خطأ في حذف الملف المؤقت:", unlinkError);
        }
      }
      
      return res.status(500).json({ message: "حدث خطأ أثناء إعادة رفع مرفق المعاملة" });
    }
  });

  // نقطة النهاية لحذف مرفق المعاملة
  app.delete("/api/transactions/:id/delete-attachment", authenticate, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // التحقق من وجود المعاملة
      const transaction = await storage.getTransaction(id);
      if (!transaction) {
        return res.status(404).json({ message: "المعاملة غير موجودة" });
      }
      
      // التحقق من صلاحيات المستخدم - للمدراء فقط
      const userRole = req.session.role as string;
      if (userRole !== 'admin') {
        return res.status(403).json({ message: "ليس لديك صلاحية لحذف مرفقات المعاملات" });
      }
      
      // التحقق من وجود مرفق للحذف
      if (!transaction.fileUrl) {
        return res.status(400).json({ message: "هذه المعاملة لا تحتوي على مرفق" });
      }
      
      // محاولة حذف الملف من نظام التخزين
      try {
        console.log(`محاولة حذف المرفق: ${transaction.fileUrl}`);
        await storageManager.deleteFile(transaction.fileUrl);
        console.log("تم حذف الملف المرفق بنجاح");
      } catch (fileError) {
        console.error("خطأ في حذف الملف المرفق:", fileError);
        // استمر بعملية الحذف من قاعدة البيانات حتى لو فشل حذف الملف
      }
      
      // إزالة معلومات المرفق من المعاملة في قاعدة البيانات
      const updatedTransaction = await storage.updateTransaction(id, { 
        fileUrl: null,
        fileType: null
      });
      
      // تسجيل نشاط حذف المرفق
      await storage.createActivityLog({
        action: "delete_attachment",
        entityType: "transaction",
        entityId: id,
        details: `حذف مرفق للمعاملة: ${transaction.description}`,
        userId: req.session.userId as number
      });
      
      return res.status(200).json({ 
        message: "تم حذف المرفق بنجاح",
        transaction: updatedTransaction 
      });
    } catch (error) {
      console.error("خطأ في حذف المرفق:", error);
      return res.status(500).json({ message: "خطأ في حذف المرفق" });
    }
  });

  // Archive routes - جلب المعاملات المالية المؤرشفة (أكثر من 30 يوم)
  app.get("/api/archive", authenticate, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId as number;
      const userRole = req.session.role as string;
      
      // تحديد تاريخ قبل 30 يوم من الآن
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // جلب جميع المعاملات المالية
      let transactions = await storage.listTransactions();
      
      // فلترة المعاملات التي مضى عليها أكثر من 30 يوم
      const archivedTransactions = transactions.filter(transaction => {
        const transactionDate = new Date(transaction.date);
        return transactionDate < thirtyDaysAgo;
      });
      
      // فلترة حسب صلاحيات المستخدم
      let filteredTransactions = archivedTransactions;
      
      if (userRole !== 'admin') {
        // للمستخدمين غير المديرين، عرض المعاملات الخاصة بمشاريعهم فقط
        const userProjects = await storage.getUserProjects(userId);
        const userProjectIds = userProjects.map(p => p.id);
        
        filteredTransactions = archivedTransactions.filter(transaction => 
          transaction.projectId && userProjectIds.includes(transaction.projectId)
        );
      }
      
      return res.status(200).json(filteredTransactions);
    } catch (error) {
      console.error("خطأ في جلب المعاملات المؤرشفة:", error);
      return res.status(500).json({ message: "خطأ في جلب المعاملات المؤرشفة" });
    }
  });

  // Documents routes
  app.get("/api/documents", authenticate, async (req: Request, res: Response) => {
    try {
      let documents = await storage.listDocuments();
      const userId = req.session.userId as number;
      const userRole = req.session.role as string;
      
      // فلترة المستندات بناءً على معيار isManagerDocument
      const isManagerDocument = req.query.isManagerDocument === 'true';
      
      // فلترة المستندات الإدارية أو العادية
      documents = documents.filter(d => !!d.isManagerDocument === isManagerDocument);
      
      // المدير يمكنه رؤية جميع المستندات، المستخدم العادي يرى فقط مستنداته والمستندات المرتبطة بالمشاريع التي لديه وصول إليها
      if (userRole !== "admin" && userRole !== "manager") {
        // إذا كانت المستندات الإدارية والمستخدم ليس مديرًا، فلا يمكنه رؤيتها
        if (isManagerDocument) {
          return res.status(403).json({ message: "غير مصرح لك بالوصول إلى المستندات الإدارية" });
        }
        
        // احصل على قائمة المشاريع المسموح للمستخدم بالوصول إليها
        const userProjects = await storage.getUserProjects(userId);
        const projectIds = userProjects.map(project => project.id);
        
        // فلترة المستندات بحيث تظهر فقط:
        // 1. المستندات التي قام المستخدم بتحميلها
        // 2. المستندات المرتبطة بالمشاريع التي يملك وصولاً إليها
        // 3. المستندات العامة التي ليست مرتبطة بأي مشروع
        documents = documents.filter(d => 
          d.uploadedBy === userId || 
          (d.projectId && projectIds.includes(d.projectId)) ||
          (!d.projectId) // المستندات العامة غير المرتبطة بمشروع
        );
      }
      
      // Filter by project if specified
      const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;
      if (projectId) {
        // إذا كان المستخدم غير مدير، تحقق من وصوله للمشروع
        if (userRole !== "admin" && userRole !== "manager") {
          const hasAccess = await storage.checkUserProjectAccess(userId, projectId);
          if (!hasAccess) {
            return res.status(403).json({ message: "غير مصرح لك بالوصول إلى مستندات هذا المشروع" });
          }
        }
        documents = documents.filter(d => d.projectId === projectId);
      }
      
      return res.status(200).json(documents);
    } catch (error) {
      console.error("خطأ في استرجاع المستندات:", error);
      return res.status(500).json({ message: "خطأ في استرجاع المستندات" });
    }
  });

  // تم نقل إعداد multer إلى بداية الملف

  // مسار تحميل المستندات مع FormData
  app.post("/api/upload-document", authenticate, upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "لم يتم تقديم ملف للتحميل" });
      }

      const { name, description, projectId, isManagerDocument } = req.body;
      const file = req.file;
      const userId = req.session.userId as number;
      
      // التحقق من صلاحية المستخدم للمستندات الإدارية
      const userRole = req.session.role as string;
      if (isManagerDocument === 'true' && userRole !== "admin" && userRole !== "manager") {
        // حذف الملف المؤقت
        fs.unlinkSync(file.path);
        return res.status(403).json({ 
          message: "غير مصرح لك بإنشاء مستندات إدارية" 
        });
      }
      
      // التحقق من صلاحية المستخدم للوصول للمشروع إذا تم تحديده
      if (projectId && projectId !== "all") {
        const projectIdNumber = Number(projectId);
        if (userRole !== "admin" && userRole !== "manager") {
          const hasAccess = await storage.checkUserProjectAccess(userId, projectIdNumber);
          if (!hasAccess) {
            // حذف الملف المؤقت
            fs.unlinkSync(file.path);
            return res.status(403).json({ 
              message: "ليس لديك صلاحية للوصول إلى هذا المشروع" 
            });
          }
        }
      }
      
      // تهيئة البيانات للمستند
      const documentData = {
        name: name,
        description: description || "",
        projectId: projectId && projectId !== "all" ? Number(projectId) : undefined,
        fileUrl: file.path, // سيتم تحديثه بعد رفع الملف إلى Firebase
        fileType: file.mimetype,
        uploadDate: new Date(),
        uploadedBy: userId,
        isManagerDocument: isManagerDocument === 'true'
      };
      
      try {
        // محاولة تحميل الملف إلى Firebase Storage
        const storageFolder = `documents/${userId}`;
        let fileUrl;
        try {
          // محاولة استخدام Firebase أولاً
          fileUrl = await localUpload(file.path, `${storageFolder}/${file.filename}`);
          } catch (uploadError) {
          console.error("خطأ في رفع الملف:", uploadError);
          return res.status(500).json({ message: "خطأ في رفع الملف" });
        }
        
        // تحديث مسار الملف بعنوان URL من Firebase
        documentData.fileUrl = fileUrl;
        
        // إضافة المستند إلى قاعدة البيانات
        const document = await storage.createDocument(documentData as any);
        
        // حذف الملف المؤقت بعد الرفع الناجح
        fs.unlinkSync(file.path);
        
        // تسجيل نشاط إضافة المستند
        await storage.createActivityLog({
          action: "create",
          entityType: "document",
          entityId: document.id,
          details: `إضافة مستند جديد: ${document.name}`,
          userId: userId
        });
        
        return res.status(201).json(document);
      } catch (error) {
        // حذف الملف المؤقت في حالة حدوث خطأ
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
        
        console.error("خطأ في رفع الملف:", error);
        return res.status(500).json({ message: "حدث خطأ أثناء معالجة الملف" });
      }
    } catch (error) {
      console.error("خطأ عام في رفع المستند:", error);
      return res.status(500).json({ message: "خطأ في رفع المستند" });
    }
  });

  app.post("/api/documents", authenticate, async (req: Request, res: Response) => {
    try {
      const documentData = insertDocumentSchema.parse(req.body);
      documentData.uploadedBy = req.session.userId as number;
      documentData.uploadDate = new Date();
      
      // التحقق من صلاحية المستخدم للمستندات الإدارية
      const userRole = req.session.role as string;
      if (documentData.isManagerDocument === true && userRole !== "admin" && userRole !== "manager") {
        return res.status(403).json({ 
          message: "غير مصرح لك بإنشاء مستندات إدارية" 
        });
      }
      
      // التحقق من صلاحية المستخدم للوصول للمشروع إذا تم تحديده
      if (documentData.projectId) {
        const projectId = Number(documentData.projectId);
        if (userRole !== "admin" && userRole !== "manager") {
          const hasAccess = await storage.checkUserProjectAccess(documentData.uploadedBy, projectId);
          if (!hasAccess) {
            return res.status(403).json({ 
              message: "غير مصرح لك بإضافة مستندات لهذا المشروع" 
            });
          }
        }
      }
      
      const document = await storage.createDocument(documentData);
      
      await storage.createActivityLog({
        action: "create",
        entityType: "document",
        entityId: document.id,
        details: `إضافة مستند جديد: ${document.name}${document.isManagerDocument ? " (إداري)" : ""}`,
        userId: req.session.userId as number
      });
      
      return res.status(201).json(document);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      return res.status(500).json({ message: "خطأ في إنشاء المستند" });
    }
  });

  app.delete("/api/documents/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      const document = await storage.getDocument(id);
      if (!document) {
        return res.status(404).json({ message: "المستند غير موجود" });
      }
      
      // Only document uploader or admin can delete
      if (document.uploadedBy !== req.session.userId && req.session.role !== "admin") {
        return res.status(403).json({ message: "غير مصرح لك بحذف هذا المستند" });
      }
      
      // حذف الملف المرتبط أولاً إذا كان موجودًا
      if (document.fileUrl) {
        try {
          console.log(`بدء عملية حذف الملف المرتبط بالمستند من Firebase Storage: ${document.fileUrl}`);
          // محاولة استخدام Firebase Storage أولاً للحذف
          try {
            await localDelete(document.fileUrl);
            } catch (deleteError) {
            console.error("خطأ في حذف الملف:", deleteError);
          }
        } catch (fileError) {
          console.error(`خطأ في حذف الملف المرتبط بالمستند: ${fileError}`);
          // نستمر حتى لو فشل حذف الملف
        }
      }
      
      // حذف المستند من قاعدة البيانات
      const result = await storage.deleteDocument(id);
      
      if (result) {
        await storage.createActivityLog({
          action: "delete",
          entityType: "document",
          entityId: id,
          details: `حذف مستند: ${document.name}`,
          userId: req.session.userId as number
        });
      }
      
      return res.status(200).json({ success: result });
    } catch (error) {
      console.error("خطأ في حذف المستند:", error);
      return res.status(500).json({ message: "خطأ في حذف المستند" });
    }
  });

  // Activity Logs routes - للمدير فقط
  app.get("/api/activity-logs", authenticate, async (req: Request, res: Response) => {
    try {
      // التحقق من صلاحيات المستخدم - فقط المدير يمكنه الوصول إلى سجلات النشاط
      if (req.session.role !== "admin") {
        return res.status(403).json({ message: "غير مصرح لك بالوصول إلى سجلات النشاط" });
      }
      
      let logs = await storage.listActivityLogs();
      
      // Filter by user if specified
      const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
      if (userId) {
        logs = logs.filter(log => log.userId === userId);
      }
      
      // Filter by entity type if specified
      const entityType = req.query.entityType as string | undefined;
      if (entityType) {
        logs = logs.filter(log => log.entityType === entityType);
      }
      
      // Sort by timestamp desc
      logs.sort((a, b) => {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
      
      return res.status(200).json(logs);
    } catch (error) {
      console.error("خطأ في استرجاع سجلات النشاط:", error);
      return res.status(500).json({ message: "خطأ في استرجاع سجلات النشاط" });
    }
  });

  // User Projects routes
  app.get("/api/users/:userId/projects", authenticate, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      
      // التحقق من وجود المستخدم
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "المستخدم غير موجود" });
      }
      
      // التحقق من الصلاحيات - يمكن للمستخدم الوصول إلى مشاريعه فقط، بينما يمكن للمدير الوصول إلى مشاريع أي مستخدم
      if (req.session.userId !== userId && req.session.role !== "admin") {
        return res.status(403).json({ message: "غير مصرح لك بالوصول إلى مشاريع هذا المستخدم" });
      }
      
      const projects = await storage.getUserProjects(userId);
      return res.status(200).json(projects);
    } catch (error) {
      console.error("خطأ في استرجاع مشاريع المستخدم:", error);
      return res.status(500).json({ message: "خطأ في استرجاع مشاريع المستخدم" });
    }
  });
  
  // روت جديد للحصول على مشاريع المستخدم الحالي (من الجلسة)
  app.get("/api/user-projects", authenticate, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId as number;
      
      // لوجات تشخيصية
      console.log(`جلب مشاريع المستخدم الحالي، معرف المستخدم: ${userId}`);
      
      // الحصول على مشاريع المستخدم
      let projects = [];
      try {
        projects = await storage.getUserProjects(userId);
        console.log(`تم العثور على ${projects.length} مشروع للمستخدم رقم ${userId}`);
      } catch (dbError) {
        console.error("خطأ في قاعدة البيانات أثناء جلب مشاريع المستخدم:", dbError);
        
        // إذا لم نجد أي مشاريع، نعيد مصفوفة فارغة بدلاً من خطأ
        return res.status(200).json([]);
      }
      
      // إعادة المشاريع
      return res.status(200).json(projects);
    } catch (error) {
      console.error("خطأ في جلب مشاريع المستخدم الحالي:", error);
      
      // حتى في حالة حدوث خطأ، نعيد مصفوفة فارغة بدلاً من رمز حالة خطأ
      // لتجنب المشاكل في واجهة المستخدم
      return res.status(200).json([]);
    }
  });

  app.get("/api/projects/:projectId/users", authenticate, async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId);
      
      // التحقق من وجود المشروع
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "المشروع غير موجود" });
      }
      
      // التحقق إذا كان المستخدم الحالي لديه حق الوصول إلى هذا المشروع
      if (req.session.role !== "admin") {
        const hasAccess = await storage.checkUserProjectAccess(req.session.userId as number, projectId);
        if (!hasAccess) {
          return res.status(403).json({ message: "غير مصرح لك بالوصول إلى هذا المشروع" });
        }
      }
      
      const users = await storage.getProjectUsers(projectId);
      return res.status(200).json(users);
    } catch (error) {
      console.error("خطأ في استرجاع مستخدمي المشروع:", error);
      return res.status(500).json({ message: "خطأ في استرجاع مستخدمي المشروع" });
    }
  });

  app.post("/api/user-projects", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const { userId, projectId } = req.body;
      
      if (!userId || !projectId) {
        return res.status(400).json({ message: "معرف المستخدم ومعرف المشروع مطلوبان" });
      }
      
      // التحقق من وجود المستخدم والمشروع
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "المستخدم غير موجود" });
      }
      
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "المشروع غير موجود" });
      }
      
      // التحقق إذا كان المستخدم مخصص بالفعل لهذا المشروع
      const hasAccess = await storage.checkUserProjectAccess(userId, projectId);
      if (hasAccess) {
        return res.status(400).json({ message: "المستخدم مخصص بالفعل لهذا المشروع" });
      }
      
      const userProject = await storage.assignUserToProject({
        userId,
        projectId,
        assignedBy: req.session.userId as number
      });
      
      await storage.createActivityLog({
        action: "create",
        entityType: "user_project",
        entityId: userProject.id,
        details: `تخصيص المستخدم ${user.name} للمشروع ${project.name}`,
        userId: req.session.userId as number
      });
      
      return res.status(201).json(userProject);
    } catch (error) {
      console.error("خطأ في تخصيص المشروع للمستخدم:", error);
      return res.status(500).json({ message: "خطأ في تخصيص المشروع للمستخدم" });
    }
  });

  app.delete("/api/user-projects", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const { userId, projectId } = req.body;
      
      if (!userId || !projectId) {
        return res.status(400).json({ message: "معرف المستخدم ومعرف المشروع مطلوبان" });
      }
      
      // التحقق من وجود المستخدم والمشروع
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "المستخدم غير موجود" });
      }
      
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "المشروع غير موجود" });
      }
      
      // التحقق إذا كان المستخدم مخصص لهذا المشروع
      const hasAccess = await storage.checkUserProjectAccess(userId, projectId);
      if (!hasAccess) {
        return res.status(400).json({ message: "المستخدم غير مخصص لهذا المشروع" });
      }
      
      const result = await storage.removeUserFromProject(userId, projectId);
      
      if (result) {
        await storage.createActivityLog({
          action: "delete",
          entityType: "user_project",
          entityId: 0, // لا نملك معرف محدد هنا
          details: `إلغاء تخصيص المستخدم ${user.name} من المشروع ${project.name}`,
          userId: req.session.userId as number
        });
      }
      
      return res.status(200).json({ success: result });
    } catch (error) {
      console.error("خطأ في إلغاء تخصيص المشروع للمستخدم:", error);
      return res.status(500).json({ message: "خطأ في إلغاء تخصيص المشروع للمستخدم" });
    }
  });

  // Settings routes - المدير فقط يمكنه تعديل الإعدادات، المشاهدة متاحة للجميع
  app.get("/api/settings", authenticate, authorize(["admin", "manager", "user", "viewer"]), async (req: Request, res: Response) => {
    try {
      const settings = await storage.listSettings();
      return res.status(200).json(settings);
    } catch (error) {
      return res.status(500).json({ message: "خطأ في استرجاع الإعدادات" });
    }
  });

  app.put("/api/settings/:key", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const key = req.params.key;
      const { value } = req.body;
      
      if (!value) {
        return res.status(400).json({ message: "قيمة الإعداد مطلوبة" });
      }
      
      const updatedSetting = await storage.updateSetting(key, value);
      
      if (!updatedSetting) {
        return res.status(404).json({ message: "الإعداد غير موجود" });
      }
      
      await storage.createActivityLog({
        action: "update",
        entityType: "setting",
        entityId: updatedSetting.id,
        details: `تحديث إعداد: ${updatedSetting.key}`,
        userId: req.session.userId as number
      });
      
      return res.status(200).json(updatedSetting);
    } catch (error) {
      return res.status(500).json({ message: "خطأ في تحديث الإعداد" });
    }
  });

  // استرجاع رصيد صندوق المدير
  app.get("/api/admin-fund", authenticate, async (req: Request, res: Response) => {
    try {
      // استرجاع صندوق المدير الرئيسي (معرف=1)
      const adminFundsResult = await db.select().from(funds)
        .where(
          and(
            eq(funds.type, 'admin'),
            eq(funds.ownerId, 1)
          )
        );
        
      const adminFund = adminFundsResult.length > 0 ? adminFundsResult[0] : null;
      
      if (!adminFund) {
        return res.status(200).json({ balance: 0 });
      }
      
      return res.status(200).json({ balance: adminFund.balance });
    } catch (error) {
      console.error("خطأ في استرجاع رصيد صندوق المدير:", error);
      return res.status(500).json({ message: "خطأ في استرجاع رصيد صندوق المدير" });
    }
  });

  // Dashboard statistics
  app.get("/api/dashboard", authenticate, async (req: Request, res: Response) => {
    try {
      let transactions = await storage.listTransactions();
      let projects = await storage.listProjects();
      const userId = req.session.userId as number;
      const userRole = req.session.role as string;
      
      // استرجاع رصيد صندوق المدير الرئيسي
      let adminFundBalance = 0;
      if (userRole === "admin") {
        const adminFundsResult = await db.select().from(funds)
          .where(
            and(
              eq(funds.type, 'admin'),
              eq(funds.ownerId, 1)
            )
          );
          
        const adminFund = adminFundsResult.length > 0 ? adminFundsResult[0] : null;
        if (adminFund) {
          adminFundBalance = adminFund.balance;
        }
      }

      // استرجاع أرصدة المشاريع
      const projectFunds = await db.select().from(funds)
        .where(eq(funds.type, 'project'));
      
      // إنشاء خريطة تربط المشاريع بأرصدتها
      const projectFundsMap = new Map();
      for (const fund of projectFunds) {
        if (fund.projectId) {
          projectFundsMap.set(fund.projectId, fund.balance);
        }
      }
      
      // تطبيق قيود الوصول للمستخدمين العاديين
      if (userRole !== "admin") {
        // احصل على قائمة المشاريع المسموح للمستخدم بالوصول إليها
        const userProjects = await storage.getUserProjects(userId);
        const projectIds = userProjects.map(project => project.id);
        
        // فلترة المعاملات بحيث تظهر فقط المعاملات الخاصة بالمشاريع التي يملك المستخدم وصولاً إليها
        // استبعاد معاملات الصندوق الرئيسي (التي لا تحتوي على projectId)
        transactions = transactions.filter(t => 
          t.projectId && projectIds.includes(t.projectId)
        );
        
        // فلترة المشاريع بحيث تظهر فقط المشاريع التي يملك المستخدم وصولاً إليها
        projects = userProjects;
      }
      
      // إضافة معلومات الرصيد للمشاريع
      const projectsWithBalance = projects.map(project => {
        return {
          ...project,
          balance: projectFundsMap.get(project.id) || 0
        };
      });
      
      // تقسيم المعاملات إلى مجموعات للصندوق الرئيسي والمشاريع
      const adminTransactions = transactions.filter(t => t.projectId === null || t.projectId === undefined);
      const projectTransactions = transactions.filter(t => t.projectId !== null && t.projectId !== undefined);
      
      // حساب إجماليات الصندوق الرئيسي
      const adminTotalIncome = adminTransactions
        .filter(t => t.type === "income")
        .reduce((sum, t) => sum + t.amount, 0);
      
      const adminTotalExpenses = adminTransactions
        .filter(t => t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0);
      
      const adminNetProfit = adminTotalIncome - adminTotalExpenses;
      
      // حساب إجماليات المشاريع
      const projectTotalIncome = projectTransactions
        .filter(t => t.type === "income")
        .reduce((sum, t) => sum + t.amount, 0);
      
      const projectTotalExpenses = projectTransactions
        .filter(t => t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0);
      
      const projectNetProfit = projectTotalIncome - projectTotalExpenses;
      
      // الإجماليات الكلية (تستخدم للتوافق القديم إذا لزم الأمر)
      const totalIncome = adminTotalIncome + projectTotalIncome;
      const totalExpenses = adminTotalExpenses + projectTotalExpenses;
      const netProfit = totalIncome - totalExpenses;
      
      // Get recent transactions
      const recentTransactions = [...transactions]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5);
      
      // حساب عدد المشاريع النشطة
      const activeProjects = projects.filter(p => p.status === "active").length;
      
      return res.status(200).json({
        // البيانات الإجمالية للتوافق القديم
        totalIncome,  
        totalExpenses,
        netProfit,
        
        // بيانات الصندوق الرئيسي
        adminTotalIncome,
        adminTotalExpenses,
        adminNetProfit,
        adminFundBalance,
        
        // بيانات المشاريع
        projectTotalIncome,
        projectTotalExpenses,
        projectNetProfit,
        
        // البيانات الأخرى
        activeProjects,
        recentTransactions,
        projects: projectsWithBalance
      });
    } catch (error) {
      console.error("خطأ في استرجاع إحصائيات لوحة التحكم:", error);
      return res.status(500).json({ message: "خطأ في استرجاع إحصائيات لوحة التحكم" });
    }
  });

  // Archive endpoint - المعاملات المؤرشفة (أقدم من 30 يوماً)
  app.get("/api/archive", authenticate, async (req: Request, res: Response) => {
    try {
      let transactions = await storage.listTransactions();
      const userId = req.session.userId as number;
      const userRole = req.session.role as string;
      
      // تحديد التاريخ الحد الفاصل (30 يوماً من اليوم)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // فلترة المعاملات لتشمل فقط التي هي أقدم من 30 يوماً
      transactions = transactions.filter(transaction => {
        const transactionDate = new Date(transaction.date);
        return transactionDate < thirtyDaysAgo;
      });
      
      // تطبيق قيود الوصول للمستخدمين العاديين (نفس منطق /api/transactions)
      if (userRole !== "admin") {
        const userProjects = await storage.getUserProjects(userId);
        const projectIds = userProjects.map(project => project.id);
        
        transactions = transactions.filter(t => 
          t.projectId && projectIds.includes(t.projectId)
        );
      }
      
      // فلترة حسب المشروع إذا تم تحديده
      const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;
      if (projectId) {
        if (userRole !== "admin") {
          const hasAccess = await storage.checkUserProjectAccess(userId, projectId);
          if (!hasAccess) {
            return res.status(403).json({ message: "غير مصرح لك بالوصول إلى هذا المشروع" });
          }
        }
        transactions = transactions.filter(t => t.projectId === projectId);
      }
      
      // فلترة حسب النوع إذا تم تحديده
      const type = req.query.type as string | undefined;
      if (type) {
        transactions = transactions.filter(t => t.type === type);
      }
      
      // إخفاء معلومات المرفقات للمستخدمين غير المصرح لهم
      if (userRole !== "admin") {
        transactions = transactions.map(transaction => {
          // إذا كان المستخدم ليس منشئ المعاملة، أخف معلومات المرفق
          if (transaction.createdBy !== userId) {
            return {
              ...transaction,
              fileUrl: null,
              fileType: null
            };
          }
          return transaction;
        });
      }
      
      return res.status(200).json(transactions);
    } catch (error) {
      console.error("خطأ في استرجاع المعاملات المؤرشفة:", error);
      return res.status(500).json({ message: "خطأ في استرجاع المعاملات المؤرشفة" });
    }
  });

  // Manual archive endpoint - أرشفة المعاملات يدوياً
  app.post("/api/transactions/archive", authenticate, async (req: Request, res: Response) => {
    try {
      const { transactionIds } = req.body;
      
      if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
        return res.status(400).json({ message: "يجب تحديد معاملات للأرشفة" });
      }
      
      const userId = req.session.userId as number;
      const userRole = req.session.role as string;
      
      // التحقق من صلاحية المستخدم لأرشفة المعاملات
      for (const transactionId of transactionIds) {
        const transaction = await storage.getTransaction(transactionId);
        if (!transaction) {
          return res.status(404).json({ message: `المعاملة رقم ${transactionId} غير موجودة` });
        }
        
        // التحقق من الصلاحيات
        if (userRole !== "admin" && transaction.createdBy !== userId) {
          return res.status(403).json({ message: "غير مصرح لك بأرشفة هذه المعاملة" });
        }
      }
      
      // أرشفة المعاملات (تحديث حقل archived إلى true)
      const archivedTransactions = [];
      for (const transactionId of transactionIds) {
        const updatedTransaction = await storage.updateTransaction(transactionId, { archived: true });
        if (updatedTransaction) {
          archivedTransactions.push(updatedTransaction);
          
          // إضافة سجل نشاط
          await storage.createActivityLog({
            action: "archive",
            entityType: "transaction",
            entityId: transactionId,
            details: `أرشفة المعاملة: ${updatedTransaction.description}`,
            userId: userId
          });
        }
      }
      
      return res.status(200).json({ 
        message: `تم أرشفة ${archivedTransactions.length} معاملة بنجاح`,
        archivedTransactions 
      });
    } catch (error) {
      console.error("خطأ في أرشفة المعاملات:", error);
      return res.status(500).json({ message: "خطأ في أرشفة المعاملات" });
    }
  });

  // إنشاء نسخة احتياطية شاملة
  app.get("/api/backup/download", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      // جمع جميع البيانات من قاعدة البيانات
      const [users, projects, transactions, documents, activityLogs, settings, funds] = await Promise.all([
        storage.listUsers(),
        storage.listProjects(),
        storage.listTransactions(),
        storage.listDocuments(),
        storage.listActivityLogs(),
        storage.listSettings(),
        storage.listFunds(),
      ]);

      // جمع بيانات الملفات والمستندات
      const fs = await import('fs');
      const path = await import('path');
      
      let filesData = {};
      
      try {
        const uploadsDir = path.join(process.cwd(), 'uploads');
        if (fs.existsSync(uploadsDir)) {
          const readDirRecursively = (dir: string, baseDir = dir): any => {
            const items = fs.readdirSync(dir);
            const result: any = {};
            
            for (const item of items) {
              const itemPath = path.join(dir, item);
              const stat = fs.statSync(itemPath);
              
              if (stat.isDirectory()) {
                result[item] = readDirRecursively(itemPath, baseDir);
              } else {
                // قراءة الملف وتحويله إلى base64
                const fileContent = fs.readFileSync(itemPath);
                const relativePath = path.relative(baseDir, itemPath);
                result[item] = {
                  type: 'file',
                  content: fileContent.toString('base64'),
                  size: stat.size,
                  relativePath: relativePath.replace(/\\/g, '/')
                };
              }
            }
            return result;
          };
          
          filesData = readDirRecursively(uploadsDir);
        }
      } catch (fileError) {
        console.warn('Warning: Could not read files directory:', fileError);
        filesData = { error: 'Could not read files directory' };
      }

      const backup = {
        timestamp: new Date().toISOString(),
        version: "1.0",
        data: {
          database: {
            users,
            projects,
            transactions,
            documents,
            activityLogs,
            settings,
            funds
          },
          files: filesData
        },
        metadata: {
          totalTransactions: transactions.length,
          totalDocuments: documents.length,
          totalUsers: users.length,
          totalProjects: projects.length,
          hasFiles: Object.keys(filesData).length > 0
        }
      };

      // تسجيل نشاط إنشاء النسخة الاحتياطية
      await storage.createActivityLog({
        userId: (req.session as any).userId,
        action: "backup_download",
        entityType: "system",
        entityId: 0,
        details: `تم إنشاء نسخة احتياطية شاملة تتضمن ${transactions.length} معاملة و ${documents.length} مستند`
      });

      // تعيين headers للتنزيل
      const filename = `backup_${new Date().toISOString().split('T')[0]}.json`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/json');
      
      res.json(backup);
    } catch (error) {
      console.error('Error creating backup:', error);
      res.status(500).json({ message: "خطأ في إنشاء النسخة الاحتياطية" });
    }
  });

  // استعادة نسخة احتياطية
  app.post("/api/backup/restore", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const backupData = req.body;
      
      if (!backupData || !backupData.data) {
        return res.status(400).json({ message: "بيانات النسخة الاحتياطية غير صحيحة" });
      }

      // التحقق من إصدار النسخة الاحتياطية
      const isNewFormat = backupData.data.database && backupData.data.files;
      let databaseData, filesData;
      
      if (isNewFormat) {
        databaseData = backupData.data.database;
        filesData = backupData.data.files;
      } else {
        // النسخة القديمة - البيانات مباشرة في data
        databaseData = backupData.data;
        filesData = null;
      }

      const { users, projects, transactions, documents, activityLogs, settings, funds } = databaseData;

      // استعادة الإعدادات
      if (settings && Array.isArray(settings)) {
        for (const setting of settings) {
          await storage.updateSetting(setting.key, setting.value);
        }
      }

      // استعادة الملفات إذا كانت موجودة
      let filesRestored = 0;
      if (filesData && typeof filesData === 'object' && !filesData.error) {
        const fs = await import('fs');
        const path = await import('path');
        
        try {
          const uploadsDir = path.join(process.cwd(), 'uploads');
          
          // إنشاء مجلد uploads إذا لم يكن موجوداً
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
          }
          
          const restoreFilesRecursively = (filesObj: any, basePath: string) => {
            for (const [name, data] of Object.entries(filesObj)) {
              if (typeof data === 'object' && data !== null) {
                if ((data as any).type === 'file') {
                  // استعادة الملف
                  const fileData = data as any;
                  const fullPath = path.join(basePath, name);
                  
                  // إنشاء المجلد إذا لم يكن موجوداً
                  const dir = path.dirname(fullPath);
                  if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                  }
                  
                  // كتابة الملف
                  const buffer = Buffer.from(fileData.content, 'base64');
                  fs.writeFileSync(fullPath, buffer);
                  filesRestored++;
                } else {
                  // مجلد - استدعاء تكراري
                  const subDir = path.join(basePath, name);
                  if (!fs.existsSync(subDir)) {
                    fs.mkdirSync(subDir, { recursive: true });
                  }
                  restoreFilesRecursively(data, subDir);
                }
              }
            }
          };
          
          restoreFilesRecursively(filesData, uploadsDir);
        } catch (fileError) {
          console.warn('Warning: Could not restore files:', fileError);
        }
      }

      // تسجيل نشاط استعادة النسخة الاحتياطية
      await storage.createActivityLog({
        userId: (req.session as any).userId,
        action: "backup_restore",
        entityType: "system",
        entityId: 0,
        details: `تم استعادة نسخة احتياطية من تاريخ ${backupData.timestamp}${filesRestored > 0 ? ` مع ${filesRestored} ملف` : ''}`
      });

      res.json({ 
        message: "تم استعادة النسخة الاحتياطية بنجاح",
        timestamp: backupData.timestamp,
        filesRestored: filesRestored,
        metadata: backupData.metadata || {}
      });
    } catch (error) {
      console.error('Error restoring backup:', error);
      res.status(500).json({ message: "خطأ في استعادة النسخة الاحتياطية" });
    }
  });

  // APIs إدارة النسخ الاحتياطي الجديدة
  
  // إنشاء نسخة احتياطية يدوية
  app.post("/api/backup/create", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const backupPath = await backupSystem.createFullBackup();
      
      // تسجيل نشاط إنشاء النسخة الاحتياطية
      await storage.createActivityLog({
        userId: (req.session as any).userId,
        action: "backup_create",
        entityType: "system",
        entityId: 0,
        details: "تم إنشاء نسخة احتياطية يدوية"
      });

      res.json({ 
        success: true, 
        message: "تم إنشاء النسخة الاحتياطية بنجاح",
        backupPath 
      });
    } catch (error) {
      console.error("خطأ في إنشاء النسخة الاحتياطية:", error);
      res.status(500).json({ 
        success: false, 
        message: "حدث خطأ أثناء إنشاء النسخة الاحتياطية" 
      });
    }
  });

  // قائمة النسخ الاحتياطية المتوفرة
  app.get("/api/backup/list", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const backups = await backupSystem.getAvailableBackups();
      res.json({ success: true, backups });
    } catch (error) {
      console.error("خطأ في جلب قائمة النسخ الاحتياطية:", error);
      res.status(500).json({ 
        success: false, 
        message: "حدث خطأ أثناء جلب قائمة النسخ الاحتياطية" 
      });
    }
  });

  // إضافة endpoint آخر للنسخ الاحتياطية
  app.get("/api/backups", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const backups = await backupSystem.getAvailableBackups();
      res.json(backups);
    } catch (error) {
      console.error("خطأ في جلب قائمة النسخ الاحتياطية:", error);
      res.status(500).json({ message: "خطأ في جلب قائمة النسخ الاحتياطية" });
    }
  });

  // إنشاء نسخة احتياطية طارئة قبل عملية حساسة
  app.post("/api/backup/emergency", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const { operation } = req.body;
      const backupPath = await backupSystem.createEmergencyBackup(operation || "عملية إدارية");
      
      // تسجيل نشاط إنشاء النسخة الاحتياطية الطارئة
      await storage.createActivityLog({
        userId: (req.session as any).userId,
        action: "backup_emergency",
        entityType: "system",
        entityId: 0,
        details: `تم إنشاء نسخة احتياطية طارئة: ${operation || "عملية إدارية"}`
      });

      res.json({ 
        success: true, 
        message: "تم إنشاء النسخة الاحتياطية الطارئة بنجاح",
        backupPath 
      });
    } catch (error) {
      console.error("خطأ في إنشاء النسخة الاحتياطية الطارئة:", error);
      res.status(500).json({ 
        success: false, 
        message: "حدث خطأ أثناء إنشاء النسخة الاحتياطية الطارئة" 
      });
    }
  });

  // ======== أنواع المصروفات ========
  
  // جلب جميع أنواع المصروفات
  app.get("/api/expense-types", authenticate, async (req: Request, res: Response) => {
    try {
      const expenseTypes = await storage.listExpenseTypes();
      // أنواع المصاريف متاحة لجميع المستخدمين المصادق عليهم
      return res.status(200).json(expenseTypes);
    } catch (error) {
      console.error("خطأ في جلب أنواع المصروفات:", error);
      return res.status(500).json({ message: "خطأ في جلب أنواع المصروفات" });
    }
  });

  // إنشاء نوع مصروف جديد
  app.post("/api/expense-types", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const expenseType = await storage.createExpenseType(req.body);
      
      await storage.createActivityLog({
        action: "create",
        entityType: "expense_type",
        entityId: expenseType.id,
        details: `إضافة نوع مصروف جديد: ${expenseType.name}`,
        userId: req.session.userId as number
      });

      // التحقق من وجود معاملات غير مصنفة وترحيلها تلقائياً
      try {
        // البحث عن المعاملات التي تحتوي على كلمات مفتاحية تتطابق مع نوع المصروف الجديد
        const transactions = await storage.listTransactions();
        const unclassifiedTransactions = transactions.filter(transaction => {
          // البحث في وصف المعاملة عن كلمات تتطابق مع نوع المصروف
          const description = (transaction.description || '').toLowerCase();
          const expenseTypeName = expenseType.name.toLowerCase();
          
          // البحث عن تطابق في الوصف
          return description.includes(expenseTypeName) || 
                 expenseTypeName.includes(description.split(' ')[0]); // تطابق أول كلمة
        });

        // ترحيل المعاملات المناسبة إلى دفتر الأستاذ
        for (const transaction of unclassifiedTransactions) {
          await storage.createLedgerEntry({
            transactionId: transaction.id,
            expenseTypeId: expenseType.id,
            projectId: transaction.projectId,
            amount: transaction.amount,
            entryType: transaction.type,
            description: `ترحيل تلقائي إلى نوع المصروف: ${expenseType.name}`,
            date: new Date(transaction.date)
          });
        }

        if (unclassifiedTransactions.length > 0) {
          await storage.createActivityLog({
            action: "auto_classify",
            entityType: "expense_type",
            entityId: expenseType.id,
            details: `تم ترحيل ${unclassifiedTransactions.length} معاملة تلقائياً إلى نوع المصروف: ${expenseType.name}`,
            userId: req.session.userId as number
          });
        }
      } catch (autoClassifyError) {
        console.error("خطأ في الترحيل التلقائي:", autoClassifyError);
        // لا نتوقف في حالة فشل الترحيل التلقائي
      }
      
      return res.status(201).json(expenseType);
    } catch (error) {
      console.error("خطأ في إنشاء نوع المصروف:", error);
      const errorMessage = error instanceof Error ? error.message : "خطأ في إنشاء نوع المصروف";
      return res.status(500).json({ message: errorMessage });
    }
  });

  // تحديث نوع مصروف
  app.patch("/api/expense-types/:id", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const updatedExpenseType = await storage.updateExpenseType(id, req.body);
      
      if (updatedExpenseType) {
        await storage.createActivityLog({
          action: "update",
          entityType: "expense_type",
          entityId: id,
          details: `تحديث نوع مصروف: ${updatedExpenseType.name}`,
          userId: req.session.userId as number
        });
      }
      
      return res.status(200).json(updatedExpenseType);
    } catch (error) {
      console.error("خطأ في تحديث نوع المصروف:", error);
      return res.status(500).json({ message: "خطأ في تحديث نوع المصروف" });
    }
  });

  // حذف نوع مصروف
  app.delete("/api/expense-types/:id", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const expenseType = await storage.getExpenseType(id);
      
      if (!expenseType) {
        return res.status(404).json({ message: "نوع المصروف غير موجود" });
      }
      
      const result = await storage.deleteExpenseType(id);
      
      if (result) {
        await storage.createActivityLog({
          action: "delete",
          entityType: "expense_type",
          entityId: id,
          details: `حذف نوع مصروف: ${expenseType.name}`,
          userId: req.session.userId as number
        });
      }
      
      return res.status(200).json({ success: result });
    } catch (error) {
      console.error("خطأ في حذف نوع المصروف:", error);
      const errorMessage = error instanceof Error ? error.message : "خطأ في حذف نوع المصروف";
      return res.status(500).json({ message: errorMessage });
    }
  });

  // ======== دفتر الأستاذ ========
  
  // جلب جميع مدخلات دفتر الأستاذ
  app.get("/api/ledger", authenticate, async (req: Request, res: Response) => {
    try {
      const entryType = req.query.type as string;
      const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;
      const expenseTypeId = req.query.expenseTypeId ? parseInt(req.query.expenseTypeId as string) : undefined;
      
      let ledgerEntries;
      
      if (entryType) {
        ledgerEntries = await storage.getLedgerEntriesByType(entryType);
      } else if (projectId) {
        ledgerEntries = await storage.getLedgerEntriesByProject(projectId);
      } else if (expenseTypeId) {
        ledgerEntries = await storage.getLedgerEntriesByExpenseType(expenseTypeId);
      } else {
        ledgerEntries = await storage.listLedgerEntries();
      }
      
      return res.status(200).json(ledgerEntries);
    } catch (error) {
      console.error("خطأ في جلب دفتر الأستاذ:", error);
      return res.status(500).json({ message: "خطأ في جلب دفتر الأستاذ" });
    }
  });

  // جلب جميع مدخلات دفتر الأستاذ (alias route)
  app.get("/api/ledger-entries", authenticate, async (req: Request, res: Response) => {
    try {
      const entryType = req.query.type as string;
      const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;
      const expenseTypeId = req.query.expenseTypeId ? parseInt(req.query.expenseTypeId as string) : undefined;
      
      let ledgerEntries;
      
      if (entryType) {
        ledgerEntries = await storage.getLedgerEntriesByType(entryType);
      } else if (projectId) {
        ledgerEntries = await storage.getLedgerEntriesByProject(projectId);
      } else if (expenseTypeId) {
        ledgerEntries = await storage.getLedgerEntriesByExpenseType(expenseTypeId);
      } else {
        ledgerEntries = await storage.listLedgerEntries();
      }
      
      return res.status(200).json(ledgerEntries);
    } catch (error) {
      console.error("خطأ في جلب دفتر الأستاذ:", error);
      return res.status(500).json({ message: "خطأ في جلب دفتر الأستاذ" });
    }
  });

  // ترحيل المعاملات المصنفة تلقائياً إلى دفتر الأستاذ
  app.post("/api/ledger/migrate-classified", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      console.log('بدء ترحيل المعاملات المصنفة إلى دفتر الأستاذ...');
      
      // جلب جميع المعاملات
      const allTransactions = await storage.listTransactions();
      
      // تصفية المعاملات التي لها نوع مصروف محدد
      const classifiedTransactions = allTransactions.filter(t => 
        t.expenseType && 
        t.expenseType !== 'مصروف عام' && 
        t.expenseType.trim() !== ''
      );
      
      // جلب السجلات الموجودة في دفتر الأستاذ لتجنب التكرار
      const existingEntries = await storage.listLedgerEntries();
      const existingTransactionIds = new Set(existingEntries.map(entry => entry.transactionId));
      
      let addedCount = 0;
      let skippedCount = 0;
      let notFoundCount = 0;
      const errors: string[] = [];
      
      for (const transaction of classifiedTransactions) {
        // تجاهل المعاملات الموجودة بالفعل في دفتر الأستاذ
        if (existingTransactionIds.has(transaction.id)) {
          skippedCount++;
          continue;
        }
        
        try {
          // البحث عن نوع المصروف
          const expenseTypeName = transaction.expenseType;
          if (!expenseTypeName) continue;
          
          const expenseType = await storage.getExpenseTypeByName(expenseTypeName);
          
          if (expenseType) {
            // إضافة سجل إلى دفتر الأستاذ
            await storage.createLedgerEntry({
              date: new Date(transaction.date),
              transactionId: transaction.id,
              expenseTypeId: expenseType.id,
              amount: transaction.amount,
              description: transaction.description || '',
              projectId: transaction.projectId,
              entryType: 'classified'
            });
            
            addedCount++;
            console.log(`تمت إضافة المعاملة ${transaction.id} إلى دفتر الأستاذ مع نوع المصروف: ${expenseType.name}`);
          } else {
            notFoundCount++;
            errors.push(`لم يتم العثور على نوع المصروف "${transaction.expenseType}" للمعاملة ${transaction.id}`);
          }
        } catch (error) {
          errors.push(`خطأ في معالجة المعاملة ${transaction.id}: ${error}`);
        }
      }
      
      return res.status(200).json({
        message: 'تم إنهاء عملية ترحيل المعاملات',
        summary: {
          totalClassified: classifiedTransactions.length,
          added: addedCount,
          skipped: skippedCount,
          notFound: notFoundCount,
          errors: errors.length
        },
        errors: errors
      });
      
    } catch (error) {
      console.error("خطأ في ترحيل المعاملات:", error);
      return res.status(500).json({ message: "خطأ في ترحيل المعاملات" });
    }
  });

  // تصنيف المعاملات يدوياً إلى دفتر الأستاذ
  app.post("/api/ledger/classify", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const { transactionIds, forceAll } = req.body;
      
      if (!transactionIds || !Array.isArray(transactionIds)) {
        return res.status(400).json({ message: "معرفات المعاملات مطلوبة" });
      }
      
      let classifiedCount = 0;
      let skippedCount = 0;
      
      for (const transactionId of transactionIds) {
        try {
          const transaction = await storage.getTransaction(transactionId);
          if (!transaction) {
            skippedCount++;
            continue;
          }
          
          // تصنيف المعاملة مع إجبار إنشاء السجل إذا طُلب ذلك
          await storage.classifyExpenseTransaction(transaction, forceAll || false);
          classifiedCount++;
        } catch (error) {
          console.error(`خطأ في تصنيف المعاملة ${transactionId}:`, error);
          skippedCount++;
        }
      }
      
      await storage.createActivityLog({
        action: "update",
        entityType: "ledger",
        entityId: 0,
        details: `تصنيف يدوي لـ ${classifiedCount} معاملة إلى دفتر الأستاذ`,
        userId: req.session.userId as number
      });
      
      return res.status(200).json({
        message: `تم تصنيف ${classifiedCount} معاملة، تم تخطي ${skippedCount} معاملة`,
        classified: classifiedCount,
        skipped: skippedCount
      });
    } catch (error) {
      console.error("خطأ في التصنيف اليدوي:", error);
      return res.status(500).json({ message: "خطأ في التصنيف اليدوي" });
    }
  });

  // إعادة تصنيف المعاملات الموجودة حسب أنواع المصاريف الجديدة
  app.post("/api/ledger/reclassify-transactions", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      console.log('بدء إعادة تصنيف المعاملات حسب أنواع المصاريف الجديدة...');
      
      // جلب جميع المعاملات من نوع مصروف التي لها expenseType
      const transactions = await storage.listTransactions();
      const expenseTransactions = transactions.filter(t => 
        t.type === 'expense' && 
        t.expenseType && 
        t.expenseType !== 'مصروف عام'
      );
      
      let reclassifiedCount = 0;
      let skippedCount = 0;
      const errors: string[] = [];
      
      console.log(`تم العثور على ${expenseTransactions.length} معاملة مصروف مع أنواع مصاريف محددة`);
      
      for (const transaction of expenseTransactions) {
        try {
          // استخدام دالة التصنيف الموجودة مع إجبار إعادة التصنيف
          await storage.classifyExpenseTransaction(transaction, true);
          reclassifiedCount++;
          console.log(`تم إعادة تصنيف المعاملة ${transaction.id} - ${transaction.description}`);
        } catch (error) {
          errors.push(`خطأ في إعادة تصنيف المعاملة ${transaction.id}: ${error}`);
          skippedCount++;
        }
      }
      
      await storage.createActivityLog({
        action: "update",
        entityType: "ledger",
        entityId: 1,
        details: `إعادة تصنيف ${reclassifiedCount} معاملة في دفتر الأستاذ`,
        userId: req.session.userId as number
      });
      
      return res.status(200).json({
        message: 'تم إنهاء عملية إعادة التصنيف',
        summary: {
          totalExpenseTransactions: expenseTransactions.length,
          reclassified: reclassifiedCount,
          skipped: skippedCount,
          errors: errors.length
        },
        errors: errors
      });
      
    } catch (error) {
      console.error("خطأ في إعادة تصنيف المعاملات:", error);
      return res.status(500).json({ message: "خطأ في إعادة تصنيف المعاملات" });
    }
  });

  // تقرير المصروفات المصنفة مقابل المتفرقات
  app.get("/api/ledger/summary", authenticate, async (req: Request, res: Response) => {
    try {
      const classifiedEntries = await storage.getLedgerEntriesByType('classified');
      const generalExpenseEntries = await storage.getLedgerEntriesByType('general_expense');
      
      const classifiedTotal = classifiedEntries.reduce((sum, entry) => sum + entry.amount, 0);
      const generalExpenseTotal = generalExpenseEntries.reduce((sum, entry) => sum + entry.amount, 0);
      
      const summary = {
        classified: {
          total: classifiedTotal,
          count: classifiedEntries.length,
          entries: classifiedEntries
        },
        general_expense: {
          total: generalExpenseTotal,
          count: generalExpenseEntries.length,
          entries: generalExpenseEntries
        },
        grandTotal: classifiedTotal + generalExpenseTotal
      };
      
      return res.status(200).json(summary);
    } catch (error) {
      console.error("خطأ في جلب ملخص دفتر الأستاذ:", error);
      return res.status(500).json({ message: "خطأ في جلب ملخص دفتر الأستاذ" });
    }
  });

  // جلب الدفعات الآجلة مع تجميعها حسب المستفيد
  app.get("/api/ledger/deferred-payments", authenticate, async (req: Request, res: Response) => {
    try {
      // جلب جميع المستحقات من جدول deferred_payments
      const allDeferredPayments = await storage.listDeferredPayments();
      
      // جلب نوع المصروف للدفعات الآجلة
      const deferredExpenseType = await storage.getExpenseTypeByName('دفعات آجلة');
      if (!deferredExpenseType) {
        // إنشاء نوع المصروف إذا لم يكن موجوداً
        const newExpenseType = await storage.createExpenseType({
          name: 'دفعات آجلة',
          description: 'المستحقات والدفعات الآجلة',
          isActive: true
        });
        console.log("تم إنشاء نوع مصروف جديد: دفعات آجلة");
      }

      // جلب السجلات المرحلة في دفتر الأستاذ
      const deferredEntries = deferredExpenseType ? 
        await storage.getLedgerEntriesByExpenseType(deferredExpenseType.id) : [];
      
      // تجميع السجلات المرحلة حسب المستفيد
      const groupedEntries: { [key: string]: any[] } = {};
      
      deferredEntries.forEach(entry => {
        // استخراج اسم المستفيد من الوصف
        const match = entry.description.match(/دفعة مستحق: (.+?) - قسط/) ||
                     entry.description.match(/دفعة (.+?) - قسط/) ||
                     entry.description.match(/(.+?) - دفعة/);
        const beneficiaryName = match ? match[1] : 'غير محدد';
        
        if (!groupedEntries[beneficiaryName]) {
          groupedEntries[beneficiaryName] = [];
        }
        groupedEntries[beneficiaryName].push(entry);
      });

      // إضافة المستحقات غير المرحلة
      const result: any[] = [];
      
      // معالجة المستحقات المرحلة
      Object.keys(groupedEntries).forEach(beneficiaryName => {
        if (beneficiaryName !== 'غير محدد') {
          result.push({
            beneficiaryName,
            totalAmount: groupedEntries[beneficiaryName].reduce((sum, entry) => sum + entry.amount, 0),
            paymentsCount: groupedEntries[beneficiaryName].length,
            entries: groupedEntries[beneficiaryName].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            isTransferred: true
          });
        }
      });

      // إضافة المستحقات غير المرحلة
      allDeferredPayments.forEach(payment => {
        const isAlreadyTransferred = result.some(r => r.beneficiaryName === payment.beneficiaryName);
        if (!isAlreadyTransferred && payment.paidAmount > 0) {
          // هذا مستحق مدفوع جزئياً أو كلياً لكن غير مرحل
          result.push({
            beneficiaryName: payment.beneficiaryName,
            totalAmount: payment.paidAmount,
            paymentsCount: 1, // تقديري - سيتم تحديثه عند الترحيل
            entries: [{
              id: `pending-${payment.id}`,
              date: payment.createdAt,
              description: `مستحق غير مرحل: ${payment.beneficiaryName} - ${payment.paidAmount.toLocaleString()} د.ع`,
              amount: payment.paidAmount,
              entryType: 'pending_transfer',
              projectId: payment.projectId
            }],
            isTransferred: false,
            pendingTransfer: true,
            originalPaymentId: payment.id
          });
        }
      });

      return res.status(200).json(result);
    } catch (error) {
      console.error("خطأ في جلب الدفعات الآجلة:", error);
      return res.status(500).json({ message: "خطأ في جلب الدفعات الآجلة" });
    }
  });

  // جلب سجل الدفعات لمستحق معين (من قسم المستحقات فقط)
  app.get("/api/ledger/deferred-payments/:receivableId", authenticate, async (req: Request, res: Response) => {
    try {
      const receivableId = parseInt(req.params.receivableId);
      
      if (isNaN(receivableId)) {
        return res.status(400).json({ message: "معرف المستحق غير صحيح" });
      }

      // جلب المستحق أولاً للتأكد من وجوده
      const receivable = await storage.getDeferredPayment(receivableId);
      if (!receivable) {
        return res.status(404).json({ message: "المستحق غير موجود" });
      }

      // جلب نوع المصروف للدفعات الآجلة
      const deferredExpenseType = await storage.getExpenseTypeByName('دفعات آجلة');
      if (!deferredExpenseType) {
        return res.status(200).json([]);
      }

      // جلب جميع السجلات للدفعات الآجلة
      const allDeferredEntries = await storage.getLedgerEntriesByExpenseType(deferredExpenseType.id);
      
      // البحث عن المدفوعات من قسم المستحقات فقط (بدون بحث تلقائي)
      const receivableEntries = [];
      
      // السجلات من دفتر الأستاذ (قسم المستحقات) - دفعات مستحقة مؤكدة فقط
      const ledgerEntries = allDeferredEntries.filter(entry => {
        const match = entry.description.match(/دفعة مستحق: (.+?) - قسط/);
        const beneficiaryName = match ? match[1] : '';
        return beneficiaryName === receivable.beneficiaryName;
      });
      
      receivableEntries.push(...ledgerEntries.map((entry: any) => ({
        ...entry,
        entryType: 'confirmed_settlement',
        paymentType: 'تسديد من قسم المستحقات'
      })));
      
      console.log(`📋 عرض دفعات المستحق "${receivable.beneficiaryName}":`, {
        totalEntries: receivableEntries.length,
        source: 'قسم المستحقات فقط'
      });
      
      // لا يوجد بحث تلقائي - فقط دفعات قسم المستحقات

      // إزالة التكرارات وترتيب السجلات حسب التاريخ (الأحدث أولاً)
      const uniqueEntries = receivableEntries.filter((entry, index, self) => {
        // تجنب التكرار بناءً على التاريخ والمبلغ والوصف
        return index === self.findIndex(e => 
          e.date === entry.date && 
          e.amount === entry.amount && 
          e.description === entry.description
        );
      });

      const sortedEntries = uniqueEntries.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      return res.status(200).json(sortedEntries);
    } catch (error) {
      console.error("خطأ في جلب سجل الدفعات:", error);
      return res.status(500).json({ message: "خطأ في جلب سجل الدفعات" });
    }
  });

  // ترحيل المستحقات غير المرحلة إلى دفتر الأستاذ
  app.post("/api/ledger/transfer-receivables", authenticate, authorize(["admin", "manager"]), async (req: Request, res: Response) => {
    try {
      const { receivableIds } = req.body;
      
      if (!receivableIds || !Array.isArray(receivableIds)) {
        return res.status(400).json({ message: "قائمة المستحقات مطلوبة" });
      }

      // جلب نوع المصروف للدفعات الآجلة
      let deferredExpenseType = await storage.getExpenseTypeByName('دفعات آجلة');
      if (!deferredExpenseType) {
        // إنشاء نوع المصروف إذا لم يكن موجوداً
        deferredExpenseType = await storage.createExpenseType({
          name: 'دفعات آجلة',
          description: 'المستحقات والدفعات الآجلة',
          isActive: true
        });
      }

      let transferredCount = 0;
      const errors: string[] = [];

      for (const receivableId of receivableIds) {
        try {
          // جلب بيانات المستحق
          const receivable = await storage.getDeferredPayment(receivableId);
          if (!receivable) {
            errors.push(`المستحق برقم ${receivableId} غير موجود`);
            continue;
          }

          if (receivable.paidAmount <= 0) {
            errors.push(`المستحق ${receivable.beneficiaryName} لا يحتوي على مبالغ مدفوعة`);
            continue;
          }

          // إنشاء قيد في دفتر الأستاذ
          await storage.createLedgerEntry({
            date: new Date(),
            transactionId: 0, // قيد ترحيل مستحق
            expenseTypeId: deferredExpenseType.id,
            amount: receivable.paidAmount,
            description: `دفعة مستحق: ${receivable.beneficiaryName} - قسط مرحل من النظام`,
            projectId: receivable.projectId,
            entryType: 'classified'
          });

          transferredCount++;

          // تسجيل النشاط
          await storage.createActivityLog({
            action: "transfer",
            entityType: "receivable",
            entityId: receivable.id,
            details: `ترحيل مستحق ${receivable.beneficiaryName} إلى دفتر الأستاذ - ${receivable.paidAmount.toLocaleString()} د.ع`,
            userId: req.session.userId as number
          });

        } catch (error) {
          console.error(`خطأ في ترحيل المستحق ${receivableId}:`, error);
          errors.push(`خطأ في ترحيل المستحق ${receivableId}: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
        }
      }

      return res.status(200).json({
        success: true,
        transferredCount,
        totalRequested: receivableIds.length,
        errors: errors.length > 0 ? errors : undefined,
        message: `تم ترحيل ${transferredCount} مستحق من أصل ${receivableIds.length} إلى دفتر الأستاذ`
      });

    } catch (error) {
      console.error("خطأ في ترحيل المستحقات:", error);
      return res.status(500).json({ message: "خطأ في ترحيل المستحقات" });
    }
  });

  // ======== تصنيفات أنواع الحسابات ========
  
  // جلب جميع تصنيفات أنواع الحسابات
  app.get("/api/account-categories", authenticate, async (req: Request, res: Response) => {
    try {
      const categories = await storage.listAccountCategories();
      return res.status(200).json(categories);
    } catch (error) {
      console.error("خطأ في جلب تصنيفات أنواع الحسابات:", error);
      return res.status(500).json({ message: "خطأ في جلب تصنيفات أنواع الحسابات" });
    }
  });

  // إنشاء تصنيف جديد لنوع الحساب
  app.post("/api/account-categories", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const validatedData = insertAccountCategorySchema.parse({
        ...req.body,
        createdBy: req.session.userId
      });
      
      const category = await storage.createAccountCategory(validatedData);
      
      await storage.createActivityLog({
        action: "create",
        entityType: "account_category",
        entityId: category.id,
        details: `إنشاء تصنيف جديد: ${category.name}`,
        userId: req.session.userId as number
      });
      
      return res.status(201).json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "بيانات غير صالحة", errors: error.errors });
      }
      console.error("خطأ في إنشاء تصنيف نوع الحساب:", error);
      return res.status(500).json({ message: "خطأ في إنشاء تصنيف نوع الحساب" });
    }
  });

  // تحديث تصنيف نوع الحساب
  app.put("/api/account-categories/:id", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { name, description, active } = req.body;
      
      if (!name) {
        return res.status(400).json({ message: "اسم التصنيف مطلوب" });
      }
      
      const updatedCategory = await storage.updateAccountCategory(id, { name, description, active });
      
      if (!updatedCategory) {
        return res.status(404).json({ message: "التصنيف غير موجود" });
      }
      
      await storage.createActivityLog({
        action: "update",
        entityType: "account_category",
        entityId: updatedCategory.id,
        details: `تحديث تصنيف: ${updatedCategory.name}`,
        userId: req.session.userId as number
      });
      
      return res.status(200).json(updatedCategory);
    } catch (error) {
      console.error("خطأ في تحديث تصنيف نوع الحساب:", error);
      return res.status(500).json({ message: "خطأ في تحديث تصنيف نوع الحساب" });
    }
  });

  // حذف تصنيف نوع الحساب
  app.delete("/api/account-categories/:id", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      const category = await storage.getAccountCategory(id);
      if (!category) {
        return res.status(404).json({ message: "التصنيف غير موجود" });
      }
      
      const result = await storage.deleteAccountCategory(id);
      
      if (result) {
        await storage.createActivityLog({
          action: "delete",
          entityType: "account_category",
          entityId: id,
          details: `حذف تصنيف: ${category.name}`,
          userId: req.session.userId as number
        });
      }
      
      return res.status(200).json({ success: result });
    } catch (error) {
      console.error("خطأ في حذف تصنيف نوع الحساب:", error);
      return res.status(500).json({ message: "خطأ في حذف تصنيف نوع الحساب" });
    }
  });

  // Database status endpoint
  app.get("/api/database/status", async (req: Request, res: Response) => {
    try {
      // Test database connection by running a simple query
      const startTime = Date.now();
      const result = await storage.checkTableExists('users');
      const responseTime = Date.now() - startTime;
      
      res.json({
        connected: true,
        responseTime,
        timestamp: new Date().toISOString(),
        tablesAccessible: result
      });
    } catch (error) {
      console.error("Database connection error:", error);
      res.status(500).json({
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown database error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // ======== الدفعات المؤجلة ========
  
  // جلب جميع الدفعات المؤجلة
  app.get("/api/deferred-payments", authenticate, async (req: Request, res: Response) => {
    try {
      const payments = await storage.listDeferredPayments();
      return res.status(200).json(payments);
    } catch (error) {
      console.error("خطأ في جلب الدفعات المؤجلة:", error);
      return res.status(500).json({ message: "خطأ في جلب الدفعات المؤجلة" });
    }
  });

  // جلب جميع المستحقات (alias route)
  app.get("/api/receivables", authenticate, async (req: Request, res: Response) => {
    try {
      const payments = await storage.listDeferredPayments();
      return res.status(200).json(payments);
    } catch (error) {
      console.error("خطأ في جلب المستحقات:", error);
      return res.status(500).json({ message: "خطأ في جلب المستحقات" });
    }
  });

  // إنشاء دفعة مؤجلة جديدة
  app.post("/api/deferred-payments", authenticate, async (req: Request, res: Response) => {
    try {
      const { dueDate, ...bodyData } = req.body;
      const requestData = {
        ...bodyData,
        userId: req.session.userId,
        remainingAmount: req.body.remainingAmount || req.body.totalAmount,
        dueDate: dueDate ? new Date(dueDate) : null
      };
      
      const validatedData = insertDeferredPaymentSchema.parse(requestData);
      
      const payment = await storage.createDeferredPayment(validatedData);
      
      // إنشاء نوع مصروف تلقائياً لهذا المستحق في قسم التقارير
      try {
        console.log(`Creating automatic expense type for receivable: ${validatedData.beneficiaryName}`);
        
        // فحص إذا كان نوع المصروف موجود مسبقاً
        const existingExpenseTypes = await storage.listExpenseTypes();
        const existingType = existingExpenseTypes.find(et => 
          et.name.trim().toLowerCase() === validatedData.beneficiaryName.trim().toLowerCase()
        );
        
        if (!existingType) {
          // إنشاء نوع مصروف جديد
          const expenseTypeData = {
            name: validatedData.beneficiaryName,
            description: `نوع مصروف تم إنشاؤه تلقائياً للمستحق: ${validatedData.beneficiaryName}`,
            createdBy: req.session.userId as number,
            active: true
          };
          
          const newExpenseType = await storage.createExpenseType(expenseTypeData);
          console.log(`Created expense type ${newExpenseType.id} for receivable: ${validatedData.beneficiaryName}`);
          
          // سجل العملية في سجل الأنشطة
          await storage.createActivityLog({
            action: "create",
            entityType: "expense_type",
            entityId: newExpenseType.id,
            details: `إنشاء تلقائي لنوع مصروف "${validatedData.beneficiaryName}" عند إنشاء مستحق`,
            userId: req.session.userId as number
          });
        } else {
          console.log(`Expense type already exists for: ${validatedData.beneficiaryName}`);
        }
      } catch (expenseTypeError) {
        console.error('Error creating automatic expense type:', expenseTypeError);
        // لا نوقف العملية الأساسية إذا فشل إنشاء نوع المصروف
      }
      
      return res.status(201).json(payment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error:", error.errors);
        return res.status(400).json({ message: "بيانات غير صالحة", errors: error.errors });
      }
      console.error("خطأ في إنشاء الدفعة المؤجلة:", error);
      return res.status(500).json({ message: "خطأ في إنشاء الدفعة المؤجلة" });
    }
  });

  // تسجيل دفعة جزئية
  app.post("/api/deferred-payments/:id/pay", authenticate, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { amount } = req.body;
      
      // تحويل المبلغ إلى رقم صحيح
      const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
      
      if (!numericAmount || isNaN(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({ message: "مبلغ الدفعة مطلوب ويجب أن يكون أكبر من الصفر" });
      }
      
      console.log(`Processing payment for deferred payment ${id}, amount: ${numericAmount}, user: ${req.session.userId}`);
      
      const result = await storage.payDeferredPaymentInstallment(id, numericAmount, req.session.userId as number);
      
      // إبطال التخزين المؤقت للمعاملات والمستحقات
      if (result.transaction) {
        // إبطال تخزين المعاملات المؤقت
        req.app.locals.cache?.delete('/api/transactions');
        req.app.locals.cache?.delete('/api/dashboard');
        // إبطال تخزين المستحقات المؤقت
        req.app.locals.cache?.delete('/api/deferred-payments');
      }
      
      return res.status(200).json(result);
    } catch (error) {
      console.error("خطأ في تسجيل الدفعة:", error);
      return res.status(500).json({ message: error instanceof Error ? error.message : "خطأ في تسجيل الدفعة" });
    }
  });

  // جلب دفعة مؤجلة محددة
  app.get("/api/deferred-payments/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const payment = await storage.getDeferredPayment(id);
      
      if (!payment) {
        return res.status(404).json({ message: "الدفعة المؤجلة غير موجودة" });
      }
      
      return res.status(200).json(payment);
    } catch (error) {
      console.error("خطأ في جلب الدفعة المؤجلة:", error);
      return res.status(500).json({ message: "خطأ في جلب الدفعة المؤجلة" });
    }
  });

  // جلب تفاصيل مستحق مع جميع عمليات الدفع
  app.get("/api/deferred-payments/:id/details", authenticate, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const payment = await storage.getDeferredPayment(id);
      
      if (!payment) {
        return res.status(404).json({ message: "المستحق غير موجود" });
      }

      // جلب العمليات المالية المرتبطة بهذا المستفيد
      let payments: any[] = [];
      
      try {
        // استخدام الاسم الصحيح للمستفيد - قد يكون في beneficiaryName أو beneficiary_name
        const beneficiaryName = payment.beneficiaryName || (payment as any).beneficiary_name || '';
        console.log(`Looking for payments for beneficiary: "${beneficiaryName}"`);
        
        // جلب العمليات المالية التي تحتوي على اسم المستفيد في الوصف
        const allTransactions = await storage.listTransactions();
        console.log(`Total transactions: ${allTransactions.length}`);
        
        const beneficiaryTransactions = allTransactions.filter((transaction: any) => {
          const description = transaction.description || '';
          // البحث عن مختلف أنماط دفعات المستحقات
          const patterns = [
            `دفع قسط للمستفيد: ${beneficiaryName}`,
            `دفع قسط من: ${payment.description} (${beneficiaryName})`,
            `دفعة مستحق: ${beneficiaryName}`
          ];
          
          const matches = patterns.some(pattern => description.includes(pattern));
          if (matches) {
            console.log(`Found matching transaction: ${transaction.id} - ${description}`);
          }
          return matches;
        });
        
        console.log(`Found ${beneficiaryTransactions.length} matching transactions`);
        
        // تحويل المعاملات إلى تنسيق الدفعات
        payments = beneficiaryTransactions.map((transaction: any) => ({
          id: transaction.id,
          amount: transaction.amount,
          paymentDate: transaction.date,
          createdAt: transaction.createdAt || transaction.date,
          notes: transaction.description,
          paidBy: 'نظام المعاملات المالية',
          userName: 'نظام المستحقات',
          transactionId: transaction.id
        }));
        
        console.log(`Final payments array: ${payments.length} items`);
      } catch (error) {
        console.error('Error fetching payments for beneficiary:', error);
      }

      // ترتيب الدفعات حسب التاريخ (الأحدث أولاً)
      payments.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());

      const result = {
        ...payment,
        payments: payments
      };
      
      return res.status(200).json(result);
    } catch (error) {
      console.error("خطأ في جلب تفاصيل المستحق:", error);
      return res.status(500).json({ message: "خطأ في جلب تفاصيل المستحق" });
    }
  });

  // تحديث دفعة مؤجلة
  app.put("/api/deferred-payments/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const updatedPayment = await storage.updateDeferredPayment(id, req.body);
      
      if (!updatedPayment) {
        return res.status(404).json({ message: "الدفعة المؤجلة غير موجودة" });
      }
      
      await storage.createActivityLog({
        action: "update",
        entityType: "deferred_payment",
        entityId: id,
        details: `تحديث دفعة مؤجلة: ${updatedPayment.beneficiaryName}`,
        userId: req.session.userId as number
      });
      
      return res.status(200).json(updatedPayment);
    } catch (error) {
      console.error("خطأ في تحديث الدفعة المؤجلة:", error);
      return res.status(500).json({ message: "خطأ في تحديث الدفعة المؤجلة" });
    }
  });

  // حذف دفعة مؤجلة
  app.delete("/api/deferred-payments/:id", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      const payment = await storage.getDeferredPayment(id);
      if (!payment) {
        return res.status(404).json({ message: "الدفعة المؤجلة غير موجودة" });
      }
      
      const result = await storage.deleteDeferredPayment(id);
      
      if (result) {
        await storage.createActivityLog({
          action: "delete",
          entityType: "deferred_payment",
          entityId: id,
          details: `حذف دفعة مؤجلة: ${payment.beneficiaryName}`,
          userId: req.session.userId as number
        });
      }
      
      return res.status(200).json({ success: result });
    } catch (error) {
      console.error("خطأ في حذف الدفعة المؤجلة:", error);
      return res.status(500).json({ message: "خطأ في حذف الدفعة المؤجلة" });
    }
  });

  const httpServer = createServer(app);
  // ======== إدارة قواعد البيانات الاحتياطية ========
  
  // فحص حالة قواعد البيانات
  app.get("/api/database/health", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const health = await checkDatabasesHealth();
      res.json({ 
        success: true, 
        health,
        message: `قاعدة البيانات النشطة: ${health.active === 'primary' ? 'الرئيسية' : health.active === 'backup' ? 'الاحتياطية' : 'لا توجد'}`
      });
    } catch (error) {
      console.error("خطأ في فحص حالة قواعد البيانات:", error);
      res.status(500).json({ 
        success: false, 
        message: "حدث خطأ أثناء فحص حالة قواعد البيانات" 
      });
    }
  });

  // تهيئة قاعدة البيانات الاحتياطية
  app.post("/api/database/init-backup", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const success = await initializeBackupDatabase();
      
      if (success) {
        await storage.createActivityLog({
          userId: req.session.userId as number,
          action: "database_backup_init",
          entityType: "system",
          entityId: 0,
          details: "تم تهيئة قاعدة البيانات الاحتياطية"
        });
        
        res.json({ 
          success: true, 
          message: "تم تهيئة قاعدة البيانات الاحتياطية بنجاح" 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: "فشل في تهيئة قاعدة البيانات الاحتياطية" 
        });
      }
    } catch (error) {
      console.error("خطأ في تهيئة قاعدة البيانات الاحتياطية:", error);
      res.status(500).json({ 
        success: false, 
        message: "حدث خطأ أثناء تهيئة قاعدة البيانات الاحتياطية" 
      });
    }
  });

  // التبديل بين قواعد البيانات
  app.post("/api/database/switch", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const { target } = req.body;
      
      if (!target || (target !== 'primary' && target !== 'backup')) {
        return res.status(400).json({ 
          success: false, 
          message: "يجب تحديد قاعدة البيانات المستهدفة (primary أو backup)" 
        });
      }
      
      const success = await switchDatabase(target);
      
      if (success) {
        await storage.createActivityLog({
          userId: req.session.userId as number,
          action: "database_switch",
          entityType: "system",
          entityId: 0,
          details: `تم التبديل إلى قاعدة البيانات ${target === 'primary' ? 'الرئيسية' : 'الاحتياطية'}`
        });
        
        res.json({ 
          success: true, 
          message: `تم التبديل إلى قاعدة البيانات ${target === 'primary' ? 'الرئيسية' : 'الاحتياطية'} بنجاح`,
          activeDatabase: target
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: `فشل في التبديل إلى قاعدة البيانات ${target}` 
        });
      }
    } catch (error) {
      console.error("خطأ في التبديل بين قواعد البيانات:", error);
      res.status(500).json({ 
        success: false, 
        message: "حدث خطأ أثناء التبديل بين قواعد البيانات" 
      });
    }
  });

  // مزامنة البيانات إلى قاعدة البيانات الاحتياطية
  app.post("/api/database/sync", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const success = await syncDatabaseToBackup();
      
      if (success) {
        await storage.createActivityLog({
          userId: req.session.userId as number,
          action: "database_sync",
          entityType: "system",
          entityId: 0,
          details: "تم مزامنة البيانات إلى قاعدة البيانات الاحتياطية"
        });
        
        res.json({ 
          success: true, 
          message: "تم مزامنة البيانات إلى قاعدة البيانات الاحتياطية بنجاح" 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: "فشل في مزامنة البيانات" 
        });
      }
    } catch (error) {
      console.error("خطأ في مزامنة البيانات:", error);
      res.status(500).json({ 
        success: false, 
        message: "حدث خطأ أثناء مزامنة البيانات" 
      });
    }
  });

  // ======== إدارة Supabase ========
  
  // فحص حالة Supabase
  app.get("/api/supabase/health", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      // استخدام النظام المبسط فقط
      const health = await checkSupabaseSimpleHealth();
      res.json({ 
        success: true, 
        health,
        message: `Supabase متاح: عميل=${health.client}, قاعدة بيانات=${health.database}, تخزين=${health.storage}`
      });
    } catch (error) {
      console.error("خطأ في فحص حالة Supabase:", error);
      res.status(500).json({ 
        success: false, 
        message: "حدث خطأ أثناء فحص حالة Supabase" 
      });
    }
  });

  // تشخيص تفصيلي لـ Supabase
  app.get("/api/supabase/diagnose", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const diagnosis = await diagnoseSupabaseConnection();
      const suggestions = getSuggestions(diagnosis);
      
      res.json({
        success: true,
        diagnosis,
        suggestions,
        message: "تشخيص Supabase مكتمل"
      });
    } catch (error: any) {
      console.error("خطأ في تشخيص Supabase:", error);
      res.status(500).json({
        success: false,
        message: `خطأ في تشخيص Supabase: ${error.message}`
      });
    }
  });

  // إعداد Supabase كقاعدة البيانات الرئيسية
  app.post("/api/supabase/setup-as-main", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      console.log('🔄 بدء إعداد Supabase كقاعدة البيانات الرئيسية...');
      
      await setupSupabaseAsMainDatabase();
      
      await storage.createActivityLog({
        userId: req.session.userId as number,
        action: "supabase_setup_main",
        entityType: "system",
        entityId: 0,
        details: "تم إعداد Supabase كقاعدة البيانات الرئيسية"
      });

      res.json({
        success: true,
        message: "تم إعداد Supabase كقاعدة البيانات الرئيسية بنجاح"
      });
    } catch (error: any) {
      console.error("خطأ في إعداد Supabase:", error);
      res.status(500).json({
        success: false,
        message: `خطأ في إعداد Supabase: ${error.message}`
      });
    }
  });

  // نقل الملفات إلى Supabase
  app.post("/api/supabase/migrate-files", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      console.log('📁 بدء نقل الملفات إلى Supabase...');
      
      const results = await migrateFilesToSupabase();
      
      await storage.createActivityLog({
        userId: req.session.userId as number,
        action: "supabase_migrate_files",
        entityType: "system",
        entityId: 0,
        details: `تم نقل ${results.migratedCount} ملف إلى Supabase`
      });

      res.json({
        success: true,
        results,
        message: `تم نقل ${results.migratedCount} ملف بنجاح`
      });
    } catch (error: any) {
      console.error("خطأ في نقل الملفات:", error);
      res.status(500).json({
        success: false,
        message: `خطأ في نقل الملفات: ${error.message}`
      });
    }
  });

  // تحديث روابط الملفات
  app.post("/api/supabase/update-file-urls", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      console.log('🔗 تحديث روابط الملفات...');
      
      await updateFileUrlsToSupabase();
      
      await storage.createActivityLog({
        userId: req.session.userId as number,
        action: "supabase_update_urls",
        entityType: "system",
        entityId: 0,
        details: "تم تحديث روابط الملفات إلى Supabase"
      });

      res.json({
        success: true,
        message: "تم تحديث روابط الملفات بنجاح"
      });
    } catch (error: any) {
      console.error("خطأ في تحديث الروابط:", error);
      res.status(500).json({
        success: false,
        message: `خطأ في تحديث الروابط: ${error.message}`
      });
    }
  });

  // فحص حالة النقل
  app.get("/api/supabase/migration-status", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const status = await checkSupabaseMigrationStatus();
      
      res.json({
        success: true,
        status,
        message: "تم فحص حالة النقل"
      });
    } catch (error: any) {
      console.error("خطأ في فحص حالة النقل:", error);
      res.status(500).json({
        success: false,
        message: `خطأ في فحص حالة النقل: ${error.message}`
      });
    }
  });

  // تهيئة Supabase
  app.post("/api/supabase/init", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      // استخدام النظام المبسط مباشرة لضمان النجاح
      const success = await initializeSupabaseSimple();
      
      if (success) {
        await storage.createActivityLog({
          userId: req.session.userId as number,
          action: "supabase_init",
          entityType: "system",
          entityId: 0,
          details: "تم تهيئة Supabase بنجاح"
        });
        
        res.json({ 
          success: true, 
          message: "تم تهيئة Supabase بنجاح" 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: "فشل في تهيئة Supabase - تحقق من مفاتيح API" 
        });
      }
    } catch (error) {
      console.error("خطأ في تهيئة Supabase:", error);
      res.status(500).json({ 
        success: false, 
        message: "حدث خطأ أثناء تهيئة Supabase" 
      });
    }
  });

  // مزامنة البيانات إلى Supabase
  app.post("/api/supabase/sync-data", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const success = await syncToSupabase();
      
      if (success) {
        await storage.createActivityLog({
          userId: req.session.userId as number,
          action: "supabase_sync",
          entityType: "system",
          entityId: 0,
          details: "تم مزامنة البيانات إلى Supabase"
        });
        
        res.json({ 
          success: true, 
          message: "تم مزامنة البيانات إلى Supabase بنجاح" 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: "فشل في مزامنة البيانات" 
        });
      }
    } catch (error) {
      console.error("خطأ في مزامنة البيانات إلى Supabase:", error);
      res.status(500).json({ 
        success: false, 
        message: "حدث خطأ أثناء مزامنة البيانات" 
      });
    }
  });

  // نسخ الملفات إلى Supabase
  app.post("/api/supabase/migrate-files", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      // استخدام النظام المبسط أو العادي حسب الحالة
      let results = await Promise.race([
        copyFilesToSupabase(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('timeout')), 10000)
        )
      ]).catch(async () => {
        // في حالة timeout، استخدم النظام المبسط
        console.log('🔄 استخدام النظام المبسط لنسخ الملفات...');
        return await copyFilesToSupabaseSimple();
      });
      
      await storage.createActivityLog({
        userId: req.session.userId as number,
        action: "supabase_copy_files",
        entityType: "system",
        entityId: 0,
        details: `نسخ الملفات إلى Supabase - نجح: ${results.success}, فشل: ${results.failed}`
      });
      
      res.json({ 
        success: true, 
        message: `تم نسخ الملفات - نجح: ${results.success}, فشل: ${results.failed}`,
        results
      });
    } catch (error) {
      console.error("خطأ في نقل الملفات إلى Supabase:", error);
      res.status(500).json({ 
        success: false, 
        message: "حدث خطأ أثناء نقل الملفات" 
      });
    }
  });

  // تحديث روابط الملفات لتشير إلى Supabase
  app.post("/api/supabase/update-file-urls", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const success = await updateFileUrlsToSupabase();
      
      if (success) {
        await storage.createActivityLog({
          userId: req.session.userId as number,
          action: "supabase_update_urls",
          entityType: "system",
          entityId: 0,
          details: "تم تحديث روابط الملفات لتشير إلى Supabase"
        });
        
        res.json({ 
          success: true, 
          message: "تم تحديث روابط الملفات بنجاح" 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: "فشل في تحديث روابط الملفات" 
        });
      }
    } catch (error) {
      console.error("خطأ في تحديث روابط الملفات:", error);
      res.status(500).json({ 
        success: false, 
        message: "حدث خطأ أثناء تحديث روابط الملفات" 
      });
    }
  });

  // ======== إدارة Firebase ========
  
  // فحص حالة Firebase
  app.get("/api/firebase/health", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const health = await checkFirebaseHealth();
      res.json({ 
        success: true, 
        health,
        message: `Firebase متاح: مبدئي=${health.initialized}, مصادقة=${health.auth}, تخزين=${health.storage}`
      });
    } catch (error) {
      console.error("خطأ في فحص حالة Firebase:", error);
      res.status(500).json({ 
        success: false, 
        message: "حدث خطأ أثناء فحص حالة Firebase" 
      });
    }
  });

  // تهيئة Firebase
  app.post("/api/firebase/init", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const success = await initializeFirebase();
      
      if (success) {
        await storage.createActivityLog({
          userId: req.session.userId as number,
          action: "firebase_init",
          entityType: "system",
          entityId: 0,
          details: "تم تهيئة Firebase"
        });
        
        res.json({ 
          success: true, 
          message: "تم تهيئة Firebase بنجاح" 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: "فشل في تهيئة Firebase - تحقق من متغيرات البيئة" 
        });
      }
    } catch (error) {
      console.error("خطأ في تهيئة Firebase:", error);
      res.status(500).json({ 
        success: false, 
        message: "حدث خطأ أثناء تهيئة Firebase" 
      });
    }
  });

  // ======== مدير التخزين الهجين ========
  
  // فحص حالة جميع مزودي التخزين
  app.get("/api/storage/status", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const status = await storageManager.getStorageStatus();
      res.json({ 
        success: true, 
        status,
        message: `التخزين الأساسي: ${status.preferred}, المتاح: ${status.available.join(', ')}`
      });
    } catch (error) {
      console.error("خطأ في فحص حالة التخزين:", error);
      res.status(500).json({ 
        success: false, 
        message: "حدث خطأ أثناء فحص حالة التخزين" 
      });
    }
  });

  // تغيير مزود التخزين المفضل
  app.post("/api/storage/set-preferred", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const { provider } = req.body;
      
      if (!provider || !['local', 'firebase', 'supabase'].includes(provider)) {
        return res.status(400).json({ 
          success: false, 
          message: "مزود التخزين غير صالح" 
        });
      }

      // التحقق من حالة مزود التخزين قبل التبديل
      const storageStatus = await storageManager.getStorageStatus();
      if (provider !== 'local' && !storageStatus.healthCheck[provider]) {
        return res.status(400).json({ 
          success: false, 
          message: `مزود التخزين ${provider} غير متاح حالياً` 
        });
      }

      const success = storageManager.setPreferredProvider(provider);
      
      if (!success) {
        return res.status(400).json({ 
          success: false, 
          message: "فشل في تغيير مزود التخزين" 
        });
      }

      // إعادة تقييم حالة مزودات التخزين بعد التبديل
      setTimeout(async () => {
        await storageManager.refreshProvidersStatus();
      }, 1000);
      
      await storage.createActivityLog({
        userId: req.session.userId as number,
        action: "storage_provider_change",
        entityType: "system",
        entityId: 0,
        details: `تم تغيير مزود التخزين المفضل إلى: ${provider}`
      });
      
      res.json({ 
        success: true, 
        message: `تم تغيير مزود التخزين المفضل إلى: ${provider}` 
      });
    } catch (error) {
      console.error("خطأ في تغيير مزود التخزين:", error);
      res.status(500).json({ 
        success: false, 
        message: "حدث خطأ أثناء تغيير مزود التخزين" 
      });
    }
  });

  // مزامنة ملف عبر مزودات متعددة
  app.post("/api/storage/sync-file", authenticate, authorize(["admin"]), upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          message: "لم يتم تحديد ملف" 
        });
      }

      const { targetProviders } = req.body;
      const providers = targetProviders ? JSON.parse(targetProviders) : ['local', 'firebase', 'supabase'];
      
      const results = await storageManager.syncFileAcrossProviders(
        req.file.buffer,
        req.file.originalname,
        providers,
        req.file.mimetype
      );
      
      const successfulUploads = Object.entries(results)
        .filter(([_, result]) => result.success)
        .map(([provider, _]) => provider);

      await storage.createActivityLog({
        userId: req.session.userId as number,
        action: "file_sync",
        entityType: "system",
        entityId: 0,
        details: `تمت مزامنة الملف ${req.file.originalname} عبر: ${successfulUploads.join(', ')}`
      });
      
      res.json({ 
        success: true, 
        results,
        message: `تمت مزامنة الملف عبر ${successfulUploads.length} مزود من أصل ${providers.length}` 
      });
    } catch (error) {
      console.error("خطأ في مزامنة الملف:", error);
      res.status(500).json({ 
        success: false, 
        message: "حدث خطأ أثناء مزامنة الملف" 
      });
    }
  });

  // مسارات إدارة نقل الملفات إلى التخزين السحابي
  
  // الحصول على حالة الملفات
  app.get("/api/files/status", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const status = await fileMigration.getFilesStatus();
      res.json(status);
    } catch (error) {
      console.error("خطأ في الحصول على حالة الملفات:", error);
      res.status(500).json({ message: "خطأ في الحصول على حالة الملفات" });
    }
  });

  // بدء عملية نقل الملفات
  app.post("/api/files/migrate", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      console.log("🔄 بدء عملية نقل الملفات إلى التخزين السحابي...");
      const result = await fileMigration.migrateAllFiles();
      
      // تسجيل النشاط
      await storage.createActivityLog({
        action: "migrate",
        entityType: "files",
        entityId: 0,
        details: `نقل الملفات: ${result.migratedFiles} نجح، ${result.failedFiles} فشل`,
        userId: req.session.userId as number
      });

      res.json(result);
    } catch (error) {
      console.error("خطأ في نقل الملفات:", error);
      res.status(500).json({ message: "خطأ في نقل الملفات" });
    }
  });

  // تنظيف الملفات القديمة
  app.post("/api/files/cleanup", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      console.log("🗑️ بدء تنظيف الملفات القديمة...");
      const cleanedCount = await fileMigration.cleanupOldFiles();
      
      // تسجيل النشاط
      await storage.createActivityLog({
        action: "cleanup",
        entityType: "files",
        entityId: 0,
        details: `تم حذف ${cleanedCount} ملف قديم`,
        userId: req.session.userId as number
      });

      res.json({ cleanedFiles: cleanedCount });
    } catch (error) {
      console.error("خطأ في تنظيف الملفات:", error);
      res.status(500).json({ message: "خطأ في تنظيف الملفات" });
    }
  });

  // تنظيف قاعدة البيانات من الروابط المعطلة
  app.post("/api/database/cleanup", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      console.log("🗑️ بدء تنظيف قاعدة البيانات...");
      const result = await databaseCleanup.cleanupDatabase();
      
      // تسجيل النشاط
      await storage.createActivityLog({
        action: "cleanup",
        entityType: "database",
        entityId: 0,
        details: `تنظيف قاعدة البيانات: ${result.brokenLinksRemoved} رابط معطل، ${result.validFilesFound} ملف صالح`,
        userId: req.session.userId as number
      });

      res.json(result);
    } catch (error) {
      console.error("خطأ في تنظيف قاعدة البيانات:", error);
      res.status(500).json({ message: "خطأ في تنظيف قاعدة البيانات" });
    }
  });

  // تنظيم الملفات الموجودة
  app.post("/api/files/organize", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      console.log("📁 بدء تنظيم الملفات...");
      const result = await databaseCleanup.organizeExistingFiles();
      
      // تسجيل النشاط
      await storage.createActivityLog({
        action: "organize",
        entityType: "files",
        entityId: 0,
        details: `تنظيم الملفات: ${result.organized} ملف تم تنظيمه`,
        userId: req.session.userId as number
      });

      res.json(result);
    } catch (error) {
      console.error("خطأ في تنظيم الملفات:", error);
      res.status(500).json({ message: "خطأ في تنظيم الملفات" });
    }
  });

  // الحصول على حالة النظام الشاملة
  app.get("/api/system/status", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const systemStatus = await databaseCleanup.getSystemStatus();
      res.json(systemStatus);
    } catch (error) {
      console.error("خطأ في الحصول على حالة النظام:", error);
      res.status(500).json({ message: "خطأ في الحصول على حالة النظام" });
    }
  });

  // التنظيف الشامل المبسط
  app.post("/api/migration/complete", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      console.log("🔄 بدء التنظيف الشامل المبسط...");
      const result = await simpleMigration.performCompleteMigration();
      
      // تسجيل النشاط
      await storage.createActivityLog({
        action: "migration",
        entityType: "system",
        entityId: 0,
        details: result.summary,
        userId: req.session.userId as number
      });

      res.json(result);
    } catch (error) {
      console.error("خطأ في التنظيف الشامل:", error);
      res.status(500).json({ message: "خطأ في التنظيف الشامل" });
    }
  });

  // حالة النظام المبسطة
  app.get("/api/migration/status", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const status = await simpleMigration.getSimpleStatus();
      res.json(status);
    } catch (error) {
      console.error("خطأ في الحصول على حالة التنظيف:", error);
      res.status(500).json({ message: "خطأ في الحصول على حالة التنظيف" });
    }
  });

  // ======== WhatsApp Integration ========
  
  // webhook للتحقق من WhatsApp
  app.get("/api/whatsapp/webhook", async (req: Request, res: Response) => {
    try {
      const { whatsappHandler } = await import('./whatsapp-handler');
      await whatsappHandler.verifyWebhook(req, res);
    } catch (error) {
      console.error('خطأ في التحقق من WhatsApp webhook:', error);
      res.sendStatus(500);
    }
  });

  // استقبال رسائل WhatsApp
  app.post("/api/whatsapp/webhook", async (req: Request, res: Response) => {
    try {
      const { whatsappHandler } = await import('./whatsapp-handler');
      await whatsappHandler.handleIncomingMessage(req, res);
    } catch (error) {
      console.error('خطأ في معالجة رسالة WhatsApp:', error);
      res.sendStatus(500);
    }
  });

  // اختبار اتصال WhatsApp
  app.post("/api/whatsapp/test", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const { accessToken, phoneNumberId } = req.body;
      
      if (!accessToken || !phoneNumberId) {
        return res.status(400).json({
          success: false,
          message: 'يرجى إدخال Access Token و Phone Number ID'
        });
      }

      // اختبار الاتصال مع WhatsApp API
      const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        res.json({
          success: true,
          message: 'تم الاتصال بنجاح',
          data
        });
      } else {
        const error = await response.text();
        res.status(400).json({
          success: false,
          message: 'فشل في الاتصال مع WhatsApp API',
          error
        });
      }
    } catch (error) {
      console.error('خطأ في اختبار WhatsApp:', error);
      res.status(500).json({
        success: false,
        message: 'خطأ في اختبار الاتصال'
      });
    }
  });

  // ======== تصدير Excel ========
  
  // تصدير المعاملات إلى Excel/CSV
  app.post("/api/transactions/export/excel", authenticate, async (req: Request, res: Response) => {
    try {
      const { simpleExcelExporter } = await import('./simple-excel-export');
      const userId = req.session?.userId;
      const userRole = req.session?.role;
      
      const filters = {
        projectId: req.body.projectId ? parseInt(req.body.projectId) : undefined,
        type: req.body.type || undefined,
        dateFrom: req.body.dateFrom || undefined,
        dateTo: req.body.dateTo || undefined,
        userId,
        userRole
      };
      
      console.log('تصدير CSV مع الفلاتر:', filters);
      
      const filePath = await simpleExcelExporter.exportTransactionsAsCSV(filters);
      
      res.json({
        success: true,
        filePath,
        message: 'تم تصدير البيانات بنجاح كملف CSV (يفتح في Excel)'
      });
    } catch (error) {
      console.error('خطأ في تصدير CSV:', error);
      res.status(500).json({
        success: false,
        message: 'فشل في تصدير البيانات'
      });
    }
  });

  // ======== إدارة الموظفين ========
  
  // جلب جميع الموظفين (للمديرين فقط في صفحة إدارة الموظفين)
  app.get("/api/employees/admin", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const sql = neon(process.env.DATABASE_URL!);
      
      // جلب الموظفين مع معلومات المشروع
      const result = await sql(`
        SELECT e.*, p.name as project_name 
        FROM employees e 
        LEFT JOIN projects p ON e.assigned_project_id = p.id 
        ORDER BY e.created_at DESC
      `);
      
      // حساب المبلغ المسحوب من راتب كل موظف في الشهر الحالي
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      
      const employees = await Promise.all(result.map(async (row) => {
        // حساب إجمالي المبلغ المسحوب من راتب الموظف في الشهر الحالي
        const salaryWithdrawals = await sql(`
          SELECT COALESCE(SUM(amount), 0) as total_withdrawn
          FROM transactions 
          WHERE employee_id = $1 
          AND expense_type = 'راتب'
          AND type = 'expense'
          AND EXTRACT(MONTH FROM date) = $2 
          AND EXTRACT(YEAR FROM date) = $3
        `, [row.id, currentMonth, currentYear]);
        
        const totalWithdrawn = parseInt(salaryWithdrawals[0].total_withdrawn) || 0;
        const remainingSalary = row.salary - totalWithdrawn;
        
        return {
          id: row.id,
          name: row.name,
          salary: row.salary,
          totalWithdrawn,
          remainingSalary,
          assignedProjectId: row.assigned_project_id,
          assignedProject: row.project_name ? { id: row.assigned_project_id, name: row.project_name } : null,
          active: row.active,
          hireDate: row.hire_date,
          notes: row.notes,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
      }));
      
      res.json(employees);
    } catch (error) {
      console.error("خطأ في جلب الموظفين:", error);
      res.status(500).json({ message: "خطأ في جلب الموظفين" });
    }
  });

  // تعديل endpoint الموظفين الرئيسي ليشمل معلومات المشروع للمديرين
  app.get("/api/employees", authenticate, async (req: Request, res: Response) => {
    try {
      const userRole = (req as any).user?.role;
      console.log(`محاولة جلب الموظفين - دور المستخدم: ${userRole}`);
      
      if (userRole === 'admin') {
        const employees = await storage.getEmployees();
        console.log(`تم جلب ${employees.length} موظف للمدير`);
        res.json(employees);
      } else {
        console.log(`المستخدم ليس مدير - الدور: ${userRole}`);
        // المستخدم العادي يحصل على قائمة فارغة لأنه يجب أن يختار مشروع أولاً
        res.json([]);
      }
    } catch (error) {
      console.error("خطأ في جلب الموظفين:", error);
      res.status(500).json({ message: "خطأ في جلب الموظفين" });
    }
  });

  // جلب الموظفين حسب المشروع (للمرجعية فقط)
  app.get("/api/employees/by-project/:projectId", authenticate, async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const sql = neon(process.env.DATABASE_URL!);
      
      const result = await sql(`
        SELECT e.*, p.name as project_name 
        FROM employees e 
        LEFT JOIN projects p ON e.assigned_project_id = p.id 
        WHERE e.assigned_project_id = $1 AND e.active = true
        ORDER BY e.name ASC
      `, [parseInt(projectId)]);
      
      // حساب المبلغ المسحوب من راتب كل موظف في الشهر الحالي
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      
      const employees = await Promise.all(result.map(async (row) => {
        // حساب إجمالي المبلغ المسحوب من راتب الموظف في الشهر الحالي
        const salaryWithdrawals = await sql(`
          SELECT COALESCE(SUM(amount), 0) as total_withdrawn
          FROM transactions 
          WHERE employee_id = $1 
          AND expense_type = 'راتب'
          AND type = 'expense'
          AND EXTRACT(MONTH FROM date) = $2 
          AND EXTRACT(YEAR FROM date) = $3
        `, [row.id, currentMonth, currentYear]);
        
        const totalWithdrawn = parseInt(salaryWithdrawals[0].total_withdrawn) || 0;
        const remainingSalary = row.salary - totalWithdrawn;
        
        return {
          id: row.id,
          name: row.name,
          salary: row.salary,
          totalWithdrawn,
          remainingSalary,
          assignedProjectId: row.assigned_project_id,
          assignedProject: row.project_name ? { id: row.assigned_project_id, name: row.project_name } : null,
          active: row.active,
          hireDate: row.hire_date,
          notes: row.notes,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
      }));
      
      res.json(employees);
    } catch (error) {
      console.error("خطأ في جلب موظفي المشروع:", error);
      res.status(500).json({ message: "خطأ في جلب موظفي المشروع" });
    }
  });

  // إنشاء موظف جديد
  app.post("/api/employees", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const { name, salary, assignedProjectId, notes } = req.body;
      
      if (!name || name.trim() === '') {
        return res.status(400).json({ message: "اسم الموظف مطلوب" });
      }
      
      const employee = await storage.createEmployee({
        name: name.trim(),
        salary: salary || 0,
        assignedProjectId: assignedProjectId || null,
        notes: notes || null,
        active: true
      });
      
      // تسجيل النشاط
      await storage.createActivityLog({
        action: "create",
        entityType: "employee",
        entityId: employee.id,
        details: `تم إنشاء موظف جديد: ${employee.name}`,
        userId: req.session.userId as number
      });
      
      res.status(201).json(employee);
    } catch (error) {
      console.error("خطأ في إنشاء الموظف:", error);
      res.status(500).json({ message: "خطأ في إنشاء الموظف" });
    }
  });

  // تحديث موظف
  app.put("/api/employees/:id", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const employeeId = parseInt(req.params.id);
      const { name, salary, assignedProjectId, active, notes } = req.body;
      
      if (!name || name.trim() === '') {
        return res.status(400).json({ message: "اسم الموظف مطلوب" });
      }
      
      const sql = neon(process.env.DATABASE_URL!);
      const result = await sql(`
        UPDATE employees 
        SET name = $1, salary = $2, assigned_project_id = $3, active = $4, notes = $5, updated_at = NOW()
        WHERE id = $6
        RETURNING *
      `, [name, salary || 0, assignedProjectId || null, active !== false, notes || null, employeeId]);
      
      if (result.length === 0) {
        return res.status(404).json({ message: "الموظف غير موجود" });
      }
      
      const employee = result[0];
      
      // تسجيل النشاط
      await storage.createActivityLog({
        action: "update",
        entityType: "employee",
        entityId: employee.id,
        details: `تم تحديث بيانات الموظف: ${employee.name}`,
        userId: req.session.userId as number
      });
      
      res.json(employee);
    } catch (error) {
      console.error("خطأ في تحديث الموظف:", error);
      res.status(500).json({ message: "خطأ في تحديث الموظف" });
    }
  });

  // حذف موظف
  app.delete("/api/employees/:id", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const employeeId = parseInt(req.params.id);
      
      // الحصول على بيانات الموظف قبل الحذف
      const sql = neon(process.env.DATABASE_URL!);
      const employeeResult = await sql(`SELECT * FROM employees WHERE id = $1`, [employeeId]);
      
      if (employeeResult.length === 0) {
        return res.status(404).json({ message: "الموظف غير موجود" });
      }
      
      const employee = employeeResult[0];
      
      // حذف الموظف
      await sql(`DELETE FROM employees WHERE id = $1`, [employeeId]);
      
      // تسجيل النشاط
      await storage.createActivityLog({
        action: "delete",
        entityType: "employee",
        entityId: employeeId,
        details: `تم حذف الموظف: ${employee.name}`,
        userId: req.session.userId as number
      });
      
      res.json({ message: "تم حذف الموظف بنجاح" });
    } catch (error) {
      console.error("خطأ في حذف الموظف:", error);
      res.status(500).json({ message: "خطأ في حذف الموظف" });
    }
  });

  // ======== استعادة المرفقات المفقودة ========
  
  // فحص حالة المرفقات
  app.get("/api/attachments/status", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const { attachmentRecovery } = await import("./attachment-recovery");
      const status = await attachmentRecovery.getAttachmentsStatus();
      res.json(status);
    } catch (error) {
      console.error("خطأ في فحص حالة المرفقات:", error);
      res.status(500).json({ message: "خطأ في فحص حالة المرفقات" });
    }
  });

  // إصلاح ربط المرفقات المنفصلة
  app.post("/api/attachments/recover", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      console.log("🔄 بدء عملية إصلاح المرفقات المنفصلة...");
      const { attachmentFixer } = await import("./fix-attachments");
      const result = await attachmentFixer.fixOrphanedAttachments();
      
      await storage.createActivityLog({
        action: "attachments_fixed",
        entityType: "system",
        entityId: 0,
        details: `إصلاح المرفقات: ${result.linked} ملف مربوط، ${result.orphanedFiles} ملف منفصل`,
        userId: req.session.userId as number
      });

      res.json(result);
    } catch (error) {
      console.error("خطأ في إصلاح المرفقات:", error);
      res.status(500).json({ message: "خطأ في إصلاح المرفقات" });
    }
  });

  // حذف مرفق من معاملة (للمدير فقط)
  app.delete("/api/transactions/:id/attachment", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const transactionId = parseInt(req.params.id);
      
      // التحقق من وجود المعاملة
      const transaction = await storage.getTransaction(transactionId);
      if (!transaction) {
        return res.status(404).json({ message: "المعاملة غير موجودة" });
      }

      if (!transaction.fileUrl) {
        return res.status(400).json({ message: "لا يوجد مرفق لحذفه" });
      }

      // حذف الملف من النظام
      const { deleteFile } = await import("./firebase-utils");
      const fileDeleted = await deleteFile(transaction.fileUrl);
      
      if (fileDeleted) {
        console.log(`✅ تم حذف الملف: ${transaction.fileUrl}`);
      } else {
        console.log(`⚠️ فشل في حذف الملف من التخزين: ${transaction.fileUrl}`);
      }

      // إزالة رابط المرفق من قاعدة البيانات
      const updatedTransaction = await storage.updateTransaction(transactionId, {
        fileUrl: null,
        fileType: null
      });

      if (!updatedTransaction) {
        return res.status(500).json({ message: "فشل في تحديث المعاملة" });
      }

      // تسجيل العملية
      await storage.createActivityLog({
        action: "attachment_deleted",
        entityType: "transaction",
        entityId: transactionId,
        details: `تم حذف المرفق: ${transaction.fileUrl}`,
        userId: req.session.userId as number
      });

      res.json({ 
        success: true, 
        message: "تم حذف المرفق بنجاح",
        transaction: updatedTransaction
      });

    } catch (error) {
      console.error("خطأ في حذف المرفق:", error);
      res.status(500).json({ message: "خطأ في حذف المرفق" });
    }
  });

  // ======== رفع البيانات إلى Supabase ========
  
  // فحص حالة المزامنة مع Supabase
  app.get("/api/supabase/sync-status", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const { supabaseMigration } = await import("./supabase-migration");
      const status = await supabaseMigration.getSyncStatus();
      res.json(status);
    } catch (error) {
      console.error("خطأ في فحص حالة المزامنة:", error);
      res.status(500).json({ message: "خطأ في فحص حالة المزامنة" });
    }
  });

  // إنشاء نسخة احتياطية JSON للبيانات
  app.post("/api/supabase/migrate", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      console.log("🔄 بدء إنشاء نسخة احتياطية JSON...");
      const { jsonBackup } = await import("./backup-to-json");
      const result = await jsonBackup.createFullBackup();
      
      await storage.createActivityLog({
        action: "json_backup_created",
        entityType: "system",
        entityId: 0,
        details: `إنشاء نسخة احتياطية JSON: ${result.totalRecords} سجل في ${result.files.length} ملف`,
        userId: req.session.userId as number
      });

      res.json(result);
    } catch (error) {
      console.error("خطأ في إنشاء النسخة الاحتياطية:", error);
      res.status(500).json({ message: "خطأ في إنشاء النسخة الاحتياطية" });
    }
  });

  // تقدم عملية الرفع
  app.get("/api/supabase/migrate/progress", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const { localToSupabaseSync } = await import("./local-to-supabase-sync");
      const progress = localToSupabaseSync.getProgress();
      res.json(progress);
    } catch (error) {
      console.error("خطأ في فحص التقدم:", error);
      res.status(500).json({ message: "خطأ في فحص تقدم الرفع" });
    }
  });

  // ======== إدارة كلمات المرور ========
  
  // إعادة تعيين كلمة مرور مستخدم
  app.post("/api/users/:id/reset-password", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      const { newPassword } = req.body;
      
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" });
      }
      
      const { passwordResetTool } = await import("./password-reset-tool");
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "المستخدم غير موجود" });
      }
      
      const success = await passwordResetTool.resetUserPassword(user.username, newPassword);
      
      if (success) {
        await storage.createActivityLog({
          action: "password_reset",
          entityType: "user",
          entityId: userId,
          details: `إعادة تعيين كلمة مرور المستخدم: ${user.username}`,
          userId: req.session.userId as number
        });
        
        res.json({ message: "تم إعادة تعيين كلمة المرور بنجاح" });
      } else {
        res.status(500).json({ message: "فشل في إعادة تعيين كلمة المرور" });
      }
    } catch (error) {
      console.error("خطأ في إعادة تعيين كلمة المرور:", error);
      res.status(500).json({ message: "خطأ في إعادة تعيين كلمة المرور" });
    }
  });

  // ======== APIs لإدارة ربط المستندات بالعمليات المالية ========
  
  // جلب المستندات غير المربوطة (متاحة للربط)
  app.get("/api/documents/unlinked", authenticate, async (req: Request, res: Response) => {
    try {
      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(process.env.DATABASE_URL!);
      const result = await sql(`
        SELECT d.*, u.name as uploaded_by_name
        FROM documents d
        LEFT JOIN users u ON d.uploaded_by = u.id
        WHERE d.id NOT IN (
          SELECT DISTINCT document_id FROM document_transaction_links
        )
        AND d.category IN ('receipt', 'invoice', 'contract', 'general')
        ORDER BY d.upload_date DESC
      `);
      
      res.json(result);
    } catch (error) {
      console.error("خطأ في جلب المستندات غير المربوطة:", error);
      res.status(500).json({ message: "خطأ في جلب المستندات غير المربوطة" });
    }
  });

  // جلب العمليات المالية المتاحة للربط
  app.get("/api/transactions/linkable", authenticate, async (req: Request, res: Response) => {
    try {
      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(process.env.DATABASE_URL!);
      const result = await sql(`
        SELECT t.*, p.name as project_name, u.name as created_by_name,
        CASE 
          WHEN EXISTS (SELECT 1 FROM document_transaction_links dtl WHERE dtl.transaction_id = t.id) 
          THEN true 
          ELSE false 
        END as has_linked_documents
        FROM transactions t
        LEFT JOIN projects p ON t.project_id = p.id
        LEFT JOIN users u ON t.created_by = u.id
        WHERE t.archived = false
        ORDER BY t.date DESC
        LIMIT 100
      `);
      
      res.json(result);
    } catch (error) {
      console.error("خطأ في جلب العمليات المالية:", error);
      res.status(500).json({ message: "خطأ في جلب العمليات المالية" });
    }
  });

  // ربط مستند بعملية مالية
  app.post("/api/documents/:documentId/link-transaction", authenticate, async (req: Request, res: Response) => {
    try {
      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(process.env.DATABASE_URL!);
      const { documentId } = req.params;
      const { transactionId, linkType, notes } = req.body;
      const userId = (req as any).user.id;

      // التحقق من وجود المستند والعملية المالية
      const documentCheck = await sql(`SELECT id FROM documents WHERE id = $1`, [parseInt(documentId)]);
      const transactionCheck = await sql(`SELECT id FROM transactions WHERE id = $1`, [parseInt(transactionId)]);
      
      if (documentCheck.length === 0) {
        return res.status(404).json({ message: "المستند غير موجود" });
      }
      
      if (transactionCheck.length === 0) {
        return res.status(404).json({ message: "العملية المالية غير موجودة" });
      }

      // التحقق من عدم وجود ربط مسبق
      const existingLink = await sql(`
        SELECT id FROM document_transaction_links 
        WHERE document_id = $1 AND transaction_id = $2
      `, [parseInt(documentId), parseInt(transactionId)]);
      
      if (existingLink.length > 0) {
        return res.status(400).json({ message: "الربط موجود مسبقاً" });
      }

      // إنشاء الربط
      const result = await sql(`
        INSERT INTO document_transaction_links 
        (document_id, transaction_id, link_type, linked_by, notes)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [parseInt(documentId), parseInt(transactionId), linkType || 'receipt', userId, notes || null]);

      // تسجيل النشاط
      await sql(`
        INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        userId,
        "link_document_transaction",
        "document_transaction_link",
        result[0].id,
        JSON.stringify({
          documentId: parseInt(documentId),
          transactionId: parseInt(transactionId),
          linkType: linkType || 'receipt'
        })
      ]);

      res.json(result[0]);
    } catch (error) {
      console.error("خطأ في ربط المستند بالعملية المالية:", error);
      res.status(500).json({ message: "خطأ في ربط المستند بالعملية المالية" });
    }
  });

  // إلغاء ربط مستند من عملية مالية
  app.delete("/api/documents/:documentId/unlink-transaction/:transactionId", authenticate, async (req: Request, res: Response) => {
    try {
      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(process.env.DATABASE_URL!);
      const { documentId, transactionId } = req.params;
      const userId = (req as any).user.id;

      const result = await sql(`
        DELETE FROM document_transaction_links 
        WHERE document_id = $1 AND transaction_id = $2
        RETURNING *
      `, [parseInt(documentId), parseInt(transactionId)]);

      if (result.length === 0) {
        return res.status(404).json({ message: "الربط غير موجود" });
      }

      // تسجيل النشاط
      await sql(`
        INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        userId,
        "unlink_document_transaction",
        "document_transaction_link",
        result[0].id,
        JSON.stringify({
          documentId: parseInt(documentId),
          transactionId: parseInt(transactionId)
        })
      ]);

      res.json({ message: "تم إلغاء الربط بنجاح" });
    } catch (error) {
      console.error("خطأ في إلغاء ربط المستند:", error);
      res.status(500).json({ message: "خطأ في إلغاء ربط المستند" });
    }
  });

  // جلب المستندات المربوطة بعملية مالية معينة
  app.get("/api/transactions/:transactionId/linked-documents", authenticate, async (req: Request, res: Response) => {
    try {
      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(process.env.DATABASE_URL!);
      const { transactionId } = req.params;
      
      const result = await sql(`
        SELECT d.*, dtl.link_type, dtl.notes as link_notes, dtl.linked_at,
               u.name as linked_by_name, up.name as uploaded_by_name
        FROM document_transaction_links dtl
        JOIN documents d ON dtl.document_id = d.id
        LEFT JOIN users u ON dtl.linked_by = u.id
        LEFT JOIN users up ON d.uploaded_by = up.id
        WHERE dtl.transaction_id = $1
        ORDER BY dtl.linked_at DESC
      `, [parseInt(transactionId)]);
      
      res.json(result);
    } catch (error) {
      console.error("خطأ في جلب المستندات المربوطة:", error);
      res.status(500).json({ message: "خطأ في جلب المستندات المربوطة" });
    }
  });

  // جلب العمليات المالية المربوطة بمستند معين
  app.get("/api/documents/:documentId/linked-transactions", authenticate, async (req: Request, res: Response) => {
    try {
      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(process.env.DATABASE_URL!);
      const { documentId } = req.params;
      
      const result = await sql(`
        SELECT t.*, dtl.link_type, dtl.notes as link_notes, dtl.linked_at,
               u.name as linked_by_name, tc.name as created_by_name, p.name as project_name
        FROM document_transaction_links dtl
        JOIN transactions t ON dtl.transaction_id = t.id
        LEFT JOIN users u ON dtl.linked_by = u.id
        LEFT JOIN users tc ON t.created_by = tc.id
        LEFT JOIN projects p ON t.project_id = p.id
        WHERE dtl.document_id = $1
        ORDER BY dtl.linked_at DESC
      `, [parseInt(documentId)]);
      
      res.json(result);
    } catch (error) {
      console.error("خطأ في جلب العمليات المالية المربوطة:", error);
      res.status(500).json({ message: "خطأ في جلب العمليات المالية المربوطة" });
    }
  });

  // تحديث تصنيف المستند
  app.patch("/api/documents/:documentId/category", authenticate, async (req: Request, res: Response) => {
    try {
      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(process.env.DATABASE_URL!);
      const { documentId } = req.params;
      const { category, tags } = req.body;
      
      const result = await sql(`
        UPDATE documents 
        SET category = $1, tags = $2
        WHERE id = $3
        RETURNING *
      `, [category, JSON.stringify(tags || []), parseInt(documentId)]);
      
      if (result.length === 0) {
        return res.status(404).json({ message: "المستند غير موجود" });
      }
      
      res.json(result[0]);
    } catch (error) {
      console.error("خطأ في تحديث تصنيف المستند:", error);
      res.status(500).json({ message: "خطأ في تحديث تصنيف المستند" });
    }
  });

  // تهيئة Supabase تلقائياً عند بدء الخادم
  try {
    console.log('🔄 محاولة تهيئة Supabase...');
    const supabaseInitialized = await initializeSupabaseSimple();
    if (supabaseInitialized) {
      console.log('✅ تم تهيئة Supabase بنجاح');
    } else {
      console.log('⚠️ فشل في تهيئة Supabase - سيتم استخدام التخزين المحلي');
    }
  } catch (error) {
    console.log('⚠️ خطأ في تهيئة Supabase:', error);
  }

  // Completed Works routes - Manager only section
  app.get('/api/completed-works', authenticate, authorize(['admin', 'manager']), async (req: Request, res: Response) => {
    try {
      const works = await storage.listCompletedWorks();
      res.json(works);
    } catch (error) {
      console.error('Error fetching completed works:', error);
      res.status(500).json({ message: 'خطأ في استرجاع الأعمال المنجزة' });
    }
  });

  app.post('/api/completed-works', authenticate, authorize(['admin', 'manager']), upload.single('file'), async (req: Request, res: Response) => {
    try {
      const { title, description, amount, date, category } = req.body;
      
      let fileUrl = null;
      let fileType = null;
      
      if (req.file) {
        fileUrl = await localUpload(
          req.file.path,
          `completed-works/${Date.now()}-${req.file.originalname}`,
          req.file.mimetype,
          { source: 'completed_works', userId: req.session.userId?.toString() || '' }
        );
        fileType = req.file.mimetype;
      }

      const workData = {
        title,
        description: description || null,
        amount: amount ? parseInt(amount) : null,
        date: new Date(date),
        category: category || null,
        fileUrl,
        fileType,
        createdBy: req.session.userId as number
      };

      const work = await storage.createCompletedWork(workData);
      res.status(201).json(work);
    } catch (error) {
      console.error('Error creating completed work:', error);
      res.status(500).json({ message: 'خطأ في إنشاء العمل المنجز' });
    }
  });

  app.put('/api/completed-works/:id', authenticate, authorize(['admin', 'manager']), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const work = await storage.updateCompletedWork(parseInt(id), updates);
      if (!work) {
        return res.status(404).json({ message: 'العمل المنجز غير موجود' });
      }
      
      res.json(work);
    } catch (error) {
      console.error('Error updating completed work:', error);
      res.status(500).json({ message: 'خطأ في تحديث العمل المنجز' });
    }
  });

  app.delete('/api/completed-works/:id', authenticate, authorize(['admin', 'manager']), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteCompletedWork(parseInt(id));
      
      if (!success) {
        return res.status(404).json({ message: 'العمل المنجز غير موجود' });
      }
      
      res.json({ message: 'تم حذف العمل المنجز بنجاح' });
    } catch (error) {
      console.error('Error deleting completed work:', error);
      res.status(500).json({ message: 'خطأ في حذف العمل المنجز' });
    }
  });

  // Completed Works Documents routes
  app.get('/api/completed-works-documents', authenticate, authorize(['admin', 'manager']), async (req: Request, res: Response) => {
    try {
      const documents = await storage.listCompletedWorksDocuments();
      res.json(documents);
    } catch (error) {
      console.error('Error fetching completed works documents:', error);
      res.status(500).json({ message: 'خطأ في استرجاع مستندات الأعمال المنجزة' });
    }
  });

  app.post('/api/completed-works-documents', authenticate, authorize(['admin', 'manager']), upload.single('file'), async (req: Request, res: Response) => {
    try {
      const { title, description, category, tags } = req.body;
      
      if (!req.file) {
        return res.status(400).json({ message: 'الملف مطلوب' });
      }

      const fileUrl = await localUpload(
        req.file.path,
        `completed-works-docs/${Date.now()}-${req.file.originalname}`,
        req.file.mimetype,
        { source: 'completed_works_documents', userId: req.session.userId?.toString() || '' }
      );

      const documentData = {
        title,
        description: description || null,
        fileUrl,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        category: category || null,
        tags: tags || null,
        createdBy: req.session.userId as number
      };

      const document = await storage.createCompletedWorksDocument(documentData);
      res.status(201).json(document);
    } catch (error) {
      console.error('Error creating completed works document:', error);
      res.status(500).json({ message: 'خطأ في إنشاء مستند الأعمال المنجزة' });
    }
  });

  app.delete('/api/completed-works-documents/:id', authenticate, authorize(['admin', 'manager']), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteCompletedWorksDocument(parseInt(id));
      
      if (!success) {
        return res.status(404).json({ message: 'المستند غير موجود' });
      }
      
      res.json({ message: 'تم حذف المستند بنجاح' });
    } catch (error) {
      console.error('Error deleting completed works document:', error);
      res.status(500).json({ message: 'خطأ في حذف المستند' });
    }
  });

  // إصلاح الملفات المفقودة
  app.post("/api/system/fix-missing-files", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      console.log("🔧 بدء إصلاح الملفات المفقودة...");
      const result = await missingFilesFixer.fixMissingFiles();
      
      // تسجيل النشاط
      await storage.createActivityLog({
        action: "fix_files",
        entityType: "system",
        entityId: 0,
        details: `إصلاح الملفات المفقودة: ${result.fixedTransactions} معاملة و ${result.fixedDocuments} مستند`,
        userId: req.session.userId as number
      });

      res.json(result);
    } catch (error) {
      console.error("خطأ في إصلاح الملفات المفقودة:", error);
      res.status(500).json({ message: "خطأ في إصلاح الملفات المفقودة" });
    }
  });

  // تقرير الملفات المفقودة
  app.get("/api/system/missing-files-report", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const report = await missingFilesFixer.generateMissingFilesReport();
      res.json(report);
    } catch (error) {
      console.error("خطأ في إنشاء تقرير الملفات المفقودة:", error);
      res.status(500).json({ message: "خطأ في إنشاء تقرير الملفات المفقودة" });
    }
  });

  return httpServer;
}