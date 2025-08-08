import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  SaveIcon, 
  KeyIcon, 
  EyeIcon, 
  EyeOffIcon, 
  InfoIcon, 
  UserIcon, 
  ShieldIcon, 
  LockIcon,
  TrashIcon
} from 'lucide-react';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';
import { TransactionEditPermissions } from '@/components/transaction-edit-permissions';

interface User {
  id: number;
  username: string;
  name: string;
  email: string;
  role: string;
  permissions?: string[];
  active: boolean;
}

interface UserListProps {
  users: User[];
  isLoading: boolean;
  onUserUpdated: () => void;
  currentUserId: number | undefined;
}

// مخطط بيانات تعديل المستخدم
const userEditSchema = z.object({
  name: z.string().min(3, "الاسم يجب أن يحتوي على الأقل 3 أحرف"),
  role: z.enum(["admin", "user", "viewer"], {
    required_error: "الصلاحية مطلوبة",
  }),
  permissions: z.array(z.string()).optional(),
  password: z.string().optional(),
});

type UserEditFormValues = z.infer<typeof userEditSchema>;

// الصلاحيات المنظمة بحسب الفئة
const permissionCategories = [
  {
    title: "إدارة لوحة التحكم",
    icon: <ShieldIcon className="h-4 w-4" />,
    color: "emerald",
    permissions: [
      { id: "view_dashboard", label: "عرض لوحة التحكم", description: "الوصول إلى لوحة التحكم الرئيسية" },
    ]
  },
  {
    title: "إدارة المستخدمين",
    icon: <UserIcon className="h-4 w-4" />,
    color: "blue", 
    permissions: [
      { id: "manage_users", label: "إدارة المستخدمين", description: "إضافة وتعديل وحذف المستخدمين" },
      { id: "view_users", label: "عرض المستخدمين", description: "عرض قائمة المستخدمين" },
    ]
  },
  {
    title: "إدارة المشاريع",
    icon: <KeyIcon className="h-4 w-4" />,
    color: "purple",
    permissions: [
      { id: "manage_projects", label: "إدارة المشاريع", description: "إنشاء وتعديل وحذف المشاريع" },
      { id: "view_projects", label: "عرض المشاريع", description: "عرض قائمة المشاريع" },
    ]
  },
  {
    title: "إدارة المعاملات المالية",
    icon: <LockIcon className="h-4 w-4" />,
    color: "orange",
    permissions: [
      { id: "manage_transactions", label: "إدارة المعاملات", description: "إضافة وتعديل وحذف المعاملات المالية" },
      { id: "view_transactions", label: "عرض المعاملات", description: "عرض قائمة المعاملات المالية" },
      { id: "manage_project_transactions", label: "إدارة معاملات المشاريع", description: "إدارة المعاملات الخاصة بالمشاريع" },
      { id: "view_project_transactions", label: "عرض معاملات المشاريع", description: "عرض المعاملات الخاصة بالمشاريع" },
    ]
  },
  {
    title: "إدارة المستندات",
    icon: <InfoIcon className="h-4 w-4" />,
    color: "teal",
    permissions: [
      { id: "manage_documents", label: "إدارة المستندات", description: "رفع وتعديل وحذف المستندات" },
      { id: "view_documents", label: "عرض المستندات", description: "عرض وتحميل المستندات" },
    ]
  },
  {
    title: "التقارير والإعدادات",
    icon: <EyeIcon className="h-4 w-4" />,
    color: "pink",
    permissions: [
      { id: "view_reports", label: "عرض التقارير", description: "الوصول إلى التقارير المالية" },
      { id: "view_activity_logs", label: "عرض سجل النشاطات", description: "مراجعة سجل العمليات والتغييرات" },
      { id: "manage_settings", label: "إدارة الإعدادات", description: "تعديل إعدادات النظام" },
    ]
  }
];

interface UserEditFormProps {
  user: User;
  onSubmit: (data: Partial<User>) => void;
  isLoading: boolean;
}

function UserEditForm({ user, onSubmit, isLoading }: UserEditFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showPermissions, setShowPermissions] = useState(user.role === "user");
  
  const form = useForm<UserEditFormValues>({
    resolver: zodResolver(userEditSchema),
    defaultValues: {
      name: user.name,
      role: user.role as "admin" | "user" | "viewer",
      permissions: Array.isArray(user.permissions) ? user.permissions : [],
      password: "",
    },
  });

  function onFormSubmit(data: UserEditFormValues) {
    // إذا كانت كلمة المرور فارغة، قم بحذفها من البيانات المرسلة
    if (!data.password) {
      delete data.password;
    }
    
    onSubmit(data);
  }

  // تحديث دور المستخدم وعرض/إخفاء الصلاحيات
  const handleRoleChange = (role: string) => {
    form.setValue("role", role as "admin" | "user" | "viewer");
    setShowPermissions(role === "user" || role === "viewer");
    
    // إعادة تعيين الصلاحيات حسب الدور
    if (role === "admin") {
      form.setValue("permissions", []);
    } else if (role === "viewer") {
      form.setValue("permissions", ["viewOnly"]);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-4 mt-2">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>الاسم الكامل</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="أدخل الاسم الكامل"
                  className="w-full rounded-lg bg-white border border-blue-100 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  disabled={isLoading}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center">
                كلمة المرور (اختياري)
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <InfoIcon className="h-3.5 w-3.5 mr-1 text-blue-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="bg-blue-50 text-blue-900 border-blue-200">
                      <p>اتركها فارغة إذا لم ترغب بتغيير كلمة المرور</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </FormLabel>
              <div className="flex space-x-space-x-reverse space-x-2">
                <FormControl>
                  <div className="relative flex-1">
                    <Input
                      {...field}
                      type={showPassword ? "text" : "password"}
                      placeholder="اتركها فارغة للاحتفاظ بكلمة المرور الحالية"
                      className="w-full rounded-lg bg-white border border-blue-100 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 pr-10"
                      disabled={isLoading}
                    />
                    <LockIcon className="absolute top-2.5 right-3 h-5 w-5 text-slate-400" />
                    <button
                      type="button"
                      className="absolute top-2.5 left-3 h-5 w-5 text-slate-400"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                    </button>
                  </div>
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>الصلاحية</FormLabel>
              <Select 
                onValueChange={handleRoleChange} 
                value={field.value} 
                disabled={isLoading}
              >
                <FormControl>
                  <SelectTrigger className="w-full h-10 rounded-lg bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 focus:border-blue-600 dark:focus:border-blue-300 text-gray-900 dark:text-gray-100 shadow-sm">
                    <SelectValue placeholder="اختر الصلاحية" className="text-gray-700 dark:text-gray-300" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg">
                  <SelectItem value="admin" className="flex items-center hover:bg-red-50 dark:hover:bg-red-900/20 focus:bg-red-50 dark:focus:bg-red-900/20 text-gray-900 dark:text-gray-100">
                    <div className="flex items-center">
                      <ShieldIcon className="h-4 w-4 ml-2 text-red-600 dark:text-red-400" />
                      <span className="font-medium">مدير</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="user" className="flex items-center hover:bg-blue-50 dark:hover:bg-blue-900/20 focus:bg-blue-50 dark:focus:bg-blue-900/20 text-gray-900 dark:text-gray-100">
                    <div className="flex items-center">
                      <UserIcon className="h-4 w-4 ml-2 text-blue-600 dark:text-blue-400" />
                      <span className="font-medium">مستخدم</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="viewer" className="flex items-center hover:bg-green-50 dark:hover:bg-green-900/20 focus:bg-green-50 dark:focus:bg-green-900/20 text-gray-900 dark:text-gray-100">
                    <div className="flex items-center">
                      <EyeIcon className="h-4 w-4 ml-2 text-green-600 dark:text-green-400" />
                      <span className="font-medium">مشاهدة فقط</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormDescription className="text-gray-700 dark:text-gray-300 text-sm font-medium bg-gray-50 dark:bg-gray-800/50 px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700">
                {field.value === "admin" 
                  ? "⚡ المدير لديه صلاحيات كاملة للنظام" 
                  : field.value === "viewer"
                  ? "👁️ مشاهدة فقط - إمكانية عرض البيانات بدون تعديل"
                  : "🔧 المستخدم يحتاج لتحديد صلاحيات محددة"}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {showPermissions && (
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <ShieldIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <FormLabel className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                إدارة الصلاحيات
              </FormLabel>
            </div>
            
            <div className="space-y-6">
              {permissionCategories.map((category) => (
                <div key={category.title} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`p-2 rounded-lg bg-${category.color}-100 dark:bg-${category.color}-900/30 text-${category.color}-600 dark:text-${category.color}-400`}>
                      {category.icon}
                    </div>
                    <h4 className="font-medium text-gray-800 dark:text-gray-200">{category.title}</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2">
                    {category.permissions.map((permission) => (
                      <FormField
                        key={permission.id}
                        control={form.control}
                        name="permissions"
                        render={({ field }) => {
                          const isChecked = Array.isArray(field.value) && field.value.includes(permission.id);
                          return (
                            <FormItem
                              key={permission.id}
                              className="flex flex-row items-start space-x-reverse space-x-3 space-y-0 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                            >
                              <FormControl>
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={(checked) => {
                                    const currentPermissions = Array.isArray(field.value) ? field.value : [];
                                    return checked
                                      ? field.onChange([...currentPermissions, permission.id])
                                      : field.onChange(
                                          currentPermissions.filter((value) => value !== permission.id)
                                        );
                                  }}
                                  className={`mt-1 border-2 ${
                                    isChecked 
                                      ? `border-${category.color}-500 bg-${category.color}-500` 
                                      : 'border-gray-300 dark:border-gray-600'
                                  } data-[state=checked]:bg-${category.color}-500 data-[state=checked]:border-${category.color}-500`}
                                />
                              </FormControl>
                              <div className="flex-1 cursor-pointer" onClick={() => {
                                const currentPermissions = Array.isArray(field.value) ? field.value : [];
                                const newValue = isChecked
                                  ? currentPermissions.filter((value) => value !== permission.id)
                                  : [...currentPermissions, permission.id];
                                field.onChange(newValue);
                              }}>
                                <FormLabel className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer block">
                                  {permission.label}
                                </FormLabel>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {permission.description}
                                </p>
                              </div>
                            </FormItem>
                          );
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* قسم صلاحيات تعديل المعاملات - للمديرين فقط وللمستخدمين العاديين */}
        {user && user.role === 'user' && (
          <TransactionEditPermissions userId={user.id} userName={user.name} />
        )}

        <div className="flex justify-end mt-6">
          <Button 
            type="submit"
            className="bg-primary hover:bg-primary/90 text-white"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                جاري الحفظ...
              </>
            ) : (
              <>
                <SaveIcon className="ml-2 h-4 w-4" />
                حفظ التغييرات
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export function UserList({ users, isLoading, onUserUpdated, currentUserId }: UserListProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const { toast } = useToast();

  // ترتيب المستخدمين: المدير أولاً، ثم المستخدمين، ثم المشاهدين، ثم بالاسم
  const sortedUsers = [...(users || [])].sort((a, b) => {
    // ترتيب حسب الدور أولاً
    const roleOrder = { admin: 1, user: 2, viewer: 3 };
    const roleComparison = (roleOrder[a.role as keyof typeof roleOrder] || 4) - (roleOrder[b.role as keyof typeof roleOrder] || 4);
    
    if (roleComparison !== 0) {
      return roleComparison;
    }
    
    // ثم ترتيب بالاسم
    return a.name.localeCompare(b.name, 'ar');
  });
  
  const deleteMutation = useMutation({
    mutationFn: (id: number) => {
      return apiRequest(`/api/users/${id}`, 'DELETE', undefined);
    },
    onSuccess: () => {
      toast({
        title: "تم الحذف بنجاح",
        description: "تم حذف المستخدم بنجاح",
      });
      
      // تحديث فوري للكاش
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.refetchQueries({ queryKey: ['/api/users'] });
      
      onUserUpdated();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: error instanceof Error ? error.message : "فشل في حذف المستخدم",
      });
    },
  });
  
  const updateMutation = useMutation({
    mutationFn: (data: {id: number, userData: Partial<User>}) => {
      return apiRequest(`/api/users/${data.id}`, 'PUT', data.userData);
    },
    onSuccess: () => {
      toast({
        title: "تم التعديل بنجاح",
        description: "تم تعديل بيانات المستخدم بنجاح",
      });
      
      // تحديث فوري للكاش
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.refetchQueries({ queryKey: ['/api/users'] });
      
      setEditDialogOpen(false);
      onUserUpdated();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: error instanceof Error ? error.message : "فشل في تعديل المستخدم",
      });
    },
  });
  
  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };
  
  const confirmDelete = () => {
    if (userToDelete) {
      deleteMutation.mutate(userToDelete.id);
    }
    setDeleteDialogOpen(false);
  };
  
  const handleEditClick = (user: User) => {
    setUserToEdit(user);
    setEditDialogOpen(true);
  };
  
  const handleUserUpdate = (userData: Partial<User>) => {
    if (userToEdit) {
      updateMutation.mutate({
        id: userToEdit.id,
        userData
      });
    }
  };
  
  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-gradient-to-r from-red-500 to-red-600 text-white shadow-sm">مدير النظام</Badge>;
      case 'user':
        return <Badge className="bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm">مستخدم</Badge>;
      case 'viewer':
        return <Badge className="bg-gradient-to-r from-green-500 to-green-600 text-white shadow-sm">مشاهد</Badge>;
      default:
        return <Badge className="bg-gray-500 text-white">{role}</Badge>;
    }
  };
  
  const getPermissionText = (permission: string) => {
    // خريطة الصلاحيات الكاملة بالعربية
    const permissionTranslations = {
      // لوحة التحكم
      'view_dashboard': 'عرض لوحة التحكم',
      
      // إدارة المستخدمين
      'manage_users': 'إدارة المستخدمين',
      'view_users': 'عرض المستخدمين',
      
      // إدارة المشاريع
      'manage_projects': 'إدارة المشاريع',
      'view_projects': 'عرض المشاريع',
      'manage_project_transactions': 'إدارة معاملات المشاريع',
      'view_project_transactions': 'عرض معاملات المشاريع',
      
      // إدارة المعاملات
      'manage_transactions': 'إدارة المعاملات',
      'view_transactions': 'عرض المعاملات',
      
      // إدارة المستندات
      'manage_documents': 'إدارة المستندات',
      'view_documents': 'عرض المستندات',
      
      // التقارير وإعدادات النظام
      'view_reports': 'عرض التقارير',
      'view_activity_logs': 'عرض سجل النشاطات',
      'manage_settings': 'إدارة إعدادات النظام',
      
      // صلاحيات إضافية للتوافق مع النظام القديم
      'viewReports': 'عرض التقارير',
      'manageProjects': 'إدارة المشاريع',
      'manageTransactions': 'إدارة المعاملات',
      'manageDocuments': 'إدارة المستندات',
    };
    
    return permissionTranslations[permission as keyof typeof permissionTranslations] || permission;
  };
  
  if (isLoading) {
    return (
      <div className="text-center py-20">
        <div className="spinner w-8 h-8 mx-auto"></div>
        <p className="mt-4 text-muted">جاري تحميل البيانات...</p>
      </div>
    );
  }
  
  if (sortedUsers.length === 0) {
    return (
      <div className="bg-secondary-light rounded-xl shadow-card p-10 text-center">
        <p className="text-muted-foreground">لا يوجد مستخدمين حتى الآن</p>
        <p className="text-sm text-muted mt-2">أضف مستخدم جديد باستخدام النموذج أعلاه</p>
      </div>
    );
  }
  
  return (
    <>
      {/* جدول للشاشات المتوسطة والكبيرة */}
      <div className="hidden md:block bg-secondary-light rounded-xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-secondary">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700">
              <tr>
                <th scope="col" className="px-3 sm:px-4 py-3 sm:py-4 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b-2 border-primary/20">
                  اسم المستخدم
                </th>
                <th scope="col" className="px-3 sm:px-4 py-3 sm:py-4 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b-2 border-primary/20">
                  الاسم الكامل
                </th>
                <th scope="col" className="px-3 sm:px-4 py-3 sm:py-4 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b-2 border-primary/20">
                  الصلاحية
                </th>
                <th scope="col" className="px-3 sm:px-4 py-3 sm:py-4 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b-2 border-primary/20">
                  الصلاحيات
                </th>
                <th scope="col" className="px-3 sm:px-4 py-3 sm:py-4 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b-2 border-primary/20">
                  الإجراءات
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-light">
              {sortedUsers.map((user, index) => (
                <tr key={user.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                  user.role === 'admin' ? 'bg-red-50/30 dark:bg-red-900/10' : 
                  user.role === 'user' ? 'bg-blue-50/30 dark:bg-blue-900/10' : 
                  'bg-green-50/30 dark:bg-green-900/10'
                }`}>
                  <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                    <div className="flex items-center">
                      <div className={`w-2 h-8 rounded-full ml-3 ${
                        user.role === 'admin' ? 'bg-red-500' : 
                        user.role === 'user' ? 'bg-blue-500' : 
                        'bg-green-500'
                      }`}></div>
                      <div>
                        <div className="font-semibold">{user.username}</div>
                        {currentUserId === user.id && (
                          <span className="text-xs text-primary bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded-full">(أنت)</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 sm:px-4 py-3 sm:py-4 text-sm text-gray-800 dark:text-gray-200 font-medium">
                    {user.name}
                  </td>
                  <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap">
                    {getRoleBadge(user.role)}
                  </td>
                  <td className="px-3 sm:px-4 py-2 sm:py-3 text-sm text-neutral-light">
                    {user.role === 'admin' ? (
                      <span className="text-xs">جميع الصلاحيات</span>
                    ) : user.permissions && user.permissions.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {user.permissions.map((permission) => (
                          <Badge key={permission} variant="outline" className="text-xs">
                            {getPermissionText(permission)}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs">لا توجد صلاحيات</span>
                    )}
                  </td>
                  <td className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-sm">
                    <div className="flex space-x-reverse space-x-2">
                      <button 
                        className="text-primary-light hover:text-primary-dark transition-colors p-1 rounded-full hover:bg-blue-50"
                        onClick={() => handleEditClick(user)}
                        title="تعديل المستخدم"
                      >
                        <UserIcon className="h-4 w-4" />
                      </button>
                      <button 
                        className="text-destructive hover:text-red-700 transition-colors p-1 rounded-full hover:bg-red-50"
                        onClick={() => handleDeleteClick(user)}
                        disabled={currentUserId === user.id}
                        title={currentUserId === user.id ? "لا يمكن حذف المستخدم الحالي" : "حذف المستخدم"}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* بطاقات للشاشات الصغيرة */}
      <div className="md:hidden grid grid-cols-1 gap-3">
        {sortedUsers.map((user) => (
          <div 
            key={user.id}
            className="bg-white dark:bg-gray-800 shadow-sm border dark:border-gray-700 rounded-lg p-3 hover:shadow-md transition-all duration-300"
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary))/70] flex items-center justify-center shadow-sm ml-2.5">
                  <UserIcon className="h-3.5 w-3.5 text-white" />
                </div>
                <div>
                  <div className="font-medium text-sm flex items-center">
                    {user.username}
                    {currentUserId === user.id && (
                      <span className="text-xs text-primary-light mr-1.5 bg-blue-50 dark:bg-blue-900/40 px-1 py-0.5 rounded-md">(أنت)</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{user.name}</div>
                </div>
              </div>
              {getRoleBadge(user.role)}
            </div>
            
            {/* الصلاحيات */}
            <div className="mb-4">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">الصلاحيات:</span>
              {user.role === 'admin' ? (
                <div className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-md inline-block">
                  جميع الصلاحيات
                </div>
              ) : user.permissions && user.permissions.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {user.permissions.map((permission) => (
                    <Badge key={permission} variant="outline" className="text-xs">
                      {getPermissionText(permission)}
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20 px-2 py-1 rounded-md inline-block">
                  لا توجد صلاحيات
                </div>
              )}
            </div>
            
            {/* أزرار الإجراءات */}
            <div className="flex justify-end gap-2 mt-2 border-t dark:border-gray-700 pt-3">
              {/* زر التعديل تم إخفاؤه من نافذة المدير (admin) والإبقاء عليه للآخرين */}
              {user.role !== 'admin' && (
                <button 
                  className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 rounded-lg text-xs font-medium flex items-center shadow-sm transition-all duration-150 hover:shadow"
                  onClick={() => handleEditClick(user)}
                >
                  <UserIcon className="h-3.5 w-3.5 ml-1.5" />
                  تعديل
                </button>
              )}
              {currentUserId !== user.id && (
                <button 
                  className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50 rounded-lg text-xs font-medium flex items-center shadow-sm transition-all duration-150 hover:shadow"
                  onClick={() => handleDeleteClick(user)}
                >
                  <TrashIcon className="h-3.5 w-3.5 ml-1.5" />
                  حذف
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg text-red-600 dark:text-red-400 flex items-center">
              <TrashIcon className="h-5 w-5 ml-2 text-red-500 dark:text-red-400" />
              تأكيد الحذف
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600 dark:text-gray-300 text-sm mt-1">
              هل أنت متأكد من رغبتك في حذف هذا المستخدم؟ هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="text-sm py-1.5 px-3">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-800 text-sm py-1.5 px-3"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              ) : null}
              تأكيد الحذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              <div className="flex items-center">
                <UserIcon className="h-5 w-5 ml-2 text-blue-600 dark:text-blue-400" />
                تعديل المستخدم
              </div>
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400 text-sm mt-1">
              قم بتعديل بيانات المستخدم ثم اضغط على حفظ لإكمال العملية.
            </DialogDescription>
          </DialogHeader>
          
          {userToEdit && (
            <UserEditForm 
              user={userToEdit} 
              onSubmit={handleUserUpdate} 
              isLoading={updateMutation.isPending} 
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
