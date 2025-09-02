const fs = require('fs');
const { Pool } = require('pg');

async function fixDatabase() {
    // قراءة DATABASE_URL من ملف .env
    const envContent = fs.readFileSync('.env', 'utf8');
    const DATABASE_URL = envContent.match(/DATABASE_URL=(.+)/)?.[1];
    
    if (!DATABASE_URL) {
        console.error('❌ DATABASE_URL not found in .env');
        return;
    }

    console.log('🔗 Connecting to database...');
    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        // اختبار الاتصال
        const client = await pool.connect();
        console.log('✅ Connected to database successfully');

        // التحقق من أنواع المصروفات المكررة
        console.log('🔍 Checking for duplicate expense types...');
        const duplicateCheck = await client.query(`
            SELECT name, project_id, COUNT(*) as count 
            FROM expense_types 
            GROUP BY name, project_id 
            HAVING COUNT(*) > 1
        `);
        
        if (duplicateCheck.rows.length > 0) {
            console.log('⚠️  Found duplicates:', duplicateCheck.rows);
            
            // حذف المكرر
            console.log('🧹 Removing duplicates...');
            await client.query(`
                DELETE FROM expense_types a USING expense_types b 
                WHERE a.id < b.id 
                AND a.name = b.name 
                AND (a.project_id IS NULL AND b.project_id IS NULL 
                     OR a.project_id = b.project_id)
            `);
        }

        // إدراج أنواع المصروفات الافتراضية
        console.log('📝 Inserting default expense types...');
        const insertResult = await client.query(`
            INSERT INTO expense_types (name, description, is_active) 
            SELECT name, description, is_active FROM (VALUES 
                ('راتب', 'مصروفات الرواتب والأجور', true),
                ('مواد بناء', 'مواد البناء والإنشاء', true),
                ('نقل ومواصلات', 'مصروفات النقل والمواصلات', true),
                ('أدوات ومعدات', 'الأدوات والمعدات المختلفة', true),
                ('خدمات عامة', 'الخدمات العامة والاستشارات', true),
                ('صيانة', 'أعمال الصيانة والإصلاح', true)
            ) AS new_data(name, description, is_active)
            WHERE NOT EXISTS (
                SELECT 1 FROM expense_types 
                WHERE expense_types.name = new_data.name 
                AND expense_types.project_id IS NULL
            )
            RETURNING *
        `);

        console.log(`✅ Inserted ${insertResult.rows.length} expense types`);

        // عرض جميع أنواع المصروفات
        const allExpenseTypes = await client.query('SELECT * FROM expense_types ORDER BY name');
        console.log('📊 Current expense types:');
        allExpenseTypes.rows.forEach(row => {
            console.log(`  - ${row.name} (ID: ${row.id}, Project: ${row.project_id || 'Global'})`);
        });

        client.release();
        console.log('✅ Database fix completed successfully!');

    } catch (error) {
        console.error('❌ Database error:', error.message);
    } finally {
        await pool.end();
    }
}

fixDatabase();
