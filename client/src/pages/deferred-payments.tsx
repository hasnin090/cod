import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Clock, 
  DollarSign, 
  User, 
  Plus, 
  Edit, 
  Calendar,
  AlertCircle,
  CheckCircle,
  Eye
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface DeferredPayment {
  id: number;
  beneficiaryName: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  projectId?: number;
  status: string;
  description?: string;
  dueDate?: string;
  installments: number;
  paymentFrequency: string;
  notes?: string;
  createdAt: string;
  projectName?: string;
}

interface Project {
  id: number;
  name: string;
}

export default function DeferredPayments() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<DeferredPayment | null>(null);
  const [formData, setFormData] = useState({
    beneficiaryName: '',
    totalAmount: '',
    projectId: '',
    description: '',
    dueDate: '',
    installments: '1',
    paymentFrequency: 'monthly',
    notes: ''
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // جلب المستحقات
  const { data: payments = [], isLoading } = useQuery<DeferredPayment[]>({
    queryKey: ['/api/deferred-payments'],
    enabled: true
  });

  // جلب المشاريع
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
    enabled: true
  });

  // إضافة مستحق جديد
  const addPaymentMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/deferred-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          totalAmount: parseInt(data.totalAmount),
          remainingAmount: parseInt(data.totalAmount),
          projectId: data.projectId ? parseInt(data.projectId) : null,
          installments: parseInt(data.installments),
          dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null
        })
      });
      if (!response.ok) throw new Error('خطأ في إضافة المستحق');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deferred-payments'] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({ title: 'تم إضافة المستحق بنجاح' });
    },
    onError: () => {
      toast({ 
        title: 'خطأ',
        description: 'فشل في إضافة المستحق',
        variant: 'destructive'
      });
    }
  });

  const resetForm = () => {
    setFormData({
      beneficiaryName: '',
      totalAmount: '',
      projectId: '',
      description: '',
      dueDate: '',
      installments: '1',
      paymentFrequency: 'monthly',
      notes: ''
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.beneficiaryName || !formData.totalAmount) {
      toast({
        title: 'خطأ',
        description: 'يرجى ملء الحقول المطلوبة',
        variant: 'destructive'
      });
      return;
    }
    addPaymentMutation.mutate(formData);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ar-IQ', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + ' دينار عراقي';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          معلق
        </Badge>;
      case 'completed':
        return <Badge variant="default" className="flex items-center gap-1 bg-green-600">
          <CheckCircle className="w-3 h-3" />
          مكتمل
        </Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentFrequencyText = (frequency: string) => {
    switch (frequency) {
      case 'monthly': return 'شهري';
      case 'quarterly': return 'ربع سنوي';
      case 'yearly': return 'سنوي';
      default: return frequency;
    }
  };

  const totalAmount = payments.reduce((sum: number, payment: DeferredPayment) => sum + payment.totalAmount, 0);
  const totalPaid = payments.reduce((sum: number, payment: DeferredPayment) => sum + payment.paidAmount, 0);
  const totalRemaining = payments.reduce((sum: number, payment: DeferredPayment) => sum + payment.remainingAmount, 0);

  // مكون لعرض تفاصيل المستحق - moved outside component
  function PaymentDetailsDialog({ payment }: { payment: DeferredPayment }) {
    const [paymentDetails, setPaymentDetails] = useState<any[]>([]);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);

    useEffect(() => {
      if (payment?.id) {
        setIsLoadingDetails(true);
        fetch(`/api/deferred-payments/${payment.id}/details`)
          .then(response => response.json())
          .then(data => {
            setPaymentDetails(data || []);
          })
          .catch(error => {
            console.error('Error fetching payment details:', error);
            setPaymentDetails([]);
          })
          .finally(() => {
            setIsLoadingDetails(false);
          });
      }
    }, [payment?.id]);

    return (
      <div className="space-y-4">
        {/* معلومات المستحق */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div>
            <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">المبلغ الإجمالي</Label>
            <p className="text-lg font-bold">{formatCurrency(payment.totalAmount)}</p>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">المبلغ المدفوع</Label>
            <p className="text-lg font-bold text-green-600">{formatCurrency(payment.paidAmount)}</p>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">المبلغ المتبقي</Label>
            <p className="text-lg font-bold text-orange-600">{formatCurrency(payment.remainingAmount)}</p>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">الحالة</Label>
            <div>{getStatusBadge(payment.status)}</div>
          </div>
          {payment.projectName && (
            <div>
              <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">المشروع</Label>
              <p className="font-medium">{payment.projectName}</p>
            </div>
          )}
          {payment.dueDate && (
            <div>
              <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">تاريخ الاستحقاق</Label>
              <p className="font-medium">{format(new Date(payment.dueDate), 'yyyy/MM/dd', { locale: ar })}</p>
            </div>
          )}
        </div>

        {/* تفاصيل الدفعات */}
        <div>
          <h4 className="text-lg font-semibold mb-3">سجل الدفعات</h4>
          {isLoadingDetails ? (
            <div className="text-center py-4">جاري تحميل التفاصيل...</div>
          ) : paymentDetails.length === 0 ? (
            <div className="text-center py-4 text-gray-500">لا توجد دفعات مسجلة بعد</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>المبلغ</TableHead>
                  <TableHead>الوصف</TableHead>
                  <TableHead>رقم المعاملة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentDetails.map((detail: any, index: number) => (
                  <TableRow key={index}>
                    <TableCell>
                      {detail.date ? format(new Date(detail.date), 'yyyy/MM/dd', { locale: ar }) : 'غير محدد'}
                    </TableCell>
                    <TableCell className="font-medium text-green-600">
                      {formatCurrency(detail.amount || 0)}
                    </TableCell>
                    <TableCell>{detail.description || 'بدون وصف'}</TableCell>
                    <TableCell>{detail.transactionId || 'غير مرتبط'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {payment.description && (
          <div>
            <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">الوصف</Label>
            <p className="mt-1 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">{payment.description}</p>
          </div>
        )}

        {payment.notes && (
          <div>
            <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">ملاحظات</Label>
            <p className="mt-1 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">{payment.notes}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      {/* العنوان */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[hsl(var(--primary))] flex items-center gap-3">
            <Clock className="text-[hsl(var(--primary))]" />
            المستحقات المؤجلة
          </h1>
          <p className="text-[hsl(var(--muted-foreground))] mt-2">
            إدارة المستحقات والدفعات المؤجلة
          </p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              إضافة مستحق جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>إضافة مستحق جديد</DialogTitle>
              <DialogDescription>
                أدخل تفاصيل المستحق المؤجل الجديد
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="beneficiaryName">اسم المستفيد *</Label>
                <Input
                  id="beneficiaryName"
                  value={formData.beneficiaryName}
                  onChange={(e) => setFormData({...formData, beneficiaryName: e.target.value})}
                  placeholder="أدخل اسم المستفيد"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="totalAmount">المبلغ الإجمالي *</Label>
                <Input
                  id="totalAmount"
                  type="number"
                  value={formData.totalAmount}
                  onChange={(e) => setFormData({...formData, totalAmount: e.target.value})}
                  placeholder="أدخل المبلغ بالدينار العراقي"
                  required
                />
              </div>

              <div>
                <Label htmlFor="projectId">المشروع</Label>
                <Select
                  value={formData.projectId}
                  onValueChange={(value) => setFormData({...formData, projectId: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر المشروع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">بدون مشروع</SelectItem>
                    {projects.map((project: Project) => (
                      <SelectItem key={project.id} value={project.id.toString()}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="dueDate">تاريخ الاستحقاق</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="installments">عدد الأقساط</Label>
                  <Input
                    id="installments"
                    type="number"
                    min="1"
                    value={formData.installments}
                    onChange={(e) => setFormData({...formData, installments: e.target.value})}
                  />
                </div>
                
                <div>
                  <Label htmlFor="paymentFrequency">تكرار الدفع</Label>
                  <Select
                    value={formData.paymentFrequency}
                    onValueChange={(value) => setFormData({...formData, paymentFrequency: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">شهري</SelectItem>
                      <SelectItem value="quarterly">ربع سنوي</SelectItem>
                      <SelectItem value="yearly">سنوي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="description">الوصف</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="وصف المستحق"
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="notes">ملاحظات</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="ملاحظات إضافية"
                  rows={2}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" disabled={addPaymentMutation.isPending} className="flex-1">
                  {addPaymentMutation.isPending ? 'جاري الإضافة...' : 'إضافة المستحق'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  إلغاء
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* الإحصائيات */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <DollarSign className="w-4 h-4" />
              إجمالي المستحقات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(totalAmount)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <CheckCircle className="w-4 h-4" />
              المبلغ المدفوع
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totalPaid)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertCircle className="w-4 h-4" />
              المبلغ المتبقي
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(totalRemaining)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4" />
              عدد المستفيدين
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {payments.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* جدول المستحقات */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            قائمة المستحقات
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">جاري التحميل...</div>
          ) : payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              لا توجد مستحقات مسجلة
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المستفيد</TableHead>
                    <TableHead>المبلغ الإجمالي</TableHead>
                    <TableHead>المدفوع</TableHead>
                    <TableHead>المتبقي</TableHead>
                    <TableHead>المشروع</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>تاريخ الاستحقاق</TableHead>
                    <TableHead>الأقساط</TableHead>
                    <TableHead>التكرار</TableHead>
                    <TableHead>الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment: DeferredPayment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">
                        {payment.beneficiaryName}
                      </TableCell>
                      <TableCell>{formatCurrency(payment.totalAmount)}</TableCell>
                      <TableCell className="text-green-600">
                        {formatCurrency(payment.paidAmount)}
                      </TableCell>
                      <TableCell className="text-orange-600">
                        {formatCurrency(payment.remainingAmount)}
                      </TableCell>
                      <TableCell>
                        {payment.projectName || 'غير محدد'}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(payment.status)}
                      </TableCell>
                      <TableCell>
                        {payment.dueDate ? format(new Date(payment.dueDate), 'yyyy/MM/dd', { locale: ar }) : 'غير محدد'}
                      </TableCell>
                      <TableCell>{payment.installments}</TableCell>
                      <TableCell>{getPaymentFrequencyText(payment.paymentFrequency)}</TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedPayment(payment)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>تفاصيل المستحق - {payment.beneficiaryName}</DialogTitle>
                              <DialogDescription>
                                معلومات تفصيلية عن المستحق والدفعات المسددة
                              </DialogDescription>
                            </DialogHeader>
                            <PaymentDetailsDialog payment={payment} />
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}