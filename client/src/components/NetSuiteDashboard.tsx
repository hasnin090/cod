import React from 'react';
import NetSuiteDashboardContent from './content/NetSuiteDashboardContent';

// NetSuite-style Dashboard Component
export const NetSuiteDashboard: React.FC = () => {
  return <NetSuiteDashboardContent />;
};

export default NetSuiteDashboard;
  return (
    <div className="netsuite-container">
      {/* NetSuite Sidebar */}
      <div className="netsuite-sidebar-advanced">
        {/* Sidebar Header */}
        <div className="netsuite-sidebar-header-advanced">
          <div className="netsuite-sidebar-logo-advanced">
            <div className="netsuite-sidebar-logo-icon">NS</div>
            <div>
              <div className="netsuite-sidebar-logo-text">نظام المحاسبة</div>
              <div className="netsuite-sidebar-logo-subtitle">NetSuite Style</div>
            </div>
          </div>
        </div>

        {/* User Profile Section */}
        <div className="netsuite-sidebar-user">
          <div className="netsuite-sidebar-user-info">
            <div className="netsuite-sidebar-user-avatar">أح</div>
            <div className="netsuite-sidebar-user-details">
              <h4>أحمد محمد</h4>
              <p>مدير المحاسبة</p>
            </div>
          </div>
          <div className="netsuite-sidebar-user-actions">
            <a href="#" className="netsuite-sidebar-user-btn">الملف الشخصي</a>
            <a href="#" className="netsuite-sidebar-user-btn">الإعدادات</a>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="netsuite-sidebar-quick-actions">
          <div className="netsuite-quick-actions-title">إجراءات سريعة</div>
          <div className="netsuite-quick-actions-grid">
            <a href="#" className="netsuite-quick-action">
              <div className="netsuite-quick-action-icon">+</div>
              <div className="netsuite-quick-action-text">فاتورة جديدة</div>
            </a>
            <a href="#" className="netsuite-quick-action">
              <div className="netsuite-quick-action-icon">📊</div>
              <div className="netsuite-quick-action-text">تقرير مالي</div>
            </a>
            <a href="#" className="netsuite-quick-action">
              <div className="netsuite-quick-action-icon">👥</div>
              <div className="netsuite-quick-action-text">عميل جديد</div>
            </a>
            <a href="#" className="netsuite-quick-action">
              <div className="netsuite-quick-action-icon">💰</div>
              <div className="netsuite-quick-action-text">دفعة جديدة</div>
            </a>
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="netsuite-sidebar-nav-advanced">
          {/* Dashboard Section */}
          <div className="netsuite-sidebar-section-advanced">
            <div className="netsuite-sidebar-section-header">
              <div className="netsuite-sidebar-section-title-advanced">لوحة التحكم</div>
            </div>
            <a href="#" className="netsuite-sidebar-link-advanced active">
              <div className="netsuite-sidebar-icon-advanced">🏠</div>
              <div className="netsuite-sidebar-link-text">الرئيسية</div>
            </a>
            <a href="#" className="netsuite-sidebar-link-advanced">
              <div className="netsuite-sidebar-icon-advanced">📈</div>
              <div className="netsuite-sidebar-link-text">التحليلات</div>
            </a>
          </div>

          {/* Transactions Section */}
          <div className="netsuite-sidebar-section-advanced">
            <div className="netsuite-sidebar-section-header">
              <div className="netsuite-sidebar-section-title-advanced">المعاملات</div>
              <div className="netsuite-sidebar-section-badge">12</div>
            </div>
            <a href="#" className="netsuite-sidebar-link-advanced">
              <div className="netsuite-sidebar-icon-advanced">📄</div>
              <div className="netsuite-sidebar-link-text">الفواتير</div>
              <div className="netsuite-sidebar-link-badge">5</div>
            </a>
            <a href="#" className="netsuite-sidebar-link-advanced">
              <div className="netsuite-sidebar-icon-advanced">💳</div>
              <div className="netsuite-sidebar-link-text">المدفوعات</div>
            </a>
            <a href="#" className="netsuite-sidebar-link-advanced">
              <div className="netsuite-sidebar-icon-advanced">🧾</div>
              <div className="netsuite-sidebar-link-text">المصروفات</div>
            </a>
          </div>

          {/* Customers Section */}
          <div className="netsuite-sidebar-section-advanced">
            <div className="netsuite-sidebar-section-header">
              <div className="netsuite-sidebar-section-title-advanced">العملاء</div>
            </div>
            <a href="#" className="netsuite-sidebar-link-advanced">
              <div className="netsuite-sidebar-icon-advanced">👥</div>
              <div className="netsuite-sidebar-link-text">قائمة العملاء</div>
            </a>
            <a href="#" className="netsuite-sidebar-link-advanced">
              <div className="netsuite-sidebar-icon-advanced">📞</div>
              <div className="netsuite-sidebar-link-text">جهات الاتصال</div>
            </a>
          </div>

          {/* Reports Section */}
          <div className="netsuite-sidebar-section-advanced">
            <div className="netsuite-sidebar-section-header">
              <div className="netsuite-sidebar-section-title-advanced">التقارير</div>
            </div>
            <a href="#" className="netsuite-sidebar-link-advanced">
              <div className="netsuite-sidebar-icon-advanced">📊</div>
              <div className="netsuite-sidebar-link-text">التقارير المالية</div>
            </a>
            <a href="#" className="netsuite-sidebar-link-advanced">
              <div className="netsuite-sidebar-icon-advanced">📋</div>
              <div className="netsuite-sidebar-link-text">تقارير المبيعات</div>
            </a>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="netsuite-sidebar-footer">
          <div className="netsuite-sidebar-footer-links">
            <a href="#" className="netsuite-sidebar-footer-link">المساعدة</a>
            <a href="#" className="netsuite-sidebar-footer-link">الدعم الفني</a>
          </div>
          <div className="netsuite-sidebar-footer-info">
            نسخة 2024.1<br />
            © نظام المحاسبة
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="netsuite-main">
        {/* Header Status Bar */}
        <div className="netsuite-header-status-bar">
          <div className="netsuite-header-status-left">
            <div className="netsuite-header-status-item">
              <div className="netsuite-header-status-icon">🌐</div>
              <span>متصل</span>
            </div>
            <div className="netsuite-header-status-item">
              <div className="netsuite-header-status-icon">💾</div>
              <span>تم الحفظ آخر مرة: منذ 2 دقائق</span>
            </div>
          </div>
          <div className="netsuite-header-status-right">
            <div className="netsuite-header-status-indicator"></div>
            <span>جميع الأنظمة تعمل</span>
          </div>
        </div>

        {/* Main Header */}
        <div className="netsuite-header-advanced">
          <div className="netsuite-header-left">
            <div className="netsuite-header-breadcrumb">
              <a href="#" className="netsuite-breadcrumb-item">الرئيسية</a>
              <span className="netsuite-breadcrumb-separator">›</span>
              <span className="netsuite-breadcrumb-item active">لوحة التحكم</span>
            </div>
            <h1 className="netsuite-header-title-advanced">
              <div className="netsuite-header-title-icon">📊</div>
              لوحة التحكم الرئيسية
            </h1>
          </div>
          
          <div className="netsuite-header-right">
            {/* Search */}
            <div className="netsuite-header-search">
              <div className="netsuite-header-search-icon">🔍</div>
              <input 
                type="text" 
                className="netsuite-header-search-input"
                placeholder="البحث في النظام..."
              />
              <button className="netsuite-header-search-button">
                <span>🔍</span>
              </button>
            </div>

            {/* Quick Actions */}
            <div className="netsuite-header-quick-actions">
              <a href="#" className="netsuite-header-quick-action">
                <div className="netsuite-header-quick-action-icon">+</div>
                جديد
              </a>
              <a href="#" className="netsuite-header-quick-action secondary">
                <div className="netsuite-header-quick-action-icon">📤</div>
                تصدير
              </a>
            </div>

            {/* Notifications */}
            <button className="netsuite-header-action">
              <div className="netsuite-header-action-icon">🔔</div>
              <div className="netsuite-header-action-badge">3</div>
            </button>

            {/* Messages */}
            <button className="netsuite-header-action">
              <div className="netsuite-header-action-icon">✉️</div>
              <div className="netsuite-header-action-badge">7</div>
            </button>

            {/* Profile */}
            <div className="netsuite-header-profile">
              <button className="netsuite-header-profile-button">
                <div className="netsuite-header-profile-avatar">أح</div>
                <div className="netsuite-header-profile-info">
                  <div className="netsuite-header-profile-name">أحمد محمد</div>
                  <div className="netsuite-header-profile-role">مدير المحاسبة</div>
                </div>
                <div className="netsuite-header-profile-arrow">▼</div>
              </button>
            </div>
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="netsuite-content">
          {/* Statistics Cards */}
          <div className="netsuite-card-grid netsuite-card-grid-4">
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
                <div className="netsuite-stats-icon">👥</div>
                <div className="netsuite-stats-trend positive">
                  <span>↗</span>
                  <span>+8.2%</span>
                </div>
              </div>
              <div className="netsuite-stats-value">1,235</div>
              <div className="netsuite-stats-label">عدد العملاء</div>
              <div className="netsuite-stats-detail">
                <span>🔄</span>
                <span>عملاء نشطون</span>
              </div>
            </div>

            <div className="netsuite-stats-card">
              <div className="netsuite-stats-header">
                <div className="netsuite-stats-icon">📄</div>
                <div className="netsuite-stats-trend neutral">
                  <span>→</span>
                  <span>+2.1%</span>
                </div>
              </div>
              <div className="netsuite-stats-value">456</div>
              <div className="netsuite-stats-label">الفواتير</div>
              <div className="netsuite-stats-detail">
                <span>⏳</span>
                <span>في انتظار الدفع</span>
              </div>
            </div>

            <div className="netsuite-stats-card">
              <div className="netsuite-stats-header">
                <div className="netsuite-stats-icon">📊</div>
                <div className="netsuite-stats-trend negative">
                  <span>↘</span>
                  <span>-3.5%</span>
                </div>
              </div>
              <div className="netsuite-stats-value">89.2%</div>
              <div className="netsuite-stats-label">معدل التحصيل</div>
              <div className="netsuite-stats-detail">
                <span>📈</span>
                <span>المتوسط الشهري</span>
              </div>
            </div>
          </div>

          {/* Recent Transactions Table */}
          <div className="netsuite-table-container" style={{ marginTop: 'var(--netsuite-spacing-xl)' }}>
            <div className="netsuite-table-header">
              <h2 className="netsuite-table-title">
                <div className="netsuite-table-title-icon">📋</div>
                المعاملات الأخيرة
              </h2>
              <div className="netsuite-table-controls">
                <div className="netsuite-table-search">
                  <div className="netsuite-table-search-icon">🔍</div>
                  <input 
                    type="text" 
                    className="netsuite-table-search-input"
                    placeholder="البحث في المعاملات..."
                  />
                </div>
                <button className="netsuite-table-filter-btn">
                  <span>🔽</span>
                  <span>تصفية</span>
                </button>
              </div>
            </div>
            
            <table className="netsuite-table-advanced">
              <thead>
                <tr>
                  <th className="sortable">رقم المعاملة</th>
                  <th className="sortable">العميل</th>
                  <th className="sortable">المبلغ</th>
                  <th className="sortable">التاريخ</th>
                  <th>الحالة</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>#INV-2024-001</td>
                  <td>شركة التجارة الحديثة</td>
                  <td style={{ color: 'rgb(var(--netsuite-success))', fontWeight: '600' }}>75,000 ر.س</td>
                  <td>2024-09-12</td>
                  <td>
                    <div className="netsuite-table-status active">
                      <div className="netsuite-table-status-indicator"></div>
                      مدفوع
                    </div>
                  </td>
                  <td>
                    <div className="netsuite-table-actions">
                      <button className="netsuite-table-action-btn">
                        <div className="netsuite-table-action-icon">👁</div>
                      </button>
                      <button className="netsuite-table-action-btn">
                        <div className="netsuite-table-action-icon">✏️</div>
                      </button>
                      <button className="netsuite-table-action-btn">
                        <div className="netsuite-table-action-icon">🖨</div>
                      </button>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td>#INV-2024-002</td>
                  <td>مؤسسة الأعمال المتطورة</td>
                  <td style={{ color: 'rgb(var(--netsuite-warning))', fontWeight: '600' }}>45,500 ر.س</td>
                  <td>2024-09-11</td>
                  <td>
                    <div className="netsuite-table-status pending">
                      <div className="netsuite-table-status-indicator"></div>
                      معلق
                    </div>
                  </td>
                  <td>
                    <div className="netsuite-table-actions">
                      <button className="netsuite-table-action-btn">
                        <div className="netsuite-table-action-icon">👁</div>
                      </button>
                      <button className="netsuite-table-action-btn">
                        <div className="netsuite-table-action-icon">✏️</div>
                      </button>
                      <button className="netsuite-table-action-btn">
                        <div className="netsuite-table-action-icon">📤</div>
                      </button>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td>#INV-2024-003</td>
                  <td>شركة الابتكار التقني</td>
                  <td style={{ color: 'rgb(var(--netsuite-success))', fontWeight: '600' }}>128,750 ر.س</td>
                  <td>2024-09-10</td>
                  <td>
                    <div className="netsuite-table-status active">
                      <div className="netsuite-table-status-indicator"></div>
                      مدفوع
                    </div>
                  </td>
                  <td>
                    <div className="netsuite-table-actions">
                      <button className="netsuite-table-action-btn">
                        <div className="netsuite-table-action-icon">👁</div>
                      </button>
                      <button className="netsuite-table-action-btn">
                        <div className="netsuite-table-action-icon">✏️</div>
                      </button>
                      <button className="netsuite-table-action-btn">
                        <div className="netsuite-table-action-icon">🖨</div>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            
            <div className="netsuite-table-footer">
              <div className="netsuite-table-info">
                عرض 1-3 من 156 معاملة
              </div>
              <div className="netsuite-table-pagination">
                <button className="netsuite-pagination-btn" disabled>‹</button>
                <button className="netsuite-pagination-btn active">1</button>
                <button className="netsuite-pagination-btn">2</button>
                <button className="netsuite-pagination-btn">3</button>
                <button className="netsuite-pagination-btn">›</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetSuiteDashboard;
