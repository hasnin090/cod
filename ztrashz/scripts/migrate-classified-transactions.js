const { drizzle } = require('drizzle-orm/neon-http');
const { neon } = require('@neondatabase/serverless');
const { transactions, expenseTypes, ledgerEntries } = require('../shared/schema.ts');
const { eq, and, isNotNull } = require('drizzle-orm');

// الاتصال بقاعدة البيانات
const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql);

async function migrateClassifiedTransactions() {
  console.log('بدء ترحيل المعاملات المصنفة إلى دفتر الأستاذ...');
  
  try {
    // جلب جميع المعاملات التي لها نوع مصروف محدد
    const classifiedTransactions = await db.select()
      .from(transactions)
      .where(and(
        isNotNull(transactions.expenseType),
        // استبعاد "مصروف عام" لأنه ليس تصنيفاً محدداً
        ne(transactions.expenseType, 'مصروف عام')
      ));
    
    console.log(`تم العثور على ${classifiedTransactions.length} معاملة مصنفة`);
    
    // جلب جميع أنواع المصروفات
    const expenseTypesList = await db.select().from(expenseTypes);
    console.log(`تم العثور على ${expenseTypesList.length} نوع مصروف`);
    
    // جلب السجلات الموجودة في دفتر الأستاذ لتجنب التكرار
    const existingLedgerEntries = await db.select().from(ledgerEntries);
    const existingTransactionIds = new Set(existingLedgerEntries.map(entry => entry.transactionId));
    
    let addedCount = 0;
    let skippedCount = 0;
    
    for (const transaction of classifiedTransactions) {
      // تجاهل المعاملات الموجودة بالفعل في دفتر الأستاذ
      if (existingTransactionIds.has(transaction.id)) {
        skippedCount++;
        continue;
      }
      
      // البحث عن نوع المصروف المطابق
      const expenseType = expenseTypesList.find(type => type.name === transaction.expenseType);
      
      if (expenseType) {
        // إضافة سجل إلى دفتر الأستاذ
        await db.insert(ledgerEntries).values({
          date: new Date(transaction.date),
          transactionId: transaction.id,
          expenseTypeId: expenseType.id,
          amount: transaction.amount,
          description: transaction.description || '',
          projectId: transaction.projectId,
          entryType: 'classified'
        });
        
        addedCount++;
        console.log(`تمت إضافة المعاملة ${transaction.id} (${transaction.description}) إلى دفتر الأستاذ مع نوع المصروف: ${expenseType.name}`);
      } else {
        console.warn(`لم يتم العثور على نوع المصروف "${transaction.expenseType}" للمعاملة ${transaction.id}`);
      }
    }
    
    console.log(`\nانتهى الترحيل:`);
    console.log(`- تمت إضافة ${addedCount} سجل جديد إلى دفتر الأستاذ`);
    console.log(`- تم تجاهل ${skippedCount} سجل موجود مسبقاً`);
    
  } catch (error) {
    console.error('خطأ في ترحيل المعاملات:', error);
  }
}

// تشغيل السكريبت
migrateClassifiedTransactions()
  .then(() => {
    console.log('تم إنهاء عملية الترحيل بنجاح');
    process.exit(0);
  })
  .catch((error) => {
    console.error('فشل في عملية الترحيل:', error);
    process.exit(1);
  });