import { formatCurrency } from '@/lib/chart-utils';
import { useEffect, useMemo, useState } from 'react';
import AutoFitNumber from '@/components/ui/auto-fit-number';

interface StatisticsCardsProps {
  income: number;
  expenses: number;
  profit: number;
  adminFundBalance?: number;
  displayMode?: 'admin' | 'projects';
}

export function StatisticsCards({ income, expenses, profit, adminFundBalance, displayMode = 'admin' }: StatisticsCardsProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [canViewIncome, setCanViewIncome] = useState(false);
  
  useEffect(() => {
    const userString = localStorage.getItem("auth_user");
    if (!userString) return;
    try {
      const user = JSON.parse(userString);
      const userIsAdmin = user.role === 'admin';
      const userCanViewIncome = user.role !== 'viewer';
      
      setIsAdmin(userIsAdmin);
      setCanViewIncome(userCanViewIncome);
    } catch (e) {
      setIsAdmin(false);
      setCanViewIncome(false);
    }
  }, []);

  const isShowingAdmin = isAdmin ? displayMode === 'admin' : false;

  // Memoize formatted values to avoid extra recalculations
  const fmtIncome = useMemo(() => formatCurrency(income), [income]);
  const fmtExpenses = useMemo(() => formatCurrency(expenses), [expenses]);
  const fmtProfit = useMemo(() => formatCurrency(profit), [profit]);
  const fmtAdminBalance = useMemo(() => formatCurrency(adminFundBalance ?? 0), [adminFundBalance]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 animate-fade-in">
      {/* بطاقة الإيرادات */}
      {canViewIncome && (
        <div className="stats-card-pro stats-card-compact group cursor-pointer">
          <div className="flex items-start justify-between mb-3">
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 group-hover:bg-emerald-500/20 transition-colors duration-300">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div className="text-emerald-500 text-xs font-medium bg-emerald-50 px-2 py-1 rounded-full">
              +12.5%
            </div>
          </div>
          <AutoFitNumber value={fmtIncome} colorClassName="text-emerald-600" className="min-h-[28px]" maxFont={26} minFont={14} />
          <div className="stats-label-pro">إجمالي الإيرادات</div>
        </div>
      )}

      {/* بطاقة المصروفات */}
      <div className="stats-card-pro stats-card-compact group cursor-pointer">
        <div className="flex items-start justify-between mb-3">
          <div className="p-3 rounded-xl bg-red-500/10 text-red-600 group-hover:bg-red-500/20 transition-colors duration-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
            </svg>
          </div>
          <div className="text-red-500 text-xs font-medium bg-red-50 px-2 py-1 rounded-full">
            -5.2%
          </div>
        </div>
        <AutoFitNumber value={fmtExpenses} colorClassName="text-red-600" className="min-h-[28px]" maxFont={26} minFont={14} />
        <div className="stats-label-pro">إجمالي المصروفات</div>
      </div>

      {/* بطاقة صافي الربح */}
      <div className="stats-card-pro stats-card-compact group cursor-pointer">
        <div className="flex items-start justify-between mb-3">
          <div className={`p-3 rounded-xl transition-colors duration-300 ${
            profit >= 0 
              ? 'bg-blue-500/10 text-blue-600 group-hover:bg-blue-500/20' 
              : 'bg-orange-500/10 text-orange-600 group-hover:bg-orange-500/20'
          }`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          </div>
          <div className={`text-xs font-medium px-2 py-1 rounded-full ${
            profit >= 0 
              ? 'text-blue-500 bg-blue-50' 
              : 'text-orange-500 bg-orange-50'
          }`}>
            {profit >= 0 ? '+8.3%' : '-2.1%'}
          </div>
        </div>
        <AutoFitNumber value={fmtProfit} colorClassName={profit >= 0 ? 'text-blue-600' : 'text-orange-600'} className="min-h-[28px]" maxFont={26} minFont={14} />
        <div className="stats-label-pro">صافي {profit >= 0 ? 'الربح' : 'الخسارة'}</div>
      </div>

      {/* بطاقة رصيد الصندوق للمشرفين فقط */}
      {isAdmin && isShowingAdmin && adminFundBalance !== undefined && (
        <div className="stats-card-pro stats-card-compact group cursor-pointer">
          <div className="flex items-start justify-between mb-3">
            <div className="p-3 rounded-xl bg-purple-500/10 text-purple-600 group-hover:bg-purple-500/20 transition-colors duration-300">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div className="text-purple-500 text-xs font-medium bg-purple-50 px-2 py-1 rounded-full">
              الرصيد
            </div>
          </div>
          <AutoFitNumber value={fmtAdminBalance} colorClassName="text-purple-600" className="min-h-[28px]" maxFont={26} minFont={14} />
          <div className="stats-label-pro">رصيد الصندوق الرئيسي</div>
        </div>
      )}
    </div>
  );
}