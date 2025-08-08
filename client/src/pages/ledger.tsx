import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, FileText, TrendingUp, TrendingDown, DollarSign, Edit2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const expenseTypeSchema = z.object({
  name: z.string().min(1, "اسم نوع المصروف مطلوب"),
  description: z.string().optional(),
  projectId: z.number().optional(),
});

type ExpenseTypeForm = z.infer<typeof expenseTypeSchema>;

interface ExpenseType {
  id: number;
  name: string;
  description: string | null;
  projectId: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface LedgerEntry {
  id: number;
  date: string;
  transactionId: number;
  expenseTypeId: number | null;
  amount: number;
  description: string;
  projectId: number | null;
  entryType: string;
  createdAt: string;
}

interface LedgerSummary {
  classified: {
    total: number;
    count: number;
    entries: LedgerEntry[];
  };
  general_expense: {
    total: number;
    count: number;
    entries: LedgerEntry[];
  };
  grandTotal: number;
}

export default function LedgerPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingExpenseType, setEditingExpenseType] = useState<ExpenseType | null>(null);

  const form = useForm<ExpenseTypeForm>({
    resolver: zodResolver(expenseTypeSchema),
    defaultValues: {
      name: "",
      description: "",
      projectId: undefined,
    },
  });

  // جلب المشاريع للمدير
  const { data: projects = [] } = useQuery({
    queryKey: ["/api/projects"],
  });

  // جلب أنواع المصروفات
  const { data: expenseTypes = [], isLoading: expenseTypesLoading } = useQuery({
    queryKey: ["/api/expense-types"],
  });

  // جلب ملخص دفتر الأستاذ
  const { data: ledgerSummary, isLoading: summaryLoading } = useQuery<LedgerSummary>({
    queryKey: ["/api/ledger/summary"],
  });

  // جلب مدخلات دفتر الأستاذ
  const { data: ledgerEntries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ["/api/ledger"],
  });

  // جلب الدفعات الآجلة
  const { data: deferredPayments = [], isLoading: deferredLoading } = useQuery<any[]>({
    queryKey: ["/api/ledger/deferred-payments"],
  });

  // ترحيل مستحق واحد
  const transferReceivableMutation = useMutation({
    mutationFn: async (receivableId: number) => {
      return apiRequest('/api/ledger/transfer-receivables', 'POST', { receivableIds: [receivableId] });
    },
    onSuccess: () => {
      toast({ title: "تم الترحيل بنجاح", description: "تم ترحيل المستحق إلى دفتر الأستاذ" });
      queryClient.invalidateQueries({ queryKey: ['/api/ledger/deferred-payments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ledger/summary'] });
    },
    onError: (error: any) => {
      toast({ title: "خطأ في الترحيل", description: error.message || "فشل في ترحيل المستحق", variant: "destructive" });
    }
  });

  const handleTransferReceivable = (receivableId: number) => {
    transferReceivableMutation.mutate(receivableId);
  };

  // إضافة نوع مصروف جديد
  const createExpenseTypeMutation = useMutation({
    mutationFn: (data: ExpenseTypeForm) => apiRequest("/api/expense-types", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expense-types"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ledger/summary"] });
      toast({ title: "نجح الحفظ", description: "تم إضافة نوع المصروف بنجاح" });
      setIsAddDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "خطأ", description: "حدث خطأ أثناء إضافة نوع المصروف", variant: "destructive" });
    },
  });

  // إعادة تصنيف المعاملات حسب أنواع المصاريف الجديدة
  const reclassifyTransactionsMutation = useMutation({
    mutationFn: () => apiRequest("/api/ledger/reclassify-transactions", "POST", {}),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ledger"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ledger/summary"] });
      toast({ 
        title: "تم إعادة التصنيف بنجاح", 
        description: `تم إعادة تصنيف ${data.summary.reclassified} معاملة` 
      });
    },
    onError: () => {
      toast({ title: "خطأ", description: "حدث خطأ أثناء إعادة تصنيف المعاملات", variant: "destructive" });
    },
  });

  const onSubmit = (data: ExpenseTypeForm) => {
    if (editingExpenseType) {
      updateExpenseTypeMutation.mutate({ id: editingExpenseType.id, ...data });
    } else {
      createExpenseTypeMutation.mutate(data);
    }
  };

  // تحديث نوع مصروف
  const updateExpenseTypeMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number } & ExpenseTypeForm) => 
      apiRequest(`/api/expense-types/${id}`, "PATCH", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expense-types"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ledger/summary"] });
      toast({ title: "نجح التحديث", description: "تم تحديث نوع المصروف بنجاح" });
      setIsEditDialogOpen(false);
      setEditingExpenseType(null);
      form.reset();
    },
    onError: () => {
      toast({ title: "خطأ", description: "حدث خطأ أثناء تحديث نوع المصروف", variant: "destructive" });
    },
  });

  const handleEdit = (expenseType: ExpenseType) => {
    setEditingExpenseType(expenseType);
    form.reset({
      name: expenseType.name,
      description: expenseType.description || "",
      projectId: expenseType.projectId || undefined,
    });
    setIsEditDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsAddDialogOpen(false);
    setIsEditDialogOpen(false);
    setEditingExpenseType(null);
    form.reset({
      name: "",
      description: "",
      projectId: undefined,
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ar-IQ', {
      style: 'currency',
      currency: 'IQD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ar-IQ');
  };

  // تجميع العمليات حسب نوع المصروف
  const groupedEntries = useMemo(() => {
    if (!ledgerEntries || !expenseTypes) return {};
    
    const grouped: { [key: string]: { expenseType: ExpenseType; entries: LedgerEntry[] } } = {};
    
    (ledgerEntries as LedgerEntry[]).forEach((entry: LedgerEntry) => {
      if (entry.expenseTypeId) {
        const expenseType = (expenseTypes as ExpenseType[]).find(
          (type: ExpenseType) => type.id === entry.expenseTypeId
        );
        
        if (expenseType) {
          const key = expenseType.name;
          if (!grouped[key]) {
            grouped[key] = {
              expenseType,
              entries: []
            };
          }
          grouped[key].entries.push(entry);
        }
      }
    });
    
    // ترتيب المجموعات حسب اسم نوع المصروف
    const sortedKeys = Object.keys(grouped).sort((a, b) => a.localeCompare(b, 'ar'));
    const sortedGrouped: { [key: string]: { expenseType: ExpenseType; entries: LedgerEntry[] } } = {};
    sortedKeys.forEach(key => {
      sortedGrouped[key] = grouped[key];
      // ترتيب المعاملات داخل كل مجموعة حسب التاريخ (الأحدث أولاً)
      sortedGrouped[key].entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });
    
    return sortedGrouped;
  }, [ledgerEntries, expenseTypes]);

  if (expenseTypesLoading || summaryLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">دفتر الأستاذ العام</h1>
          <p className="text-muted-foreground">نظام تصنيف المصروفات والمتفرقات</p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            onClick={() => reclassifyTransactionsMutation.mutate()}
            disabled={reclassifyTransactionsMutation.isPending}
            variant="outline"
          >
            {reclassifyTransactionsMutation.isPending ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary ml-2"></div>
            ) : (
              <FileText className="ml-2 h-4 w-4" />
            )}
            إعادة تصنيف المعاملات
          </Button>
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="ml-2 h-4 w-4" />
                إضافة نوع مصروف
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>إضافة نوع مصروف جديد</DialogTitle>
              <DialogDescription>
                إضافة نوع مصروف جديد للتصنيف التلقائي
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>اسم نوع المصروف *</FormLabel>
                      <FormControl>
                        <Input placeholder="مثال: راتب، مصروف عام، وقود" {...field} />
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
                        <Textarea placeholder="وصف نوع المصروف..." {...field} />
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
                      <FormLabel>المشروع</FormLabel>
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
                          {(projects as any[])?.map((project: any) => (
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
                
                <div className="flex justify-end gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleCloseDialog}
                  >
                    إلغاء
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createExpenseTypeMutation.isPending}
                  >
                    {createExpenseTypeMutation.isPending ? "جاري الحفظ..." : "حفظ"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* مربع حوار تحرير نوع المصروف */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>تحرير نوع المصروف</DialogTitle>
              <DialogDescription>
                تحرير نوع المصروف وربطه بمشروع محدد
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>اسم نوع المصروف *</FormLabel>
                      <FormControl>
                        <Input placeholder="مثال: راتب، مصروف عام، وقود" {...field} />
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
                        <Textarea placeholder="وصف نوع المصروف..." {...field} />
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
                      <FormLabel>المشروع</FormLabel>
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
                          {(projects as any[])?.map((project: any) => (
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
                
                <div className="flex justify-end gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleCloseDialog}
                  >
                    إلغاء
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={updateExpenseTypeMutation.isPending}
                  >
                    {updateExpenseTypeMutation.isPending ? "جاري التحديث..." : "تحديث"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* ملخص التصنيف */}
      {ledgerSummary && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">المصروفات المصنفة</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(ledgerSummary.classified.total)}
              </div>
              <p className="text-xs text-muted-foreground">
                {ledgerSummary.classified.count} معاملة
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">المصروفات العامة</CardTitle>
              <TrendingDown className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {formatCurrency(ledgerSummary.general_expense?.total || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                {ledgerSummary.general_expense?.count || 0} معاملة
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">إجمالي المصروفات</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(ledgerSummary.grandTotal)}
              </div>
              <p className="text-xs text-muted-foreground">
                {ledgerSummary.classified.count + (ledgerSummary.general_expense?.count || 0)} معاملة
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList className="grid w-full overflow-x-auto" style={{ 
          gridTemplateColumns: `repeat(${4 + Object.keys(groupedEntries).length + ((deferredPayments as any[])?.length || 0)}, minmax(120px, 1fr))` 
        }}>
          <TabsTrigger value="summary">الملخص</TabsTrigger>
          <TabsTrigger value="expense-types">أنواع المصروفات</TabsTrigger>
          <TabsTrigger value="entries">دفتر الأستاذ العام</TabsTrigger>
          <TabsTrigger value="overview">نظرة شاملة</TabsTrigger>
          {/* تبويب لكل نوع مصروف */}
          {Object.keys(groupedEntries).map((expenseTypeName) => (
            <TabsTrigger 
              key={expenseTypeName} 
              value={`expense-type-${expenseTypeName}`}
              className="text-xs px-2 whitespace-nowrap"
            >
              <span className="truncate max-w-20">{expenseTypeName}</span>
            </TabsTrigger>
          ))}
          {/* تبويب لكل مستفيد */}
          {(deferredPayments as any[])?.map((beneficiary: any) => (
            <TabsTrigger 
              key={beneficiary.beneficiaryName} 
              value={`beneficiary-${beneficiary.beneficiaryName}`}
              className="text-xs px-2 whitespace-nowrap"
            >
              <span className="truncate max-w-20">{beneficiary.beneficiaryName}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          {ledgerSummary && (
            <div className="space-y-6">
              {/* تنبيه للمستحقات غير المرحلة */}
              {(deferredPayments as any[])?.some((b: any) => !b.isTransferred) && (
                <Card className="border-orange-200 bg-orange-50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <TrendingDown className="h-5 w-5 text-orange-600" />
                      <div>
                        <p className="font-medium text-orange-800">
                          يوجد {(deferredPayments as any[])?.filter((b: any) => !b.isTransferred).length} مستحق غير مرحل إلى دفتر الأستاذ
                        </p>
                        <p className="text-sm text-orange-600">
                          انتقل إلى تبويبات المستفيدين لترحيل المستحقات المفقودة
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid gap-6 md:grid-cols-2">
                {/* المصروفات المصنفة */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                      المصروفات المصنفة
                    </CardTitle>
                    <CardDescription>
                      المصروفات التي تم تصنيفها حسب النوع
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {ledgerSummary.classified.entries.slice(0, 5).map((entry) => (
                        <div key={entry.id} className="flex justify-between items-center p-2 bg-green-50 rounded relative">
                          {/* علامة دفعات آجلة إذا كان النوع deferred */}
                          {entry.entryType === 'deferred' && (
                            <div className="absolute top-1 left-1">
                              <Badge variant="secondary" className="text-xs px-1 py-0 bg-blue-100 text-blue-800">
                                دفعات آجلة
                              </Badge>
                            </div>
                          )}
                          <div className={entry.entryType === 'deferred' ? 'mt-4' : ''}>
                            <p className="font-medium">{entry.description}</p>
                            <p className="text-sm text-muted-foreground">{formatDate(entry.date)}</p>
                          </div>
                          <div className="text-left">
                            <p className="font-bold text-green-600">{formatCurrency(entry.amount)}</p>
                          </div>
                        </div>
                      ))}
                      {ledgerSummary.classified.entries.length > 5 && (
                        <p className="text-sm text-muted-foreground text-center mt-2">
                          و {ledgerSummary.classified.entries.length - 5} معاملة أخرى...
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* المصروفات العامة */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingDown className="h-5 w-5 text-orange-600" />
                      المصروفات العامة
                    </CardTitle>
                    <CardDescription>
                      المصروفات غير المصنفة حسب النوع
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {ledgerSummary.general_expense.entries.slice(0, 5).map((entry) => (
                        <div key={entry.id} className="flex justify-between items-center p-2 bg-orange-50 rounded">
                          <div>
                            <p className="font-medium">{entry.description}</p>
                            <p className="text-sm text-muted-foreground">{formatDate(entry.date)}</p>
                          </div>
                          <div className="text-left">
                            <p className="font-bold text-orange-600">{formatCurrency(entry.amount)}</p>
                          </div>
                        </div>
                      ))}
                      {ledgerSummary.general_expense.entries.length > 5 && (
                        <p className="text-sm text-muted-foreground text-center mt-2">
                          و {ledgerSummary.general_expense.entries.length - 5} معاملة أخرى...
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        {/* تبويبات أنواع المصروفات - كل نوع في تبويب منفصل */}
        {Object.entries(groupedEntries).map(([expenseTypeName, { expenseType, entries }]) => (
          <TabsContent key={expenseTypeName} value={`expense-type-${expenseTypeName}`} className="space-y-4">
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2 flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                دفتر أستاذ: {expenseTypeName}
              </h2>
              <p className="text-muted-foreground">
                جميع المعاملات المصنفة تحت نوع المصروف: {expenseTypeName}
              </p>
              {expenseType.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {expenseType.description}
                </p>
              )}
            </div>

            {/* إحصائيات سريعة */}
            <div className="grid gap-4 md:grid-cols-3 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">إجمالي المبلغ</CardTitle>
                  <DollarSign className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {entries.reduce((sum, entry) => sum + entry.amount, 0).toLocaleString()} د.ع
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">عدد المعاملات</CardTitle>
                  <FileText className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {entries.length}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">متوسط المعاملة</CardTitle>
                  <TrendingUp className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">
                    {Math.round(entries.reduce((sum, entry) => sum + entry.amount, 0) / entries.length).toLocaleString()} د.ع
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* جدول المعاملات */}
            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="bg-gradient-to-r from-green-50 to-transparent">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-green-600" />
                  سجل معاملات {expenseTypeName}
                </CardTitle>
                <CardDescription>
                  جميع المعاملات المصنفة تحت هذا النوع مرتبة حسب التاريخ
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold">رقم المعاملة</TableHead>
                        <TableHead className="font-semibold">تاريخ المعاملة</TableHead>
                        <TableHead className="font-semibold">البيان</TableHead>
                        <TableHead className="font-semibold text-center">المشروع</TableHead>
                        <TableHead className="font-semibold text-right">المبلغ</TableHead>
                        <TableHead className="font-semibold text-right">الرصيد المتراكم</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        let runningBalance = 0;
                        return entries.map((entry, index) => {
                          runningBalance += entry.amount;
                          return (
                            <TableRow key={entry.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                              <TableCell className="font-medium text-center">
                                #{entry.transactionId || entry.id}
                              </TableCell>
                              <TableCell className="font-medium">
                                {formatDate(entry.date)}
                              </TableCell>
                              <TableCell>
                                <div className="max-w-sm">
                                  <p className="text-sm font-medium">{entry.description}</p>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                {entry.projectId ? (
                                  <Badge variant="secondary" className="text-xs">
                                    مشروع {entry.projectId}
                                  </Badge>
                                ) : (
                                  <span className="text-gray-400 text-xs">عام</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-mono font-bold text-red-600">
                                {entry.amount.toLocaleString()} د.ع
                              </TableCell>
                              <TableCell className="text-right font-mono font-bold text-blue-600">
                                {runningBalance.toLocaleString()} د.ع
                              </TableCell>
                            </TableRow>
                          );
                        });
                      })()}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* ملخص النوع */}
            <Card className="bg-gradient-to-r from-green-600 to-green-700 text-white">
              <CardContent className="p-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-bold mb-1">
                      ملخص حساب {expenseTypeName}
                    </h3>
                    <p className="text-green-100">
                      إجمالي المعاملات المصنفة تحت هذا النوع
                    </p>
                  </div>
                  <div className="text-left">
                    <div className="text-2xl font-bold mb-1">
                      {entries.reduce((sum, entry) => sum + entry.amount, 0).toLocaleString()} د.ع
                    </div>
                    <div className="text-green-100">
                      إجمالي المبلغ | {entries.length} معاملة
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}

        {/* تبويب النظرة الشاملة */}
        <TabsContent value="overview" className="space-y-4">
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-2">نظرة شاملة على جميع أنواع المصروفات</h2>
            <p className="text-muted-foreground">ملخص سريع لجميع أنواع المصروفات وإجمالياتها</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(groupedEntries).map(([expenseTypeName, { expenseType, entries }]) => (
              <Card key={expenseTypeName} className="border-l-4 border-l-blue-500">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="text-lg">{expenseTypeName}</span>
                    <Badge variant="secondary">{entries.length}</Badge>
                  </CardTitle>
                  {expenseType.description && (
                    <CardDescription className="text-xs">
                      {expenseType.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">إجمالي المبلغ</span>
                      <span className="font-bold text-blue-600">
                        {entries.reduce((sum, entry) => sum + entry.amount, 0).toLocaleString()} د.ع
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">متوسط المعاملة</span>
                      <span className="font-medium">
                        {Math.round(entries.reduce((sum, entry) => sum + entry.amount, 0) / entries.length).toLocaleString()} د.ع
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">آخر معاملة</span>
                      <span className="text-xs">
                        {formatDate(entries[0].date)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {Object.keys(groupedEntries).length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium mb-2">لا توجد أنواع مصروفات مصنفة</h3>
                <p className="text-muted-foreground">
                  سيتم عرض أنواع المصروفات هنا بعد إنشاء معاملات وتصنيفها
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* تبويبات المستفيدين - كل مستفيد في تبويب منفصل */}
        {(deferredPayments as any[])?.map((beneficiary: any) => (
          <TabsContent key={beneficiary.beneficiaryName} value={`beneficiary-${beneficiary.beneficiaryName}`} className="space-y-4">
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2 flex items-center gap-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                دفتر أستاذ: {beneficiary.beneficiaryName}
              </h2>
              <p className="text-muted-foreground">جميع عمليات الترحيل والدفعات الخاصة بهذا المستحق</p>
            </div>

            {/* إحصائيات سريعة */}
            <div className="grid gap-4 md:grid-cols-3 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">إجمالي المدفوع</CardTitle>
                  <DollarSign className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {beneficiary.totalAmount.toLocaleString()} د.ع
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">عدد العمليات</CardTitle>
                  <FileText className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {beneficiary.paymentsCount}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">متوسط الدفعة</CardTitle>
                  <TrendingUp className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">
                    {Math.round(beneficiary.totalAmount / beneficiary.paymentsCount).toLocaleString()} د.ع
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* جدول دفتر الأستاذ */}
            <Card className={`border-l-4 ${beneficiary.isTransferred ? 'border-l-blue-500' : 'border-l-orange-500'}`}>
              <CardHeader className={`bg-gradient-to-r ${beneficiary.isTransferred ? 'from-blue-50' : 'from-orange-50'} to-transparent`}>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className={`w-5 h-5 ${beneficiary.isTransferred ? 'text-blue-600' : 'text-orange-600'}`} />
                      {beneficiary.isTransferred ? 'دفتر الأستاذ التفصيلي' : 'مستحق غير مرحل'}
                    </CardTitle>
                    <CardDescription>
                      {beneficiary.isTransferred 
                        ? 'سجل كامل بجميع عمليات الترحيل مرتبة حسب التاريخ'
                        : 'هذا المستحق لم يتم ترحيله إلى دفتر الأستاذ بعد'
                      }
                    </CardDescription>
                  </div>
                  {!beneficiary.isTransferred && beneficiary.pendingTransfer && (
                    <Button
                      onClick={() => handleTransferReceivable(beneficiary.originalPaymentId)}
                      className="bg-orange-600 hover:bg-orange-700"
                      size="sm"
                      disabled={transferReceivableMutation.isPending}
                    >
                      <Plus className="w-4 h-4 ml-1" />
                      {transferReceivableMutation.isPending ? 'جاري الترحيل...' : 'ترحيل إلى الأستاذ'}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold">رقم العملية</TableHead>
                        <TableHead className="font-semibold">تاريخ العملية</TableHead>
                        <TableHead className="font-semibold">البيان</TableHead>
                        <TableHead className="font-semibold text-center">نوع العملية</TableHead>
                        <TableHead className="font-semibold text-right">المبلغ (دائن)</TableHead>
                        <TableHead className="font-semibold text-center">المشروع</TableHead>
                        <TableHead className="font-semibold text-right">الرصيد المتراكم</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        let runningBalance = 0;
                        return beneficiary.entries.map((entry: any, index: number) => {
                          runningBalance += entry.amount;
                          return (
                            <TableRow key={entry.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                              <TableCell className="font-medium text-center">
                                #{entry.id}
                              </TableCell>
                              <TableCell className="font-medium">
                                {formatDate(entry.date)}
                              </TableCell>
                              <TableCell>
                                <div className="max-w-sm">
                                  <p className="text-sm font-medium">{entry.description}</p>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className={
                                  beneficiary.isTransferred 
                                    ? "bg-red-50 text-red-700 border-red-200"
                                    : "bg-orange-50 text-orange-700 border-orange-200"
                                }>
                                  {beneficiary.isTransferred ? 'دفعة مستحق' : 'قيد انتظار'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-mono font-bold text-red-600">
                                {entry.amount.toLocaleString()} د.ع
                              </TableCell>
                              <TableCell className="text-center">
                                {entry.projectId ? (
                                  <Badge variant="secondary" className="text-xs">
                                    مشروع {entry.projectId}
                                  </Badge>
                                ) : (
                                  <span className="text-gray-400 text-xs">عام</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-mono font-bold text-blue-600">
                                {runningBalance.toLocaleString()} د.ع
                              </TableCell>
                            </TableRow>
                          );
                        });
                      })()}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* ملخص الحساب */}
            <Card className={`bg-gradient-to-r ${
              beneficiary.isTransferred 
                ? 'from-blue-600 to-blue-700' 
                : 'from-orange-600 to-orange-700'
            } text-white`}>
              <CardContent className="p-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-bold mb-1">
                      {beneficiary.isTransferred ? 'ملخص حساب' : 'مستحق في انتظار الترحيل'} {beneficiary.beneficiaryName}
                    </h3>
                    <p className={beneficiary.isTransferred ? "text-blue-100" : "text-orange-100"}>
                      {beneficiary.isTransferred 
                        ? 'إجمالي العمليات المرحلة في دفتر الأستاذ'
                        : 'هذا المستحق بحاجة لترحيل إلى دفتر الأستاذ'
                      }
                    </p>
                  </div>
                  <div className="text-left">
                    <div className="text-2xl font-bold mb-1">
                      {beneficiary.totalAmount.toLocaleString()} د.ع
                    </div>
                    <div className={beneficiary.isTransferred ? "text-blue-100" : "text-orange-100"}>
                      {beneficiary.isTransferred 
                        ? `إجمالي الجانب الدائن | ${beneficiary.paymentsCount} عملية ترحيل`
                        : 'مبلغ في انتظار الترحيل'
                      }
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}

        <TabsContent value="expense-types" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>أنواع المصروفات المتاحة</CardTitle>
              <CardDescription>
                إدارة أنواع المصروفات للتصنيف التلقائي
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الاسم</TableHead>
                    <TableHead>الوصف</TableHead>
                    <TableHead>المشروع</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>تاريخ الإنشاء</TableHead>
                    <TableHead>الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(expenseTypes as ExpenseType[]).map((type: ExpenseType) => (
                    <TableRow key={type.id}>
                      <TableCell className="font-medium">{type.name}</TableCell>
                      <TableCell>{type.description || "-"}</TableCell>
                      <TableCell>
                        {type.projectId ? (
                          <Badge variant="outline" className="text-xs">
                            {(projects as any[])?.find(p => p.id === type.projectId)?.name || `مشروع ${type.projectId}`}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            عام
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={type.isActive ? "default" : "secondary"}>
                          {type.isActive ? "نشط" : "غير نشط"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(type.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(type)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="entries" className="space-y-4">
          <div className="flex justify-end mb-4 gap-2">
            <Button 
              onClick={async () => {
                try {
                  const response = await fetch("/api/ledger/migrate-classified", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({})
                  });
                  
                  if (response.ok) {
                    const result = await response.json();
                    toast({
                      title: "نجح الترحيل",
                      description: `تم إضافة ${result.summary.added} عملية إلى دفتر الأستاذ`,
                    });
                    queryClient.invalidateQueries({ queryKey: ["/api/ledger"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/ledger/summary"] });
                  } else {
                    throw new Error("فشل في الترحيل");
                  }
                } catch (error) {
                  toast({
                    title: "خطأ",
                    description: "فشل في ترحيل المعاملات المصنفة",
                    variant: "destructive",
                  });
                }
              }}
              variant="default"
              className="mr-2"
            >
              ترحيل المعاملات المصنفة
            </Button>
            <Button 
              onClick={async () => {
                try {
                  // جلب جميع المعاملات للتصنيف
                  const transactionsResponse = await fetch("/api/transactions");
                  if (!transactionsResponse.ok) throw new Error("فشل في جلب المعاملات");
                  
                  const allTransactions = await transactionsResponse.json();
                  const expenseTransactions = allTransactions.filter((t: any) => 
                    t.type === 'expense' && t.expenseType && t.expenseType !== 'مصروف عام'
                  );
                  
                  if (expenseTransactions.length === 0) {
                    toast({
                      title: "لا توجد معاملات للتصنيف",
                      description: "جميع المعاملات مصنفة بالفعل أو لا تحتوي على نوع مصروف محدد",
                    });
                    return;
                  }
                  
                  const transactionIds = expenseTransactions.map((t: any) => t.id);
                  
                  const response = await fetch("/api/ledger/classify", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ 
                      transactionIds, 
                      forceAll: true 
                    })
                  });
                  
                  if (response.ok) {
                    const result = await response.json();
                    toast({
                      title: "نجح التصنيف",
                      description: `تم تصنيف ${result.classified} معاملة في دفتر الأستاذ`,
                    });
                    queryClient.invalidateQueries({ queryKey: ["/api/ledger"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/ledger/summary"] });
                  } else {
                    throw new Error("فشل في التصنيف");
                  }
                } catch (error) {
                  toast({
                    title: "خطأ",
                    description: "فشل في تصنيف المعاملات",
                    variant: "destructive",
                  });
                }
              }}
              variant="outline"
              className="mr-2"
            >
              إعادة تصنيف جميع المعاملات
            </Button>
          </div>
          
          {/* عرض العمليات مبوبة حسب نوع المصروف */}
          {Object.keys(groupedEntries).length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>دفتر الأستاذ العام</CardTitle>
                <CardDescription>
                  لا توجد عمليات مصنفة في دفتر الأستاذ
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-muted-foreground">
                    سيتم عرض العمليات هنا بعد تصنيفها حسب نوع المصروف
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedEntries).map(([expenseTypeName, { expenseType, entries }]) => (
                <Card key={expenseTypeName}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Badge variant="default">{expenseTypeName}</Badge>
                      <span className="text-sm text-muted-foreground">
                        ({entries.length} عملية - {formatCurrency(entries.reduce((sum, entry) => sum + entry.amount, 0))})
                      </span>
                    </CardTitle>
                    <CardDescription>
                      {expenseType.description || 'عمليات مصنفة تحت هذا النوع'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>التاريخ</TableHead>
                          <TableHead>الوصف</TableHead>
                          <TableHead>المبلغ</TableHead>
                          <TableHead>المشروع</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {entries.map((entry: LedgerEntry) => (
                          <TableRow key={entry.id} className="relative">
                            <TableCell>{formatDate(entry.date)}</TableCell>
                            <TableCell className="max-w-xs truncate relative">
                              {entry.entryType === 'deferred' && (
                                <Badge variant="secondary" className="absolute top-0 right-0 text-xs px-1 py-0 bg-blue-100 text-blue-800 mb-1">
                                  دفعات آجلة
                                </Badge>
                              )}
                              <div className={entry.entryType === 'deferred' ? 'mt-5' : ''}>
                                {entry.description}
                              </div>
                            </TableCell>
                            <TableCell className="font-mono">{formatCurrency(entry.amount)}</TableCell>
                            <TableCell>
                              {entry.projectId ? (
                                <Badge variant="outline">مشروع #{entry.projectId}</Badge>
                              ) : (
                                <span className="text-muted-foreground">عام</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}