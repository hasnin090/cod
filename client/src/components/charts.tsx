import { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import { 
  getFinancialSummaryOptions, 
  createFinancialSummaryData,
  getExpenseDistributionOptions,
  createExpenseDistributionData
} from '@/lib/chart-utils';

interface ChartsProps {
  income: number;
  expenses: number;
  profit: number;
  displayMode?: 'admin' | 'projects';
}

export function Charts({ income, expenses, profit, displayMode = 'admin' }: ChartsProps) {
  const financialChartRef = useRef<HTMLCanvasElement>(null);
  const expenseChartRef = useRef<HTMLCanvasElement>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canViewIncome, setCanViewIncome] = useState(false);
  
  useEffect(() => {
    const userString = localStorage.getItem("auth_user");
    if (!userString) return;
    try {
      const user = JSON.parse(userString);
      const userIsAdmin = user.role === 'admin';
      const userCanViewIncome = user.role !== 'viewer'; // المشاهدون لا يمكنهم رؤية الإيرادات
      
      setIsAdmin(userIsAdmin);
      setCanViewIncome(userCanViewIncome);
    } catch (e) {
      setIsAdmin(false);
      setCanViewIncome(false);
    }
  }, []);
  
  useEffect(() => {
    // تحديد إذا كان العرض الحالي هو الصندوق الرئيسي أم المشاريع للاستخدام في الرسوم البيانية
    const isAdminView = displayMode === 'admin';
    
    // تخزين مرجع للمخططات لاستخدامها في التنظيف
    let chartInstances: Chart[] = [];
    
    // إنشاء وتحديث المخططات
    const createOrUpdateCharts = () => {
      // تدمير المخططات القديمة أولاً إذا وجدت
      chartInstances.forEach(chart => {
        chart.destroy();
      });
      chartInstances = [];
      
      // إنشاء مخطط الملخص المالي
      if (financialChartRef.current) {
        const ctx = financialChartRef.current.getContext('2d');
        if (ctx) {
          // إنشاء مخطط جديد - إخفاء الإيرادات للمشاهدين
          const chartIncome = canViewIncome ? income : 0;
          const chartProfit = canViewIncome ? profit : -expenses; // المشاهدون يرون فقط المصروفات كرقم سالب
          
          const financialChart = new Chart(ctx, {
            type: 'bar',
            data: createFinancialSummaryData(chartIncome, expenses, chartProfit),
            options: getFinancialSummaryOptions()
          });
          chartInstances.push(financialChart);
        }
      }
      
      // إنشاء مخطط توزيع المصروفات
      if (expenseChartRef.current) {
        const ctx = expenseChartRef.current.getContext('2d');
        if (ctx) {
          // إنشاء مخطط جديد
          const expenseChart = new Chart(ctx, {
            type: 'doughnut',
            data: createExpenseDistributionData(
              ['رواتب', 'مشتريات', 'خدمات', 'إيجار', 'أخرى'],
              [expenses * 0.4, expenses * 0.25, expenses * 0.15, expenses * 0.1, expenses * 0.1]
            ),
            options: getExpenseDistributionOptions()
          });
          chartInstances.push(expenseChart);
        }
      }
    };
    
    // إنشاء المخططات مباشرة
    createOrUpdateCharts();
    
    // إضافة مستمع لتحديث المخططات عند تغيير وضع السمة (مظلم/فاتح)
    const themeChangeHandler = () => {
      setTimeout(() => {
        createOrUpdateCharts();
      }, 100); // تأخير قصير للتأكد من تطبيق السمة الجديدة
    };
    
    // مراقبة تغييرات الفئة 'dark' على العنصر الجذري
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          themeChangeHandler();
        }
      });
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    // تنظيف عند فك تركيب المكون
    return () => {
      // تدمير جميع المخططات
      chartInstances.forEach(chart => {
        chart.destroy();
      });
      
      // إزالة مراقب التغييرات
      observer.disconnect();
    };
  }, [income, expenses, profit, displayMode]);
  
  // تحديد إذا كان العرض الحالي هو الصندوق الرئيسي أم المشاريع
  // للمستخدمين العاديين، دائمًا يكون العرض هو "المشاريع" بغض النظر عن قيمة displayMode
  const isShowingAdmin = isAdmin ? displayMode === 'admin' : false;
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-5 mt-4 sm:mt-5 lg:mt-6">
      <div className={`rounded-xl shadow-card p-4 sm:p-5 lg:p-6 ${
        isShowingAdmin 
          ? 'bg-blue-50/50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50' 
          : 'bg-green-50/50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/50'
      }`}>
        <h3 className={`text-base sm:text-lg font-bold mb-3 sm:mb-4 ${
          isShowingAdmin ? 'text-blue-700 dark:text-blue-300' : 'text-green-700 dark:text-green-300'
        }`}>
          {canViewIncome 
            ? (isShowingAdmin ? 'ملخص الصندوق الرئيسي' : 'ملخص أموال المشاريع')
            : 'ملخص المصروفات'
          }
        </h3>
        <div className="h-48 sm:h-56 lg:h-64">
          <canvas ref={financialChartRef}></canvas>
        </div>
      </div>
      
      <div className={`rounded-xl shadow-card p-4 sm:p-5 lg:p-6 ${
        isShowingAdmin 
          ? 'bg-blue-50/50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50' 
          : 'bg-green-50/50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/50'
      }`}>
        <h3 className={`text-base sm:text-lg font-bold mb-3 sm:mb-4 ${
          isShowingAdmin ? 'text-blue-700 dark:text-blue-300' : 'text-green-700 dark:text-green-300'
        }`}>
          {isShowingAdmin 
            ? 'توزيع مصروفات الصندوق الرئيسي' 
            : 'توزيع مصروفات المشاريع'
          }
        </h3>
        <div className="h-48 sm:h-56 lg:h-64">
          <canvas ref={expenseChartRef}></canvas>
        </div>
      </div>
    </div>
  );
}
