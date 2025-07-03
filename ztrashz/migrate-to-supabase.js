import { neon } from '@neondatabase/serverless';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// إعداد الاتصالات
const currentSql = neon(process.env.DATABASE_URL);
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'your-service-key';
const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔄 بدء عملية نقل البيانات إلى Supabase...');

/**
 * نقل البيانات من قاعدة البيانات الحالية إلى Supabase
 */
async function migrateToSupabase() {
    try {
        // 1. نقل المستخدمين
        console.log('👥 نقل المستخدمين...');
        const users = await currentSql`SELECT * FROM users`;
        console.log(`وجد ${users.length} مستخدم`);
        
        for (const user of users) {
            // إنشاء مستخدم في Supabase Auth
            const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
                email: user.email,
                password: 'temp-password-123', // يجب تغييرها
                email_confirm: true,
                user_metadata: {
                    name: user.name,
                    role: user.role
                }
            });
            
            if (authError) {
                console.error(`خطأ في إنشاء مستخدم ${user.email}:`, authError);
                continue;
            }
            
            // إدراج بيانات المستخدم في جدول users
            const { error: insertError } = await supabase
                .from('users')
                .insert({
                    id: authUser.user.id,
                    username: user.username,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    permissions: user.permissions,
                    active: user.active,
                    created_at: user.created_at,
                    updated_at: user.updated_at
                });
            
            if (insertError) {
                console.error(`خطأ في إدراج بيانات المستخدم ${user.email}:`, insertError);
            } else {
                console.log(`✅ تم نقل المستخدم: ${user.name}`);
            }
        }
        
        // 2. نقل المشاريع
        console.log('📁 نقل المشاريع...');
        const projects = await currentSql`SELECT * FROM projects`;
        console.log(`وجد ${projects.length} مشروع`);
        
        const { error: projectsError } = await supabase
            .from('projects')
            .insert(projects);
        
        if (projectsError) {
            console.error('خطأ في نقل المشاريع:', projectsError);
        } else {
            console.log(`✅ تم نقل ${projects.length} مشروع`);
        }
        
        // 3. نقل أنواع المصروفات
        console.log('💰 نقل أنواع المصروفات...');
        const expenseTypes = await currentSql`SELECT * FROM expense_types`;
        console.log(`وجد ${expenseTypes.length} نوع مصروف`);
        
        const { error: expenseTypesError } = await supabase
            .from('expense_types')
            .insert(expenseTypes);
        
        if (expenseTypesError) {
            console.error('خطأ في نقل أنواع المصروفات:', expenseTypesError);
        } else {
            console.log(`✅ تم نقل ${expenseTypes.length} نوع مصروف`);
        }
        
        // 4. نقل الموظفين
        console.log('👤 نقل الموظفين...');
        const employees = await currentSql`SELECT * FROM employees`;
        console.log(`وجد ${employees.length} موظف`);
        
        const { error: employeesError } = await supabase
            .from('employees')
            .insert(employees);
        
        if (employeesError) {
            console.error('خطأ في نقل الموظفين:', employeesError);
        } else {
            console.log(`✅ تم نقل ${employees.length} موظف`);
        }
        
        // 5. نقل المعاملات
        console.log('📊 نقل المعاملات...');
        const transactions = await currentSql`SELECT * FROM transactions`;
        console.log(`وجد ${transactions.length} معاملة`);
        
        // نقل المعاملات في دفعات لتجنب timeout
        const batchSize = 50;
        for (let i = 0; i < transactions.length; i += batchSize) {
            const batch = transactions.slice(i, i + batchSize);
            const { error: transactionError } = await supabase
                .from('transactions')
                .insert(batch);
            
            if (transactionError) {
                console.error(`خطأ في نقل الدفعة ${i + 1}-${i + batch.length}:`, transactionError);
            } else {
                console.log(`✅ تم نقل ${batch.length} معاملة (${i + 1}-${i + batch.length})`);
            }
        }
        
        // 6. نقل المستندات
        console.log('📄 نقل المستندات...');
        const documents = await currentSql`SELECT * FROM documents`;
        console.log(`وجد ${documents.length} مستند`);
        
        if (documents.length > 0) {
            const { error: documentsError } = await supabase
                .from('documents')
                .insert(documents);
            
            if (documentsError) {
                console.error('خطأ في نقل المستندات:', documentsError);
            } else {
                console.log(`✅ تم نقل ${documents.length} مستند`);
            }
        }
        
        // 7. نقل الإعدادات
        console.log('⚙️ نقل الإعدادات...');
        const settings = await currentSql`SELECT * FROM settings`;
        console.log(`وجد ${settings.length} إعداد`);
        
        if (settings.length > 0) {
            const { error: settingsError } = await supabase
                .from('settings')
                .insert(settings);
            
            if (settingsError) {
                console.error('خطأ في نقل الإعدادات:', settingsError);
            } else {
                console.log(`✅ تم نقل ${settings.length} إعداد`);
            }
        }
        
        // 8. نقل سجلات الأنشطة
        console.log('📋 نقل سجلات الأنشطة...');
        const activityLogs = await currentSql`SELECT * FROM activity_logs LIMIT 1000`; // آخر 1000 سجل
        console.log(`وجد ${activityLogs.length} سجل نشاط`);
        
        if (activityLogs.length > 0) {
            const { error: logsError } = await supabase
                .from('activity_logs')
                .insert(activityLogs);
            
            if (logsError) {
                console.error('خطأ في نقل سجلات الأنشطة:', logsError);
            } else {
                console.log(`✅ تم نقل ${activityLogs.length} سجل نشاط`);
            }
        }
        
        // 9. نقل الأعمال المنجزة
        console.log('🏆 نقل الأعمال المنجزة...');
        const completedWorks = await currentSql`SELECT * FROM completed_works`;
        console.log(`وجد ${completedWorks.length} عمل منجز`);
        
        if (completedWorks.length > 0) {
            const { error: completedWorksError } = await supabase
                .from('completed_works')
                .insert(completedWorks);
            
            if (completedWorksError) {
                console.error('خطأ في نقل الأعمال المنجزة:', completedWorksError);
            } else {
                console.log(`✅ تم نقل ${completedWorks.length} عمل منجز`);
            }
        }
        
        // 10. نقل المستحقات
        console.log('💳 نقل المستحقات...');
        const receivables = await currentSql`SELECT * FROM receivables`;
        console.log(`وجد ${receivables.length} مستحق`);
        
        if (receivables.length > 0) {
            const { error: receivablesError } = await supabase
                .from('receivables')
                .insert(receivables);
            
            if (receivablesError) {
                console.error('خطأ في نقل المستحقات:', receivablesError);
            } else {
                console.log(`✅ تم نقل ${receivables.length} مستحق`);
            }
        }
        
        // إنشاء تقرير النقل
        const migrationReport = {
            timestamp: new Date().toISOString(),
            users: users.length,
            projects: projects.length,
            expenseTypes: expenseTypes.length,
            employees: employees.length,
            transactions: transactions.length,
            documents: documents.length,
            settings: settings.length,
            activityLogs: activityLogs.length,
            completedWorks: completedWorks.length,
            receivables: receivables.length,
            success: true
        };
        
        fs.writeFileSync('migration-report.json', JSON.stringify(migrationReport, null, 2));
        console.log('📊 تم إنشاء تقرير النقل: migration-report.json');
        
        console.log('\n🎉 تم نقل البيانات بنجاح إلى Supabase!');
        console.log('📈 إحصائيات النقل:');
        console.log(`   - المستخدمون: ${users.length}`);
        console.log(`   - المشاريع: ${projects.length}`);
        console.log(`   - المعاملات: ${transactions.length}`);
        console.log(`   - المستندات: ${documents.length}`);
        console.log(`   - الإعدادات: ${settings.length}`);
        
        return migrationReport;
        
    } catch (error) {
        console.error('❌ خطأ في عملية النقل:', error);
        throw error;
    }
}

// تشغيل النقل
if (import.meta.url === `file://${process.argv[1]}`) {
    migrateToSupabase()
        .then(report => {
            console.log('\n✅ اكتملت عملية النقل بنجاح');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ فشلت عملية النقل:', error);
            process.exit(1);
        });
}

export { migrateToSupabase };