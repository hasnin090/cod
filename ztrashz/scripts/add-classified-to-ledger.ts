import { pgStorage } from '../server/pg-storage.js';

async function addClassifiedTransactionsToLedger() {
  console.log('بدء إضافة المعاملات المصنفة إلى دفتر الأستاذ...');
  
  try {
    // جلب جميع المعاملات
    const allTransactions = await pgStorage.listTransactions();
    console.log(`تم العثور على ${allTransactions.length} معاملة إجمالية`);
    
    // تصفية المعاملات التي لها نوع مصروف محدد
    const classifiedTransactions = allTransactions.filter(t => 
      t.expenseType && 
      t.expenseType !== 'مصروف عام' && 
      t.expenseType.trim() !== ''
    );
    
    console.log(`تم العثور على ${classifiedTransactions.length} معاملة مصنفة`);
    
    // جلب السجلات الموجودة في دفتر الأستاذ لتجنب التكرار
    const existingEntries = await pgStorage.listLedgerEntries();
    const existingTransactionIds = new Set(existingEntries.map(entry => entry.transactionId));
    
    let addedCount = 0;
    let skippedCount = 0;
    let notFoundCount = 0;
    
    for (const transaction of classifiedTransactions) {
      // تجاهل المعاملات الموجودة بالفعل في دفتر الأستاذ
      if (existingTransactionIds.has(transaction.id)) {
        console.log(`تجاهل المعاملة ${transaction.id} - موجودة بالفعل في دفتر الأستاذ`);
        skippedCount++;
        continue;
      }
      
      try {
        // البحث عن نوع المصروف
        const expenseType = await pgStorage.getExpenseTypeByName(transaction.expenseType);
        
        if (expenseType) {
          // إضافة سجل إلى دفتر الأستاذ
          await pgStorage.createLedgerEntry({
            date: new Date(transaction.date),
            transactionId: transaction.id,
            expenseTypeId: expenseType.id,
            amount: transaction.amount,
            description: transaction.description || '',
            projectId: transaction.projectId,
            entryType: 'classified'
          });
          
          addedCount++;
          console.log(`✓ تمت إضافة المعاملة ${transaction.id} "${transaction.description}" إلى دفتر الأستاذ مع نوع المصروف: ${expenseType.name}`);
        } else {
          notFoundCount++;
          console.warn(`⚠ لم يتم العثور على نوع المصروف "${transaction.expenseType}" للمعاملة ${transaction.id}`);
        }
      } catch (error) {
        console.error(`خطأ في معالجة المعاملة ${transaction.id}:`, error);
      }
    }
    
    console.log(`\n📊 نتائج العملية:`);
    console.log(`- تمت إضافة ${addedCount} سجل جديد إلى دفتر الأستاذ`);
    console.log(`- تم تجاهل ${skippedCount} سجل موجود مسبقاً`);
    console.log(`- ${notFoundCount} معاملة لم يتم العثور على نوع المصروف لها`);
    
    return { added: addedCount, skipped: skippedCount, notFound: notFoundCount };
    
  } catch (error) {
    console.error('خطأ في إضافة المعاملات إلى دفتر الأستاذ:', error);
    throw error;
  }
}

// تشغيل السكريبت إذا تم تشغيله مباشرة
if (import.meta.url === `file://${process.argv[1]}`) {
  addClassifiedTransactionsToLedger()
    .then((result) => {
      console.log('✅ تم إنهاء عملية إضافة المعاملات إلى دفتر الأستاذ بنجاح');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ فشل في عملية إضافة المعاملات:', error);
      process.exit(1);
    });
}

export { addClassifiedTransactionsToLedger };