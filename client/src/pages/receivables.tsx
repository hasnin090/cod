import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

import { 
  Plus, 
  Search, 
  Filter, 
  User, 
  Calendar, 
  DollarSign, 
  FileText, 
  Building2,
  CreditCard,
  Trash2,
  Eye,
  Receipt,
  CheckCircle,
  AlertCircle,
  History,
  X,
  BarChart3
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import type { DeferredPayment, Project } from "@shared/schema";

const formSchema = z.object({
  operationType: z.enum(["new_receivable", "payment"], {
    required_error: "يجب تحديد نوع العملية"
  }),
  // Fields for new receivable
  beneficiaryName: z.string().optional(),
  totalAmount: z.number().optional(),
  projectId: z.number().optional(),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  initialPayment: z.number().optional(),
  // Fields for payment
  receivableId: z.number().optional(),
  paymentAmount: z.number().optional(),
  paymentNotes: z.string().optional()
}).refine((data) => {
  if (data.operationType === "new_receivable") {
    return data.beneficiaryName && data.beneficiaryName.length > 0 && 
           data.totalAmount && data.totalAmount > 0;
  }
  if (data.operationType === "payment") {
    return data.receivableId && data.paymentAmount && data.paymentAmount > 0;
  }
  return false;
}, {
  message: "البيانات المطلوبة غير مكتملة"
});

type FormData = z.infer<typeof formSchema>;

export default function Receivables() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [selectedReceivable, setSelectedReceivable] = useState<DeferredPayment | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const { data: receivables = [], isLoading } = useQuery<DeferredPayment[]>({
    queryKey: ["/api/deferred-payments"],
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // جلب تفاصيل مستحق معين مع عمليات الدفع (من قسم المستحقات فقط)
  const { data: receivableDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ["/api/deferred-payments", selectedReceivable?.id, "details"],
    queryFn: async () => {
      if (!selectedReceivable?.id) return null;
      const response = await fetch(`/api/deferred-payments/${selectedReceivable.id}/details`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("فشل في تحميل تفاصيل المستحق");
      const payments = await response.json();
      
      // تحويل البيانات لتتضمن معلومات المستحق والدفعات
      return {
        ...selectedReceivable,
        payments: payments || []
      };
    },
    enabled: !!selectedReceivable?.id && showDetails,
    staleTime: 1000 * 60 * 2, // دقيقتان
  });

  const mainForm = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      operationType: "new_receivable",
      beneficiaryName: "",
      totalAmount: 0,
      projectId: undefined,
      description: "",
      dueDate: "",
      initialPayment: 0,
      paymentAmount: 0,
      paymentNotes: ""
    }
  });

  const operationType = mainForm.watch("operationType");

  const mainFormMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (data.operationType === "new_receivable") {
        // Create new receivable with optional initial payment
        const response = await fetch("/api/deferred-payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            beneficiaryName: data.beneficiaryName,
            totalAmount: data.totalAmount,
            remainingAmount: data.totalAmount,
            projectId: data.projectId,
            description: data.description,
            dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null,
            userId: user?.id,
            installments: 1,
            paymentFrequency: "monthly",
          }),
        });
        if (!response.ok) throw new Error("فشل في إضافة المستحق");
        
        const newReceivable = await response.json();
        
        // Add initial payment if provided
        if (data.initialPayment && data.initialPayment > 0) {
          const paymentResponse = await fetch(`/api/deferred-payments/${newReceivable.id}/pay`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              amount: data.initialPayment,
              userId: user?.id,
              notes: "دفعة أولى"
            }),
          });
          if (!paymentResponse.ok) throw new Error("فشل في تسجيل الدفعة الأولى");
        }
        
        return newReceivable;
      } else if (data.operationType === "payment") {
        // Make payment to existing receivable
        const response = await fetch(`/api/deferred-payments/${data.receivableId}/pay`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            amount: data.paymentAmount,
            userId: user?.id,
            notes: data.paymentNotes || "دفعة"
          }),
        });
        if (!response.ok) throw new Error("فشل في تسجيل الدفعة");
        return response.json();
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/deferred-payments"] });
      // إبطال تخزين العمليات المالية والداشبورد أيضاً عند دفع قسط
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      // إبطال تخزين تفاصيل المستحق المفتوح حالياً
      if (selectedReceivable) {
        queryClient.invalidateQueries({ 
          queryKey: ["/api/deferred-payments", selectedReceivable.id, "details"] 
        });
      }
      mainForm.reset({
        operationType: "new_receivable",
        beneficiaryName: "",
        totalAmount: 0,
        projectId: undefined,
        description: "",
        dueDate: "",
        initialPayment: 0,
        paymentAmount: 0,
        paymentNotes: ""
      });
      toast({
        title: "تم بنجاح",
        description: variables.operationType === "new_receivable" 
          ? "تم تسجيل المستحق الجديد" 
          : "تم تسجيل الدفعة",
      });
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "فشل في تنفيذ العملية",
        variant: "destructive",
      });
    },
  });

  const deleteReceivableMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/deferred-payments/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("فشل في حذف المستحق");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deferred-payments"] });
      toast({
        title: "تم بنجاح",
        description: "تم حذف المستحق",
      });
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "فشل في حذف المستحق",
        variant: "destructive",
      });
    },
  });

  // وظائف مساعدة
  const handleViewDetails = (receivable: DeferredPayment) => {
    setSelectedReceivable(receivable);
    setShowDetails(true);
  };

  const calculateReceivableStats = (details: any) => {
    if (!details || !details.payments) return {
      totalPaid: details?.paidAmount || 0,
      totalPayments: 0,
      remainingAmount: (details?.totalAmount || 0) - (details?.paidAmount || 0),
      completionPercentage: details?.totalAmount > 0 ? Math.round(((details?.paidAmount || 0) / details.totalAmount) * 100) : 0
    };

    const totalPaid = details.payments.reduce((sum: number, payment: any) => sum + payment.amount, 0);
    const totalPayments = details.payments.length;
    const remainingAmount = details.totalAmount - totalPaid;
    const completionPercentage = details.totalAmount > 0 ? Math.round((totalPaid / details.totalAmount) * 100) : 0;

    return {
      totalPaid,
      totalPayments,
      remainingAmount,
      completionPercentage
    };
  };

  // Filter receivables based on search and project
  const filteredReceivables = receivables.filter((receivable: DeferredPayment) => {
    const matchesSearch = (receivable.beneficiaryName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (receivable.description && receivable.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesProject = selectedProject === "all" || 
                          (receivable.projectId && receivable.projectId.toString() === selectedProject);
    return matchesSearch && matchesProject;
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">المستحقات</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">المستحقات</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">تسجيل المستحقات للأشخاص والموردين</p>
      </div>

      {/* Main Form - Conditional based on operation type */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            {operationType === "new_receivable" ? "تسجيل مستحق جديد" : "تسديد دفعة"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...mainForm}>
            <form onSubmit={mainForm.handleSubmit((data) => mainFormMutation.mutate(data))} className="space-y-4">
              {/* Operation Type Selector */}
              <FormField
                control={mainForm.control}
                name="operationType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>نوع العملية</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="اختر نوع العملية" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="new_receivable">تسجيل مستحق جديد</SelectItem>
                        <SelectItem value="payment">تسديد دفعة لمستحق موجود</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* New Receivable Fields */}
              {operationType === "new_receivable" && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={mainForm.control}
                      name="beneficiaryName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>اسم المستفيد</FormLabel>
                          <FormControl>
                            <Input placeholder="أدخل اسم المستفيد" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={mainForm.control}
                      name="totalAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>المبلغ المستحق الكلي</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                type="number" 
                                placeholder="0"
                                min="1"
                                step="1"
                                className="pl-12 text-right font-mono"
                                {...field}
                                value={field.value || ""}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  field.onChange(value === "" ? "" : Number(value));
                                }}
                              />
                              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400 pointer-events-none">
                                د.ع
                              </div>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={mainForm.control}
                      name="projectId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>المشروع (اختياري)</FormLabel>
                          <Select 
                            value={field.value ? field.value.toString() : "none"} 
                            onValueChange={(value) => field.onChange(value === "none" ? undefined : Number(value))}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="اختر المشروع" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">بدون مشروع</SelectItem>
                              {projects.map((project: Project) => (
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
                      control={mainForm.control}
                      name="dueDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>تاريخ الاستحقاق (اختياري)</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={mainForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>الوصف (اختياري)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="وصف طبيعة المستحق أو العمل المطلوب" 
                            {...field} 
                            className="min-h-[60px] resize-none"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={mainForm.control}
                    name="initialPayment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>الدفعة الأولى (اختياري)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              type="number" 
                              placeholder="0"
                              min="0"
                              step="1"
                              className="pl-12 text-right font-mono"
                              {...field}
                              value={field.value || ""}
                              onChange={(e) => {
                                const value = e.target.value;
                                field.onChange(value === "" ? "" : Number(value));
                              }}
                            />
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400 pointer-events-none">
                              د.ع
                            </div>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Payment Fields */}
              {operationType === "payment" && (
                <>
                  <FormField
                    control={mainForm.control}
                    name="receivableId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>المستحق المراد التسديد له</FormLabel>
                        <Select 
                          value={field.value ? field.value.toString() : ""} 
                          onValueChange={(value) => field.onChange(Number(value))}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="اختر المستحق" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {receivables
                              .filter((r: DeferredPayment) => r.paidAmount < r.totalAmount)
                              .map((receivable: DeferredPayment) => (
                                <SelectItem key={receivable.id} value={receivable.id.toString()}>
                                  {receivable.beneficiaryName} - متبقي: {(receivable.totalAmount - receivable.paidAmount).toLocaleString()} ج.م
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={mainForm.control}
                      name="paymentAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>مبلغ الدفعة</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                type="number" 
                                placeholder="0"
                                min="1"
                                step="1"
                                className="pl-12 text-right font-mono"
                                {...field}
                                value={field.value || ""}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  field.onChange(value === "" ? "" : Number(value));
                                }}
                              />
                              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400 pointer-events-none">
                                د.ع
                              </div>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={mainForm.control}
                      name="paymentNotes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ملاحظات الدفعة (اختياري)</FormLabel>
                          <FormControl>
                            <Input placeholder="ملاحظات أو تفاصيل الدفعة" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-2">
                <Button 
                  type="submit" 
                  disabled={mainFormMutation.isPending} 
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                >
                  <Plus className="w-4 h-4 ml-2" />
                  {mainFormMutation.isPending ? "جاري المعالجة..." : (
                    operationType === "new_receivable" ? "إضافة المستحق" : "تسجيل الدفعة"
                  )}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => mainForm.reset()}
                >
                  مسح الحقول
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Search and Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            البحث والتصفية
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="ابحث بالاسم أو الوصف..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="w-full md:w-64">
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger>
                  <SelectValue placeholder="تصفية بالمشروع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع المشاريع</SelectItem>
                  {projects.map((project: Project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Receivables List */}
      <div className="space-y-4">
        {filteredReceivables.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">لا توجد مستحقات مسجلة</h3>
              <p className="text-gray-600 mb-4">استخدم النموذج أعلاه لإضافة مستحق جديد</p>
            </CardContent>
          </Card>
        ) : (
          filteredReceivables.map((receivable: DeferredPayment) => (
            <Card key={receivable.id} className="border-l-4 border-l-blue-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {receivable.beneficiaryName}
                    </h3>
                    <Badge variant={(receivable.paidAmount || 0) >= (receivable.totalAmount || 0) ? "default" : "secondary"}>
                      {(receivable.paidAmount || 0) >= (receivable.totalAmount || 0) ? "مكتمل" : "معلق"}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteReceivableMutation.mutate(receivable.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-gray-600">المستحق:</span>
                    <span className="font-medium">{(receivable.totalAmount || 0).toLocaleString()} دينار عراقي</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-blue-500" />
                    <span className="text-sm text-gray-600">المدفوع:</span>
                    <span className="font-medium">{(receivable.paidAmount || 0).toLocaleString()} دينار عراقي</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-orange-500" />
                    <span className="text-sm text-gray-600">المتبقي:</span>
                    <span className="font-medium">
                      {((receivable.totalAmount || 0) - (receivable.paidAmount || 0)).toLocaleString()} دينار عراقي
                    </span>
                  </div>
                </div>

                {receivable.dueDate && (
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-600">تاريخ الاستحقاق:</span>
                    <span className="text-sm">
                      {new Date(receivable.dueDate).toLocaleDateString('ar-EG')}
                    </span>
                  </div>
                )}

                {receivable.description && (
                  <div className="flex items-start gap-2 mb-2">
                    <FileText className="w-4 h-4 text-gray-500 mt-0.5" />
                    <span className="text-sm text-gray-600">الوصف:</span>
                    <span className="text-sm flex-1">{receivable.description}</span>
                  </div>
                )}

                {receivable.projectId && (
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-600">المشروع:</span>
                    <span className="text-sm">
                      {projects.find((p: Project) => p.id === receivable.projectId)?.name || "غير محدد"}
                    </span>
                  </div>
                )}

                {/* أزرار الإجراءات */}
                <div className="flex gap-2 mt-4 pt-3 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewDetails(receivable)}
                    className="flex-1"
                  >
                    <Eye className="w-4 h-4 ml-1" />
                    عرض التفاصيل
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      mainForm.setValue("operationType", "payment");
                      mainForm.setValue("receivableId", receivable.id);
                    }}
                    className="flex-1"
                    disabled={(receivable.paidAmount || 0) >= (receivable.totalAmount || 0)}
                  >
                    <DollarSign className="w-4 h-4 ml-1" />
                    إضافة دفعة
                  </Button>
                </div>

              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* نافذة تفاصيل المستحق - بسيطة ومنظمة */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden" dir="rtl">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              تفاصيل المستحق - {selectedReceivable?.beneficiaryName}
            </DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto max-h-[calc(80vh-80px)]">
            {isLoadingDetails ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                <span className="mr-3 text-gray-600">جاري التحميل...</span>
              </div>
            ) : receivableDetails ? (
              <div className="space-y-6">
                {/* بطاقة ملخص المستحق */}
                <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <DollarSign className="w-5 h-5 text-blue-600" />
                      ملخص المستحق
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">المبلغ الإجمالي</div>
                        <div className="text-xl font-bold text-blue-600">
                          {receivableDetails.totalAmount?.toLocaleString()} د.ع
                        </div>
                      </div>
                      
                      <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">المبلغ المدفوع</div>
                        <div className="text-xl font-bold text-green-600">
                          {receivableDetails.paidAmount?.toLocaleString() || 0} د.ع
                        </div>
                      </div>
                      
                      <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">عدد الدفعات</div>
                        <div className="text-xl font-bold text-purple-600">
                          {receivableDetails.payments?.length || 0}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* قائمة الدفعات */}
                {receivableDetails.payments && receivableDetails.payments.length > 0 ? (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2">
                        <History className="w-5 h-5 text-green-600" />
                        سجل الدفعات ({receivableDetails.payments.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {receivableDetails.payments.map((payment: any, index: number) => (
                          <div 
                            key={payment.id || index}
                            className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-gray-800 dark:to-gray-900 rounded-lg border border-green-200 dark:border-gray-700"
                          >
                            <div className="flex items-center gap-4">
                              <div className="flex-shrink-0">
                                <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                                  <CheckCircle className="w-5 h-5 text-green-600" />
                                </div>
                              </div>
                              
                              <div>
                                <div className="font-semibold text-gray-900 dark:text-gray-100">
                                  {payment.amount?.toLocaleString()} د.ع
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                  {new Date(payment.paymentDate || payment.date || payment.createdAt).toLocaleDateString('ar', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  })}
                                </div>
                                {payment.transactionId && (
                                  <div className="text-xs text-blue-600 dark:text-blue-400">
                                    رقم المعاملة: {payment.transactionId}
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <div className="text-left">
                              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                <Receipt className="w-3 h-3 ml-1" />
                                مدفوع
                              </Badge>
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {new Date(payment.paymentDate || payment.date || payment.createdAt).toLocaleTimeString('ar', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="text-center py-12">
                      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-8 h-8 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                        لا توجد دفعات مسجلة
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 mb-6">
                        لم يتم تسجيل أي دفعات لهذا المستحق حتى الآن
                      </p>
                      <Button
                        onClick={() => setShowDetails(false)}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <X className="w-4 h-4 ml-2" />
                        إغلاق
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                فشل في تحميل البيانات
                <Button
                  onClick={() => setShowDetails(false)}
                  className="mt-4 bg-gray-600 hover:bg-gray-700 text-white"
                >
                  إغلاق
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}