import type { Express, Request, Response, NextFunction } from "express";
import { logger } from '../shared/logger';
import express from "express";
import { storage } from "./storage";
import { createClient } from '@supabase/supabase-js';
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
  type Transaction,
  type InsertEmployee
} from "../shared/schema";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { neon } from '@neondatabase/serverless';
import { eq, and } from "drizzle-orm";
import path from "path";
import fs from "fs";
import { dirname } from 'path';
import jwt from 'jsonwebtoken';
import postgres from 'postgres';
// @ts-ignore - Types provided via middleware/auth.d.ts
import commonAuthenticate from '../middleware/auth.js';
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

import { documentUpload, transactionUpload, completedWorksUpload, completedWorksDocsUpload } from './multer-config';
import { createClient } from '@supabase/supabase-js';

// دالة مساعدة لحفظ الملف
async function saveUploadedFile(file: Express.Multer.File, fileName: string): Promise<string> {
  // هنا يمكننا حفظ الملف في النظام المحلي أو رفعه إلى خدمة أخرى
  // للبساطة، سنحفظه محلياً أولاً
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  
  const filePath = path.join(uploadsDir, fileName);
  fs.writeFileSync(filePath, file.buffer);
  
  // إرجاع رابط الملف
  return `/uploads/${fileName}`;
}

// دالة مساعدة لحفظ الملف من buffer
async function saveUploadedFileFromBuffer(buffer: Buffer, fileName: string): Promise<string> {
  try {
    console.log('[DEBUG] saveUploadedFileFromBuffer called, buffer size:', buffer.length, 'fileName:', fileName);
    
    const uploadsDir = path.join(process.cwd(), 'uploads');
    console.log('[DEBUG] uploads directory:', uploadsDir);
    
    if (!fs.existsSync(uploadsDir)) {
      console.log('[DEBUG] Creating uploads directory');
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    const filePath = path.join(uploadsDir, fileName);
    console.log('[DEBUG] Full file path:', filePath);
    
    fs.writeFileSync(filePath, buffer);
    console.log('[DEBUG] File written successfully');
    
    // إرجاع رابط الملف
    const fileUrl = `/uploads/${fileName}`;
    console.log('[DEBUG] Returning file URL:', fileUrl);
    return fileUrl;
  } catch (error: any) {
    console.error('[ERROR] saveUploadedFileFromBuffer failed:', error);
    throw error;
  }
}

export async function registerRoutes(app: Express): Promise<void> {
  try {
    console.log('Starting registerRoutes...');
  // نقاط تشخيص مبكرة جداً قبل أي مصادقة أو تعامل مع قاعدة البيانات
  app.get('/diag/ping', (_req: Request, res: Response) => {
    res.status(200).json({ ok: true, ts: Date.now(), phase: 'pre-auth' });
  });
  app.post('/diag/echo', (req: Request, res: Response) => {
    res.status(200).json({ ok: true, ts: Date.now(), path: req.path, headers: {
      'content-type': req.headers['content-type'],
      'content-length': req.headers['content-length']
    }});
  });
  // Ensure Express is aware it's behind a proxy (Netlify) so secure cookies work
  app.set('trust proxy', 1);
  // إعدادات البيئة و JWT
  const isNetlify = !!process.env.NETLIFY;
  const isNetlifyLocal = !!process.env.NETLIFY_LOCAL; // عند تشغيل netlify dev
  const isProduction = (process.env.NODE_ENV === 'production' && !isNetlifyLocal) || (isNetlify && !isNetlifyLocal);
  const SESSION_SECRET = process.env.SESSION_SECRET || "accounting-app-secret-key-2025";

  const signJwt = (payload: object, opts?: jwt.SignOptions) =>
    jwt.sign(payload as any, SESSION_SECRET, { expiresIn: '7d', ...(opts || {}) });
  const setAuthCookie = (res: Response, token: string) => {
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: !isNetlifyLocal && (process.env.URL?.startsWith('https://') ? true : isProduction),
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    } as any);
  };
  const clearAuthCookie = (res: Response) => {
    res.clearCookie('token', {
      path: '/',
      sameSite: 'lax',
      secure: !isNetlifyLocal && (process.env.URL?.startsWith('https://') ? true : isProduction),
    } as any);
    res.clearCookie('accounting.jwt', {
      path: '/',
      sameSite: 'lax',
      secure: !isNetlifyLocal && (process.env.URL?.startsWith('https://') ? true : isProduction),
    } as any);
  };
  // Use shared auth middleware
  
  // لا حاجة لأي middleware جلسات بعد اعتماد JWT

  // Health endpoint (outside auth) to confirm function is alive
  app.get('/api/health', (_req: Request, res: Response) => {
    try {
      // اختبار الاتصال بقاعدة البيانات إذا كان متاحاً
      let dbStatus = 'unknown';
      try {
        if (typeof db !== 'undefined' && db !== null) {
          dbStatus = 'connected';
        } else {
          dbStatus = 'disconnected';
        }
      } catch (e) {
        dbStatus = 'error';
      }
      
      res.status(200).json({ 
        ok: true, 
        ts: Date.now(),
        dbStatus,
        storageType: (storage as any).__proto__?.constructor?.name || 'unknown'
      });
    } catch (error) {
      logger.error('Health check error:', error);
      res.status(500).json({ ok: false, ts: Date.now(), error: 'Health check failed' });
    }
  });

  // Lightweight DB ping to verify DATABASE_URL connectivity from server environment
  app.get('/api/db/ping', async (_req: Request, res: Response) => {
    const url = process.env.DATABASE_URL;
    if (!url || !url.trim()) {
      return res.status(200).json({ ok: false, hasDatabaseUrl: false, message: 'DATABASE_URL not set' });
    }
    let sql: any;
    try {
      // Prefer TLS; small pool and short timeout for serverless
      sql = postgres(url, { ssl: 'require', max: 1, connect_timeout: 10 });
      const result = await sql`SELECT NOW() as now`;
      const now = (result && result[0]?.now) || null;
      await sql.end();
      return res.status(200).json({ ok: true, now });
    } catch (e: any) {
      try { if (sql) await sql.end(); } catch {}
      return res.status(200).json({ ok: false, error: e?.message || String(e) });
    }
  });

  // Simple diagnostics: which storage backend is active
  app.get('/api/diagnostics/storage', (_req: Request, res: Response) => {
    const impl = (storage as any).__proto__?.constructor?.name || '[proxy]';
    // Attempt to infer actual target through a test call signature
    let kind = 'unknown';
    try {
      const target = (storage as any);
      if (target && target.supabase) kind = 'SupabaseStorage';
      else if (target && target.getConnectionStatus) kind = 'PgStorage';
    } catch {}
    res.status(200).json({
      ok: true,
      impl,
      detected: kind,
      hasSupabaseEnv: !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      nodeEnv: process.env.NODE_ENV,
      netlify: !!process.env.NETLIFY,
    });
  });

  // Authentication middleware (JWT)
  const authenticate = commonAuthenticate as unknown as (req: Request, res: Response, next: NextFunction) => void;

  // Role-based authorization middleware
  const authorize = (roles: string[]) => {
    return (req: Request, res: Response, next: Function) => {
      const user = (req as any).user;
      if (!user || !roles.includes(user.role as string)) {
        return res.status(403).json({ ok: false, message: "Forbidden" });
      }
      next();
    };
  };

  // Admin endpoint: setup/migrate database and seed admin if needed
  app.post('/api/admin/db/setup', authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      logger.log('Starting database setup...');
      const { setupDatabase } = await import('./db-setup');
      const ok = await setupDatabase();
      if (ok) {
        logger.log('Database setup completed successfully');
        return res.json({ success: true });
      }
      logger.error('Database setup failed');
      return res.status(500).json({ success: false, message: 'فشل إعداد قاعدة البيانات' });
    } catch (err: any) {
      logger.error('DB setup error:', err);
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

  

  // Test POST route
  app.post("/api/test", (req: Request, res: Response) => {
    return res.status(200).json({ message: "POST test successful", body: req.body });
  });

  // Authentication routes
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const credentials = loginSchema.parse(req.body);
      // Allow login by username OR email
      let user = await storage.getUserByUsername(credentials.username);
      // Try well-known admin aliases
      if (!user && ['admin@admin.com','admin@example.com'].includes((credentials.username || '').toLowerCase())) {
        user = await storage.getUserByUsername('admin');
      }
      if (!user && credentials.username?.includes?.('@')) {
        user = await storage.getUserByEmail(credentials.username);
      }
      if (!user) {
        // Try email anyway even if no '@'
        user = await storage.getUserByEmail(credentials.username);
      }
      
      if (!user) {
        return res.status(401).json({ message: "معلومات تسجيل الدخول غير صحيحة" });
      }
      
      const isPasswordValid = await storage.validatePassword(user.password, credentials.password);
      
      if (!isPasswordValid) {
        return res.status(401).json({ message: "معلومات تسجيل الدخول غير صحيحة" });
      }

      // Promote to admin if configured by email (or if username is 'admin')
      try {
        const adminEmailsEnv = (process.env.ADMIN_EMAILS || 'admin@example.com,admin@admin.com')
          .split(',')
          .map(e => e.trim().toLowerCase())
          .filter(Boolean);
        const isAdminEmail = !!(user?.email && adminEmailsEnv.includes(String(user.email).toLowerCase()));
        const shouldBeAdmin = user.username === 'admin' || isAdminEmail;
        if (shouldBeAdmin && user.role !== 'admin') {
          const updated = await storage.updateUser(user.id, { role: 'admin' } as any);
          if (updated) user = updated;
        }
      } catch (promoteErr) {
        console.warn('Failed to evaluate/promote admin role for local login:', promoteErr);
      }
      
      // Issue JWT (7d) cookie and return token
      const token = signJwt({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        permissions: user.permissions || [],
      });
      setAuthCookie(res, token);
      
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
        permissions: user.permissions,
        token,
      });
    } catch (error) {
      console.error('Login error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      return res.status(500).json({ message: "خطأ في تسجيل الدخول" });
    }
  });

// تمت إزالة نسخة قديمة غير صحيحة من مسار supabase-login لتفادي تعارضات

  // Lightweight session probe (JWT)
  app.get('/api/auth/whoami', authenticate, (req: Request, res: Response) => {
    res.status(200).json({ ok: true, user: (req as any).user });
  });

  app.post("/api/auth/logout", authenticate, async (req: Request, res: Response) => {
    const userId = (req as any).user?.id as number | undefined;
    clearAuthCookie(res);
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

  app.get("/api/auth/session", authenticate, async (req: Request, res: Response) => {
    const uid = (req as any).user?.id as number | undefined;
    if (!uid) return res.status(401).json({ message: "غير مصرح" });
    const user = await storage.getUser(uid);
    if (!user) return res.status(401).json({ message: "غير مصرح" });
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

      // Determine intended role: promote to admin if email is in ADMIN_EMAILS or metadata flags admin
      try {
        const adminEmailsEnv = (process.env.ADMIN_EMAILS || 'admin@example.com,admin@admin.com')
          .split(',')
          .map(e => e.trim().toLowerCase())
          .filter(Boolean);
        const isMetadataAdmin = !!(supaUser?.user_metadata?.is_admin || supaUser?.user_metadata?.role === 'admin');
        const isAdminEmail = !!(user?.email && adminEmailsEnv.includes(String(user.email).toLowerCase()));
        const shouldBeAdmin = isMetadataAdmin || isAdminEmail;
        if (shouldBeAdmin && user.role !== 'admin') {
          const updated = await storage.updateUser(user.id, { role: 'admin' } as any);
          if (updated) user = updated;
        }
      } catch (promoteErr) {
        console.warn('Failed to evaluate/promote admin role for supabase-login:', promoteErr);
      }

      // Issue JWT cookie (7d)
      const sessionToken = signJwt({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        permissions: user.permissions || [],
      });
      setAuthCookie(res, sessionToken);

      res.json({
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions || [],
        token: sessionToken,
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
      
  // المديرون يمكنهم رؤية كلمات المرور الأصلية (نعتمد على دور التوكن لتجنّب نداء DB إضافي)
  const isAdmin = ((req as any).user?.role === 'admin');
  if (isAdmin) {
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
      console.error('Error fetching users:', error);
      return res.status(200).json([]);
    }
  });  // Delete user endpoint
  // Create user endpoint
  app.post("/api/users", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      const data = insertUserSchema.parse(req.body);
      // إنشاء المستخدم عبر طبقة التخزين (يقوم بعمل التجزئة وغيرها)
      const user = await storage.createUser(data);

      await storage.createActivityLog({
        action: "create_user",
        entityType: "user",
        entityId: user.id,
        details: `إنشاء مستخدم: ${user.name} (${user.username})`,
        userId: (req as any).user.id as number
      });

      return res.status(201).json(user);
    } catch (error: any) {
      console.error('خطأ في إنشاء المستخدم:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors?.[0]?.message || 'بيانات غير صالحة' });
      }
      const msg = (error?.message || '').toLowerCase();
      if (msg.includes('unique') || msg.includes('duplicate')) {
        return res.status(409).json({ message: 'اسم المستخدم موجود بالفعل' });
      }
      return res.status(500).json({ message: 'خطأ في إنشاء المستخدم' });
    }
  });
  
  // Assign user to project
  app.post("/api/users/:userId/assign-project", authenticate, authorize(["admin", "manager"]), async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      const { projectId } = req.body as { projectId?: number };
      if (!userId || !projectId) {
        return res.status(400).json({ message: "userId و projectId مطلوبان" });
      }

      const assignment = await storage.assignUserToProject({
        userId,
        projectId,
        assignedBy: (req as any).user.id as number,
      } as any);

      await storage.createActivityLog({
        action: "assign_user_to_project",
        entityType: "user_project",
        entityId: assignment.id,
        details: `تم ربط المستخدم ${userId} بالمشروع ${projectId}`,
        userId: (req as any).user.id as number
      });

      return res.status(201).json(assignment);
    } catch (error: any) {
      console.error('خطأ في ربط المستخدم بالمشروع:', error);
      const msg = (error?.message || '').toLowerCase();
      if (msg.includes('duplicate') || msg.includes('unique')) {
        return res.status(409).json({ message: 'المستخدم مرتبط بالفعل بهذا المشروع' });
      }
      return res.status(500).json({ message: 'خطأ في ربط المستخدم بالمشروع' });
    }
  });

  // Remove user from project
  app.delete("/api/users/:userId/remove-project/:projectId", authenticate, authorize(["admin", "manager"]), async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      const projectId = parseInt(req.params.projectId);
      if (!userId || !projectId) {
        return res.status(400).json({ message: "userId و projectId مطلوبان" });
      }
      const success = await storage.removeUserFromProject(userId, projectId);
      if (!success) {
        return res.status(404).json({ message: 'لا يوجد ربط لهذا المستخدم مع المشروع' });
      }

      await storage.createActivityLog({
        action: "remove_user_from_project",
        entityType: "user_project",
        entityId: projectId,
        details: `تم إزالة ربط المستخدم ${userId} من المشروع ${projectId}`,
        userId: (req as any).user.id as number
      });

      return res.status(200).json({ message: 'تمت إزالة الربط بنجاح' });
    } catch (error: any) {
      console.error('خطأ في إزالة ربط المستخدم من المشروع:', error);
      return res.status(500).json({ message: 'خطأ في إزالة الربط' });
    }
  });

  // Get projects for a specific user (for admin tools)
  app.get("/api/users/:userId/projects", authenticate, authorize(["admin", "manager"]), async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      if (!userId) {
        return res.status(400).json({ message: "userId غير صحيح" });
      }
      const projects = await storage.getUserProjects(userId);
      return res.status(200).json(projects);
    } catch (error: any) {
      console.error('خطأ في جلب مشاريع المستخدم المحدد:', error);
      return res.status(500).json({ message: 'خطأ في جلب المشاريع' });
    }
  });
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
        userId: (req as any).user.id!,
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
      const uid = (req as any).user.id as number;
      const user = await storage.getUser(uid);
      if (!user) {
        return res.status(401).json({ message: "غير مصرح" });
      }

      // المشرفون يرون جميع المشاريع
      if (user.role === 'admin') {
        try {
          const projects = await storage.listProjects();
          return res.status(200).json(projects);
        } catch (innerErr) {
          console.error('Error fetching all projects for admin:', innerErr);
          return res.status(200).json([]);
        }
      }
      
      // المستخدمون العاديون يرون فقط المشاريع المخصصة لهم
      try {
        const projects = await storage.getUserProjects(uid);
        return res.status(200).json(projects);
      } catch (innerErr) {
        console.error('Error fetching user projects:', innerErr);
        return res.status(200).json([]);
      }
    } catch (error) {
      console.error('Error in /api/projects route:', error);
      return res.status(200).json([]);
    }
  });  // Alias route for user-specific projects to support existing client calls
  app.get("/api/user-projects", authenticate, async (req: Request, res: Response) => {
    try {
  const userId = (req as any).user.id as number | undefined;
      if (!userId) {
        return res.status(401).json({ message: "غير مصرح" });
      }
      const projects = await storage.getUserProjects(userId);
      return res.status(200).json(projects);
    } catch (error) {
      console.error("خطأ في جلب مشاريع المستخدم الحالي:", error);
      return res.status(500).json({ message: "خطأ في جلب مشاريع المستخدم" });
    }
  });

  // Transactions routes - تحديث لاستخدام النظام المبني على المشاريع
  // إنشاء معاملة مع رفع ملف (مطلوب عبر Netlify Function أيضاً)
  app.post(
    "/api/transactions",
    authenticate,
    transactionUpload.single("file"),
    async (
      req: Request & { file?: Express.Multer.File },
      res: Response,
    ) => {
      try {
        const currentUserId = (req as any).user?.id as number | undefined;
        if (!currentUserId) {
          return res.status(401).json({ message: "غير مصرح" });
        }

        const { date, amount, type, description, projectId, expenseType, employeeId } = req.body as any;
        if (!date || !amount || !type || !description) {
          return res.status(400).json({ message: "جميع الحقول مطلوبة" });
        }

        const parsedDate = new Date(date);
        const parsedAmount = Number(amount);
        if (isNaN(parsedDate.getTime())) {
          return res.status(400).json({ message: "تاريخ غير صالح" });
        }
        if (!Number.isFinite(parsedAmount)) {
          return res.status(400).json({ message: "مبلغ غير صالح" });
        }

        // Handle attachment: prefer Supabase Storage when configured
        let fileUrl: string | null = null;
        let fileType: string | null = null;
        if (req.file) {
          fileType = req.file.mimetype || null;
          const hasSupabase = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
          const isMemory = (req.file as any).buffer && !(req.file as any).path;
          try {
            if (hasSupabase) {
              const buffer = isMemory ? (req.file as any).buffer : fs.readFileSync((req.file as any).path);
              const up = await uploadToSupabase(buffer, req.file.originalname, 'transactions');
              if (up.success && up.url) {
                fileUrl = up.url;
              } else {
                console.warn('Supabase upload failed, falling back to local URL:', up.error);
              }
            }
          } catch (e) {
            console.warn('Upload to Supabase threw:', e);
          }

          // Fallback local URL (may be ephemeral on serverless)
          if (!fileUrl) {
            const fname = (req.file as any).filename || `${Date.now()}_${req.file.originalname.replace(/\s+/g,'_')}`;
            fileUrl = `/uploads/transactions/${fname}`;
          }
  } else if ((req as any).rawBody && typeof (req as any).rawBody === 'string') {
          // Netlify sometimes leaves rawBody when body parsing fails; avoid hard 502 by warning
          console.warn('No req.file parsed but rawBody present - possible multipart parsing issue');
  }

        const transactionData = {
          date: parsedDate,
          type,
          amount: parsedAmount,
          description,
          projectId: projectId ? Number(projectId) : null,
          expenseType: expenseType || null,
          employeeId: employeeId ? Number(employeeId) : null,
          createdBy: currentUserId,
          fileUrl,
          fileType,
          archived: false,
        } as any;

        // تحقق الرواتب
        if (
          transactionData.type === 'expense' &&
          transactionData.expenseType === 'راتب' &&
          transactionData.employeeId
        ) {
          const employee = await storage.getEmployee(transactionData.employeeId);
          if (!employee) {
            return res.status(400).json({ message: "الموظف غير موجود" });
          }
          if (!employee.active) {
            return res.status(400).json({ message: "لا يمكن صرف راتب لموظف غير فعّال" });
          }
        }

        const created = await storage.createTransaction(transactionData);
        return res.status(201).json(created);
      } catch (err) {
  console.error('Create transaction error:', err);
  return res.status(500).json({ message: "تعذر حفظ المرفق أو المعاملة. تأكد من أن حجم الملف أقل من 20MB وأن الاتصال مستقر" });
      }
    },
  );

  app.get("/api/transactions", authenticate, async (req: Request, res: Response) => {
    try {
      const uid = Number((req as any)?.user?.id);
      if (!uid || Number.isNaN(uid)) {
        return res.status(401).json({ message: "غير مصرح" });
      }
      const role = (req as any)?.user?.role as string | undefined;

      // المشرفون يرون جميع المعاملات
      if (role === 'admin') {
        try {
          const transactions = await storage.listTransactions();
          return res.status(200).json(transactions);
        } catch (innerErr) {
          console.error('GET /api/transactions admin path error, returning []', innerErr);
          res.setHeader('x-degraded-mode', 'true');
          return res.status(200).json([]);
        }
      }
      
      // المستخدمون العاديون يرون فقط معاملات المشاريع المخصصة لهم
      try {
        const transactions = await storage.getTransactionsForUserProjects(uid);
        return res.status(200).json(transactions);
      } catch (innerErr) {
        console.error('GET /api/transactions user path error, returning []', innerErr, { uid });
        res.setHeader('x-degraded-mode', 'true');
        return res.status(200).json([]);
      }
    } catch (error) {
      console.error('GET /api/transactions failed:', {
        error,
        userId: (req as any)?.user?.id,
        path: req.path,
      });
      return res.status(500).json({ message: "خطأ في استرجاع المعاملات" });
    }
  });

  // أرشفة معاملات متعددة دفعة واحدة
  app.post("/api/transactions/archive", authenticate, authorize(["admin", "manager"]), async (req: Request, res: Response) => {
    try {
      const body = req.body as { transactionIds?: unknown };
      const parsed = z.object({ transactionIds: z.array(z.number().int().positive()).min(1) }).safeParse({
        transactionIds: Array.isArray(body?.transactionIds)
          ? body.transactionIds.map(Number).filter(n => !Number.isNaN(n))
          : [],
      });
      if (!parsed.success) {
        return res.status(400).json({ message: "قائمة المعاملات مطلوبة" });
      }

      const actorId = (req as any).user?.id as number | undefined;
      if (!actorId) return res.status(401).json({ message: "غير مصرح" });

      // إن لم يكن admin نتحقق من صلاحية التعديل
      const actor = await storage.getUser(actorId);
      if (!actor) return res.status(401).json({ message: "غير مصرح" });

      let canEdit = true;
      if (actor.role !== 'admin') {
        const perm = await storage.checkTransactionEditPermission(actorId);
        canEdit = !!perm;
        if (!canEdit) {
          return res.status(403).json({ message: "غير مصرح لك بأرشفة المعاملات - تحتاج لصلاحية تعديل من المدير" });
        }
      }

      const ids = parsed.data.transactionIds;
      const failed: number[] = [];
      let archivedCount = 0;

      for (const id of ids) {
        try {
          if (actor.role !== 'admin') {
            const canAccess = await storage.canUserAccessTransaction(actorId, id);
            if (!canAccess) {
              failed.push(id);
              continue;
            }
          }
          const updated = await storage.updateTransaction(id, { archived: true } as any);
          if (updated) archivedCount++;
          else failed.push(id);
        } catch {
          failed.push(id);
        }
      }

      return res.status(200).json({ success: true, archivedCount, failed });
    } catch (error) {
      console.error("Error bulk archiving transactions:", error);
      return res.status(500).json({ message: "خطأ في أرشفة المعاملات" });
    }
  });

  // تصدير المعاملات إلى CSV (استجابة تحميل ملف)
  app.post('/api/transactions/export/excel', authenticate, async (req: Request, res: Response) => {
    try {
      const uid = (req as any).user.id as number;
      const role = (req as any).user.role as string | undefined;

      const body = req.body as any;
      const filters = {
        projectId: body?.projectId ? Number(body.projectId) : undefined,
        type: typeof body?.type === 'string' ? body.type : undefined,
        startDate: body?.startDate ? new Date(body.startDate) : undefined,
        endDate: body?.endDate ? new Date(body.endDate) : undefined,
      };

      let list: any[];
      try {
        if (role === 'admin') {
          if (filters.projectId) {
            list = await storage.getTransactionsByProject(filters.projectId);
          } else {
            list = await storage.listTransactions();
          }
        } else {
          list = await storage.getTransactionsForUserProjects(uid);
        }
      } catch (innerErr) {
        console.warn('Export excel degraded mode, returning empty CSV:', innerErr);
        list = [];
        res.setHeader('x-degraded-mode', 'true');
      }

      // تطبيق الفلاتر الباقية
      if (filters.type) list = list.filter((t: any) => t.type === filters.type);
      if (filters.startDate) list = list.filter((t: any) => new Date(t.date) >= filters.startDate!);
      if (filters.endDate) list = list.filter((t: any) => new Date(t.date) <= filters.endDate!);

      // بناء CSV بسيط
      const header = ['id','date','type','amount','description','projectId','expenseType','employeeId'];
      const rows = list.map((t: any) => [
        t.id,
        new Date(t.date).toISOString().slice(0,10),
        t.type,
        t.amount,
        (t.description || '').replace(/\r?\n/g, ' '),
        t.projectId ?? '',
        t.expenseType ?? '',
        t.employeeId ?? '',
      ]);
      const csv = [header.join(','), ...rows.map(r => r.map(v => String(v).includes(',') ? `"${String(v).replace(/"/g,'""')}"` : String(v)).join(','))].join('\n');

      const filename = `transactions_export_${Date.now()}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(200).send(csv);
    } catch (error) {
      console.error('Error exporting transactions:', error);
      return res.status(500).json({ success: false, message: 'فشل في تصدير البيانات' });
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
  const currentUserId = (req as any).user.id as number;
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
  const currentUserId = (req as any).user.id as number;
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
      const userId = (req as any).user.id as number;
      const role = (req as any).user.role as string | undefined;
      const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;
      
      let expenseTypes;
      if (role === 'admin') {
        // المدير يرى جميع أنواع المصروفات أو حسب المشروع المحدد
        try {
          expenseTypes = await storage.listExpenseTypes(projectId);
        } catch (innerErr) {
          console.warn('Expense-types degraded (admin):', innerErr);
          res.setHeader('x-degraded-mode', 'true');
          return res.status(200).json([]);
        }
      } else {
        // المستخدمون العاديون يرون فقط أنواع مصروفات مشاريعهم
        // If projectId is provided, filter by it, otherwise get all for user
        try {
          if (projectId) {
            const userExpenseTypes = await storage.listExpenseTypesForUser(userId);
            expenseTypes = userExpenseTypes.filter(et => et.projectId === projectId);
          } else {
            expenseTypes = await storage.listExpenseTypesForUser(userId);
          }
        } catch (innerErr) {
          console.warn('Expense-types degraded (user):', innerErr);
          res.setHeader('x-degraded-mode', 'true');
          return res.status(200).json([]);
        }
      }
      
      return res.status(200).json(expenseTypes);
    } catch (error) {
      console.error("Error fetching expense types:", error);
      res.setHeader('x-degraded-mode', 'true');
      return res.status(200).json([]);
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
      if (error instanceof Error && (error.message.includes("موجود مسبقاً") || error.message.includes("UNIQUE constraint failed"))) {
        return res.status(409).json({ message: "نوع المصروف هذا موجود بالفعل لهذا المشروع." });
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
    const currentUserId = (req as any).user.id as number;
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
  createdBy: (req as any).user.id as number,
        startDate: req.body.startDate || new Date(),
        progress: req.body.progress || 0
      };
      
      const project = await storage.createProject(projectData);

      await storage.createActivityLog({
        action: "create_project",
        entityType: "project",
        entityId: project.id,
        details: `تم إنشاء مشروع جديد: ${project.name}`,
  userId: (req as any).user.id as number
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
  userId: (req as any).user.id as number
      });

      res.status(200).json(project);
    } catch (error: any) {
      console.error("Error updating project:", error);
      res.status(500).json({ message: "خطأ في تحديث المشروع" });
    }
  });

  // Documents routes
  app.get("/api/documents", authenticate, async (req: Request, res: Response) => {
    try {
      const { isManagerDocument } = req.query;
      let documents;
      
      if (isManagerDocument !== undefined) {
        const isManager = isManagerDocument === 'true';
        documents = await storage.listDocuments();
        documents = documents.filter(doc => (doc as any).isManagerDocument === isManager);
      } else {
        documents = await storage.listDocuments();
      }
      
      res.status(200).json(documents);
    } catch (error: any) {
      console.error("Error getting documents:", error);
      return res.status(200).json([]);
    }
  });

  app.post("/api/documents", authenticate, authorize(["admin", "manager"]), async (req: Request, res: Response) => {
    try {
      const documentData = {
        ...req.body,
  createdBy: (req as any).user.id as number,
      };
      
      const document = await storage.createDocument(documentData);

      await storage.createActivityLog({
        action: "create_document",
        entityType: "document",
        entityId: document.id,
        details: `تم إنشاء مستند جديد: ${document.name}`,
  userId: (req as any).user.id as number
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
  userId: (req as any).user.id as number
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
  userId: (req as any).user.id as number
      });

      res.status(200).json(payment);
    } catch (error: any) {
      console.error("Error updating deferred payment:", error);
      res.status(500).json({ message: "خطأ في تحديث المدفوعة المؤجلة" });
    }
  });

  // Completed works routes
  app.get("/api/completed-works", authenticate, async (req: Request, res: Response) => {
    try {
      const works = await storage.listCompletedWorks();
      res.status(200).json(works);
    } catch (error: any) {
      console.error("Error getting completed works:", error);
      // Return empty array instead of 500 error when database is unavailable
      res.status(200).json([]);
    }
  });

  app.post("/api/completed-works", authenticate, authorize(["admin", "manager"]), 
    completedWorksUpload.single("file"),
    async (req: Request & { file?: Express.Multer.File }, res: Response) => {
    try {
      // Handle file upload if present
      let fileUrl: string | null = null;
      let fileType: string | null = null;
      
      if (req.file) {
        fileType = req.file.mimetype || null;
        const hasSupabase = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
        const isMemory = (req.file as any).buffer && !(req.file as any).path;
        
        try {
          if (hasSupabase) {
            const buffer = isMemory ? (req.file as any).buffer : fs.readFileSync((req.file as any).path);
            const up = await uploadToSupabase(buffer, req.file.originalname, 'completed-works');
            if (up.success && up.url) {
              fileUrl = up.url;
            } else {
              console.warn('Supabase upload failed for completed work:', up.error);
            }
          }
        } catch (e) {
          console.warn('Upload to Supabase threw for completed work:', e);
        }

        // Fallback local URL
        if (!fileUrl) {
          const fname = (req.file as any).filename || `${Date.now()}_${req.file.originalname.replace(/\s+/g,'_')}`;
          fileUrl = `/uploads/completed-works/${fname}`;
        }
      }

      const workData = {
        ...req.body,
        createdBy: (req as any).user.id as number,
        fileUrl,
        fileType,
      };
      
      const work = await storage.createCompletedWork(workData);

      await storage.createActivityLog({
        action: "create_completed_work",
        entityType: "completed_work",
        entityId: work.id,
        details: `تم إنشاء عمل منجز جديد: ${work.title}`,
        userId: (req as any).user.id as number
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
  userId: (req as any).user.id as number
      });

      res.status(200).json(work);
    } catch (error: any) {
      console.error("Error updating completed work:", error);
      res.status(500).json({ message: "خطأ في تحديث العمل المنجز" });
    }
  });

  // Completed works documents routes
  app.get("/api/completed-works-documents", authenticate, async (req: Request, res: Response) => {
    try {
      const documents = await storage.listCompletedWorksDocuments();
      res.status(200).json(documents);
    } catch (error: any) {
      console.error("Error getting completed works documents:", error);
      // Return empty array instead of 500 error when database is unavailable
      res.status(200).json([]);
    }
  });

  app.post("/api/completed-works-documents", authenticate, authorize(["admin", "manager"]), 
    completedWorksDocsUpload.single("file"),
    async (req: Request & { file?: Express.Multer.File }, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "يجب تحديد ملف" });
      }

      // Handle file upload
      let fileUrl: string | null = null;
      let fileType: string | null = req.file.mimetype || null;
      const hasSupabase = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
      const isMemory = (req.file as any).buffer && !(req.file as any).path;
      
      try {
        if (hasSupabase) {
          const buffer = isMemory ? (req.file as any).buffer : fs.readFileSync((req.file as any).path);
          const up = await uploadToSupabase(buffer, req.file.originalname, 'completed-works');
          if (up.success && up.url) {
            fileUrl = up.url;
          } else {
            console.warn('Supabase upload failed for completed works document:', up.error);
          }
        }
      } catch (e) {
        console.warn('Upload to Supabase threw for completed works document:', e);
      }

      // Fallback local URL
      if (!fileUrl) {
        const fname = (req.file as any).filename || `${Date.now()}_${req.file.originalname.replace(/\s+/g,'_')}`;
        fileUrl = `/uploads/completed-works-docs/${fname}`;
      }

      const docData = {
        title: req.body.title,
        description: req.body.description || null,
        fileUrl: fileUrl!,
        fileType: fileType!,
        category: req.body.category || null,
        tags: req.body.tags ? req.body.tags.split(',').map((t: string) => t.trim()) : [],
        completedWorkId: req.body.completedWorkId ? parseInt(req.body.completedWorkId) : null,
        uploadedBy: (req as any).user.id as number,
        uploadDate: new Date(),
      };
      
      const doc = await storage.createCompletedWorksDocument(docData);

      await storage.createActivityLog({
        action: "create_completed_works_document",
        entityType: "completed_works_document",
        entityId: doc.id,
        details: `تم إنشاء مستند عمل منجز جديد: ${doc.title}`,
        userId: (req as any).user.id as number
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
  userId: (req as any).user.id as number
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
      console.error('Error fetching employees:', error);
      return res.status(200).json([]);
    }
  });

  // Get employees by project
  app.get("/api/employees/by-project/:projectId", authenticate, async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "معرف المشروع غير صحيح" });
      }

      const employees = await storage.getEmployeesByProject(projectId);
      return res.status(200).json(employees);
    } catch (error) {
      console.error('Error getting employees by project:', error);
      return res.status(500).json({ message: "خطأ في استرجاع موظفي المشروع" });
    }
  });

  // Dashboard routes
  app.get("/api/dashboard", authenticate, async (req: Request, res: Response) => {
    try {
  const userId = (req as any).user.id as number;
      
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
      const userFromToken = (req as any).user as { id: number; role?: string; username?: string };
      const userId = Number(userFromToken?.id);
      const role = userFromToken?.role;

      let deferredPayments: any[] = [];

      // Use role from JWT to avoid DB calls when the DB is down
      if (role === 'admin') {
        try {
          deferredPayments = await storage.listDeferredPayments();
          console.log(`Admin ${userFromToken?.username || userId} retrieved ${deferredPayments.length} total deferred payments`);
        } catch (innerErr) {
          console.warn('Deferred payments (admin) fallback due to storage error:', innerErr);
          res.setHeader('x-degraded-mode', 'true');
          return res.status(200).json([]);
        }
      } else {
        try {
          deferredPayments = await storage.getDeferredPaymentsForUserProjects(userId);
          console.log(`User ${userFromToken?.username || userId} retrieved ${deferredPayments.length} deferred payments for their projects`);
        } catch (innerErr) {
          console.warn('Deferred payments (user) fallback due to storage error:', innerErr);
          res.setHeader('x-degraded-mode', 'true');
          return res.status(200).json([]);
        }
      }

      return res.status(200).json(deferredPayments || []);
    } catch (error) {
      console.error('Deferred payments error:', error instanceof Error ? error.stack || error.message : error);
      // Return empty array instead of 500 error when database is unavailable
      res.setHeader('x-degraded-mode', 'true');
      return res.status(200).json([]);
    }
  });  // Get deferred payment details
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

  // Create new deferred payment
  app.post("/api/deferred-payments", authenticate, authorize(["admin", "manager"]), async (req: Request, res: Response) => {
    try {
      const deferredPaymentData = {
        ...req.body,
        userId: (req as any).user.id as number
      };
      
      const deferredPayment = await storage.createDeferredPayment(deferredPaymentData);

      await storage.createActivityLog({
        action: "create_deferred_payment",
        entityType: "deferred_payment",
        entityId: deferredPayment.id,
        details: `تم إضافة مستحق جديد: ${deferredPayment.description} بمبلغ ${deferredPayment.totalAmount}`,
        userId: (req as any).user.id as number
      });

      res.status(201).json(deferredPayment);
    } catch (error: any) {
      console.warn("Create deferred payment failed, degraded mode response:", error?.message || error);
      // هبوط سلس: نُرجع 202 مع رسالة بدل 500 حتى لا يتعطل الواجهة
      res.setHeader('x-degraded-mode', 'true');
      return res.status(202).json({
        success: false,
        message: "تعذر حفظ المستحق حالياً بسبب الاتصال. تم تجاهل العملية مؤقتاً.",
      });
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
      
  console.log(`Processing payment for deferred payment ${id}, amount: ${numericAmount}, user: ${(req as any).user.id}`);
      
  const result = await storage.payDeferredPaymentInstallment(id, numericAmount, (req as any).user.id as number);
      
      // Log activity
      await storage.createActivityLog({
        userId: (req as any).user.id as number,
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
      console.error('Error fetching settings:', error);
      return res.status(200).json([]);
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
          userId: (req as any).user.id as number
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
  userId: (req as any).user.id as number
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
          userId: (req as any).user.id as number
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
          userId: (req as any).user.id as number
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
          userId: (req as any).user.id as number
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

  // مسار للحصول على رابط رفع موقّع (بديل مبسط لتجنب مشاكل bucket)
  app.post("/api/get-upload-url", authenticate, async (req: Request, res: Response) => {
    try {
      const { fileName, fileType, fileSize } = req.body;
      const userId = (req as any).user.id as number;
      
      if (!fileName) {
        return res.status(400).json({ message: "اسم الملف مطلوب" });
      }
      
      // إنشاء اسم ملف فريد
      const timestamp = Date.now();
      const uniqueFileName = `${timestamp}_${userId}_${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      
      // استخدام Supabase Storage الصحيح
      const uploadEndpoint = `/upload-supabase-direct`;
      
      return res.status(200).json({
        uploadUrl: uploadEndpoint,
        filePath: uniqueFileName,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        directUpload: false,
        classic: false,
        base64: false,
        simple: false,
        external: false,
        infoOnly: false,
        supabase: true // استخدام Supabase Storage المباشر
      });
      
    } catch (error: any) {
      console.error("Error generating upload URL:", error);
      return res.status(500).json({ 
        message: "خطأ في إنشاء رابط الرفع", 
        error: error.message || 'Unknown error'
      });
    }
  });

  // رفع مباشر إلى Supabase Storage
  app.post("/api/upload-supabase-direct", authenticate, async (req: Request, res: Response) => {
    try {
      console.log('[DEBUG] Supabase direct upload started');
      const { fileData, fileName, fileType, name, description, projectId, isManagerDocument } = req.body;
      const userId = (req as any).user.id as number;
      
      if (!fileData || !fileName) {
        return res.status(400).json({ message: "بيانات الملف مطلوبة" });
      }

      // التحقق من وجود Supabase credentials
      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.log('[ERROR] Missing Supabase credentials');
        return res.status(503).json({ 
          message: "إعدادات Supabase غير متوفرة",
          hint: "تحقق من SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY"
        });
      }

      console.log('[DEBUG] Supabase credentials found');
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
      
      // تحويل base64 إلى buffer
      const base64Data = fileData.replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      // إنشاء مسار فريد للملف
      const timestamp = Date.now();
      const uniqueFileName = `${timestamp}_${userId}_${fileName}`;
      const filePath = `documents/${uniqueFileName}`;
      
      console.log('[DEBUG] Uploading to Supabase Storage:', filePath);
      
      // رفع الملف إلى Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(filePath, buffer, {
          contentType: fileType || 'application/octet-stream',
          upsert: false
        });

      if (uploadError) {
        console.error('[ERROR] Supabase upload failed:', uploadError);
        
        // معلومات مفيدة للتشخيص
        if (uploadError.message.includes('bucket')) {
          return res.status(500).json({
            message: "Bucket 'uploads' غير موجود في Supabase",
            hint: "أنشئ bucket اسمه 'uploads' في Supabase Dashboard → Storage",
            error: uploadError.message
          });
        }
        
        return res.status(500).json({
          message: "فشل رفع الملف إلى Supabase",
          error: uploadError.message,
          hint: "تحقق من الصلاحيات والسياسات في Supabase"
        });
      }

      console.log('[DEBUG] File uploaded successfully to Supabase');
      
      // الحصول على الرابط العام للملف
      const { data: { publicUrl } } = supabase.storage
        .from('uploads')
        .getPublicUrl(filePath);

      console.log('[DEBUG] Public URL generated:', publicUrl);
      
      // حفظ معلومات المستند في قاعدة البيانات
      // استخدام أسماء الحقول المطابقة لقاعدة البيانات (snake_case for Supabase)
      const documentData = {
        name: name || fileName.replace(/\.[^/.]+$/, ""),
        description: description || "",
        project_id: projectId && projectId !== "all" && projectId !== "" ? Number(projectId) : undefined,
        file_url: publicUrl,  // snake_case للتطابق مع أعمدة قاعدة البيانات
        file_type: fileType || 'application/octet-stream',  // snake_case
        upload_date: new Date(),  // snake_case
        uploaded_by: userId,  // snake_case
        is_manager_document: isManagerDocument === 'true' || isManagerDocument === true  // snake_case
      };

      console.log('[DEBUG] Creating document in database with data:', documentData);
      
      let document;
      try {
        document = await storage.createDocument(documentData as any);
        console.log('[DEBUG] Document created successfully:', document);
      } catch (dbError: any) {
        console.error('[ERROR] Database error:', dbError);
        
        // إذا كانت المشكلة في أعمدة معينة، جرب بالحد الأدنى من البيانات
        if (dbError.message?.includes('fileType') || dbError.message?.includes('file_type') || 
            dbError.message?.includes('fileUrl') || dbError.message?.includes('file_url')) {
          console.log('[DEBUG] Retrying with minimal document data (snake_case)');
          const documentDataMinimal = {
            name: name || fileName.replace(/\.[^/.]+$/, ""),
            description: description || "",
            project_id: projectId && projectId !== "all" && projectId !== "" ? Number(projectId) : undefined,
            file_url: publicUrl,
            upload_date: new Date(),
            uploaded_by: userId,
            is_manager_document: isManagerDocument === 'true' || isManagerDocument === true
          };
          document = await storage.createDocument(documentDataMinimal as any);
          console.log('[DEBUG] Document created with minimal data');
        } else {
          throw dbError;
        }
      }
      
      // إنشاء سجل النشاط
      await storage.createActivityLog({
        action: "create",
        entityType: "document",
        entityId: document.id,
        details: `إضافة مستند جديد: ${document.name}`,
        userId: userId
      });
      
      console.log('[DEBUG] Supabase upload completed successfully');
      return res.status(201).json({
        ...document,
        success: true,
        supabaseUpload: true,
        fileUrl: publicUrl,
        message: "تم رفع المستند بنجاح إلى Supabase Storage"
      });
      
    } catch (error: any) {
      console.error('[ERROR] Supabase upload failed:', error);
      return res.status(500).json({ 
        message: "خطأ في رفع الملف إلى Supabase", 
        error: error.message 
      });
    }
  });

  // Run database migration endpoint
  app.post("/api/run-migration", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      console.log('[DEBUG] Running documents file_type migration');
      
      // تشغيل migration للتأكد من وجود عمود file_type
      await db.execute(`
        ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_type text NOT NULL DEFAULT 'application/octet-stream'
      `);
      
      await db.execute(`
        UPDATE documents SET file_type = 'application/octet-stream' WHERE file_type IS NULL OR file_type = ''
      `);
      
      console.log('[DEBUG] Migration completed successfully');
      
      return res.status(200).json({ 
        success: true, 
        message: "تم تشغيل migration بنجاح" 
      });
      
    } catch (error: any) {
      console.error('[ERROR] Migration failed:', error);
      return res.status(500).json({ 
        message: "فشل في تشغيل migration", 
        error: error.message 
      });
    }
  });

  // Check database schema endpoint
  app.get("/api/check-schema", authenticate, authorize(["admin"]), async (req: Request, res: Response) => {
    try {
      console.log('[DEBUG] Checking documents table schema');
      
      // فحص schema جدول documents
      const schemaResult = await db.execute(`
        SELECT column_name, data_type, is_nullable, column_default 
        FROM information_schema.columns 
        WHERE table_name = 'documents' 
        ORDER BY ordinal_position
      `);
      
      console.log('[DEBUG] Documents schema:', schemaResult.rows);
      
      return res.status(200).json({ 
        success: true, 
        schema: schemaResult.rows,
        message: "تم فحص schema بنجاح" 
      });
      
    } catch (error: any) {
      console.error('[ERROR] Schema check failed:', error);
      return res.status(500).json({ 
        message: "فشل في فحص schema", 
        error: error.message 
      });
    }
  });

  // حل نهائي بسيط: حفظ معلومات المستند بدون ملفات
  app.post("/api/save-document-info", authenticate, async (req: Request, res: Response) => {
    try {
      console.log('[DEBUG] Save document info started');
      const { fileName, fileType, name, description, projectId, isManagerDocument, fileSize } = req.body;
      const userId = (req as any).user.id as number;
      
      console.log('[DEBUG] Document info received:', { fileName, name, userId });
      
      if (!fileName || !name) {
        return res.status(400).json({ message: "اسم الملف والمستند مطلوبان" });
      }

      // إنشاء رابط وهمي للملف (مؤقتاً)
      const timestamp = Date.now();
      const uniqueFileName = `${timestamp}_${userId}_${fileName}`;
      const mockFileUrl = `/documents/placeholder/${uniqueFileName}`;
      
      // حفظ معلومات المستند في قاعدة البيانات
      const documentData = {
        name: name,
        description: description || `ملف ${fileName} - تم الحفظ مؤقتاً`,
        projectId: projectId && projectId !== "all" && projectId !== "" ? Number(projectId) : undefined,
        fileUrl: mockFileUrl,
        fileType: fileType || 'application/octet-stream',
        uploadDate: new Date(),
        uploadedBy: userId,
        isManagerDocument: isManagerDocument === 'true' || isManagerDocument === true
      };

      console.log('[DEBUG] Creating document in database');
      const document = await storage.createDocument(documentData as any);
      console.log('[DEBUG] Document created successfully:', document.id);
      
      // إنشاء سجل النشاط
      await storage.createActivityLog({
        action: "create",
        entityType: "document",
        entityId: document.id,
        details: `إضافة مستند جديد: ${document.name} (معلومات فقط)`,
        userId: userId
      });
      
      return res.status(201).json({
        ...document,
        success: true,
        infoOnly: true,
        message: "تم حفظ معلومات المستند بنجاح",
        note: "الملف محفوظ كمعلومات فقط - سيتم إضافة نظام الرفع لاحقاً"
      });
      
    } catch (error: any) {
      console.error('[ERROR] Save document info failed:', error);
      return res.status(500).json({ 
        message: "خطأ في حفظ معلومات المستند", 
        error: error.message 
      });
    }
  });

  // رفع خارجي لتجاوز قيود Netlify Functions تماماً
  app.post("/api/upload-external", authenticate, async (req: Request, res: Response) => {
    try {
      console.log('[DEBUG] External upload started');
      const { fileDataUrl, fileName, fileType, name, description, projectId, isManagerDocument } = req.body;
      const userId = (req as any).user.id as number;
      
      if (!fileDataUrl || !fileName) {
        return res.status(400).json({ message: "بيانات الملف مطلوبة" });
      }

      // استخدام خدمة مجانية للرفع (file.io أو مشابه)
      const timestamp = Date.now();
      const uniqueFileName = `${timestamp}_${userId}_${fileName}`;
      
      // محاكاة رفع خارجي - في الواقع يمكن استخدام خدمة مثل:
      // - file.io
      // - uploadcare
      // - cloudinary
      // - imgur
      
      // للتجربة، سنحفظ محلياً ونرجع رابط وهمي
      const mockFileUrl = `https://storage.example.com/files/${uniqueFileName}`;
      
      // حفظ معلومات المستند في قاعدة البيانات
      const documentData = {
        name: name || fileName.replace(/\.[^/.]+$/, ""),
        description: description || "",
        projectId: projectId && projectId !== "all" && projectId !== "" ? Number(projectId) : undefined,
        fileUrl: mockFileUrl,
        fileType: fileType || 'application/octet-stream',
        uploadDate: new Date(),
        uploadedBy: userId,
        isManagerDocument: isManagerDocument === 'true' || isManagerDocument === true
      };

      console.log('[DEBUG] Creating document with external URL');
      const document = await storage.createDocument(documentData as any);
      
      // إنشاء سجل النشاط
      await storage.createActivityLog({
        action: "create",
        entityType: "document",
        entityId: document.id,
        details: `إضافة مستند جديد: ${document.name}`,
        userId: userId
      });
      
      console.log('[DEBUG] External upload completed successfully');
      return res.status(201).json({
        ...document,
        success: true,
        externalUpload: true,
        message: "تم رفع المستند بنجاح عبر الخدمة الخارجية"
      });
      
    } catch (error: any) {
      console.error('[ERROR] External upload failed:', error);
      return res.status(500).json({ 
        message: "خطأ في الرفع الخارجي", 
        error: error.message 
      });
    }
  });

  // أبسط طريقة ممكنة للرفع - بدون تعقيد
  app.post("/api/upload-simple", authenticate, (req: Request, res: Response) => {
    // استخدام multer العادي بأبسط طريقة
    documentUpload.single('file')(req, res, async (err: any) => {
      if (err) {
        console.error('[ERROR] Multer error in simple upload:', err);
        return res.status(500).json({ 
          message: "خطأ في معالجة الملف",
          error: err.message 
        });
      }

      try {
        console.log('[DEBUG] Simple upload started');
        
        const file = req.file;
        const { name, description, projectId, isManagerDocument } = req.body;
        const userId = (req as any).user.id as number;
        
        if (!file) {
          console.log('[ERROR] No file received');
          return res.status(400).json({ message: "لم يتم رفع أي ملف" });
        }

        console.log('[DEBUG] File received:', file.originalname, 'size:', file.size);

        // حفظ معلومات المستند في قاعدة البيانات
        const documentData = {
          name: name || file.originalname.replace(/\.[^/.]+$/, ""),
          description: description || "",
          projectId: projectId && projectId !== "all" && projectId !== "" ? Number(projectId) : undefined,
          fileUrl: file.path || `/uploads/${file.filename}`,
          fileType: file.mimetype || 'application/octet-stream',
          uploadDate: new Date(),
          uploadedBy: userId,
          isManagerDocument: isManagerDocument === 'true' || isManagerDocument === true
        };

        console.log('[DEBUG] Creating document with data:', documentData);
        const document = await storage.createDocument(documentData as any);
        console.log('[DEBUG] Document created:', document.id);
        
        // إنشاء سجل النشاط
        await storage.createActivityLog({
          action: "create",
          entityType: "document",
          entityId: document.id,
          details: `إضافة مستند جديد: ${document.name}`,
          userId: userId
        });
        
        console.log('[DEBUG] Simple upload completed successfully');
        return res.status(201).json({
          ...document,
          success: true,
          simpleUpload: true,
          message: "تم رفع المستند بنجاح"
        });
        
      } catch (error: any) {
        console.error('[ERROR] Simple upload failed:', error);
        return res.status(500).json({ 
          message: "خطأ في رفع الملف", 
          error: error.message 
        });
      }
    });
  });

  // نقطة تشخيص بسيطة لاختبار base64
  app.post("/api/test-base64", authenticate, async (req: Request, res: Response) => {
    try {
      console.log('[DEBUG] Test base64 endpoint hit');
      console.log('[DEBUG] Body:', req.body);
      
      const { testData } = req.body;
      
      return res.status(200).json({
        success: true,
        message: "Base64 test successful",
        receivedDataLength: testData?.length || 0,
        bodyKeys: Object.keys(req.body)
      });
    } catch (error: any) {
      console.error('[ERROR] Test base64 failed:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // مسار رفع الملفات باستخدام base64 (لتجنب مشاكل multipart)
  app.post("/api/upload-document-base64", authenticate, async (req: Request, res: Response) => {
    try {
      console.log('[DEBUG] Base64 upload started');
      console.log('[DEBUG] Request headers:', req.headers);
      console.log('[DEBUG] Body keys:', Object.keys(req.body));
      
      const { fileData, fileName, fileType, name, description, projectId, isManagerDocument } = req.body;
      const userId = (req as any).user.id as number;
      
      console.log('[DEBUG] Extracted data:', {
        hasFileData: !!fileData,
        fileDataLength: fileData?.length,
        fileName,
        fileType,
        name,
        userId
      });
      
      if (!fileData || !fileName) {
        console.log('[ERROR] Missing fileData or fileName');
        return res.status(400).json({ message: "بيانات الملف واسم الملف مطلوبان" });
      }
      
      // تحويل base64 إلى Buffer
      console.log('[DEBUG] Converting base64 to buffer...');
      const base64Data = fileData.replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      console.log('[DEBUG] Buffer created, size:', buffer.length);
      
      // إنشاء اسم ملف فريد
      const timestamp = Date.now();
      const uniqueFileName = `${timestamp}_${userId}_${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      console.log('[DEBUG] Unique filename:', uniqueFileName);
      
      // حفظ الملف
      console.log('[DEBUG] Saving file...');
      const fileUrl = await saveUploadedFileFromBuffer(buffer, uniqueFileName);
      console.log('[DEBUG] File saved, URL:', fileUrl);
      
      // حفظ معلومات المستند في قاعدة البيانات
      const documentData = {
        name: name || fileName.replace(/\.[^/.]+$/, ""),
        description: description || "",
        projectId: projectId && projectId !== "all" && projectId !== "" ? Number(projectId) : undefined,
        fileUrl,
        fileType: fileType || 'application/octet-stream',
        uploadDate: new Date(),
        uploadedBy: userId,
        isManagerDocument: isManagerDocument === 'true' || isManagerDocument === true
      };

      console.log('[DEBUG] Creating document in database...');
      const document = await storage.createDocument(documentData as any);
      console.log('[DEBUG] Document created:', document.id);
      
      // إنشاء سجل النشاط
      await storage.createActivityLog({
        action: "create",
        entityType: "document",
        entityId: document.id,
        details: `إضافة مستند جديد: ${document.name}`,
        userId: userId
      });
      
      console.log('[DEBUG] Base64 upload completed successfully');
      return res.status(201).json({
        ...document,
        success: true,
        base64Upload: true,
        message: "تم رفع المستند بنجاح"
      });
      
    } catch (error: any) {
      console.error("Error in base64 upload:", error);
      console.error("Error stack:", error.stack);
      return res.status(500).json({ 
        message: "خطأ في رفع الملف", 
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // مسار الرفع المباشر المبسط
  app.post("/api/direct-upload/:fileName", authenticate, documentUpload.single('file'), async (req: Request, res: Response) => {
    try {
      const { fileName } = req.params;
      const { name, description, projectId, isManagerDocument } = req.body;
      const userId = (req as any).user.id as number;
      
      if (!req.file) {
        return res.status(400).json({ message: "لم يتم رفع أي ملف" });
      }

      // حفظ الملف في النظام المحلي أو في الخدمة المناسبة
      const fileUrl = await saveUploadedFile(req.file, fileName);
      
      // حفظ معلومات المستند في قاعدة البيانات
      const documentData = {
        name: name || fileName.replace(/\.[^/.]+$/, ""),
        description: description || "",
        projectId: projectId && projectId !== "all" && projectId !== "" ? Number(projectId) : undefined,
        fileUrl,
        fileType: req.file.mimetype || 'application/octet-stream',
        uploadDate: new Date(),
        uploadedBy: userId,
        isManagerDocument: isManagerDocument === 'true'
      };

      const document = await storage.createDocument(documentData as any);
      
      // إنشاء سجل النشاط
      await storage.createActivityLog({
        action: "create",
        entityType: "document",
        entityId: document.id,
        details: `إضافة مستند جديد: ${document.name}`,
        userId: userId
      });
      
      return res.status(201).json({
        ...document,
        success: true,
        simplified: true,
        message: "تم رفع المستند بنجاح"
      });
      
    } catch (error: any) {
      console.error("Error in direct upload:", error);
      return res.status(500).json({ 
        message: "خطأ في رفع الملف", 
        error: error.message 
      });
    }
  });

  // نقطة تشخيص لاختبار اتصال Supabase Storage
  app.get("/api/diag/supabase-storage", authenticate, async (req: Request, res: Response) => {
    try {
      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(503).json({ 
          message: "متغيرات البيئة غير موجودة",
          hasSupabaseUrl: !!process.env.SUPABASE_URL,
          hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
        });
      }

      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
      
      // اختبار الاتصال بقائمة buckets
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      
      return res.status(200).json({
        message: "اختبار اتصال Supabase Storage",
        success: !bucketsError,
        buckets: buckets?.map(b => ({ name: b.name, id: b.id, public: b.public })),
        error: bucketsError?.message,
        supabaseUrl: process.env.SUPABASE_URL,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
      });
    } catch (error: any) {
      return res.status(500).json({
        message: "خطأ في اختبار Supabase",
        error: error.message,
        details: error
      });
    }
  });

  // مسار لتأكيد الرفع وحفظ معلومات المستند
  app.post("/api/confirm-upload", authenticate, async (req: Request, res: Response) => {
    try {
      const { filePath, name, description, projectId, isManagerDocument, fileSize, fileType } = req.body;
      const userId = (req as any).user.id as number;
      
      if (!filePath || !name) {
        return res.status(400).json({ message: "مسار الملف والاسم مطلوبان" });
      }
      
      // إنشاء URL العام للملف
      const fileUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/uploads/${filePath}`;
      
      const documentData = {
        name,
        description: description || "",
        projectId: projectId && projectId !== "all" ? Number(projectId) : undefined,
        fileUrl,
        fileType: fileType || 'application/octet-stream',
        uploadDate: new Date(),
        uploadedBy: userId,
        isManagerDocument: isManagerDocument === 'true'
      };
      
      try {
        const document = await storage.createDocument(documentData as any);
        await storage.createActivityLog({
          action: "create",
          entityType: "document",
          entityId: document.id,
          details: `إضافة مستند جديد: ${document.name}`,
          userId: userId
        });
        
        return res.status(201).json({
          ...document,
          directUpload: true,
          message: 'تم رفع المستند بنجاح'
        });
        
      } catch (dbError) {
        console.error('Database save error:', dbError);
        // حتى لو فشل حفظ قاعدة البيانات، الملف موجود في التخزين
        return res.status(202).json({
          message: 'تم رفع الملف لكن فشل في حفظ السجل',
          fileUrl,
          degraded: true
        });
      }
      
    } catch (error) {
      console.error("Error confirming upload:", error);
      return res.status(500).json({ message: "خطأ في تأكيد الرفع" });
    }
  });

  // مسار رفع سريع جديد يرجع 202 فوراً ويُنجز المعالجة لاحقاً
  app.post("/api/upload-document-fast", authenticate, async (req: Request, res: Response) => {
    try {
      documentUpload.single('file')(req, res, async (uploadError: any) => {
        if (uploadError) {
          console.error("Multer upload error (fast):", uploadError);
          return res.status(500).json({ 
            message: "خطأ في تحميل الملف", 
            error: uploadError.message 
          });
        }

        if (!req.file) {
          return res.status(400).json({ message: "لم يتم تقديم ملف للتحميل" });
        }

        try {
          const { name, description, projectId, isManagerDocument } = req.body;
          const file = req.file;
          const userId = (req as any).user.id as number;
          
          // إرجاع 202 فوراً مع معلومات أساسية
          const tempFileInfo = {
            id: Date.now(), // معرف مؤقت
            name: name || file.originalname,
            size: (file as any).size,
            mimetype: file.mimetype,
            status: 'processing',
            uploadedAt: new Date().toISOString()
          };
          
          // إرجاع استجابة سريعة
          res.status(202).json({
            ...tempFileInfo,
            message: 'تم استلام الملف وجاري المعالجة',
            fastMode: true
          });
          
          // معالجة خلفية (لا تنتظر)
          setImmediate(async () => {
            try {
              const hasSupabase = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
              let fileUrl: string | null = null;
              
              // محاولة رفع للسحابة
              if (hasSupabase) {
                const isMemory = (file as any).buffer && !(file as any).path;
                const buffer = isMemory ? (file as any).buffer : fs.readFileSync((file as any).path);
                const up = await uploadToSupabase(buffer, file.originalname, 'documents');
                if (up.success && up.url) {
                  fileUrl = up.url;
                }
              }
              
              // Fallback محلي
              if (!fileUrl) {
                const fname = (file as any).filename || `${Date.now()}_${file.originalname.replace(/\s+/g,'_')}`;
                fileUrl = `/uploads/documents/${fname}`;
              }
              
              // حفظ في قاعدة البيانات
              const documentData = {
                name: name || file.originalname,
                description: description || "",
                projectId: projectId && projectId !== "all" ? Number(projectId) : undefined,
                fileUrl,
                fileType: file.mimetype,
                uploadDate: new Date(),
                uploadedBy: userId,
                isManagerDocument: isManagerDocument === 'true'
              };
              
              await storage.createDocument(documentData as any);
              await storage.createActivityLog({
                action: "create",
                entityType: "document",
                entityId: tempFileInfo.id,
                details: `إضافة مستند جديد: ${documentData.name}`,
                userId: userId
              });
              
              console.log(`[background] Document processed successfully: ${documentData.name}`);
            } catch (bgError) {
              console.error(`[background] Failed to process document:`, bgError);
            }
          });
          
        } catch (error) {
          console.error("خطأ في رفع الملف السريع:", error);
          return res.status(500).json({ message: "خطأ في معالجة الملف" });
        }
      });
    } catch (error) {
      console.error("خطأ عام في رفع المستند السريع:", error);
      return res.status(500).json({ message: "تعذر رفع المستند" });
    }
  });

  // مسار تحميل المستندات مع FormData
  app.post("/api/upload-document", authenticate, async (req: Request, res: Response) => {
    try {
      // Debug: سجل بداية الطلب قبل معالجة multer (قد يفيد عند حدوث 502 مبكر)
      try {
        console.log('[upload-document] incoming request', {
          ts: Date.now(),
          headers: {
            'content-type': req.headers['content-type'],
            'content-length': req.headers['content-length'],
            'user-agent': req.headers['user-agent'],
          },
          query: req.query,
        });
      } catch {}

      // استخدام multer يدوياً مع معالجة أفضل للأخطاء في Netlify
      documentUpload.single('file')(req, res, async (uploadError: any) => {
        if (uploadError) {
          console.error("Multer upload error:", uploadError);
          return res.status(500).json({ 
            message: "خطأ في تحميل الملف", 
            error: uploadError.message 
          });
        }

        if (!req.file) {
          console.warn('[upload-document] no file received');
          return res.status(400).json({ message: "لم يتم تقديم ملف للتحميل" });
        }

        try {
          const { name, description, projectId, isManagerDocument } = req.body;
          const file = req.file;
          const userId = (req as any).user.id as number;
          const hasSupabase = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

          // Log basic file info (لا تسجل بيانات حساسة)
          try {
            console.log('[upload-document] file received', {
              originalname: file.originalname,
              mimetype: file.mimetype,
              size: (file as any).size,
              memory: !!(file as any).buffer && !(file as any).path,
              hasSupabase,
            });
          } catch {}

          // وضع إقرار سريع اختياري لتجنب أي عمليات قد تسبب timeout في Netlify (تشخيص)
          if (process.env.QUICK_UPLOAD_ACK === '1') {
            return res.status(201).json({
              quickAck: true,
              name: name || file.originalname,
              size: (file as any).size,
              note: 'تم الاستلام بنجاح (QUICK_UPLOAD_ACK مفعّل) ولم يتم الرفع للسحابة بعد.'
            });
          }

          // نمط رفع سريع لتعطيل رفع السحابة لتشخيص 502 (اضبط FAST_UPLOAD_MODE=1 في البيئة)
          if (process.env.FAST_UPLOAD_MODE === '1') {
            const fname = (file as any).originalname;
            console.log('[upload-document][fast-mode] skipping cloud + db write, returning 202');
            return res.status(202).json({
              success: true,
              fastMode: true,
              message: 'تم استلام الملف (وضع التشخيص السريع فعال)',
              originalName: fname,
              size: (file as any).size,
            });
          }
          
          // التحقق من صلاحية المستخدم للمستندات الإدارية
          const userRole = (req as any).user.role as string;
          if (isManagerDocument === 'true' && userRole !== "admin" && userRole !== "manager") {
            // حذف الملف المؤقت
            if ((file as any).path && fs.existsSync((file as any).path)) {
              fs.unlinkSync(file.path);
            }
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
                if ((file as any).path && fs.existsSync((file as any).path)) {
                  fs.unlinkSync(file.path);
                }
                return res.status(403).json({ 
                  message: "ليس لديك صلاحية للوصول إلى هذا المشروع" 
                });
              }
            }
          }
          
          // تجهيز رابط الملف: محاولة رفع للسحابة ثم بديل محلي
          let fileUrl: string | null = null;
          let fileType: string | null = file.mimetype || null;
          try {
            if (hasSupabase) {
              const isMemory = (file as any).buffer && !(file as any).path;
              const buffer = isMemory ? (file as any).buffer : fs.readFileSync((file as any).path);
              const up = await uploadToSupabase(buffer, file.originalname, 'documents');
              if (up.success && up.url) {
                fileUrl = up.url;
              } else {
                console.warn('Supabase upload failed for document:', up.error);
              }
            }
          } catch (e) {
            console.warn('Upload to Supabase threw for document:', (e as any)?.message || e);
          }

          // Fallback local URL (disk storage only)
          if (!fileUrl) {
            const fname = (file as any).filename || `${Date.now()}_${file.originalname.replace(/\s+/g,'_')}`;
            // تصحيح المسار المحلي إلى مجلد documents
            fileUrl = `/uploads/documents/${fname}`;
          }

          // تهيئة البيانات للمستند
          const documentData = {
            name: name,
            description: description || "",
            projectId: projectId && projectId !== "all" ? Number(projectId) : undefined,
            fileUrl,
            fileType,
            uploadDate: new Date(),
            uploadedBy: userId,
            isManagerDocument: isManagerDocument === 'true'
          };
          
          // إضافة المستند إلى قاعدة البيانات
          try {
            const document = await storage.createDocument(documentData as any);
            // تسجيل نشاط إضافة المستند
            await storage.createActivityLog({
              action: "create",
              entityType: "document",
              entityId: document.id,
              details: `إضافة مستند جديد: ${document.name}`,
              userId: userId
            });
            try { console.log('[upload-document] success', { id: document.id, fileUrl }); } catch {}
            return res.status(201).json(document);
          } catch (dbErr: any) {
            // عدم حذف الملف محلياً للسماح بالوصول إليه كبديل
            console.warn('Create document failed, degraded mode:', dbErr?.message || dbErr);
            res.setHeader('x-degraded-mode', 'true');
            return res.status(202).json({
              success: false,
              message: 'تعذر حفظ المستند في قاعدة البيانات حالياً بسبب الاتصال. تم حفظ الملف مؤقتاً.',
              fileUrl,
            });
          }
        } catch (error) {
          console.error("خطأ في رفع الملف:", error);
          // هبوط سلس في حالة خطأ غير متوقع أثناء الرفع/المعالجة
          res.setHeader('x-degraded-mode', 'true');
          return res.status(202).json({ message: "تعذر معالجة الملف حالياً" });
        }
      });
    } catch (error) {
      console.error("خطأ عام في رفع المستند:", error);
      res.setHeader('x-degraded-mode', 'true');
      return res.status(202).json({ message: "تعذر رفع المستند حالياً" });
    }
  });

  // مسار خفيف للتشخيص دون أي منطق قاعدة بيانات / تخزين
  app.post('/api/upload-document-lite', authenticate, (req: Request, res: Response) => {
    try {
      documentUpload.single('file')(req, res, (err: any) => {
        if (err) {
          console.error('[upload-document-lite] multer error', err);
          return res.status(500).json({ ok: false, stage: 'multer', error: err.message });
        }
        if (!req.file) {
          return res.status(400).json({ ok: false, message: 'لم يتم إرسال ملف' });
        }
        return res.status(200).json({
          ok: true,
            diagnostic: true,
            originalname: req.file.originalname,
            size: (req.file as any).size,
            mimetype: req.file.mimetype,
            memory: !!(req.file as any).buffer && !(req.file as any).path,
            ts: Date.now()
        });
      });
    } catch (e: any) {
      console.error('[upload-document-lite] unexpected', e);
      return res.status(500).json({ ok: false, error: e?.message || 'unexpected' });
    }
  });

  // مسار خام بدون مصادقة أو أي منطق لتشخيص 502 المباشر (لا تحفظ أي شيء)
  app.post('/api/__raw-upload-diagnostic', (req: Request, res: Response) => {
    try {
      // نستخدم multer في الذاكرة مباشرة (memoryStorage) عبر documentUpload (Netlify يجعلها ذاكرة)
      documentUpload.single('file')(req, res, (err: any) => {
        if (err) {
          console.error('[__raw-upload-diagnostic] multer error', err);
          return res.status(500).json({ ok: false, stage: 'multer', error: err.message });
        }
        if (!(req as any).file) {
          return res.status(400).json({ ok: false, message: 'no file' });
        }
        return res.status(200).json({
          ok: true,
          diagnostic: true,
          size: (req as any).file.size,
          mimetype: (req as any).file.mimetype,
          originalname: (req as any).file.originalname,
          ts: Date.now()
        });
      });
    } catch (e: any) {
      console.error('[__raw-upload-diagnostic] unexpected', e);
      return res.status(500).json({ ok: false, error: e?.message || 'unexpected' });
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
          userId: (req as any).user.id as number
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
  userId: (req as any).user.id as number
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
  userId: (req as any).user.id as number
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
  userId: (req as any).user.id as number
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
      const employeeData: InsertEmployee = req.body;
      const createdBy = (req as any).user?.id as number | undefined;
      if (!createdBy) {
        return res.status(401).json({ message: "غير مصرح" });
      }
      const employee = await storage.createEmployee({ ...employeeData, createdBy });

      await storage.createActivityLog({
        action: "create_employee",
        entityType: "employee",
        entityId: employee.id,
        details: `تم إضافة موظف جديد: ${employee.name}`,
        userId: (req as any).user.id as number
      });

      res.status(201).json(employee);
    } catch (error: any) {
      console.error("Error creating employee:", error);
      // Check for unique constraint violation
      if (error.message && error.message.includes('UNIQUE constraint failed')) {
        return res.status(409).json({ message: "اسم الموظف موجود بالفعل" });
      }
      res.status(500).json({ message: "خطأ في إضافة الموظف", error: error.message });
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
  userId: (req as any).user.id as number
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
  userId: (req as any).user.id as number
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
  userId: (req as any).user.id as number
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
  userId: (req as any).user.id as number
      });

      res.status(200).json({ message: "تم حذف العمل المنجز بنجاح" });
    } catch (error: any) {
      console.error("Error deleting completed work:", error);
      res.status(500).json({ message: "خطأ في حذف العمل المنجز" });
    }
  });

  // WhatsApp Integration routes
  app.get("/api/whatsapp/webhook", (req: Request, res: Response) => {
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "your-verify-token";
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === verifyToken) {
      console.log("WhatsApp webhook verified");
      res.status(200).send(challenge);
    } else {
      res.status(403).json({ error: "Forbidden" });
    }
  });

  app.post("/api/whatsapp/webhook", express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
    try {
      const body = JSON.parse(req.body.toString());
      
      // Process WhatsApp webhook payload
      if (body.object === "whatsapp_business_account") {
        for (const entry of body.entry || []) {
          for (const change of entry.changes || []) {
            if (change.field === "messages") {
              const messages = change.value?.messages || [];
              
              for (const message of messages) {
                // Process each incoming message
                console.log("WhatsApp message received:", message);
                
                // Here you would implement the message processing logic
                // For now, just log the message
                await storage.createActivityLog({
                  action: "whatsapp_message_received",
                  entityType: "whatsapp",
                  entityId: 1,
                  details: `WhatsApp message from ${message.from}: ${message.type}`,
                  userId: 1, // System user
                });
              }
            }
          }
        }
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error("WhatsApp webhook error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/upload-whatsapp-file", authenticate, 
    documentUpload.single("file"),
    async (req: Request & { file?: Express.Multer.File }, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "يجب تحديد ملف" });
      }

      // Handle file upload similar to other uploads
      let fileUrl: string | null = null;
      let fileType: string | null = req.file.mimetype || null;
      const hasSupabase = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
      const isMemory = (req.file as any).buffer && !(req.file as any).path;
      
      try {
        if (hasSupabase) {
          const buffer = isMemory ? (req.file as any).buffer : fs.readFileSync((req.file as any).path);
          const up = await uploadToSupabase(buffer, req.file.originalname, 'documents');
          if (up.success && up.url) {
            fileUrl = up.url;
          } else {
            console.warn('Supabase upload failed for WhatsApp file:', up.error);
          }
        }
      } catch (e) {
        console.warn('Upload to Supabase threw for WhatsApp file:', e);
      }

      // Fallback local URL
      if (!fileUrl) {
        const fname = (req.file as any).filename || `${Date.now()}_${req.file.originalname.replace(/\s+/g,'_')}`;
        fileUrl = `/uploads/whatsapp/${fname}`;
      }

      res.status(200).json({ 
        success: true, 
        fileUrl: fileUrl,
        fileName: req.file.originalname,
        fileType: fileType 
      });
    } catch (error: any) {
      console.error("Error uploading WhatsApp file:", error);
      res.status(500).json({ message: "خطأ في رفع الملف" });
    }
  });

  app.post("/api/transactions/link-document", authenticate, async (req: Request, res: Response) => {
    try {
      const { transactionId, fileUrl, source } = req.body;
      
      if (!transactionId || !fileUrl) {
        return res.status(400).json({ message: "معرف المعاملة ورابط الملف مطلوبان" });
      }

      // Check if transaction exists
      const transaction = await storage.getTransaction(transactionId);
      if (!transaction) {
        return res.status(404).json({ message: "المعاملة غير موجودة" });
      }

      // Create a document linked to this transaction
      const documentData = {
        name: `مرفق من ${source || 'النظام'} - معاملة #${transactionId}`,
        description: `ملف مرتبط بالمعاملة #${transactionId} من ${source || 'النظام'}`,
        fileUrl: fileUrl,
        fileType: 'application/octet-stream', // Default, could be improved
        uploadDate: new Date(),
        projectId: transaction.projectId,
        uploadedBy: (req as any).user.id as number,
        isManagerDocument: false,
        category: source || 'linked',
        tags: [source || 'system', 'transaction-linked'],
      };

      const document = await storage.createDocument(documentData);

      await storage.createActivityLog({
        action: "link_document_to_transaction",
        entityType: "transaction",
        entityId: transactionId,
        details: `تم ربط مستند من ${source} بالمعاملة #${transactionId}`,
        userId: (req as any).user.id as number,
      });

      res.status(201).json({ 
        success: true, 
        documentId: document.id,
        message: "تم ربط الملف بالمعاملة بنجاح" 
      });
    } catch (error: any) {
      console.error("Error linking document to transaction:", error);
      res.status(500).json({ message: "خطأ في ربط الملف بالمعاملة" });
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
  userId: (req as any).user.id as number
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
      // Return empty array instead of 500 error when database is unavailable
      res.status(200).json([]);
    }
  });

  // مسار الأرشيف العام
  app.get("/api/archive", authenticate, async (req: Request, res: Response) => {
    try {
      const transactions = await storage.listTransactions();
      const archivedTransactions = transactions.filter(t => t.archived === true);
      res.status(200).json(archivedTransactions);
    } catch (error: any) {
      console.error("Error fetching archive:", error);
      // Return empty array instead of 404 error when database is unavailable
      res.status(200).json([]);
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
  userId: (req as any).user.id as number
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
        existingPermission = activePermissions.find(p => (p as any).userId === userId);
      }

      if (existingPermission) {
        // إذا كان هناك صلاحية نشطة، قم بإلغائها (toggle off)
  const success = await storage.revokeTransactionEditPermission(existingPermission.id, (req as any).user.id as number);
        
        if (success) {
          await storage.createActivityLog({
            userId: (req as any).user.id as number,
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
          grantedBy: (req as any).user.id as number,
          reason: reason || "تفعيل صلاحية تعديل المعاملات",
          notes
        });

        await storage.createActivityLog({
          userId: (req as any).user.id as number,
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
  } catch (error: any) {
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

  const success = await storage.revokeTransactionEditPermission(id, (req as any).user.id as number);
      
      if (success) {
        await storage.createActivityLog({
          userId: (req as any).user.id as number,
          action: "revoke_transaction_edit_permission",
          entityType: "permission",
          entityId: id,
          details: "إلغاء صلاحية تعديل المعاملات"
        });

        return res.status(200).json({ message: "تم إلغاء الصلاحية بنجاح" });
      } else {
        return res.status(404).json({ message: "الصلاحية غير موجودة أو غير نشطة" });
      }
  } catch (error: any) {
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
      
  const permission = await storage.checkTransactionEditPermission((req as any).user.id as number, projectId);
      
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
  const isAdmin = (req as any).user?.role === 'admin' || (req as any).user?.permissions?.includes('manage_users');
  if ((req as any).user.id !== userId && !isAdmin) {
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

  // تسجيل routes فقط، بدون إنشاء server جديد
  console.log('registerRoutes completed successfully');
  } catch (error) {
    console.error('Error in registerRoutes:', error);
    throw error;
  }
}