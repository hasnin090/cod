import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  EyeIcon, 
  EyeOffIcon, 
  FolderIcon,
  InfoIcon, 
  KeyIcon, 
  Loader2, 
  LockIcon, 
  SaveIcon, 
  ShieldIcon, 
  UserIcon, 
  UsersIcon 
} from 'lucide-react';
import { useState } from 'react';

interface UserFormProps {
  onSubmit: () => void;
}

const userSchema = z.object({
  username: z.string().min(3, "اسم المستخدم يجب أن يحتوي على الأقل 3 أحرف"),
  name: z.string().min(3, "الاسم يجب أن يحتوي على الأقل 3 أحرف"),
  password: z.string().min(6, "كلمة المرور يجب أن تحتوي على الأقل 6 أحرف"),
  role: z.enum(["admin", "user", "viewer"], {
    required_error: "الصلاحية مطلوبة",
  }),
  permissions: z.array(z.string()).optional(),
  projectId: z.number().optional(),
});

type UserFormValues = z.infer<typeof userSchema>;

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
    icon: <FolderIcon className="h-4 w-4" />,
    color: "purple", 
    permissions: [
      { id: "manage_projects", label: "إدارة المشاريع", description: "إنشاء وتعديل وحذف المشاريع" },
      { id: "view_projects", label: "عرض المشاريع", description: "عرض قائمة المشاريع" },
    ]
  },
  {
    title: "إدارة المعاملات المالية",
    icon: <KeyIcon className="h-4 w-4" />,
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

interface Project {
  id: number;
  name: string;
  description: string;
  startDate: string;
  status: string;
  progress: number;
}

export function UserForm({ onSubmit }: UserFormProps) {
  const { toast } = useToast();
  const [showPermissions, setShowPermissions] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // استعلام لجلب قائمة المشاريع
  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
    retry: false
  });
  
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      username: "",
      name: "",
      password: "",
      role: "user",
      permissions: [],
      projectId: undefined,
    },
  });
  
  const mutation = useMutation({
    mutationFn: (data: UserFormValues) => {
      return apiRequest('/api/users', 'POST', data);
    },
    onSuccess: () => {
      toast({
        title: "تمت العملية بنجاح",
        description: "تم حفظ المستخدم بنجاح",
      });
      form.reset({
        username: "",
        name: "",
        password: "",
        role: "user",
        permissions: [],
        projectId: undefined,
      });
      setShowPermissions(false);
      onSubmit();
    },
    onError: (error) => {
      toast({
        title: "حدث خطأ",
        description: "فشل في حفظ المستخدم",
        variant: "destructive",
      });
      console.error('Failed to save user:', error);
    },
  });

  const onFormSubmit = (data: UserFormValues) => {
    mutation.mutate(data);
  };

  const handleRoleChange = (value: string) => {
    form.setValue("role", value as "admin" | "user" | "viewer");
    
    if (value === "admin") {
      setShowPermissions(false);
      form.setValue("permissions", []);
      form.setValue("projectId", undefined);
    } else if (value === "viewer") {
      setShowPermissions(true);
      form.setValue("permissions", ["view_dashboard", "view_projects", "view_transactions", "view_documents"]);
      form.setValue("projectId", undefined);
    } else if (value === "user") {
      setShowPermissions(true);
      form.setValue("permissions", ["view_dashboard", "view_projects", "manage_project_transactions", "view_project_transactions", "manage_transactions", "view_transactions", "manage_documents", "view_documents"]);
    }
  };

  const generatePassword = () => {
    const length = 12;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    form.setValue("password", password);
    setShowPassword(true);
  };
  
  return (
    <Card className="border border-blue-100 dark:border-blue-900 shadow-md transition-all duration-300 hover:shadow-lg">
      <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 pb-2 sm:pb-4">
        <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-lg sm:text-xl font-bold text-white">
          <UserIcon className="h-5 w-5 sm:h-6 sm:w-6" />
          إضافة مستخدم جديد
        </CardTitle>
      </CardHeader>
      
      <CardContent className="pt-4 sm:pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-2 sm:space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center text-base font-medium dark:text-gray-100">
                        اسم المستخدم
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <InfoIcon className="h-3.5 w-3.5 mr-1 text-blue-400 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-blue-50 dark:bg-blue-900 text-blue-900 dark:text-blue-100 border-blue-200 dark:border-blue-700">
                              <p>أدخل اسم المستخدم للدخول إلى النظام (بدون مسافات)</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            placeholder="أدخل اسم المستخدم"
                            className="w-full rounded-lg bg-white dark:bg-gray-900 border border-blue-100 dark:border-blue-800 focus:border-blue-300 dark:focus:border-blue-700 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 pr-10"
                            disabled={mutation.isPending}
                          />
                          <UserIcon className="absolute top-2.5 right-3 h-5 w-5 text-slate-400" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-medium dark:text-gray-100">الاسم الكامل</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="أدخل الاسم الكامل"
                        className="w-full rounded-lg bg-white dark:bg-gray-900 border border-blue-100 dark:border-blue-800 focus:border-blue-300 dark:focus:border-blue-700 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900"
                        disabled={mutation.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center text-base font-medium dark:text-gray-100">
                    كلمة المرور
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <InfoIcon className="h-3.5 w-3.5 mr-1 text-blue-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-blue-50 dark:bg-blue-900 text-blue-900 dark:text-blue-100 border-blue-200 dark:border-blue-700">
                          <p>يجب أن تكون كلمة المرور 6 أحرف على الأقل</p>
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
                          placeholder="أدخل كلمة المرور"
                          className="w-full rounded-lg bg-white dark:bg-gray-900 border border-blue-100 dark:border-blue-800 focus:border-blue-300 dark:focus:border-blue-700 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 pr-10"
                          disabled={mutation.isPending}
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
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-10 border-blue-100 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900 hover:text-blue-700 dark:hover:text-blue-300 dark:text-gray-200"
                      onClick={generatePassword}
                      disabled={mutation.isPending}
                    >
                      توليد
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-medium dark:text-gray-100">الصلاحية</FormLabel>
                    <Select 
                      onValueChange={handleRoleChange} 
                      value={field.value} 
                      disabled={mutation.isPending}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full rounded-lg bg-white dark:bg-gray-900 border border-blue-100 dark:border-blue-800 focus:border-blue-300 dark:focus:border-blue-700 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900">
                          <SelectValue placeholder="اختر الصلاحية" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admin">مدير النظام</SelectItem>
                        <SelectItem value="user">مستخدم عادي</SelectItem>
                        <SelectItem value="viewer">مشاهد فقط</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {showPermissions && form.watch("role") === "user" && (
                <FormField
                  control={form.control}
                  name="projectId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center text-base font-medium dark:text-gray-100">
                        المشروع المخصص
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <InfoIcon className="h-3.5 w-3.5 mr-1 text-blue-400 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-blue-50 dark:bg-blue-900 text-blue-900 dark:text-blue-100 border-blue-200 dark:border-blue-700">
                              <p>اختر المشروع الذي سيعمل عليه المستخدم (اختياري)</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)} 
                        value={field.value?.toString() || ""} 
                        disabled={mutation.isPending || projectsLoading}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full rounded-lg bg-white dark:bg-gray-900 border border-blue-100 dark:border-blue-800 focus:border-blue-300 dark:focus:border-blue-700 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900">
                            <SelectValue placeholder="اختر المشروع (اختياري)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">بدون مشروع محدد</SelectItem>
                          {projects.map((project) => (
                            <SelectItem key={project.id} value={project.id.toString()}>
                              <div className="flex items-center">
                                <FolderIcon className="h-4 w-4 ml-2 text-blue-500" />
                                {project.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {showPermissions && (
              <div className="border border-blue-100 dark:border-blue-800 rounded-lg p-4 bg-blue-50/30 dark:bg-blue-900/20">
                <FormField
                  control={form.control}
                  name="permissions"
                  render={() => (
                    <FormItem>
                      <div className="mb-4">
                        <FormLabel className="text-base font-medium dark:text-gray-100 flex items-center">
                          <ShieldIcon className="h-4 w-4 ml-2 text-blue-500" />
                          الصلاحيات الإضافية
                        </FormLabel>
                        <FormDescription className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          اختر الصلاحيات المناسبة للمستخدم
                        </FormDescription>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {permissionCategories.flatMap(category => 
                          category.permissions.map(permission => ({
                            id: permission.id,
                            label: permission.label,
                            icon: category.icon
                          }))
                        ).map((item) => (
                          <FormField
                            key={item.id}
                            control={form.control}
                            name="permissions"
                            render={({ field }) => {
                              return (
                                <FormItem
                                  key={item.id}
                                  className="flex flex-row items-start space-x-space-x-reverse space-x-3 space-y-0 p-3 border border-blue-100 dark:border-blue-700 rounded-lg bg-white dark:bg-gray-900 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                                >
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(item.id)}
                                      onCheckedChange={(checked) => {
                                        const updatedValue = checked
                                          ? [...(field.value || []), item.id]
                                          : field.value?.filter((value) => value !== item.id) || [];
                                        field.onChange(updatedValue);
                                      }}
                                      disabled={mutation.isPending}
                                      className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500 dark:data-[state=checked]:bg-blue-600 dark:data-[state=checked]:border-blue-600"
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel className="text-sm font-medium cursor-pointer flex items-center dark:text-gray-100">
                                      {item.icon}
                                      {item.label}
                                    </FormLabel>
                                  </div>
                                </FormItem>
                              );
                            }}
                          />
                        ))}
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-blue-100 dark:border-blue-800">
              <Button 
                type="submit" 
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 dark:from-blue-600 dark:to-blue-700 dark:hover:from-blue-700 dark:hover:to-blue-800 text-white font-medium px-6 py-2 rounded-lg shadow-md transition-all duration-300 hover:shadow-lg transform hover:-translate-y-0.5 flex items-center gap-2"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  <>
                    <SaveIcon className="h-4 w-4" />
                    إضافة المستخدم
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}