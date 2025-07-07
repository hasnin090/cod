import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { ThemeToggle } from "@/components/ui/theme-toggle";
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [location] = useLocation();
  const { user, logout } = useAuth();

  // فتح قسم الحسابات تلقائياً عند زيارة إحدى صفحاته
  useEffect(() => {
    if (location === "/transactions" || location === "/receivables") {
      setIsAccountsOpen(true);
    }
  }, [location]);

  // فتح قسم الإعدادات تلقائياً عند زيارة إحدى صفحاته
  useEffect(() => {
    const settingsRoutes = [
      "/settings", "/database-management", "/hybrid-storage", 
      "/supabase-status", "/file-migration", "/whatsapp-integration"
    ];
    if (settingsRoutes.includes(location)) {
      setIsSettingsOpen(true);
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
    enabled: !!user, // تفعيل الطلب فقط عند وجود مستخدم
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
                <i className="fas fa-shield-alt text-xl text-white z-10 transform transition-transform duration-300 group-hover:scale-110"></i>
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/0 via-blue-600/40 to-blue-600/0 opacity-0 group-hover:opacity-100 animate-shimmer"></div>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-l from-[hsl(var(--primary))] to-[hsl(var(--primary))/70]">{user ? <CompanyName /> : "نظام المحاسبة"}</h1>
                <p className="text-xs text-blue-500/80 dark:text-blue-400/80 mt-0.5 hidden sm:inline-block">الإصدار 1.0.2</p>
              </div>
            </div>
            
            {/* زر تبديل الوضع المظلم/الفاتح */}
            <button 
              onClick={() => {
                // استخدام وظيفة تبديل السمة من ملف المساعدات
                import('../../lib/theme-utils').then(module => {
                  module.toggleTheme();
                });
              }}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-700 dark:to-gray-800 hover:from-blue-100 hover:to-blue-200 dark:hover:from-gray-600 dark:hover:to-gray-700 shadow-md hover:shadow-lg transform hover:scale-110 active:scale-95 transition-all duration-300 relative overflow-hidden group"
              aria-label="تبديل الوضع المظلم/الفاتح"
            >
              {/* الأيقونة الرئيسية */}
              <i className="fas fa-moon text-blue-600 dark:text-blue-300 hidden dark:inline-block z-10 text-lg"></i>
              <i className="fas fa-sun text-amber-500 dark:hidden z-10 text-lg"></i>
              
              {/* تأثير الوهج خلف الأيقونة */}
              <div className="absolute inset-0 bg-blue-200/30 dark:bg-blue-900/30 rounded-full transform scale-0 group-hover:scale-100 transition-transform duration-300"></div>
              
              {/* تأثير الدوران عند النقر */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-400/10 to-amber-400/10 dark:from-blue-400/5 dark:to-blue-600/5 opacity-0 group-hover:opacity-100 animate-spin-slow"></div>
              
              {/* وميض خفيف في الوضع الداكن */}
              <div className="absolute inset-0 rounded-full hidden dark:block bg-gradient-to-r from-blue-400/0 via-blue-400/10 to-blue-400/0 opacity-0 group-hover:opacity-100 animate-shimmer"></div>
            </button>
          </div>
          
          {/* User profile card */}
          {user && (
            <div className="mb-6 bg-blue-50 dark:bg-gray-700 p-4 rounded-2xl border border-blue-100 dark:border-gray-600 shadow-md relative overflow-hidden zoom-in">
              <div className="absolute inset-0 bg-gradient-to-tr from-[hsl(var(--primary))/5] to-transparent dark:from-[hsl(var(--primary))/10] dark:to-transparent"></div>
              
              {/* معلومات المستخدم */}
              <div className="flex items-center space-x-4 space-x-reverse relative z-10">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary))/70] flex items-center justify-center shadow-md">
                  <i className="fas fa-user-circle text-lg sm:text-xl text-white"></i>
                </div>
                <div>
                  <div className="text-[hsl(var(--primary))] dark:text-white font-medium text-base sm:text-lg"><CompanyName /></div>
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
          <div className="mt-6 border border-blue-100 dark:border-gray-600 rounded-2xl overflow-hidden shadow-sm bg-blue-50/30 dark:bg-gray-700 slide-in-up">
            <div className="py-2.5 px-4 bg-gradient-to-l from-[hsl(var(--primary))/20] to-[hsl(var(--primary))/5] dark:from-[hsl(var(--primary))/30] dark:to-[hsl(var(--primary))/10] border-b border-blue-100 dark:border-gray-600">
              <h3 className="text-[hsl(var(--primary))] dark:text-white font-semibold text-sm sm:text-base">القائمة الرئيسية</h3>
            </div>
            <nav className="p-2.5 space-y-1.5">
              <Link
                href="/"
                className={`flex items-center space-x-reverse space-x-3 px-3 py-2.5 rounded-xl no-flicker touch-target ${
                  location === "/" 
                    ? "bg-[hsl(var(--primary))] text-white font-semibold shadow-md" 
                    : "text-[hsl(var(--primary))] dark:text-white hover:bg-blue-50 dark:hover:bg-gray-600 hover:scale-102"
                } transition-all duration-200 transform`}
              >
                <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center no-flicker ${location === "/" ? "bg-white/20 text-white" : "bg-blue-100 dark:bg-gray-600"}`}>
                  <i className="fas fa-chart-line"></i>
                </div>
                <span className="text-sm sm:text-base">لوحة التحكم</span>
              </Link>
              
              {/* قسم الحسابات القابل للطي */}
              <div className="space-y-1">
                <button
                  onClick={() => setIsAccountsOpen(!isAccountsOpen)}
                  className={`w-full flex items-center justify-between space-x-reverse space-x-3 px-3 py-2.5 rounded-xl no-flicker touch-target ${
                    (location === "/transactions" || location === "/receivables")
                      ? "bg-[hsl(var(--primary))] text-white font-semibold shadow-md" 
                      : "text-[hsl(var(--primary))] hover:bg-blue-50 hover:scale-102"
                  } transition-all duration-200 transform`}
                >
                  <div className="flex items-center space-x-reverse space-x-3">
                    <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center no-flicker ${(location === "/transactions" || location === "/receivables") ? "bg-white/20 text-white" : "bg-blue-100"}`}>
                      <i className="fas fa-wallet"></i>
                    </div>
                    <span className="text-sm sm:text-base">الحسابات</span>
                  </div>
                  <i className={`fas fa-chevron-${isAccountsOpen ? 'up' : 'down'} text-xs transition-transform duration-200`}></i>
                </button>
                
                {/* القائمة الفرعية */}
                <div className={`overflow-hidden transition-all duration-300 ${isAccountsOpen ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className="mr-4 space-y-1">
                    <Link
                      href="/transactions"
                      className={`flex items-center space-x-reverse space-x-2 px-3 py-2 rounded-lg no-flicker touch-target ${
                        location === "/transactions" 
                          ? "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] font-medium border-r-2 border-[hsl(var(--primary))]" 
                          : "text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-600"
                      } transition-all duration-200`}
                    >
                      <div className="w-6 h-6 rounded-full flex items-center justify-center bg-blue-100 dark:bg-gray-600">
                        <i className="fas fa-coins text-xs"></i>
                      </div>
                      <span className="text-sm">العمليات النقدية</span>
                    </Link>
                    
                    <Link
                      href="/receivables"
                      className={`flex items-center space-x-reverse space-x-2 px-3 py-2 rounded-lg no-flicker touch-target ${
                        location === "/receivables" 
                          ? "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] font-medium border-r-2 border-[hsl(var(--primary))]" 
                          : "text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-600"
                      } transition-all duration-200`}
                    >
                      <div className="w-6 h-6 rounded-full flex items-center justify-center bg-orange-100 dark:bg-gray-600">
                        <i className="fas fa-user text-xs"></i>
                      </div>
                      <span className="text-sm">المستحقات</span>
                    </Link>
                    

                  </div>
                </div>
              </div>
              
              {/* قسم المشاريع - مخفي للمستخدمين مشاهدة فقط */}
              {user?.role !== 'viewer' && (
                <Link
                  href="/projects"
                  className={`flex items-center space-x-reverse space-x-3 px-3 py-2.5 rounded-xl no-flicker touch-target ${
                    location === "/projects" 
                      ? "bg-[hsl(var(--primary))] text-white font-semibold shadow-md" 
                      : "text-[hsl(var(--primary))] hover:bg-blue-50 hover:scale-102"
                  } transition-all duration-200 transform`}
                >
                  <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center no-flicker ${location === "/projects" ? "bg-white/20 text-white" : "bg-blue-100"}`}>
                    <i className="fas fa-project-diagram"></i>
                  </div>
                  <span className="text-sm sm:text-base">المشاريع</span>
                </Link>
              )}
              
              <Link
                href="/documents"
                className={`flex items-center space-x-reverse space-x-3 px-3 py-2.5 rounded-xl no-flicker touch-target ${
                  location === "/documents" 
                    ? "bg-[hsl(var(--primary))] text-white font-semibold shadow-md" 
                    : "text-[hsl(var(--primary))] hover:bg-blue-50 hover:scale-102"
                } transition-all duration-200 transform`}
              >
                <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center no-flicker ${location === "/documents" ? "bg-white/20 text-white" : "bg-blue-100"}`}>
                  <i className="fas fa-file-invoice"></i>
                </div>
                <span className="text-sm sm:text-base">المستندات</span>
              </Link>
              
              <Link
                href="/archive"
                className={`flex items-center space-x-reverse space-x-3 px-3 py-2.5 rounded-xl no-flicker touch-target ${
                  location === "/archive" 
                    ? "bg-[hsl(var(--primary))] text-white font-semibold shadow-md" 
                    : "text-[hsl(var(--primary))] hover:bg-blue-50 hover:scale-102"
                } transition-all duration-200 transform`}
              >
                <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center no-flicker ${location === "/archive" ? "bg-white/20 text-white" : "bg-blue-100"}`}>
                  <i className="fas fa-archive"></i>
                </div>
                <span className="text-sm sm:text-base">الأرشيف</span>
              </Link>
              
              {/* قسم الموظفين - مخصص للمدير فقط */}
              {user?.role === 'admin' && (
                <Link
                  href="/employees"
                  className={`flex items-center space-x-reverse space-x-3 px-3 py-2.5 rounded-xl no-flicker touch-target ${
                    location === "/employees" 
                      ? "bg-[hsl(var(--primary))] text-white font-semibold shadow-md" 
                      : "text-[hsl(var(--primary))] hover:bg-blue-50 hover:scale-102"
                  } transition-all duration-200 transform`}
                >
                  <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center no-flicker ${location === "/employees" ? "bg-white/20 text-white" : "bg-blue-100"}`}>
                    <i className="fas fa-users"></i>
                  </div>
                  <span className="text-sm sm:text-base">الموظفين</span>
                </Link>
              )}

              {/* قسم التقارير - مخصص للمدير فقط */}
              {user?.role === 'admin' && (
                <Link
                  href="/reports"
                  className={`flex items-center space-x-reverse space-x-3 px-3 py-2.5 rounded-xl no-flicker touch-target ${
                    location === "/reports" 
                      ? "bg-[hsl(var(--primary))] text-white font-semibold shadow-md" 
                      : "text-[hsl(var(--primary))] hover:bg-blue-50 hover:scale-102"
                  } transition-all duration-200 transform`}
                >
                  <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center no-flicker ${location === "/reports" ? "bg-white/20 text-white" : "bg-blue-100"}`}>
                    <i className="fas fa-chart-pie"></i>
                  </div>
                  <span className="text-sm sm:text-base">التقارير</span>
                </Link>
              )}

              {/* قسم الأعمال المنجزة - مخصص للمدير والمدراء فقط */}
              {(user?.role === 'admin' || user?.role === 'manager') && (
                <Link
                  href="/completed-works"
                  className={`flex items-center space-x-reverse space-x-3 px-3 py-2.5 rounded-xl no-flicker touch-target ${
                    location === "/completed-works" 
                      ? "bg-[hsl(var(--primary))] text-white font-semibold shadow-md" 
                      : "text-[hsl(var(--primary))] hover:bg-blue-50 hover:scale-102"
                  } transition-all duration-200 transform`}
                >
                  <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center no-flicker ${location === "/completed-works" ? "bg-white/20 text-white" : "bg-blue-100"}`}>
                    <i className="fas fa-tasks"></i>
                  </div>
                  <span className="text-sm sm:text-base">الأعمال المنجزة</span>
                </Link>
              )}
            </nav>
          </div>
          
          {/* المشاريع المتاحة للمستخدم العادي - User Projects Section */}
          {user && user.role !== "admin" && (
            <div className="mt-4 border border-blue-100 dark:border-gray-600 rounded-2xl overflow-hidden shadow-sm bg-blue-50/30 dark:bg-gray-700 slide-in-up" style={{ animationDelay: '0.1s' }}>
              <div className="py-2.5 px-4 bg-gradient-to-l from-green-500/20 to-green-500/5 dark:from-green-500/30 dark:to-green-500/10 border-b border-blue-100 dark:border-gray-600">
                <h3 className="text-[hsl(var(--primary))] dark:text-white font-semibold text-sm sm:text-base">مشاريعي</h3>
              </div>
              <div className="p-2.5">
                {isLoadingProjects ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
                    <span className="mr-2 text-sm text-[hsl(var(--muted-foreground))]">جاري التحميل...</span>
                  </div>
                ) : Array.isArray(userProjects) && userProjects.length > 0 ? (
                  <div className="space-y-2">
                    {userProjects.map((project: Project) => (
                      <div key={project.id} className="group relative">
                        <Link
                          href={`/projects/details/${project.id}`}
                          className={`flex items-center justify-between space-x-reverse space-x-2 p-2 rounded-lg ${
                            activeProjectId === project.id
                              ? "bg-blue-100 dark:bg-gray-600 text-[hsl(var(--primary))] font-medium"
                              : "text-[hsl(var(--primary))] hover:bg-blue-50 dark:hover:bg-gray-600"
                          } transition-colors`}
                        >
                          <div className="flex items-center space-x-reverse space-x-2">
                            <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-gray-600 flex items-center justify-center">
                              <i className={`fas fa-${activeProjectId === project.id ? 'folder-open' : 'folder'} text-sm`}></i>
                            </div>
                            <span className="text-sm truncate">{project.name}</span>
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
                  <div className="py-4 px-3 text-center">
                    <p className="text-[hsl(var(--muted-foreground))] text-sm">لا توجد مشاريع متاحة</p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Administration section - قسم الإدارة */}
          {user?.role === "admin" && (
            <div className="mt-4 border border-blue-100 dark:border-gray-600 rounded-2xl overflow-hidden shadow-sm bg-blue-50/30 dark:bg-gray-700 slide-in-up" style={{ animationDelay: '0.1s' }}>
              <div className="py-2.5 px-4 bg-gradient-to-l from-[hsl(var(--primary))/20] to-[hsl(var(--primary))/5] dark:from-[hsl(var(--primary))/30] dark:to-[hsl(var(--primary))/10] border-b border-blue-100 dark:border-gray-600">
                <h3 className="text-[hsl(var(--primary))] dark:text-white font-semibold text-sm sm:text-base">الإدارة</h3>
              </div>
              <nav className="p-2.5 space-y-1.5">
                <Link
                  href="/activities"
                  className={`flex items-center space-x-reverse space-x-3 px-3 py-2.5 rounded-xl no-flicker touch-target ${
                    location === "/activities" 
                      ? "bg-[hsl(var(--primary))] text-white font-semibold shadow-md" 
                      : "text-[hsl(var(--primary))] hover:bg-blue-50 hover:scale-102"
                  } transition-all duration-200 transform`}
                >
                  <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center no-flicker ${location === "/activities" ? "bg-white/20 text-white" : "bg-blue-100"}`}>
                    <i className="fas fa-history"></i>
                  </div>
                  <span className="text-sm sm:text-base">سجل النشاطات</span>
                </Link>
                
                <Link
                  href="/users"
                  className={`flex items-center space-x-reverse space-x-3 px-3 py-2.5 rounded-xl no-flicker touch-target ${
                    location === "/users" 
                      ? "bg-[hsl(var(--primary))] text-white font-semibold shadow-md" 
                      : "text-[hsl(var(--primary))] hover:bg-blue-50 hover:scale-102"
                  } transition-all duration-200 transform`}
                >
                  <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center no-flicker ${location === "/users" ? "bg-white/20 text-white" : "bg-blue-100"}`}>
                    <i className="fas fa-user-cog"></i>
                  </div>
                  <span className="text-sm sm:text-base">المستخدمين</span>
                </Link>
                
                <Link
                  href="/user-projects"
                  className={`flex items-center space-x-reverse space-x-3 px-3 py-2.5 rounded-xl no-flicker touch-target ${
                    location === "/user-projects" 
                      ? "bg-[hsl(var(--primary))] text-white font-semibold shadow-md" 
                      : "text-[hsl(var(--primary))] hover:bg-blue-50 hover:scale-102"
                  } transition-all duration-200 transform`}
                >
                  <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center no-flicker ${location === "/user-projects" ? "bg-white/20 text-white" : "bg-blue-100"}`}>
                    <i className="fas fa-link"></i>
                  </div>
                  <span className="text-sm sm:text-base">ربط المستخدمين</span>
                </Link>
                
                {/* قسم الإعدادات القابل للطي */}
                <div className="space-y-1">
                  <button
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                    className={`w-full flex items-center justify-between space-x-reverse space-x-3 px-3 py-2.5 rounded-xl no-flicker touch-target ${
                      ["/settings", "/database-management", "/hybrid-storage", "/supabase-status", "/file-migration", "/cloud-migration", "/whatsapp-integration"].includes(location)
                        ? "bg-[hsl(var(--primary))] text-white font-semibold shadow-md" 
                        : "text-[hsl(var(--primary))] hover:bg-blue-50 hover:scale-102"
                    } transition-all duration-200 transform`}
                  >
                    <div className="flex items-center space-x-reverse space-x-3">
                      <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center no-flicker ${["/settings", "/database-management", "/hybrid-storage", "/supabase-status", "/file-migration", "/cloud-migration", "/whatsapp-integration"].includes(location) ? "bg-white/20 text-white" : "bg-blue-100"}`}>
                        <i className="fas fa-tools"></i>
                      </div>
                      <span className="text-sm sm:text-base">الإعدادات</span>
                    </div>
                    <i className={`fas fa-chevron-${isSettingsOpen ? 'up' : 'down'} text-xs transition-transform duration-200`}></i>
                  </button>
                  
                  {/* القائمة الفرعية للإعدادات */}
                  <div className={`overflow-hidden transition-all duration-300 ${isSettingsOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="mr-4 space-y-1">
                      <Link
                        href="/settings"
                        className={`flex items-center space-x-reverse space-x-2 px-3 py-2 rounded-lg no-flicker touch-target ${
                          location === "/settings" 
                            ? "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] font-medium border-r-2 border-[hsl(var(--primary))]" 
                            : "text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-600"
                        } transition-all duration-200`}
                      >
                        <div className="w-6 h-6 rounded-full flex items-center justify-center bg-blue-100 dark:bg-gray-600">
                          <i className="fas fa-cog text-xs"></i>
                        </div>
                        <span className="text-sm">الإعدادات العامة</span>
                      </Link>
                      
                      <Link
                        href="/database-management"
                        className={`flex items-center space-x-reverse space-x-2 px-3 py-2 rounded-lg no-flicker touch-target ${
                          location === "/database-management" 
                            ? "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] font-medium border-r-2 border-[hsl(var(--primary))]" 
                            : "text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-600"
                        } transition-all duration-200`}
                      >
                        <div className="w-6 h-6 rounded-full flex items-center justify-center bg-green-100 dark:bg-gray-600">
                          <i className="fas fa-database text-xs"></i>
                        </div>
                        <span className="text-sm">إدارة قواعد البيانات</span>
                      </Link>
                      
                      <Link
                        href="/hybrid-storage"
                        className={`flex items-center space-x-reverse space-x-2 px-3 py-2 rounded-lg no-flicker touch-target ${
                          location === "/hybrid-storage" 
                            ? "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] font-medium border-r-2 border-[hsl(var(--primary))]" 
                            : "text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-600"
                        } transition-all duration-200`}
                      >
                        <div className="w-6 h-6 rounded-full flex items-center justify-center bg-purple-100 dark:bg-gray-600">
                          <i className="fas fa-cloud text-xs"></i>
                        </div>
                        <span className="text-sm">التخزين الهجين</span>
                      </Link>
                      
                      <Link
                        href="/supabase-status"
                        className={`flex items-center space-x-reverse space-x-2 px-3 py-2 rounded-lg no-flicker touch-target ${
                          location === "/supabase-status" 
                            ? "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] font-medium border-r-2 border-[hsl(var(--primary))]" 
                            : "text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-600"
                        } transition-all duration-200`}
                      >
                        <div className="w-6 h-6 rounded-full flex items-center justify-center bg-cyan-100 dark:bg-gray-600">
                          <i className="fas fa-server text-xs"></i>
                        </div>
                        <span className="text-sm">حالة Supabase</span>
                      </Link>
                      
                      <Link
                        href="/file-migration"
                        className={`flex items-center space-x-reverse space-x-2 px-3 py-2 rounded-lg no-flicker touch-target ${
                          location === "/file-migration" 
                            ? "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] font-medium border-r-2 border-[hsl(var(--primary))]" 
                            : "text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-600"
                        } transition-all duration-200`}
                      >
                        <div className="w-6 h-6 rounded-full flex items-center justify-center bg-yellow-100 dark:bg-gray-600">
                          <i className="fas fa-cloud-upload-alt text-xs"></i>
                        </div>
                        <span className="text-sm">نقل الملفات</span>
                      </Link>
                      
                      <Link
                        href="/cloud-migration"
                        className={`flex items-center space-x-reverse space-x-2 px-3 py-2 rounded-lg no-flicker touch-target ${
                          location === "/cloud-migration" 
                            ? "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] font-medium border-r-2 border-[hsl(var(--primary))]" 
                            : "text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-600"
                        } transition-all duration-200`}
                      >
                        <div className="w-6 h-6 rounded-full flex items-center justify-center bg-blue-100 dark:bg-gray-600">
                          <i className="fas fa-cloud-upload-alt text-xs"></i>
                        </div>
                        <span className="text-sm">الانتقال للسحابة</span>
                      </Link>
                      
                      <Link
                        href="/whatsapp-integration"
                        className={`flex items-center space-x-reverse space-x-2 px-3 py-2 rounded-lg no-flicker touch-target ${
                          location === "/whatsapp-integration" 
                            ? "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] font-medium border-r-2 border-[hsl(var(--primary))]" 
                            : "text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-600"
                        } transition-all duration-200`}
                      >
                        <div className="w-6 h-6 rounded-full flex items-center justify-center bg-green-100 dark:bg-gray-600">
                          <i className="fab fa-whatsapp text-xs"></i>
                        </div>
                        <span className="text-sm">تكامل WhatsApp</span>
                      </Link>
                    </div>
                  </div>
                </div>

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
