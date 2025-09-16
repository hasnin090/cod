import express from "express";
import dotenv from "dotenv";

// تحميل متغيرات البيئة
dotenv.config({ override: true });

const app = express();
const PORT = 8000; // منفذ ثابت للاختبار

// middleware أساسي
app.use(express.json());

// endpoint بسيط للاختبار
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'Supabase-only server is running',
    storage: 'Supabase Client API'
  });
});

// بدء الخادم
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Simple test server listening on port ${PORT}`);
  console.log(`🌐 Server running at http://localhost:${PORT}`);
  console.log(`🔍 Server bind address: 0.0.0.0:${PORT}`);
});

app.on('error', (error: any) => {
  console.error('❌ Server error:', error);
});