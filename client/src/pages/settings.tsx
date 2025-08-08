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
  projectId?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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
      <div className="container mx-auto px-4 py-8 max-w-2xl">
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
      projectId: expenseType.projectId || undefined,
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
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Modern Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="relative">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <SettingsIcon className="h-7 w-7 text-white" />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
              الإعدادات العامة
            </h1>
            <p className="text-muted-foreground mt-1">إدارة شاملة لإعدادات النظام والشركة</p>
          </div>
        </div>
        
        {/* Quick Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800/50">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">معلومات الشركة</span>
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">4 إعدادات أساسية</p>
          </div>
          
          <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800/50">
            <div className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-700 dark:text-green-300">أنواع المصاريف</span>
            </div>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">{expenseTypes?.length || 0} نوع مصروف</p>
          </div>
          
          <div className="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800/50">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              <span className="text-sm font-medium text-orange-700 dark:text-orange-300">الأمان</span>
            </div>
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">كلمة المرور</p>
          </div>
          
          <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800/50">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <span className="text-sm font-medium text-purple-700 dark:text-purple-300">المستخدمين</span>
            </div>
            <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">إدارة الصلاحيات</p>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-20">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">جاري تحميل البيانات...</p>
        </div>
      )}

      <div className="space-y-6">
        {/* 1. Company Information Section */}
        <Collapsible open={isGeneralOpen} onOpenChange={setIsGeneralOpen} defaultOpen>
          <Card className="shadow-lg border-0 bg-gradient-to-r from-background to-blue-50/30 dark:from-background dark:to-blue-950/20">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition-all duration-200 rounded-t-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                      <Building2 className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-foreground">معلومات الشركة</CardTitle>
                      <CardDescription className="text-muted-foreground">البيانات الأساسية ومعلومات التواصل</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                      4 إعدادات
                    </div>
                    {isGeneralOpen ? (
                      <ChevronDown className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <CardContent className="pt-0 pb-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground dark:text-foreground flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
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
                  
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground dark:text-foreground flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400" />
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
                  
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground dark:text-foreground flex items-center gap-2">
                      <Phone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
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
                  
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground dark:text-foreground flex items-center gap-2">
                      <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
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
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* 2. Security Settings Section */}
        <Collapsible open={isSecurityOpen} onOpenChange={setIsSecurityOpen}>
          <Card className="shadow-lg border-0 bg-gradient-to-r from-background to-orange-50/30 dark:from-background dark:to-orange-950/20">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-orange-50/50 dark:hover:bg-orange-950/30 transition-all duration-200 rounded-t-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-md">
                      <Shield className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-foreground">الأمان وكلمة المرور</CardTitle>
                      <CardDescription className="text-muted-foreground">حماية الحساب وإدارة كلمات المرور</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="px-3 py-1 bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 rounded-full text-xs font-medium">
                      محمي
                    </div>
                    {isSecurityOpen ? (
                      <ChevronDown className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    )}
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <CardContent className="pt-6">
                <div className="bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/50 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Shield className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    <h3 className="text-lg font-semibold text-orange-800 dark:text-orange-200">تغيير كلمة المرور</h3>
                  </div>
                  
                  <Form {...passwordForm}>
                    <form onSubmit={passwordForm.handleSubmit(onPasswordChangeSubmit)} className="space-y-5">
                      <FormField
                        control={passwordForm.control}
                        name="currentPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-foreground">كلمة المرور الحالية</FormLabel>
                            <FormControl>
                              <Input 
                                type="password" 
                                {...field} 
                                className="bg-background border-border focus:border-orange-400 focus:ring-orange-200"
                                placeholder="أدخل كلمة المرور الحالية"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="grid md:grid-cols-2 gap-4">
                        <FormField
                          control={passwordForm.control}
                          name="newPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-semibold text-foreground">كلمة المرور الجديدة</FormLabel>
                              <FormControl>
                                <Input 
                                  type="password" 
                                  {...field} 
                                  className="bg-background border-border focus:border-orange-400 focus:ring-orange-200"
                                  placeholder="كلمة مرور قوية"
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
                              <FormLabel className="text-sm font-semibold text-foreground">تأكيد كلمة المرور</FormLabel>
                              <FormControl>
                                <Input 
                                  type="password" 
                                  {...field} 
                                  className="bg-background border-border focus:border-orange-400 focus:ring-orange-200"
                                  placeholder="إعادة كتابة كلمة المرور"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between pt-4 border-t border-orange-200">
                        <div className="text-xs text-gray-500">
                          يُنصح باستخدام كلمة مرور قوية تحتوي على أرقام وحروف ورموز
                        </div>
                        <Button 
                          type="submit" 
                          disabled={changePasswordMutation.isPending}
                          className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-md"
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
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* 3. Expense Types Section */}
        <Collapsible open={isExpenseTypesOpen} onOpenChange={setIsExpenseTypesOpen}>
          <Card className="shadow-lg border-0 bg-gradient-to-r from-background to-green-50/30 dark:from-background dark:to-green-950/20">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-green-50/50 dark:hover:bg-green-950/30 transition-all duration-200 rounded-t-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-md">
                      <Tag className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-foreground">أنواع المصاريف</CardTitle>
                      <CardDescription className="text-muted-foreground">تصنيفات ذكية للمعاملات المالية</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="px-3 py-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">
                      {expenseTypes?.length || 0} نوع
                    </div>
                    {isExpenseTypesOpen ? (
                      <ChevronDown className="h-5 w-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-green-600 dark:text-green-400" />
                    )}
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <CardContent className="pt-0 pb-6">
                {/* Quick Stats */}
                <div className="bg-green-50/50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/50 rounded-lg p-4 mb-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="space-y-1">
                      <div className="text-2xl font-bold text-green-700 dark:text-green-300">{expenseTypes?.length || 0}</div>
                      <div className="text-xs text-green-600 dark:text-green-400">إجمالي الأنواع</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                        {expenseTypes?.filter(et => et.isActive).length || 0}
                      </div>
                      <div className="text-xs text-green-600 dark:text-green-400">الأنواع النشطة</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                        {expenseTypes?.filter(et => !et.isActive).length || 0}
                      </div>
                      <div className="text-xs text-green-600 dark:text-green-400">الأنواع المعطلة</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                        {Math.round(((expenseTypes?.filter(et => et.isActive).length || 0) / Math.max(expenseTypes?.length || 1, 1)) * 100)}%
                      </div>
                      <div className="text-xs text-green-600 dark:text-green-400">معدل النشاط</div>
                    </div>
                  </div>
                </div>

                {/* Header Section */}
                <div className="flex justify-between items-center mb-6">
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-gray-800">إدارة أنواع المصاريف</h3>
                    <p className="text-sm text-gray-600">تصنيف وتنظيم المعاملات المالية حسب النوع</p>
                  </div>
                  <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        onClick={() => {
                          setEditingExpenseType(null);
                          expenseTypeForm.reset({ name: '', description: '', projectId: undefined });
                        }}
                        className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-md"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        إضافة نوع جديد
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>
                          {editingExpenseType ? 'تعديل نوع المصروف' : 'إضافة نوع مصروف جديد'}
                        </DialogTitle>
                        <DialogDescription>
                          {editingExpenseType 
                            ? 'قم بتعديل بيانات نوع المصروف' 
                            : 'أدخل بيانات نوع المصروف الجديد'
                          }
                        </DialogDescription>
                      </DialogHeader>
                      
                      <Form {...expenseTypeForm}>
                        <form onSubmit={expenseTypeForm.handleSubmit(onExpenseTypeSubmit)} className="space-y-4">
                          <FormField
                            control={expenseTypeForm.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>اسم نوع المصروف</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="مثال: وقود، صيانة، مكتبية" />
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
                                <FormLabel>الوصف (اختياري)</FormLabel>
                                <FormControl>
                                  <Textarea {...field} placeholder="وصف مختصر لنوع المصروف" />
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
                                <FormLabel>المشروع المرتبط</FormLabel>
                                <Select 
                                  onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}
                                  value={field.value?.toString() || ""}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="اختر مشروع (اختياري - سيكون عام إذا لم تختر)" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="">عام (جميع المشاريع)</SelectItem>
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
                              type="submit" 
                              disabled={createExpenseTypeMutation.isPending || updateExpenseTypeMutation.isPending}
                            >
                              {(createExpenseTypeMutation.isPending || updateExpenseTypeMutation.isPending) && (
                                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                              )}
                              {editingExpenseType ? 'تحديث' : 'إضافة'}
                            </Button>
                          </DialogFooter>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>
                
                {/* Simple Table */}
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">اسم نوع المصروف</TableHead>
                        <TableHead className="text-center">المشروع المرتبط</TableHead>
                        <TableHead className="text-center">الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenseTypes.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                            لا توجد أنواع مصاريف. أضف نوع مصروف جديد للبدء.
                          </TableCell>
                        </TableRow>
                      ) : (
                        expenseTypes.map((expenseType) => (
                          <TableRow key={expenseType.id}>
                            <TableCell className="font-medium">{expenseType.name}</TableCell>
                            <TableCell className="text-center">
                              {expenseType.projectId ? (
                                <Badge variant="outline" className="text-xs">
                                  {projects.find(p => p.id === expenseType.projectId)?.name || `مشروع ${expenseType.projectId}`}
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">
                                  عام (جميع المشاريع)
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditExpenseType(expenseType)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteExpenseTypeMutation.mutate(expenseType.id)}
                                  disabled={deleteExpenseTypeMutation.isPending}
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
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
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>


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