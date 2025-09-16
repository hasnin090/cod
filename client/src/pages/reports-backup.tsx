import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BookOpen, Download, Search, Calculator, FileSpreadsheet, Eye, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { apiRequest } from '@/lib/queryClient'
import type { Transaction, Project, User } from '@/types'

// دوال مساعدة منظمة
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('ar-IQ', {
    style: 'currency',
    currency: 'IQD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount).replace('د.ع.', '').trim() + ' د.ع';
};

// دالة موحدة للحصول على نوع الحساب المحاسبي للمعاملة
const getTransactionAccountType = (transaction: any, expenseTypes: any, ledgerEntries: any): string => {
  const expenseTypesArray = Array.isArray(expenseTypes) ? expenseTypes : [];
  const ledgerEntriesArray = Array.isArray(ledgerEntries) ? ledgerEntries : [];
  
  const ledgerEntry = ledgerEntriesArray.find((entry: any) => 
    entry.transactionId === transaction.id || entry.transaction_id === transaction.id
  );
  
  if (ledgerEntry && (ledgerEntry.expenseTypeId || ledgerEntry.expense_type_id)) {
    const expenseTypeId = ledgerEntry.expenseTypeId || ledgerEntry.expense_type_id;
    const expenseType = expenseTypesArray.find((type: any) => type.id === expenseTypeId);
    if (expenseType) {
      return expenseType.name;
    }
  }
  
  // إرجاع نوع حسب نوع المعاملة إذا لم تكن مصنفة
  return transaction.type === 'income' ? 'إيرادات غير مصنفة' : 'مصروفات غير مصنفة';
};

export default function Reports() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // حالات الفلترة والتبويب
  const [activeTab, setActiveTab] = useState('ledger');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [selectedAccountType, setSelectedAccountType] = useState<string>('all');
  const [dialogAccountType, setDialogAccountType] = useState<string | null>(null);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);

  // طلبات البيانات الأساسية
  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ['/api/transactions']
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects']
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users']
  });

  const { data: expenseTypes = [] } = useQuery({
    queryKey: ["/api/expense-types"],
  });

  const { data: ledgerEntries = [] } = useQuery({
    queryKey: ["/api/ledger"],
  });

  const { data: deferredPayments = [] } = useQuery({
    queryKey: ["/api/deferred-payments"],
  });

  // إعادة تصنيف المعاملات
  const reclassifyTransactionsMutation = useMutation({
    mutationFn: () => apiRequest("/api/ledger/reclassify-transactions", "POST", {}),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ledger"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({ 
        title: "تم إعادة التصنيف بنجاح", 
        description: `تم إعادة تصنيف ${data.summary.reclassified} معاملة` 
      });
    },
    onError: () => {
      toast({ title: "خطأ", description: "حدث خطأ أثناء إعادة تصنيف المعاملات", variant: "destructive" });
    },
  });

  // فلترة جميع المعاملات (مصنفة وغير مصنفة)
  const filteredTransactions = useMemo(() => {
    return transactions.filter(transaction => {
      const matchesSearch = (transaction.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          transaction.amount.toString().includes(searchQuery);
      
      const matchesProject = selectedProject === 'all' || transaction.projectId?.toString() === selectedProject;
      
      const transactionDate = new Date(transaction.date);
      const now = new Date();
      let matchesDate = true;
      
      if (dateFilter === 'today') {
        matchesDate = transactionDate.toDateString() === now.toDateString();
      } else if (dateFilter === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        matchesDate = transactionDate >= weekAgo;
      } else if (dateFilter === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        matchesDate = transactionDate >= monthAgo;
      }

      const accountType = getTransactionAccountType(transaction, expenseTypes, ledgerEntries);
      const matchesAccountType = selectedAccountType === 'all' || accountType === selectedAccountType;
      
      return matchesSearch && matchesProject && matchesDate && matchesAccountType;
    });
  }, [transactions, searchQuery, selectedProject, dateFilter, selectedAccountType, expenseTypes, ledgerEntries]);

  // تجميع الحسابات حسب النوع
  const accountSummary = useMemo(() => {
    const summary: Record<string, { transactions: Transaction[], total: number, count: number }> = {};
    
    // إضافة جميع أنواع المصروفات من قاعدة البيانات
    if (Array.isArray(expenseTypes)) {
      (expenseTypes as any[]).forEach((expenseType: any) => {
        const typeName = expenseType.name;
        if (!summary[typeName]) {
          summary[typeName] = {
            transactions: [],
            total: 0,
            count: 0
          };
        }
      });
    }
    
    // تجميع المعاملات حسب نوع الحساب
    filteredTransactions.forEach(transaction => {
      const accountType = getTransactionAccountType(transaction, expenseTypes, ledgerEntries);
      
      if (!summary[accountType]) {
        summary[accountType] = {
          transactions: [],
          total: 0,
          count: 0
        };
      }
      
      summary[accountType].transactions.push(transaction);
      summary[accountType].total += transaction.amount;
      summary[accountType].count += 1;
    });
    
    return summary;
  }, [filteredTransactions, expenseTypes, ledgerEntries]);

  // حساب الإحصائيات
  const stats = useMemo(() => {
    const totalIncome = filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalExpenses = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const netBalance = totalIncome - totalExpenses;
    
    return {
      totalIncome,
      totalExpenses,
      netBalance,
      transactionCount: filteredTransactions.length
    };
  }, [filteredTransactions]);

  // فلترة المعاملات لحساب معين
  const getTransactionsByAccountType = useCallback((accountType: string) => {
    return filteredTransactions.filter(transaction => {
      const transactionAccountType = getTransactionAccountType(transaction, expenseTypes, ledgerEntries);
      return transactionAccountType === accountType;
    });
  }, [filteredTransactions, expenseTypes, ledgerEntries]);

  // فتح حوار المعاملات لنوع حساب معين
  const openAccountDialog = (accountType: string) => {
    setDialogAccountType(accountType);
    setAccountDialogOpen(true);
  };

  // فحص الصلاحيات
  if (!user || user.role !== 'admin') {
    return (
      <div className="w-full max-w-full overflow-x-hidden">
        <div className="py-4 md:py-6 px-3 md:px-4 pb-mobile-nav-large">
          <Card className="text-center p-8">
            <CardContent>
              <BookOpen className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-bold text-muted-foreground mb-2">دفتر الأستاذ العام</h2>
              <p className="text-muted-foreground">هذا القسم مخصص للمديرين فقط</p>
              <p className="text-sm text-muted-foreground mt-2">يحتوي على معلومات مالية حساسة وتحليلات شاملة</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="py-4 md:py-6 px-3 md:px-4 pb-mobile-nav-large">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-[hsl(var(--primary))] flex items-center gap-2 md:gap-3">
            <Calculator className="text-[hsl(var(--primary))] w-6 h-6 md:w-8 md:h-8" />
            دفتر الأستاذ العام
          </h1>
          <p className="text-[hsl(var(--muted-foreground))] mt-2 text-sm md:text-base">تصنيف محاسبي شامل للحسابات والمعاملات المالية</p>
        </div>

        {/* إحصائيات سريعة */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
          <Card className="p-3 md:p-4">
            <CardContent className="p-0">
              <div className="text-xs md:text-sm text-muted-foreground">إجمالي المعاملات</div>
              <div className="text-lg md:text-xl font-bold text-primary">{stats.transactionCount}</div>
            </CardContent>
          </Card>
          <Card className="p-3 md:p-4">
            <CardContent className="p-0">
              <div className="text-xs md:text-sm text-muted-foreground">الإيرادات</div>
              <div className="text-lg md:text-xl font-bold text-green-600">{formatCurrency(stats.totalIncome)}</div>
            </CardContent>
          </Card>
          <Card className="p-3 md:p-4">
            <CardContent className="p-0">
              <div className="text-xs md:text-sm text-muted-foreground">المصروفات</div>
              <div className="text-lg md:text-xl font-bold text-red-600">{formatCurrency(stats.totalExpenses)}</div>
            </CardContent>
          </Card>
          <Card className="p-3 md:p-4">
            <CardContent className="p-0">
              <div className="text-xs md:text-sm text-muted-foreground">الرصيد الصافي</div>
              <div className={`text-lg md:text-xl font-bold ${stats.netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(stats.netBalance)}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="ledger" className="text-xs md:text-sm">دفتر الأستاذ</TabsTrigger>
            <TabsTrigger value="summary" className="text-xs md:text-sm">ملخص الحسابات</TabsTrigger>
            <TabsTrigger value="details" className="text-xs md:text-sm">التفاصيل</TabsTrigger>
          </TabsList>

          {/* أدوات الفلترة */}
          <div className="bg-gradient-to-r from-muted/20 to-muted/10 rounded-lg p-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="البحث في الوصف أو المبلغ..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10"
                />
              </div>
              
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger>
                  <SelectValue placeholder="جميع المشاريع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع المشاريع</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="الفترة الزمنية" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الفترات</SelectItem>
                  <SelectItem value="today">اليوم</SelectItem>
                  <SelectItem value="week">آخر أسبوع</SelectItem>
                  <SelectItem value="month">آخر شهر</SelectItem>
                </SelectContent>
              </Select>

              <Button 
                onClick={() => reclassifyTransactionsMutation.mutate()}
                disabled={reclassifyTransactionsMutation.isPending}
                className="w-full"
              >
                <RefreshCw className="w-4 h-4 ml-2" />
                إعادة تصنيف
              </Button>
            </div>
          </div>

          {/* محتوى التبويبات */}
          <TabsContent value="ledger" className="mt-6">
            <div className="grid gap-4">
              {Object.entries(accountSummary).map(([accountType, data]) => (
                <Card key={accountType} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openAccountDialog(accountType)}>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-lg">{accountType}</CardTitle>
                      <Badge variant="secondary">{data.count} معاملة</Badge>
                    </div>
                    <CardDescription>
                      إجمالي: {formatCurrency(data.total)}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="summary" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>ملخص الحسابات المحاسبية</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">نوع الحساب</TableHead>
                      <TableHead className="text-right">عدد المعاملات</TableHead>
                      <TableHead className="text-right">إجمالي المبلغ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(accountSummary).map(([accountType, data]) => (
                      <TableRow key={accountType}>
                        <TableCell className="font-medium">{accountType}</TableCell>
                        <TableCell>{data.count}</TableCell>
                        <TableCell>{formatCurrency(data.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="details" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>تفاصيل جميع المعاملات</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">الوصف</TableHead>
                      <TableHead className="text-right">النوع</TableHead>
                      <TableHead className="text-right">المبلغ</TableHead>
                      <TableHead className="text-right">نوع الحساب</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map((transaction) => {
                      const accountType = getTransactionAccountType(transaction, expenseTypes, ledgerEntries);
                      return (
                        <TableRow key={transaction.id}>
                          <TableCell>
                            {format(new Date(transaction.date), 'yyyy/MM/dd', { locale: ar })}
                          </TableCell>
                          <TableCell>{transaction.description}</TableCell>
                          <TableCell>
                            <Badge variant={transaction.type === 'income' ? 'default' : 'destructive'}>
                              {transaction.type === 'income' ? 'إيراد' : 'مصروف'}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatCurrency(transaction.amount)}</TableCell>
                          <TableCell>{accountType}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* حوار تفاصيل نوع الحساب */}
        <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
          <DialogContent size="xl" className="max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>تفاصيل حساب: {dialogAccountType}</DialogTitle>
              <DialogDescription>
                عرض جميع المعاملات المصنفة تحت هذا النوع من الحسابات المحاسبية
              </DialogDescription>
            </DialogHeader>
            {dialogAccountType && (
              <div className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">الوصف</TableHead>
                      <TableHead className="text-right">المبلغ</TableHead>
                      <TableHead className="text-right">المشروع</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getTransactionsByAccountType(dialogAccountType).map((transaction) => {
                      const project = projects.find(p => p.id === transaction.projectId);
                      return (
                        <TableRow key={transaction.id}>
                          <TableCell>
                            {format(new Date(transaction.date), 'yyyy/MM/dd', { locale: ar })}
                          </TableCell>
                          <TableCell>{transaction.description}</TableCell>
                          <TableCell>{formatCurrency(transaction.amount)}</TableCell>
                          <TableCell>{project?.name || 'الصندوق الرئيسي'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}