import { formatCurrency } from '@/lib/chart-utils';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

interface StatisticsCardsProps {
  income: number;
  expenses: number;
  profit: number;
  adminFundBalance?: number;
  displayMode?: 'admin' | 'projects';
}

export function StatisticsCards({ income, expenses, profit, adminFundBalance, displayMode = 'admin' }: StatisticsCardsProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  
  useEffect(() => {
    const userString = localStorage.getItem("auth_user");
    if (!userString) return;
    try {
      const user = JSON.parse(userString);
      setIsAdmin(user.role === 'admin');
      console.log("StatisticsCards - User role from localStorage:", user.role);
    } catch (e) {
      console.error("StatisticsCards - Error parsing user data:", e);
      setIsAdmin(false);
    }
  }, []);

  // تحديد إذا كان العرض الحالي يعرض صندوق المدير أم المشاريع
  // للمستخدمين العاديين، دائمًا يكون العرض هو "المشاريع" بغض النظر عن قيمة displayMode
  const isShowingAdmin = isAdmin ? displayMode === 'admin' : false;
  
  console.log("StatisticsCards - isAdmin:", isAdmin, "displayMode:", displayMode, "isShowingAdmin:", isShowingAdmin);

  return (
    <div className="space-y-6">
      {/* تم إزالة بطاقة صندوق المدير بناءً على طلب المستخدم */}
      
      {/* بطاقات الإحصائيات */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
        <div className={`rounded-xl shadow-md p-6 relative min-h-[200px] ${
          isShowingAdmin 
            ? 'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/30 border border-green-200 dark:border-green-800' 
            : 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/30 border border-blue-200 dark:border-blue-800'
        }`}>
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1 min-w-0 pr-2">
              <h3 className="text-gray-800 dark:text-gray-200 text-lg font-bold mb-3">إجمالي الإيرادات</h3>
              <div className="w-full overflow-x-auto">
                <p className={`text-xl md:text-2xl lg:text-3xl font-bold whitespace-nowrap ${isShowingAdmin ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`} id="totalIncome">
                  {formatCurrency(income)}
                </p>
              </div>
            </div>
            <div className={`flex-shrink-0 ${isShowingAdmin ? 'bg-green-100 dark:bg-green-900/30' : 'bg-blue-100 dark:bg-blue-900/30'} p-3 rounded-lg shadow-sm`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`${isShowingAdmin ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`}>
                <line x1="12" y1="19" x2="12" y2="5"></line>
                <polyline points="5 12 12 5 19 12"></polyline>
              </svg>
            </div>
          </div>
          <div className={`w-full h-2 ${isShowingAdmin ? 'bg-green-100 dark:bg-green-900/40' : 'bg-blue-100 dark:bg-blue-900/40'} rounded-full mb-3`}>
            <div 
              className={`h-2 ${isShowingAdmin ? 'bg-green-600 dark:bg-green-500' : 'bg-blue-600 dark:bg-blue-500'} rounded-full transition-all duration-300`}
              style={{ width: income > 0 ? '75%' : '0%' }}
            ></div>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 font-medium leading-relaxed">
            {isShowingAdmin 
              ? 'إجمالي إيرادات الصندوق الرئيسي' 
              : 'إجمالي إيرادات المشاريع'
            }
          </p>
        </div>
        
        <div className={`rounded-xl shadow-md p-6 relative min-h-[200px] ${
          isShowingAdmin 
            ? 'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-900/30 border border-red-200 dark:border-red-800' 
            : 'bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-900/30 border border-orange-200 dark:border-orange-800'
        }`}>
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1 min-w-0 pr-2">
              <h3 className="text-gray-800 dark:text-gray-200 text-lg font-bold mb-3">إجمالي المصروفات</h3>
              <div className="w-full overflow-x-auto">
                <p className={`text-xl md:text-2xl lg:text-3xl font-bold whitespace-nowrap ${isShowingAdmin ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'}`} id="totalExpenses">
                  {formatCurrency(expenses)}
                </p>
              </div>
            </div>
            <div className={`flex-shrink-0 ${isShowingAdmin ? 'bg-red-100 dark:bg-red-900/30' : 'bg-orange-100 dark:bg-orange-900/30'} p-3 rounded-lg shadow-sm`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`${isShowingAdmin ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'}`}>
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <polyline points="19 12 12 19 5 12"></polyline>
              </svg>
            </div>
          </div>
          <div className={`w-full h-2 ${isShowingAdmin ? 'bg-red-100 dark:bg-red-900/40' : 'bg-orange-100 dark:bg-orange-900/40'} rounded-full mb-3`}>
            <div 
              className={`h-2 ${isShowingAdmin ? 'bg-red-600 dark:bg-red-500' : 'bg-orange-600 dark:bg-orange-500'} rounded-full transition-all duration-300`}
              style={{ width: expenses > 0 ? '60%' : '0%' }}
            ></div>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 font-medium leading-relaxed">
            {isShowingAdmin 
              ? 'إجمالي مصروفات الصندوق الرئيسي' 
              : 'إجمالي مصروفات المشاريع'
            }
          </p>
        </div>
        
        <div className={`rounded-xl shadow-md p-6 relative min-h-[200px] ${
          isShowingAdmin 
            ? 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/30 border border-blue-200 dark:border-blue-800' 
            : 'bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-900/30 border border-purple-200 dark:border-purple-800'
        }`}>
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1 min-w-0 pr-2">
              <h3 className="text-gray-800 dark:text-gray-200 text-lg font-bold mb-3">صافي الربح</h3>
              <div className="w-full overflow-x-auto">
                <p className={`text-xl md:text-2xl lg:text-3xl font-bold whitespace-nowrap ${isShowingAdmin ? 'text-blue-600 dark:text-blue-400' : 'text-purple-600 dark:text-purple-400'}`} id="netProfit">
                  {formatCurrency(profit)}
                </p>
              </div>
            </div>
            <div className={`flex-shrink-0 ${isShowingAdmin ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-purple-100 dark:bg-purple-900/30'} p-3 rounded-lg shadow-sm`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`${isShowingAdmin ? 'text-blue-600 dark:text-blue-400' : 'text-purple-600 dark:text-purple-400'}`}>
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
              </svg>
            </div>
          </div>
          <div className={`w-full h-2 ${isShowingAdmin ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-purple-100 dark:bg-purple-900/40'} rounded-full mb-3`}>
            <div 
              className={`h-2 ${isShowingAdmin ? 'bg-blue-600 dark:bg-blue-500' : 'bg-purple-600 dark:bg-purple-500'} rounded-full transition-all duration-300`}
              style={{ width: profit > 0 ? '45%' : '0%' }}
            ></div>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 font-medium leading-relaxed">
            {isShowingAdmin 
              ? 'الفرق بين إيرادات ومصروفات الصندوق الرئيسي' 
              : 'الفرق بين إيرادات ومصروفات المشاريع'
            }
          </p>
        </div>
      </div>
    </div>
  );
}
