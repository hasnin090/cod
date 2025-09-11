import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2, Shield, Settings as SettingsIcon, Tag, Plus, Edit, Trash2, ChevronDown, ChevronRight, Building2, Users, MapPin, Phone, Mail } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Schema definitions
const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'كلمة المرور الحالية مطلوبة'),
  newPassword: z.string().min(8, 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل'),
  confirmPassword: z.string().min(1, 'تأكيد كلمة المرور مطلوب'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "كلمة المرور الجديدة وتأكيدها غير متطابقين",
  path: ["confirmPassword"],
});

const expenseTypeSchema = z.object({
  name: z.string().min(1, 'اسم نوع المصروف مطلوب'),
  description: z.string().optional(),
  projectId: z.number().optional(),
});

// Type definitions
interface Setting {
  id: number;
  key: string;
  value: string;
  description?: string;
}

interface ExpenseType {
  id: number;
  name: string;
  description?: string;
  project_id?: number; // تطابق مع قاعدة البيانات
  is_active: boolean; // تطابق مع قاعدة البيانات
  created_at: string; // تطابق مع قاعدة البيانات
  updated_at: string; // تطابق مع قاعدة البيانات
}

interface Project {
  id: number;
  name: string;
  description?: string;
}

type PasswordChangeValues = z.infer<typeof passwordChangeSchema>;
type ExpenseTypeValues = z.infer<typeof expenseTypeSchema>;

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Collapsible states
  const [isGeneralOpen, setIsGeneralOpen] = useState(true);
  const [isExpenseTypesOpen, setIsExpenseTypesOpen] = useState(false);
  const [isSecurityOpen, setIsSecurityOpen] = useState(false);
  
  // Dialog states
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [editingExpenseType, setEditingExpenseType] = useState<ExpenseType | null>(null);

  // Check if user has admin permissions
  if (!user || user.role !== 'admin') {
    return (
  <div className="page-container mx-auto max-w-2xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>غير مصرح</AlertTitle>
          <AlertDescription>
            ليس لديك صلاحيات كافية للوصول إلى هذه الصفحة. يرجى التواصل مع مدير النظام.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Data queries
  const { data: settings = [], isLoading } = useQuery<Setting[]>({
    queryKey: ['/api/settings'],
    enabled: !!user && user.role === 'admin'
  });

  const { data: expenseTypes = [] } = useQuery<ExpenseType[]>({
    queryKey: ['/api/expense-types'],
    enabled: !!user && user.role === 'admin'
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
    enabled: !!user && user.role === 'admin'
  });

  // Forms
  const passwordForm = useForm<PasswordChangeValues>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const expenseTypeForm = useForm<ExpenseTypeValues>({
    resolver: zodResolver(expenseTypeSchema),
    defaultValues: {
      name: '',
      description: '',
      projectId: undefined,
    },
  });

  // API helper function
  const makeApiCall = async (url: string, options: RequestInit = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'حدث خطأ غير متوقع' }));
      throw new Error(error.message || 'حدث خطأ في العملية');
    }
    
    return response.json();
  };

  // Mutations
  const changePasswordMutation = useMutation({
    mutationFn: (data: PasswordChangeValues) =>
      makeApiCall('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast({
        title: "تم تغيير كلمة المرور",
        description: "تم تغيير كلمة المرور بنجاح",
      });
      passwordForm.reset();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: error.message,
      });
    },
  });

  const createExpenseTypeMutation = useMutation({
    mutationFn: (data: ExpenseTypeValues) =>
      makeApiCall('/api/expense-types', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      // إعادة تحديث جميع أنواع المصاريف
      queryClient.invalidateQueries({ queryKey: ['/api/expense-types'] });
      // إعادة تحديث الكاش في transaction form أيضاً
      queryClient.refetchQueries({ queryKey: ['/api/expense-types'] });
      toast({
        title: "تم إنشاء نوع المصروف",
        description: "تم إنشاء نوع المصروف بنجاح",
      });
      expenseTypeForm.reset();
      setIsExpenseDialogOpen(false);
      setEditingExpenseType(null);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: error.message,
      });
    },
  });

  const updateExpenseTypeMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ExpenseTypeValues }) =>
      makeApiCall(`/api/expense-types/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      // إعادة تحديث جميع أنواع المصاريف
      queryClient.invalidateQueries({ queryKey: ['/api/expense-types'] });
      queryClient.refetchQueries({ queryKey: ['/api/expense-types'] });
      toast({
        title: "تم تحديث نوع المصروف",
        description: "تم تحديث نوع المصروف بنجاح",
      });
      expenseTypeForm.reset();
      setIsExpenseDialogOpen(false);
      setEditingExpenseType(null);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: error.message,
      });
    },
  });

  const deleteExpenseTypeMutation = useMutation({
    mutationFn: (id: number) =>
      makeApiCall(`/api/expense-types/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      // إعادة تحديث جميع أنواع المصاريف
      queryClient.invalidateQueries({ queryKey: ['/api/expense-types'] });
      queryClient.refetchQueries({ queryKey: ['/api/expense-types'] });
      toast({
        title: "تم حذف نوع المصروف",
        description: "تم حذف نوع المصروف بنجاح",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: error.message,
      });
    },
  });

  // Event handlers
  function onPasswordChangeSubmit(values: PasswordChangeValues) {
    changePasswordMutation.mutate(values);
  }

  function onExpenseTypeSubmit(values: ExpenseTypeValues) {
    if (editingExpenseType) {
      updateExpenseTypeMutation.mutate({ id: editingExpenseType.id, data: values });
    } else {
      createExpenseTypeMutation.mutate(values);
    }
  }

  const handleEditExpenseType = (expenseType: ExpenseType) => {
    setEditingExpenseType(expenseType);
    expenseTypeForm.reset({
      name: expenseType.name,
      description: expenseType.description || '',
      projectId: expenseType.project_id || undefined,
    });
    setIsExpenseDialogOpen(true);
  };

  const handleSaveSetting = async (key: string, value: string) => {
    try {
      await makeApiCall('/api/settings', {
        method: 'POST',
        body: JSON.stringify({ key, value }),
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      
      toast({
        title: "تم حفظ الإعداد",
        description: "تم حفظ الإعداد بنجاح",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: error.message || "حدث خطأ أثناء حفظ الإعداد",
      });
    }
  };

  return (
  <div className="page-container mx-auto max-w-6xl">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="relative">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
              <SettingsIcon className="h-8 w-8 text-white" />
            </div>
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full"></div>
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              الإعدادات العامة
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2 text-lg">إدارة شاملة لإعدادات النظام والشركة</p>
          </div>
        </div>
        
        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/30 p-6 rounded-2xl border border-blue-200 dark:border-blue-800/50">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-blue-700 dark:text-blue-300">معلومات الشركة</h3>
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">البيانات الأساسية</p>
              </div>
              <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
                <Building2 className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="mt-4 text-2xl font-bold text-blue-700 dark:text-blue-300">4</div>
            <div className="text-xs text-blue-600 dark:text-blue-400">إعدادات أساسية</div>
          </div>
          
          <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/30 p-6 rounded-2xl border border-green-200 dark:border-green-800/50">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-green-700 dark:text-green-300">أنواع المصاريف</h3>
                <p className="text-sm text-green-600 dark:text-green-400 mt-1">تصنيفات المعاملات</p>
              </div>
              <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
                <Tag className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="mt-4 text-2xl font-bold text-green-700 dark:text-green-300">{expenseTypes?.length || 0}</div>
            <div className="text-xs text-green-600 dark:text-green-400">نوع مصروف</div>
          </div>
          
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/50 dark:to-orange-900/30 p-6 rounded-2xl border border-orange-200 dark:border-orange-800/50">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-orange-700 dark:text-orange-300">الأمان</h3>
                <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">حماية الحساب</p>
              </div>
              <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center">
                <Shield className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="mt-4 text-lg font-bold text-orange-700 dark:text-orange-300">محمي</div>
            <div className="text-xs text-orange-600 dark:text-orange-400">كلمة مرور قوية</div>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-20">
          <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-slate-600 dark:text-slate-400 text-lg">جاري تحميل الإعدادات...</p>
        </div>
      )}

      <div className="space-y-8">
        {/* 1. معلومات الشركة */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
            <div className="flex items-center gap-3">
              <Building2 className="h-6 w-6 text-white" />
              <h2 className="text-xl font-bold text-white">معلومات الشركة</h2>
            </div>
            <p className="text-blue-100 mt-1">البيانات الأساسية ومعلومات التواصل</p>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  اسم الشركة
                </label>
                <SettingField 
                  settings={settings}
                  settingKey="company_name"
                  label=""
                  onSave={handleSaveSetting}
                  isSaving={false}
                />
              </div>
              
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  <MapPin className="h-4 w-4 text-blue-600" />
                  عنوان الشركة
                </label>
                <SettingField 
                  settings={settings}
                  settingKey="company_address"
                  label=""
                  onSave={handleSaveSetting}
                  isSaving={false}
                />
              </div>
              
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  <Phone className="h-4 w-4 text-blue-600" />
                  هاتف الشركة
                </label>
                <SettingField 
                  settings={settings}
                  settingKey="company_phone"
                  label=""
                  type="tel"
                  onSave={handleSaveSetting}
                  isSaving={false}
                />
              </div>
              
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  <Mail className="h-4 w-4 text-blue-600" />
                  البريد الإلكتروني
                </label>
                <SettingField 
                  settings={settings}
                  settingKey="company_email"
                  label=""
                  type="email"
                  onSave={handleSaveSetting}
                  isSaving={false}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 2. أمان النظام */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4">
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-white" />
              <h2 className="text-xl font-bold text-white">أمان النظام</h2>
            </div>
            <p className="text-orange-100 mt-1">حماية الحساب وإدارة كلمات المرور</p>
          </div>
          
          <div className="p-6">
            <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/50 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-orange-800 dark:text-orange-200">تغيير كلمة المرور</h3>
                  <p className="text-sm text-orange-600 dark:text-orange-400">قم بتحديث كلمة المرور لحماية حسابك</p>
                </div>
              </div>
              
              <Form {...passwordForm}>
                <form onSubmit={passwordForm.handleSubmit(onPasswordChangeSubmit)} className="space-y-6">
                  <FormField
                    control={passwordForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">كلمة المرور الحالية</FormLabel>
                        <FormControl>
                          <Input 
                            type="password" 
                            {...field} 
                            className="h-12 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 focus:border-orange-400 focus:ring-orange-200"
                            placeholder="أدخل كلمة المرور الحالية"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    <FormField
                      control={passwordForm.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">كلمة المرور الجديدة</FormLabel>
                          <FormControl>
                            <Input 
                              type="password" 
                              {...field} 
                              className="h-12 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 focus:border-orange-400 focus:ring-orange-200"
                              placeholder="كلمة مرور قوية (8 أحرف على الأقل)"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={passwordForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold text-slate-700 dark:text-slate-300">تأكيد كلمة المرور</FormLabel>
                          <FormControl>
                            <Input 
                              type="password" 
                              {...field} 
                              className="h-12 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 focus:border-orange-400 focus:ring-orange-200"
                              placeholder="إعادة كتابة كلمة المرور الجديدة"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-orange-200 dark:border-orange-800/50">
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      💡 استخدم كلمة مرور قوية تحتوي على أرقام وحروف ورموز
                    </div>
                    <Button 
                      type="submit" 
                      disabled={changePasswordMutation.isPending}
                      className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg h-12 px-8"
                    >
                      {changePasswordMutation.isPending && (
                        <Loader2 className="h-4 w-4 animate-spin ml-2" />
                      )}
                      تحديث كلمة المرور
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </div>
        </div>

        {/* 3. إدارة أنواع المصاريف */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Tag className="h-6 w-6 text-white" />
                <div>
                  <h2 className="text-xl font-bold text-white">إدارة أنواع المصاريف</h2>
                  <p className="text-green-100 mt-1">تصنيفات ذكية للمعاملات المالية</p>
                </div>
              </div>
              <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    onClick={() => {
                      setEditingExpenseType(null);
                      expenseTypeForm.reset({ name: '', description: '', projectId: undefined });
                    }}
                    className="bg-white text-green-600 hover:bg-green-50 shadow-lg"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    إضافة نوع جديد
                  </Button>
                </DialogTrigger>
                <DialogContent size="lg">
                  <DialogHeader>
                    <DialogTitle className="text-xl">
                      {editingExpenseType ? 'تعديل نوع المصروف' : 'إضافة نوع مصروف جديد'}
                    </DialogTitle>
                    <DialogDescription>
                      {editingExpenseType 
                        ? 'قم بتعديل بيانات نوع المصروف المحدد' 
                        : 'أدخل بيانات نوع المصروف الجديد لتصنيف المعاملات'
                      }
                    </DialogDescription>
                  </DialogHeader>
                  
                  <Form {...expenseTypeForm}>
                    <form onSubmit={expenseTypeForm.handleSubmit(onExpenseTypeSubmit)} className="space-y-6">
                      <FormField
                        control={expenseTypeForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold">اسم نوع المصروف</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                placeholder="مثال: وقود، صيانة، مكتبية، مواد خام"
                                className="h-12"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={expenseTypeForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold">الوصف (اختياري)</FormLabel>
                            <FormControl>
                              <Textarea 
                                {...field} 
                                placeholder="وصف مختصر لنوع المصروف وكيفية استخدامه"
                                className="min-h-[80px]"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={expenseTypeForm.control}
                        name="projectId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold">المشروع المرتبط</FormLabel>
                            <Select 
                              onValueChange={(value) => field.onChange(value === "general" ? undefined : parseInt(value))}
                              value={field.value?.toString() || "general"}
                            >
                              <FormControl>
                                <SelectTrigger className="h-12">
                                  <SelectValue placeholder="اختر مشروع أو اتركه عام لجميع المشاريع" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="general">عام (جميع المشاريع)</SelectItem>
                                {projects.map((project) => (
                                  <SelectItem key={project.id} value={project.id.toString()}>
                                    {project.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <DialogFooter>
                        <Button 
                          type="button"
                          variant="outline"
                          onClick={() => setIsExpenseDialogOpen(false)}
                        >
                          إلغاء
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={createExpenseTypeMutation.isPending || updateExpenseTypeMutation.isPending}
                          className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                        >
                          {(createExpenseTypeMutation.isPending || updateExpenseTypeMutation.isPending) && (
                            <Loader2 className="h-4 w-4 animate-spin ml-2" />
                          )}
                          {editingExpenseType ? 'تحديث النوع' : 'إضافة النوع'}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          
          <div className="p-6">
            {/* إحصائيات سريعة */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-xl text-center">
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">{expenseTypes?.length || 0}</div>
                <div className="text-sm text-green-600 dark:text-green-400">إجمالي الأنواع</div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-xl text-center">
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {expenseTypes?.filter(et => et.is_active).length || 0}
                </div>
                <div className="text-sm text-blue-600 dark:text-blue-400">النشطة</div>
              </div>
              <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-xl text-center">
                <div className="text-2xl font-bold text-red-700 dark:text-red-300">
                  {expenseTypes?.filter(et => !et.is_active).length || 0}
                </div>
                <div className="text-sm text-red-600 dark:text-red-400">المعطلة</div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded-xl text-center">
                <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                  {Math.round(((expenseTypes?.filter(et => et.is_active).length || 0) / Math.max(expenseTypes?.length || 1, 1)) * 100)}%
                </div>
                <div className="text-sm text-purple-600 dark:text-purple-400">معدل النشاط</div>
              </div>
            </div>
            
            {/* جدول أنواع المصاريف */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-100 dark:bg-slate-800">
                    <TableHead className="text-right font-semibold">اسم نوع المصروف</TableHead>
                    <TableHead className="text-center font-semibold">المشروع المرتبط</TableHead>
                    <TableHead className="text-center font-semibold">الحالة</TableHead>
                    <TableHead className="text-center font-semibold">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenseTypes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-12">
                        <div className="flex flex-col items-center gap-3">
                          <Tag className="h-12 w-12 text-slate-400" />
                          <div>
                            <p className="text-slate-600 dark:text-slate-400 font-medium">لا توجد أنواع مصاريف</p>
                            <p className="text-sm text-slate-500 dark:text-slate-500">أضف نوع مصروف جديد للبدء في التصنيف</p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    expenseTypes.map((expenseType) => (
                      <TableRow key={expenseType.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <TableCell className="font-medium">{expenseType.name}</TableCell>
                        <TableCell className="text-center">
                          {expenseType.project_id ? (
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                              {projects.find(p => p.id === expenseType.project_id)?.name || `مشروع ${expenseType.project_id}`}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs bg-green-50 text-green-700 border-green-200">
                              عام (جميع المشاريع)
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            variant={expenseType.is_active ? "default" : "secondary"}
                            className={expenseType.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}
                          >
                            {expenseType.is_active ? 'نشط' : 'معطل'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditExpenseType(expenseType)}
                              className="h-9 w-9 p-0 hover:bg-blue-100 hover:text-blue-700"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteExpenseTypeMutation.mutate(expenseType.id)}
                              disabled={deleteExpenseTypeMutation.isPending}
                              className="h-9 w-9 p-0 hover:bg-red-100 hover:text-red-700"
                            >
                              {deleteExpenseTypeMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SettingFieldProps {
  settings: Setting[];
  settingKey: string;
  label: string;
  type?: string;
  onSave: (key: string, value: string) => void;
  isSaving: boolean;
}

function SettingField({ settings, settingKey, label, type = 'text', onSave, isSaving }: SettingFieldProps) {
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState(false);

  // Find the setting value from the array
  const currentSetting = settings.find(s => s.key === settingKey);
  const currentValue = currentSetting?.value || '';

  // Update local state when settings change
  useState(() => {
    setValue(currentValue);
  });

  const handleSave = async () => {
    if (value !== currentValue) {
      await onSave(settingKey, value);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <div className="flex gap-2">
        <Input
          type={type}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={`أدخل ${label.toLowerCase()}`}
          className="flex-1"
        />
        <Button
          onClick={handleSave}
          disabled={isSaving || value === currentValue}
          size="sm"
          variant={saved ? "default" : "outline"}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            'تم الحفظ'
          ) : (
            'حفظ'
          )}
        </Button>
      </div>
    </div>
  );
}