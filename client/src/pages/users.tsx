import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { UserForm } from '@/components/user-form';
import { UserList } from '@/components/user-list';
import { UserProjectManager } from '@/components/user-project-manager';
import { queryClient } from '@/lib/queryClient';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, UserIcon, ShieldIcon, EyeIcon } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Users() {
  const { user } = useAuth();
  
  interface User {
    id: number;
    username: string;
    name: string;
    email: string;
    role: string;
    permissions?: string[];
    active: boolean;
  }
  
  // Check if user is admin
  if (user?.role !== 'admin') {
    return (
      <div className="py-6 px-4 pb-mobile-nav-large">
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-[hsl(var(--primary))]">إدارة المستخدمين</h2>
          <p className="text-[hsl(var(--muted-foreground))] mt-2">إدارة حسابات المستخدمين والصلاحيات</p>
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
  
  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });
  
  const handleUserUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/users'] });
  };
  
  // حساب إحصائيات المستخدمين
  const userStats = {
    total: users?.length || 0,
    admins: users?.filter(u => u.role === 'admin').length || 0,
    users: users?.filter(u => u.role === 'user').length || 0,
    viewers: users?.filter(u => u.role === 'viewer').length || 0,
    active: users?.filter(u => u.active).length || 0,
    inactive: users?.filter(u => !u.active).length || 0,
  };

  return (
    <div className="py-4 sm:py-6 px-3 sm:px-4 pb-mobile-nav-large">
      {/* Header Section */}
      <div className="mb-6 sm:mb-8">
        <div className="bg-gradient-to-l from-[hsl(var(--primary))] to-[hsl(var(--primary))/90] text-white py-4 sm:py-6 px-4 sm:px-6 rounded-xl shadow-lg mb-6 dark:from-[hsl(var(--primary))/90] dark:to-[hsl(var(--primary))/70]">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2">إدارة المستخدمين</h2>
          <p className="text-white/80 dark:text-white/70 text-sm sm:text-base">
            إدارة حسابات المستخدمين والصلاحيات وأدوار النظام
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <UserIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">إجمالي المستخدمين</p>
                <p className="text-lg font-bold text-gray-800 dark:text-gray-200">{userStats.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <ShieldIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">المديرين</p>
                <p className="text-lg font-bold text-gray-800 dark:text-gray-200">{userStats.admins}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <UserIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">المستخدمين العاديين</p>
                <p className="text-lg font-bold text-gray-800 dark:text-gray-200">{userStats.users}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <EyeIcon className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">المشاهدين</p>
                <p className="text-lg font-bold text-gray-800 dark:text-gray-200">{userStats.viewers}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <UserIcon className="h-4 w-4" />
            <span>إدارة المستخدمين</span>
          </TabsTrigger>
          <TabsTrigger value="add" className="flex items-center gap-2">
            <i className="fas fa-plus h-4 w-4" />
            <span>إضافة مستخدم</span>
          </TabsTrigger>
          <TabsTrigger value="projects" className="flex items-center gap-2">
            <i className="fas fa-link h-4 w-4" />
            <span>ربط المشاريع</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] sm:border-2 p-4 sm:p-6 rounded-xl shadow-md sm:shadow-lg fade-in">
            <div className="flex items-center justify-between mb-4 sm:mb-5">
              <h3 className="text-base sm:text-lg md:text-xl font-bold flex items-center space-x-2 space-x-reverse bg-[hsl(var(--primary))/10] dark:bg-[hsl(var(--primary))/20] p-2 sm:p-3 rounded-lg">
                <i className="fas fa-users text-[hsl(var(--primary))] dark:text-[hsl(var(--primary))/80] text-lg sm:text-xl"></i>
                <span className="text-[hsl(var(--primary))] dark:text-[hsl(var(--primary))/90]">قائمة المستخدمين</span>
              </h3>
              <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-lg">
                إجمالي المستخدمين: {users?.length || 0}
              </div>
            </div>
            <UserList 
              users={users || []} 
              isLoading={isLoading}
              onUserUpdated={handleUserUpdated}
              currentUserId={user?.id}
            />
          </div>
        </TabsContent>

        <TabsContent value="add">
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] sm:border-2 p-4 sm:p-6 rounded-xl shadow-md sm:shadow-lg fade-in">
            <div className="flex items-center mb-4 sm:mb-5">
              <h3 className="text-base sm:text-lg md:text-xl font-bold flex items-center space-x-2 space-x-reverse bg-[hsl(var(--primary))/10] dark:bg-[hsl(var(--primary))/20] p-2 sm:p-3 rounded-lg">
                <i className="fas fa-user-plus text-[hsl(var(--primary))] dark:text-[hsl(var(--primary))/80] text-lg sm:text-xl"></i>
                <span className="text-[hsl(var(--primary))] dark:text-[hsl(var(--primary))/90]">إضافة مستخدم جديد</span>
              </h3>
            </div>
            <UserForm onSubmit={handleUserUpdated} />
          </div>
        </TabsContent>

        <TabsContent value="projects">
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] sm:border-2 p-4 sm:p-6 rounded-xl shadow-md sm:shadow-lg fade-in">
            <div className="flex items-center mb-4 sm:mb-5">
              <h3 className="text-base sm:text-lg md:text-xl font-bold flex items-center space-x-2 space-x-reverse bg-[hsl(var(--primary))/10] dark:bg-[hsl(var(--primary))/20] p-2 sm:p-3 rounded-lg">
                <i className="fas fa-link text-[hsl(var(--primary))] dark:text-[hsl(var(--primary))/80] text-lg sm:text-xl"></i>
                <span className="text-[hsl(var(--primary))] dark:text-[hsl(var(--primary))/90]">ربط المستخدمين بالمشاريع</span>
              </h3>
            </div>
            <UserProjectManager />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
