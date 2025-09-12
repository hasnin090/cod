import React, { ReactNode } from 'react';
import { Link } from 'wouter';

interface NetSuiteLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  icon?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  actions?: ReactNode;
}

export const NetSuiteLayout: React.FC<NetSuiteLayoutProps> = ({
  children,
  title,
  subtitle,
  icon = '📊',
  breadcrumbs = [{ label: 'الرئيسية', href: '#' }],
  actions
}) => {
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
            <Link href="/" className="netsuite-sidebar-link-advanced">
              <div className="netsuite-sidebar-icon-advanced">🏠</div>
              <div className="netsuite-sidebar-link-text">الرئيسية</div>
            </Link>
            <Link href="/reports" className="netsuite-sidebar-link-advanced">
              <div className="netsuite-sidebar-icon-advanced">📈</div>
              <div className="netsuite-sidebar-link-text">التحليلات</div>
            </Link>
          </div>

          {/* Transactions Section */}
          <div className="netsuite-sidebar-section-advanced">
            <div className="netsuite-sidebar-section-header">
              <div className="netsuite-sidebar-section-title-advanced">المعاملات</div>
              <div className="netsuite-sidebar-section-badge">12</div>
            </div>
            <Link href="/transactions" className="netsuite-sidebar-link-advanced">
              <div className="netsuite-sidebar-icon-advanced">📄</div>
              <div className="netsuite-sidebar-link-text">الفواتير</div>
              <div className="netsuite-sidebar-link-badge">5</div>
            </Link>
            <Link href="/deferred-payments" className="netsuite-sidebar-link-advanced">
              <div className="netsuite-sidebar-icon-advanced">💳</div>
              <div className="netsuite-sidebar-link-text">المدفوعات</div>
            </Link>
            <Link href="/transactions" className="netsuite-sidebar-link-advanced">
              <div className="netsuite-sidebar-icon-advanced">🧾</div>
              <div className="netsuite-sidebar-link-text">المصروفات</div>
            </Link>
          </div>

          {/* Customers Section */}
          <div className="netsuite-sidebar-section-advanced">
            <div className="netsuite-sidebar-section-header">
              <div className="netsuite-sidebar-section-title-advanced">العملاء</div>
            </div>
            <Link href="/users" className="netsuite-sidebar-link-advanced">
              <div className="netsuite-sidebar-icon-advanced">👥</div>
              <div className="netsuite-sidebar-link-text">قائمة العملاء</div>
            </Link>
            <Link href="/users" className="netsuite-sidebar-link-advanced">
              <div className="netsuite-sidebar-icon-advanced">📞</div>
              <div className="netsuite-sidebar-link-text">جهات الاتصال</div>
            </Link>
          </div>

          {/* Reports Section */}
          <div className="netsuite-sidebar-section-advanced">
            <div className="netsuite-sidebar-section-header">
              <div className="netsuite-sidebar-section-title-advanced">التقارير</div>
            </div>
            <Link href="/reports" className="netsuite-sidebar-link-advanced">
              <div className="netsuite-sidebar-icon-advanced">📊</div>
              <div className="netsuite-sidebar-link-text">التقارير المالية</div>
            </Link>
            <Link href="/reports" className="netsuite-sidebar-link-advanced">
              <div className="netsuite-sidebar-icon-advanced">📋</div>
              <div className="netsuite-sidebar-link-text">تقارير المبيعات</div>
            </Link>
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
              {breadcrumbs.map((crumb, index) => (
                <React.Fragment key={index}>
                  {index > 0 && <span className="netsuite-breadcrumb-separator">›</span>}
                  {crumb.href ? (
                    <a href={crumb.href} className="netsuite-breadcrumb-item">{crumb.label}</a>
                  ) : (
                    <span className="netsuite-breadcrumb-item active">{crumb.label}</span>
                  )}
                </React.Fragment>
              ))}
            </div>
            <h1 className="netsuite-header-title-advanced">
              <div className="netsuite-header-title-icon">{icon}</div>
              <div>
                {title}
                {subtitle && <div style={{ fontSize: 'var(--netsuite-font-size-sm)', color: 'rgb(var(--netsuite-text-secondary))', fontWeight: 400 }}>{subtitle}</div>}
              </div>
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

            {/* Actions */}
            {actions && (
              <div className="netsuite-header-quick-actions">
                {actions}
              </div>
            )}

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

        {/* Page Content */}
        <div className="netsuite-content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default NetSuiteLayout;