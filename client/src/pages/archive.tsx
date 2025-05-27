import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Archive, Search, Filter, Calendar, TrendingUp, TrendingDown, DollarSign, FileText, Download, Printer, Grid, List } from "lucide-react";
import * as XLSX from 'xlsx';
import { formatDate } from "@/utils/date-utils";

// دالة تنسيق العملة محلياً
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// تعريف أنواع البيانات للمعاملات المالية
interface ArchivedTransaction {
  id: number;
  type: string;
  amount: number;
  description: string;
  date: string;
  projectId?: number;
  userId: number;
  attachmentUrl?: string;
}

interface Project {
  id: number;
  name: string;
  description: string;
  startDate: string;
  status: string;
}

// تجميع المعاملات حسب الشهر
interface MonthlyGroup {
  month: string;
  year: number;
  transactions: ArchivedTransaction[];
  totalRevenue: number;
  totalExpense: number;
}

export default function ArchivePage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all'); // all, income, expense
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [viewType, setViewType] = useState<'cards' | 'table'>('cards');

  // جلب المعاملات المؤرشفة
  const { data: archivedTransactions = [], isLoading: transactionsLoading } = useQuery<ArchivedTransaction[]>({
    queryKey: ['/api/archive'],
    enabled: !!user,
  });

  // جلب المشاريع
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
    enabled: !!user,
  });

  // فلترة المعاملات المؤرشفة
  const filteredTransactions = useMemo(() => {
    let filtered = archivedTransactions;

    // فلترة حسب البحث النصي
    if (searchQuery) {
      const searchTerm = searchQuery.toLowerCase();
      filtered = filtered.filter(transaction => 
        transaction.description.toLowerCase().includes(searchTerm) ||
        projects.find(p => p.id === transaction.projectId)?.name.toLowerCase().includes(searchTerm)
      );
    }

    // فلترة حسب المشروع
    if (selectedProject !== 'all') {
      filtered = filtered.filter(transaction => 
        transaction.projectId === parseInt(selectedProject)
      );
    }

    // فلترة حسب نوع المعاملة
    if (selectedType !== 'all') {
      if (selectedType === 'income') {
        filtered = filtered.filter(transaction => transaction.type === 'income');
      } else if (selectedType === 'expense') {
        filtered = filtered.filter(transaction => transaction.type === 'expense');
      }
    }

    return filtered;
  }, [archivedTransactions, searchQuery, selectedProject, selectedType, projects]);

  // تجميع المعاملات حسب الأشهر
  const monthlyGroups = useMemo(() => {
    const groups: { [key: string]: MonthlyGroup } = {};

    filteredTransactions.forEach(transaction => {
      const date = new Date(transaction.date);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      // استخدام التقويم الميلادي مع الأرقام اللاتينية
      const monthName = date.toLocaleDateString('ar-SA-u-nu-latn', { 
        month: 'long', 
        year: 'numeric',
        calendar: 'gregory' 
      });

      if (!groups[monthKey]) {
        groups[monthKey] = {
          month: monthName,
          year: date.getFullYear(),
          transactions: [],
          totalRevenue: 0,
          totalExpense: 0
        };
      }

      groups[monthKey].transactions.push(transaction);
      
      if (transaction.type === 'income') {
        groups[monthKey].totalRevenue += transaction.amount;
      } else {
        groups[monthKey].totalExpense += transaction.amount;
      }
    });

    // ترتيب المجموعات حسب التاريخ (الأحدث أولاً)
    return Object.values(groups).sort((a, b) => b.year - a.year);
  }, [filteredTransactions]);

  // فلترة حسب الشهر المحدد
  const finalGroups = useMemo(() => {
    if (selectedMonth === 'all') {
      return monthlyGroups;
    }
    return monthlyGroups.filter(group => 
      `${group.year}-${new Date(group.transactions[0].date).getMonth()}` === selectedMonth
    );
  }, [monthlyGroups, selectedMonth]);

  // احصائيات عامة
  const totalStats = useMemo(() => {
    const totalRevenue = filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalExpense = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    return { totalRevenue, totalExpense };
  }, [filteredTransactions]);

  // الحصول على اسم المشروع
  const getProjectName = (projectId?: number) => {
    if (!projectId) return 'غير محدد';
    const project = projects.find(p => p.id === projectId);
    return project?.name || 'مشروع غير معروف';
  };

  // أيقونة نوع المعاملة
  const getTransactionIcon = (type: string) => {
    return type === 'income' ? (
      <TrendingUp className="h-4 w-4 text-green-600" />
    ) : (
      <TrendingDown className="h-4 w-4 text-red-600" />
    );
  };

  // لون نوع المعاملة
  const getTransactionColor = (type: string) => {
    return type === 'income' ? 'text-green-600' : 'text-red-600';
  };

  // تصدير البيانات إلى Excel
  const exportToExcel = () => {
    const dataToExport = filteredTransactions.map((transaction, index) => ({
      'رقم المعاملة': index + 1,
      'التاريخ': formatDate(transaction.date),
      'الوصف': transaction.description,
      'المشروع': getProjectName(transaction.projectId),
      'النوع': transaction.type === 'income' ? 'إيراد' : 'مصروف',
      'المبلغ': transaction.amount,
      'المرفقات': transaction.attachmentUrl ? 'نعم' : 'لا'
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'المعاملات المؤرشفة');
    
    const fileName = `المعاملات_المؤرشفة_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // طباعة البيانات
  const handlePrint = () => {
    window.print();
  };

  if (!user) {
    return <div>جاري التحميل...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
        
        {/* عنوان الصفحة */}
        <div className="bg-gradient-to-l from-primary/5 to-transparent p-4 sm:p-6 mb-6 sm:mb-8 rounded-xl border border-primary/10 shadow-sm">
          <div className="max-w-4xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 sm:h-12 sm:w-12 bg-gradient-to-br from-primary to-primary/70 rounded-xl flex items-center justify-center shadow-md">
                <Archive className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <h2 className="heading-responsive font-bold text-primary">أرشيف المعاملات المالية</h2>
            </div>
            <p className="text-responsive text-muted-foreground pr-1">
              عرض المعاملات المالية التي مضى عليها أكثر من 30 يوماً، مرتبة حسب الأشهر
            </p>
          </div>
        </div>

        {/* الإحصائيات السريعة */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-6">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center space-x-2 space-x-reverse">
                <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي الإيرادات المؤرشفة</p>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(totalStats.totalRevenue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center space-x-2 space-x-reverse">
                <div className="h-8 w-8 bg-red-100 rounded-full flex items-center justify-center">
                  <TrendingDown className="h-4 w-4 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي المصاريف المؤرشفة</p>
                  <p className="text-lg font-bold text-red-600">{formatCurrency(totalStats.totalExpense)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center space-x-2 space-x-reverse">
                <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <Archive className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">عدد المعاملات المؤرشفة</p>
                  <p className="text-lg font-bold text-blue-600">{filteredTransactions.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* أدوات البحث والفلترة */}
        <Card>
          <CardContent className="p-4 sm:p-6">
            {/* شريط الأدوات العلوي */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              {/* عدد العمليات المالية */}
              <div className="flex items-center">
                <span className="px-3 py-1.5 bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 rounded-lg font-bold text-sm ml-2 flex items-center">
                  <Archive className="w-4 h-4 ml-1.5" />
                  إجمالي العمليات المؤرشفة: 
                </span>
                <span className="px-3 py-1.5 bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 rounded-lg font-bold">
                  {filteredTransactions.length}
                </span>
              </div>
              
              {/* أزرار التصدير والعرض */}
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={handlePrint}
                  className="px-3 py-2 bg-secondary dark:bg-gray-700 rounded-lg text-neutral-light dark:text-gray-200 border border-secondary-light dark:border-gray-600 hover:border-primary-light dark:hover:border-gray-500 transition-all"
                >
                  <Printer className="w-4 h-4 mr-2" /> طباعة
                </Button>
                <Button 
                  variant="outline" 
                  onClick={exportToExcel}
                  className="px-3 py-2 bg-secondary dark:bg-gray-700 rounded-lg text-neutral-light dark:text-gray-200 border border-secondary-light dark:border-gray-600 hover:border-primary-light dark:hover:border-gray-500 transition-all"
                >
                  <Download className="w-4 h-4 mr-2" /> تصدير Excel
                </Button>
                
                {/* أزرار نمط العرض */}
                <div className="flex border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                  <Button
                    variant={viewType === 'cards' ? 'default' : 'outline'}
                    onClick={() => setViewType('cards')}
                    className="px-3 py-2 rounded-none border-0"
                  >
                    <Grid className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewType === 'table' ? 'default' : 'outline'}
                    onClick={() => setViewType('table')}
                    className="px-3 py-2 rounded-none border-0"
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* البحث النصي */}
              <div className="relative">
                <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="البحث في الوصف أو المشروع..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-9"
                />
              </div>

              {/* فلتر نوع المعاملة */}
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue placeholder="نوع المعاملة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع المعاملات</SelectItem>
                  <SelectItem value="income">الإيرادات فقط</SelectItem>
                  <SelectItem value="expense">المصاريف فقط</SelectItem>
                </SelectContent>
              </Select>

              {/* فلتر المشروع */}
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger>
                  <SelectValue placeholder="المشروع" />
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

              {/* فلتر الشهر */}
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="الشهر" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الأشهر</SelectItem>
                  {monthlyGroups.map((group) => {
                    const monthKey = `${group.year}-${new Date(group.transactions[0].date).getMonth()}`;
                    return (
                      <SelectItem key={monthKey} value={monthKey}>
                        {group.month}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* المحتوى الرئيسي */}
        <div id="archive-content">
          {transactionsLoading ? (
            <div className="text-center py-10">
              <div className="spinner w-10 h-10 mx-auto"></div>
              <p className="mt-4 text-muted-foreground">جاري تحميل المعاملات المؤرشفة...</p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <Card>
              <CardContent className="p-8 sm:p-12 text-center">
                <div className="text-5xl mb-4 opacity-20">📁</div>
                <p className="text-muted-foreground text-lg mb-2">لا توجد معاملات مؤرشفة</p>
                <p className="text-sm text-muted-foreground">
                  المعاملات المالية تظهر هنا بعد مضي 30 يوماً على إدخالها
                </p>
              </CardContent>
            </Card>
          ) : viewType === 'cards' ? (
            <div className="space-y-6">
              {finalGroups.map((group, groupIndex) => (
                <Card key={groupIndex} className="shadow-md">
                  <CardHeader className="bg-gradient-to-l from-primary/10 to-primary/5 border-b">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg">{group.month}</CardTitle>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <Badge variant="outline" className="text-green-600 border-green-200">
                          إيرادات: {formatCurrency(group.totalRevenue)}
                        </Badge>
                        <Badge variant="outline" className="text-red-600 border-red-200">
                          مصاريف: {formatCurrency(group.totalExpense)}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="p-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                      {group.transactions.map((transaction, index) => (
                        <div 
                          key={transaction.id} 
                          className={`p-5 rounded-lg border h-full flex flex-col shadow-sm relative ${
                            transaction.type === 'income' 
                              ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900'
                              : index % 2 === 0 
                                ? 'bg-gray-50 border-gray-200 dark:bg-gray-800/70 dark:border-gray-700'
                                : 'bg-white border-blue-100 dark:bg-gray-800 dark:border-blue-900/20'
                          } transition-all duration-200 hover:shadow-md hover:scale-[1.02]`}
                        >
                          {/* أيقونة نوع المعاملة */}
                          <div className={`absolute top-3 left-3 w-8 h-8 rounded-full flex items-center justify-center ${
                            transaction.type === 'income' ? 'bg-green-100 dark:bg-green-900/40' : 'bg-red-100 dark:bg-red-900/40'
                          }`}>
                            {getTransactionIcon(transaction.type)}
                          </div>

                          {/* المحتوى الرئيسي */}
                          <div className="flex-1 pr-10">
                            <h3 className="font-semibold text-foreground mb-2 line-clamp-2">
                              {transaction.description}
                            </h3>
                            
                            <div className="space-y-2 text-sm text-muted-foreground">
                              <div className="flex items-center">
                                <Calendar className="w-4 h-4 ml-2" />
                                <span>{formatDate(transaction.date)}</span>
                              </div>
                              
                              <div className="flex items-center">
                                <DollarSign className="w-4 h-4 ml-2" />
                                <span>{getProjectName(transaction.projectId)}</span>
                              </div>
                              
                              {transaction.attachmentUrl && (
                                <div className="flex items-center">
                                  <FileText className="w-4 h-4 ml-2" />
                                  <span>يحتوي على مرفق</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* المبلغ */}
                          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted-foreground">
                                {transaction.type === 'income' ? 'إيراد' : 'مصروف'}
                              </span>
                              <span className={`text-lg font-bold ${getTransactionColor(transaction.type)}`}>
                                {transaction.type === 'expense' ? '-' : '+'}{formatCurrency(transaction.amount)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            // عرض الجدول
            <div className="w-full">
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="w-full overflow-x-auto" style={{ maxWidth: 'calc(100vw - 280px)' }}>
                    <table className="w-full table-fixed divide-y divide-gray-200 dark:divide-gray-600">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th scope="col" className="w-12 px-2 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">#</th>
                          <th scope="col" className="w-24 px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">التاريخ</th>
                          <th scope="col" className="w-40 px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">الوصف</th>
                          <th scope="col" className="w-32 px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">المشروع</th>
                          <th scope="col" className="w-20 px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">النوع</th>
                          <th scope="col" className="w-28 px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">المبلغ</th>
                          <th scope="col" className="w-20 px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">المرفقات</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                        {filteredTransactions.map((transaction, index) => (
                          <tr 
                            key={transaction.id} 
                            className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-150 ${
                              transaction.type === 'income' 
                                ? 'hover:bg-green-50 dark:hover:bg-green-900/20' 
                                : 'hover:bg-red-50 dark:hover:bg-red-900/20'
                            }`}
                          >
                            <td className="px-2 py-3 text-center">
                              <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 rounded-full text-xs font-medium">
                                {index + 1}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-sm truncate">
                              <span className="font-medium text-gray-900 dark:text-gray-100">
                                {formatDate(transaction.date)}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-sm">
                              <div className="truncate" title={transaction.description}>
                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                  {transaction.description}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-sm truncate">
                              <span className="text-gray-600 dark:text-gray-300" title={getProjectName(transaction.projectId)}>
                                {getProjectName(transaction.projectId)}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span className={`inline-flex items-center justify-center w-16 px-2 py-1 rounded-full text-xs font-medium ${
                                transaction.type === 'income' 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' 
                                  : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                              }`}>
                                {transaction.type === 'income' ? 'إيراد' : 'مصروف'}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-sm text-right">
                              <span className={`font-bold ${getTransactionColor(transaction.type)}`}>
                                {transaction.type === 'expense' ? '-' : '+'}{formatCurrency(transaction.amount)}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-center">
                              {transaction.attachmentUrl ? (
                                <div className="flex items-center justify-center">
                                  <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                </div>
                              ) : (
                                <span className="text-gray-400 text-xs">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}