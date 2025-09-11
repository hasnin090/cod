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
  const [isMobile, setIsMobile] = useState(false);
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();

  // فتح قسم الحسابات تلقائياً عند زيارة إحدى صفحاته
  useEffect(() => {
    if (location === "/transactions" || location === "/receivables") {
      setIsAccountsOpen(true);
    }
  }, [location]);

  // مراقبة حجم الشاشة لتحديد عرض الجوال
  useEffect(() => {
    const handleResize = () => {
      const mobileView = window.innerWidth < 768;
      setIsMobile(mobileView);
      setIsOpen(!mobileView);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // إغلاق القائمة عند تغيير الصفحة على الهاتف
  useEffect(() => {
    if (isMobile) setIsOpen(false);
  }, [location, isMobile]);

  // جلب المشاريع المتاحة للمستخدم (غير المدير)
  const { data: userProjects, isLoading: isLoadingProjects } = useQuery<Project[]>({
    queryKey: ["/api/user-projects"],
    enabled: !!user && user.role !== "admin",
    queryFn: async () => {
      if (!user) return [] as Project[];
      const res = await fetch("/api/user-projects");
      if (!res.ok) throw new Error("فشل في جلب المشاريع");
      return res.json();
    },
    staleTime: 1000 * 60 * 3,
    retry: 1,
  });

  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
  useEffect(() => {
    if (Array.isArray(userProjects) && userProjects.length > 0 && !activeProjectId) {
      setActiveProjectId(userProjects[0].id);
    }
  }, [userProjects, activeProjectId]);

  const activeProject = Array.isArray(userProjects)
    ? userProjects.find((p) => p.id === activeProjectId)
    : undefined;

  // زر تسجيل الخروج
  const handleLogout = () => {
    try {
      logout();
      queryClient.clear();
      toast({ title: "تم تسجيل الخروج بنجاح", description: "شكراً لاستخدامك التطبيق" });
    } catch (error) {
      console.error("Logout error:", error);
      toast({ variant: "destructive", title: "خطأ في تسجيل الخروج", description: "يرجى المحاولة مرة أخرى" });
    }
  };

  // مكون داخلي لعرض اسم الشركة/المشروع
  function CompanyName() {
    const { user } = useAuth();
    if (!user) return <span>جاري التحميل...</span>;

    const { data: settings, isLoading: isLoadingSettings } = useQuery<{ key: string; value: string }[]>({
      queryKey: ["/api/settings"],
      enabled: !!user && user.role === "admin",
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
    });

    const { data: nestedProjects, isLoading: isLoadingNestedProjects } = useQuery<Project[]>({
      queryKey: ["/api/user-projects", "header"],
      enabled: !!user && user.role !== "admin",
      staleTime: 1000 * 60 * 3,
    });

    const activeNested = useMemo(() => {
      return Array.isArray(nestedProjects) && nestedProjects.length > 0 ? nestedProjects[0] : undefined;
    }, [nestedProjects]);

    const companyName = useMemo(() => {
      if (!settings || !Array.isArray(settings)) return "مدير النظام";
      const companyNameSetting = settings.find((s) => s.key === "companyName");
      if (companyNameSetting?.value) return companyNameSetting.value;
      const alternativeNameSetting = settings.find((s) => s.key === "company_name");
      return alternativeNameSetting?.value || "مدير النظام";
    }, [settings]);

    if (isLoadingSettings && user?.role === "admin") return <span className="opacity-70">جاري التحميل...</span>;
    if (user?.role === "admin") return <span>{companyName}</span>;
    if (activeNested) return <span>{activeNested.name}</span>;
    if (isLoadingNestedProjects) return <span className="opacity-70">جاري التحميل...</span>;
    return <span>مدير المشاريع</span>;
  }

  return (
    <>
      {/* زخرفة الصفحة */}
      <div className="page-decoration"></div>
      <div className="page-decoration-2"></div>
      {/* شريط علوي */}
      <AppHeader onOpenSidebar={() => setIsOpen(true)} />
      {/* خلفية لإغلاق القائمة على الجوال */}
      {isOpen && isMobile && <div className="sidebar-overlay-pro" onClick={() => setIsOpen(false)} />}

      {/* الشريط الجانبي */}
      <aside className={`sidebar-pro ${isMobile ? (isOpen ? "translate-x-0 z-50" : "translate-x-full") : "translate-x-0"}`}>
        <div className="sidebar-header-pro">
          <div className="sidebar-brand-pro">
            <div className="sidebar-brand-icon">
              <i className="fas fa-shield-alt"></i>
            </div>
            <div>
              <h1 className="sidebar-brand-title">{user ? <CompanyName /> : "نظام المحاسبة"}</h1>
              <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">الإصدار 1.0.2</p>
            </div>
          </div>
        </div>

        {/* بطاقة المستخدم */}
        {user && (
          <div className="px-5 md:px-6">
            <div className="card-pro p-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                  <i className="fas fa-user-circle"></i>
                </div>
                <div>
                  <div className="text-foreground font-medium text-base sm:text-lg">
                    <CompanyName />
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground mt-1">
                    <span className="font-bold">{user.name}</span>
                  </div>
                </div>
              </div>
              {user.role !== "admin" && activeProject && (
                <div className="mt-3 pt-3 border-t border-border/60">
                  <div className="text-xs text-muted-foreground mb-1">المشروع النشط</div>
                  <div className="text-sm font-medium text-foreground">{activeProject.name}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* القائمة الرئيسية */}
        <div>
          <div className="sidebar-section-title">القائمة الرئيسية</div>
          <nav className="nav-pro">
            <Link href="/" className={`nav-item-pro ${location === "/" ? "active" : ""}`}>
              <div className="nav-icon-pro">
                <i className="fas fa-chart-line"></i>
              </div>
              <span className="text-sm font-medium">لوحة التحكم</span>
            </Link>

            {/* الحسابات */}
            <button onClick={() => setIsAccountsOpen(!isAccountsOpen)} className={`nav-item-pro w-full justify-between ${location === "/transactions" || location === "/receivables" ? "active" : ""}`}>
              <div className="flex items-center gap-3">
                <div className="nav-icon-pro">
                  <i className="fas fa-wallet"></i>
                </div>
                <span className="text-sm font-medium">الحسابات</span>
              </div>
              <i className={`fas fa-chevron-down text-xs transition-transform ${isAccountsOpen ? "rotate-180" : ""}`}></i>
            </button>
            <div className={`${isAccountsOpen ? "max-h-40 opacity-100 translate-y-0" : "max-h-0 opacity-0 -translate-y-2"} submenu-pro`}>
              <Link href="/transactions" className={`submenu-item-pro ${location === "/transactions" ? "active" : ""}`}>
                <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center">
                  <i className="fas fa-exchange-alt text-[11px]"></i>
                </div>
                <span className="text-[13px] sm:text-sm">المعاملات</span>
              </Link>
              <Link href="/receivables" className={`submenu-item-pro ${location === "/receivables" ? "active" : ""}`}>
                <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center">
                  <i className="fas fa-hand-holding-usd text-[11px]"></i>
                </div>
                <span className="text-[13px] sm:text-sm">المبالغ المستحقة</span>
              </Link>
            </div>

            {/* المشاريع */}
            {user?.role !== "viewer" && (
              <Link href="/projects" className={`nav-item-pro ${location === "/projects" ? "active" : ""}`}>
                <div className="nav-icon-pro">
                  <i className="fas fa-project-diagram"></i>
                </div>
                <span className="text-sm font-medium">المشاريع</span>
              </Link>
            )}

            {/* الوثائق */}
            <Link href="/documents" className={`nav-item-pro ${location === "/documents" ? "active" : ""}`}>
              <div className="nav-icon-pro">
                <i className="fas fa-file-alt"></i>
              </div>
              <span className="text-sm font-medium">الوثائق</span>
            </Link>

            {/* التقارير */}
            <Link href="/reports" className={`nav-item-pro ${location === "/reports" ? "active" : ""}`}>
              <div className="nav-icon-pro">
                <i className="fas fa-chart-pie"></i>
              </div>
              <span className="text-sm font-medium">التقارير</span>
            </Link>

            {/* الموظفين */}
            <Link href="/employees" className={`nav-item-pro ${location === "/employees" ? "active" : ""}`}>
              <div className="nav-icon-pro">
                <i className="fas fa-id-badge"></i>
              </div>
              <span className="text-sm font-medium">الموظفين</span>
            </Link>

            {/* الدفعات المؤجلة */}
            <Link href="/deferred-payments" className={`nav-item-pro ${location === "/deferred-payments" ? "active" : ""}`}>
              <div className="nav-icon-pro">
                <i className="fas fa-clock"></i>
              </div>
              <span className="text-sm font-medium">الدفعات المؤجلة</span>
            </Link>

            {/* الأعمال المكتملة */}
            <Link href="/completed-works" className={`nav-item-pro ${location === "/completed-works" ? "active" : ""}`}>
              <div className="nav-icon-pro">
                <i className="fas fa-check-circle"></i>
              </div>
              <span className="text-sm font-medium">الأعمال المكتملة</span>
            </Link>

            {/* الأرشيف */}
            <Link href="/archive" className={`nav-item-pro ${location === "/archive" ? "active" : ""}`}>
              <div className="nav-icon-pro">
                <i className="fas fa-archive"></i>
              </div>
              <span className="text-sm font-medium">الأرشيف</span>
            </Link>
          </nav>
        </div>

        {/* المشاريع المتاحة للمستخدم العادي */}
        {user && user.role !== "admin" && (
          <div className="mt-4">
            <div className="sidebar-section-title">مشاريعي</div>
            <nav className="nav-pro">
              {isLoadingProjects ? (
                <div className="flex items-center justify-center py-6">
                  <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                  <span className="mr-3 text-sm text-muted-foreground">جاري التحميل...</span>
                </div>
              ) : Array.isArray(userProjects) && userProjects.length > 0 ? (
                <div className="space-y-2">
                  {userProjects.map((project) => (
                    <div key={project.id} className="group relative">
                      <Link
                        href={`/projects/details/${project.id}`}
                        className={`flex items-center justify-between px-3 py-3 rounded-xl transition-all duration-200 ${activeProjectId === project.id ? "bg-primary/10 text-primary" : "hover:bg-muted/60"}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${activeProjectId === project.id ? "bg-primary/15 text-primary" : "bg-muted text-foreground/70"}`}>
                            <i className={`fas fa-${activeProjectId === project.id ? "folder-open" : "folder"} text-sm`}></i>
                          </div>
                          <span className="font-medium truncate text-[13px] sm:text-sm text-foreground">{project.name}</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setActiveProjectId(project.id);
                          }}
                          className={`w-5 h-5 rounded-full flex items-center justify-center ${activeProjectId === project.id ? "bg-primary text-primary-foreground" : "bg-muted opacity-0 group-hover:opacity-100"} transition-opacity`}
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
                  <p className="text-muted-foreground text-sm">لا توجد مشاريع متاحة</p>
                </div>
              )}
            </nav>
          </div>
        )}

        {/* الإدارة والمستخدمين */}
        {user?.role === "admin" && (
          <div className="mt-4">
            <div className="sidebar-section-title">الإدارة والمستخدمين</div>
            <nav className="nav-pro">
              <Link href="/users" className={`nav-item-pro ${location === "/users" ? "active" : ""}`}>
                <div className="nav-icon-pro">
                  <i className="fas fa-users-cog"></i>
                </div>
                <span className="text-sm font-medium">إدارة المستخدمين</span>
              </Link>
              <Link href="/activities" className={`nav-item-pro ${location === "/activities" ? "active" : ""}`}>
                <div className="nav-icon-pro">
                  <i className="fas fa-history"></i>
                </div>
                <span className="text-sm font-medium">سجل النشاطات</span>
              </Link>
            </nav>
          </div>
        )}

        {/* إعدادات النظام */}
        {user?.role === "admin" && (
          <div className="mt-4">
            <div className="sidebar-section-title">إعدادات النظام</div>
            <nav className="nav-pro">
              <Link href="/settings" className={`nav-item-pro ${location === "/settings" ? "active" : ""}`}>
                <div className="nav-icon-pro">
                  <i className="fas fa-cog"></i>
                </div>
                <span className="text-sm font-medium">الإعدادات العامة</span>
              </Link>
              <Link href="/database-management" className={`nav-item-pro ${location === "/database-management" ? "active" : ""}`}>
                <div className="nav-icon-pro">
                  <i className="fas fa-database"></i>
                </div>
                <span className="text-sm font-medium">إدارة قواعد البيانات</span>
              </Link>
            </nav>
          </div>
        )}

        {/* زر تسجيل الخروج */}
        <div className="px-5 md:px-6 pt-2 mt-4">
          <button onClick={handleLogout} className="btn-pro w-full bg-destructive/10 text-destructive hover:bg-destructive/20">
            <i className="fas fa-sign-out-alt"></i>
            <span>تسجيل خروج</span>
          </button>
        </div>

        {/* تذييل */}
        <div className="p-4 text-center text-xs text-muted-foreground border-t border-border mt-auto">
          <p>نظام Code-01 - الإصدار 1.0.2</p>
          <p className="mt-1">© 2025 جميع الحقوق محفوظة</p>
        </div>
      </aside>
    </>
  );
}
