import { useAuth } from '@/hooks/use-auth';
import { UserProjectManager } from '@/components/user-project-manager';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, LinkIcon } from 'lucide-react';

export default function UserProjectsPage() {
  const { user } = useAuth();
  
  // Check if user is admin
  if (user?.role !== 'admin') {
    return (
      <div className="py-6 px-4 pb-mobile-nav-large">
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-[hsl(var(--primary))]">ربط المستخدمين بالمشاريع</h2>
          <p className="text-[hsl(var(--muted-foreground))] mt-2">إدارة ربط المستخدمين بالمشاريع المخصصة لهم</p>
        </div>
        
        <Alert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4 ml-2" />
          <AlertTitle>غير مصرح</AlertTitle>
          <AlertDescription>
            ليس لديك صلاحيات كافية للوصول إلى هذه الصفحة. يرجى التواصل مع مدير النظام.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="py-4 sm:py-6 px-3 sm:px-4 pb-mobile-nav-large">
      {/* Header Section */}
      <div className="mb-6 sm:mb-8">
        <div className="bg-gradient-to-l from-[hsl(var(--primary))] to-[hsl(var(--primary))/90] text-white py-4 sm:py-6 px-4 sm:px-6 rounded-xl shadow-lg mb-6 dark:from-[hsl(var(--primary))/90] dark:to-[hsl(var(--primary))/70]">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2 flex items-center gap-2">
            <LinkIcon className="h-6 w-6" />
            ربط المستخدمين بالمشاريع
          </h2>
          <p className="text-white/80 dark:text-white/70 text-sm sm:text-base">
            إدارة ربط المستخدمين بالمشاريع المخصصة لهم وتحديد صلاحيات الوصول
          </p>
        </div>
      </div>

      {/* User Project Manager Component */}
      <UserProjectManager />
    </div>
  );
}