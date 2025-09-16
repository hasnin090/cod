import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { TransactionForm } from '@/components/transaction-form';
import { TransactionList } from '@/components/transaction-list';
import { TransactionLinkedDocuments } from '@/components/document-library/document-linker';
import { useCacheManager } from '@/hooks/use-cache-manager';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, ArrowDown, ArrowUp, Search, Archive, CheckSquare, Square, Download, Printer, FileSpreadsheet, Paperclip } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { formatCurrency } from '@/lib/chart-utils';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

interface Filter {
  projectId?: number;
  type?: string;
  startDate?: string;
  endDate?: string;
}

export default function Transactions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { refreshTransactions } = useCacheManager();
  const [filter, setFilter] = useState<Filter>({});
  const [currentView, setCurrentView] = useState<'cards' | 'table'>('cards');
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTransactions, setSelectedTransactions] = useState<number[]>([]);
  const [isArchiveMode, setIsArchiveMode] = useState(false);
  
  interface Transaction {
    id: number;
    date: string;
    amount: number;
    type: string;
    description: string;
    projectId?: number;
    expenseType?: string;
  }

  interface Project {
    id: number;
    name: string;
  }

  const { data: transactions, isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: ['/api/transactions', filter],
    queryFn: async ({ queryKey }) => {
      const [_, filterParams] = queryKey as [string, Filter];
      const params = new URLSearchParams();
      
      if (filterParams.projectId) {
        params.append('projectId', filterParams.projectId.toString());
      }
      if (filterParams.type) {
        params.append('type', filterParams.type);
      }
      if (filterParams.startDate) {
        params.append('startDate', filterParams.startDate);
      }
      if (filterParams.endDate) {
        params.append('endDate', filterParams.endDate);
      }
      
      const url = `/api/transactions${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return response.json();
    },
  });

  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  const handleFormSubmit = () => {
    // تحديث شامل للكاش بعد إنشاء معاملة جديدة
    refreshTransactions();
  };

  const [activeTab, setActiveTab] = useState<"admin" | "all" | "projects">("all");

  const archiveMutation = useMutation({
    mutationFn: async (transactionIds: number[]) => {
      const response = await fetch('/api/transactions/archive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transactionIds }),
      });

      if (!response.ok) {
        throw new Error('فشل في أرشفة المعاملات');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "تم الأرشفة بنجاح",
        description: `تم أرشفة ${data.archivedCount} معاملة مالية`,
      });
      
      // تحديث شامل للكاش بعد الأرشفة
      refreshTransactions();
      
      setSelectedTransactions([]);
      setIsArchiveMode(false);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "خطأ في الأرشفة",
        description: error instanceof Error ? error.message : "فشل في أرشفة المعاملات",
      });
    },
  });

  const handleArchive = () => {
    if (selectedTransactions.length > 0) {
      archiveMutation.mutate(selectedTransactions);
    }
  }

  // وظيفة تصدير البيانات إلى Excel - مخصصة للمستخدمين من نوع المشاهدة
  const exportToExcel = async () => {
    if (!filteredTransactions || filteredTransactions.length === 0) {
      toast({
        title: "لا توجد بيانات للتصدير",
        description: "لا توجد معاملات مالية متاحة للتصدير",
        variant: "destructive",
      });
      return;
    }

    // فلترة البيانات لإخفاء الإيرادات للمستخدمين من نوع المشاهدة
    const dataForExport = user?.role === 'viewer' 
      ? filteredTransactions.filter(t => t.type !== 'income')
      : filteredTransactions;

    if (dataForExport.length === 0) {
      toast({
        title: "لا توجد بيانات للتصدير",
        description: "لا توجد معاملات مالية متاحة للتصدير بعد تطبيق القيود",
        variant: "destructive",
      });
      return;
    }

    // تحضير البيانات للتصدير
    const exportData = dataForExport.map(transaction => {
      const project = projects?.find(p => p.id === transaction.projectId);
      const baseData = {
        'التاريخ': format(new Date(transaction.date), 'yyyy/MM/dd', { locale: ar }),
        'الوصف': transaction.description || '',
        'المشروع': project?.name || 'بدون مشروع',
        'النوع': transaction.type === 'income' ? 'إيراد' : 'مصروف',
        'نوع المصروف': transaction.expenseType || '',
        'المبلغ': transaction.amount,
        'المبلغ المنسق': formatCurrency(transaction.amount),
      };
      
      // للمستخدمين من نوع المشاهدة، إنشاء كائن بدون عمود النوع
      if (user?.role === 'viewer') {
        const { النوع, ...dataWithoutType } = baseData;
        return dataWithoutType;
      }
      
      return baseData;
    });

  // تحميل مكتبة xlsx عند الحاجة فقط
  const XLSX = await import('xlsx');
  // إنشاء ورقة عمل
  const worksheet = XLSX.utils.json_to_sheet(exportData);
    
    // تنسيق عرض الأعمدة
    const wscols = [
      { wch: 12 }, // التاريخ
      { wch: 30 }, // الوصف
      { wch: 20 }, // المشروع
      { wch: 10 }, // النوع
      { wch: 15 }, // نوع المصروف
      { wch: 15 }, // المبلغ الرقمي
      { wch: 20 }, // المبلغ المنسق
    ];
    worksheet['!cols'] = wscols;

    // إنشاء كتاب عمل
  const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'المعاملات المالية');

    // تصدير الملف
    const now = new Date();
    const dateString = format(now, 'yyyy-MM-dd-HHmmss');
    const fileName = `transactions_${dateString}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    toast({
      title: "تم التصدير بنجاح",
      description: `تم تصدير ${filteredTransactions.length} معاملة مالية إلى Excel`,
    });
  };

  // تصدير Excel المحسّن مع التحميل المباشر
  const exportToExcelMutation = useMutation({
    mutationFn: async (exportFilters: any) => {
      const response = await fetch('/api/transactions/export/excel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exportFilters),
      });

      if (!response.ok) {
        throw new Error('فشل في تصدير البيانات');
      }

      // إذا كان النوع CSV، نحميل الملف مباشرة
      if (response.headers.get('content-type')?.includes('text/csv')) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `transactions_export_${Date.now()}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        return { success: true, message: 'تم تحميل الملف' };
      }

      return response.json();
    },
    onSuccess: (data) => {
      console.log('استجابة التصدير:', data);
      if (data.success) {
        toast({
          title: "نجح التصدير",
          description: "تم تصدير البيانات إلى ملف CSV بنجاح ويمكن فتحه في Excel",
        });
      } else {
        toast({
          title: "خطأ في التصدير",
          description: data.message || "فشل في تصدير البيانات",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في التصدير",
        description: error.message || "فشل في تصدير البيانات",
        variant: "destructive",
      });
    }
  });

  const handleExcelExport = () => {
    const exportFilters = {
      projectId: filter.projectId,
      type: filter.type,
      dateFrom: filter.startDate,
      dateTo: filter.endDate,
    };

    exportToExcelMutation.mutate(exportFilters);
  };

  // وظيفة الطباعة - مخصصة للمستخدمين من نوع المشاهدة
  const handlePrint = () => {
    if (!filteredTransactions || filteredTransactions.length === 0) {
      toast({
        title: "لا توجد بيانات للطباعة",
        description: "لا توجد معاملات مالية متاحة للطباعة",
        variant: "destructive",
      });
      return;
    }

    // فلترة البيانات لإخفاء الإيرادات للمستخدمين من نوع المشاهدة
    const dataForPrint = user?.role === 'viewer' 
      ? filteredTransactions.filter(t => t.type !== 'income')
      : filteredTransactions;

    if (dataForPrint.length === 0) {
      toast({
        title: "لا توجد بيانات للطباعة",
        description: "لا توجد معاملات مالية متاحة للطباعة بعد تطبيق القيود",
        variant: "destructive",
      });
      return;
    }

    // إنشاء نافذة طباعة
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const currentDate = format(new Date(), 'yyyy/MM/dd', { locale: ar });
    const reportTitle = user?.role === 'viewer' ? 'تقرير المصروفات المالية' : 'تقرير المعاملات المالية';
    
    // تحديد العناوين حسب نوع المستخدم
    const headers = user?.role === 'viewer' 
      ? ['التاريخ', 'الوصف', 'المشروع', 'نوع المصروف', 'المبلغ']
      : ['التاريخ', 'الوصف', 'المشروع', 'النوع', 'نوع المصروف', 'المبلغ'];
    
    // محتوى الطباعة
    const printContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>${reportTitle}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; margin: 20px; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2563eb; padding-bottom: 15px; }
          .header h1 { color: #2563eb; margin: 0; font-size: 24px; }
          .header p { margin: 5px 0; color: #666; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
          th { background-color: #f8fafc; font-weight: bold; color: #374151; }
          .income { color: #059669; font-weight: bold; }
          .expense { color: #dc2626; font-weight: bold; }
          .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${reportTitle}</h1>
          <p>تاريخ التقرير: ${currentDate}</p>
          <p>عدد المعاملات: ${dataForPrint.length}</p>
        </div>
        <table>
          <thead>
            <tr>
              ${headers.map(header => `<th>${header}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${dataForPrint.map(transaction => {
              const project = projects?.find(p => p.id === transaction.projectId);
              const cells = [
                format(new Date(transaction.date), 'yyyy/MM/dd', { locale: ar }),
                transaction.description || '',
                project?.name || 'بدون مشروع'
              ];
              
              // إضافة النوع فقط للمستخدمين غير المشاهدين
              if (user?.role !== 'viewer') {
                cells.push(`<span class="${transaction.type === 'income' ? 'income' : 'expense'}">${transaction.type === 'income' ? 'إيراد' : 'مصروف'}</span>`);
              }
              
              cells.push(transaction.expenseType || '');
              cells.push(formatCurrency(transaction.amount));
              
              return `<tr>${cells.map(cell => `<td>${cell}</td>`).join('')}</tr>`;
            }).join('')}
          </tbody>
        </table>
        <div class="footer">
          <p>نظام المحاسبة المالية - تم إنشاء التقرير في ${format(new Date(), 'yyyy/MM/dd HH:mm', { locale: ar })}</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  const handleSelectAll = () => {
    if (transactions) {
      setSelectedTransactions(transactions.map(t => t.id));
    }
  };

  const handleUnselectAll = () => {
    setSelectedTransactions([]);
  };

  const toggleTransactionSelection = (transactionId: number) => {
    setSelectedTransactions(prev => 
      prev.includes(transactionId)
        ? prev.filter(id => id !== transactionId)
        : [...prev, transactionId]
    );
  };

  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    
    let filtered = [...transactions];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(transaction => 
        transaction.description.toLowerCase().includes(query) ||
        transaction.amount.toString().includes(query) ||
        (transaction.type === 'income' && 'ايراد'.includes(query)) ||
        (transaction.type === 'expense' && 'مصروف'.includes(query)) ||
        projects?.find(p => p.id === transaction.projectId)?.name.toLowerCase().includes(query)
      );
    }
    
    return [...filtered].sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [transactions, searchQuery, projects]);

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="py-6 px-4 pb-mobile-nav-large">
        <div className="page-header-compact">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <i className="fas fa-exchange-alt"></i>
            </div>
            <div>
              <h1 className="section-title text-xl sm:text-2xl">العمليات النقدية</h1>
              <p className="section-subtitle">إدارة ومتابعة جميع العمليات النقدية في النظام</p>
            </div>
          </div>
        </div>
      
        {user?.role !== 'viewer' && (
          <div className="mb-8 fade-in">
            <div className="bg-[hsl(var(--card))] border border-blue-100 p-6 rounded-xl shadow-sm">
              <TransactionForm 
                projects={projects || []} 
                onSubmit={handleFormSubmit} 
                isLoading={projectsLoading}
              />
            </div>
          </div>
        )}
        
  <div className="section-block fade-in">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-4 gap-3">
            <h3 className="text-base font-semibold text-[hsl(var(--foreground))] flex items-center gap-2">
              <Filter className="w-4 h-4" />
              عرض وفلترة العمليات النقدية
            </h3>
            
            <div className="flex flex-wrap gap-2 w-full lg:w-auto items-center">
              {/* أزرار التصدير والطباعة */}
              <Button
                onClick={handleExcelExport}
                variant="outline"
                size="sm"
                className="flex items-center gap-1 bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                disabled={exportToExcelMutation.isPending}
              >
                <FileSpreadsheet className="w-4 h-4" />
                {exportToExcelMutation.isPending ? 'جاري التصدير...' : 'تصدير CSV'}
              </Button>
              
              {user?.role === 'viewer' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToExcel}
                  className="flex items-center gap-1 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                >
                  <Download className="w-4 h-4" />
                  تصدير Excel بسيط
                </Button>
              )}
              
              <Button
                onClick={() => window.print()}
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
              >
                <Printer className="w-4 h-4" />
                طباعة
              </Button>

              {/* أزرار الأرشفة - مخفية للمستخدمين مشاهدة فقط */}
              {user?.role !== 'viewer' && (
                <>
                  <Button
                    variant={isArchiveMode ? "default" : "outline"}
                    size="sm"
                    onClick={() => setIsArchiveMode(!isArchiveMode)}
                    className="flex items-center gap-1 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                  >
                    <Archive className="w-4 h-4" />
                    {isArchiveMode ? 'إلغاء الأرشفة' : 'وضع الأرشفة'}
                  </Button>
                  
                  {isArchiveMode && (
                    <div className="flex flex-wrap gap-1">
                      <Button
                        size="sm"
                        onClick={handleSelectAll}
                        className="flex items-center gap-1 bg-orange-600 hover:bg-orange-700 text-xs"
                      >
                        <CheckSquare className="w-3 h-3" />
                        تحديد الكل ({selectedTransactions.length})
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleUnselectAll}
                        className="flex items-center gap-1 text-xs"
                      >
                        <Square className="w-3 h-3" />
                        إلغاء التحديد
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleArchive}
                        disabled={selectedTransactions.length === 0 || archiveMutation.isPending}
                        className="flex items-center gap-1 text-xs"
                      >
                        <Archive className="w-3 h-3" />
                        أرشفة ({selectedTransactions.length})
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-100 dark:border-slate-700">
            <h3 className="text-lg font-bold text-[hsl(var(--primary))] flex items-center gap-2">
              <Search className="w-5 h-5" />
              البحث والعرض
            </h3>
            <div className="flex gap-2 mt-2 md:mt-0 w-full md:w-auto">
              <Button
                variant={currentView === 'cards' ? 'default' : 'outline'}
                onClick={() => setCurrentView('cards')}
                className={`flex-1 md:flex-none px-3 py-2 rounded-lg text-sm font-medium border transition-colors flex items-center justify-center gap-2 ${
                  currentView === 'cards' 
                    ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] border-[hsl(var(--primary))]' 
                    : 'bg-[hsl(var(--background))] text-[hsl(var(--foreground))] border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]'
                }`}
              >
                عرض البطاقات
              </Button>
              <Button
                variant={currentView === 'table' ? 'default' : 'outline'}
                onClick={() => setCurrentView('table')}
                className={`flex-1 md:flex-none px-3 py-2 rounded-lg text-sm font-medium border transition-colors flex items-center justify-center gap-2 ${
                  currentView === 'table' 
                    ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] border-[hsl(var(--primary))]' 
                    : 'bg-[hsl(var(--background))] text-[hsl(var(--foreground))] border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]'
                }`}
              >
                عرض الجدول
              </Button>
            </div>
          </div>

          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="البحث في العمليات النقدية..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="w-full">
            <TransactionList 
              transactions={filteredTransactions || []} 
              projects={projects || []} 
              viewType={currentView}
              isLoading={transactionsLoading || projectsLoading}
              onTransactionUpdated={handleFormSubmit}
              isArchiveMode={isArchiveMode}
              selectedTransactions={selectedTransactions}
              onToggleSelection={toggleTransactionSelection}
            />
          </div>
        </div>
      </div>
    </div>
  );
}