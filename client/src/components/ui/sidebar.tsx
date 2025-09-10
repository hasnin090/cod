import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { AppHeader } from "@/components/ui/app-header";
import { useQuery } from "@tanstack/react-query";

// تعريف واجهة المشروع
interface Project {
  id: number;
  name: string;
  description: string;
  startDate: string;
  status: string;
  progress?: number;
  createdBy?: number;
}

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isAccountsOpen, setIsAccountsOpen] = useState(false);
  const [location] = useLocation();
  const { user, logout } = useAuth();

  // فتح قسم الحسابات تلقائياً عند زيارة إحدى صفحاته
  useEffect(() => {
    if (location === "/transactions" || location === "/receivables") {
      setIsAccountsOpen(true);
    }
  }, [location]);

// مكون لعرض اسم الشركة أو اسم المشروع النشط
function CompanyName() {
  const { user } = useAuth();
  
  // إذا لم يكن هناك مستخدم، لا نقوم بأي استعلامات
  if (!user) {
    return <span>جاري التحميل...</span>;
  }
  
  const { data: settings, isLoading: isLoadingSettings } = useQuery<{ key: string; value: string }[]>({
    queryKey: ['/api/settings'],
    enabled: !!user && user.role === 'admin', // اطلب الإعدادات فقط للمدير
    staleTime: 1000 * 60 * 5, // تخزين البيانات لمدة 5 دقائق قبل إعادة الطلب
    gcTime: 1000 * 60 * 10, // الاحتفاظ بالبيانات في الذاكرة لمدة 10 دقائق (gcTime يحل محل cacheTime)
  });
  
  // جلب المشاريع في نفس المكون ليتمكن من الوصول للمشروع النشط
  const { data: userProjects, isLoading: isLoadingProjects } = useQuery<Project[]>({
    queryKey: ['/api/user-projects'],
    enabled: !!user && user.role !== 'admin',
    staleTime: 1000 * 60 * 3, // تخزين البيانات لمدة 3 دقائق قبل إعادة الطلب
  });
  
  // الحصول على المشروع النشط
  const activeProject = useMemo(() => {
    return Array.isArray(userProjects) && userProjects.length > 0 ? userProjects[0] : undefined;
  }, [userProjects]);

  // البحث عن اسم الشركة في أي من المفتاحين - بتحسين الأداء باستخدام useMemo
  const companyName = useMemo(() => {
    if (!settings || !Array.isArray(settings)) return 'مدير النظام';
    
    const companyNameSetting = settings.find((s: {key: string, value: string}) => s.key === 'companyName');
    if (companyNameSetting?.value) {
      return companyNameSetting.value;
    }
    
    const alternativeNameSetting = settings.find((s: {key: string, value: string}) => s.key === 'company_name');
    return alternativeNameSetting?.value || 'مدير النظام';
  }, [settings]);
  
  // في حالة جاري التحميل، نعرض مؤشر تحميل خفيف
  if (isLoadingSettings && user?.role === 'admin') {
    return <span className="opacity-70">جاري التحميل...</span>;
  }
  
  // إذا كان المستخدم مديرًا، يظهر اسم الشركة
  if (user?.role === 'admin') {
    return <span>{companyName}</span>;
  } else if (activeProject) {
    // إذا كان مستخدم عادي ولديه مشروع نشط، يظهر اسم المشروع
    return <span>{activeProject.name}</span>;
  } else if (isLoadingProjects) {
    return <span className="opacity-70">جاري التحميل...</span>;
  } else {
    // إذا لم يكن هناك مشروع نشط
    return <span>مدير المشاريع</span>;
  }
}


  const { toast } = useToast();
  const [isMobile, setIsMobile] = useState(false);
  
  // جلب المشاريع المتاحة للمستخدم (سيتم تصفيتها في الخلفية بواسطة API)
  const { data: userProjects, isLoading: isLoadingProjects, isError: isProjectsError } = useQuery<Project[]>({
    queryKey: ['/api/user-projects'],
    queryFn: async () => {
      if (!user) return [];
      const response = await fetch('/api/user-projects');
      if (!response.ok) {
        throw new Error('فشل في جلب المشاريع');
      }
      return response.json();
    },
    // فقط جلب المشاريع إذا كان المستخدم موجود وليس مديرًا
    enabled: !!user && user.role !== 'admin',
    staleTime: 1000 * 60 * 3, // تخزين البيانات لمدة 3 دقائق قبل إعادة الطلب
    retry: 1, // محاولة إعادة الطلب مرة واحدة فقط بعد الفشل
  });
  
  // اختيار المشروع النشط - نستخدم المشروع الأول كافتراضي أو نسمح للمستخدم باختيار مشروع معين
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
  
  // تعيين المشروع النشط عندما يتم تحميل المشاريع
  useEffect(() => {
    if (userProjects && Array.isArray(userProjects) && userProjects.length > 0 && !activeProjectId) {
      setActiveProjectId(userProjects[0].id);
    }
  }, [userProjects, activeProjectId]);
  
  // الحصول على معلومات المشروع النشط
  const activeProject = Array.isArray(userProjects) ? userProjects.find((p: Project) => p.id === activeProjectId) : undefined;

  // حالة القائمة الجانبية - مفتوحة افتراضيًا في الشاشات الكبيرة فقط
  useEffect(() => {
    const handleResize = () => {
      const mobileView = window.innerWidth < 768;
      setIsMobile(mobileView);
      if (!mobileView) {
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // إغلاق القائمة عند تغيير الصفحة على الأجهزة المحمولة
  useEffect(() => {
    if (isMobile) {
      setIsOpen(false);
    }
  }, [location, isMobile]);

  const handleLogout = () => {
    try {
      // نتخطى الاتصال بالـ API ونستخدم وظيفة logout من سياق المصادقة مباشرة
      logout();
      queryClient.clear();
      toast({
        title: "تم تسجيل الخروج بنجاح",
        description: "شكراً لاستخدامك التطبيق",
      });
    } catch (error) {
      console.error("Logout error:", error);
      toast({
        variant: "destructive",
        title: "خطأ في تسجيل الخروج",
        description: "يرجى المحاولة مرة أخرى",
      });
    }
  };

  // استمع لحدث تبديل الشريط الجانبي
  useEffect(() => {
    const handleToggleSidebar = () => {
      setIsOpen(!isOpen);
    };

    window.addEventListener('toggle-sidebar', handleToggleSidebar);
    return () => {
      window.removeEventListener('toggle-sidebar', handleToggleSidebar);
    };
  }, [isOpen]);

  return (
    <>
      {/* زخرفة الصفحة */}
      <div className="page-decoration"></div>
      <div className="page-decoration-2"></div>
      {/* شريط علوي ثابت */}
      <AppHeader onOpenSidebar={() => setIsOpen(true)} />
      {/* خلفية شفافة لإغلاق القائمة عند النقر خارجها في الهواتف */}
      {isOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 z-30 md:hidden backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        ></div>
      )}
      {/* تم إزالة شريط التنقل السفلي وفقًا لطلب المستخدم */}
      <aside
        className={`fixed top-0 right-0 h-full w-[90%] xs:w-[85%] sm:w-80 md:w-72 lg:w-80 bg-white dark:bg-gray-900 border-l border-blue-100 dark:border-gray-700/70 transform transition-transform duration-300 ease-in-out overflow-y-auto shadow-2xl flex flex-col ${
          isMobile 
            ? `z-50 ${isOpen ? "translate-x-0" : "translate-x-full"}` 
            : "z-40 translate-x-0"
        }`}
        style={{
          borderTopLeftRadius: isMobile ? '20px' : '0',
          borderBottomLeftRadius: isMobile ? '20px' : '0',
          backgroundImage: 'dark:linear-gradient(to bottom, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.95))',
          boxShadow: '0 0 20px rgba(0, 0, 0, 0.2), -5px 0 15px rgba(0, 0, 0, 0.1)'
        }}
      >
        <div className="p-5 md:p-6 flex-grow">
          {/* Header with app logo */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary))/80] flex items-center justify-center shadow-lg relative group overflow-hidden">
                <i className="fas fa-shield-alt text-xl text-slate-800 dark:text-white z-10 transform transition-transform duration-300 group-hover:scale-110"></i>
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/0 via-blue-600/40 to-blue-600/0 opacity-0 group-hover:opacity-100 animate-shimmer"></div>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-l dark:from-[hsl(var(--primary))] dark:to-[hsl(var(--primary))/70]">{user ? <CompanyName /> : "نظام المحاسبة"}</h1>
                <p className="text-xs text-blue-500/80 dark:text-blue-400/80 mt-0.5 hidden sm:inline-block">الإصدار 1.0.2</p>
              </div>
            </div>
            
            {/* تمت إزالة زر تبديل الوضع المظلم وفقاً لطلب المستخدم (تبسيط الواجهة) */}
          </div>
          
          {/* User profile card */}
          {user && (
            <div className="mb-6 bg-blue-50 dark:bg-gray-700 p-4 rounded-2xl border border-blue-100 dark:border-gray-600 shadow-md relative overflow-hidden zoom-in">
              <div className="absolute inset-0 bg-gradient-to-tr from-[hsl(var(--primary))/5] to-transparent dark:from-[hsl(var(--primary))/10] dark:to-transparent"></div>
              
              {/* معلومات المستخدم */}
              <div className="flex items-center space-x-4 space-x-reverse relative z-10">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary))/70] flex items-center justify-center shadow-md">
                  <i className="fas fa-user-circle text-lg sm:text-xl text-slate-700 dark:text-white"></i>
                </div>
                <div>
                  <div className="text-slate-800 dark:text-white font-medium text-base sm:text-lg"><CompanyName /></div>
                  <div className="text-xs sm:text-sm text-[hsl(var(--muted-foreground))] dark:text-gray-300 mt-1 flex items-center">
                    <i className="fas fa-circle text-[6px] mr-2 text-[hsl(var(--primary))]"></i>
                    <span className="font-bold">  {user.name}</span>
                  </div>
                </div>
              </div>

              {/* معلومات المشروع النشط - عرضها فقط للمستخدمين العاديين ومديري المشاريع */}
              {user.role !== 'admin' && activeProject && (
                <div className="mt-3 pt-3 border-t border-blue-100 dark:border-gray-600 relative z-10">
                  <div className="flex items-center">
                    <div className="w-7 h-7 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                      <i className="fas fa-folder-open text-sm text-green-600 dark:text-green-400"></i>
                    </div>
                    <div className="mr-2">
                      <div className="text-sm font-medium text-green-700 dark:text-green-400">المشروع النشط</div>
                      <div className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">{activeProject.name}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Main menu section - المحتوى الرئيسي */}
          <div className="mt-6 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl overflow-hidden shadow-lg bg-gradient-to-br from-white/90 to-slate-50/50 dark:from-slate-800/90 dark:to-slate-900/50 backdrop-blur-sm slide-in-up">
            <div className="py-3 px-4 bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10 dark:from-blue-500/20 dark:via-indigo-500/20 dark:to-purple-500/20 border-b border-slate-200/60 dark:border-slate-700/60">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                  <i className="fas fa-layer-group text-white text-xs"></i>
                </div>
                <h3 className="text-slate-700 dark:text-slate-200 font-semibold text-sm tracking-wide">القائمة الرئيسية</h3>
              </div>
            </div>
            <nav className="p-3 space-y-2">
              <Link
                href="/"
                className={`group flex items-center gap-3 px-4 py-3 rounded-xl no-flicker touch-target transition-all duration-300 transform hover:scale-[1.02] ${
                  location === "/" 
                    ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold shadow-lg shadow-blue-500/25" 
                    : "text-slate-700 dark:text-slate-200 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-slate-700/50 dark:hover:to-slate-600/50 hover:shadow-md"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                  location === "/" 
                    ? "bg-white/20 text-white shadow-inner" 
                    : "bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-slate-700 dark:to-slate-600 text-blue-600 dark:text-blue-400 group-hover:from-blue-200 group-hover:to-indigo-200"
                }`}>
                  <i className="fas fa-chart-line text-lg"></i>
                </div>
                <span className={`text-sm font-medium ${location === "/" ? "text-white" : "text-slate-800 dark:text-slate-200"}`}>لوحة التحكم</span>
                {location === "/" && (
                  <div className="ml-auto w-2 h-2 bg-white/60 rounded-full animate-pulse"></div>
                )}
              </Link>
              
              {/* قسم الحسابات القابل للطي */}
              <div className="space-y-1">
                <button
                  onClick={() => setIsAccountsOpen(!isAccountsOpen)}
                  className={`group w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl no-flicker touch-target transition-all duration-300 transform hover:scale-[1.02] ${
                    (location === "/transactions" || location === "/receivables")
                      ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold shadow-lg shadow-emerald-500/25" 
                      : "text-slate-700 dark:text-slate-200 hover:bg-gradient-to-r hover:from-emerald-50 hover:to-teal-50 dark:hover:from-slate-700/50 dark:hover:to-slate-600/50 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                      (location === "/transactions" || location === "/receivables") 
                        ? "bg-white/20 text-white shadow-inner" 
                        : "bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-slate-700 dark:to-slate-600 text-emerald-600 dark:text-emerald-400 group-hover:from-emerald-200 group-hover:to-teal-200"
                    }`}>
                      <i className="fas fa-wallet text-lg"></i>
                    </div>
                    <span className={`text-sm font-medium ${(location === "/transactions" || location === "/receivables") ? "text-white" : "text-slate-800 dark:text-slate-200"}`}>الحسابات</span>
                  </div>
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-300 ${
                    isAccountsOpen ? 'rotate-180' : ''
                  }`}>
                    <i className="fas fa-chevron-down text-xs"></i>
                  </div>
                </button>
                
                {/* القائمة الفرعية */}
                <div className={`overflow-hidden transition-all duration-500 ease-in-out ${
                  isAccountsOpen ? 'max-h-40 opacity-100 transform translate-y-0' : 'max-h-0 opacity-0 transform -translate-y-2'
                }`}>
                  <div className="ml-6 mr-2 mt-2 space-y-1 border-r-2 border-slate-200/50 dark:border-slate-700/50 pl-4">
                    <Link
                      href="/transactions"
                      className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg no-flicker touch-target transition-all duration-200 ${
                        location === "/transactions" 
                          ? "bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 text-emerald-700 dark:text-emerald-300 font-medium border-r-2 border-emerald-500 shadow-sm" 
                          : "text-slate-600 dark:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-slate-700/40 hover:text-emerald-600 dark:hover:text-emerald-400"
                      }`}
                    >
                      <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
                        <i className="fas fa-exchange-alt text-xs"></i>
                      </div>
                      <span className={`font-medium text-[13px] sm:text-sm ${location === "/transactions" ? "text-emerald-700 dark:text-emerald-300" : "text-slate-800 dark:text-slate-300"}`}>المعاملات</span>
                    </Link>
                    
                    <Link
                      href="/receivables"
                      className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg no-flicker touch-target transition-all duration-200 ${
                        location === "/receivables" 
                          ? "bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 text-emerald-700 dark:text-emerald-300 font-medium border-r-2 border-emerald-500 shadow-sm" 
                          : "text-slate-600 dark:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-slate-700/40 hover:text-emerald-600 dark:hover:text-emerald-400"
                      }`}
                    >
                      <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
                        <i className="fas fa-hand-holding-usd text-xs"></i>
                      </div>
                      <span className={`font-medium text-[13px] sm:text-sm ${location === "/receivables" ? "text-emerald-700 dark:text-emerald-300" : "text-slate-800 dark:text-slate-300"}`}>المبالغ المستحقة</span>
                    </Link>
                  </div>
                </div>
              </div>
              
              {/* قسم المشاريع - مخفي للمستخدمين مشاهدة فقط */}
              {user?.role !== 'viewer' && (
                <Link
                  href="/projects"
                  className={`group flex items-center gap-3 px-4 py-3 rounded-xl no-flicker touch-target transition-all duration-300 transform hover:scale-[1.02] ${
                    location === "/projects" 
                      ? "bg-gradient-to-r from-amber-600 to-orange-700 dark:from-amber-500 dark:to-orange-600 text-white font-semibold shadow-lg shadow-amber-500/25" 
                      : "text-slate-700 dark:text-slate-200 hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50 dark:hover:from-slate-700/50 dark:hover:to-slate-600/50 hover:shadow-md"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                    location === "/projects" 
                      ? "bg-white/20 text-white shadow-inner" 
                      : "bg-gradient-to-br from-amber-100 to-orange-100 dark:from-slate-700 dark:to-slate-600 text-amber-600 dark:text-amber-400 group-hover:from-amber-200 group-hover:to-orange-200"
                  }`}>
                    <i className="fas fa-project-diagram text-lg"></i>
                  </div>
                  <span className={`text-sm font-medium ${location === "/projects" ? "text-white" : "text-slate-800 dark:text-slate-200"}`}>المشاريع</span>
                  {location === "/projects" && (
                    <div className="ml-auto w-2 h-2 bg-white/60 rounded-full animate-pulse"></div>
                  )}
                </Link>
              )}

              <Link
                href="/documents"
                className={`group flex items-center gap-3 px-4 py-3 rounded-xl no-flicker touch-target transition-all duration-300 transform hover:scale-[1.02] ${
                  location === "/documents" 
                    ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-lg shadow-cyan-500/25" 
                    : "text-slate-700 dark:text-slate-200 hover:bg-gradient-to-r hover:from-cyan-50 hover:to-blue-50 dark:hover:from-slate-700/50 dark:hover:to-slate-600/50 hover:shadow-md"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                  location === "/documents" 
                    ? "bg-white/20 text-white shadow-inner" 
                    : "bg-gradient-to-br from-cyan-100 to-blue-100 dark:from-slate-700 dark:to-slate-600 text-cyan-600 dark:text-cyan-400 group-hover:from-cyan-200 group-hover:to-blue-200"
                }`}>
                  <i className="fas fa-file-alt text-lg"></i>
                </div>
                <span className={`text-sm font-medium ${location === "/documents" ? "text-white" : "text-slate-800 dark:text-slate-200"}`}>الوثائق</span>
                {location === "/documents" && (
                  <div className="ml-auto w-2 h-2 bg-white/60 rounded-full animate-pulse"></div>
                )}
              </Link>
            </nav>
          </div>
                            
          {/* Reports section - قسم التقارير */}
          <div className="mt-4 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl overflow-hidden shadow-lg bg-gradient-to-br from-white/90 to-slate-50/50 dark:from-slate-800/90 dark:to-slate-900/50 backdrop-blur-sm slide-in-up">
            <div className="py-3 px-4 bg-gradient-to-r from-rose-600/10 via-pink-600/10 to-red-600/10 dark:from-rose-500/20 dark:via-pink-500/20 dark:to-red-500/20 border-b border-slate-200/60 dark:border-slate-700/60">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center">
                  <i className="fas fa-chart-bar text-white text-xs"></i>
                </div>
                <h3 className="text-slate-700 dark:text-slate-200 font-semibold text-sm tracking-wide">التقارير والإحصائيات</h3>
              </div>
            </div>
            <nav className="p-3 space-y-2">
              <Link
                href="/reports"
                className={`group flex items-center gap-3 px-4 py-3 rounded-xl no-flicker touch-target transition-all duration-300 transform hover:scale-[1.02] ${
                  location === "/reports" 
                    ? "bg-gradient-to-r from-rose-500 to-red-600 text-white font-semibold shadow-lg shadow-rose-500/25" 
                    : "text-slate-700 dark:text-slate-200 hover:bg-gradient-to-r hover:from-rose-50 hover:to-red-50 dark:hover:from-slate-700/50 dark:hover:to-slate-600/50 hover:shadow-md"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                  location === "/reports" 
                    ? "bg-white/20 text-white shadow-inner" 
                    : "bg-gradient-to-br from-rose-100 to-red-100 dark:from-slate-700 dark:to-slate-600 text-rose-600 dark:text-rose-400 group-hover:from-rose-200 group-hover:to-red-200"
                }`}>
                  <i className="fas fa-chart-pie text-lg"></i>
                </div>
                <span className={`text-sm font-medium ${location === "/reports" ? "text-white" : "text-slate-800 dark:text-slate-200"}`}>التقارير</span>
                {location === "/reports" && (
                  <div className="ml-auto w-2 h-2 bg-white/60 rounded-full animate-pulse"></div>
                )}
              </Link>
            </nav>
          </div>
          
          {/* Operations section - قسم العمليات والموظفين */}
          <div className="mt-4 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl overflow-hidden shadow-lg bg-gradient-to-br from-white/90 to-slate-50/50 dark:from-slate-800/90 dark:to-slate-900/50 backdrop-blur-sm slide-in-up">
            <div className="py-3 px-4 bg-gradient-to-r from-orange-600/10 via-amber-600/10 to-yellow-600/10 dark:from-orange-500/20 dark:via-amber-500/20 dark:to-yellow-500/20 border-b border-slate-200/60 dark:border-slate-700/60">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
                  <i className="fas fa-users text-white text-xs"></i>
                </div>
                <h3 className="text-slate-700 dark:text-slate-200 font-semibold text-sm tracking-wide">العمليات والموظفين</h3>
              </div>
            </div>
            <nav className="p-3 space-y-2">
              {/* الموظفين */}
              <Link
                href="/employees"
                className={`group flex items-center gap-3 px-4 py-3 rounded-xl no-flicker touch-target transition-all duration-300 transform hover:scale-[1.02] ${
                  location === "/employees" 
                    ? "bg-gradient-to-r from-orange-600 to-amber-700 dark:from-orange-500 dark:to-amber-600 text-white font-semibold shadow-lg shadow-orange-500/25" 
                    : "text-slate-700 dark:text-slate-200 hover:bg-gradient-to-r hover:from-orange-50 hover:to-amber-50 dark:hover:from-slate-700/50 dark:hover:to-slate-600/50 hover:shadow-md"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                  location === "/employees" 
                    ? "bg-white/20 text-white shadow-inner" 
                    : "bg-gradient-to-br from-orange-100 to-amber-100 dark:from-slate-700 dark:to-slate-600 text-orange-600 dark:text-orange-400 group-hover:from-orange-200 group-hover:to-amber-200"
                }`}>
                  <i className="fas fa-id-badge text-lg"></i>
                </div>
                <span className={`text-sm font-medium ${location === "/employees" ? "text-white" : "text-slate-800 dark:text-slate-200"}`}>الموظفين</span>
                {location === "/employees" && (
                  <div className="ml-auto w-2 h-2 bg-white/60 rounded-full animate-pulse"></div>
                )}
              </Link>

              {/* الدفعات المؤجلة */}
              <Link
                href="/deferred-payments"
                className={`group flex items-center gap-3 px-4 py-3 rounded-xl no-flicker touch-target transition-all duration-300 transform hover:scale-[1.02] ${
                  location === "/deferred-payments" 
                    ? "bg-gradient-to-r from-yellow-600 to-orange-700 dark:from-yellow-500 dark:to-orange-600 text-white font-semibold shadow-lg shadow-yellow-500/25" 
                    : "text-slate-700 dark:text-slate-200 hover:bg-gradient-to-r hover:from-yellow-50 hover:to-orange-50 dark:hover:from-slate-700/50 dark:hover:to-slate-600/50 hover:shadow-md"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                  location === "/deferred-payments" 
                    ? "bg-white/20 text-white shadow-inner" 
                    : "bg-gradient-to-br from-yellow-100 to-orange-100 dark:from-slate-700 dark:to-slate-600 text-yellow-600 dark:text-yellow-400 group-hover:from-yellow-200 group-hover:to-orange-200"
                }`}>
                  <i className="fas fa-clock text-lg"></i>
                </div>
                <span className={`text-sm font-medium ${location === "/deferred-payments" ? "text-white" : "text-slate-800 dark:text-slate-200"}`}>الدفعات المؤجلة</span>
                {location === "/deferred-payments" && (
                  <div className="ml-auto w-2 h-2 bg-white/60 rounded-full animate-pulse"></div>
                )}
              </Link>

              {/* الأعمال المكتملة */}
              <Link
                href="/completed-works"
                className={`group flex items-center gap-3 px-4 py-3 rounded-xl no-flicker touch-target transition-all duration-300 transform hover:scale-[1.02] ${
                  location === "/completed-works" 
                    ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold shadow-lg shadow-green-500/25" 
                    : "text-slate-700 dark:text-slate-200 hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 dark:hover:from-slate-700/50 dark:hover:to-slate-600/50 hover:shadow-md"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                  location === "/completed-works" 
                    ? "bg-white/20 text-white shadow-inner" 
                    : "bg-gradient-to-br from-green-100 to-emerald-100 dark:from-slate-700 dark:to-slate-600 text-green-600 dark:text-green-400 group-hover:from-green-200 group-hover:to-emerald-200"
                }`}>
                  <i className="fas fa-check-circle text-lg"></i>
                </div>
                <span className={`text-sm font-medium ${location === "/completed-works" ? "text-white" : "text-slate-800 dark:text-slate-200"}`}>الأعمال المكتملة</span>
                {location === "/completed-works" && (
                  <div className="ml-auto w-2 h-2 bg-white/60 rounded-full animate-pulse"></div>
                )}
              </Link>

              {/* الأرشيف */}
              <Link
                href="/archive"
                className={`group flex items-center gap-3 px-4 py-3 rounded-xl no-flicker touch-target transition-all duration-300 transform hover:scale-[1.02] ${
                  location === "/archive" 
                    ? "bg-gradient-to-r from-gray-500 to-slate-600 text-white font-semibold shadow-lg shadow-gray-500/25" 
                    : "text-slate-700 dark:text-slate-200 hover:bg-gradient-to-r hover:from-gray-50 hover:to-slate-50 dark:hover:from-slate-700/50 dark:hover:to-slate-600/50 hover:shadow-md"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                  location === "/archive" 
                    ? "bg-white/20 text-white shadow-inner" 
                    : "bg-gradient-to-br from-gray-100 to-slate-100 dark:from-slate-700 dark:to-slate-600 text-gray-600 dark:text-gray-400 group-hover:from-gray-200 group-hover:to-slate-200"
                }`}>
                  <i className="fas fa-archive text-lg"></i>
                </div>
                <span className={`text-sm font-medium ${location === "/archive" ? "text-white" : "text-slate-800 dark:text-slate-200"}`}>الأرشيف</span>
                {location === "/archive" && (
                  <div className="ml-auto w-2 h-2 bg-white/60 rounded-full animate-pulse"></div>
                )}
              </Link>
            </nav>
          </div>
          {/* المشاريع المتاحة للمستخدم العادي - User Projects Section */}
          {user && user.role !== "admin" && (
            <div className="mt-4 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl overflow-hidden shadow-lg bg-gradient-to-br from-white/90 to-slate-50/50 dark:from-slate-800/90 dark:to-slate-900/50 backdrop-blur-sm slide-in-up">
              <div className="py-3 px-4 bg-gradient-to-r from-green-600/10 via-emerald-600/10 to-teal-600/10 dark:from-green-500/20 dark:via-emerald-500/20 dark:to-teal-500/20 border-b border-slate-200/60 dark:border-slate-700/60">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                    <i className="fas fa-folder-open text-white text-xs"></i>
                  </div>
                  <h3 className="text-slate-700 dark:text-slate-200 font-semibold text-sm tracking-wide">مشاريعي</h3>
                </div>
              </div>
              <nav className="p-3">
                {isLoadingProjects ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="w-6 h-6 border-2 border-green-200 border-t-green-500 rounded-full animate-spin"></div>
                    <span className="mr-3 text-sm text-slate-600 dark:text-slate-300">جاري التحميل...</span>
                  </div>
                ) : Array.isArray(userProjects) && userProjects.length > 0 ? (
                  <div className="space-y-2">
                    {userProjects.map((project: Project) => (
                      <div key={project.id} className="group relative">
                        <Link
                          href={`/projects/details/${project.id}`}
                          className={`flex items-center justify-between px-3 py-3 rounded-xl no-flicker touch-target transition-all duration-300 transform hover:scale-[1.02] ${
                            activeProjectId === project.id
                              ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold shadow-lg shadow-green-500/25"
                              : "text-slate-700 dark:text-slate-200 hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 dark:hover:from-slate-700/50 dark:hover:to-slate-600/50 hover:shadow-md"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                              activeProjectId === project.id
                                ? "bg-white/20 text-white shadow-inner"
                                : "bg-gradient-to-br from-green-100 to-emerald-100 dark:from-slate-700 dark:to-slate-600 text-green-600 dark:text-green-400 group-hover:from-green-200 group-hover:to-emerald-200"
                            }`}>
                              <i className={`fas fa-${activeProjectId === project.id ? 'folder-open' : 'folder'} text-lg`}></i>
                            </div>
                            <span className="font-medium truncate text-[13px] sm:text-sm text-slate-800 dark:text-slate-200">{project.name}</span>
                          </div>
                          
                          {/* زر تعيين كمشروع نشط */}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setActiveProjectId(project.id);
                            }}
                            className={`w-5 h-5 rounded-full flex items-center justify-center ${
                              activeProjectId === project.id
                                ? "bg-green-500 text-white"
                                : "bg-gray-200 dark:bg-gray-700 opacity-0 group-hover:opacity-100"
                            } transition-opacity`}
                            title="تعيين كمشروع نشط"
                          >
                            <i className="fas fa-check text-[10px]"></i>
                          </button>
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 px-3 text-center">
                    <p className="text-slate-600 dark:text-slate-300 text-sm">لا توجد مشاريع متاحة</p>
                  </div>
                )}
              </nav>
            </div>
          )}
          
          {/* Administration section - قسم الإدارة والمستخدمين */}
          {user?.role === "admin" && (
            <div className="mt-4 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl overflow-hidden shadow-lg bg-gradient-to-br from-white/90 to-slate-50/50 dark:from-slate-800/90 dark:to-slate-900/50 backdrop-blur-sm slide-in-up">
              <div className="py-3 px-4 bg-gradient-to-r from-violet-600/10 via-purple-600/10 to-indigo-600/10 dark:from-violet-500/20 dark:via-purple-500/20 dark:to-indigo-500/20 border-b border-slate-200/60 dark:border-slate-700/60">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                    <i className="fas fa-users-cog text-white text-xs"></i>
                  </div>
                  <h3 className="text-slate-700 dark:text-slate-200 font-semibold text-sm tracking-wide">الإدارة والمستخدمين</h3>
                </div>
              </div>
              <nav className="p-3 space-y-2">
                {/* إدارة المستخدمين */}
                <Link
                  href="/users"
                  className={`group flex items-center gap-3 px-4 py-3 rounded-xl no-flicker touch-target transition-all duration-300 transform hover:scale-[1.02] ${
                    location === "/users" 
                      ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold shadow-lg shadow-violet-500/25" 
                      : "text-slate-700 dark:text-slate-200 hover:bg-gradient-to-r hover:from-violet-50 hover:to-purple-50 dark:hover:from-slate-700/50 dark:hover:to-slate-600/50 hover:shadow-md"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                    location === "/users" 
                      ? "bg-white/20 text-white shadow-inner" 
                      : "bg-gradient-to-br from-violet-100 to-purple-100 dark:from-slate-700 dark:to-slate-600 text-violet-600 dark:text-violet-400 group-hover:from-violet-200 group-hover:to-purple-200"
                  }`}>
                    <i className="fas fa-users-cog text-lg"></i>
                  </div>
                  <span className={`text-sm font-medium ${location === "/users" ? "text-white" : "text-slate-800 dark:text-slate-200"}`}>إدارة المستخدمين</span>
                  {location === "/users" && (
                    <div className="ml-auto w-2 h-2 bg-white/60 rounded-full animate-pulse"></div>
                  )}
                </Link>

                {/* سجل النشاطات */}
                <Link
                  href="/activities"
                  className={`group flex items-center gap-3 px-4 py-3 rounded-xl no-flicker touch-target transition-all duration-300 transform hover:scale-[1.02] ${
                    location === "/activities" 
                      ? "bg-gradient-to-r from-indigo-500 to-blue-600 text-white font-semibold shadow-lg shadow-indigo-500/25" 
                      : "text-slate-700 dark:text-slate-200 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-blue-50 dark:hover:from-slate-700/50 dark:hover:to-slate-600/50 hover:shadow-md"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                    location === "/activities" 
                      ? "bg-white/20 text-white shadow-inner" 
                      : "bg-gradient-to-br from-indigo-100 to-blue-100 dark:from-slate-700 dark:to-slate-600 text-indigo-600 dark:text-indigo-400 group-hover:from-indigo-200 group-hover:to-blue-200"
                  }`}>
                    <i className="fas fa-history text-lg"></i>
                  </div>
                  <span className={`text-sm font-medium ${location === "/activities" ? "text-white" : "text-slate-800 dark:text-slate-200"}`}>سجل النشاطات</span>
                  {location === "/activities" && (
                    <div className="ml-auto w-2 h-2 bg-white/60 rounded-full animate-pulse"></div>
                  )}
                </Link>
              </nav>
            </div>
          )}

          {/* Settings section - قسم الإعدادات */}
          {user?.role === "admin" && (
            <div className="mt-4 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl overflow-hidden shadow-lg bg-gradient-to-br from-white/90 to-slate-50/50 dark:from-slate-800/90 dark:to-slate-900/50 backdrop-blur-sm slide-in-up">
              <div className="py-3 px-4 bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10 dark:from-blue-500/20 dark:via-indigo-500/20 dark:to-purple-500/20 border-b border-slate-200/60 dark:border-slate-700/60">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                    <i className="fas fa-cogs text-white text-xs"></i>
                  </div>
                  <h3 className="text-slate-700 dark:text-slate-200 font-semibold text-sm tracking-wide">إعدادات النظام</h3>
                </div>
              </div>
              <nav className="p-3 space-y-2">
                {/* الإعدادات العامة */}
                <Link
                  href="/settings"
                  className={`group flex items-center gap-3 px-4 py-3 rounded-xl no-flicker touch-target transition-all duration-300 transform hover:scale-[1.02] ${
                    location === "/settings" 
                      ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold shadow-lg shadow-blue-500/25" 
                      : "text-slate-700 dark:text-slate-200 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-slate-700/50 dark:hover:to-slate-600/50 hover:shadow-md"
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-300 ${
                    location === "/settings" 
                      ? "bg-white/20 text-white shadow-inner" 
                      : "bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-slate-700 dark:to-slate-600 text-blue-600 dark:text-blue-400"
                  }`}>
                    <i className="fas fa-cog text-sm"></i>
                  </div>
                  <span className={`text-sm font-medium ${location === "/settings" ? "text-white" : "text-slate-800 dark:text-slate-200"}`}>الإعدادات العامة</span>
                  {location === "/settings" && (
                    <div className="ml-auto w-2 h-2 bg-white/60 rounded-full animate-pulse"></div>
                  )}
                </Link>

                {/* إدارة قواعد البيانات */}
                <Link
                  href="/database-management"
                  className={`group flex items-center gap-3 px-4 py-3 rounded-xl no-flicker touch-target transition-all duration-300 transform hover:scale-[1.02] ${
                    location === "/database-management" 
                      ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold shadow-lg shadow-green-500/25" 
                      : "text-slate-700 dark:text-slate-200 hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 dark:hover:from-slate-700/50 dark:hover:to-slate-600/50 hover:shadow-md"
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-300 ${
                    location === "/database-management" 
                      ? "bg-white/20 text-white shadow-inner" 
                      : "bg-gradient-to-br from-green-100 to-emerald-100 dark:from-slate-700 dark:to-slate-600 text-green-600 dark:text-green-400"
                  }`}>
                    <i className="fas fa-database text-sm"></i>
                  </div>
                  <span className={`text-sm font-medium ${location === "/database-management" ? "text-white" : "text-slate-800 dark:text-slate-200"}`}>إدارة قواعد البيانات</span>
                  {location === "/database-management" && (
                    <div className="ml-auto w-2 h-2 bg-white/60 rounded-full animate-pulse"></div>
                  )}
                </Link>

        {/* تمت إزالة الروابط التالية لتبسيط القائمة:
          - التخزين الهجين
          - حالة النظام
          - نقل الملفات
          - الانتقال للسحابة
          - تكامل واتساب
           يمكن إعادة تفعيلها مستقبلاً بإرجاع الكتل المحذوفة من سجل Git */}
              </nav>
            </div>
          )}
          
          {/* Logout button - زر تسجيل الخروج */}
          <div className="pt-4 mt-6">
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-reverse space-x-3 px-4 py-3 rounded-xl text-[hsl(var(--destructive))] dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 hover:scale-102 transition-all duration-200 text-right bg-red-50/30 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 no-flicker touch-target"
            >
              <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shadow-sm no-flicker">
                <i className="fas fa-sign-out-alt text-lg text-red-500 dark:text-red-300"></i>
              </div>
              <span className="font-medium text-sm sm:text-base">تسجيل خروج</span>
            </button>
          </div>
        </div>
        
        {/* تم حذف زر تبديل الوضع المظلم/الفاتح بناء على طلب المستخدم */}
          
        {/* Footer with app version - تذييل مع إصدار التطبيق */}
        <div className="p-4 text-center text-xs text-gray-500 border-t border-blue-100 dark:border-gray-700 dark:text-gray-400">
          <p>نظام Code-01 - الإصدار 1.0.2</p>
          <p className="mt-1">© 2025 جميع الحقوق محفوظة</p>
        </div>
      </aside>
    </>
  );
}
