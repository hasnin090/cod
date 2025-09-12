import React, { useState } from 'react';
import NetSuiteLayout from '@/components/NetSuiteLayout';

const NetSuiteTransactions: React.FC = () => {
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const transactions = [
    {
      id: 'INV-2024-001',
      customer: 'شركة التجارة الحديثة',
      amount: 75000,
      date: '2024-09-12',
      status: 'paid',
      type: 'invoice',
      dueDate: '2024-09-25'
    },
    {
      id: 'INV-2024-002',
      customer: 'مؤسسة الأعمال المتطورة',
      amount: 45500,
      date: '2024-09-11',
      status: 'pending',
      type: 'invoice',
      dueDate: '2024-09-26'
    },
    {
      id: 'PAY-2024-003',
      customer: 'شركة الابتكار التقني',
      amount: 128750,
      date: '2024-09-10',
      status: 'paid',
      type: 'payment',
      dueDate: '2024-09-24'
    },
    {
      id: 'INV-2024-004',
      customer: 'مجموعة النجاح التجارية',
      amount: 95200,
      date: '2024-09-09',
      status: 'overdue',
      type: 'invoice',
      dueDate: '2024-09-20'
    },
    {
      id: 'EXP-2024-005',
      customer: 'مصروفات تشغيلية',
      amount: -25600,
      date: '2024-09-08',
      status: 'paid',
      type: 'expense',
      dueDate: null
    }
  ];

  const getStatusBadge = (status: string) => {
    const statusMap = {
      paid: { class: 'active', text: 'مدفوع', icon: '✓' },
      pending: { class: 'pending', text: 'معلق', icon: '⏳' },
      overdue: { class: 'inactive', text: 'متأخر', icon: '⚠️' },
      draft: { class: 'draft', text: 'مسودة', icon: '📝' }
    };
    const config = statusMap[status as keyof typeof statusMap] || statusMap.draft;
    
    return (
      <div className={`netsuite-table-status ${config.class}`}>
        <div className="netsuite-table-status-indicator"></div>
        <span>{config.icon} {config.text}</span>
      </div>
    );
  };

  const getTypeIcon = (type: string) => {
    const typeMap = {
      invoice: '📄',
      payment: '💳',
      expense: '🧾',
      refund: '↩️'
    };
    return typeMap[type as keyof typeof typeMap] || '📄';
  };

  const formatAmount = (amount: number) => {
    const isNegative = amount < 0;
    const absAmount = Math.abs(amount);
    const formatted = new Intl.NumberFormat('ar-SA', {
      style: 'currency',
      currency: 'SAR',
      minimumFractionDigits: 0
    }).format(absAmount);
    
    return (
      <span style={{ 
        color: isNegative ? 'rgb(var(--netsuite-error))' : 'rgb(var(--netsuite-success))',
        fontWeight: '600'
      }}>
        {isNegative ? '-' : ''}{formatted}
      </span>
    );
  };

  const filteredTransactions = transactions.filter(transaction => {
    const matchesStatus = filterStatus === 'all' || transaction.status === filterStatus;
    const matchesSearch = transaction.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transaction.id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const breadcrumbs = [
    { label: 'الرئيسية', href: '/netsuite' },
    { label: 'المعاملات المالية' }
  ];

  const headerActions = (
    <>
      <a href="#" className="netsuite-header-quick-action">
        <div className="netsuite-header-quick-action-icon">+</div>
        معاملة جديدة
      </a>
      <a href="#" className="netsuite-header-quick-action secondary">
        <div className="netsuite-header-quick-action-icon">📤</div>
        تصدير
      </a>
      <a href="#" className="netsuite-header-quick-action secondary">
        <div className="netsuite-header-quick-action-icon">🖨</div>
        طباعة
      </a>
    </>
  );

  return (
    <NetSuiteLayout
      title="المعاملات المالية"
      subtitle="إدارة الفواتير والمدفوعات والمصروفات"
      icon="💼"
      breadcrumbs={breadcrumbs}
      actions={headerActions}
    >
      {/* Statistics Cards */}
      <div className="netsuite-card-grid netsuite-card-grid-4" style={{ marginBottom: 'var(--netsuite-spacing-xl)' }}>
        <div className="netsuite-stats-card">
          <div className="netsuite-stats-header">
            <div className="netsuite-stats-icon">📄</div>
            <div className="netsuite-stats-trend positive">
              <span>↗</span>
              <span>+15.3%</span>
            </div>
          </div>
          <div className="netsuite-stats-value">456</div>
          <div className="netsuite-stats-label">إجمالي الفواتير</div>
          <div className="netsuite-stats-detail">
            <span>📅</span>
            <span>هذا الشهر</span>
          </div>
        </div>

        <div className="netsuite-stats-card">
          <div className="netsuite-stats-header">
            <div className="netsuite-stats-icon">💳</div>
            <div className="netsuite-stats-trend positive">
              <span>↗</span>
              <span>+8.7%</span>
            </div>
          </div>
          <div className="netsuite-stats-value">2,847,500</div>
          <div className="netsuite-stats-label">المدفوعات المحصلة</div>
          <div className="netsuite-stats-detail">
            <span>💰</span>
            <span>ريال سعودي</span>
          </div>
        </div>

        <div className="netsuite-stats-card">
          <div className="netsuite-stats-header">
            <div className="netsuite-stats-icon">⏳</div>
            <div className="netsuite-stats-trend neutral">
              <span>→</span>
              <span>+2.1%</span>
            </div>
          </div>
          <div className="netsuite-stats-value">128</div>
          <div className="netsuite-stats-label">فواتير معلقة</div>
          <div className="netsuite-stats-detail">
            <span>⚠️</span>
            <span>تحتاج متابعة</span>
          </div>
        </div>

        <div className="netsuite-stats-card">
          <div className="netsuite-stats-header">
            <div className="netsuite-stats-icon">📈</div>
            <div className="netsuite-stats-trend negative">
              <span>↘</span>
              <span>-1.2%</span>
            </div>
          </div>
          <div className="netsuite-stats-value">89.2%</div>
          <div className="netsuite-stats-label">معدل التحصيل</div>
          <div className="netsuite-stats-detail">
            <span>🎯</span>
            <span>الهدف: 92%</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="netsuite-card-advanced" style={{ marginBottom: 'var(--netsuite-spacing-lg)' }}>
        <div className="netsuite-card-content-advanced">
          <div style={{ display: 'flex', gap: 'var(--netsuite-spacing-sm)', marginBottom: 'var(--netsuite-spacing-lg)' }}>
            {[
              { key: 'all', label: 'جميع المعاملات', count: transactions.length },
              { key: 'paid', label: 'مدفوعة', count: transactions.filter(t => t.status === 'paid').length },
              { key: 'pending', label: 'معلقة', count: transactions.filter(t => t.status === 'pending').length },
              { key: 'overdue', label: 'متأخرة', count: transactions.filter(t => t.status === 'overdue').length }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilterStatus(tab.key)}
                className={`netsuite-btn ${filterStatus === tab.key ? 'netsuite-btn-primary' : 'netsuite-btn-secondary'}`}
                style={{ minWidth: '120px' }}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Transactions Table */}
      <div className="netsuite-table-container">
        <div className="netsuite-table-header">
          <h2 className="netsuite-table-title">
            <div className="netsuite-table-title-icon">📋</div>
            قائمة المعاملات المالية
          </h2>
          <div className="netsuite-table-controls">
            <div className="netsuite-table-search">
              <div className="netsuite-table-search-icon">🔍</div>
              <input 
                type="text" 
                className="netsuite-table-search-input"
                placeholder="البحث في المعاملات..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button className="netsuite-table-filter-btn">
              <span>🔽</span>
              <span>تصفية متقدمة</span>
            </button>
            <button className="netsuite-table-filter-btn">
              <span>📅</span>
              <span>التاريخ</span>
            </button>
          </div>
        </div>
        
        <table className="netsuite-table-advanced">
          <thead>
            <tr>
              <th className="sortable">النوع</th>
              <th className="sortable">رقم المعاملة</th>
              <th className="sortable">العميل/الوصف</th>
              <th className="sortable">المبلغ</th>
              <th className="sortable">تاريخ الإنشاء</th>
              <th className="sortable">تاريخ الاستحقاق</th>
              <th>الحالة</th>
              <th>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map((transaction) => (
              <tr key={transaction.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--netsuite-spacing-sm)' }}>
                    <span style={{ fontSize: 'var(--netsuite-font-size-lg)' }}>
                      {getTypeIcon(transaction.type)}
                    </span>
                    <span style={{ fontSize: 'var(--netsuite-font-size-xs)', textTransform: 'uppercase', fontWeight: '500' }}>
                      {transaction.type === 'invoice' ? 'فاتورة' : 
                       transaction.type === 'payment' ? 'دفعة' : 
                       transaction.type === 'expense' ? 'مصروف' : 'أخرى'}
                    </span>
                  </div>
                </td>
                <td style={{ fontFamily: 'monospace', fontWeight: '600' }}>{transaction.id}</td>
                <td>{transaction.customer}</td>
                <td>{formatAmount(transaction.amount)}</td>
                <td>{transaction.date}</td>
                <td>{transaction.dueDate || '-'}</td>
                <td>{getStatusBadge(transaction.status)}</td>
                <td>
                  <div className="netsuite-table-actions">
                    <button className="netsuite-table-action-btn" title="عرض التفاصيل">
                      <div className="netsuite-table-action-icon">👁</div>
                    </button>
                    <button className="netsuite-table-action-btn" title="تعديل">
                      <div className="netsuite-table-action-icon">✏️</div>
                    </button>
                    <button className="netsuite-table-action-btn" title="طباعة">
                      <div className="netsuite-table-action-icon">🖨</div>
                    </button>
                    <button className="netsuite-table-action-btn" title="إرسال">
                      <div className="netsuite-table-action-icon">📤</div>
                    </button>
                    {transaction.status !== 'paid' && (
                      <button className="netsuite-table-action-btn" title="تحصيل" style={{ borderColor: 'rgb(var(--netsuite-success))', color: 'rgb(var(--netsuite-success))' }}>
                        <div className="netsuite-table-action-icon">💰</div>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        <div className="netsuite-table-footer">
          <div className="netsuite-table-info">
            عرض 1-{filteredTransactions.length} من {transactions.length} معاملة
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

      {/* Quick Actions Panel */}
      <div className="netsuite-card-advanced" style={{ marginTop: 'var(--netsuite-spacing-xl)' }}>
        <div className="netsuite-card-header-advanced">
          <div className="netsuite-card-title-section">
            <div className="netsuite-card-title-icon">⚡</div>
            <div className="netsuite-card-title-text">
              <h3 className="netsuite-card-title-advanced">إجراءات سريعة</h3>
              <p className="netsuite-card-subtitle-advanced">عمليات شائعة للمعاملات المالية</p>
            </div>
          </div>
        </div>
        <div className="netsuite-card-content-advanced">
          <div className="netsuite-card-grid netsuite-card-grid-4">
            <button className="netsuite-btn netsuite-btn-primary" style={{ height: '80px', flexDirection: 'column' }}>
              <span style={{ fontSize: 'var(--netsuite-font-size-xl)' }}>📄</span>
              <span>فاتورة جديدة</span>
            </button>
            <button className="netsuite-btn netsuite-btn-secondary" style={{ height: '80px', flexDirection: 'column' }}>
              <span style={{ fontSize: 'var(--netsuite-font-size-xl)' }}>💳</span>
              <span>تسجيل دفعة</span>
            </button>
            <button className="netsuite-btn netsuite-btn-secondary" style={{ height: '80px', flexDirection: 'column' }}>
              <span style={{ fontSize: 'var(--netsuite-font-size-xl)' }}>🧾</span>
              <span>مصروف جديد</span>
            </button>
            <button className="netsuite-btn netsuite-btn-secondary" style={{ height: '80px', flexDirection: 'column' }}>
              <span style={{ fontSize: 'var(--netsuite-font-size-xl)' }}>📊</span>
              <span>تقرير مالي</span>
            </button>
          </div>
        </div>
      </div>
    </NetSuiteLayout>
  );
};

export default NetSuiteTransactions;