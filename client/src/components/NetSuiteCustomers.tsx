import React, { useState } from 'react';
import NetSuiteLayout from '@/components/NetSuiteLayout';

const NetSuiteCustomers: React.FC = () => {
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const customers = [
    {
      id: 'CUST-001',
      name: 'شركة التجارة الحديثة',
      email: 'info@modern-trade.com',
      phone: '+966501234567',
      city: 'الرياض',
      status: 'active',
      balance: 75000,
      totalOrders: 24,
      lastOrder: '2024-09-10',
      customerSince: '2023-01-15',
      creditLimit: 100000,
      category: 'enterprise'
    },
    {
      id: 'CUST-002',
      name: 'مؤسسة الأعمال المتطورة',
      email: 'contact@advanced-business.sa',
      phone: '+966507654321',
      city: 'جدة',
      status: 'active',
      balance: 45500,
      totalOrders: 18,
      lastOrder: '2024-09-08',
      customerSince: '2023-03-22',
      creditLimit: 80000,
      category: 'medium'
    },
    {
      id: 'CUST-003',
      name: 'شركة الابتكار التقني',
      email: 'hello@tech-innovation.sa',
      phone: '+966512345678',
      city: 'الدمام',
      status: 'active',
      balance: -12500,
      totalOrders: 31,
      lastOrder: '2024-09-12',
      customerSince: '2022-11-08',
      creditLimit: 150000,
      category: 'enterprise'
    },
    {
      id: 'CUST-004',
      name: 'مجموعة النجاح التجارية',
      email: 'sales@success-group.com',
      phone: '+966598765432',
      city: 'مكة المكرمة',
      status: 'inactive',
      balance: 0,
      totalOrders: 7,
      lastOrder: '2024-08-15',
      customerSince: '2024-02-10',
      creditLimit: 50000,
      category: 'small'
    },
    {
      id: 'CUST-005',
      name: 'شركة التطوير الشامل',
      email: 'info@comprehensive-dev.sa',
      phone: '+966523456789',
      city: 'المدينة المنورة',
      status: 'active',
      balance: 89200,
      totalOrders: 42,
      lastOrder: '2024-09-11',
      customerSince: '2022-06-30',
      creditLimit: 200000,
      category: 'enterprise'
    }
  ];

  const getStatusBadge = (status: string) => {
    const statusMap = {
      active: { class: 'active', text: 'نشط', icon: '✅' },
      inactive: { class: 'inactive', text: 'غير نشط', icon: '❌' },
      suspended: { class: 'pending', text: 'معلق', icon: '⏸️' },
      pending: { class: 'draft', text: 'في الانتظار', icon: '⏳' }
    };
    const config = statusMap[status as keyof typeof statusMap] || statusMap.active;
    
    return (
      <div className={`netsuite-table-status ${config.class}`}>
        <div className="netsuite-table-status-indicator"></div>
        <span>{config.text}</span>
      </div>
    );
  };

  const getCategoryBadge = (category: string) => {
    const categoryMap = {
      enterprise: { class: 'netsuite-badge-primary', text: 'مؤسسي', icon: '🏢' },
      medium: { class: 'netsuite-badge-success', text: 'متوسط', icon: '🏪' },
      small: { class: 'netsuite-badge-warning', text: 'صغير', icon: '🏬' }
    };
    const config = categoryMap[category as keyof typeof categoryMap] || categoryMap.small;
    
    return (
      <div className={`netsuite-badge ${config.class}`}>
        {config.icon} {config.text}
      </div>
    );
  };

  const formatBalance = (balance: number) => {
    const isNegative = balance < 0;
    const absBalance = Math.abs(balance);
    const formatted = new Intl.NumberFormat('ar-SA', {
      style: 'currency',
      currency: 'SAR',
      minimumFractionDigits: 0
    }).format(absBalance);
    
    return (
      <span style={{ 
        color: isNegative ? 'rgb(var(--netsuite-error))' : balance > 0 ? 'rgb(var(--netsuite-success))' : 'rgb(var(--netsuite-text-secondary))',
        fontWeight: '600'
      }}>
        {isNegative ? 'مدين: ' : balance > 0 ? 'دائن: ' : ''}{formatted}
      </span>
    );
  };

  const filteredCustomers = customers.filter(customer => {
    const matchesStatus = filterStatus === 'all' || customer.status === filterStatus;
    const matchesSearch = customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer.id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const breadcrumbs = [
    { label: 'الرئيسية', href: '/netsuite' },
    { label: 'إدارة العملاء' }
  ];

  const headerActions = (
    <>
      <a href="#" className="netsuite-header-quick-action">
        <div className="netsuite-header-quick-action-icon">+</div>
        عميل جديد
      </a>
      <a href="#" className="netsuite-header-quick-action secondary">
        <div className="netsuite-header-quick-action-icon">📤</div>
        تصدير قائمة
      </a>
      <a href="#" className="netsuite-header-quick-action secondary">
        <div className="netsuite-header-quick-action-icon">📧</div>
        رسائل جماعية
      </a>
    </>
  );

  return (
    <NetSuiteLayout
      title="إدارة العملاء"
      subtitle="قاعدة بيانات شاملة لجميع العملاء والمعلومات المالية"
      icon="👥"
      breadcrumbs={breadcrumbs}
      actions={headerActions}
    >
      {/* Customer Statistics */}
      <div className="netsuite-card-grid netsuite-card-grid-4" style={{ marginBottom: 'var(--netsuite-spacing-xl)' }}>
        <div className="netsuite-stats-card">
          <div className="netsuite-stats-header">
            <div className="netsuite-stats-icon">👥</div>
            <div className="netsuite-stats-trend positive">
              <span>↗</span>
              <span>+8.2%</span>
            </div>
          </div>
          <div className="netsuite-stats-value">1,235</div>
          <div className="netsuite-stats-label">إجمالي العملاء</div>
          <div className="netsuite-stats-detail">
            <span>✅</span>
            <span>1,186 نشط</span>
          </div>
        </div>

        <div className="netsuite-stats-card">
          <div className="netsuite-stats-header">
            <div className="netsuite-stats-icon">🆕</div>
            <div className="netsuite-stats-trend positive">
              <span>↗</span>
              <span>+15.7%</span>
            </div>
          </div>
          <div className="netsuite-stats-value">42</div>
          <div className="netsuite-stats-label">عملاء جدد</div>
          <div className="netsuite-stats-detail">
            <span>📅</span>
            <span>هذا الشهر</span>
          </div>
        </div>

        <div className="netsuite-stats-card">
          <div className="netsuite-stats-header">
            <div className="netsuite-stats-icon">💰</div>
            <div className="netsuite-stats-trend positive">
              <span>↗</span>
              <span>+12.3%</span>
            </div>
          </div>
          <div className="netsuite-stats-value">2,847,500</div>
          <div className="netsuite-stats-label">مجموع الأرصدة</div>
          <div className="netsuite-stats-detail">
            <span>📊</span>
            <span>ريال سعودي</span>
          </div>
        </div>

        <div className="netsuite-stats-card">
          <div className="netsuite-stats-header">
            <div className="netsuite-stats-icon">📈</div>
            <div className="netsuite-stats-trend positive">
              <span>↗</span>
              <span>+6.8%</span>
            </div>
          </div>
          <div className="netsuite-stats-value">6,244</div>
          <div className="netsuite-stats-label">متوسط قيمة الطلب</div>
          <div className="netsuite-stats-detail">
            <span>💳</span>
            <span>ريال سعودي</span>
          </div>
        </div>
      </div>

      {/* View Controls */}
      <div className="netsuite-card-advanced" style={{ marginBottom: 'var(--netsuite-spacing-lg)' }}>
        <div className="netsuite-card-content-advanced">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--netsuite-spacing-lg)' }}>
            {/* Status Filter */}
            <div style={{ display: 'flex', gap: 'var(--netsuite-spacing-sm)' }}>
              {[
                { key: 'all', label: 'جميع العملاء', count: customers.length },
                { key: 'active', label: 'نشط', count: customers.filter(c => c.status === 'active').length },
                { key: 'inactive', label: 'غير نشط', count: customers.filter(c => c.status === 'inactive').length }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFilterStatus(tab.key)}
                  className={`netsuite-btn ${filterStatus === tab.key ? 'netsuite-btn-primary' : 'netsuite-btn-secondary'}`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>

            {/* View Mode Toggle */}
            <div style={{ display: 'flex', gap: 'var(--netsuite-spacing-xs)', background: 'rgb(var(--netsuite-bg-secondary))', padding: '4px', borderRadius: 'var(--netsuite-radius-md)' }}>
              <button
                onClick={() => setViewMode('list')}
                className={`netsuite-btn ${viewMode === 'list' ? 'netsuite-btn-primary' : 'netsuite-btn-secondary'}`}
                style={{ padding: 'var(--netsuite-spacing-xs) var(--netsuite-spacing-sm)' }}
              >
                📋 قائمة
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`netsuite-btn ${viewMode === 'cards' ? 'netsuite-btn-primary' : 'netsuite-btn-secondary'}`}
                style={{ padding: 'var(--netsuite-spacing-xs) var(--netsuite-spacing-sm)' }}
              >
                🃏 بطاقات
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Customers Display */}
      {viewMode === 'list' ? (
        /* List View */
        <div className="netsuite-table-container">
          <div className="netsuite-table-header">
            <h2 className="netsuite-table-title">
              <div className="netsuite-table-title-icon">👥</div>
              قائمة العملاء
            </h2>
            <div className="netsuite-table-controls">
              <div className="netsuite-table-search">
                <div className="netsuite-table-search-icon">🔍</div>
                <input 
                  type="text" 
                  className="netsuite-table-search-input"
                  placeholder="البحث في العملاء..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
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
                <th className="sortable">العميل</th>
                <th className="sortable">جهة الاتصال</th>
                <th className="sortable">المدينة</th>
                <th className="sortable">الرصيد</th>
                <th className="sortable">عدد الطلبات</th>
                <th className="sortable">آخر طلب</th>
                <th>التصنيف</th>
                <th>الحالة</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    <div>
                      <div style={{ fontWeight: '600', color: 'rgb(var(--netsuite-text-primary))' }}>
                        {customer.name}
                      </div>
                      <div style={{ fontSize: 'var(--netsuite-font-size-sm)', color: 'rgb(var(--netsuite-text-secondary))' }}>
                        {customer.id}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div>
                      <div style={{ fontSize: 'var(--netsuite-font-size-sm)' }}>{customer.email}</div>
                      <div style={{ fontSize: 'var(--netsuite-font-size-sm)', color: 'rgb(var(--netsuite-text-secondary))' }}>
                        {customer.phone}
                      </div>
                    </div>
                  </td>
                  <td>{customer.city}</td>
                  <td>{formatBalance(customer.balance)}</td>
                  <td style={{ textAlign: 'center', fontWeight: '600' }}>{customer.totalOrders}</td>
                  <td>{customer.lastOrder}</td>
                  <td>{getCategoryBadge(customer.category)}</td>
                  <td>{getStatusBadge(customer.status)}</td>
                  <td>
                    <div className="netsuite-table-actions">
                      <button className="netsuite-table-action-btn" title="عرض التفاصيل">
                        <div className="netsuite-table-action-icon">👁</div>
                      </button>
                      <button className="netsuite-table-action-btn" title="تعديل">
                        <div className="netsuite-table-action-icon">✏️</div>
                      </button>
                      <button className="netsuite-table-action-btn" title="كشف حساب">
                        <div className="netsuite-table-action-icon">📄</div>
                      </button>
                      <button className="netsuite-table-action-btn" title="إرسال رسالة">
                        <div className="netsuite-table-action-icon">📧</div>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div className="netsuite-table-footer">
            <div className="netsuite-table-info">
              عرض 1-{filteredCustomers.length} من {customers.length} عميل
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
      ) : (
        /* Cards View */
        <div className="netsuite-card-grid netsuite-card-grid-3">
          {filteredCustomers.map((customer) => (
            <div key={customer.id} className="netsuite-card-advanced">
              <div className="netsuite-card-header-advanced">
                <div className="netsuite-card-title-section">
                  <div className="netsuite-card-title-icon">👤</div>
                  <div className="netsuite-card-title-text">
                    <h3 className="netsuite-card-title-advanced">{customer.name}</h3>
                    <p className="netsuite-card-subtitle-advanced">{customer.id}</p>
                  </div>
                </div>
                <div className="netsuite-card-actions">
                  {getStatusBadge(customer.status)}
                </div>
              </div>
              <div className="netsuite-card-content-advanced">
                <div style={{ marginBottom: 'var(--netsuite-spacing-md)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--netsuite-spacing-sm)' }}>
                    <span style={{ color: 'rgb(var(--netsuite-text-secondary))' }}>الرصيد:</span>
                    {formatBalance(customer.balance)}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--netsuite-spacing-sm)' }}>
                    <span style={{ color: 'rgb(var(--netsuite-text-secondary))' }}>عدد الطلبات:</span>
                    <span style={{ fontWeight: '600' }}>{customer.totalOrders}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--netsuite-spacing-sm)' }}>
                    <span style={{ color: 'rgb(var(--netsuite-text-secondary))' }}>آخر طلب:</span>
                    <span>{customer.lastOrder}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--netsuite-spacing-md)' }}>
                    <span style={{ color: 'rgb(var(--netsuite-text-secondary))' }}>التصنيف:</span>
                    {getCategoryBadge(customer.category)}
                  </div>
                </div>
                
                <div style={{ borderTop: '1px solid rgb(var(--netsuite-border-secondary))', paddingTop: 'var(--netsuite-spacing-md)' }}>
                  <div style={{ fontSize: 'var(--netsuite-font-size-sm)', color: 'rgb(var(--netsuite-text-secondary))', marginBottom: 'var(--netsuite-spacing-xs)' }}>
                    📧 {customer.email}
                  </div>
                  <div style={{ fontSize: 'var(--netsuite-font-size-sm)', color: 'rgb(var(--netsuite-text-secondary))', marginBottom: 'var(--netsuite-spacing-md)' }}>
                    📱 {customer.phone}
                  </div>
                  
                  <div style={{ display: 'flex', gap: 'var(--netsuite-spacing-xs)' }}>
                    <button className="netsuite-btn netsuite-btn-primary" style={{ flex: 1, fontSize: 'var(--netsuite-font-size-sm)' }}>
                      عرض التفاصيل
                    </button>
                    <button className="netsuite-btn netsuite-btn-secondary" style={{ padding: 'var(--netsuite-spacing-sm)' }}>
                      ✏️
                    </button>
                    <button className="netsuite-btn netsuite-btn-secondary" style={{ padding: 'var(--netsuite-spacing-sm)' }}>
                      📧
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </NetSuiteLayout>
  );
};

export default NetSuiteCustomers;