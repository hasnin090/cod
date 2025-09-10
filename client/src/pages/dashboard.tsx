import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { StatisticsCards } from '@/components/statistics-cards';
import { Charts } from '@/components/charts';
import Chart from 'chart.js/auto';
import { formatCurrency } from '@/lib/chart-utils';
import { Button } from '@/components/ui/button';

interface Transaction {
  id: number;
  date: string;
  amount: number;
  type: string;
  description: string;
  projectId?: number;
  fileUrl?: string;
  fileType?: string;
}

interface Project {
  id: number;
  name: string;
  balance: number;
  status?: string;
}

interface DashboardStats {
  // البيانات الإجمالية (للتوافق القديم)
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  
  // بيانات الصندوق الرئيسي
  adminTotalIncome: number;
  adminTotalExpenses: number;
  adminNetProfit: number;
  adminFundBalance: number;
  
  // بيانات المشاريع
  projectTotalIncome: number;
  projectTotalExpenses: number;
  projectNetProfit: number;
  
  // بيانات أخرى
  activeProjects: number;
  recentTransactions: Transaction[];
  projects: Project[];
}

export default function Dashboard() {
  // تهيئة متزامنة لمنع وميض اختفاء/ظهور زر التبديل عند تحميل الصفحة
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    try {
      const userString = localStorage.getItem('auth_user');
      if (!userString) return false;
      const user = JSON.parse(userString);
      return user?.role === 'admin';
    } catch {
      return false;
    }
  });
  const [displayMode, setDisplayMode] = useState<'admin' | 'projects'>(() => {
    try {
      const userString = localStorage.getItem('auth_user');
      if (!userString) return 'projects';
      const user = JSON.parse(userString);
      return user?.role === 'admin' ? 'admin' : 'projects';
    } catch {
      return 'projects';
    }
  });
  
  // مزامنة لاحقة في حال تغيّر localStorage لاحقًا (اختياري)
  useEffect(() => {
    try {
      const userString = localStorage.getItem('auth_user');
      if (!userString) return;
      const user = JSON.parse(userString);
      const admin = user?.role === 'admin';
      setIsAdmin(admin);
      setDisplayMode(admin ? 'admin' : 'projects');
    } catch {
      // تجاهل
    }
  }, []);

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard'],
  });

  const getProjectName = (projectId?: number) => {
    if (!projectId || !stats?.projects) return 'عام';
    const project = stats.projects.find(p => p.id === projectId);
    return project ? project.name : 'غير معروف';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-SA-u-nu-latn', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const getFilteredTransactions = () => {
    if (!stats?.recentTransactions) return [];
    
    let filteredTransactions;
    
    if (displayMode === 'admin') {
      filteredTransactions = stats.recentTransactions.filter(t => t.projectId === null || t.projectId === undefined);
    } else {
      filteredTransactions = stats.recentTransactions.filter(t => 
        (t.projectId !== null && t.projectId !== undefined)
      );
    }
    
    const userString = localStorage.getItem("auth_user");
    if (userString) {
      try {
        const user = JSON.parse(userString);
        if (user.role === 'viewer') {
          filteredTransactions = filteredTransactions.filter(t => t.type !== 'income');
        }
      } catch (e) {
        console.error("Error parsing user data for transaction filtering:", e);
      }
    }
    
    return filteredTransactions;
  };

  const filteredTransactions = getFilteredTransactions();

  return (
    <div className="page-container space-y-6 sm:space-y-8 lg:space-y-10">
      {/* Header Section */}
  <div className="page-header-compact">
        <div className="max-w-full mx-auto">
          <div className="flex flex-col xl:flex-row justify-between items-center gap-3 lg:gap-4 xl:gap-6">
            {/* Logo and Title Section */}
            <div className="flex items-center space-x-4 sm:space-x-6 rtl:space-x-reverse">
              <div className="relative group">
                <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 xl:w-16 xl:h-16 bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg border border-sky-300/30">
                  <svg className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 xl:w-9 xl:h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="absolute -top-1 -right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full shadow-md animate-pulse" />
              </div>
              <div className="space-y-2">
                <h1 className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold bg-gradient-to-r from-sky-600 via-blue-700 to-indigo-800 dark:from-sky-400 dark:via-blue-500 dark:to-indigo-600 bg-clip-text text-transparent">
                  لوحة التحكم المالية
                </h1>
                <p className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm lg:text-base font-medium hidden sm:block">نظرة شاملة على الأداء والإحصائيات المالية للمؤسسة</p>
              </div>
            </div>
            
            {/* Controls Section */}
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-3 lg:gap-4 xl:gap-5 w-full xl:w-auto">
              {/* Mode Toggle for Admins */}
              {isAdmin && (
                <div className="bg-white/85 dark:bg-gray-700/85 backdrop-blur rounded-xl shadow-md p-1.5 flex items-center border border-gray-200/60 dark:border-gray-600/60 w-full sm:w-auto">
                  <button
                    onClick={() => setDisplayMode('admin')}
                    className={`px-2.5 sm:px-3 lg:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm lg:text-sm font-semibold flex items-center gap-2 transition-colors duration-200 flex-1 sm:flex-none justify-center min-w-[110px] ${
                      displayMode === 'admin'
                        ? 'bg-blue-600 text-white shadow'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300'
                    }`}
                    aria-pressed={displayMode === 'admin'}
                  >
                    <svg className="w-4 h-4 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span className="hidden sm:inline">الصندوق الرئيسي</span>
                    <span className="sm:hidden">الصندوق</span>
                  </button>
                  <button
                    onClick={() => setDisplayMode('projects')}
                    className={`px-2.5 sm:px-3 lg:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm lg:text-sm font-semibold flex items-center gap-2 transition-colors duration-200 flex-1 sm:flex-none justify-center min-w-[110px] ${
                      displayMode === 'projects'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300'
                    }`}
                    aria-pressed={displayMode === 'projects'}
                  >
                    <svg className="w-4 h-4 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    المشاريع
                  </button>
                </div>
              )}

              {/* Date Display */}
              <div className="app-window px-3 sm:px-3.5 lg:px-4 py-2 sm:py-2 rounded-xl shadow-md relative w-full sm:w-auto">
                <div className="relative text-center text-foreground">
                  <div className="text-[11px] sm:text-xs lg:text-sm font-medium opacity-80 mb-0.5">التاريخ اليوم</div>
                  <div className="font-semibold text-xs sm:text-sm lg:text-base">
                    {new Date().toLocaleDateString('ar-SA', { 
                      weekday: 'short', 
                      day: 'numeric', 
                      month: 'short',
                      year: 'numeric'
                    })}
                  </div>
                </div>
                <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse shadow"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="dashboard-content space-y-8 lg:space-y-10 xl:space-y-12">
        
        {statsLoading ? (
          <div className="flex items-center justify-center min-h-[75vh]">
            <div className="text-center space-y-8">
              <div className="relative w-36 h-36 mx-auto">
                <div className="absolute inset-0 border-8 border-blue-200 dark:border-blue-800 rounded-full animate-ping opacity-30"></div>
                <div className="absolute inset-3 border-6 border-purple-200 dark:border-purple-800 rounded-full animate-ping opacity-50 animation-delay-200"></div>
                <div className="relative w-full h-full border-8 border-t-blue-600 border-r-purple-600 border-b-indigo-600 border-l-emerald-600 rounded-full animate-spin shadow-2xl"></div>
                <div className="absolute inset-8 border-4 border-t-emerald-400 border-r-blue-400 border-b-purple-400 border-l-indigo-400 rounded-full animate-spin animation-reverse"></div>
              </div>
              <div className="space-y-4">
                <h3 className="text-4xl lg:text-5xl font-black bg-gradient-to-r from-blue-600 via-purple-700 to-indigo-700 dark:from-blue-400 dark:via-purple-500 dark:to-indigo-500 bg-clip-text text-transparent">
                  جاري تحميل البيانات
                </h3>
                <p className="text-xl lg:text-2xl font-semibold text-gray-600 dark:text-gray-300">يرجى الانتظار قليلاً...</p>
                <div className="flex justify-center space-x-3 rtl:space-x-reverse pt-4">
                  <div className="w-4 h-4 bg-blue-500 rounded-full animate-bounce"></div>
                  <div className="w-4 h-4 bg-purple-500 rounded-full animate-bounce animation-delay-200"></div>
                  <div className="w-4 h-4 bg-indigo-500 rounded-full animate-bounce animation-delay-400"></div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-10 lg:space-y-12 xl:space-y-14">
            {/* Enhanced Statistics Cards */}
            <section className="transform hover:scale-[1.01] transition-all duration-500">
              <div className="mb-6 text-center">
                <h2 className="text-2xl lg:text-3xl font-bold text-gray-800 dark:text-gray-200 mb-2">
                  الإحصائيات المالية
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-base lg:text-lg">
                  نظرة سريعة على الوضع المالي {displayMode === 'admin' ? 'للصندوق الرئيسي' : 'للمشاريع'}
                </p>
              </div>
              <StatisticsCards 
                income={displayMode === 'admin' ? stats?.adminTotalIncome || 0 : stats?.projectTotalIncome || 0} 
                expenses={displayMode === 'admin' ? stats?.adminTotalExpenses || 0 : stats?.projectTotalExpenses || 0} 
                profit={displayMode === 'admin' ? stats?.adminNetProfit || 0 : stats?.projectNetProfit || 0}
                adminFundBalance={stats?.adminFundBalance || 0}
                displayMode={displayMode}
              />
            </section>
            
            {/* Enhanced Charts Section */}
            <section className="app-window p-6 sm:p-8 lg:p-10 xl:p-12 max-w-full overflow-hidden">
              <div className="mb-8 text-center">
                <h2 className="text-2xl lg:text-3xl font-bold text-gray-800 dark:text-gray-200 mb-2">
                  المخططات البيانية
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-base lg:text-lg">
                  تحليل مرئي للبيانات المالية {displayMode === 'admin' ? 'للصندوق الرئيسي' : 'للمشاريع'}
                </p>
              </div>
              <Charts 
                income={displayMode === 'admin' ? stats?.adminTotalIncome || 0 : stats?.projectTotalIncome || 0} 
                expenses={displayMode === 'admin' ? stats?.adminTotalExpenses || 0 : stats?.projectTotalExpenses || 0} 
                profit={displayMode === 'admin' ? stats?.adminNetProfit || 0 : stats?.projectNetProfit || 0}
                displayMode={displayMode}
              />
            </section>
            
            {/* Enhanced Recent Transactions */}
            <section className="app-window p-6 sm:p-8 lg:p-10 xl:p-12 max-w-full overflow-hidden">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8">
                <div className="space-y-2">
                  <h3 className={`text-2xl lg:text-3xl xl:text-4xl font-bold bg-gradient-to-r ${
                    displayMode === 'admin' 
                      ? 'from-blue-600 via-indigo-700 to-purple-800 dark:from-blue-400 dark:via-indigo-500 dark:to-purple-600'
                      : 'from-emerald-600 via-green-700 to-teal-800 dark:from-emerald-400 dark:via-green-500 dark:to-teal-600'
                  } bg-clip-text text-transparent`}>
                    {displayMode === 'admin' 
                      ? 'آخر عمليات الصندوق الرئيسي'
                      : 'آخر عمليات المشاريع'
                    }
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-base lg:text-lg">عرض أحدث 10 معاملات مالية بالتفصيل</p>
                </div>
                <Button asChild size="sm" className="px-5 py-3 text-sm lg:text-base">
                  <Link href="/transactions" className="flex items-center gap-2">
                    <span>عرض جميع المعاملات</span>
                    <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </Button>
              </div>
              
              {/* Desktop Table */}
              <div className="dashboard-table hidden lg:block overflow-hidden rounded-2xl border border-gray-200/60 dark:border-gray-700/60 shadow-inner">
                <table className="w-full table-auto divide-y divide-gray-200/60 dark:divide-gray-700/60">
                  <thead className={`${
                    displayMode === 'admin' 
                      ? 'bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900/25 dark:via-indigo-900/25 dark:to-purple-900/25' 
                      : 'bg-gradient-to-r from-emerald-50 via-green-50 to-teal-50 dark:from-emerald-900/25 dark:via-green-900/25 dark:to-teal-900/25'
                  } backdrop-blur-sm`}>
                    <tr>
                      <th className="px-5 py-4 text-right text-xs lg:text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">التاريخ</th>
                      <th className="px-5 py-4 text-right text-xs lg:text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">الوصف</th>
                      {displayMode === 'projects' && (
                        <th className="px-5 py-4 text-right text-xs lg:text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">المشروع</th>
                      )}
                      <th className="px-5 py-4 text-center text-xs lg:text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">النوع</th>
                      <th className="px-5 py-4 text-center text-xs lg:text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">المبلغ</th>
                      <th className="px-5 py-4 text-center text-xs lg:text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">المرفقات</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white/95 dark:bg-gray-800/95 divide-y divide-gray-200/40 dark:divide-gray-700/40 backdrop-blur-sm">
                    {filteredTransactions.length > 0 ? (
                      filteredTransactions.slice(0, 10).map((transaction, index) => (
                        <tr 
                          key={transaction.id} 
                          className="transition-colors duration-200 hover:bg-muted/40"
                        >
                          <td className="px-5 py-4 text-sm lg:text-base text-gray-900 dark:text-gray-100 font-medium">
                            <div className="flex items-center space-x-2 rtl:space-x-reverse">
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span className="truncate">{formatDate(transaction.date)}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-sm lg:text-base text-gray-900 dark:text-gray-100 font-medium">
                            <div className="truncate max-w-xs lg:max-w-sm" title={transaction.description}>
                              {transaction.description}
                            </div>
                          </td>
                          {displayMode === 'projects' && (
                            <td className="px-5 py-4 text-sm lg:text-base text-gray-700 dark:text-gray-300">
                              <span className="bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 px-3 py-1.5 rounded-lg text-xs lg:text-sm font-medium shadow-sm">
                                {getProjectName(transaction.projectId)}
                              </span>
                            </td>
                          )}
                          <td className="px-5 py-4 text-center">
                            <span className={`px-3 py-1.5 inline-flex text-xs lg:text-sm font-bold rounded-xl shadow-md transform transition-all duration-200 hover:scale-105 ${
                              transaction.type === 'income' 
                                ? 'bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 text-white' 
                                : 'bg-gradient-to-r from-red-500 via-pink-500 to-rose-500 text-white'
                            }`}>
                              {transaction.type === 'income' ? 'إيراد' : 'مصروف'}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-sm lg:text-base font-bold text-center">
                            <div className={`font-mono ${
                              transaction.type === 'income' 
                                ? 'text-emerald-600 dark:text-emerald-400' 
                                : 'text-red-600 dark:text-red-400'
                            }`} title={`${transaction.type === 'income' ? '+' : '-'}${formatCurrency(Math.abs(transaction.amount))}`}>
                              <span className="text-lg">{transaction.type === 'income' ? '+' : '-'}</span>
                              {formatCurrency(Math.abs(transaction.amount))}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-center">
                            {transaction.fileUrl ? (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => window.open(transaction.fileUrl, '_blank')}
                                title="عرض المرفق"
                                className="px-3"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                </svg>
                              </Button>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500 text-lg">-</span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={displayMode === 'projects' ? 6 : 5} className="px-4 py-12 text-center">
                          <div className="flex flex-col items-center">
                            <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            <h4 className="text-xl font-semibold text-gray-500 dark:text-gray-400 mb-2">لا توجد معاملات</h4>
                            <p className="text-gray-400 dark:text-gray-500">
                              {displayMode === 'admin' 
                                ? 'لا توجد معاملات حديثة في الصندوق الرئيسي'
                                : 'لا توجد معاملات حديثة للمشاريع'
                              }
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Mobile Cards */}
              <div className="lg:hidden space-y-4">
                {filteredTransactions.length > 0 ? (
                  filteredTransactions.slice(0, 8).map((transaction, index) => (
                    <div 
                      key={transaction.id} 
                      className="app-window p-5 border"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h4 className="font-bold text-base text-gray-900 dark:text-gray-100 mb-1">{transaction.description}</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{formatDate(transaction.date)}</p>
                          {displayMode === 'projects' && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              المشروع: {getProjectName(transaction.projectId)}
                            </p>
                          )}
                        </div>
                        <span className={`px-3 py-1 text-sm font-bold rounded-lg shadow-sm ${
                          transaction.type === 'income' 
                            ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white' 
                            : 'bg-gradient-to-r from-red-500 to-pink-500 text-white'
                        }`}>
                          {transaction.type === 'income' ? 'إيراد' : 'مصروف'}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className={`text-xl font-bold ${
                          transaction.type === 'income' 
                            ? 'text-emerald-600 dark:text-emerald-400' 
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {transaction.type === 'income' ? '+' : '-'}{formatCurrency(Math.abs(transaction.amount))}
                        </span>
                        
                        {transaction.fileUrl && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => window.open(transaction.fileUrl, '_blank')}
                            className="flex items-center gap-1"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                            <span>مرفق</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-16">
                    <svg className="w-20 h-20 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <h4 className="text-xl font-semibold text-gray-500 dark:text-gray-400 mb-2">لا توجد معاملات</h4>
                    <p className="text-gray-400 dark:text-gray-500">
                      {displayMode === 'admin' 
                        ? 'لا توجد معاملات حديثة في الصندوق الرئيسي'
                        : 'لا توجد معاملات حديثة للمشاريع'
                      }
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}