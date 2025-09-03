import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import http from "http";
import path from "path";
import compression from "compression";
import helmet from "helmet";

import { setupVite, serveStatic, log } from "./vite";
import { registerRoutes } from "./routes-simple";

// التخزين والمنطق
import { storage } from "./storage";
import { transactionUpload } from "./multer-config";
import { initializeSupabaseStorage } from "./supabase-storage";

// تهيئة Supabate Storage
console.log('Initializing Supabate Storage...');
initializeSupabaseStorage().then(success => {
  if (success) {
    console.log('✅ Supabate Storage initialized successfully');
  } else {
    console.log('⚠️ Supabate Storage initialization failed, will use fallback storage');
  }
}).catch(error => {
  console.error('❌ Error during Supabate Storage initialization:', error);
});

async function startServer() {
  // إنشاء التطبيق والخادم
  const app = express();
  const server = http.createServer(app);

  // الثقة بالـ proxy (مطلوب خلف Nginx/Render/Heroku)
  app.set("trust proxy", 1);

  // أمان وأداء
  app.use(helmet());
  app.use(compression());

  // بارس للطلبات
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false }));

  // ملاحظة: تهيئة الجلسات تتم داخل registerRoutes لضمان اتساق الإعدادات عبر البيئات.

  // خدمة مجلد الرفع
  const uploadsDir = path.resolve(process.env.UPLOADS_DIR || "uploads");
  app.use("/uploads", express.static(uploadsDir));

  // تسجيل الراوترات أولاً (يتضمن تهيئة الجلسات داخلياً)
  await registerRoutes(app);

// مسار إنشاء المعاملة - يُسجل بعد الراوترات الافتراضية ليكون هو المُقدّم
app.post(
  "/api/transactions",
  transactionUpload.single("file"),
  async (
    req: Request & {
      file?: Express.Multer.File;
    },
    res: Response,
  ) => {
    try {
  // JWT user injected by auth in routes-simple
  const currentUserId = (req as any).user?.id;
  if (!currentUserId) {
        return res.status(401).json({ message: "غير مصرح" });
      }

      const { date, amount, type, description, projectId, expenseType, employeeId } =
        req.body;

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

      const transactionData = {
        date: parsedDate,
        type,
        amount: parsedAmount,
        description,
        projectId: projectId ? Number(projectId) : null,
        expenseType: expenseType || null,
        employeeId: employeeId ? Number(employeeId) : null,
  createdBy: currentUserId!,
        fileUrl: req.file ? `/uploads/transactions/${req.file.filename}` : null,
        fileType: req.file ? req.file.mimetype : null,
        archived: false,
      };

      // التحقق المتعلق بالرواتب
      if (
        transactionData.type === "expense" &&
        transactionData.expenseType === "راتب" &&
        transactionData.employeeId
      ) {
        const employee = await storage.getEmployee(transactionData.employeeId);
        if (!employee) {
          return res.status(400).json({ message: "الموظف غير موجود" });
        }
        if (!employee.active) {
          return res
            .status(400)
            .json({ message: "لا يمكن صرف راتب لموظف غير فعّال" });
        }
        // يمكن إضافة منطق سلف/رصيد هنا إذا موجود
      }

      const created = await storage.createTransaction(transactionData);
      return res
        .status(201)
        .json({ message: "تم إنشاء المعاملة", data: created });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "حدث خطأ غير متوقع" });
    }
  },
);

// 404 لمسارات API غير المعروفة
app.use("/api", (_req, res) =>
  res.status(404).json({ message: "المورد غير موجود" }),
);

// هاندلر أخطاء عام
app.use(
  (err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ message: "حدث خطأ في الخادم" });
  },
);

  // تشغيل الواجهة: تطوير vs إنتاج
  const PORT = Number(process.env.PORT || 3001);

  // تشغيل الخادم بشكل مباشر للاختبار
  server.listen(PORT, () => {
    console.log(`✅ Server successfully listening on port ${PORT}`);
    console.log(`🌐 Server running at http://localhost:${PORT}`);
  });
}

// تشغيل الخادم
startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});