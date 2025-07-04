import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes-simple";
import { setupVite, serveStatic, log } from "./vite";
import session from "express-session";
import path from "path";
import pgSession from 'connect-pg-simple';

const app = express();

// Set up API routes BEFORE any other middleware to prevent Vite interference
import multer from "multer";
import { storage } from "./storage";

// Set up multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'uploads/transactions');
    },
    filename: (req, file, cb) => {
      const uniqueName = `${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`;
      cb(null, uniqueName);
    }
  }),
  limits: { fileSize: 20 * 1024 * 1024 }
});

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
app.post("/api/transactions", upload.single('file'), async (req: any, res: any) => {
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

    const transaction = await storage.createTransaction(transactionData);
    
    await storage.createActivityLog({
      userId: req.session.userId,
      action: "create_transaction",
      entityType: "transaction", 
      entityId: transaction.id,
      details: `إنشاء معاملة: ${transaction.description} - المبلغ: ${transaction.amount}`
    });

    return res.status(201).json(transaction);
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

// Pay deferred payment installment endpoint - MUST be before registerRoutes to avoid Vite conflicts
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

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Configure session for production
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
    await setupVite(app, server);
  }

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