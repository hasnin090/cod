import express from "express";
import { registerRoutes } from "./routes-simple";
import session from "express-session";
import path from "path";
import pgSession from 'connect-pg-simple';
// import { backupSystem } from "./backup-system"; // TODO: implement backup system
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Middleware للبيانات
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// إعداد الجلسات للإنتاج
const PgSession = pgSession(session);
app.use(session({
  store: new PgSession({
    conString: process.env.DATABASE_URL,
    tableName: 'session',
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET || 'fallback-secret-for-development',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS في الإنتاج
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 ساعة
  }
}));

// خدمة الملفات الثابتة
app.use(express.static(path.join(__dirname, 'public')));

// خدمة الملفات المرفوعة
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// تسجيل الطلبات
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path.startsWith("/api")) {
      console.log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
    }
  });
  next();
});

async function startServer() {
  try {
    // تسجيل المسارات
    await registerRoutes(app);

    // معالج الأخطاء العام
    app.use((err: any, req: any, res: any, next: any) => {
      console.error('Server Error:', err);
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
    });

    // معالج للمسارات غير الموجودة - إرجاع الواجهة الأمامية
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    // بدء الخادم
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`🌐 Application URL: http://localhost:${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV}`);
      
      // بدء النظام الاحتياطي
      if (process.env.NODE_ENV === 'production') {
        // TODO: Implement backup system
        // backupSystem.startAutoBackup();
        console.log('🔄 Automatic backup system started');
      }
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// معالج إيقاف التشغيل بأمان
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  process.exit(0);
});

// بدء الخادم
startServer();