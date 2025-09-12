import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { formatCurrency } from '@/lib/chart-utils';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Building2, 
  Eye,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  PieChart,
  Calculator,
  FileText,
  Users,
  Clock
} from 'lucide-react';

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
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  adminTotalIncome: number;
  adminTotalExpenses: number;
  adminNetProfit: number;
  adminFundBalance: number;
  projectTotalIncome: number;
  projectTotalExpenses: number;
  projectNetProfit: number;
  activeProjects: number;
  recentTransactions: Transaction[];
  projects: Project[];
}

export default function Dashboard() {
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
      month: 'short',
      day: 'numeric'
    });
  };

  if (statsLoading) {
    return (
      <div className="accounting-page">
        <div className="accounting-page-content">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  // Professional Statistics Cards
  const renderStatsCards = () => {
    if (displayMode === 'admin' && isAdmin) {
      return (
        <div className="accounting-dashboard-stats">
          {/* Admin Fund Balance */}
          <div className="accounting-stats-card">
            <div className="flex items-start justify-between mb-4">
              <div className="accounting-stats-icon">
                <Wallet />
              </div>
              <div className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                الصندوق الرئيسي
              </div>
            </div>
            <div className="accounting-stats-value">
              {formatCurrency(stats?.adminFundBalance || 0)}
            </div>
            <div className="accounting-stats-label">رصيد الصندوق الرئيسي</div>
          </div>

          {/* Admin Total Income */}
          <div className="accounting-stats-card">
            <div className="flex items-start justify-between mb-4">
              <div className="accounting-stats-icon">
                <TrendingUp />
              </div>
              <div className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">
                إيرادات
              </div>
            </div>
            <div className="accounting-stats-value financial-amount positive">
              {formatCurrency(stats?.adminTotalIncome || 0)}
            </div>
            <div className="accounting-stats-label">إجمالي الإيرادات</div>
            <div className="accounting-stats-change positive">
              <ArrowUpRight className="w-3 h-3" />
              <span>+{((stats?.adminTotalIncome || 0) / 1000).toFixed(0)}k هذا الشهر</span>
            </div>
          </div>

          {/* Admin Total Expenses */}
          <div className="accounting-stats-card">
            <div className="flex items-start justify-between mb-4">
              <div className="accounting-stats-icon">
                <TrendingDown />
              </div>
              <div className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full font-medium">
                مصروفات
              </div>
            </div>
            <div className="accounting-stats-value financial-amount negative">
              {formatCurrency(stats?.adminTotalExpenses || 0)}
            </div>
            <div className="accounting-stats-label">إجمالي المصروفات</div>
            <div className="accounting-stats-change negative">
              <ArrowDownRight className="w-3 h-3" />
              <span>-{((stats?.adminTotalExpenses || 0) / 1000).toFixed(0)}k هذا الشهر</span>
            </div>
          </div>

          {/* Admin Net Profit */}
          <div className="accounting-stats-card">
            <div className="flex items-start justify-between mb-4">
              <div className="accounting-stats-icon">
                <BarChart3 />
              </div>
              <div className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full font-medium">
                صافي الربح
              </div>
            </div>
            <div className={`accounting-stats-value financial-amount ${
              (stats?.adminNetProfit || 0) >= 0 ? 'positive' : 'negative'
            }`}>
              {formatCurrency(stats?.adminNetProfit || 0)}
            </div>
            <div className="accounting-stats-label">صافي الربح/الخسارة</div>
          </div>
        </div>
      );
    } else {
      return (
        <div className="accounting-dashboard-stats">
          {/* Project Total Income */}
          <div className="accounting-stats-card">
            <div className="flex items-start justify-between mb-4">
              <div className="accounting-stats-icon">
                <TrendingUp />
              </div>
              <div className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">
                إيرادات المشاريع
              </div>
            </div>
            <div className="accounting-stats-value financial-amount positive">
              {formatCurrency(stats?.projectTotalIncome || 0)}
            </div>
            <div className="accounting-stats-label">إجمالي إيرادات المشاريع</div>
          </div>

          {/* Project Total Expenses */}
          <div className="accounting-stats-card">
            <div className="flex items-start justify-between mb-4">
              <div className="accounting-stats-icon">
                <TrendingDown />
              </div>
              <div className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full font-medium">
                مصروفات المشاريع
              </div>
            </div>
            <div className="accounting-stats-value financial-amount negative">
              {formatCurrency(stats?.projectTotalExpenses || 0)}
            </div>
            <div className="accounting-stats-label">إجمالي مصروفات المشاريع</div>
          </div>

          {/* Project Net Profit */}
          <div className="accounting-stats-card">
            <div className="flex items-start justify-between mb-4">
              <div className="accounting-stats-icon">
                <BarChart3 />
              </div>
              <div className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full font-medium">
                صافي ربح المشاريع
              </div>
            </div>
            <div className={`accounting-stats-value financial-amount ${
              (stats?.projectNetProfit || 0) >= 0 ? 'positive' : 'negative'
            }`}>
              {formatCurrency(stats?.projectNetProfit || 0)}
            </div>
            <div className="accounting-stats-label">صافي ربح/خسارة المشاريع</div>
          </div>

          {/* Active Projects */}
          <div className="accounting-stats-card">
            <div className="flex items-start justify-between mb-4">
              <div className="accounting-stats-icon">
                <Building2 />
              </div>
              <div className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                المشاريع النشطة
              </div>
            </div>
            <div className="accounting-stats-value">
              {stats?.activeProjects || 0}
            </div>
            <div className="accounting-stats-label">عدد المشاريع النشطة</div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="accounting-page">
      {/* Professional Page Header */}
      <div className="accounting-page-header">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <h1 className="accounting-page-title flex items-center gap-3">
              <div className="accounting-stats-icon">
                <PieChart />
              </div>
              لوحة التحكم المالية
            </h1>
            <p className="accounting-page-description">
              نظرة شاملة على الأداء المالي والإحصائيات التشغيلية للمؤسسة
            </p>
          </div>
          
          {/* Professional Mode Toggle for Admins */}
          {isAdmin && (
            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg p-1 shadow-sm border">
              <button
                onClick={() => setDisplayMode('admin')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  displayMode === 'admin'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Wallet className="w-4 h-4 inline-block ml-2" />
                الصندوق الرئيسي
              </button>
              <button
                onClick={() => setDisplayMode('projects')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  displayMode === 'projects'
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Building2 className="w-4 h-4 inline-block ml-2" />
                المشاريع
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Professional Page Content */}
      <div className="accounting-page-content">
        {/* Statistics Section */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            الإحصائيات المالية
          </h2>
          {renderStatsCards()}
        </section>

        {/* Recent Transactions Section */}
        <section>
          <div className="accounting-card">
            <div className="accounting-card-header">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="accounting-card-title flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    آخر العمليات المالية
                  </h3>
                  <p className="accounting-card-description">
                    أحدث {stats?.recentTransactions?.length || 0} عملية مالية
                  </p>
                </div>
                <Link href="/transactions">
                  <button className="accounting-btn-primary">
                    <Eye className="w-4 h-4" />
                    عرض جميع العمليات
                  </button>
                </Link>
              </div>
            </div>
            
            <div className="accounting-card-content">
              {stats?.recentTransactions && stats.recentTransactions.length > 0 ? (
                <div className="accounting-table-container">
                  <table className="accounting-table">
                    <thead className="accounting-table-header">
                      <tr>
                        <th>التاريخ</th>
                        <th>الوصف</th>
                        <th>المشروع</th>
                        <th>النوع</th>
                        <th>المبلغ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentTransactions.map((transaction) => (
                        <tr key={transaction.id} className="accounting-table-row">
                          <td className="accounting-table-cell">
                            {formatDate(transaction.date)}
                          </td>
                          <td className="accounting-table-cell">
                            {transaction.description}
                          </td>
                          <td className="accounting-table-cell accounting-table-cell-secondary">
                            {getProjectName(transaction.projectId)}
                          </td>
                          <td className="accounting-table-cell">
                            <span className={`financial-badge ${
                              transaction.type === 'income' ? 'income' : 'expense'
                            }`}>
                              {transaction.type === 'income' ? 'إيراد' : 'مصروف'}
                            </span>
                          </td>
                          <td className="accounting-table-cell accounting-table-cell-number">
                            <span className={`financial-amount ${
                              transaction.type === 'income' ? 'positive' : 'negative'
                            }`}>
                              {formatCurrency(transaction.amount)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">
                    لا توجد عمليات مالية حديثة
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Quick Actions Section */}
        <section>
          <div className="accounting-card">
            <div className="accounting-card-header">
              <h3 className="accounting-card-title">الإجراءات السريعة</h3>
              <p className="accounting-card-description">
                الوصول السريع للوظائف الأكثر استخداماً
              </p>
            </div>
            <div className="accounting-card-content">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Link href="/transactions">
                  <button className="accounting-btn-secondary w-full justify-center">
                    <DollarSign className="w-4 h-4" />
                    إدارة العمليات المالية
                  </button>
                </Link>
                <Link href="/projects">
                  <button className="accounting-btn-secondary w-full justify-center">
                    <Building2 className="w-4 h-4" />
                    إدارة المشاريع
                  </button>
                </Link>
                <Link href="/reports">
                  <button className="accounting-btn-secondary w-full justify-center">
                    <BarChart3 className="w-4 h-4" />
                    التقارير المالية
                  </button>
                </Link>
                <Link href="/documents">
                  <button className="accounting-btn-secondary w-full justify-center">
                    <FileText className="w-4 h-4" />
                    إدارة المستندات
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
