import React from 'react';

// NetSuite Reports Content (without layout)
export const NetSuiteReportsContent: React.FC = () => {
  return (
    <div className="netsuite-content-area">
      {/* Reports Header */}
      <div className="netsuite-content-header">
        <div className="netsuite-page-title">
          <h1>التقارير والتحليلات</h1>
          <p>عرض وإنشاء التقارير المالية والتحليلية</p>
        </div>
        <div className="netsuite-header-actions">
          <button className="netsuite-btn netsuite-btn-primary">إنشاء تقرير جديد</button>
          <button className="netsuite-btn netsuite-btn-secondary">تصدير جميع التقارير</button>
        </div>
      </div>

      {/* Report Categories */}
      <div className="netsuite-reports-grid">
        <div className="netsuite-report-category">
          <div className="netsuite-report-category-header">
            <h3>التقارير المالية</h3>
            <p>تقارير الحسابات والمالية</p>
          </div>
          <div className="netsuite-report-items">
            <div className="netsuite-report-item">
              <div className="netsuite-report-icon">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="netsuite-report-info">
                <h4>تقرير الأرباح والخسائر</h4>
                <p>عرض الإيرادات والمصروفات</p>
              </div>
              <button className="netsuite-btn netsuite-btn-sm netsuite-btn-secondary">عرض</button>
            </div>

            <div className="netsuite-report-item">
              <div className="netsuite-report-icon">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm1 2a1 1 0 000 2h6a1 1 0 100-2H7zm6 7a1 1 0 011 1v3a1 1 0 11-2 0v-3a1 1 0 011-1zm-3 3a1 1 0 100 2h.01a1 1 0 100-2H10zm-4 1a1 1 0 011-1h.01a1 1 0 110 2H7a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="netsuite-report-info">
                <h4>الميزانية العامة</h4>
                <p>الأصول والخصوم</p>
              </div>
              <button className="netsuite-btn netsuite-btn-sm netsuite-btn-secondary">عرض</button>
            </div>

            <div className="netsuite-report-item">
              <div className="netsuite-report-icon">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="netsuite-report-info">
                <h4>تقرير التدفق النقدي</h4>
                <p>حركة النقد الداخل والخارج</p>
              </div>
              <button className="netsuite-btn netsuite-btn-sm netsuite-btn-secondary">عرض</button>
            </div>
          </div>
        </div>

        <div className="netsuite-report-category">
          <div className="netsuite-report-category-header">
            <h3>تقارير المبيعات</h3>
            <p>تحليل المبيعات والعملاء</p>
          </div>
          <div className="netsuite-report-items">
            <div className="netsuite-report-item">
              <div className="netsuite-report-icon">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="netsuite-report-info">
                <h4>تقرير المبيعات الشهري</h4>
                <p>أداء المبيعات حسب الشهر</p>
              </div>
              <button className="netsuite-btn netsuite-btn-sm netsuite-btn-secondary">عرض</button>
            </div>

            <div className="netsuite-report-item">
              <div className="netsuite-report-icon">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="netsuite-report-info">
                <h4>تقرير أداء العملاء</h4>
                <p>تحليل مبيعات العملاء</p>
              </div>
              <button className="netsuite-btn netsuite-btn-sm netsuite-btn-secondary">عرض</button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Reports */}
      <div className="netsuite-card">
        <div className="netsuite-card-header">
          <h3>التقارير الأخيرة</h3>
          <button className="netsuite-btn netsuite-btn-sm netsuite-btn-secondary">عرض الكل</button>
        </div>
        <div className="netsuite-table-container">
          <table className="netsuite-table">
            <thead>
              <tr>
                <th>اسم التقرير</th>
                <th>النوع</th>
                <th>تاريخ الإنشاء</th>
                <th>الحالة</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>تقرير الأرباح والخسائر - مارس 2024</td>
                <td>تقرير مالي</td>
                <td>15/03/2024</td>
                <td><span className="netsuite-status netsuite-status-completed">جاهز</span></td>
                <td>
                  <div className="netsuite-action-buttons">
                    <button className="netsuite-btn-icon" title="تحميل">
                      <svg fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button className="netsuite-btn-icon" title="مشاهدة">
                      <svg fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
              <tr>
                <td>تقرير المبيعات الشهري - فبراير 2024</td>
                <td>تقرير مبيعات</td>
                <td>28/02/2024</td>
                <td><span className="netsuite-status netsuite-status-completed">جاهز</span></td>
                <td>
                  <div className="netsuite-action-buttons">
                    <button className="netsuite-btn-icon" title="تحميل">
                      <svg fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button className="netsuite-btn-icon" title="مشاهدة">
                      <svg fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default NetSuiteReportsContent;