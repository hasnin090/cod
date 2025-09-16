import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { 
  BookOpen, Download, Search, Calculator, FileSpreadsheet, Eye, RefreshCw,
  TrendingUp, TrendingDown, DollarSign, PieChart, BarChart3, Filter,
  Calendar, Building, Users, Target, AlertCircle, CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/queryClient';
import type { Transaction, Project, User } from '@/types';

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
  
  return transaction.type === 'income' ? 'إيرادات غير مصنفة' : 'مصروفات غير مصنفة';
};

export default function Reports() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // حالات الفلترة والتبويب
  const [activeTab, setActiveTab] = useState('overview');
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

  // حساب الإحصائيات المحسنة
  const stats = useMemo(() => {
    const totalIncome = filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalExpenses = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const netBalance = totalIncome - totalExpenses;
    
    // حساب النمو الشهري (مقارنة مع الشهر الماضي)
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const currentMonthTransactions = filteredTransactions.filter(t => {
      const tDate = new Date(t.date);
      return tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
    });
    
    const lastMonthTransactions = filteredTransactions.filter(t => {
      const tDate = new Date(t.date);
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      return tDate.getMonth() === lastMonth && tDate.getFullYear() === lastMonthYear;
    });
    
    const currentMonthIncome = currentMonthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const lastMonthIncome = lastMonthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const incomeGrowth = lastMonthIncome > 0 ? 
      ((currentMonthIncome - lastMonthIncome) / lastMonthIncome) * 100 : 0;
    
    return {
      totalIncome,
      totalExpenses,
      netBalance,
      transactionCount: filteredTransactions.length,
      incomeGrowth,
      currentMonthIncome,
      lastMonthIncome,
      averageTransactionAmount: filteredTransactions.length > 0 ? 
        (totalIncome + totalExpenses) / filteredTransactions.length : 0
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4 text-center shadow-lg">
          <CardContent className="p-8">
            <div className="bg-red-100 p-4 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">دفتر الأستاذ العام</h2>
            <p className="text-gray-600 mb-2">هذا القسم مخصص للمديرين فقط</p>
            <p className="text-sm text-gray-500">يحتوي على معلومات مالية حساسة وتحليلات شاملة</p>
            <div className="mt-6 pt-6 border-t border-gray-200">
              <BookOpen className="w-8 h-8 mx-auto text-gray-400 mb-2" />
              <p className="text-xs text-gray-400">قسم محمي بصلاحيات إدارية</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* الهيدر الرئيسي */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-primary/10 p-3 rounded-xl">
                <Calculator className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  دفتر الأستاذ العام
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  تصنيف محاسبي شامل للحسابات والمعاملات المالية
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 ml-2" />
                تصدير PDF
              </Button>
              <Button variant="outline" size="sm">
                <FileSpreadsheet className="h-4 w-4 ml-2" />
                تصدير Excel
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* إحصائيات محسنة */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-700">إجمالي المعاملات</p>
                  <p className="text-2xl font-bold text-blue-900">{stats.transactionCount}</p>
                  <p className="text-xs text-blue-600 mt-1">
                    متوسط المبلغ: {formatCurrency(stats.averageTransactionAmount)}
                  </p>
                </div>
                <div className="bg-blue-200 p-3 rounded-full">
                  <BarChart3 className="h-6 w-6 text-blue-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700">إجمالي الإيرادات</p>
                  <p className="text-2xl font-bold text-green-900">{formatCurrency(stats.totalIncome)}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {stats.incomeGrowth >= 0 ? (
                      <TrendingUp className="h-3 w-3 text-green-600" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-600" />
                    )}
                    <span className={`text-xs ${stats.incomeGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {Math.abs(stats.incomeGrowth).toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="bg-green-200 p-3 rounded-full">
                  <TrendingUp className="h-6 w-6 text-green-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-700">إجمالي المصروفات</p>
                  <p className="text-2xl font-bold text-red-900">{formatCurrency(stats.totalExpenses)}</p>
                  <p className="text-xs text-red-600 mt-1">
                    نسبة للإيرادات: {stats.totalIncome > 0 ? ((stats.totalExpenses / stats.totalIncome) * 100).toFixed(1) : 0}%
                  </p>
                </div>
                <div className="bg-red-200 p-3 rounded-full">
                  <TrendingDown className="h-6 w-6 text-red-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-700">الرصيد الصافي</p>
                  <p className={`text-2xl font-bold ${stats.netBalance >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                    {formatCurrency(stats.netBalance)}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    {stats.netBalance >= 0 ? (
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                    ) : (
                      <AlertCircle className="h-3 w-3 text-red-600" />
                    )}
                    <span className={`text-xs ${stats.netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {stats.netBalance >= 0 ? 'ربح' : 'خسارة'}
                    </span>
                  </div>
                </div>
                <div className="bg-purple-200 p-3 rounded-full">
                  <DollarSign className="h-6 w-6 text-purple-700" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* أدوات الفلترة المحسنة */}
        <Card className="mb-8 shadow-lg">
          <CardHeader className="bg-gray-50 border-b border-gray-200">
            <CardTitle className="flex items-center gap-3 text-xl text-gray-900">
              <Filter className="h-6 w-6" />
              البحث والفلترة المتقدمة
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
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

              <Select value={selectedAccountType} onValueChange={setSelectedAccountType}>
                <SelectTrigger>
                  <SelectValue placeholder="نوع الحساب" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع أنواع الحسابات</SelectItem>
                  {Object.keys(accountSummary).map((accountType) => (
                    <SelectItem key={accountType} value={accountType}>
                      {accountType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>النتائج المفلترة:</span>
                <Badge variant="secondary">{filteredTransactions.length} معاملة</Badge>
              </div>
              
              <Button 
                onClick={() => reclassifyTransactionsMutation.mutate()}
                disabled={reclassifyTransactionsMutation.isPending}
                className="bg-primary hover:bg-primary/90"
              >
                <RefreshCw className="w-4 h-4 ml-2" />
                إعادة تصنيف المعاملات
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* التبويبات المحسنة */}
        <Card className="shadow-lg">
          <CardHeader className="bg-white border-b border-gray-200">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4 bg-gray-100">
                <TabsTrigger 
                  value="overview" 
                  className="data-[state=active]:bg-white data-[state=active]:text-primary"
                >
                  <Eye className="h-4 w-4 ml-2" />
                  نظرة عامة
                </TabsTrigger>
                <TabsTrigger 
                  value="ledger"
                  className="data-[state=active]:bg-white data-[state=active]:text-primary"
                >
                  <BookOpen className="h-4 w-4 ml-2" />
                  دفتر الأستاذ
                </TabsTrigger>
                <TabsTrigger 
                  value="summary"
                  className="data-[state=active]:bg-white data-[state=active]:text-primary"
                >
                  <PieChart className="h-4 w-4 ml-2" />
                  ملخص الحسابات
                </TabsTrigger>
                <TabsTrigger 
                  value="details"
                  className="data-[state=active]:bg-white data-[state=active]:text-primary"
                >
                  <FileSpreadsheet className="h-4 w-4 ml-2" />
                  التفاصيل
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsContent value="overview" className="p-6">
                <div className="space-y-6">
                  {/* مؤشرات الأداء */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-gradient-to-br from-teal-50 to-teal-100 p-6 rounded-lg border border-teal-200">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-teal-900">معدل النمو الشهري</h3>
                        <TrendingUp className="h-6 w-6 text-teal-600" />
                      </div>
                      <div className="space-y-2">
                        <div className="text-2xl font-bold text-teal-900">
                          {stats.incomeGrowth >= 0 ? '+' : ''}{stats.incomeGrowth.toFixed(1)}%
                        </div>
                        <p className="text-sm text-teal-700">مقارنة بالشهر الماضي</p>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-6 rounded-lg border border-amber-200">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-amber-900">أنواع الحسابات</h3>
                        <PieChart className="h-6 w-6 text-amber-600" />
                      </div>
                      <div className="text-2xl font-bold text-amber-900">
                        {Object.keys(accountSummary).length}
                      </div>
                      <p className="text-sm text-amber-700">حساب محاسبي نشط</p>
                    </div>

                    <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-6 rounded-lg border border-indigo-200">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-indigo-900">متوسط المعاملة</h3>
                        <Calculator className="h-6 w-6 text-indigo-600" />
                      </div>
                      <div className="text-2xl font-bold text-indigo-900">
                        {formatCurrency(stats.averageTransactionAmount)}
                      </div>
                      <p className="text-sm text-indigo-700">لكل معاملة</p>
                    </div>
                  </div>

                  {/* أهم الحسابات */}
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      أهم الحسابات المحاسبية
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Object.entries(accountSummary)
                        .sort(([,a], [,b]) => Math.abs(b.total) - Math.abs(a.total))
                        .slice(0, 6)
                        .map(([accountType, data]) => (
                          <Card 
                            key={accountType} 
                            className="cursor-pointer hover:shadow-lg transition-shadow border-l-4 border-l-primary"
                            onClick={() => openAccountDialog(accountType)}
                          >
                            <CardHeader className="pb-3">
                              <CardTitle className="text-lg font-semibold text-gray-900 mb-1">
                                {accountType}
                              </CardTitle>
                              <div className="flex items-center justify-between">
                                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                                  {data.count} معاملة
                                </Badge>
                                <span className="text-sm font-bold text-gray-700">
                                  {formatCurrency(data.total)}
                                </span>
                              </div>
                            </CardHeader>
                            
                            <CardContent className="pt-0">
                              <div className="space-y-2">
                                <div className="flex justify-between items-center text-sm">
                                  <span className="text-gray-600">نسبة من الإجمالي</span>
                                  <span className="font-semibold">
                                    {((Math.abs(data.total) / (stats.totalIncome + stats.totalExpenses)) * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <Progress 
                                  value={(Math.abs(data.total) / (stats.totalIncome + stats.totalExpenses)) * 100} 
                                  className="h-2" 
                                />
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="ledger" className="p-6">
                <div className="grid gap-4">
                  {Object.entries(accountSummary).map(([accountType, data]) => (
                    <Card 
                      key={accountType} 
                      className="cursor-pointer hover:shadow-md transition-shadow border-r-4 border-r-primary" 
                      onClick={() => openAccountDialog(accountType)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-center">
                          <CardTitle className="text-lg font-semibold text-gray-900">{accountType}</CardTitle>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                              {data.count} معاملة
                            </Badge>
                            <Eye className="h-4 w-4 text-gray-400" />
                          </div>
                        </div>
                        <CardDescription className="text-lg font-bold text-primary">
                          إجمالي: {formatCurrency(data.total)}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="summary" className="p-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PieChart className="h-5 w-5" />
                      ملخص الحسابات المحاسبية
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">نوع الحساب</TableHead>
                          <TableHead className="text-right">عدد المعاملات</TableHead>
                          <TableHead className="text-right">إجمالي المبلغ</TableHead>
                          <TableHead className="text-right">النسبة المئوية</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(accountSummary)
                          .sort(([,a], [,b]) => Math.abs(b.total) - Math.abs(a.total))
                          .map(([accountType, data]) => (
                            <TableRow key={accountType} className="hover:bg-gray-50">
                              <TableCell className="font-medium">{accountType}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{data.count}</Badge>
                              </TableCell>
                              <TableCell className="font-bold">{formatCurrency(data.total)}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">
                                    {((Math.abs(data.total) / (stats.totalIncome + stats.totalExpenses)) * 100).toFixed(1)}%
                                  </span>
                                  <Progress 
                                    value={(Math.abs(data.total) / (stats.totalIncome + stats.totalExpenses)) * 100} 
                                    className="h-2 w-16" 
                                  />
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="details" className="p-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5" />
                      تفاصيل جميع المعاملات
                    </CardTitle>
                    <CardDescription>
                      عرض تفصيلي لجميع المعاملات مع تصنيفاتها المحاسبية
                    </CardDescription>
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
                          <TableHead className="text-right">المشروع</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTransactions.map((transaction) => {
                          const accountType = getTransactionAccountType(transaction, expenseTypes, ledgerEntries);
                          const project = projects.find(p => p.id === transaction.projectId);
                          return (
                            <TableRow key={transaction.id} className="hover:bg-gray-50">
                              <TableCell>
                                {format(new Date(transaction.date), 'yyyy/MM/dd', { locale: ar })}
                              </TableCell>
                              <TableCell className="max-w-xs truncate">{transaction.description}</TableCell>
                              <TableCell>
                                <Badge variant={transaction.type === 'income' ? 'default' : 'destructive'}>
                                  {transaction.type === 'income' ? 'إيراد' : 'مصروف'}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-bold">{formatCurrency(transaction.amount)}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="bg-blue-50 text-blue-700">
                                  {accountType}
                                </Badge>
                              </TableCell>
                              <TableCell>{project?.name || 'الصندوق الرئيسي'}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* حوار تفاصيل نوع الحساب */}
        <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <BookOpen className="h-5 w-5" />
                تفاصيل حساب: {dialogAccountType}
              </DialogTitle>
              <DialogDescription>
                عرض جميع المعاملات المصنفة تحت هذا النوع من الحسابات المحاسبية
              </DialogDescription>
            </DialogHeader>
            {dialogAccountType && (
              <div className="mt-4">
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-sm text-gray-600">عدد المعاملات</div>
                      <div className="text-lg font-bold text-primary">
                        {getTransactionsByAccountType(dialogAccountType).length}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">إجمالي المبلغ</div>
                      <div className="text-lg font-bold text-green-600">
                        {formatCurrency(
                          getTransactionsByAccountType(dialogAccountType)
                            .reduce((sum, t) => sum + t.amount, 0)
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">متوسط المعاملة</div>
                      <div className="text-lg font-bold text-blue-600">
                        {formatCurrency(
                          getTransactionsByAccountType(dialogAccountType).length > 0
                            ? getTransactionsByAccountType(dialogAccountType)
                                .reduce((sum, t) => sum + t.amount, 0) / 
                              getTransactionsByAccountType(dialogAccountType).length
                            : 0
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">الوصف</TableHead>
                      <TableHead className="text-right">النوع</TableHead>
                      <TableHead className="text-right">المبلغ</TableHead>
                      <TableHead className="text-right">المشروع</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getTransactionsByAccountType(dialogAccountType).map((transaction) => {
                      const project = projects.find(p => p.id === transaction.projectId);
                      return (
                        <TableRow key={transaction.id} className="hover:bg-gray-50">
                          <TableCell>
                            {format(new Date(transaction.date), 'yyyy/MM/dd', { locale: ar })}
                          </TableCell>
                          <TableCell className="max-w-xs">{transaction.description}</TableCell>
                          <TableCell>
                            <Badge variant={transaction.type === 'income' ? 'default' : 'destructive'}>
                              {transaction.type === 'income' ? 'إيراد' : 'مصروف'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-bold">{formatCurrency(transaction.amount)}</TableCell>
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