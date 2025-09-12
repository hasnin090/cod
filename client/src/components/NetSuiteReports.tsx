import React, { useState } from 'react';
import NetSuiteLayout from '@/components/NetSuiteLayout';

const NetSuiteReports: React.FC = () => {
  const [selectedReport, setSelectedReport] = useState('financial');
  const [reportPeriod, setReportPeriod] = useState('monthly');

  const reportCategories = [
    {
      id: 'financial',
      title: 'التقارير المالية',
      icon: '💰',
      description: 'تقارير الأرباح والخسائر والميزانية',
      reports: [
        { id: 'profit-loss', name: 'الأرباح والخسائر', icon: '📈', description: 'تقرير شامل للإيرادات والمصروفات' },
        { id: 'balance-sheet', name: 'الميزانية العمومية', icon: '⚖️', description: 'الأصول والخصوم وحقوق الملكية' },
        { id: 'cash-flow', name: 'التدفق النقدي', icon: '💸', description: 'حركة النقد الداخل والخارج' },
        { id: 'trial-balance', name: 'ميزان المراجعة', icon: '📊', description: 'أرصدة جميع الحسابات' }
      ]
    },
    {
      id: 'sales',
      title: 'تقارير المبيعات',
      icon: '📊',
      description: 'تحليل المبيعات والعملاء',
      reports: [
        { id: 'sales-summary', name: 'ملخص المبيعات', icon: '📈', description: 'إجمالي المبيعات حسب الفترة' },
        { id: 'customer-analysis', name: 'تحليل العملاء', icon: '👥', description: 'أداء العملاء ومشترياتهم' },
        { id: 'product-sales', name: 'مبيعات المنتجات', icon: '📦', description: 'أداء المنتجات والخدمات' },
        { id: 'sales-rep', name: 'أداء المندوبين', icon: '👨‍💼', description: 'إنتاجية فريق المبيعات' }
      ]
    },
    {
      id: 'accounting',
      title: 'التقارير المحاسبية',
      icon: '📋',
      description: 'تقارير دقيقة للمحاسبة',
      reports: [
        { id: 'general-ledger', name: 'دفتر الأستاذ العام', icon: '📚', description: 'جميع القيود المحاسبية' },
        { id: 'accounts-receivable', name: 'الذمم المدينة', icon: '📄', description: 'المبالغ المستحقة من العملاء' },
        { id: 'accounts-payable', name: 'الذمم الدائنة', icon: '📋', description: 'المبالغ المستحقة للموردين' },
        { id: 'tax-report', name: 'التقرير الضريبي', icon: '🏛️', description: 'تقرير الضريبة المضافة' }
      ]
    },
    {
      id: 'inventory',
      title: 'تقارير المخزون',
      icon: '📦',
      description: 'إدارة وتتبع المخزون',
      reports: [
        { id: 'inventory-summary', name: 'ملخص المخزون', icon: '📊', description: 'الكميات والقيم الحالية' },
        { id: 'inventory-movement', name: 'حركة المخزون', icon: '🔄', description: 'المدخلات والمخرجات' },
        { id: 'low-stock', name: 'نفاد المخزون', icon: '⚠️', description: 'المنتجات منخفضة المخزون' },
        { id: 'inventory-valuation', name: 'تقييم المخزون', icon: '💎', description: 'قيمة المخزون الحالي' }
      ]
    }
  ];

  const sampleData = {
    financial: {
      totalRevenue: 2847500,
      totalExpenses: 1658300,
      netProfit: 1189200,
      profitMargin: 41.8
    },
    sales: {
      totalSales: 2847500,
      numberOfOrders: 456,
      averageOrderValue: 6244,
      topCustomers: 128
    }
  };

  const breadcrumbs = [
    { label: 'الرئيسية', href: '/netsuite' },
    { label: 'التقارير والتحليلات' }
  ];

  const headerActions = (
    <>
      <a href="#" className="netsuite-header-quick-action">
        <div className="netsuite-header-quick-action-icon">📊</div>
        تقرير مخصص
      </a>
      <a href="#" className="netsuite-header-quick-action secondary">
        <div className="netsuite-header-quick-action-icon">📤</div>
        تصدير Excel
      </a>
      <a href="#" className="netsuite-header-quick-action secondary">
        <div className="netsuite-header-quick-action-icon">📄</div>
        تصدير PDF
      </a>
    </>
  );

  const getCurrentCategoryData = () => {
    return reportCategories.find(cat => cat.id === selectedReport) || reportCategories[0];
  };

  return (
    <NetSuiteLayout
      title="التقارير والتحليلات"
      subtitle="تقارير شاملة لجميع العمليات المالية والإدارية"
      icon="📊"
      breadcrumbs={breadcrumbs}
      actions={headerActions}
    >
      {/* Quick Stats */}
      <div className="netsuite-card-grid netsuite-card-grid-4" style={{ marginBottom: 'var(--netsuite-spacing-xl)' }}>
        <div className="netsuite-stats-card">
          <div className="netsuite-stats-header">
            <div className="netsuite-stats-icon">💰</div>
            <div className="netsuite-stats-trend positive">
              <span>↗</span>
              <span>+12.5%</span>
            </div>
          </div>
          <div className="netsuite-stats-value">2,847,500</div>
          <div className="netsuite-stats-label">إجمالي الإيرادات</div>
          <div className="netsuite-stats-detail">
            <span>📅</span>
            <span>هذا الشهر</span>
          </div>
        </div>

        <div className="netsuite-stats-card">
          <div className="netsuite-stats-header">
            <div className="netsuite-stats-icon">📉</div>
            <div className="netsuite-stats-trend neutral">
              <span>→</span>
              <span>+2.3%</span>
            </div>
          </div>
          <div className="netsuite-stats-value">1,658,300</div>
          <div className="netsuite-stats-label">إجمالي المصروفات</div>
          <div className="netsuite-stats-detail">
            <span>💸</span>
            <span>تشمل التشغيلية</span>
          </div>
        </div>

        <div className="netsuite-stats-card">
          <div className="netsuite-stats-header">
            <div className="netsuite-stats-icon">📈</div>
            <div className="netsuite-stats-trend positive">
              <span>↗</span>
              <span>+18.7%</span>
            </div>
          </div>
          <div className="netsuite-stats-value">1,189,200</div>
          <div className="netsuite-stats-label">صافي الربح</div>
          <div className="netsuite-stats-detail">
            <span>🎯</span>
            <span>هامش 41.8%</span>
          </div>
        </div>

        <div className="netsuite-stats-card">
          <div className="netsuite-stats-header">
            <div className="netsuite-stats-icon">📋</div>
            <div className="netsuite-stats-trend positive">
              <span>↗</span>
              <span>+7.2%</span>
            </div>
          </div>
          <div className="netsuite-stats-value">89</div>
          <div className="netsuite-stats-label">التقارير المتاحة</div>
          <div className="netsuite-stats-detail">
            <span>🔄</span>
            <span>محدثة تلقائياً</span>
          </div>
        </div>
      </div>

      {/* Report Categories */}
      <div className="netsuite-card-advanced" style={{ marginBottom: 'var(--netsuite-spacing-xl)' }}>
        <div className="netsuite-card-header-advanced">
          <div className="netsuite-card-title-section">
            <div className="netsuite-card-title-icon">📑</div>
            <div className="netsuite-card-title-text">
              <h3 className="netsuite-card-title-advanced">فئات التقارير</h3>
              <p className="netsuite-card-subtitle-advanced">اختر فئة التقارير المطلوبة</p>
            </div>
          </div>
        </div>
        <div className="netsuite-card-content-advanced">
          <div className="netsuite-card-grid netsuite-card-grid-4">
            {reportCategories.map((category) => (
              <div
                key={category.id}
                className={`netsuite-card-advanced ${selectedReport === category.id ? 'selected' : ''}`}
                style={{
                  cursor: 'pointer',
                  border: selectedReport === category.id ? '2px solid rgb(var(--netsuite-primary))' : undefined,
                  backgroundColor: selectedReport === category.id ? 'rgb(var(--netsuite-primary) / 0.05)' : undefined
                }}
                onClick={() => setSelectedReport(category.id)}
              >
                <div className="netsuite-card-content-advanced" style={{ textAlign: 'center', padding: 'var(--netsuite-spacing-lg)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: 'var(--netsuite-spacing-md)' }}>
                    {category.icon}
                  </div>
                  <h4 style={{ 
                    margin: '0 0 var(--netsuite-spacing-sm) 0', 
                    color: 'rgb(var(--netsuite-text-primary))',
                    fontSize: 'var(--netsuite-font-size-lg)',
                    fontWeight: '600'
                  }}>
                    {category.title}
                  </h4>
                  <p style={{ 
                    margin: 0, 
                    color: 'rgb(var(--netsuite-text-secondary))',
                    fontSize: 'var(--netsuite-font-size-sm)'
                  }}>
                    {category.description}
                  </p>
                  <div className="netsuite-badge netsuite-badge-primary" style={{ marginTop: 'var(--netsuite-spacing-md)' }}>
                    {category.reports.length} تقرير
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Selected Category Reports */}
      <div className="netsuite-table-container">
        <div className="netsuite-table-header">
          <h2 className="netsuite-table-title">
            <div className="netsuite-table-title-icon">{getCurrentCategoryData().icon}</div>
            {getCurrentCategoryData().title}
          </h2>
          <div className="netsuite-table-controls">
            <select 
              className="netsuite-input"
              value={reportPeriod}
              onChange={(e) => setReportPeriod(e.target.value)}
              style={{ minWidth: '150px' }}
            >
              <option value="daily">يومي</option>
              <option value="weekly">أسبوعي</option>
              <option value="monthly">شهري</option>
              <option value="quarterly">ربع سنوي</option>
              <option value="yearly">سنوي</option>
            </select>
            <button className="netsuite-table-filter-btn">
              <span>📅</span>
              <span>فترة مخصصة</span>
            </button>
          </div>
        </div>
        
        <table className="netsuite-table-advanced">
          <thead>
            <tr>
              <th>التقرير</th>
              <th>الوصف</th>
              <th>آخر تحديث</th>
              <th>الحالة</th>
              <th>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {getCurrentCategoryData().reports.map((report) => (
              <tr key={report.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--netsuite-spacing-md)' }}>
                    <span style={{ fontSize: 'var(--netsuite-font-size-lg)' }}>
                      {report.icon}
                    </span>
                    <div>
                      <div style={{ fontWeight: '600', color: 'rgb(var(--netsuite-text-primary))' }}>
                        {report.name}
                      </div>
                    </div>
                  </div>
                </td>
                <td style={{ color: 'rgb(var(--netsuite-text-secondary))' }}>
                  {report.description}
                </td>
                <td>
                  <div style={{ fontSize: 'var(--netsuite-font-size-sm)', color: 'rgb(var(--netsuite-text-secondary))' }}>
                    منذ {Math.floor(Math.random() * 60 + 1)} دقيقة
                  </div>
                </td>
                <td>
                  <div className="netsuite-table-status active">
                    <div className="netsuite-table-status-indicator"></div>
                    متاح
                  </div>
                </td>
                <td>
                  <div className="netsuite-table-actions">
                    <button className="netsuite-table-action-btn" title="عرض التقرير">
                      <div className="netsuite-table-action-icon">👁</div>
                    </button>
                    <button className="netsuite-table-action-btn" title="تصدير PDF">
                      <div className="netsuite-table-action-icon">📄</div>
                    </button>
                    <button className="netsuite-table-action-btn" title="تصدير Excel">
                      <div className="netsuite-table-action-icon">📊</div>
                    </button>
                    <button className="netsuite-table-action-btn" title="جدولة التقرير">
                      <div className="netsuite-table-action-icon">📅</div>
                    </button>
                    <button className="netsuite-table-action-btn" title="مشاركة">
                      <div className="netsuite-table-action-icon">📤</div>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recent Reports */}
      <div className="netsuite-card-advanced" style={{ marginTop: 'var(--netsuite-spacing-xl)' }}>
        <div className="netsuite-card-header-advanced">
          <div className="netsuite-card-title-section">
            <div className="netsuite-card-title-icon">🕒</div>
            <div className="netsuite-card-title-text">
              <h3 className="netsuite-card-title-advanced">التقارير المستخدمة مؤخراً</h3>
              <p className="netsuite-card-subtitle-advanced">الوصول السريع للتقارير المعتادة</p>
            </div>
          </div>
        </div>
        <div className="netsuite-card-content-advanced">
          <div className="netsuite-card-grid netsuite-card-grid-3">
            <div className="netsuite-card-advanced">
              <div className="netsuite-card-content-advanced" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: 'var(--netsuite-spacing-md)' }}>📈</div>
                <h4 style={{ margin: '0 0 var(--netsuite-spacing-sm) 0' }}>الأرباح والخسائر</h4>
                <p style={{ margin: '0 0 var(--netsuite-spacing-md) 0', color: 'rgb(var(--netsuite-text-secondary))', fontSize: 'var(--netsuite-font-size-sm)' }}>
                  آخر عرض: منذ 5 دقائق
                </p>
                <button className="netsuite-btn netsuite-btn-primary" style={{ width: '100%' }}>
                  عرض التقرير
                </button>
              </div>
            </div>

            <div className="netsuite-card-advanced">
              <div className="netsuite-card-content-advanced" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: 'var(--netsuite-spacing-md)' }}>👥</div>
                <h4 style={{ margin: '0 0 var(--netsuite-spacing-sm) 0' }}>تحليل العملاء</h4>
                <p style={{ margin: '0 0 var(--netsuite-spacing-md) 0', color: 'rgb(var(--netsuite-text-secondary))', fontSize: 'var(--netsuite-font-size-sm)' }}>
                  آخر عرض: منذ 15 دقيقة
                </p>
                <button className="netsuite-btn netsuite-btn-secondary" style={{ width: '100%' }}>
                  عرض التقرير
                </button>
              </div>
            </div>

            <div className="netsuite-card-advanced">
              <div className="netsuite-card-content-advanced" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: 'var(--netsuite-spacing-md)' }}>💸</div>
                <h4 style={{ margin: '0 0 var(--netsuite-spacing-sm) 0' }}>التدفق النقدي</h4>
                <p style={{ margin: '0 0 var(--netsuite-spacing-md) 0', color: 'rgb(var(--netsuite-text-secondary))', fontSize: 'var(--netsuite-font-size-sm)' }}>
                  آخر عرض: منذ 30 دقيقة
                </p>
                <button className="netsuite-btn netsuite-btn-secondary" style={{ width: '100%' }}>
                  عرض التقرير
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </NetSuiteLayout>
  );
};

export default NetSuiteReports;