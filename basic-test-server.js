import express from 'express';
import dotenv from 'dotenv';

// تحميل متغيرات البيئة
dotenv.config({ override: true });

const app = express();
const PORT = Number(process.env.PORT || 8000);

console.log('Starting basic test server...');

// middleware أساسي
app.use(express.json());

// endpoint بسيط للاختبار
app.get('/api/health', (req, res) => {
  console.log('Health endpoint called');
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'Basic test server is working',
    port: PORT
  });
});

// معالج الأخطاء
app.on('error', (error) => {
  console.error('❌ Server error:', error);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// بدء الخادم - ربط بـ localhost فقط لأمان أكبر
const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`✅ Basic test server listening on port ${PORT}`);
  console.log(`🌐 Server running at http://localhost:${PORT}`);
  console.log(`🔍 Server bind address: 127.0.0.1:${PORT}`);
});

server.on('error', (error) => {
  console.error('❌ Server listen error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
  }
});

console.log('Server setup completed. Waiting for connections...');