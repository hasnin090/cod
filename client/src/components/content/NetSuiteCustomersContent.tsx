import React, { useState } from 'react';

// NetSuite Customers Content (without layout)
export const NetSuiteCustomersContent: React.FC = () => {
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('list');
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="netsuite-content-area">
      {/* Customers Header */}
      <div className="netsuite-content-header">
        <div className="netsuite-page-title">
          <h1>إدارة العملاء والموردين</h1>
          <p>عرض وإدارة جميع العملاء والموردين</p>
        </div>
        <div className="netsuite-header-actions">
          <button className="netsuite-btn netsuite-btn-primary">إضافة عميل جديد</button>
          <button className="netsuite-btn netsuite-btn-secondary">استيراد العملاء</button>
        </div>
      </div>

      {/* Customer Statistics */}
      <div className="netsuite-stats-grid">
        <div className="netsuite-stat-card">
          <div className="netsuite-stat-header">
            <h3>إجمالي العملاء</h3>
          </div>
          <div className="netsuite-stat-value">145</div>
          <div className="netsuite-stat-subtitle">عميل نشط</div>
        </div>

        <div className="netsuite-stat-card">
          <div className="netsuite-stat-header">
            <h3>عملاء جدد</h3>
          </div>
          <div className="netsuite-stat-value">12</div>
          <div className="netsuite-stat-subtitle">هذا الشهر</div>
        </div>

        <div className="netsuite-stat-card">
          <div className="netsuite-stat-header">
            <h3>إجمالي المبيعات</h3>
          </div>
          <div className="netsuite-stat-value">₪425,680</div>
          <div className="netsuite-stat-subtitle">جميع العملاء</div>
        </div>

        <div className="netsuite-stat-card">
          <div className="netsuite-stat-header">
            <h3>متوسط قيمة العميل</h3>
          </div>
          <div className="netsuite-stat-value">₪2,936</div>
          <div className="netsuite-stat-subtitle">القيمة المتوسطة</div>
        </div>
      </div>

      {/* Filters and View Controls */}
      <div className="netsuite-filters-container">
        <div className="netsuite-search-bar">
          <input 
            type="text" 
            placeholder="البحث في العملاء..." 
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

        <div className="netsuite-view-controls">
          <button 
            className={`netsuite-view-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
          >
            <svg fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
            قائمة
          </button>
          <button 
            className={`netsuite-view-btn ${viewMode === 'cards' ? 'active' : ''}`}
            onClick={() => setViewMode('cards')}
          >
            <svg fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 3a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2H3zm0 2h14v10H3V5z" clipRule="evenodd" />
            </svg>
            بطاقات
          </button>
        </div>
      </div>

      {/* Customers Content */}
      {viewMode === 'list' ? (
        <div className="netsuite-card">
          <div className="netsuite-table-container">
            <table className="netsuite-table">
              <thead>
                <tr>
                  <th>العميل</th>
                  <th>النوع</th>
                  <th>البريد الإلكتروني</th>
                  <th>الهاتف</th>
                  <th>إجمالي المبيعات</th>
                  <th>تاريخ التسجيل</th>
                  <th>الحالة</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <div className="netsuite-customer-profile">
                      <div className="netsuite-customer-avatar">
                        <span>ش</span>
                      </div>
                      <div className="netsuite-customer-info">
                        <span className="netsuite-customer-name">شركة النجاح للتجارة</span>
                        <span className="netsuite-customer-code">CUS-001</span>
                      </div>
                    </div>
                  </td>
                  <td><span className="netsuite-customer-type netsuite-type-company">شركة</span></td>
                  <td>info@najah-trading.com</td>
                  <td>+970-599-123456</td>
                  <td className="netsuite-amount netsuite-amount-positive">₪125,450</td>
                  <td>01/01/2024</td>
                  <td><span className="netsuite-status netsuite-status-active">نشط</span></td>
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
                    <div className="netsuite-customer-profile">
                      <div className="netsuite-customer-avatar">
                        <span>م</span>
                      </div>
                      <div className="netsuite-customer-info">
                        <span className="netsuite-customer-name">مؤسسة الإبداع للتقنية</span>
                        <span className="netsuite-customer-code">CUS-002</span>
                      </div>
                    </div>
                  </td>
                  <td><span className="netsuite-customer-type netsuite-type-company">مؤسسة</span></td>
                  <td>contact@ibdaa-tech.com</td>
                  <td>+970-599-654321</td>
                  <td className="netsuite-amount netsuite-amount-positive">₪89,200</td>
                  <td>15/01/2024</td>
                  <td><span className="netsuite-status netsuite-status-active">نشط</span></td>
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
                    <div className="netsuite-customer-profile">
                      <div className="netsuite-customer-avatar">
                        <span>أ</span>
                      </div>
                      <div className="netsuite-customer-info">
                        <span className="netsuite-customer-name">أحمد محمد الشريف</span>
                        <span className="netsuite-customer-code">CUS-003</span>
                      </div>
                    </div>
                  </td>
                  <td><span className="netsuite-customer-type netsuite-type-individual">فردي</span></td>
                  <td>ahmed.shareef@email.com</td>
                  <td>+970-599-789012</td>
                  <td className="netsuite-amount netsuite-amount-positive">₪15,750</td>
                  <td>20/02/2024</td>
                  <td><span className="netsuite-status netsuite-status-active">نشط</span></td>
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
      ) : (
        <div className="netsuite-customers-grid">
          <div className="netsuite-customer-card">
            <div className="netsuite-customer-card-header">
              <div className="netsuite-customer-avatar-large">
                <span>ش</span>
              </div>
              <div className="netsuite-customer-card-info">
                <h3>شركة النجاح للتجارة</h3>
                <p>CUS-001</p>
              </div>
              <span className="netsuite-status netsuite-status-active">نشط</span>
            </div>
            <div className="netsuite-customer-card-body">
              <div className="netsuite-customer-detail">
                <span className="netsuite-customer-detail-label">البريد الإلكتروني:</span>
                <span>info@najah-trading.com</span>
              </div>
              <div className="netsuite-customer-detail">
                <span className="netsuite-customer-detail-label">الهاتف:</span>
                <span>+970-599-123456</span>
              </div>
              <div className="netsuite-customer-detail">
                <span className="netsuite-customer-detail-label">إجمالي المبيعات:</span>
                <span className="netsuite-amount netsuite-amount-positive">₪125,450</span>
              </div>
            </div>
            <div className="netsuite-customer-card-actions">
              <button className="netsuite-btn netsuite-btn-sm netsuite-btn-primary">عرض التفاصيل</button>
              <button className="netsuite-btn netsuite-btn-sm netsuite-btn-secondary">تعديل</button>
            </div>
          </div>

          <div className="netsuite-customer-card">
            <div className="netsuite-customer-card-header">
              <div className="netsuite-customer-avatar-large">
                <span>م</span>
              </div>
              <div className="netsuite-customer-card-info">
                <h3>مؤسسة الإبداع للتقنية</h3>
                <p>CUS-002</p>
              </div>
              <span className="netsuite-status netsuite-status-active">نشط</span>
            </div>
            <div className="netsuite-customer-card-body">
              <div className="netsuite-customer-detail">
                <span className="netsuite-customer-detail-label">البريد الإلكتروني:</span>
                <span>contact@ibdaa-tech.com</span>
              </div>
              <div className="netsuite-customer-detail">
                <span className="netsuite-customer-detail-label">الهاتف:</span>
                <span>+970-599-654321</span>
              </div>
              <div className="netsuite-customer-detail">
                <span className="netsuite-customer-detail-label">إجمالي المبيعات:</span>
                <span className="netsuite-amount netsuite-amount-positive">₪89,200</span>
              </div>
            </div>
            <div className="netsuite-customer-card-actions">
              <button className="netsuite-btn netsuite-btn-sm netsuite-btn-primary">عرض التفاصيل</button>
              <button className="netsuite-btn netsuite-btn-sm netsuite-btn-secondary">تعديل</button>
            </div>
          </div>

          <div className="netsuite-customer-card">
            <div className="netsuite-customer-card-header">
              <div className="netsuite-customer-avatar-large">
                <span>أ</span>
              </div>
              <div className="netsuite-customer-card-info">
                <h3>أحمد محمد الشريف</h3>
                <p>CUS-003</p>
              </div>
              <span className="netsuite-status netsuite-status-active">نشط</span>
            </div>
            <div className="netsuite-customer-card-body">
              <div className="netsuite-customer-detail">
                <span className="netsuite-customer-detail-label">البريد الإلكتروني:</span>
                <span>ahmed.shareef@email.com</span>
              </div>
              <div className="netsuite-customer-detail">
                <span className="netsuite-customer-detail-label">الهاتف:</span>
                <span>+970-599-789012</span>
              </div>
              <div className="netsuite-customer-detail">
                <span className="netsuite-customer-detail-label">إجمالي المبيعات:</span>
                <span className="netsuite-amount netsuite-amount-positive">₪15,750</span>
              </div>
            </div>
            <div className="netsuite-customer-card-actions">
              <button className="netsuite-btn netsuite-btn-sm netsuite-btn-primary">عرض التفاصيل</button>
              <button className="netsuite-btn netsuite-btn-sm netsuite-btn-secondary">تعديل</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NetSuiteCustomersContent;