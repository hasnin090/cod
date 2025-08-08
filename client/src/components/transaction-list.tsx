import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { formatCurrency } from '@/lib/chart-utils';
import { formatDateTime } from '@/utils/date-utils';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarIcon, Trash2, Edit2, FileText, CheckSquare, Square, Paperclip, Eye, X } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface Transaction {
  id: number;
  date: string;
  amount: number;
  type: string;
  description: string;
  projectId?: number;
  fileUrl?: string;
  fileType?: string;
  expenseType?: string;
  createdBy?: number;
}

interface Project {
  id: number;
  name: string;
}

interface ExpenseType {
  id: number;
  name: string;
  description?: string;
  is_active?: boolean;
  isActive?: boolean;
}

interface TransactionListProps {
  transactions: Transaction[];
  projects: Project[];
  viewType: 'cards' | 'table';
  isLoading: boolean;
  onTransactionUpdated: () => void;
  isArchiveMode?: boolean;
  selectedTransactions?: number[];
  onToggleSelection?: (transactionId: number) => void;
}

const transactionFormSchema = z.object({
  date: z.date({
    required_error: "الرجاء اختيار تاريخ",
  }),
  type: z.string().min(1, "الرجاء اختيار نوع المعاملة"),
  expenseType: z.string().optional(),
  amount: z.coerce.number().positive("المبلغ يجب أن يكون أكبر من الصفر"),
  description: z.string().min(1, "الرجاء إدخال الوصف"),
  projectId: z.number().nullable().optional(),
});

type TransactionFormValues = z.infer<typeof transactionFormSchema>;

export function TransactionList({ 
  transactions, 
  projects, 
  viewType,
  isLoading,
  onTransactionUpdated,
  isArchiveMode = false,
  selectedTransactions = [],
  onToggleSelection 
}: TransactionListProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);
  const [attachmentDialogOpen, setAttachmentDialogOpen] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<{url: string; type: string} | null>(null);
  const [deleteAttachmentDialogOpen, setDeleteAttachmentDialogOpen] = useState(false);
  const [attachmentToDelete, setAttachmentToDelete] = useState<Transaction | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // التحقق من صلاحية تعديل المعاملات للمستخدم الحالي
  const { data: userTransactionPermission } = useQuery<any>({
    queryKey: [`/api/transaction-edit-permissions/check`],
    enabled: !!user && user.role !== 'admin', // المديرين لديهم صلاحية مسبقة
    refetchInterval: 30000, // إعادة فحص كل 30 ثانية للتأكد من الصلاحيات
  });

  // تحديد الصلاحية بناءً على الدور أو الصلاحية الممنوحة
  const hasTransactionEditPermission = user?.role === 'admin' || 
    userTransactionPermission?.hasPermission === true;
  
  console.log('Permission Debug:', {
    userRole: user?.role,
    isAdmin: user?.role === 'admin',
    permissionData: userTransactionPermission,
    hasPermission: hasTransactionEditPermission
  });

  // جلب أنواع المصاريف
  const { data: expenseTypes = [] } = useQuery<ExpenseType[]>({
    queryKey: ['/api/expense-types'],
    staleTime: 30 * 1000, // 30 seconds
  });

  // دالة للتحقق من إمكانية عرض المرفق
  const canViewAttachment = (transaction: Transaction): boolean => {
    if (!user) return false;
    // المدير يستطيع رؤية جميع المرفقات
    if (user.role === 'admin') return true;
    // المستخدم يستطيع رؤية مرفقاته فقط
    return transaction.createdBy === user.id;
  };
  
  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      date: new Date(),
      type: "income",
      expenseType: "مصروف عام",
      amount: 0,
      description: "",
      projectId: null,
    },
  });
  
  useEffect(() => {
    if (transactionToEdit) {
      const type = transactionToEdit.type || "income";
      
      form.reset({
        date: new Date(transactionToEdit.date),
        type: type,
        expenseType: transactionToEdit.expenseType || "مصروف عام",
        amount: transactionToEdit.amount,
        description: transactionToEdit.description || "",
        projectId: transactionToEdit.projectId || null,
      });
    }
  }, [transactionToEdit, form]);

  const deleteMutation = useMutation({
    mutationFn: (transactionId: number) => 
      apiRequest(`/api/transactions/${transactionId}`, 'DELETE'),
    onSuccess: () => {
      toast({
        title: "تم الحذف بنجاح",
        description: "تم حذف المعاملة المالية بنجاح.",
      });
      
      // تحديث فوري لجميع الcaches المرتبطة
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ledger'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      
      // إجبار إعادة تحميل البيانات فوراً
      queryClient.refetchQueries({ queryKey: ['/api/transactions'] });
      queryClient.refetchQueries({ queryKey: ['/api/dashboard'] });
      
      onTransactionUpdated();
      setDeleteDialogOpen(false);
      setTransactionToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في الحذف",
        description: "حدث خطأ أثناء محاولة حذف المعاملة المالية.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: number; transaction: TransactionFormValues }) => {
      const formattedData = {
        ...data.transaction,
        date: data.transaction.date.toISOString(),
      };
      return apiRequest(`/api/transactions/${data.id}`, 'PUT', formattedData);
    },
    onSuccess: () => {
      toast({
        title: "تم التحديث بنجاح",
        description: "تم تحديث المعاملة المالية بنجاح.",
      });
      
      // تحديث فوري لجميع الcaches المرتبطة
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ledger'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ledger/summary'] });
      
      // إجبار إعادة تحميل البيانات فوراً
      queryClient.refetchQueries({ queryKey: ['/api/transactions'] });
      queryClient.refetchQueries({ queryKey: ['/api/dashboard'] });
      
      onTransactionUpdated();
      setEditDialogOpen(false);
      setTransactionToEdit(null);
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في التحديث",
        description: "حدث خطأ أثناء محاولة تحديث المعاملة المالية.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteClick = (transaction: Transaction) => {
    setTransactionToDelete(transaction);
    setDeleteDialogOpen(true);
  };

  const handleEditClick = (transaction: Transaction) => {
    setTransactionToEdit(transaction);
    setEditDialogOpen(true);
  };

  const handleDeleteAttachmentClick = (transaction: Transaction) => {
    setAttachmentToDelete(transaction);
    setDeleteAttachmentDialogOpen(true);
  };

  const deleteAttachmentMutation = useMutation({
    mutationFn: (transactionId: number) => 
      apiRequest(`/api/transactions/${transactionId}/attachment`, 'DELETE'),
    onSuccess: () => {
      toast({
        title: "تم حذف المرفق بنجاح",
        description: "تم حذف المرفق من المعاملة",
      });
      setDeleteAttachmentDialogOpen(false);
      setAttachmentToDelete(null);
      onTransactionUpdated();
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في حذف المرفق",
        description: error.message || "حدث خطأ أثناء حذف المرفق",
        variant: "destructive",
      });
    },
  });

  const onEditSubmit = (values: TransactionFormValues) => {
    if (!transactionToEdit) return;
    updateMutation.mutate({ id: transactionToEdit.id, transaction: values });
  };

  const handleAttachmentClick = (fileUrl: string, fileType: string = '') => {
    console.log('Opening attachment:', { url: fileUrl, type: fileType });
    console.log('Setting selectedAttachment state...');
    setSelectedAttachment({ url: fileUrl, type: fileType });
    setAttachmentDialogOpen(true);
  };

  // Add useEffect to track state changes


  const getProjectName = (projectId: number | undefined) => {
    if (!projectId) return "بدون مشروع";
    const project = projects.find(p => p.id === projectId);
    return project ? project.name : "مشروع غير معروف";
  };

  const getFileIcon = (fileType: string) => {
    if (fileType?.includes('image')) return <Eye className="h-3 w-3" />;
    return <FileText className="h-3 w-3" />;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 mb-4">
          <i className="fas fa-receipt text-6xl"></i>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          {isArchiveMode ? "لا توجد معاملات مؤرشفة" : "لا توجد معاملات مالية"}
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          {isArchiveMode ? "لم يتم أرشفة أي معاملات بعد" : "ابدأ بإضافة معاملتك المالية الأولى"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-secondary-light dark:bg-gray-800 rounded-xl shadow-card">
        <div className="p-4 flex flex-col md:flex-row justify-between md:items-center gap-3">
          <div className="flex items-center">
            <span className="px-3 py-1.5 bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 rounded-lg font-bold text-sm ml-2 flex items-center">
              <i className="fas fa-clipboard-list ml-1.5"></i>
              {transactions.length} معاملة
            </span>
          </div>
        </div>
        
        <div className="px-4 pb-4">
          {viewType === 'cards' ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {transactions.map((transaction) => (
                <Card key={transaction.id} className="transition-all hover:shadow-md relative">
                  <CardContent className="p-3">
                    {/* الصف الأول: النوع والتاريخ والأزرار */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {isArchiveMode && onToggleSelection && (
                          <button
                            onClick={() => onToggleSelection(transaction.id)}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            {selectedTransactions.includes(transaction.id) ? (
                              <CheckSquare className="h-4 w-4" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </button>
                        )}
                        <Badge variant={transaction.type === 'income' ? 'default' : 'destructive'} className="text-xs px-2 py-0.5">
                          {transaction.type === 'income' ? 'دخل' : 'مصروف'}
                        </Badge>
                      </div>
                      
                      {hasTransactionEditPermission && !isArchiveMode && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditClick(transaction)}
                            className="h-7 w-7 p-0 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            title={user?.role !== 'admin' ? 'صلاحية تعديل مؤقتة - تنتهي تلقائياً' : ''}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(transaction)}
                            className="h-7 w-7 p-0 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600"
                            title={user?.role !== 'admin' ? 'صلاحية حذف مؤقتة - تنتهي تلقائياً' : ''}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    {/* التاريخ */}
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      {formatDateTime(transaction.date)}
                    </div>
                    
                    {/* الوصف */}
                    <h3 className="text-sm font-medium mb-2 line-clamp-2">{transaction.description}</h3>
                    
                    {/* المشروع */}
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                      المشروع: {getProjectName(transaction.projectId)}
                    </div>
                    
                    {/* نوع المصروف - إظهاره فقط للمصروفات */}
                    {transaction.type === 'expense' && transaction.expenseType && (
                      <div className="text-xs text-purple-600 dark:text-purple-400 mb-2">
                        نوع المصروف: {transaction.expenseType}
                      </div>
                    )}
                    
                    {/* المرفق - يظهر فقط للمنشئ والمدير */}
                    {transaction.fileUrl && canViewAttachment(transaction) && (
                      <div className="mb-2 flex items-center gap-2">
                        <button
                          onClick={() => {
                            console.log('Button clicked for transaction:', transaction.id, 'fileUrl:', transaction.fileUrl, 'fileType:', transaction.fileType);
                            handleAttachmentClick(transaction.fileUrl!, transaction.fileType || '');
                          }}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          {getFileIcon(transaction.fileType || '')}
                          عرض المرفق
                        </button>
                        {/* زر حذف المرفق للمدير فقط */}
                        {user?.role === 'admin' && (
                          <button
                            onClick={() => handleDeleteAttachmentClick(transaction)}
                            className="text-xs text-red-600 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                            title="حذف المرفق"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    )}
                    
                    {/* المبلغ */}
                    <div className="text-left">
                      <span className={`font-bold text-sm ${
                        transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {transaction.type === 'income' ? '+' : '-'}
                        {formatCurrency(transaction.amount)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg max-h-[500px] min-h-[300px] relative scrollable-table" 
                 style={{ 
                   scrollbarWidth: 'thin',
                   scrollbarColor: 'rgb(156 163 175) transparent'
                 }}>
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10 shadow-sm">
                  <tr>
                    {isArchiveMode && onToggleSelection && (
                      <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                        اختيار
                      </th>
                    )}
                    <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24 md:w-32">
                      التاريخ
                    </th>
                    <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-32">
                      الوصف
                    </th>
                    <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-20 md:w-28">
                      المشروع
                    </th>
                    <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-16 md:w-20">
                      النوع
                    </th>
                    <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-20 md:w-24">
                      نوع المصروف
                    </th>
                    <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-20 md:w-24">
                      المبلغ
                    </th>
                    {user?.role === 'admin' && !isArchiveMode && (
                      <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                        الإجراءات
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {transactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      {isArchiveMode && onToggleSelection && (
                        <td className="px-3 py-2 whitespace-nowrap">
                          <Checkbox
                            checked={selectedTransactions.includes(transaction.id)}
                            onCheckedChange={() => onToggleSelection(transaction.id)}
                          />
                        </td>
                      )}
                      <td className="px-3 py-2 whitespace-nowrap text-xs md:text-sm text-gray-900 dark:text-white">
                        {formatDateTime(transaction.date)}
                      </td>
                      <td className="px-3 py-2 text-xs md:text-sm text-gray-900 dark:text-white">
                        <div className="max-w-48 break-words">
                          {transaction.description}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400 max-w-20 truncate">
                        <span title={getProjectName(transaction.projectId)}>
                          {getProjectName(transaction.projectId)}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Badge variant={transaction.type === 'income' ? 'default' : 'destructive'} className="text-xs px-1 py-0">
                          {transaction.type === 'income' ? 'دخل' : 'مصروف'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-purple-600 dark:text-purple-400">
                        {transaction.type === 'expense' && transaction.expenseType ? transaction.expenseType : '-'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs md:text-sm font-medium">
                        <span className={transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}>
                          {transaction.type === 'income' ? '+' : '-'}
                          {formatCurrency(transaction.amount)}
                        </span>
                      </td>
                      {hasTransactionEditPermission && !isArchiveMode && (
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditClick(transaction)}
                              className="h-6 w-6 p-0"
                              title={user?.role !== 'admin' ? 'صلاحية تعديل مؤقتة - تنتهي تلقائياً' : ''}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteClick(transaction)}
                              className="h-6 w-6 p-0"
                              title={user?.role !== 'admin' ? 'صلاحية حذف مؤقتة - تنتهي تلقائياً' : ''}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من رغبتك في حذف هذه المعاملة المالية؟ هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (transactionToDelete) {
                  deleteMutation.mutate(transactionToDelete.id);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تعديل المعاملة المالية</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>التاريخ</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={`w-full pl-3 text-right font-normal ${
                              !field.value && "text-muted-foreground"
                            }`}
                          >
                            {field.value ? (
                              format(field.value, "PPP", { locale: ar })
                            ) : (
                              <span>اختر التاريخ</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date > new Date() || date < new Date("1900-01-01")
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>نوع المعاملة</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر نوع المعاملة" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="income">دخل</SelectItem>
                        <SelectItem value="expense">مصروف</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* حقل نوع المصروف - يظهر فقط للمصروفات */}
              {form.watch("type") === "expense" && (
                <FormField
                  control={form.control}
                  name="expenseType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>نوع المصروف</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="اختر نوع المصروف" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="مصروف عام">مصروف عام</SelectItem>
                          {expenseTypes
                            .filter(type => (type.is_active !== false && type.isActive !== false) && type.name !== "مصروف عام")
                            .map(type => (
                              <SelectItem key={type.id} value={type.name}>
                                {type.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>المبلغ</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="أدخل المبلغ" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الوصف</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="أدخل وصف المعاملة"
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>المشروع (اختياري)</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(value === "null" ? null : parseInt(value))}
                      value={field.value ? field.value.toString() : "null"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر المشروع" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="null">بدون مشروع</SelectItem>
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

              {/* قسم المرفقات والملفات */}
              <div className="space-y-3">
                <FormLabel>المرفقات</FormLabel>
                
                {/* عرض الملف الحالي إن وجد */}
                {transactionToEdit?.fileUrl && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-600" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          مرفق موجود
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(transactionToEdit.fileUrl, '_blank')}
                        className="text-xs"
                      >
                        عرض الملف
                      </Button>
                    </div>
                  </div>
                )}

                {/* خيار إعادة رفع ملف جديد */}
                <div className="space-y-2">
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.svg,.doc,.docx,.txt,.rtf,.xls,.xlsx,.zip,.rar"
                    className="text-sm"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      // ستتم معالجة الملف عند الحفظ
                    }}
                  />
                  <p className="text-xs text-gray-500">
                    اختر ملف جديد لاستبدال المرفق الحالي (اختياري)
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={updateMutation.isPending}
                  className="w-full"
                >
                  {updateMutation.isPending && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>
                  )}
                  حفظ التغييرات
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* نافذة عرض المرفق */}
      <Dialog open={attachmentDialogOpen} onOpenChange={setAttachmentDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[95vh] p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle className="text-right">عرض المرفق</DialogTitle>
            <DialogDescription className="text-right text-sm text-gray-600">
              انقر خارج النافذة أو على زر الإغلاق للخروج
            </DialogDescription>
          </DialogHeader>
          
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAttachmentDialogOpen(false)}
              className="absolute top-2 left-2 z-10 h-8 w-8 p-0 rounded-full bg-black/50 hover:bg-black/70 text-white"
            >
              <X className="h-4 w-4" />
            </Button>
            
            {selectedAttachment && (
              <div className="p-4">
                {selectedAttachment.type?.includes('image') ? (
                  <div className="flex justify-center items-center min-h-[400px]">
                    <img
                      src={selectedAttachment.url}
                      alt="مرفق الصورة"
                      className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-lg"
                      style={{
                        maxWidth: '100%',
                        height: 'auto'
                      }}
                      onLoad={() => {
                        console.log('تم تحميل الصورة بنجاح');
                      }}
                      onError={(e) => {
                        console.error('خطأ في تحميل الصورة:', selectedAttachment.url);
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const errorDiv = document.createElement('div');
                        errorDiv.className = 'text-center text-red-500 p-8 bg-red-50 rounded-lg border border-red-200';
                        errorDiv.innerHTML = `
                          <div class="mb-4">⚠️</div>
                          <p class="mb-2">لا يمكن عرض الصورة</p>
                          <button onclick="window.open('${selectedAttachment.url}', '_blank')" 
                                  class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                            فتح الرابط مباشرة
                          </button>
                        `;
                        target.parentElement?.appendChild(errorDiv);
                      }}
                    />
                  </div>
                ) : selectedAttachment.type?.includes('pdf') ? (
                  <div className="w-full h-[75vh]">
                    <iframe
                      src={selectedAttachment.url}
                      className="w-full h-full rounded-lg border"
                      title="عرض ملف PDF"
                    >
                      <div className="text-center p-8 border-2 border-dashed border-gray-300 rounded-lg">
                        <FileText className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                        <p className="text-gray-600 mb-4">
                          متصفحك لا يدعم عرض PDF مباشرة
                        </p>
                        <Button
                          onClick={() => window.open(selectedAttachment.url, '_blank')}
                          variant="outline"
                        >
                          فتح الملف في نافذة جديدة
                        </Button>
                      </div>
                    </iframe>
                  </div>
                ) : (
                  <div className="text-center p-12 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                    <FileText className="h-20 w-20 mx-auto text-gray-400 mb-6" />
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">
                      ملف غير قابل للعرض المباشر
                    </h3>
                    <p className="text-gray-600 mb-6">
                      هذا النوع من الملفات يتطلب تحميله لعرضه
                    </p>
                    <div className="space-y-3">
                      <Button
                        onClick={() => window.open(selectedAttachment.url, '_blank')}
                        className="w-full max-w-xs"
                      >
                        تحميل الملف
                      </Button>
                      <div className="text-xs text-gray-500">
                        سيتم فتح الملف في نافذة جديدة
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* حوار تأكيد حذف المرفق */}
      <AlertDialog open={deleteAttachmentDialogOpen} onOpenChange={setDeleteAttachmentDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف المرفق</AlertDialogTitle>
            <AlertDialogDescription>
              هل تريد بالتأكيد حذف المرفق من هذه المعاملة؟ هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (attachmentToDelete) {
                  deleteAttachmentMutation.mutate(attachmentToDelete.id);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              حذف المرفق
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}