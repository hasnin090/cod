import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Transactions from "@/pages/transactions";
import Projects from "@/pages/projects";
import Users from "@/pages/users";
import Employees from "@/pages/employees";
import Documents from "@/pages/documents";
import Archive from "@/pages/archive";
import Reports from "@/pages/reports";
import Activities from "@/pages/activities";
import Settings from "@/pages/settings";
import LedgerSimple from "@/pages/ledger-simple";
import Receivables from "@/pages/receivables";
import DatabaseManagement from "@/pages/database-management";
import HybridStorage from "@/pages/hybrid-storage";
import SupabaseStatus from "@/pages/supabase-status";
import FileMigration from "@/pages/file-migration";
import CloudStorageMigration from "@/pages/cloud-storage-migration";
import DeferredPayments from './pages/deferred-payments';
import WhatsAppIntegration from './pages/whatsapp-integration';
import SystemManagement from './pages/system-management';
import CompletedWorks from './pages/completed-works';
import NetSuiteDashboard from '@/components/NetSuiteDashboard';
import NetSuiteTransactions from '@/components/NetSuiteTransactions';
import NetSuiteReports from '@/components/NetSuiteReports';
import NetSuiteCustomers from '@/components/NetSuiteCustomers';



import { useAuth } from "./hooks/use-auth";
import { AuthProvider } from "./context/auth-context";
import { Sidebar } from "@/components/ui/sidebar";
import { UserMenu } from "@/components/ui/user-menu";
import { useEffect, useState } from "react";

function AppRoutes() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();
  const [isMobile, setIsMobile] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  
  // تحديد حجم الشاشة وتغييرات الواجهة
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      
      // إضافة متغيرات CSS للاستجابة عبر كامل التطبيق
      document.documentElement.style.setProperty('--screen-width', `${width}px`);
      document.documentElement.style.setProperty('--is-mobile', width < 768 ? '1' : '0');
      document.documentElement.style.setProperty('--is-tablet', width >= 768 && width < 1024 ? '1' : '0');
      document.documentElement.style.setProperty('--is-desktop', width >= 1024 ? '1' : '0');
      
      // تعيين حجم الخط الأساسي استناداً إلى عرض الشاشة
      if (width < 400) {
        document.documentElement.style.fontSize = '14px';
      } else if (width < 768) {
        document.documentElement.style.fontSize = '15px';
      } else {
        document.documentElement.style.fontSize = '16px';
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // مراقبة تمرير الصفحة
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // التأثير البصري لعنوان الصفحة
  const getPageTitle = () => {
    switch (location) {
      case '/': return 'لوحة التحكم';
      case '/transactions': return 'العمليات المالية';
      case '/projects': return 'المشاريع';
      case '/users': return 'المستخدمين';
      case '/documents': return 'المستندات';
      case '/archive': return 'الأرشيف';
      case '/reports': return 'التقارير';
      case '/activities': return 'سجل النشاطات';
      case '/settings': return 'الإعدادات';
      default: return 'الصفحة غير موجودة';
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="spinner w-8 h-8"></div>
      </div>
    );
  }
  
  if (!user) {
    return (
      <Switch>
        <Route path="/" component={Login} />
        <Route path="*" component={() => <Login />} />
      </Switch>
    );
  }
  
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 transition-all duration-300 mr-0 md:mr-72 lg:mr-80 overflow-y-auto">
        {/* شريط علوي للتباعد المناسب مع الشريط الجانبي */}
        <div className="h-20 md:h-16 lg:h-18 w-full"></div>
        
        {/* حاوية المحتوى الرئيسي المحسنة */}
        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-screen-2xl mx-auto w-full">
          <div className="min-h-[calc(100vh-8rem)] bg-card/50 backdrop-blur-sm rounded-xl border shadow-lg p-6 lg:p-8">
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/transactions" component={Transactions} />
              <Route path="/projects" component={Projects} />
              <Route path="/projects/details/:id" component={Projects} />
              <Route path="/users" component={Users} />
              <Route path="/employees">
                {user?.role === 'admin' ? <Employees /> : <NotFound />}
              </Route>
              <Route path="/documents" component={Documents} />
              <Route path="/archive" component={Archive} />
              <Route path="/reports">
                {user?.role === 'admin' ? <Reports /> : <NotFound />}
              </Route>
              <Route path="/activities" component={Activities} />
              <Route path="/settings" component={Settings} />
              <Route path="/ledger" component={Reports} />
              <Route path="/receivables" component={Receivables} />
              <Route path="/database-management">
                {user?.role === 'admin' ? <DatabaseManagement /> : <NotFound />}
              </Route>
              <Route path="/hybrid-storage">
                {user?.role === 'admin' ? <HybridStorage /> : <NotFound />}
              </Route>
              <Route path="/supabase-status">
                {user?.role === 'admin' ? <SupabaseStatus /> : <NotFound />}
              </Route>
              <Route path="/file-migration">
                {user?.role === 'admin' ? <FileMigration /> : <NotFound />}
              </Route>
              <Route path="/cloud-migration">
                {user?.role === 'admin' ? <CloudStorageMigration /> : <NotFound />}
              </Route>
              <Route path="/deferred-payments" component={DeferredPayments} />
              <Route path="/whatsapp-integration">
                {user?.role === 'admin' ? <WhatsAppIntegration /> : <NotFound />}
              </Route>
              <Route path="/system-management">
                {user?.role === 'admin' ? <SystemManagement /> : <NotFound />}
              </Route>
              <Route path="/completed-works">
                {user?.role === 'admin' || user?.role === 'manager' ? <CompletedWorks /> : <NotFound />}
              </Route>
              <Route path="/netsuite" component={NetSuiteDashboard} />
              <Route path="/netsuite/transactions" component={NetSuiteTransactions} />
              <Route path="/netsuite/reports" component={NetSuiteReports} />
              <Route path="/netsuite/customers" component={NetSuiteCustomers} />

              <Route component={NotFound} />
            </Switch>
          </div>
        </div>
        
        {/* لم نعد بحاجة إلى مساحة إضافية هنا بسبب استخدام pb-mobile-nav */}
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <div dir="rtl" lang="ar" className="font-cairo">
          <AppRoutes />
          <Toaster />
        </div>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
