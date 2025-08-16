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
} from "../shared/schema";
import { z } from "zod";
import bcrypt from "bcryptjs";
import MemoryStore from "memorystore";
import connectPgSimple from "connect-pg-simple";
import { db } from "./db";
import { neon } from '@neondatabase/serverless';
import { eq, and } from "drizzle-orm";
import path from "path";
import fs from "fs";
import { dirname } from 'path';
import { 
  initializeSupabaseStorage, 
  uploadToSupabase, 
  uploadFromLocalFile, 
  syncAllLocalFiles,
  checkSupabaseStorageHealth,
  isSupabaseInitialized 
} from './supabase-storage';
import { 
  createPreMigrationBackup, 
  verifyCurrentData, 
  safeMigrateToCloud, 
  restoreFromBackup 
} from './migration-helper';

// عند تجميع الوظائف كـ CJS في Netlify، قد لا يتوفر import.meta
// نستخدم process.cwd() كجذر للتعامل مع مسارات uploads الثابتة
const __dirname = process.cwd();

import { documentUpload } from './multer-config';

async function registerRoutes(app: Express): Promise<Server> {
  const MemoryStoreSession = MemoryStore(session);
  
  // تهيئة الجلسات: استخدم Postgres Store في Netlify/Production، وMemoryStore في التطوير
  const isNetlify = !!process.env.NETLIFY || !!process.env.NETLIFY_LOCAL;
  const isProduction = process.env.NODE_ENV === 'production' || isNetlify;

  let sessionStore: any;
  if (isProduction && process.env.DATABASE_URL) {
    try {
      const PgSession = connectPgSimple(session);
      sessionStore = new PgSession({
        conObject: {
          connectionString: process.env.DATABASE_URL,
          ssl: { rejectUnauthorized: false }
        },
        tableName: 'session',
        createTableIfMissing: true,
        pruneSessionInterval: 60 * 60 // تنظيف كل ساعة
      });
      console.log('استخدام PostgresStore للجلسات');
    } catch (e) {
      console.warn('تعذر استخدام PostgresStore، الرجوع إلى MemoryStore:', e);
      sessionStore = new MemoryStoreSession({
        checkPeriod: 86400000,
        max: 5000,
        ttl: 24 * 60 * 60 * 1000,
      });
    }
  } else {
    sessionStore = new MemoryStoreSession({
      checkPeriod: 86400000, // فحص كل 24 ساعة
      max: 5000, // حد أقصى أعلى للجلسات
      ttl: 24 * 60 * 60 * 1000, // 24 ساعة
    });
    console.log("استخدام Memory Store للجلسات (وضع التطوير)");
  }

  app.use(session({
    secret: process.env.SESSION_SECRET || "accounting-app-secret-key-2025",
    resave: false,
    saveUninitialized: false,
    cookie: { 
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction, // آمن في الإنتاج/Netlify
      path: '/'
    },
    store: sessionStore,
    name: 'accounting.sid'
  }));
  
  // middleware للجلسة
  app.use((req, res, next) => {
    next();
  });

  // Health endpoint (outside auth) to confirm function is alive
  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({ ok: true, ts: Date.now() });
  });

  // Authentication middleware
  const authenticate = (req: Request, res: Response, next: Function) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: "غير مصرح" });
    }

    req.session.lastActivity = new Date().toISOString();
    
    (req as any).user = {
      id: req.session.userId,
      username: req.session.username,
      role: req.session.role
    };
    
    next();
  };

  // Admin endpoint: setup/migrate database and seed admin if needed
  app.post('/api/admin/db/setup', async (req: Request, res: Response) => {
    try {
      // Require admin session in production; allow in dev without
      const isProd = process.env.NODE_ENV === 'production' || !!process.env.NETLIFY;
      if (isProd) {
        if (!req.session || !req.session.userId || req.session.role !== 'admin') {
          return res.status(403).json({ message: 'غير مصرح' });
        }
      }
      const { setupDatabase } = await import('./db-setup');
      const ok = await setupDatabase();
      if (ok) return res.json({ success: true });
      return res.status(500).json({ success: false, message: 'فشل إعداد قاعدة البيانات' });
    } catch (err: any) {
      console.error('DB setup error:', err);
      return res.status(500).json({ success: false, message: err?.message || 'DB setup error' });
    }
  });

  // مسار لعرض الملفات المحفوظة محلياً
  app.get("/uploads/*", (req: Request, res: Response) => {
    const filePath = req.params[0];
    const fullPath = path.join(__dirname, '../uploads', filePath);
    
    const uploadsDir = path.resolve(__dirname, '../uploads');
    const requestedPath = path.resolve(fullPath);
    
    if (!requestedPath.startsWith(uploadsDir)) {
      return res.status(403).json({ message: "مسار غير مسموح" });
    }
    
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

  // Test POST route
  app.post("/api/test", (req: Request, res: Response) => {
    return res.status(200).json({ message: "POST test successful", body: req.body });
  });

  // Authentication routes
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const credentials = loginSchema.parse(req.body);
      const user = await storage.getUserByUsername(credentials.username);
      
      if (!user) {
        return res.status(401).json({ message: "معلومات تسجيل الدخول غير صحيحة" });
      }
      
      const isPasswordValid = await storage.validatePassword(user.password, credentials.password);
      
      if (!isPasswordValid) {
        return res.status(401).json({ message: "معلومات تسجيل الدخول غير صحيحة" });
      }
      
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;
      req.session.lastActivity = new Date().toISOString();
      
      req.session.save((err) => {
        if (err) {
          console.error('Error saving session:', err);
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

  // Supabase Auth login handshake: verify access token and establish session
  app.post('/api/auth/supabase-login', async (req: Request, res: Response) => {
    try {
      const { token } = req.body as { token?: string };
      if (!token) return res.status(400).json({ message: 'token required' });

      // Verify the JWT by calling Supabase Auth admin endpoint using service role key
      const SUPABASE_URL = process.env.SUPABASE_URL;
      const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('Supabase env missing on server. Skipping supabase-login.');
  return res.status(500).json({ message: 'supabase not configured' });
      }

      // Minimal verification by introspection endpoint
      const verifyUrl = `${SUPABASE_URL}/auth/v1/user`;
  const verifyResp = await fetch(verifyUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: SUPABASE_SERVICE_ROLE_KEY,
        },
      } as any);

      if (!verifyResp.ok) {
        const txt = await verifyResp.text();
        return res.status(401).json({ message: 'invalid token', details: txt });
      }

      const supaUser = await verifyResp.json();

      // Find or provision local user
      let user = await storage.getUserByEmail(supaUser.email);
      if (!user) {
        user = await storage.createUser({
          username: supaUser.email,
          password: 'supabase-oauth',
          name: supaUser.user_metadata?.full_name || supaUser.email,
          email: supaUser.email,
          role: 'user',
          permissions: [],
        } as any);
      }

      // Establish session
      (req.session as any).userId = user.id;
      (req.session as any).role = user.role;
      (req.session as any).permissions = user.permissions || [];

      await new Promise((resolve, reject) => req.session.save(err => err ? reject(err) : resolve(null)));

      res.json({
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions || [],
      });
    } catch (err) {
      console.error('supabase-login failed', err);
      res.status(500).json({ message: 'supabase-login failed' });
    }
  });

  // Users routes
  app.get("/api/users", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const users = await storage.listUsers();
      
      // المديرون يمكنهم رؤية كلمات المرور الأصلية
      const currentUser = await storage.getUser(req.session.userId as number);
      if (currentUser?.role === 'admin') {
        // إرسال البيانات مع كلمة المرور الأصلية بدلاً من المشفرة
        const usersWithPlainPassword = users.map(user => {
          const plainPassword = (user as any).plain_password;
          return {
            ...user,
            password: plainPassword || 'غير متاحة'
          };
        });
        return res.status(200).json(usersWithPlainPassword);
      }
      
      // للأدوار الأخرى، إزالة كلمة المرور
      const safeUsers = users.map(user => {
        const { password, ...safeUser } = user;
        return safeUser;
      });
      
      return res.status(200).json(safeUsers);
    } catch (error) {
      return res.status(500).json({ message: "خطأ في استرجاع المستخدمين" });
    }
  });

  // Delete user endpoint
  app.delete("/api/users/:id", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "معرف المستخدم غير صحيح" });
      }

      // التحقق من عدم حذف المدير الرئيسي
      if (id === 1) {
        return res.status(400).json({ message: "لا يمكن حذف المدير الرئيسي" });
      }

      // التحقق من وجود المستخدم
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ message: "المستخدم غير موجود" });
      }

      // حذف المستخدم مع جميع البيانات المرتبطة
      const success = await storage.deleteUser(id);
      
      if (!success) {
        return res.status(500).json({ message: "فشل في حذف المستخدم" });
      }

      // تسجيل نشاط الحذف
      await storage.createActivityLog({
        userId: req.session.userId!,
        action: "delete_user",
        entityType: "user",
        entityId: id,
        details: `حذف المستخدم: ${existingUser.name} (${existingUser.username})`
      });

      return res.status(200).json({ message: "تم حذف المستخدم بنجاح" });
    } catch (error) {
      console.error('خطأ في حذف المستخدم:', error);
      return res.status(500).json({ 
        message: error instanceof Error ? error.message : "خطأ في حذف المستخدم" 
      });
    }
  });

  // Projects routes - تحديث لإظهار المشاريع المخصصة للمستخدم
  app.get("/api/projects", authenticate, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(401).json({ message: "غير مصرح" });
      }

      // المشرفون يرون جميع المشاريع
      if (user.role === 'admin') {
        const projects = await storage.listProjects();
        return res.status(200).json(projects);
      }
      
      // المستخدمون العاديون يرون فقط المشاريع المخصصة لهم
      const projects = await storage.getUserProjects(req.session.userId);
      return res.status(200).json(projects);
    } catch (error) {
      return res.status(500).json({ message: "خطأ في استرجاع المشاريع" });
    }
  });

  // Transactions routes - تحديث لاستخدام النظام المبني على المشاريع
  app.get("/api/transactions", authenticate, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(401).json({ message: "غير مصرح" });
      }

      // المشرفون يرون جميع المعاملات
      if (user.role === 'admin') {
        const transactions = await storage.listTransactions();
        return res.status(200).json(transactions);
      }
      
      // المستخدمون العاديون يرون فقط معاملات المشاريع المخصصة لهم
      const transactions = await storage.getTransactionsForUserProjects(req.session.userId);
      return res.status(200).json(transactions);
    } catch (error) {
      return res.status(500).json({ message: "خطأ في استرجاع المعاملات" });
    }
  });

  // Delete transaction
  app.put("/api/transactions/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "معرف المعاملة غير صحيح" });
      }

      const existingTransaction = await storage.getTransaction(id);
      if (!existingTransaction) {
        return res.status(404).json({ message: "المعاملة غير موجودة" });
      }

      // Check permissions - المشرفون أو المستخدمون الذين لديهم صلاحية تعديل
      const currentUserId = req.session.userId;
      if (!currentUserId) {
        return res.status(401).json({ message: "غير مصرح" });
      }

      const user = await storage.getUser(currentUserId);
      if (!user) {
        return res.status(401).json({ message: "غير مصرح" });
      }

      // التحقق من صلاحية التعديل
      if (user.role !== 'admin') {
        // التحقق من وجود صلاحية تعديل المعاملات
        const hasEditPermission = await storage.checkTransactionEditPermission(currentUserId);
        if (!hasEditPermission) {
          return res.status(403).json({ message: "غير مصرح لك بتعديل المعاملات - تحتاج لصلاحية تعديل من المدير" });
        }

        // التحقق من أن المعاملة من المشاريع المخصصة للمستخدم
        const canAccess = await storage.canUserAccessTransaction(currentUserId, id);
        if (!canAccess) {
          return res.status(403).json({ message: "غير مصرح لك بتعديل هذه المعاملة - ليست من مشاريعك المخصصة" });
        }
      }

      // تحديث المعاملة
      const updatedData = {
        date: req.body.date,
        type: req.body.type,
        amount: req.body.amount,
        description: req.body.description,
        projectId: req.body.projectId,
        expenseType: req.body.expenseType,
      };

      const updatedTransaction = await storage.updateTransaction(id, updatedData);
      
      if (updatedTransaction) {
        // تسجيل نشاط التعديل
        await storage.createActivityLog({
          userId: currentUserId,
          action: "update_transaction",
          entityType: "transaction",
          entityId: id,
          details: `تعديل المعاملة: ${updatedTransaction.description || 'بدون وصف'} - المبلغ: ${updatedTransaction.amount}`
        });
        
        return res.status(200).json(updatedTransaction);
      } else {
        return res.status(500).json({ message: "فشل في تحديث المعاملة" });
      }
    } catch (error) {
      console.error('Error updating transaction:', error);
      return res.status(500).json({ message: "خطأ في تحديث المعاملة" });
    }
  });

  app.delete("/api/transactions/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "معرف المعاملة غير صحيح" });
      }

      const transaction = await storage.getTransaction(id);
      if (!transaction) {
        return res.status(404).json({ message: "المعاملة غير موجودة" });
      }
      
      // Check permissions - المشرفون أو المستخدمون المخصصون للمشروع يمكنهم الحذف
      const currentUserId = req.session.userId;
      if (!currentUserId) {
        return res.status(401).json({ message: "غير مصرح" });
      }

      const user = await storage.getUser(currentUserId);
      if (!user) {
        return res.status(401).json({ message: "غير مصرح" });
      }

      // المشرفون يمكنهم حذف أي معاملة
      if (user.role !== 'admin') {
        // التحقق من وجود صلاحية تعديل المعاملات للحذف أيضاً
        const hasEditPermission = await storage.checkTransactionEditPermission(currentUserId);
        if (!hasEditPermission) {
          return res.status(403).json({ message: "غير مصرح لك بحذف المعاملات - تحتاج لصلاحية تعديل من المدير" });
        }

        // المستخدمون العاديون يمكنهم حذف معاملات المشاريع المخصصة لهم فقط
        const canAccess = await storage.canUserAccessTransaction(currentUserId, id);
        if (!canAccess) {
          return res.status(403).json({ message: "غير مصرح لك بحذف هذه المعاملة - ليست من مشاريعك المخصصة" });
        }
      }

      const result = await storage.deleteTransaction(id);
      
      if (result) {
        // Log the deletion activity
        await storage.createActivityLog({
          userId: currentUserId,
          action: "delete_transaction",
          entityType: "transaction",
          entityId: id,
          details: `حذف المعاملة: ${transaction.description || 'بدون وصف'} - المبلغ: ${transaction.amount}`
        });
        
        return res.status(200).json({ 
          success: true, 
          message: "تم حذف المعاملة بنجاح" 
        });
      } else {
        return res.status(500).json({ message: "فشل في حذف المعاملة" });
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
      return res.status(500).json({ message: "خطأ في حذف المعاملة" });
    }
  });

  // Expense types routes
  app.get("/api/expense-types", authenticate, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId as number;
      const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;
      
      // Get user to check role
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "المستخدم غير موجود" });
      }
      
      let expenseTypes;
      if (user.role === 'admin') {
        // المدير يرى جميع أنواع المصروفات أو حسب المشروع المحدد
        expenseTypes = await storage.listExpenseTypes(projectId);
      } else {
        // المستخدمون العاديون يرون فقط أنواع مصروفات مشاريعهم
        expenseTypes = await storage.listExpenseTypesForUser(userId);
      }
      
      return res.status(200).json(expenseTypes);
    } catch (error) {
      return res.status(500).json({ message: "خطأ في استرجاع أنواع المصروفات" });
    }
  });

  // Create expense type
  app.post("/api/expense-types", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const { name, description, projectId } = req.body;
      
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ message: "اسم نوع المصروف مطلوب" });
      }

      // التحقق من وجود المشروع إذا تم تحديده
      if (projectId) {
        const project = await storage.getProject(projectId);
        if (!project) {
          return res.status(404).json({ message: "المشروع غير موجود" });
        }
      }

      const expenseType = await storage.createExpenseType({
        name: name.trim(),
        description: description?.trim() || null,
        projectId: projectId || null,
        isActive: true
      });

      return res.status(201).json(expenseType);
    } catch (error) {
      console.error('Error creating expense type:', error);
      if (error instanceof Error && error.message.includes("موجود مسبقاً")) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "خطأ في إنشاء نوع المصروف" });
    }
  });

  // Update expense type
  app.patch("/api/expense-types/:id", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "معرف نوع المصروف غير صحيح" });
      }

      const { name, description, projectId, isActive } = req.body;
      
      // التحقق من وجود المشروع إذا تم تحديده
      if (projectId) {
        const project = await storage.getProject(projectId);
        if (!project) {
          return res.status(404).json({ message: "المشروع غير موجود" });
        }
      }

      const updatedExpenseType = await storage.updateExpenseType(id, {
        name: name?.trim(),
        description: description?.trim(),
        projectId: projectId || null,
        isActive
      });

      if (!updatedExpenseType) {
        return res.status(404).json({ message: "نوع المصروف غير موجود" });
      }

      return res.status(200).json(updatedExpenseType);
    } catch (error) {
      console.error('Error updating expense type:', error);
      return res.status(500).json({ message: "خطأ في تحديث نوع المصروف" });
    }
  });

  // Delete expense type
  app.delete("/api/expense-types/:id", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "معرف نوع المصروف غير صحيح" });
      }

      // Check if expense type exists
      const expenseType = await storage.getExpenseType(id);
      if (!expenseType) {
        return res.status(404).json({ message: "نوع المصروف غير موجود" });
      }

      // Check if there are any ledger entries using this expense type
      const ledgerEntries = await storage.getLedgerEntriesByExpenseType(id);
      if (ledgerEntries.length > 0) {
        return res.status(400).json({ 
          message: `لا يمكن حذف نوع المصروف لأنه مرتبط بـ ${ledgerEntries.length} قيد محاسبي. قم بإعادة تصنيف القيود أولاً.` 
        });
      }

      const result = await storage.deleteExpenseType(id);
      if (result) {
        // Log the deletion activity
        const currentUserId = req.session.userId;
        if (currentUserId) {
          await storage.createActivityLog({
            userId: currentUserId,
            action: "delete_expense_type",
            entityType: "expense_type",
            entityId: id,
            details: `حذف نوع المصروف: ${expenseType.name}`
          });
        }
        
        return res.status(200).json({ 
          success: true, 
          message: "تم حذف نوع المصروف بنجاح" 
        });
      } else {
        return res.status(500).json({ message: "فشل في حذف نوع المصروف" });
      }
    } catch (error) {
      console.error('Error deleting expense type:', error);
      return res.status(500).json({ message: "خطأ في حذف نوع المصروف" });
    }
  });

  // Projects routes
  app.post("/api/projects", authenticate, authorize(["admin", "manager"]), async (req: Request, res: Response) => {
    try {
      const projectData = {
        ...req.body,
        createdBy: req.session.userId as number,
        startDate: req.body.startDate || new Date(),
        progress: req.body.progress || 0
      };
      
      const project = await storage.createProject(projectData);

      await storage.createActivityLog({
        action: "create_project",
        entityType: "project",
        entityId: project.id,
        details: `تم إنشاء مشروع جديد: ${project.name}`,
        userId: req.session.userId as number
      });

      res.status(201).json(project);
    } catch (error: any) {
      console.error("Error creating project:", error);
      res.status(500).json({ message: "خطأ في إنشاء المشروع" });
    }
  });

  app.patch("/api/projects/:id", authenticate, authorize(["admin", "manager"]), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const project = await storage.updateProject(id, req.body);
      
      if (!project) {
        return res.status(404).json({ message: "المشروع غير موجود" });
      }

      await storage.createActivityLog({
        action: "update_project",
        entityType: "project",
        entityId: id,
        details: `تم تحديث المشروع: ${project.name}`,
        userId: req.session.userId as number
      });

      res.status(200).json(project);
    } catch (error: any) {
      console.error("Error updating project:", error);
      res.status(500).json({ message: "خطأ في تحديث المشروع" });
    }
  });

  // Documents routes
  app.post("/api/documents", authenticate, authorize(["admin", "manager"]), async (req: Request, res: Response) => {
    try {
      const documentData = {
        ...req.body,
        createdBy: req.session.userId as number
      };
      
      const document = await storage.createDocument(documentData);

      await storage.createActivityLog({
        action: "create_document",
        entityType: "document",
        entityId: document.id,
        details: `تم إنشاء مستند جديد: ${document.name}`,
        userId: req.session.userId as number
      });

      res.status(201).json(document);
    } catch (error: any) {
      console.error("Error creating document:", error);
      res.status(500).json({ message: "خطأ في إنشاء المستند" });
    }
  });

  app.patch("/api/documents/:id", authenticate, authorize(["admin", "manager"]), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const document = await storage.updateDocument(id, req.body);
      
      if (!document) {
        return res.status(404).json({ message: "المستند غير موجود" });
      }

      await storage.createActivityLog({
        action: "update_document",
        entityType: "document",
        entityId: id,
        details: `تم تحديث المستند: ${document.name}`,
        userId: req.session.userId as number
      });

      res.status(200).json(document);
    } catch (error: any) {
      console.error("Error updating document:", error);
      res.status(500).json({ message: "خطأ في تحديث المستند" });
    }
  });

  // Deferred payments routes - CREATE endpoint moved to index.ts for proper user permissions

  app.patch("/api/deferred-payments/:id", authenticate, authorize(["admin", "manager"]), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const payment = await storage.updateDeferredPayment(id, req.body);
      
      if (!payment) {
        return res.status(404).json({ message: "المدفوعة المؤجلة غير موجودة" });
      }

      await storage.createActivityLog({
        action: "update_deferred_payment",
        entityType: "deferred_payment",
        entityId: id,
        details: `تم تحديث المدفوعة المؤجلة: ${payment.beneficiaryName}`,
        userId: req.session.userId as number
      });

      res.status(200).json(payment);
    } catch (error: any) {
      console.error("Error updating deferred payment:", error);
      res.status(500).json({ message: "خطأ في تحديث المدفوعة المؤجلة" });
    }
  });

  // Completed works routes
  app.post("/api/completed-works", authenticate, authorize(["admin", "manager"]), async (req: Request, res: Response) => {
    try {
      const workData = {
        ...req.body,
        createdBy: req.session.userId as number
      };
      
      const work = await storage.createCompletedWork(workData);

      await storage.createActivityLog({
        action: "create_completed_work",
        entityType: "completed_work",
        entityId: work.id,
        details: `تم إنشاء عمل منجز جديد: ${work.title}`,
        userId: req.session.userId as number
      });

      res.status(201).json(work);
    } catch (error: any) {
      console.error("Error creating completed work:", error);
      res.status(500).json({ message: "خطأ في إنشاء العمل المنجز" });
    }
  });

  app.patch("/api/completed-works/:id", authenticate, authorize(["admin", "manager"]), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const work = await storage.updateCompletedWork(id, req.body);
      
      if (!work) {
        return res.status(404).json({ message: "العمل المنجز غير موجود" });
      }

      await storage.createActivityLog({
        action: "update_completed_work",
        entityType: "completed_work",
        entityId: id,
        details: `تم تحديث العمل المنجز: ${work.title}`,
        userId: req.session.userId as number
      });

      res.status(200).json(work);
    } catch (error: any) {
      console.error("Error updating completed work:", error);
      res.status(500).json({ message: "خطأ في تحديث العمل المنجز" });
    }
  });

  // Completed works documents routes
  app.post("/api/completed-works-documents", authenticate, authorize(["admin", "manager"]), async (req: Request, res: Response) => {
    try {
      const docData = {
        ...req.body,
        createdBy: req.session.userId as number
      };
      
      const doc = await storage.createCompletedWorksDocument(docData);

      await storage.createActivityLog({
        action: "create_completed_works_document",
        entityType: "completed_works_document",
        entityId: doc.id,
        details: `تم إنشاء مستند عمل منجز جديد: ${doc.title}`,
        userId: req.session.userId as number
      });

      res.status(201).json(doc);
    } catch (error: any) {
      console.error("Error creating completed works document:", error);
      res.status(500).json({ message: "خطأ في إنشاء مستند العمل المنجز" });
    }
  });

  app.patch("/api/completed-works-documents/:id", authenticate, authorize(["admin", "manager"]), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const doc = await storage.updateCompletedWorksDocument(id, req.body);
      
      if (!doc) {
        return res.status(404).json({ message: "مستند العمل المنجز غير موجود" });
      }

      await storage.createActivityLog({
        action: "update_completed_works_document",
        entityType: "completed_works_document",
        entityId: id,
        details: `تم تحديث مستند العمل المنجز: ${doc.title}`,
        userId: req.session.userId as number
      });

      res.status(200).json(doc);
    } catch (error: any) {
      console.error("Error updating completed works document:", error);
      res.status(500).json({ message: "خطأ في تحديث مستند العمل المنجز" });
    }
  });

  // Employees routes
  app.get("/api/employees", async (req: Request, res: Response) => {
    try {
      const employees = await storage.getActiveEmployees();
      return res.status(200).json(employees);
    } catch (error) {
      return res.status(500).json({ message: "خطأ في استرجاع الموظفين" });
    }
  });

  // Dashboard routes
  app.get("/api/dashboard", authenticate, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId as number;
      
      // Get user role from database since session doesn't store it
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "المستخدم غير موجود" });
      }
      const userRole = user.role;
      
      let transactions, projects, deferredPayments;
      
      // Admin sees all data, regular users see only their assigned project data
      if (userRole === 'admin') {
        // Admin sees ALL transactions and projects
        transactions = await storage.listTransactions();
        projects = await storage.listProjects();
        deferredPayments = await storage.listDeferredPayments();
      } else {
        // Regular users see ONLY their assigned project transactions
        transactions = await storage.getTransactionsForUserProjects(userId);
        projects = await storage.getUserProjects(userId);
        deferredPayments = await storage.getDeferredPaymentsForUserProjects(userId);
      }
      
      let adminTotalIncome = 0, adminTotalExpenses = 0, adminNetProfit = 0;
      let projectTotalIncome = 0, projectTotalExpenses = 0, projectNetProfit = 0;
      let totalIncome = 0, totalExpenses = 0, netProfit = 0;
      
      if (userRole === 'admin') {
        // Admin: calculate separate admin fund and project totals
        const adminTransactions = transactions.filter(t => !t.projectId);
        const projectTransactions = transactions.filter(t => t.projectId);
        
        adminTotalIncome = adminTransactions
          .filter(t => t.type === 'income')
          .reduce((sum, t) => sum + t.amount, 0);
        
        adminTotalExpenses = adminTransactions
          .filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + t.amount, 0);
        
        adminNetProfit = adminTotalIncome - adminTotalExpenses;
        
        projectTotalIncome = projectTransactions
          .filter(t => t.type === 'income')
          .reduce((sum, t) => sum + t.amount, 0);
        
        projectTotalExpenses = projectTransactions
          .filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + t.amount, 0);
        
        projectNetProfit = projectTotalIncome - projectTotalExpenses;
        
        // Overall totals for admin
        totalIncome = adminTotalIncome + projectTotalIncome;
        totalExpenses = adminTotalExpenses + projectTotalExpenses;
        netProfit = totalIncome - totalExpenses;
      } else {
        // Regular user: show only their project data (no admin fund)
        totalIncome = transactions
          .filter(t => t.type === 'income')
          .reduce((sum, t) => sum + t.amount, 0);
        
        totalExpenses = transactions
          .filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + t.amount, 0);
        
        netProfit = totalIncome - totalExpenses;
        
        // For regular users, project totals = total (since they only see project data)
        projectTotalIncome = totalIncome;
        projectTotalExpenses = totalExpenses;
        projectNetProfit = netProfit;
      }
      
      // Get recent transactions (last 10)
      const recentTransactions = transactions
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10);
      
      const stats = {
        // البيانات الإجمالية
        totalIncome: totalIncome,
        totalExpenses: totalExpenses,
        netProfit: netProfit,
        
        // بيانات الصندوق الرئيسي
        adminTotalIncome: adminTotalIncome,
        adminTotalExpenses: adminTotalExpenses,
        adminNetProfit: adminNetProfit,
        adminFundBalance: adminNetProfit,
        
        // بيانات المشاريع
        projectTotalIncome: projectTotalIncome,
        projectTotalExpenses: projectTotalExpenses,
        projectNetProfit: projectNetProfit,
        
        // بيانات أخرى
        activeProjects: projects.length,
        recentTransactions: recentTransactions,
        projects: projects,
        
        // معلومات المستحقات
        deferredPaymentsCount: deferredPayments.length,
        pendingPayments: deferredPayments.filter(p => p.status === 'pending').length
      };
      
      // Add cache-control to prevent caching
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.status(200).json(stats);
    } catch (error) {
      console.error('Dashboard error:', error);
      return res.status(500).json({ message: "خطأ في استرجاع بيانات لوحة التحكم" });
    }
  });

  // Database status route
  app.get("/api/database/status", async (req: Request, res: Response) => {
    try {
      // Test actual database connection
      await storage.checkTableExists('users');
      
      // Get connection status from storage if available
      const connectionStatus = (storage as any).getConnectionStatus ? (storage as any).getConnectionStatus() : { connected: true, retries: 0 };
      
      return res.status(200).json({
        connected: true,
        timestamp: new Date().toISOString(),
        message: "قاعدة البيانات متصلة",
        retries: connectionStatus.retries,
        status: connectionStatus.connected ? 'active' : 'recovering'
      });
    } catch (error) {
      console.error('Database connectivity check failed:', error);
      
      // Try to get connection status even on error
      const connectionStatus = (storage as any).getConnectionStatus ? (storage as any).getConnectionStatus() : { connected: false, retries: 0 };
      
      return res.status(500).json({ 
        connected: false,
        message: "خطأ في الاتصال بقاعدة البيانات",
        timestamp: new Date().toISOString(),
        retries: connectionStatus.retries,
        status: 'disconnected',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Deferred payments route - Project-based access control
  app.get("/api/deferred-payments", authenticate, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      
      let deferredPayments;
      
      if (user?.role === 'admin') {
        // Admin sees all deferred payments
        deferredPayments = await storage.listDeferredPayments();
        console.log(`Admin ${user.username} retrieved ${deferredPayments.length} total deferred payments`);
      } else {
        // Regular users see only deferred payments for their assigned projects
        deferredPayments = await storage.getDeferredPaymentsForUserProjects(userId);
        console.log(`User ${user?.username} retrieved ${deferredPayments.length} deferred payments for their projects`);
      }
      
      return res.status(200).json(deferredPayments);
    } catch (error) {
      console.error('Deferred payments error:', error);
      return res.status(500).json({ message: "خطأ في استرجاع المستحقات" });
    }
  });

  // Get deferred payment details
  app.get("/api/deferred-payments/:id/details", authenticate, async (req: Request, res: Response) => {
    try {
      const paymentId = parseInt(req.params.id);
      if (isNaN(paymentId)) {
        return res.status(400).json({ message: "معرف المستحق غير صحيح" });
      }

      // الحصول على المستحق
      const payment = await storage.getDeferredPayment(paymentId);
      if (!payment) {
        return res.status(404).json({ message: "المستحق غير موجود" });
      }

      // البحث عن المعاملات المرتبطة بهذا المستحق
      const transactions = await storage.listTransactions();
      
      // استخدام beneficiaryName سواء كان في camelCase أو snake_case
      const beneficiaryName = payment.beneficiaryName || (payment as any).beneficiary_name || 'غير محدد';
      
      const relatedTransactions = transactions.filter(t => {
        const description = t.description || '';
        
        // البحث عن اسم المستحق في الوصف
        const matchesBeneficiary = description.includes(beneficiaryName);
        
        // البحث عن معرف المستحق في الوصف
        const matchesId = description.includes(`مستحق:${paymentId}`) || 
                         description.includes(`مستحق ${paymentId}`) ||
                         description.includes(`مستحق: ${paymentId}`);
        
        // البحث عن كلمات مفتاحية أخرى
        const matchesKeywords = description.includes('دفع قسط') || 
                               description.includes('دفعة') ||
                               description.includes('قسط');
        
        return matchesBeneficiary || matchesId;
      });

      // تنسيق البيانات للعرض
      const paymentHistory = relatedTransactions.map(transaction => ({
        id: transaction.id,
        date: transaction.date,
        amount: transaction.amount,
        description: transaction.description,
        transactionId: transaction.id,
        type: transaction.type
      }));

      return res.status(200).json(paymentHistory);
    } catch (error) {
      console.error('Error fetching payment details:', error);
      return res.status(500).json({ message: "خطأ في استرجاع تفاصيل المستحق" });
    }
  });

  // Pay deferred payment installment
  app.post("/api/deferred-payments/:id/pay", authenticate, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { amount } = req.body;
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "معرف المستحق غير صحيح" });
      }
      
      // تحويل المبلغ إلى رقم صحيح
      const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
      
      if (!numericAmount || isNaN(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({ message: "مبلغ الدفعة مطلوب ويجب أن يكون أكبر من الصفر" });
      }
      
      console.log(`Processing payment for deferred payment ${id}, amount: ${numericAmount}, user: ${req.session.userId}`);
      
      const result = await storage.payDeferredPaymentInstallment(id, numericAmount, req.session.userId as number);
      
      // Log activity
      await storage.createActivityLog({
        userId: req.session.userId as number,
        action: "pay_deferred_payment",
        entityType: "deferred_payment",
        entityId: id,
        details: `دفع قسط بمبلغ ${numericAmount} للمستحق رقم ${id}`
      });
      
      return res.status(200).json(result);
    } catch (error) {
      console.error("خطأ في تسجيل الدفعة:", error);
      return res.status(500).json({ 
        message: error instanceof Error ? error.message : "خطأ في تسجيل الدفعة" 
      });
    }
  });

  // Settings routes
  app.get("/api/settings", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const settings = await storage.listSettings();
      return res.status(200).json(settings);
    } catch (error) {
      return res.status(500).json({ message: "خطأ في استرجاع الإعدادات" });
    }
  });

  // Ledger routes
  app.get("/api/ledger", authenticate, async (req: Request, res: Response) => {
    try {
      const ledgerEntries = await storage.listLedgerEntries();
      return res.status(200).json(ledgerEntries);
    } catch (error) {
      console.error("خطأ في جلب إدخالات دفتر الأستاذ:", error);
      return res.status(500).json({ message: "خطأ في جلب إدخالات دفتر الأستاذ" });
    }
  });

  // إعادة تصنيف المعاملات
  app.post("/api/ledger/reclassify-transactions", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const transactions = await storage.listTransactions();
      const expenseTypes = await storage.listExpenseTypes();
      
      let reclassified = 0;
      let skipped = 0;
      
      for (const transaction of transactions) {
        if (transaction.type === 'expense') {
          // محاولة تصنيف المعاملة تلقائياً
          await storage.classifyExpenseTransaction(transaction, true);
          reclassified++;
        } else {
          skipped++;
        }
      }
      
      return res.status(200).json({
        success: true,
        summary: {
          reclassified,
          skipped,
          total: transactions.length
        }
      });
    } catch (error) {
      console.error("خطأ في إعادة تصنيف المعاملات:", error);
      return res.status(500).json({ 
        success: false,
        message: "خطأ في إعادة تصنيف المعاملات" 
      });
    }
  });

  // Activity logs routes
  app.get("/api/activity-logs", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const { entityType, userId, startDate, endDate } = req.query;
      
      // Get all activity logs
      const logs = await storage.listActivityLogs();
      
      let filteredLogs = logs;
      
      // Apply filters if provided
      if (entityType && typeof entityType === 'string') {
        filteredLogs = filteredLogs.filter(log => log.entityType === entityType);
      }
      
      if (userId && typeof userId === 'string') {
        const userIdNum = parseInt(userId);
        if (!isNaN(userIdNum)) {
          filteredLogs = filteredLogs.filter(log => log.userId === userIdNum);
        }
      }
      
      if (startDate && typeof startDate === 'string') {
        const startDateTime = new Date(startDate);
        filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= startDateTime);
      }
      
      if (endDate && typeof endDate === 'string') {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999); // End of day
        filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) <= endDateTime);
      }
      
      return res.status(200).json(filteredLogs);
    } catch (error) {
      console.error('Error getting activity logs:', error);
      return res.status(500).json({ message: "خطأ في استرجاع سجل النشاطات" });
    }
  });

  // Supabase health check
  app.get("/api/supabase/health", async (req: Request, res: Response) => {
    try {
      const health = await checkSupabaseStorageHealth();
      res.status(200).json({
        ...health,
        message: health.client && health.storage ? "Supabase Storage متصل" : "Supabase Storage غير متصل"
      });
    } catch (error) {
      console.error("Error checking Supabase health:", error);
      res.status(500).json({ 
        client: false,
        database: false,
        storage: false,
        buckets: [],
        lastCheck: new Date().toISOString(),
        error: "فشل في فحص حالة Supabase"
      });
    }
  });

  // تهيئة Supabase Storage
  app.post("/api/supabase/init", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const success = await initializeSupabaseStorage();
      
      if (success) {
        await storage.createActivityLog({
          action: "supabase_init",
          entityType: "system",
          entityId: 1,
          details: "تم تهيئة Supabase Storage",
          userId: req.session.userId as number
        });
        
        res.status(200).json({ 
          success: true, 
          message: "تم تهيئة Supabase Storage بنجاح" 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: "فشل في تهيئة Supabase Storage" 
        });
      }
    } catch (error: any) {
      console.error("Error initializing Supabase:", error);
      res.status(500).json({ 
        success: false, 
        message: "خطأ في تهيئة Supabase: " + error.message 
      });
    }
  });

  // مزامنة جميع الملفات لـ Supabase
  app.post("/api/supabase/sync-all", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const result = await syncAllLocalFiles();
      
      await storage.createActivityLog({
        action: "supabase_sync",
        entityType: "system",
        entityId: 1,
        details: `مزامنة الملفات: ${result.synced} نجحت، ${result.failed} فشلت`,
        userId: req.session.userId as number
      });
      
      res.status(200).json({
        success: true,
        message: `تمت مزامنة ${result.synced} ملف بنجاح، فشل في ${result.failed} ملف`,
        ...result
      });
    } catch (error: any) {
      console.error("Error syncing files:", error);
      res.status(500).json({ 
        success: false, 
        message: "خطأ في مزامنة الملفات: " + error.message 
      });
    }
  });

  // مزامنة ملف واحد
  app.post("/api/supabase/sync-file", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const { filePath, bucket } = req.body;
      
      if (!filePath) {
        return res.status(400).json({ 
          success: false, 
          message: "مسار الملف مطلوب" 
        });
      }
      
      const result = await uploadFromLocalFile(filePath, bucket);
      
      if (result.success) {
        await storage.createActivityLog({
          action: "file_sync",
          entityType: "file",
          entityId: 1,
          details: `تم مزامنة الملف: ${filePath}`,
          userId: req.session.userId as number
        });
      }
      
      res.status(200).json(result);
    } catch (error: any) {
      console.error("Error syncing file:", error);
      res.status(500).json({ 
        success: false, 
        message: "خطأ في مزامنة الملف: " + error.message 
      });
    }
  });

  // رفع ملف جديد للسحابة مع نسخة احتياطية محلية
  app.post("/api/upload-cloud", documentUpload.single('file'), authenticate, async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "لم يتم رفع أي ملف" });
      }

      const fileBuffer = fs.readFileSync(req.file.path);
      const bucket = req.body.bucket || 'documents';
      
      // رفع للسحابة أولاً
      const cloudResult = await uploadToSupabase(fileBuffer, req.file.originalname, bucket, true);
      
      if (cloudResult.success) {
        // حفظ رابط السحابة في قاعدة البيانات
        await storage.createActivityLog({
          action: "cloud_upload",
          entityType: "file",
          entityId: 1,
          details: `تم رفع الملف للسحابة: ${req.file.originalname}`,
          userId: req.session.userId as number
        });

        // حذف الملف المؤقت
        fs.unlinkSync(req.file.path);
        
        return res.status(200).json({
          success: true,
          message: "تم رفع الملف للسحابة بنجاح",
          cloudUrl: cloudResult.url,
          localBackup: cloudResult.localPath
        });
      } else {
        // في حالة فشل الرفع للسحابة، احتفظ بالملف محلياً كبديل
        const localPath = `/uploads/${req.file.filename}`;
        
        await storage.createActivityLog({
          action: "local_fallback",
          entityType: "file",
          entityId: 1,
          details: `فشل الرفع للسحابة، تم الحفظ محلياً: ${req.file.originalname}`,
          userId: req.session.userId as number
        });

        return res.status(200).json({
          success: false,
          message: "فشل الرفع للسحابة، تم حفظ الملف محلياً",
          localPath: localPath,
          error: cloudResult.error
        });
      }
    } catch (error: any) {
      console.error("Error uploading file:", error);
      res.status(500).json({ 
        success: false, 
        message: "خطأ في رفع الملف: " + error.message 
      });
    }
  });

  // مسار تحميل المستندات مع FormData
  app.post("/api/upload-document", authenticate, documentUpload.single('file'), async (req: Request, res: Response) => {
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
        fileUrl: `/uploads/${file.filename}`, // مسار الملف المحلي
        fileType: file.mimetype,
        uploadDate: new Date(),
        uploadedBy: userId,
        isManagerDocument: isManagerDocument === 'true'
      };
      
      try {
        // إضافة المستند إلى قاعدة البيانات
        const document = await storage.createDocument(documentData as any);
        
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

  // Simple health check
  // إنشاء نسخة احتياطية قبل الانتقال
  app.post("/api/migration/backup", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const result = await createPreMigrationBackup();
      
      if (result.success) {
        await storage.createActivityLog({
          action: "backup_created",
          entityType: "system",
          entityId: 1,
          details: `تم إنشاء نسخة احتياطية قبل الانتقال: ${result.backupPath}`,
          userId: req.session.userId as number
        });
      }
      
      res.status(200).json(result);
    } catch (error: any) {
      console.error("Error creating backup:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // فحص البيانات الحالية
  app.get("/api/migration/verify", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const result = await verifyCurrentData();
      res.status(200).json(result);
    } catch (error: any) {
      console.error("Error verifying data:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // تنفيذ الانتقال الآمن للسحابة
  app.post("/api/migration/to-cloud", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      console.log("🚀 بدء الانتقال للتخزين السحابي...");
      
      const result = await safeMigrateToCloud();
      
      // تسجيل نتيجة الانتقال
      await storage.createActivityLog({
        action: "cloud_migration",
        entityType: "system",
        entityId: 1,
        details: `انتقال للسحابة: ${result.migratedFiles} نجح، ${result.failedFiles} فشل من أصل ${result.totalFiles} ملف`,
        userId: req.session.userId as number
      });
      
      res.status(200).json(result);
    } catch (error: any) {
      console.error("Error during migration:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // نقاط النهاية لنظام التخزين الهجين
  app.get("/api/hybrid-storage/status", authenticate, async (req: Request, res: Response) => {
    try {
      const { hybridStorage } = await import('./hybrid-storage-strategy.js');
      const status = await hybridStorage.getSystemStatus();
      res.json(status);
    } catch (error: any) {
      console.error('خطأ في فحص حالة التخزين الهجين:', error);
      res.status(500).json({ error: 'خطأ في فحص حالة النظام', details: error.message });
    }
  });

  app.post("/api/hybrid-storage/backup-now", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const { hybridStorage } = await import('./hybrid-storage-strategy.js');
      // تشغيل النسخ الاحتياطي فوراً
      await (hybridStorage as any).createDatabaseBackup();
      res.json({ 
        success: true, 
        message: 'تم تشغيل النسخ الاحتياطي بنجاح',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('خطأ في النسخ الاحتياطي:', error);
      res.status(500).json({ error: 'خطأ في النسخ الاحتياطي', details: error.message });
    }
  });

  app.post("/api/hybrid-storage/config", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const { hybridStorage } = await import('./hybrid-storage-strategy.js');
      const config = req.body;
      
      hybridStorage.updateConfig(config);
      res.json({ 
        success: true, 
        message: 'تم تحديث إعدادات التخزين',
        config 
      });
    } catch (error: any) {
      console.error('خطأ في تحديث إعدادات التخزين:', error);
      res.status(500).json({ error: 'خطأ في تحديث الإعدادات', details: error.message });
    }
  });

  // مسارات الحذف المفقودة
  // حذف مدفوعة مؤجلة
  app.delete("/api/deferred-payments/:id", authenticate, authorize(["admin", "manager"]), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteDeferredPayment(id);
      
      if (!success) {
        return res.status(404).json({ message: "المدفوعة المؤجلة غير موجودة" });
      }

      await storage.createActivityLog({
        action: "delete_deferred_payment",
        entityType: "deferred_payment",
        entityId: id,
        details: `تم حذف المدفوعة المؤجلة: ${id}`,
        userId: req.session.userId as number
      });

      res.status(200).json({ message: "تم حذف المدفوعة المؤجلة بنجاح" });
    } catch (error: any) {
      console.error("Error deleting deferred payment:", error);
      res.status(500).json({ message: "خطأ في حذف المدفوعة المؤجلة" });
    }
  });

  // حذف موظف
  app.delete("/api/employees/:id", authenticate, authorize(["admin", "manager"]), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteEmployee(id);
      
      if (!success) {
        return res.status(404).json({ message: "الموظف غير موجود" });
      }

      await storage.createActivityLog({
        action: "delete_employee",
        entityType: "employee",
        entityId: id,
        details: `تم حذف الموظف: ${id}`,
        userId: req.session.userId as number
      });

      res.status(200).json({ message: "تم حذف الموظف بنجاح" });
    } catch (error: any) {
      console.error("Error deleting employee:", error);
      res.status(500).json({ message: "خطأ في حذف الموظف" });
    }
  });

  // إضافة موظف
  app.post("/api/employees", authenticate, authorize(["admin", "manager"]), async (req: Request, res: Response) => {
    try {
      const employeeData = {
        ...req.body,
        createdBy: req.session.userId as number
      };
      
      const employee = await storage.createEmployee(employeeData);

      await storage.createActivityLog({
        action: "create_employee",
        entityType: "employee",
        entityId: employee.id,
        details: `تم إضافة موظف جديد: ${employee.name}`,
        userId: req.session.userId as number
      });

      res.status(201).json(employee);
    } catch (error: any) {
      console.error("Error creating employee:", error);
      res.status(500).json({ message: "خطأ في إضافة الموظف" });
    }
  });

  // تحديث موظف
  app.patch("/api/employees/:id", authenticate, authorize(["admin", "manager"]), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const employee = await storage.updateEmployee(id, req.body);
      
      if (!employee) {
        return res.status(404).json({ message: "الموظف غير موجود" });
      }

      await storage.createActivityLog({
        action: "update_employee",
        entityType: "employee",
        entityId: id,
        details: `تم تحديث بيانات الموظف: ${employee.name}`,
        userId: req.session.userId as number
      });

      res.status(200).json(employee);
    } catch (error: any) {
      console.error("Error updating employee:", error);
      res.status(500).json({ message: "خطأ في تحديث الموظف" });
    }
  });

  // حذف مستند
  app.delete("/api/documents/:id", authenticate, authorize(["admin", "manager"]), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteDocument(id);
      
      if (!success) {
        return res.status(404).json({ message: "المستند غير موجود" });
      }

      await storage.createActivityLog({
        action: "delete_document",
        entityType: "document",
        entityId: id,
        details: `تم حذف المستند: ${id}`,
        userId: req.session.userId as number
      });

      res.status(200).json({ message: "تم حذف المستند بنجاح" });
    } catch (error: any) {
      console.error("Error deleting document:", error);
      res.status(500).json({ message: "خطأ في حذف المستند" });
    }
  });

  // حذف مشروع
  app.delete("/api/projects/:id", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteProject(id);
      
      if (!success) {
        return res.status(404).json({ message: "المشروع غير موجود" });
      }

      await storage.createActivityLog({
        action: "delete_project",
        entityType: "project",
        entityId: id,
        details: `تم حذف المشروع: ${id}`,
        userId: req.session.userId as number
      });

      res.status(200).json({ message: "تم حذف المشروع بنجاح" });
    } catch (error: any) {
      console.error("Error deleting project:", error);
      res.status(500).json({ message: "خطأ في حذف المشروع" });
    }
  });

  // حذف أعمال منجزة
  app.delete("/api/completed-works/:id", authenticate, authorize(["admin", "manager"]), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteCompletedWork(id);
      
      if (!success) {
        return res.status(404).json({ message: "العمل المنجز غير موجود" });
      }

      await storage.createActivityLog({
        action: "delete_completed_work",
        entityType: "completed_work",
        entityId: id,
        details: `تم حذف العمل المنجز: ${id}`,
        userId: req.session.userId as number
      });

      res.status(200).json({ message: "تم حذف العمل المنجز بنجاح" });
    } catch (error: any) {
      console.error("Error deleting completed work:", error);
      res.status(500).json({ message: "خطأ في حذف العمل المنجز" });
    }
  });

  // حذف مستند أعمال منجزة
  app.delete("/api/completed-works-documents/:id", authenticate, authorize(["admin", "manager"]), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteCompletedWorksDocument(id);
      
      if (!success) {
        return res.status(404).json({ message: "مستند العمل المنجز غير موجود" });
      }

      await storage.createActivityLog({
        action: "delete_completed_works_document",
        entityType: "completed_works_document",
        entityId: id,
        details: `تم حذف مستند العمل المنجز: ${id}`,
        userId: req.session.userId as number
      });

      res.status(200).json({ message: "تم حذف مستند العمل المنجز بنجاح" });
    } catch (error: any) {
      console.error("Error deleting completed works document:", error);
      res.status(500).json({ message: "خطأ في حذف مستند العمل المنجز" });
    }
  });

  // مسار للمعاملات المؤرشفة
  app.get("/api/transactions/archived", authenticate, async (req: Request, res: Response) => {
    try {
      const transactions = await storage.listTransactions();
      const archivedTransactions = transactions.filter(t => t.archived === true);
      res.status(200).json(archivedTransactions);
    } catch (error: any) {
      console.error("Error fetching archived transactions:", error);
      res.status(500).json({ message: "خطأ في استرجاع المعاملات المؤرشفة" });
    }
  });

  // مسار لأرشفة معاملة
  app.patch("/api/transactions/:id/archive", authenticate, authorize(["admin", "manager"]), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const transaction = await storage.updateTransaction(id, { archived: true });
      
      if (!transaction) {
        return res.status(404).json({ message: "المعاملة غير موجودة" });
      }

      await storage.createActivityLog({
        action: "archive_transaction",
        entityType: "transaction",
        entityId: id,
        details: `تم أرشفة المعاملة: ${transaction.description}`,
        userId: req.session.userId as number
      });

      res.status(200).json(transaction);
    } catch (error: any) {
      console.error("Error archiving transaction:", error);
      res.status(500).json({ message: "خطأ في أرشفة المعاملة" });
    }
  });

  // Transaction Edit Permissions routes - صلاحيات تعديل المعاملات
  app.post("/api/transaction-edit-permissions", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const { userId, projectId, reason, notes } = req.body;
      
      if (!userId && !projectId) {
        return res.status(400).json({ message: "يجب تحديد مستخدم أو مشروع" });
      }

      if (userId && projectId) {
        return res.status(400).json({ message: "لا يمكن تحديد مستخدم ومشروع في نفس الوقت" });
      }

      // التحقق من وجود صلاحية نشطة للمستخدم
      let existingPermission = null;
      if (userId) {
        const activePermissions = await storage.listActiveTransactionEditPermissions();
        existingPermission = activePermissions.find(p => p.user_id === userId);
      }

      if (existingPermission) {
        // إذا كان هناك صلاحية نشطة، قم بإلغائها (toggle off)
        const success = await storage.revokeTransactionEditPermission(existingPermission.id, req.session.userId);
        
        if (success) {
          await storage.createActivityLog({
            userId: req.session.userId,
            action: "revoke_transaction_edit_permission",
            entityType: "permission",
            entityId: existingPermission.id,
            details: `إلغاء صلاحية تعديل المعاملات للمستخدم ${userId}`
          });

          return res.status(200).json({ 
            message: "تم إلغاء صلاحية تعديل المعاملات", 
            action: "revoked",
            permissionId: existingPermission.id 
          });
        } else {
          return res.status(500).json({ message: "فشل في إلغاء الصلاحية" });
        }
      } else {
        // إذا لم تكن هناك صلاحية نشطة، قم بإنشاء واحدة جديدة (toggle on)
        const permission = await storage.grantTransactionEditPermission({
          userId: userId || null,
          projectId: projectId || null,
          grantedBy: req.session.userId,
          reason: reason || "تفعيل صلاحية تعديل المعاملات",
          notes
        });

        await storage.createActivityLog({
          userId: req.session.userId,
          action: "grant_transaction_edit_permission",
          entityType: "permission",
          entityId: permission.id,
          details: `منح صلاحية تعديل المعاملات ${userId ? `للمستخدم ${userId}` : `للمشروع ${projectId}`}`
        });

        return res.status(201).json({ 
          ...permission,
          message: "تم تفعيل صلاحية تعديل المعاملات لمدة 42 ساعة", 
          action: "granted" 
        });
      }
    } catch (error) {
      console.error('Error managing transaction edit permission:', error);
      if (error.message && error.message.includes('يوجد صلاحية نشطة مسبقاً')) {
        return res.status(400).json({ message: error.message });
      } else {
        return res.status(500).json({ message: "خطأ في إدارة الصلاحية" });
      }
    }
  });

  app.delete("/api/transaction-edit-permissions/:id", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "معرف الصلاحية غير صحيح" });
      }

      const success = await storage.revokeTransactionEditPermission(id, req.session.userId);
      
      if (success) {
        await storage.createActivityLog({
          userId: req.session.userId,
          action: "revoke_transaction_edit_permission",
          entityType: "permission",
          entityId: id,
          details: "إلغاء صلاحية تعديل المعاملات"
        });

        return res.status(200).json({ message: "تم إلغاء الصلاحية بنجاح" });
      } else {
        return res.status(404).json({ message: "الصلاحية غير موجودة أو غير نشطة" });
      }
    } catch (error) {
      console.error('Error revoking transaction edit permission:', error);
      return res.status(500).json({ message: "خطأ في إلغاء الصلاحية" });
    }
  });

  app.get("/api/transaction-edit-permissions", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const permissions = await storage.listActiveTransactionEditPermissions();
      return res.status(200).json(permissions);
    } catch (error) {
      console.error('Error listing transaction edit permissions:', error);
      return res.status(500).json({ message: "خطأ في استرجاع الصلاحيات" });
    }
  });

  // Endpoint للتحقق من وجود صلاحية تعديل للمستخدم الحالي
  app.get("/api/transaction-edit-permissions/check", authenticate, async (req: Request, res: Response) => {
    try {
      const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;
      
      const permission = await storage.checkTransactionEditPermission(req.session.userId, projectId);
      
      return res.status(200).json({
        hasPermission: !!permission,
        permission: permission || null
      });
    } catch (error) {
      console.error('Error checking transaction edit permission:', error);
      return res.status(500).json({ message: "خطأ في التحقق من الصلاحية" });
    }
  });

  // Endpoint لاسترجاع صلاحيات مستخدم محدد
  app.get("/api/transaction-edit-permissions/user/:userId", authenticate, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "معرف المستخدم غير صحيح" });
      }

      // التحقق من أن المستخدم يطلب صلاحياته الخاصة أو هو مدير
      const isAdmin = req.session.user?.role === 'admin' || req.session.user?.permissions?.includes('manage_users');
      if (req.session.userId !== userId && !isAdmin) {
        return res.status(403).json({ message: "ليس لديك صلاحية لعرض صلاحيات هذا المستخدم" });
      }

      const permissions = await storage.getTransactionEditPermissionsByUser(userId);
      const hasActivePermission = permissions.some(p => p.isActive);
      
      return res.status(200).json(permissions);
    } catch (error) {
      console.error('Error retrieving user transaction edit permissions:', error);
      return res.status(500).json({ message: "خطأ في استرجاع الصلاحيات" });
    }
  });

  app.get("/api/health", (req: Request, res: Response) => {
    res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
  });

  const server = createServer(app);
  return server;
}

export { registerRoutes };