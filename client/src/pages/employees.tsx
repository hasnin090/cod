import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Trash2, Edit2, UserPlus, Users, DollarSign, Wallet, RefreshCw } from 'lucide-react';

interface Employee {
  id: number;
  name: string;
  salary: number;
  currentBalance?: number;
  totalPaid?: number;
  lastSalaryReset?: string;
  assignedProjectId?: number;
  assignedProject?: {
    id: number;
    name: string;
  };
  active: boolean;
  notes?: string;
  hireDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface Project {
  id: number;
  name: string;
  description?: string;
}

const employeeFormSchema = z.object({
  name: z.string().min(2, "اسم الموظف مطلوب"),
  salary: z.coerce.number().min(0, "الراتب يجب أن يكون أكبر من أو يساوي صفر"),
  assignedProjectId: z.coerce.number().optional(),
  notes: z.string().optional(),
});

const editEmployeeFormSchema = z.object({
  name: z.string().min(2, "اسم الموظف مطلوب"),
  salary: z.coerce.number().min(0, "الراتب يجب أن يكون أكبر من أو يساوي صفر"),
  active: z.boolean(),
  assignedProjectId: z.coerce.number().optional(),
  notes: z.string().optional(),
});

const salaryPaymentSchema = z.object({
  amount: z.coerce.number().min(1, "مبلغ الراتب يجب أن يكون أكبر من صفر"),
  description: z.string().optional(),
});

type EmployeeFormData = z.infer<typeof employeeFormSchema>;
type EditEmployeeFormData = z.infer<typeof editEmployeeFormSchema>;
type SalaryPaymentData = z.infer<typeof salaryPaymentSchema>;

export default function Employees() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSalaryPaymentDialogOpen, setIsSalaryPaymentDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const { toast } = useToast();

  // جلب الموظفين
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['/api/employees'],
    queryFn: () => apiRequest<Employee[]>('/api/employees', 'GET'),
  });

  // جلب المشاريع
  const { data: projects = [] } = useQuery({
    queryKey: ['/api/projects'],
    queryFn: () => apiRequest<Project[]>('/api/projects', 'GET'),
  });

  // إنشاء موظف جديد
  const createForm = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      name: '',
      salary: 0,
      assignedProjectId: undefined,
      notes: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: EmployeeFormData) => apiRequest('/api/employees', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      toast({
        title: "تم إنشاء الموظف بنجاح",
        description: "تم إضافة الموظف الجديد إلى النظام",
      });
    },
    onError: () => {
      toast({
        title: "خطأ في إنشاء الموظف",
        description: "حدث خطأ أثناء إضافة الموظف",
        variant: "destructive",
      });
    },
  });

  // تعديل موظف
  const editForm = useForm<EditEmployeeFormData>({
    resolver: zodResolver(editEmployeeFormSchema),
    defaultValues: {
      name: '',
      salary: 0,
      active: true,
      assignedProjectId: undefined,
      notes: '',
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: EditEmployeeFormData }) =>
      apiRequest(`/api/employees/${id}`, 'PUT', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      setIsEditDialogOpen(false);
      setSelectedEmployee(null);
      editForm.reset();
      toast({
        title: "تم تحديث الموظف بنجاح",
        description: "تم حفظ التغييرات",
      });
    },
    onError: () => {
      toast({
        title: "خطأ في تحديث الموظف",
        description: "حدث خطأ أثناء التحديث",
        variant: "destructive",
      });
    },
  });

  // حذف موظف
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/employees/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      setIsDeleteDialogOpen(false);
      setSelectedEmployee(null);
      toast({
        title: "تم حذف الموظف بنجاح",
        description: "تم إزالة الموظف من النظام",
      });
    },
    onError: () => {
      toast({
        title: "خطأ في حذف الموظف",
        description: "حدث خطأ أثناء الحذف",
        variant: "destructive",
      });
    },
  });

  // دفع راتب للموظف
  const salaryForm = useForm<SalaryPaymentData>({
    resolver: zodResolver(salaryPaymentSchema),
    defaultValues: {
      amount: 0,
      description: '',
    },
  });

  const paySalaryMutation = useMutation({
    mutationFn: ({ employeeId, data }: { employeeId: number; data: SalaryPaymentData }) => 
      apiRequest(`/api/employees/${employeeId}/pay-salary`, 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      setIsSalaryPaymentDialogOpen(false);
      setSelectedEmployee(null);
      salaryForm.reset();
      toast({ title: 'تم دفع الراتب بنجاح' });
    },
    onError: (error: any) => {
      toast({ 
        variant: 'destructive',
        title: 'خطأ في دفع الراتب',
        description: error.message || 'حدث خطأ غير متوقع'
      });
    }
  });

  // إعادة تعيين جميع الرواتب
  const resetSalariesMutation = useMutation({
    mutationFn: () => apiRequest('/api/employees/reset-salaries', 'POST'),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      toast({ 
        title: 'تم إعادة تعيين الرواتب بنجاح',
        description: `تم إعادة تعيين رواتب ${data.count} موظف`
      });
    },
    onError: (error: any) => {
      toast({ 
        variant: 'destructive',
        title: 'خطأ في إعادة تعيين الرواتب',
        description: error.message || 'حدث خطأ غير متوقع'
      });
    }
  });

  const handleEdit = (employee: Employee) => {
    setSelectedEmployee(employee);
    editForm.reset({
      name: employee.name,
      salary: employee.salary,
      active: employee.active,
      assignedProjectId: employee.assignedProjectId,
      notes: employee.notes || '',
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsDeleteDialogOpen(true);
  };

  const handlePaySalary = (employee: Employee) => {
    setSelectedEmployee(employee);
    salaryForm.reset({
      amount: 0,
      description: `دفع راتب للموظف: ${employee.name}`,
    });
    setIsSalaryPaymentDialogOpen(true);
  };

  const onCreateSubmit = (data: EmployeeFormData) => {
    createMutation.mutate(data);
  };

  const onEditSubmit = (data: EditEmployeeFormData) => {
    if (!selectedEmployee) return;
    editMutation.mutate({ id: selectedEmployee.id, data });
  };

  const onSalaryPaymentSubmit = (data: SalaryPaymentData) => {
    if (!selectedEmployee) return;
    paySalaryMutation.mutate({ employeeId: selectedEmployee.id, data });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ar-IQ', {
      style: 'currency',
      currency: 'IQD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-32">
          <div className="text-muted-foreground">جاري تحميل الموظفين...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4 rtl:space-x-reverse">
          <Users className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">إدارة الموظفين</h1>
            <p className="text-sm sm:text-base text-muted-foreground">إدارة رواتب الموظفين ومعلوماتهم الأساسية</p>
          </div>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="flex items-center gap-2 w-full sm:w-auto">
          <UserPlus className="h-4 w-4" />
          <span className="sm:inline">إضافة موظف جديد</span>
        </Button>
      </div>

      {/* إحصائيات سريعة */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الموظفين</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employees.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">الموظفين النشطين</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employees.filter(emp => emp.active).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الرواتب الشهرية</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(employees.reduce((sum, emp) => sum + emp.salary, 0))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* قائمة الموظفين */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>قائمة الموظفين</CardTitle>
            <Button 
              onClick={() => resetSalariesMutation.mutate()}
              disabled={resetSalariesMutation.isPending}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${resetSalariesMutation.isPending ? 'animate-spin' : ''}`} />
              إعادة تعيين جميع الرواتب
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {employees.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">لا توجد موظفين مسجلين حتى الآن</p>
              <Button onClick={() => setIsCreateDialogOpen(true)} className="mt-4">
                إضافة أول موظف
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {employees.map((employee) => (
                <div
                  key={employee.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg hover:bg-muted/50 gap-4 transition-all duration-300 hover:shadow-md hover:scale-[1.02] animate-in slide-in-from-bottom-2 fade-in-50"
                >
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <h3 className="font-semibold text-lg">{employee.name}</h3>
                      {employee.active ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-800 w-fit">
                          نشط
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-red-100 text-red-800 w-fit">
                          غير نشط
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mt-2 space-y-1">
                      <div className="font-medium text-base">الراتب الأساسي: {formatCurrency(employee.salary)}</div>
                      {typeof employee.totalPaid === 'number' && (
                        <div className="text-orange-600">المدفوع هذا الشهر: {formatCurrency(employee.totalPaid)}</div>
                      )}
                      {typeof employee.currentBalance === 'number' && (
                        <div className={`font-medium ${employee.currentBalance > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          الرصيد المتبقي: {formatCurrency(employee.currentBalance)}
                        </div>
                      )}
                      {employee.assignedProject && (
                        <div>المشروع: {employee.assignedProject.name}</div>
                      )}
                      {employee.notes && (
                        <div className="text-xs">{employee.notes}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 rtl:space-x-reverse sm:flex-col sm:space-x-0 sm:space-y-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handlePaySalary(employee)}
                      disabled={!employee.active}
                      className="flex-1 sm:flex-none sm:w-full bg-green-600 hover:bg-green-700"
                    >
                      <Wallet className="h-4 w-4 sm:ml-2" />
                      <span className="hidden sm:inline">دفع راتب</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(employee)}
                      className="flex-1 sm:flex-none sm:w-full"
                    >
                      <Edit2 className="h-4 w-4 sm:ml-2" />
                      <span className="hidden sm:inline">تعديل</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(employee)}
                      className="text-red-600 hover:text-red-700 flex-1 sm:flex-none sm:w-full"
                    >
                      <Trash2 className="h-4 w-4 sm:ml-2" />
                      <span className="hidden sm:inline">حذف</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* حوار إضافة موظف جديد */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto mx-4">
          <DialogHeader>
            <DialogTitle>إضافة موظف جديد</DialogTitle>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4 px-1">
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>اسم الموظف</FormLabel>
                    <FormControl>
                      <Input placeholder="أدخل اسم الموظف" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="salary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الراتب الشهري (دينار عراقي)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="assignedProjectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>المشروع المكلف به (اختياري)</FormLabel>
                    <Select onValueChange={(value) => field.onChange(value === "none" ? undefined : parseInt(value))} value={field.value?.toString() || "none"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر مشروع" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">بدون مشروع</SelectItem>
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

              <FormField
                control={createForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ملاحظات (اختياري)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="أضف ملاحظات حول الموظف"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  إلغاء
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "جاري الإنشاء..." : "إنشاء الموظف"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* حوار تعديل موظف */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto mx-4">
          <DialogHeader>
            <DialogTitle>تعديل بيانات الموظف</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 px-1">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>اسم الموظف</FormLabel>
                    <FormControl>
                      <Input placeholder="أدخل اسم الموظف" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="salary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الراتب الشهري (دينار عراقي)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>حالة الموظف</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        هل الموظف نشط في العمل؟
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="assignedProjectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>المشروع المكلف به (اختياري)</FormLabel>
                    <Select onValueChange={(value) => field.onChange(value === "none" ? undefined : parseInt(value))} value={field.value?.toString() || "none"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر مشروع" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">بدون مشروع</SelectItem>
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

              <FormField
                control={editForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ملاحظات (اختياري)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="أضف ملاحظات حول الموظف"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  إلغاء
                </Button>
                <Button type="submit" disabled={editMutation.isPending}>
                  {editMutation.isPending ? "جاري التحديث..." : "حفظ التغييرات"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* حوار تأكيد الحذف */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف الموظف "{selectedEmployee?.name}"؟
              هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedEmployee && deleteMutation.mutate(selectedEmployee.id)}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "جاري الحذف..." : "حذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* حوار دفع الراتب */}
      {selectedEmployee && (
        <Dialog open={isSalaryPaymentDialogOpen} onOpenChange={setIsSalaryPaymentDialogOpen}>
          <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto mx-4">
            <DialogHeader>
              <DialogTitle>دفع راتب - {selectedEmployee.name}</DialogTitle>
            </DialogHeader>
            <div className="mb-4 p-3 bg-muted rounded-lg">
              <div className="text-sm space-y-1">
                <div>الراتب الأساسي: {formatCurrency(selectedEmployee.salary)}</div>
                <div>الرصيد المتبقي: {formatCurrency(selectedEmployee.currentBalance || 0)}</div>
                <div>المدفوع هذا الشهر: {formatCurrency(selectedEmployee.totalPaid || 0)}</div>
              </div>
            </div>
            <Form {...salaryForm}>
              <form onSubmit={salaryForm.handleSubmit(onSalaryPaymentSubmit)} className="space-y-4 px-1">
                <FormField
                  control={salaryForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>مبلغ الدفعة (دينار عراقي)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="أدخل مبلغ الدفعة"
                          max={selectedEmployee.currentBalance || 0}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                      <div className="text-xs text-muted-foreground">
                        الحد الأقصى: {formatCurrency(selectedEmployee.currentBalance || 0)}
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={salaryForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>وصف الدفعة (اختياري)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="ملاحظات حول الدفعة..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter className="gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsSalaryPaymentDialogOpen(false)}
                  >
                    إلغاء
                  </Button>
                  <Button
                    type="submit"
                    disabled={paySalaryMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {paySalaryMutation.isPending ? 'جاري الدفع...' : 'دفع الراتب'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}