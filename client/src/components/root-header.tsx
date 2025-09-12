import { useAuth } from "@/hooks/use-auth";
import { UserMenu } from "@/components/ui/user-menu";
import { Button } from "@/components/ui/button";
import { ArrowRight, Home } from "lucide-react";
import { Link, useLocation } from "wouter";

interface RootHeaderProps {
  title?: string;
  showBackButton?: boolean;
  children?: React.ReactNode;
}

export function RootHeader({ title, showBackButton = true, children }: RootHeaderProps) {
  const { user } = useAuth();
  const [location] = useLocation();
  
  // تحديد عنوان الصفحة الحالية
  const getPageTitle = () => {
    if (title) return title;
    
    switch (location) {
      case '/': return 'الصفحة الرئيسية';
      case '/transactions': return 'العمليات المالية';
      case '/projects': return 'المشاريع';
      case '/users': return 'المستخدمين';
      case '/employees': return 'الموظفين';
      case '/documents': return 'المستندات';
      case '/archive': return 'الأرشيف';
      case '/reports': return 'التقارير';
      case '/activities': return 'سجل النشاطات';
      case '/settings': return 'الإعدادات';
      case '/receivables': return 'الذمم المدينة';
      case '/deferred-payments': return 'الدفعات المؤجلة';
      case '/completed-works': return 'الأعمال المنجزة';
      case '/database-management': return 'إدارة قاعدة البيانات';
      case '/whatsapp-integration': return 'تكامل واتساب';
      case '/system-management': return 'إدارة النظام';
      case '/hybrid-storage': return 'التخزين المختلط';
      case '/supabase-status': return 'حالة Supabase';
      case '/file-migration': return 'ترحيل الملفات';
      case '/cloud-migration': return 'ترحيل التخزين السحابي';
      default: return 'صفحة غير معروفة';
    }
  };

  const isHomePage = location === '/';

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* اليسار: العنوان وزر الرجوع */}
          <div className="flex items-center space-x-4 space-x-reverse">
            {!isHomePage && showBackButton && (
              <Link href="/">
                <Button variant="ghost" size="sm" className="gap-2">
                  <Home className="h-4 w-4" />
                  <span className="hidden sm:inline">الرئيسية</span>
                </Button>
              </Link>
            )}
            
            <div className="flex flex-col">
              <h1 className="text-lg font-semibold text-foreground">
                {getPageTitle()}
              </h1>
              {user && (
                <p className="text-xs text-muted-foreground">
                  مرحباً، {user.name || user.username}
                </p>
              )}
            </div>
          </div>

          {/* الوسط: محتوى إضافي */}
          <div className="flex-1 flex justify-center">
            {children}
          </div>

          {/* اليمين: قائمة المستخدم */}
          <div className="flex items-center space-x-4 space-x-reverse">
            <UserMenu />
          </div>
        </div>
      </div>
    </header>
  );
}