import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { TransactionForm } from '@/components/transaction-form';
import { TransactionList } from '@/components/transaction-list';
import { useCacheManager } from '@/hooks/use-cache-manager';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  DollarSign, Plus, Filter, Search, Download, FileSpreadsheet, 
  TrendingUp, TrendingDown, Eye, Calendar, Archive, Users,
  BarChart3, Wallet, Target, AlertCircle, CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { formatCurrency } from '@/lib/chart-utils';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

interface Transaction {
  id: number;
  date: string;
  amount: number;
  type: string;
  description: string;
  projectId?: number;
  expenseType?: string;
  createdBy: number;
  archived: boolean;
}

interface Project {
  id: number;
  name: string;
}

interface Filter {
  projectId?: number;
  type?: string;
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
}

export default function Transactions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { refreshTransactions } = useCacheManager();
  
  // حالات الفلترة والعرض
  const [filter, setFilter] = useState<Filter>({});
  const [activeTab, setActiveTab] = useState<'overview' | 'all' | 'income' | 'expense'>('overview');
  const [selectedTransactions, setSelectedTransactions] = useState<number[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  // جلب البيانات
  const { data: transactions, isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: ['/api/transactions'],
    queryFn: async () => {
      const response = await fetch('/api/transactions');
      if (!response.ok) throw new Error('فشل في جلب المعاملات');
      return response.json();
    },
  });

  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
    queryFn: async () => {
      const response = await fetch('/api/projects');
      if (!response.ok) throw new Error('فشل في جلب المشاريع');
      return response.json();
    },
  });

  // تصفية البيانات
  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    
    return transactions.filter(transaction => {
      // فلترة حسب الأرشيف
      if (transaction.archived !== showArchived) return false;
      
      // فلترة حسب النوع
      if (filter.type && transaction.type !== filter.type) return false;
      
      // فلترة حسب المشروع
      if (filter.projectId && transaction.projectId !== filter.projectId) return false;
      
      // فلترة حسب البحث
      if (filter.searchQuery) {
        const searchTerm = filter.searchQuery.toLowerCase();
        const matchesDescription = transaction.description.toLowerCase().includes(searchTerm);
        const matchesAmount = transaction.amount.toString().includes(searchTerm);
        if (!matchesDescription && !matchesAmount) return false;
      }
      
      // فلترة حسب التاريخ
      if (filter.startDate && new Date(transaction.date) < new Date(filter.startDate)) return false;
      if (filter.endDate && new Date(transaction.date) > new Date(filter.endDate)) return false;
      
      return true;
    });
  }, [transactions, filter, showArchived]);

  // إحصائيات
  const statistics = useMemo(() => {
    if (!filteredTransactions.length) {
      return { totalIncome: 0, totalExpenses: 0, netAmount: 0, transactionCount: 0 };
    }

    const income = filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const expenses = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      totalIncome: income,
      totalExpenses: expenses,
      netAmount: income - expenses,
      transactionCount: filteredTransactions.length
    };
  }, [filteredTransactions]);

  // إضافة معاملة جديدة
  const handleFormSubmit = () => {
    refreshTransactions();
    toast({
      title: "تم الحفظ بنجاح",
      description: "تم إضافة المعاملة الجديدة بنجاح",
    });
  };

  // تصدير البيانات
  const exportMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/transactions/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filter, transactions: filteredTransactions }),
      });
      if (!response.ok) throw new Error('فشل في تصدير البيانات');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transactions_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast({
        title: "تم التصدير بنجاح",
        description: "تم تحميل ملف البيانات بنجاح",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "خطأ في التصدير",
        description: "فشل في تصدير البيانات",
      });
    },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* الهيدر الرئيسي */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-primary/10 p-3 rounded-xl">
                <DollarSign className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  إدارة الحسابات
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  إدارة ومتابعة جميع العمليات المالية والمعاملات النقدية
                </p>
              </div>
            </div>
            
            {user?.role !== 'viewer' && (
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => exportMutation.mutate()}
                  variant="outline"
                  size="lg"
                  disabled={exportMutation.isPending}
                  className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                >
                  <FileSpreadsheet className="h-5 w-5 ml-2" />
                  {exportMutation.isPending ? 'جاري التصدير...' : 'تصدير البيانات'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* إحصائيات سريعة */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700">إجمالي الإيرادات</p>
                  <p className="text-2xl font-bold text-green-900">
                    {formatCurrency(statistics.totalIncome)}
                  </p>
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
                  <p className="text-2xl font-bold text-red-900">
                    {formatCurrency(statistics.totalExpenses)}
                  </p>
                </div>
                <div className="bg-red-200 p-3 rounded-full">
                  <TrendingDown className="h-6 w-6 text-red-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-700">صافي المبلغ</p>
                  <p className={`text-2xl font-bold ${
                    statistics.netAmount >= 0 ? 'text-green-900' : 'text-red-900'
                  }`}>
                    {formatCurrency(statistics.netAmount)}
                  </p>
                </div>
                <div className="bg-blue-200 p-3 rounded-full">
                  <Wallet className="h-6 w-6 text-blue-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-700">عدد المعاملات</p>
                  <p className="text-2xl font-bold text-purple-900">
                    {statistics.transactionCount}
                  </p>
                </div>
                <div className="bg-purple-200 p-3 rounded-full">
                  <BarChart3 className="h-6 w-6 text-purple-700" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* نموذج إضافة معاملة جديدة */}
        {user?.role !== 'viewer' && (
          <Card className="mb-8 shadow-lg border-primary/20">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b border-primary/20">
              <CardTitle className="flex items-center gap-3 text-xl text-primary">
                <Plus className="h-6 w-6" />
                إضافة معاملة جديدة
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <TransactionForm 
                projects={projects || []} 
                onSubmit={handleFormSubmit} 
                isLoading={projectsLoading}
              />
            </CardContent>
          </Card>
        )}

        {/* قسم البحث والفلترة */}
        <Card className="mb-8 shadow-lg">
          <CardHeader className="bg-gray-50 border-b border-gray-200">
            <CardTitle className="flex items-center gap-3 text-xl text-gray-900">
              <Filter className="h-6 w-6" />
              البحث والفلترة
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* البحث */}
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="البحث في الوصف أو المبلغ..."
                  value={filter.searchQuery || ''}
                  onChange={(e) => setFilter({ ...filter, searchQuery: e.target.value })}
                  className="pr-10"
                />
              </div>

              {/* نوع المعاملة */}
              <Select
                value={filter.type || 'all'}
                onValueChange={(value) => setFilter({ ...filter, type: value === 'all' ? undefined : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="نوع المعاملة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الأنواع</SelectItem>
                  <SelectItem value="income">إيرادات</SelectItem>
                  <SelectItem value="expense">مصروفات</SelectItem>
                </SelectContent>
              </Select>

              {/* المشروع */}
              <Select
                value={filter.projectId?.toString() || 'all'}
                onValueChange={(value) => setFilter({ 
                  ...filter, 
                  projectId: value === 'all' ? undefined : parseInt(value) 
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="المشروع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع المشاريع</SelectItem>
                  {projects?.map((project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* عرض المؤرشف */}
              <div className="flex items-center gap-2">
                <Button
                  variant={showArchived ? "default" : "outline"}
                  onClick={() => setShowArchived(!showArchived)}
                  className="w-full"
                >
                  <Archive className="h-4 w-4 ml-2" />
                  {showArchived ? 'إخفاء المؤرشف' : 'عرض المؤرشف'}
                </Button>
              </div>
            </div>

            {/* عرض الفلاتر النشطة */}
            {(filter.searchQuery || filter.type || filter.projectId || showArchived) && (
              <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-gray-200">
                <span className="text-sm font-medium text-gray-700">الفلاتر النشطة:</span>
                
                {filter.searchQuery && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    البحث: {filter.searchQuery}
                  </Badge>
                )}
                
                {filter.type && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    النوع: {filter.type === 'income' ? 'إيرادات' : 'مصروفات'}
                  </Badge>
                )}
                
                {filter.projectId && (
                  <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                    المشروع: {projects?.find(p => p.id === filter.projectId)?.name}
                  </Badge>
                )}
                
                {showArchived && (
                  <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                    المؤرشف
                  </Badge>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilter({});
                    setShowArchived(false);
                  }}
                  className="text-red-600 hover:bg-red-50"
                >
                  مسح الفلاتر
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* التبويبات والمحتوى */}
        <Card className="shadow-lg">
          <CardHeader className="bg-white border-b border-gray-200">
            <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)}>
              <TabsList className="grid w-full grid-cols-4 bg-gray-100">
                <TabsTrigger 
                  value="overview" 
                  className="data-[state=active]:bg-white data-[state=active]:text-primary"
                >
                  <Eye className="h-4 w-4 ml-2" />
                  نظرة عامة
                </TabsTrigger>
                <TabsTrigger 
                  value="all"
                  className="data-[state=active]:bg-white data-[state=active]:text-primary"
                >
                  <BarChart3 className="h-4 w-4 ml-2" />
                  جميع المعاملات
                </TabsTrigger>
                <TabsTrigger 
                  value="income"
                  className="data-[state=active]:bg-white data-[state=active]:text-green-600"
                >
                  <TrendingUp className="h-4 w-4 ml-2" />
                  الإيرادات
                </TabsTrigger>
                <TabsTrigger 
                  value="expense"
                  className="data-[state=active]:bg-white data-[state=active]:text-red-600"
                >
                  <TrendingDown className="h-4 w-4 ml-2" />
                  المصروفات
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)}>
              <TabsContent value="overview" className="p-6">
                <div className="space-y-6">
                  {/* مؤشرات الأداء */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 rounded-lg border border-emerald-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-emerald-700">معدل النمو</p>
                          <p className="text-lg font-bold text-emerald-900">+12.5%</p>
                        </div>
                        <TrendingUp className="h-8 w-8 text-emerald-600" />
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-4 rounded-lg border border-amber-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-amber-700">معاملات هذا الشهر</p>
                          <p className="text-lg font-bold text-amber-900">{statistics.transactionCount}</p>
                        </div>
                        <Calendar className="h-8 w-8 text-amber-600" />
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 p-4 rounded-lg border border-cyan-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-cyan-700">الوضع المالي</p>
                          <p className="text-lg font-bold text-cyan-900">
                            {statistics.netAmount >= 0 ? 'مستقر' : 'يحتاج مراجعة'}
                          </p>
                        </div>
                        {statistics.netAmount >= 0 ? 
                          <CheckCircle2 className="h-8 w-8 text-cyan-600" /> :
                          <AlertCircle className="h-8 w-8 text-cyan-600" />
                        }
                      </div>
                    </div>
                  </div>

                  {/* قائمة المعاملات الأخيرة */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">آخر المعاملات</h3>
                    <TransactionList 
                      transactions={filteredTransactions.slice(0, 10)} 
                      projects={projects || []}
                      onTransactionUpdate={refreshTransactions}
                      isLoading={transactionsLoading}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="all" className="p-6">
                <TransactionList 
                  transactions={filteredTransactions} 
                  projects={projects || []}
                  onTransactionUpdate={refreshTransactions}
                  isLoading={transactionsLoading}
                />
              </TabsContent>

              <TabsContent value="income" className="p-6">
                <TransactionList 
                  transactions={filteredTransactions.filter(t => t.type === 'income')} 
                  projects={projects || []}
                  onTransactionUpdate={refreshTransactions}
                  isLoading={transactionsLoading}
                />
              </TabsContent>

              <TabsContent value="expense" className="p-6">
                <TransactionList 
                  transactions={filteredTransactions.filter(t => t.type === 'expense')} 
                  projects={projects || []}
                  onTransactionUpdate={refreshTransactions}
                  isLoading={transactionsLoading}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}