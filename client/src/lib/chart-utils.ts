import { ChartData, ChartOptions } from 'chart.js';

// Financial summary chart options
export const getFinancialSummaryOptions = (): ChartOptions<'bar'> => {
  // تحديد ما إذا كان النظام في الوضع المظلم
  const isDarkMode = document.documentElement.classList.contains('dark');
  
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          font: {
            family: 'Cairo',
          },
          color: isDarkMode ? '#E0E1DD' : '#333333',
        },
      },
      tooltip: {
        backgroundColor: isDarkMode ? 'rgba(13, 27, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        titleColor: isDarkMode ? '#ffffff' : '#333333',
        bodyColor: isDarkMode ? '#ffffff' : '#333333',
        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
        borderWidth: 1,
        titleFont: {
          family: 'Cairo',
          size: 14,
        },
        bodyFont: {
          family: 'Cairo',
          size: 12,
        },
        padding: 10,
        boxPadding: 5
      },
    },
    scales: {
      x: {
        grid: {
          color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          font: {
            family: 'Cairo',
          },
          color: isDarkMode ? '#B0BEC5' : '#666666',
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          font: {
            family: 'Cairo',
          },
          color: isDarkMode ? '#B0BEC5' : '#666666',
        },
      },
    },
  };
};

// Financial summary chart data
export const createFinancialSummaryData = (
  income: number,
  expenses: number,
  profit: number
): ChartData<'bar'> => {
  // تحديد ما إذا كان النظام في الوضع المظلم
  const isDarkMode = document.documentElement.classList.contains('dark');
  
  return {
    labels: ['الإيرادات', 'المصروفات', 'صافي الربح'],
    datasets: [
      {
        label: 'البيانات المالية (د.ع)',
        data: [income, expenses, profit],
        backgroundColor: isDarkMode ? [
          'rgba(99, 202, 255, 0.8)',  // أزرق أكثر سطوعًا ووضوحاً للوضع المظلم
          'rgba(255, 116, 100, 0.8)', // أحمر أكثر سطوعًا ووضوحاً للوضع المظلم
          'rgba(86, 255, 153, 0.8)',  // أخضر أكثر سطوعًا ووضوحاً للوضع المظلم
        ] : [
          'rgba(52, 152, 219, 0.8)',  // أزرق للوضع الفاتح
          'rgba(231, 76, 60, 0.8)',   // أحمر للوضع الفاتح
          'rgba(46, 204, 113, 0.8)',  // أخضر للوضع الفاتح
        ],
        borderColor: isDarkMode ? [
          'rgba(119, 212, 255, 1)',   // حدود أكثر سطوعًا ووضوحاً للوضع المظلم
          'rgba(255, 136, 120, 1)',
          'rgba(106, 255, 173, 1)',
        ] : [
          'rgba(52, 152, 219, 1)',
          'rgba(231, 76, 60, 1)',
          'rgba(46, 204, 113, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };
};

// Expense distribution chart options
export const getExpenseDistributionOptions = (): ChartOptions<'doughnut'> => {
  // تحديد ما إذا كان النظام في الوضع المظلم
  const isDarkMode = document.documentElement.classList.contains('dark');
  
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          font: {
            family: 'Cairo',
          },
          color: isDarkMode ? '#E0E1DD' : '#333333',
          padding: 15,
          boxWidth: 15,
          boxHeight: 15,
          usePointStyle: true,
          pointStyle: 'circle',
        },
      },
      tooltip: {
        backgroundColor: isDarkMode ? 'rgba(13, 27, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        titleColor: isDarkMode ? '#ffffff' : '#333333',
        bodyColor: isDarkMode ? '#ffffff' : '#333333',
        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
        borderWidth: 1,
        titleFont: {
          family: 'Cairo',
          size: 14,
        },
        bodyFont: {
          family: 'Cairo',
          size: 12,
        },
        padding: 10,
        boxPadding: 5
      },
    },
  };
};

// Expense distribution chart data
export const createExpenseDistributionData = (
  categories: string[],
  amounts: number[]
): ChartData<'doughnut'> => {
  // تحديد ما إذا كان النظام في الوضع المظلم
  const isDarkMode = document.documentElement.classList.contains('dark');
  
  return {
    labels: categories,
    datasets: [
      {
        label: 'المصروفات حسب الفئة',
        data: amounts,
        backgroundColor: isDarkMode ? [
          'rgba(99, 202, 255, 0.9)',    // أزرق أكثر سطوعًا ووضوحاً للوضع المظلم
          'rgba(255, 116, 100, 0.9)',   // أحمر أكثر سطوعًا ووضوحاً للوضع المظلم
          'rgba(86, 255, 153, 0.9)',    // أخضر أكثر سطوعًا ووضوحاً للوضع المظلم
          'rgba(255, 220, 55, 0.9)',    // أصفر أكثر سطوعًا ووضوحاً للوضع المظلم
          'rgba(195, 129, 222, 0.9)',   // بنفسجي أكثر سطوعًا ووضوحاً للوضع المظلم
        ] : [
          'rgba(52, 152, 219, 0.8)',    // أزرق للوضع الفاتح
          'rgba(231, 76, 60, 0.8)',     // أحمر للوضع الفاتح
          'rgba(46, 204, 113, 0.8)',    // أخضر للوضع الفاتح
          'rgba(241, 196, 15, 0.8)',    // أصفر للوضع الفاتح
          'rgba(155, 89, 182, 0.8)',    // بنفسجي للوضع الفاتح
        ],
        borderColor: isDarkMode ? [
          'rgba(119, 212, 255, 1)',     // حدود أكثر سطوعًا ووضوحاً للوضع المظلم
          'rgba(255, 136, 120, 1)',
          'rgba(106, 255, 173, 1)',
          'rgba(255, 230, 75, 1)',
          'rgba(205, 139, 232, 1)',
        ] : [
          'rgba(52, 152, 219, 1)',
          'rgba(231, 76, 60, 1)',
          'rgba(46, 204, 113, 1)',
          'rgba(241, 196, 15, 1)',
          'rgba(155, 89, 182, 1)',
        ],
        borderWidth: 1,
        hoverOffset: 10,
      },
    ],
  };
};

// Format currency
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('ar-IQ', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' د.ع';
};
