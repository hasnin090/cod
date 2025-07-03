import { neon } from '@neondatabase/serverless';
import path from 'path';
import fs from 'fs';

interface SimpleExportTransaction {
  id: number;
  date: string;
  type: string;
  amount: number;
  description: string;
  expenseType?: string;
  projectName?: string;
  employeeName?: string;
  createdBy: string;
}

export class SimpleExcelExporter {
  private sql = neon(process.env.DATABASE_URL!);

  async exportTransactionsAsCSV(
    filters: {
      projectId?: number;
      type?: string;
      dateFrom?: string;
      dateTo?: string;
      userId?: number;
      userRole?: string;
    }
  ): Promise<string> {
    try {
      // جلب البيانات
      const transactions = await this.fetchTransactions(filters);
      
      // إنشاء محتوى CSV
      const csvContent = this.generateCSV(transactions);
      
      // حفظ الملف
      const fileName = `transactions_export_${Date.now()}.csv`;
      const filePath = path.join('./uploads/exports', fileName);
      
      // إنشاء مجلد التصدير إذا لم يكن موجوداً
      const exportDir = path.dirname(filePath);
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }

      fs.writeFileSync(filePath, '\uFEFF' + csvContent, 'utf8'); // إضافة BOM للتوافق مع Excel العربي
      
      return `/uploads/exports/${fileName}`;
    } catch (error) {
      console.error('خطأ في تصدير CSV:', error);
      throw new Error('فشل في تصدير البيانات');
    }
  }

  private async fetchTransactions(filters: any): Promise<SimpleExportTransaction[]> {
    let query = `
      SELECT 
        t.id,
        t.date,
        t.type,
        t.amount,
        t.description,
        t.expense_type,
        p.name as project_name,
        e.name as employee_name,
        u.name as created_by
      FROM transactions t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN employees e ON t.employee_id = e.id
      LEFT JOIN users u ON t.created_by = u.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;

    // تطبيق الفلاتر
    if (filters.projectId) {
      query += ` AND t.project_id = $${paramIndex}`;
      params.push(filters.projectId);
      paramIndex++;
    }

    if (filters.type) {
      query += ` AND t.type = $${paramIndex}`;
      params.push(filters.type);
      paramIndex++;
    }

    if (filters.dateFrom) {
      query += ` AND t.date >= $${paramIndex}`;
      params.push(filters.dateFrom);
      paramIndex++;
    }

    if (filters.dateTo) {
      query += ` AND t.date <= $${paramIndex}`;
      params.push(filters.dateTo);
      paramIndex++;
    }

    // للمستخدمين غير المديرين، اعرض المعاملات المتاحة لهم فقط
    if (filters.userRole !== 'admin') {
      query += ` AND (t.project_id IN (
        SELECT project_id FROM project_users WHERE user_id = $${paramIndex}
      ) OR t.project_id IS NULL)`;
      params.push(filters.userId);
      paramIndex++;
    }

    query += ` ORDER BY t.date DESC, t.id DESC`;

    const result = await this.sql(query, params);
    
    return result.map((row: any) => ({
      id: row.id,
      date: new Date(row.date).toLocaleDateString('ar-SA'),
      type: row.type === 'income' ? 'إيراد' : 'مصروف',
      amount: row.amount,
      description: row.description || '',
      expenseType: row.expense_type || '',
      projectName: row.project_name || 'الصندوق الرئيسي',
      employeeName: row.employee_name || '',
      createdBy: row.created_by || ''
    }));
  }

  private generateCSV(transactions: SimpleExportTransaction[]): string {
    // رؤوس الأعمدة
    const headers = [
      'رقم العملية',
      'التاريخ', 
      'النوع',
      'المبلغ',
      'الوصف',
      'نوع المصروف',
      'المشروع',
      'الموظف',
      'أنشأ بواسطة'
    ];

    // بناء محتوى CSV
    let csvContent = headers.join(',') + '\n';
    
    // إضافة البيانات
    transactions.forEach(transaction => {
      const row = [
        transaction.id,
        `"${transaction.date}"`,
        `"${transaction.type}"`,
        transaction.amount,
        `"${this.escapeCsvValue(transaction.description || '')}"`,
        `"${this.escapeCsvValue(transaction.expenseType || '')}"`,
        `"${this.escapeCsvValue(transaction.projectName || '')}"`,
        `"${this.escapeCsvValue(transaction.employeeName || '')}"`,
        `"${this.escapeCsvValue(transaction.createdBy || '')}"`
      ];
      csvContent += row.join(',') + '\n';
    });

    // إضافة ملخص
    const totalIncome = transactions
      .filter(t => t.type === 'إيراد')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalExpenses = transactions
      .filter(t => t.type === 'مصروف')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const netAmount = totalIncome - totalExpenses;

    csvContent += '\n';
    csvContent += ',,,,,,,"ملخص العمليات",\n';
    csvContent += `,,,,,,,"إجمالي الإيرادات",${totalIncome}\n`;
    csvContent += `,,,,,,,"إجمالي المصروفات",${totalExpenses}\n`;
    csvContent += `,,,,,,,"صافي المبلغ",${netAmount}\n`;
    csvContent += `,,,,,,,"تاريخ التصدير","${new Date().toLocaleDateString('ar-SA')}"\n`;

    return csvContent;
  }

  private escapeCsvValue(value: string): string {
    if (!value) return '';
    // تطبيق escape للقيم التي تحتوي على فواصل أو علامات اقتباس
    return value.replace(/"/g, '""');
  }
}

export const simpleExcelExporter = new SimpleExcelExporter();