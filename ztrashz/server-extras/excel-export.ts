import { neon } from '@neondatabase/serverless';
import path from 'path';
import fs from 'fs';

interface ExportTransaction {
  id: number;
  date: string;
  type: string;
  amount: number;
  description: string;
  expenseType?: string;
  projectName?: string;
  employeeName?: string;
  createdBy: string;
  balance?: number;
}

export class ExcelExporter {
  private sql = neon(process.env.DATABASE_URL!);

  async exportTransactions(
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
      
      // إنشاء ملف Excel
      const ExcelJSModule = await import('exceljs');
      const ExcelJS = ExcelJSModule.default || ExcelJSModule;
      const workbook = new (ExcelJS as any).Workbook();
      const worksheet = workbook.addWorksheet('العمليات النقدية');

      // إعداد الأعمدة
      this.setupColumns(worksheet);
      
      // إضافة العنوان الرئيسي
      this.addMainHeader(worksheet, filters);
      
      // إضافة رؤوس الأعمدة
      this.addColumnHeaders(worksheet);
      
      // إضافة البيانات
      this.addTransactionData(worksheet, transactions);
      
      // إضافة الملخص
      this.addSummary(worksheet, transactions);
      
      // تطبيق التنسيق
      this.applyFormatting(worksheet);

      // حفظ الملف
      const fileName = `transactions_export_${Date.now()}.xlsx`;
      const filePath = path.join('./uploads/exports', fileName);
      
      // إنشاء مجلد التصدير إذا لم يكن موجوداً
      const exportDir = path.dirname(filePath);
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }

      await workbook.xlsx.writeFile(filePath);
      
      return `/uploads/exports/${fileName}`;
    } catch (error) {
      console.error('خطأ في تصدير Excel:', error);
      throw new Error('فشل في تصدير البيانات');
    }
  }

  private async fetchTransactions(filters: any): Promise<ExportTransaction[]> {
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
      description: row.description,
      expenseType: row.expense_type || '',
      projectName: row.project_name || 'الصندوق الرئيسي',
      employeeName: row.employee_name || '',
      createdBy: row.created_by || ''
    }));
  }

  private setupColumns(worksheet: any) {
    worksheet.columns = [
      { header: 'رقم العملية', key: 'id', width: 15 },
      { header: 'التاريخ', key: 'date', width: 15 },
      { header: 'النوع', key: 'type', width: 12 },
      { header: 'المبلغ', key: 'amount', width: 15 },
      { header: 'الوصف', key: 'description', width: 30 },
      { header: 'نوع المصروف', key: 'expenseType', width: 15 },
      { header: 'المشروع', key: 'projectName', width: 20 },
      { header: 'الموظف', key: 'employeeName', width: 15 },
      { header: 'أنشأ بواسطة', key: 'createdBy', width: 15 }
    ];
  }

  private addMainHeader(worksheet: any, filters: any) {
    // دمج الخلايا للعنوان الرئيسي
    worksheet.mergeCells('A1:I1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'تقرير العمليات النقدية';
    titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2E75B6' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    
    // إضافة معلومات الفلتر
    let filterInfo = `تاريخ التصدير: ${new Date().toLocaleDateString('ar-SA')}`;
    if (filters.projectId) {
      filterInfo += ` | المشروع: ${filters.projectId}`;
    }
    if (filters.type) {
      filterInfo += ` | النوع: ${filters.type === 'income' ? 'الإيرادات' : 'المصروفات'}`;
    }
    
    worksheet.mergeCells('A2:I2');
    const filterCell = worksheet.getCell('A2');
    filterCell.value = filterInfo;
    filterCell.font = { name: 'Arial', size: 10, italic: true };
    filterCell.alignment = { horizontal: 'center' };
  }

  private addColumnHeaders(worksheet: any) {
    const headerRow = worksheet.getRow(4);
    
    // تطبيق التنسيق على رؤوس الأعمدة
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
    
    headerRow.height = 25;
  }

  private addTransactionData(worksheet: any, transactions: ExportTransaction[]) {
    let runningBalance = 0;
    
    transactions.forEach((transaction, index) => {
      const rowIndex = index + 5; // البدء من الصف الخامس
      const row = worksheet.getRow(rowIndex);
      
      // تحديث الرصيد الجاري
      if (transaction.type === 'إيراد') {
        runningBalance += transaction.amount;
      } else {
        runningBalance -= transaction.amount;
      }
      
      // إضافة البيانات
      row.values = [
        transaction.id,
        transaction.date,
        transaction.type,
        transaction.amount,
        transaction.description,
        transaction.expenseType,
        transaction.projectName,
        transaction.employeeName,
        transaction.createdBy
      ];
      
      // تطبيق الألوان حسب نوع العملية
      const typeCell = row.getCell(3);
      const amountCell = row.getCell(4);
      
      if (transaction.type === 'إيراد') {
        typeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'C6EFCE' } };
        typeCell.font = { color: { argb: '006100' } };
        amountCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'C6EFCE' } };
        amountCell.font = { color: { argb: '006100' } };
      } else {
        typeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC7CE' } };
        typeCell.font = { color: { argb: '9C0006' } };
        amountCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC7CE' } };
        amountCell.font = { color: { argb: '9C0006' } };
      }
      
      // تنسيق المبلغ
      amountCell.numFmt = '#,##0.00';
      amountCell.alignment = { horizontal: 'right' };
      
      // إضافة حدود للخلايا
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
      
      // تلوين الصفوف بالتناوب
      if (index % 2 === 1) {
        row.eachCell((cell, colNumber) => {
          if (colNumber !== 3 && colNumber !== 4) { // تجنب تغيير لون خلايا النوع والمبلغ
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F2F2F2' } };
          }
        });
      }
    });
  }

  private addSummary(worksheet: any, transactions: ExportTransaction[]) {
    const lastDataRow = transactions.length + 4;
    const summaryStartRow = lastDataRow + 2;
    
    // حساب الملخص
    const totalIncome = transactions
      .filter(t => t.type === 'إيراد')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalExpenses = transactions
      .filter(t => t.type === 'مصروف')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const netAmount = totalIncome - totalExpenses;
    
    // إضافة عنوان الملخص
    worksheet.mergeCells(`A${summaryStartRow}:I${summaryStartRow}`);
    const summaryTitleCell = worksheet.getCell(`A${summaryStartRow}`);
    summaryTitleCell.value = 'ملخص العمليات';
    summaryTitleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFF' } };
    summaryTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '70AD47' } };
    summaryTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    
    // إضافة بيانات الملخص
    const summaryData = [
      ['إجمالي الإيرادات:', totalIncome, '✓'],
      ['إجمالي المصروفات:', totalExpenses, '✗'],
      ['صافي المبلغ:', netAmount, netAmount >= 0 ? '✓' : '✗']
    ];
    
    summaryData.forEach((data, index) => {
      const rowIndex = summaryStartRow + index + 1;
      const labelCell = worksheet.getCell(`G${rowIndex}`);
      const valueCell = worksheet.getCell(`H${rowIndex}`);
      const statusCell = worksheet.getCell(`I${rowIndex}`);
      
      labelCell.value = data[0];
      labelCell.font = { bold: true };
      labelCell.alignment = { horizontal: 'right' };
      
      valueCell.value = data[1];
      valueCell.numFmt = '#,##0.00';
      valueCell.alignment = { horizontal: 'right' };
      valueCell.font = { bold: true };
      
      statusCell.value = data[2];
      statusCell.alignment = { horizontal: 'center' };
      
      // تلوين حسب النوع
      if (index === 0) { // إيرادات
        valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'C6EFCE' } };
        valueCell.font = { color: { argb: '006100' }, bold: true };
      } else if (index === 1) { // مصروفات
        valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC7CE' } };
        valueCell.font = { color: { argb: '9C0006' }, bold: true };
      } else { // صافي
        if (netAmount >= 0) {
          valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'C6EFCE' } };
          valueCell.font = { color: { argb: '006100' }, bold: true };
        } else {
          valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC7CE' } };
          valueCell.font = { color: { argb: '9C0006' }, bold: true };
        }
      }
    });
  }

  private applyFormatting(worksheet: any) {
    // تطبيق التنسيق العام
    worksheet.views = [{ rightToLeft: true }];
    
    // ضبط ارتفاع الصفوف
    worksheet.getRow(1).height = 30; // العنوان الرئيسي
    worksheet.getRow(2).height = 20; // معلومات الفلتر
    worksheet.getRow(4).height = 25; // رؤوس الأعمدة
    
    // إضافة تجميد للصفوف العلوية
    worksheet.views = [{ 
      rightToLeft: true,
      state: 'frozen',
      ySplit: 4 // تجميد أول 4 صفوف
    }];
  }
}

export const excelExporter = new ExcelExporter();