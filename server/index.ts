import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes-simple";
import { setupVite, serveStatic, log } from "./vite";
import session from "express-session";
import path from "path";
import pgSession from 'connect-pg-simple';
import bcrypt from "bcryptjs";

const app = express();

// Set up API routes BEFORE any other middleware to prevent Vite interference
import { storage } from "./storage";
import { transactionUpload } from "./multer-config";

// Early API route registration to prevent Vite interference
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Set up session middleware early
import MemoryStore from "memorystore";
const MemoryStoreSession = MemoryStore(session);

app.use(session({
  store: new MemoryStoreSession({
    checkPeriod: 86400000,
    max: 5000,
    ttl: 24 * 60 * 60 * 1000
  }),
  secret: process.env.SESSION_SECRET || "accounting-app-secret-key-2025",
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
  }
}));

// Simple transaction creation endpoint
app.post("/api/transactions", transactionUpload.single('file'), async (req: any, res: any) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: "غير مصرح" });
    }

    console.log("Direct transaction creation:", req.body);

    if (!req.body.date || !req.body.amount || !req.body.type || !req.body.description) {
      return res.status(400).json({ message: "جميع الحقول مطلوبة" });
    }

    const transactionData = {
      date: new Date(req.body.date),
      type: req.body.type,
      amount: Number(req.body.amount),
      description: req.body.description,
      projectId: req.body.projectId ? Number(req.body.projectId) : null,
      expenseType: req.body.expenseType || null,
      employeeId: req.body.employeeId ? Number(req.body.employeeId) : null,
      createdBy: req.session.userId,
      fileUrl: req.file ? `/uploads/transactions/${req.file.filename}` : null,
      fileType: req.file ? req.file.mimetype : null,
      archived: false
    };

    // إذا كان نوع المصروف راتب، نحتاج للتعامل مع رصيد الموظف
    if (transactionData.type === 'expense' && 
        transactionData.expenseType === 'راتب' && 
        transactionData.employeeId) {
      
      // التحقق من رصيد الموظف قبل إنشاء المعاملة
      const employee = await storage.getEmployee(transactionData.employeeId);
      if (!employee) {
        return res.status(400).json({ message: "الموظف غير موجود" });
      }
      
      if (!employee.active) {
        return res.status(400).json({ message: "الموظف غير نشط" });
      }
      
      if ((employee.currentBalance || 0) < transactionData.amount) {
        return res.status(400).json({ 
          message: `رصيد الموظف غير كافي. الرصيد المتبقي: ${employee.currentBalance || 0} دينار، المطلوب: ${transactionData.amount} دينار`
        });
      }
      
      // خصم المبلغ من رصيد الموظف وإنشاء المعاملة
      const result = await storage.paySalaryToEmployee(
        transactionData.employeeId,
        transactionData.amount,
        req.session.userId,
        transactionData.description
      );
      
      if (!result) {
        return res.status(500).json({ message: "خطأ في دفع الراتب" });
      }
      
      await storage.createActivityLog({
        userId: req.session.userId,
        action: "create_salary_transaction",
        entityType: "transaction", 
        entityId: result.transaction.id,
        details: `دفع راتب للموظف ${employee.name}: ${transactionData.description} - المبلغ: ${transactionData.amount}`
      });

      return res.status(201).json(result.transaction);
    } else {
      // إنشاء معاملة عادية
      const transaction = await storage.createTransaction(transactionData);
      
      await storage.createActivityLog({
        userId: req.session.userId,
        action: "create_transaction",
        entityType: "transaction", 
        entityId: transaction.id,
        details: `إنشاء معاملة: ${transaction.description} - المبلغ: ${transaction.amount}`
      });

      return res.status(201).json(transaction);
    }
  } catch (error) {
    console.error("Transaction creation error:", error);
    return res.status(500).json({ message: "خطأ في إنشاء المعاملة" });
  }
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});



(async () => {
  // Custom endpoints that override defaults - MUST be BEFORE registerRoutes
  
  // Create user endpoint - Allow proper user creation with project assignment
  app.post("/api/users", async (req: any, res: any) => {
    try {
      if (!req.session || !req.session.userId) {
        return res.status(401).json({ message: "غير مصرح" });
      }

      const userRole = req.session.role;
      if (userRole !== "admin") {
        return res.status(403).json({ message: "غير مصرح - صلاحيات مدير مطلوبة" });
      }

      console.log("بدء إنشاء مستخدم جديد");
      
      // Validate input data
      const userData = req.body;
      if (!userData.username || !userData.name || !userData.password || !userData.role) {
        return res.status(400).json({ message: "بيانات المستخدم غير مكتملة" });
      }

      // Hash password
      userData.password = await bcrypt.hash(userData.password, 10);
      
      // Extract projectId before creating user
      const projectId = userData.projectId;
      delete userData.projectId;
      
      // Ensure permissions array is defined
      if (!userData.permissions) {
        userData.permissions = [];
      }
      
      console.log("بيانات المستخدم قبل الإدخال في قاعدة البيانات:", {
        ...userData,
        password: "***مخفية***"
      });
      
      const user = await storage.createUser(userData);
      console.log("تم إنشاء المستخدم بنجاح:", { id: user.id, username: user.username });
      
      // If project is specified, assign user to project
      if (projectId) {
        console.log(`ربط المستخدم ${user.id} بالمشروع ${projectId}`);
        try {
          await storage.assignUserToProject({
            userId: user.id,
            projectId: Number(projectId),
            assignedBy: req.session.userId,
          });
          console.log(`تم ربط المستخدم ${user.id} بالمشروع ${projectId} بنجاح`);
        } catch (assignError) {
          console.error("خطأ في ربط المستخدم بالمشروع:", assignError);
          // Don't fail user creation if project assignment fails
        }
      }
      
      await storage.createActivityLog({
        userId: req.session.userId,
        action: "create_user",
        entityType: "user",
        entityId: user.id,
        details: `إنشاء مستخدم جديد: ${user.username}${projectId ? ` وربطه بالمشروع ${projectId}` : ''}`
      });

      // Return user without password
      const { password, ...safeUser } = user;
      return res.status(201).json(safeUser);
    } catch (error) {
      console.error("خطأ في إنشاء المستخدم:", error);
      return res.status(500).json({ 
        message: error instanceof Error ? error.message : "خطأ في إنشاء المستخدم" 
      });
    }
  });

  // Assign user to project endpoint
  app.post("/api/users/:userId/assign-project", async (req: any, res: any) => {
    try {
      if (!req.session || !req.session.userId) {
        return res.status(401).json({ message: "غير مصرح" });
      }

      const userRole = req.session.role;
      if (userRole !== "admin") {
        return res.status(403).json({ message: "غير مصرح - صلاحيات مدير مطلوبة" });
      }

      const userId = parseInt(req.params.userId);
      const { projectId } = req.body;

      if (isNaN(userId) || !projectId) {
        return res.status(400).json({ message: "معرف المستخدم ومعرف المشروع مطلوبان" });
      }

      // Check if user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "المستخدم غير موجود" });
      }

      // Check if project exists
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "المشروع غير موجود" });
      }

      await storage.assignUserToProject({
        userId: userId,
        projectId: Number(projectId),
        assignedBy: req.session.userId,
      });

      await storage.createActivityLog({
        userId: req.session.userId,
        action: "assign_user_to_project",
        entityType: "user_project",
        entityId: userId,
        details: `ربط المستخدم ${user.username} بالمشروع ${project.name}`
      });

      return res.status(200).json({ message: "تم ربط المستخدم بالمشروع بنجاح" });
    } catch (error) {
      console.error("خطأ في ربط المستخدم بالمشروع:", error);
      return res.status(500).json({ 
        message: error instanceof Error ? error.message : "خطأ في ربط المستخدم بالمشروع" 
      });
    }
  });

  // Remove user from project endpoint
  app.delete("/api/users/:userId/remove-project/:projectId", async (req: any, res: any) => {
    try {
      if (!req.session || !req.session.userId) {
        return res.status(401).json({ message: "غير مصرح" });
      }

      const userRole = req.session.role;
      if (userRole !== "admin") {
        return res.status(403).json({ message: "غير مصرح - صلاحيات مدير مطلوبة" });
      }

      const userId = parseInt(req.params.userId);
      const projectId = parseInt(req.params.projectId);

      if (isNaN(userId) || isNaN(projectId)) {
        return res.status(400).json({ message: "معرف المستخدم ومعرف المشروع مطلوبان" });
      }

      const success = await storage.removeUserFromProject(userId, projectId);
      if (!success) {
        return res.status(404).json({ message: "الربط غير موجود" });
      }

      await storage.createActivityLog({
        userId: req.session.userId,
        action: "remove_user_from_project",
        entityType: "user_project",
        entityId: userId,
        details: `إزالة ربط المستخدم ${userId} من المشروع ${projectId}`
      });

      return res.status(200).json({ message: "تم إزالة ربط المستخدم من المشروع بنجاح" });
    } catch (error) {
      console.error("خطأ في إزالة ربط المستخدم من المشروع:", error);
      return res.status(500).json({ 
        message: error instanceof Error ? error.message : "خطأ في إزالة الربط" 
      });
    }
  });

  // User projects endpoint - Override version in routes-simple.ts
  app.get("/api/user-projects", async (req: any, res: any) => {
    try {
      if (!req.session || !req.session.userId) {
        return res.status(401).json({ message: "غير مصرح" });
      }

      const userId = req.session.userId;
      console.log(`جلب مشاريع المستخدم الحالي، معرف المستخدم: ${userId}`);
      
      const projects = await storage.getUserProjects(userId);
      console.log(`تم العثور على ${projects.length} مشروع للمستخدم رقم ${userId}`);
      
      return res.status(200).json(projects);
    } catch (error) {
      console.error("خطأ في جلب مشاريع المستخدم الحالي:", error);
      return res.status(200).json([]);
    }
  });

  // Create deferred payment endpoint - Allow users to add receivables for their projects
  app.post("/api/deferred-payments", async (req: any, res: any) => {
    try {
      if (!req.session || !req.session.userId) {
        return res.status(401).json({ message: "غير مصرح" });
      }

      const userId = req.session.userId;
      const userRole = req.session.role;
      
      // التحقق من البيانات المطلوبة
      const { beneficiaryName, totalAmount, projectId } = req.body;
      
      if (!beneficiaryName || !totalAmount || totalAmount <= 0) {
        return res.status(400).json({ message: "اسم المستفيد والمبلغ مطلوبان" });
      }

      // إذا كان المستخدم عادي وحدد مشروع، تحقق من صلاحية الوصول للمشروع
      if (userRole !== "admin" && projectId) {
        const hasAccess = await storage.checkUserProjectAccess(userId, projectId);
        if (!hasAccess) {
          return res.status(403).json({ message: "غير مصرح لك بإضافة مستحقات لهذا المشروع" });
        }
      }

      // إنشاء بيانات المستحق
      const paymentData = {
        beneficiaryName,
        totalAmount: Number(totalAmount),
        remainingAmount: Number(totalAmount),
        paidAmount: 0,
        projectId: projectId ? Number(projectId) : null,
        description: req.body.description || "",
        dueDate: req.body.dueDate || null,
        status: "pending",
        userId: userId,
        installments: req.body.installments || 1,
        paymentFrequency: req.body.paymentFrequency || "monthly"
      };

      console.log(`Creating deferred payment by user ${userId}:`, paymentData);
      
      const payment = await storage.createDeferredPayment(paymentData);
      
      await storage.createActivityLog({
        userId: userId,
        action: "create_deferred_payment",
        entityType: "deferred_payment",
        entityId: payment.id,
        details: `إنشاء مستحق جديد: ${beneficiaryName} - المبلغ: ${totalAmount}`
      });

      return res.status(201).json(payment);
    } catch (error) {
      console.error("خطأ في إنشاء المستحق:", error);
      return res.status(500).json({ 
        message: error instanceof Error ? error.message : "خطأ في إنشاء المستحق" 
      });
    }
  });

  // Pay deferred payment installment endpoint
  app.post("/api/deferred-payments/:id/pay", async (req: any, res: any) => {
    try {
      if (!req.session || !req.session.userId) {
        return res.status(401).json({ message: "غير مصرح" });
      }

      const id = parseInt(req.params.id);
      const { amount } = req.body;
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "معرف المستحق غير صحيح" });
      }
      
      const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
      
      if (!numericAmount || isNaN(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({ message: "مبلغ الدفعة مطلوب ويجب أن يكون أكبر من الصفر" });
      }
      
      console.log(`Processing payment for deferred payment ${id}, amount: ${numericAmount}, user: ${req.session.userId}`);
      
      const result = await storage.payDeferredPaymentInstallment(id, numericAmount, req.session.userId);
      
      await storage.createActivityLog({
        userId: req.session.userId,
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

  // Excel/CSV Export endpoint
  app.post("/api/transactions/export/excel", async (req: any, res: any) => {
    try {
      if (!req.session || !req.session.userId) {
        return res.status(401).json({ message: "غير مصرح" });
      }

      console.log('🔄 بدء تصدير CSV...');
      const userId = req.session.userId;
      const userRole = req.session.role;
      
      const filters = {
        projectId: req.body.projectId ? parseInt(req.body.projectId) : undefined,
        type: req.body.type || undefined,
        dateFrom: req.body.dateFrom || undefined,
        dateTo: req.body.dateTo || undefined,
        userId,
        userRole
      };
      
      console.log('📊 تصدير CSV مع الفلاتر:', filters);
      
      // جلب المعاملات حسب دور المستخدم
      let transactions;
      if (userRole === 'admin' || userRole === 'manager') {
        transactions = await storage.listTransactions();
      } else {
        transactions = await storage.getTransactionsForUserProjects(userId);
      }
      
      if (!transactions || transactions.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'لا توجد بيانات للتصدير'
        });
      }
      
      console.log(`📈 تم جلب ${transactions.length} معاملة للتصدير`);
      
      // تحضير بيانات CSV
      const csvHeaders = userRole === 'viewer' 
        ? ['التاريخ', 'الوصف', 'المشروع', 'نوع المصروف', 'المبلغ']
        : ['التاريخ', 'الوصف', 'المشروع', 'النوع', 'نوع المصروف', 'المبلغ'];
      
      let csvContent = csvHeaders.join(',') + '\n';
      
      for (const transaction of transactions) {
        const formattedDate = new Date(transaction.date).toLocaleDateString('ar-IQ');
        const description = (transaction.description || '').replace(/,/g, ';').replace(/"/g, '""');
        const projectName = (transaction.projectName || 'بدون مشروع').replace(/,/g, ';').replace(/"/g, '""');
        const expenseType = (transaction.expenseType || '').replace(/,/g, ';').replace(/"/g, '""');
        const amount = transaction.amount || 0;
        
        let csvRow;
        if (userRole === 'viewer') {
          csvRow = [
            `"${formattedDate}"`,
            `"${description}"`,
            `"${projectName}"`,
            `"${expenseType}"`,
            amount
          ].join(',');
        } else {
          const typeText = transaction.type === 'income' ? 'إيراد' : 'مصروف';
          csvRow = [
            `"${formattedDate}"`,
            `"${description}"`,
            `"${projectName}"`,
            `"${typeText}"`,
            `"${expenseType}"`,
            amount
          ].join(',');
        }
        
        csvContent += csvRow + '\n';
      }
      
      // إنشاء مجلد التصدير
      const fs = await import('fs');
      const path = await import('path');
      
      const exportDir = './exports';
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }
      
      // إنشاء اسم الملف
      const timestamp = Date.now();
      const fileName = `transactions_export_${timestamp}.csv`;
      const filePath = path.join(exportDir, fileName);
      
      console.log(`✅ تم إنشاء ملف CSV مع ${transactions.length} معاملة`);
      
      // إرسال الملف مباشرة للتحميل بدلاً من إرجاع رابط
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="transactions_export_${timestamp}.csv"`);
      res.setHeader('Cache-Control', 'no-cache');
      
      // إرسال الملف مع BOM للدعم العربي في Excel
      const bom = '\uFEFF';
      res.send(bom + csvContent);
      
    } catch (error) {
      console.error('❌ خطأ في تصدير CSV:', error);
      res.status(500).json({
        success: false,
        message: `فشل في تصدير البيانات: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`,
        error: error instanceof Error ? error.stack : String(error)
      });
    }
  });

  // Employee salary management routes
  app.post('/api/employees/:id/pay-salary', async (req, res) => {
    try {
      if (!req.session.user) {
        return res.status(401).json({ message: 'غير مصرح' });
      }

      const employeeId = parseInt(req.params.id);
      const { amount, description } = req.body;
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: 'مبلغ الراتب مطلوب ويجب أن يكون أكبر من صفر' });
      }

      const result = await storage.paySalaryToEmployee(employeeId, amount, req.session.user.id, description);
      
      if (!result) {
        return res.status(400).json({ message: 'فشل في دفع الراتب' });
      }

      console.log(`دفع راتب للموظف ${employeeId} بمبلغ ${amount} من قبل المستخدم ${req.session.user.id}`);
      res.json(result);
    } catch (error) {
      console.error('Error paying salary:', error);
      res.status(500).json({ message: error.message || 'خطأ في دفع الراتب' });
    }
  });

  // Reset all employee salaries (admin only)
  app.post('/api/employees/reset-salaries', async (req, res) => {
    try {
      if (!req.session.user) {
        return res.status(401).json({ message: 'غير مصرح' });
      }

      // Only admin or manager can reset all salaries
      if (req.session.user.role !== 'admin' && req.session.user.role !== 'manager') {
        return res.status(403).json({ message: 'صلاحية غير كافية' });
      }

      const result = await storage.resetAllEmployeeSalaries();
      console.log(`إعادة تعيين رواتب ${result.count} موظف من قبل ${req.session.user.username}`);
      res.json(result);
    } catch (error) {
      console.error('Error resetting salaries:', error);
      res.status(500).json({ message: 'خطأ في إعادة تعيين الرواتب', error: error.message });
    }
  });

  // Get employee salary details
  app.get('/api/employees/:id/salary-details', async (req, res) => {
    try {
      if (!req.session.user) {
        return res.status(401).json({ message: 'غير مصرح' });
      }

      const employeeId = parseInt(req.params.id);
      const details = await storage.getEmployeeSalaryDetails(employeeId);
      
      if (!details) {
        return res.status(404).json({ message: 'الموظف غير موجود' });
      }

      res.json(details);
    } catch (error) {
      console.error('Error getting employee salary details:', error);
      res.status(500).json({ message: 'خطأ في جلب تفاصيل راتب الموظف', error: error.message });
    }
  });

  // Auto-check for salary reset every hour
  setInterval(async () => {
    try {
      const employeesToReset = await storage.checkEmployeesForSalaryReset();
      if (employeesToReset.length > 0) {
        console.log(`وجد ${employeesToReset.length} موظف يحتاج إعادة تعيين راتب`);
        await storage.resetAllEmployeeSalaries();
      }
    } catch (error) {
      console.error('خطأ في التحقق التلقائي من إعادة تعيين الرواتب:', error);
    }
  }, 60 * 60 * 1000); // كل ساعة

  // Register API routes AFTER custom endpoints
  const server = await registerRoutes(app);

  // Configure for production vs development 
  if (app.get("env") === "production") {
    app.set("trust proxy", 1);
    const PostgresStore = pgSession(session);

    app.use(session({
      store: new PostgresStore({
        conObject: {
          connectionString: process.env.DATABASE_URL,
          ssl: { rejectUnauthorized: false }
        }
      }),
      secret: process.env.SESSION_SECRET || 'development-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { 
        secure: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'strict',
        httpOnly: true
      }
    }));
    // Serve static files from the build directory
    const { fileURLToPath } = await import('url');
    const { dirname } = await import('path');
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    app.use(express.static(path.resolve(__dirname, "public")));
    // Handle client-side routing
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(__dirname, "public", "index.html"));
    });
  } else {
    // Setup Vite AFTER routes are registered
    await setupVite(app, server);
  }

  // Error handler at the end
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Use PORT from environment for deployment platforms like Railway
  // Fallback to 5000 for local development
  const port = process.env.PORT || 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();