import React from 'react';

// NetSuite Dashboard Content (without layout)
export const NetSuiteDashboardContent: React.FC = () => {
  return (
    <div className="netsuite-content-area">
      {/* Dashboard Header */}
      <div className="netsuite-content-header">
        <div className="netsuite-page-title">
          <h1>لوحة التحكم</h1>
          <p>مرحباً بك في نظام المحاسبة المطور</p>
        </div>
        <div className="netsuite-header-actions">
          <button className="netsuite-btn netsuite-btn-primary">إضافة معاملة</button>
          <button className="netsuite-btn netsuite-btn-secondary">تصدير التقرير</button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="netsuite-stats-grid">
        <div className="netsuite-stat-card">
          <div className="netsuite-stat-header">
            <h3>إجمالي الإيرادات</h3>
            <div className="netsuite-stat-trend netsuite-trend-up">
              <span>+12.5%</span>
              <svg className="netsuite-trend-icon" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div className="netsuite-stat-value">₪125,430</div>
          <div className="netsuite-stat-subtitle">الشهر الحالي</div>
        </div>

        <div className="netsuite-stat-card">
          <div className="netsuite-stat-header">
            <h3>إجمالي المصروفات</h3>
            <div className="netsuite-stat-trend netsuite-trend-down">
              <span>-3.2%</span>
              <svg className="netsuite-trend-icon" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div className="netsuite-stat-value">₪78,920</div>
          <div className="netsuite-stat-subtitle">الشهر الحالي</div>
        </div>

        <div className="netsuite-stat-card">
          <div className="netsuite-stat-header">
            <h3>صافي الربح</h3>
            <div className="netsuite-stat-trend netsuite-trend-up">
              <span>+18.7%</span>
              <svg className="netsuite-trend-icon" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div className="netsuite-stat-value">₪46,510</div>
          <div className="netsuite-stat-subtitle">الشهر الحالي</div>
        </div>

        <div className="netsuite-stat-card">
          <div className="netsuite-stat-header">
            <h3>المعاملات الجديدة</h3>
            <div className="netsuite-stat-trend netsuite-trend-neutral">
              <span>+2.1%</span>
              <svg className="netsuite-trend-icon" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div className="netsuite-stat-value">324</div>
          <div className="netsuite-stat-subtitle">هذا الأسبوع</div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="netsuite-dashboard-grid">
        {/* Recent Transactions */}
        <div className="netsuite-card">
          <div className="netsuite-card-header">
            <h3>المعاملات الأخيرة</h3>
            <button className="netsuite-btn netsuite-btn-sm netsuite-btn-secondary">عرض الكل</button>
          </div>
          <div className="netsuite-table-container">
            <table className="netsuite-table">
              <thead>
                <tr>
                  <th>المعاملة</th>
                  <th>العميل</th>
                  <th>المبلغ</th>
                  <th>التاريخ</th>
                  <th>الحالة</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <div className="netsuite-transaction-info">
                      <span className="netsuite-transaction-id">#T-001234</span>
                      <span className="netsuite-transaction-type">فاتورة مبيعات</span>
                    </div>
                  </td>
                  <td>شركة النجاح للتجارة</td>
                  <td className="netsuite-amount netsuite-amount-positive">₪12,500</td>
                  <td>2024-03-15</td>
                  <td><span className="netsuite-status netsuite-status-completed">مكتملة</span></td>
                  <td>
                    <div className="netsuite-action-buttons">
                      <button className="netsuite-btn-icon" title="عرض">
                        <svg fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <button className="netsuite-btn-icon" title="تعديل">
                        <svg fill="currentColor" viewBox="0 0 20 20">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td>
                    <div className="netsuite-transaction-info">
                      <span className="netsuite-transaction-id">#T-001235</span>
                      <span className="netsuite-transaction-type">فاتورة شراء</span>
                    </div>
                  </td>
                  <td>مؤسسة الإبداع</td>
                  <td className="netsuite-amount netsuite-amount-negative">-₪8,750</td>
                  <td>2024-03-14</td>
                  <td><span className="netsuite-status netsuite-status-pending">معلقة</span></td>
                  <td>
                    <div className="netsuite-action-buttons">
                      <button className="netsuite-btn-icon" title="عرض">
                        <svg fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <button className="netsuite-btn-icon" title="تعديل">
                        <svg fill="currentColor" viewBox="0 0 20 20">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td>
                    <div className="netsuite-transaction-info">
                      <span className="netsuite-transaction-id">#T-001236</span>
                      <span className="netsuite-transaction-type">إيصال استلام</span>
                    </div>
                  </td>
                  <td>شركة التميز</td>
                  <td className="netsuite-amount netsuite-amount-positive">₪15,200</td>
                  <td>2024-03-13</td>
                  <td><span className="netsuite-status netsuite-status-completed">مكتملة</span></td>
                  <td>
                    <div className="netsuite-action-buttons">
                      <button className="netsuite-btn-icon" title="عرض">
                        <svg fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <button className="netsuite-btn-icon" title="تعديل">
                        <svg fill="currentColor" viewBox="0 0 20 20">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="netsuite-card">
          <div className="netsuite-card-header">
            <h3>الإجراءات السريعة</h3>
          </div>
          <div className="netsuite-quick-actions">
            <button className="netsuite-quick-action-btn">
              <div className="netsuite-quick-action-icon">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                </svg>
              </div>
              <span>إنشاء فاتورة</span>
            </button>

            <button className="netsuite-quick-action-btn">
              <div className="netsuite-quick-action-icon">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                </svg>
              </div>
              <span>رفع مستند</span>
            </button>

            <button className="netsuite-quick-action-btn">
              <div className="netsuite-quick-action-icon">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm1 2a1 1 0 000 2h6a1 1 0 100-2H7zm6 7a1 1 0 011 1v3a1 1 0 11-2 0v-3a1 1 0 011-1zm-3 3a1 1 0 100 2h.01a1 1 0 100-2H10zm-4 1a1 1 0 011-1h.01a1 1 0 110 2H7a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <span>إنشاء تقرير</span>
            </button>

            <button className="netsuite-quick-action-btn">
              <div className="netsuite-quick-action-icon">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </div>
              <span>إضافة عميل</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetSuiteDashboardContent;