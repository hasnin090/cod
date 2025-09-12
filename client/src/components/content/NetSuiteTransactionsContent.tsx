import React, { useState } from 'react';

// NetSuite Transactions Content (without layout)
export const NetSuiteTransactionsContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="netsuite-content-area">
      {/* Transactions Header */}
      <div className="netsuite-content-header">
        <div className="netsuite-page-title">
          <h1>إدارة المعاملات المالية</h1>
          <p>عرض وإدارة جميع المعاملات المالية في النظام</p>
        </div>
        <div className="netsuite-header-actions">
          <button className="netsuite-btn netsuite-btn-primary">إنشاء معاملة جديدة</button>
          <button className="netsuite-btn netsuite-btn-secondary">تصدير البيانات</button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="netsuite-filters-container">
        <div className="netsuite-search-bar">
          <input 
            type="text" 
            placeholder="البحث في المعاملات..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="netsuite-search-input"
          />
          <button className="netsuite-search-btn">
            <svg fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="netsuite-filter-tabs">
          <button 
            className={`netsuite-filter-tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            الكل
          </button>
          <button 
            className={`netsuite-filter-tab ${activeTab === 'income' ? 'active' : ''}`}
            onClick={() => setActiveTab('income')}
          >
            الإيرادات
          </button>
          <button 
            className={`netsuite-filter-tab ${activeTab === 'expense' ? 'active' : ''}`}
            onClick={() => setActiveTab('expense')}
          >
            المصروفات
          </button>
          <button 
            className={`netsuite-filter-tab ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            معلقة
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="netsuite-card">
        <div className="netsuite-table-container">
          <table className="netsuite-table">
            <thead>
              <tr>
                <th>
                  <input type="checkbox" className="netsuite-checkbox" />
                </th>
                <th>رقم المعاملة</th>
                <th>النوع</th>
                <th>العميل/المورد</th>
                <th>المبلغ</th>
                <th>التاريخ</th>
                <th>تاريخ الاستحقاق</th>
                <th>الحالة</th>
                <th>المشروع</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <input type="checkbox" className="netsuite-checkbox" />
                </td>
                <td>
                  <div className="netsuite-transaction-info">
                    <span className="netsuite-transaction-id">#INV-2024-001</span>
                    <span className="netsuite-transaction-ref">مرجع: REF123</span>
                  </div>
                </td>
                <td>
                  <span className="netsuite-transaction-type netsuite-type-income">فاتورة مبيعات</span>
                </td>
                <td>
                  <div className="netsuite-customer-info">
                    <span className="netsuite-customer-name">شركة النجاح للتجارة</span>
                    <span className="netsuite-customer-code">CUS-001</span>
                  </div>
                </td>
                <td className="netsuite-amount netsuite-amount-positive">₪25,500.00</td>
                <td>15/03/2024</td>
                <td>15/04/2024</td>
                <td><span className="netsuite-status netsuite-status-completed">مدفوعة</span></td>
                <td>مشروع التطوير الرقمي</td>
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
                    <button className="netsuite-btn-icon" title="طباعة">
                      <svg fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
              
              <tr>
                <td>
                  <input type="checkbox" className="netsuite-checkbox" />
                </td>
                <td>
                  <div className="netsuite-transaction-info">
                    <span className="netsuite-transaction-id">#EXP-2024-001</span>
                    <span className="netsuite-transaction-ref">مرجع: EXP456</span>
                  </div>
                </td>
                <td>
                  <span className="netsuite-transaction-type netsuite-type-expense">فاتورة شراء</span>
                </td>
                <td>
                  <div className="netsuite-customer-info">
                    <span className="netsuite-customer-name">مؤسسة الإبداع للتقنية</span>
                    <span className="netsuite-customer-code">SUP-001</span>
                  </div>
                </td>
                <td className="netsuite-amount netsuite-amount-negative">-₪12,750.00</td>
                <td>14/03/2024</td>
                <td>14/04/2024</td>
                <td><span className="netsuite-status netsuite-status-pending">معلقة</span></td>
                <td>مشروع البنية التحتية</td>
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
                    <button className="netsuite-btn-icon" title="دفع">
                      <svg fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
              
              <tr>
                <td>
                  <input type="checkbox" className="netsuite-checkbox" />
                </td>
                <td>
                  <div className="netsuite-transaction-info">
                    <span className="netsuite-transaction-id">#REC-2024-001</span>
                    <span className="netsuite-transaction-ref">مرجع: REC789</span>
                  </div>
                </td>
                <td>
                  <span className="netsuite-transaction-type netsuite-type-income">إيصال استلام</span>
                </td>
                <td>
                  <div className="netsuite-customer-info">
                    <span className="netsuite-customer-name">شركة التميز</span>
                    <span className="netsuite-customer-code">CUS-002</span>
                  </div>
                </td>
                <td className="netsuite-amount netsuite-amount-positive">₪18,200.00</td>
                <td>13/03/2024</td>
                <td>-</td>
                <td><span className="netsuite-status netsuite-status-completed">مستلمة</span></td>
                <td>مشروع الاستشارات</td>
                <td>
                  <div className="netsuite-action-buttons">
                    <button className="netsuite-btn-icon" title="عرض">
                      <svg fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button className="netsuite-btn-icon" title="طباعة">
                      <svg fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        {/* Bulk Actions */}
        <div className="netsuite-bulk-actions">
          <div className="netsuite-bulk-actions-left">
            <span>تم تحديد 0 عنصر</span>
          </div>
          <div className="netsuite-bulk-actions-right">
            <button className="netsuite-btn netsuite-btn-sm netsuite-btn-secondary">تصدير المحدد</button>
            <button className="netsuite-btn netsuite-btn-sm netsuite-btn-secondary">طباعة المحدد</button>
            <button className="netsuite-btn netsuite-btn-sm netsuite-btn-danger">حذف المحدد</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetSuiteTransactionsContent;