import { neon } from '@neondatabase/serverless';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import fs from 'fs';
import path from 'path';

interface ExportFilters {
  projectId?: number;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  userId?: number;
  userRole?: string;
}

export const simpleExcelExporter = {
  async exportTransactionsAsCSV(filters: ExportFilters): Promise<string> {
    try {
      console.log('📋 بدء تصدير المعاملات مع الفلاتر:', filters);
      const sql = neon(process.env.DATABASE_URL!);
      
      // بناء استعلام SQL مع الفلاتر
      let query = `
        SELECT 
          t.id,
          t.date,
          t.amount,
          t.type,
          t.description,
          t.expense_type,
          p.name as project_name,
          t.created_at
        FROM transactions t
        LEFT JOIN projects p ON t.project_id = p.id
        WHERE 1=1
      `;
      
      const queryParams: any[] = [];
      let paramCount = 1;
      
      // إضافة فلاتر للاستعلام
      if (filters.projectId) {
        query += ` AND t.project_id = $${paramCount}`;
        queryParams.push(filters.projectId);
        paramCount++;
      }
      
      if (filters.type) {
        query += ` AND t.type = $${paramCount}`;
        queryParams.push(filters.type);
        paramCount++;
      }
      
      if (filters.dateFrom) {
        query += ` AND t.date >= $${paramCount}`;
        queryParams.push(filters.dateFrom);
        paramCount++;
      }
      
      if (filters.dateTo) {
        query += ` AND t.date <= $${paramCount}`;
        queryParams.push(filters.dateTo);
        paramCount++;
      }
      
      // إخفاء الإيرادات للمستخدمين من نوع المشاهدة
      if (filters.userRole === 'viewer') {
        query += ` AND t.type != 'income'`;
      }
      
      query += ` ORDER BY t.date DESC`;
      
      console.log('تنفيذ استعلام تصدير CSV:', query);
      console.log('المعاملات:', queryParams);
      
      // تنفيذ الاستعلام
      const transactions = await sql(query, queryParams);
      
      if (!transactions || transactions.length === 0) {
        throw new Error('لا توجد بيانات للتصدير');
      }
      
      console.log(`تم جلب ${transactions.length} معاملة للتصدير`);
      
      // تحضير البيانات للتصدير كـ CSV
      const csvHeaders = filters.userRole === 'viewer' 
        ? ['التاريخ', 'الوصف', 'المشروع', 'نوع المصروف', 'المبلغ']
        : ['التاريخ', 'الوصف', 'المشروع', 'النوع', 'نوع المصروف', 'المبلغ'];
      
      let csvContent = csvHeaders.join(',') + '\n';
      
      for (const transaction of transactions) {
        const formattedDate = format(new Date(transaction.date), 'yyyy/MM/dd', { locale: ar });
        const description = (transaction.description || '').replace(/,/g, ';').replace(/"/g, '""');
        const projectName = (transaction.project_name || 'بدون مشروع').replace(/,/g, ';').replace(/"/g, '""');
        const expenseType = (transaction.expense_type || '').replace(/,/g, ';').replace(/"/g, '""');
        const amount = transaction.amount || 0;
        
        let csvRow;
        if (filters.userRole === 'viewer') {
          csvRow = [
            `"${formattedDate}"`,
            `"${description}"`,
            `"${projectName}"`,
            `"${expenseType}"`,
            amount
          ].join(',');
        } else {
          const typeText = transaction.type === 'income' ? 'إيراد' : 'مصروف';
          csvRow = [
            `"${formattedDate}"`,
            `"${description}"`,
            `"${projectName}"`,
            `"${typeText}"`,
            `"${expenseType}"`,
            amount
          ].join(',');
        }
        
        csvContent += csvRow + '\n';
      }
      
      // إنشاء مجلد التصدير إذا لم يكن موجودًا
      const exportDir = './exports';
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }
      
      // إنشاء اسم الملف مع الوقت الحالي
      const timestamp = format(new Date(), 'yyyy-MM-dd-HHmmss');
      const fileName = `transactions_export_${timestamp}.csv`;
      const filePath = path.join(exportDir, fileName);
      
      // كتابة الملف مع BOM للدعم الصحيح للعربية في Excel
      const bom = '\uFEFF';
      fs.writeFileSync(filePath, bom + csvContent, 'utf8');
      
      console.log(`تم إنشاء ملف CSV: ${filePath}`);
      
      // إرجاع المسار النسبي للملف
      return `/exports/${fileName}`;
      
    } catch (error) {
      console.error('خطأ في تصدير CSV:', error);
      throw new Error(`فشل في تصدير البيانات: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
    }
  }
};