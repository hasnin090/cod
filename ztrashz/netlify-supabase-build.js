import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// إنشاء مجلد public للنشر
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// إنشاء مجلد netlify/functions
const functionsDir = path.join(__dirname, 'netlify', 'functions');
if (!fs.existsSync(functionsDir)) {
  fs.mkdirSync(functionsDir, { recursive: true });
}

// إنشاء ملف HTML الرئيسي
const indexHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>نظام المحاسبة العربي</title>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        .rtl { direction: rtl; text-align: right; }
        .login-form { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .card { background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); }
        .btn-primary { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); }
        .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4); }
        .sidebar { background: linear-gradient(180deg, #1e293b 0%, #334155 100%); }
        .menu-item:hover { background: rgba(255, 255, 255, 0.1); }
        .stats-card { background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); }
        .spinner { border: 3px solid #f3f3f3; border-top: 3px solid #4f46e5; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
</head>
<body class="bg-gray-50">
    <div id="app"></div>
    
    <!-- React and Dependencies -->
    <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <script src="https://unpkg.com/@supabase/supabase-js@2"></script>
    
    <script type="text/babel">
        const { useState, useEffect, useContext, createContext } = React;
        
        // Supabase Configuration
        const supabaseUrl = 'https://your-project.supabase.co';
        const supabaseAnonKey = 'your-anon-key';
        const supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
        
        // Auth Context
        const AuthContext = createContext();
        
        const AuthProvider = ({ children }) => {
            const [user, setUser] = useState(null);
            const [loading, setLoading] = useState(true);
            
            useEffect(() => {
                checkAuth();
            }, []);
            
            const checkAuth = async () => {
                try {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session?.user) {
                        const { data: profile } = await supabase
                            .from('users')
                            .select('*')
                            .eq('email', session.user.email)
                            .single();
                        setUser(profile);
                    }
                } catch (error) {
                    console.error('Auth check error:', error);
                } finally {
                    setLoading(false);
                }
            };
            
            const login = async (email, password) => {
                try {
                    const { data, error } = await supabase.auth.signInWithPassword({
                        email,
                        password
                    });
                    
                    if (error) throw error;
                    
                    const { data: profile } = await supabase
                        .from('users')
                        .select('*')
                        .eq('email', email)
                        .single();
                    
                    setUser(profile);
                    return { success: true };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            };
            
            const logout = async () => {
                await supabase.auth.signOut();
                setUser(null);
            };
            
            return (
                <AuthContext.Provider value={{ user, login, logout, loading }}>
                    {children}
                </AuthContext.Provider>
            );
        };
        
        // Login Component
        const Login = () => {
            const [email, setEmail] = useState('');
            const [password, setPassword] = useState('');
            const [loading, setLoading] = useState(false);
            const [error, setError] = useState('');
            const { login } = useContext(AuthContext);
            
            const handleSubmit = async (e) => {
                e.preventDefault();
                setLoading(true);
                setError('');
                
                const result = await login(email, password);
                
                if (!result.success) {
                    setError(result.error || 'خطأ في تسجيل الدخول');
                }
                
                setLoading(false);
            };
            
            return (
                <div className="min-h-screen flex items-center justify-center login-form">
                    <div className="card max-w-md w-full space-y-8 p-8 rounded-lg shadow-xl">
                        <div className="text-center">
                            <h2 className="text-3xl font-bold text-gray-900 mb-2">نظام المحاسبة العربي</h2>
                            <p className="text-gray-600">مرحباً بك في نظام إدارة الحسابات</p>
                        </div>
                        
                        <form className="mt-8 space-y-6 rtl" onSubmit={handleSubmit}>
                            {error && (
                                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                                    {error}
                                </div>
                            )}
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        البريد الإلكتروني
                                    </label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        required
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        كلمة المرور
                                    </label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        required
                                    />
                                </div>
                            </div>
                            
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full btn-primary text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200"
                            >
                                {loading ? (
                                    <div className="flex items-center justify-center">
                                        <div className="spinner mr-2"></div>
                                        جاري تسجيل الدخول...
                                    </div>
                                ) : (
                                    'تسجيل الدخول'
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            );
        };
        
        // Dashboard Component
        const Dashboard = () => {
            const [stats, setStats] = useState({
                totalIncome: 0,
                totalExpenses: 0,
                balance: 0,
                transactions: 0
            });
            const [loading, setLoading] = useState(true);
            const { user, logout } = useContext(AuthContext);
            
            useEffect(() => {
                loadStats();
            }, []);
            
            const loadStats = async () => {
                try {
                    // Load transactions and calculate stats
                    const { data: transactions } = await supabase
                        .from('transactions')
                        .select('*');
                    
                    const income = transactions
                        .filter(t => t.type === 'income')
                        .reduce((sum, t) => sum + t.amount, 0);
                    
                    const expenses = transactions
                        .filter(t => t.type === 'expense')
                        .reduce((sum, t) => sum + t.amount, 0);
                    
                    setStats({
                        totalIncome: income,
                        totalExpenses: expenses,
                        balance: income - expenses,
                        transactions: transactions.length
                    });
                } catch (error) {
                    console.error('Error loading stats:', error);
                } finally {
                    setLoading(false);
                }
            };
            
            const formatCurrency = (amount) => {
                return new Intl.NumberFormat('ar-IQ', {
                    style: 'currency',
                    currency: 'IQD'
                }).format(amount);
            };
            
            return (
                <div className="min-h-screen bg-gray-50">
                    <div className="flex">
                        {/* Sidebar */}
                        <div className="sidebar w-64 min-h-screen text-white">
                            <div className="p-6">
                                <h1 className="text-xl font-bold mb-8">نظام المحاسبة</h1>
                                
                                <nav className="space-y-2">
                                    <a href="#" className="menu-item block py-2 px-4 rounded hover:bg-gray-700">
                                        📊 لوحة التحكم
                                    </a>
                                    <a href="#" className="menu-item block py-2 px-4 rounded hover:bg-gray-700">
                                        💰 المعاملات
                                    </a>
                                    <a href="#" className="menu-item block py-2 px-4 rounded hover:bg-gray-700">
                                        📁 المشاريع
                                    </a>
                                    <a href="#" className="menu-item block py-2 px-4 rounded hover:bg-gray-700">
                                        👥 المستخدمين
                                    </a>
                                    <a href="#" className="menu-item block py-2 px-4 rounded hover:bg-gray-700">
                                        ⚙️ الإعدادات
                                    </a>
                                </nav>
                                
                                <div className="mt-8 pt-8 border-t border-gray-600">
                                    <div className="flex items-center mb-4">
                                        <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-sm font-bold mr-3">
                                            {user?.name?.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">{user?.name}</p>
                                            <p className="text-xs text-gray-300">{user?.role}</p>
                                        </div>
                                    </div>
                                    
                                    <button
                                        onClick={logout}
                                        className="w-full text-left py-2 px-4 text-sm text-red-300 hover:bg-red-900 rounded"
                                    >
                                        تسجيل الخروج
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        {/* Main Content */}
                        <div className="flex-1 p-6">
                            <div className="rtl">
                                <h2 className="text-2xl font-bold text-gray-900 mb-6">لوحة التحكم الرئيسية</h2>
                                
                                {loading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <div className="spinner"></div>
                                        <span className="mr-2">جاري تحميل البيانات...</span>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                        <div className="stats-card p-6 rounded-lg shadow">
                                            <div className="flex items-center">
                                                <div className="p-3 bg-green-100 rounded-full">
                                                    <span className="text-2xl">💵</span>
                                                </div>
                                                <div className="mr-4">
                                                    <p className="text-sm text-gray-600">إجمالي الإيرادات</p>
                                                    <p className="text-2xl font-bold text-green-600">
                                                        {formatCurrency(stats.totalIncome)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="stats-card p-6 rounded-lg shadow">
                                            <div className="flex items-center">
                                                <div className="p-3 bg-red-100 rounded-full">
                                                    <span className="text-2xl">💸</span>
                                                </div>
                                                <div className="mr-4">
                                                    <p className="text-sm text-gray-600">إجمالي المصروفات</p>
                                                    <p className="text-2xl font-bold text-red-600">
                                                        {formatCurrency(stats.totalExpenses)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="stats-card p-6 rounded-lg shadow">
                                            <div className="flex items-center">
                                                <div className="p-3 bg-blue-100 rounded-full">
                                                    <span className="text-2xl">💰</span>
                                                </div>
                                                <div className="mr-4">
                                                    <p className="text-sm text-gray-600">الرصيد الحالي</p>
                                                    <p className="text-2xl font-bold text-blue-600">
                                                        {formatCurrency(stats.balance)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="stats-card p-6 rounded-lg shadow">
                                            <div className="flex items-center">
                                                <div className="p-3 bg-purple-100 rounded-full">
                                                    <span className="text-2xl">📊</span>
                                                </div>
                                                <div className="mr-4">
                                                    <p className="text-sm text-gray-600">عدد المعاملات</p>
                                                    <p className="text-2xl font-bold text-purple-600">
                                                        {stats.transactions}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            );
        };
        
        // Main App Component
        const App = () => {
            const { user, loading } = useContext(AuthContext);
            
            if (loading) {
                return (
                    <div className="min-h-screen flex items-center justify-center">
                        <div className="spinner"></div>
                        <span className="mr-2">جاري تحميل النظام...</span>
                    </div>
                );
            }
            
            return user ? <Dashboard /> : <Login />;
        };
        
        // Render App
        ReactDOM.render(
            <AuthProvider>
                <App />
            </AuthProvider>,
            document.getElementById('app')
        );
    </script>
</body>
</html>`;

fs.writeFileSync(path.join(publicDir, 'index.html'), indexHtml);

// إنشاء ملف _redirects للتوجيه
const redirects = `# Netlify redirects
/api/* /.netlify/functions/api/:splat 200
/* /index.html 200`;

fs.writeFileSync(path.join(publicDir, '_redirects'), redirects);

// إنشاء دالة Netlify الرئيسية
const netlifyFunction = `const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

exports.handler = async (event, context) => {
    // CORS Headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        const path = event.path.replace('/.netlify/functions/api', '');
        const method = event.httpMethod;
        
        // Database status endpoint
        if (path === '/database/status' && method === 'GET') {
            const start = Date.now();
            await sql\`SELECT 1\`;
            const responseTime = Date.now() - start;
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    connected: true,
                    responseTime,
                    timestamp: new Date().toISOString()
                })
            };
        }
        
        // Users endpoint
        if (path === '/users' && method === 'GET') {
            const users = await sql\`SELECT id, username, name, email, role FROM users\`;
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(users)
            };
        }
        
        // Transactions endpoint
        if (path === '/transactions' && method === 'GET') {
            const transactions = await sql\`
                SELECT t.*, p.name as project_name, u.name as created_by_name
                FROM transactions t
                LEFT JOIN projects p ON t.project_id = p.id
                LEFT JOIN users u ON t.created_by = u.id
                ORDER BY t.created_at DESC
                LIMIT 50
            \`;
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(transactions)
            };
        }
        
        // Dashboard stats endpoint
        if (path === '/dashboard' && method === 'GET') {
            const [incomeResult, expenseResult, transactionCount] = await Promise.all([
                sql\`SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'income'\`,
                sql\`SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'expense'\`,
                sql\`SELECT COUNT(*) as count FROM transactions\`
            ]);
            
            const totalIncome = Number(incomeResult[0]?.total || 0);
            const totalExpenses = Number(expenseResult[0]?.total || 0);
            const balance = totalIncome - totalExpenses;
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    totalIncome,
                    totalExpenses,
                    balance,
                    transactionCount: Number(transactionCount[0]?.count || 0)
                })
            };
        }
        
        // Projects endpoint
        if (path === '/projects' && method === 'GET') {
            const projects = await sql\`
                SELECT p.*, u.name as created_by_name
                FROM projects p
                LEFT JOIN users u ON p.created_by = u.id
                ORDER BY p.created_at DESC
            \`;
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(projects)
            };
        }
        
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Endpoint not found' })
        };
        
    } catch (error) {
        console.error('Function error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};`;

fs.writeFileSync(path.join(functionsDir, 'api.js'), netlifyFunction);

// إنشاء ملف package.json للدوال
const functionsPackageJson = {
    "name": "accounting-system-functions",
    "version": "1.0.0",
    "dependencies": {
        "@neondatabase/serverless": "^0.9.0",
        "@supabase/supabase-js": "^2.0.0"
    }
};

fs.writeFileSync(path.join(functionsDir, 'package.json'), JSON.stringify(functionsPackageJson, null, 2));

// إنشاء ملف netlify.toml المحدث
const netlifyConfig = `[build]
  command = "node netlify-supabase-build.js"
  publish = "public"
  functions = "netlify/functions"

[build.environment]
  NODE_VERSION = "18"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/api/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[functions]
  node_bundler = "esbuild"`;

fs.writeFileSync(path.join(__dirname, 'netlify.toml'), netlifyConfig);

console.log('✅ تم إنشاء ملفات Netlify + Supabase بنجاح!');
console.log('📁 الملفات المنشأة:');
console.log('  - public/index.html (واجهة المستخدم)');
console.log('  - public/_redirects (إعدادات التوجيه)');
console.log('  - netlify/functions/api.js (دوال الواجهة الخلفية)');
console.log('  - netlify.toml (إعدادات Netlify)');
console.log('');
console.log('🔧 المتطلبات التالية:');
console.log('  1. إنشاء مشروع Supabase جديد');
console.log('  2. إنشاء الجداول المطلوبة في قاعدة البيانات');
console.log('  3. تحديث معلومات الاتصال في الكود');
console.log('  4. رفع المشروع إلى Netlify');