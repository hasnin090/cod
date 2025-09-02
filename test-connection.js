import { config } from 'dotenv';
import postgres from 'postgres';

config();

async function testConnection() {
    try {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) {
            console.error('❌ DATABASE_URL not found in environment');
            return;
        }

        console.log('🔗 Testing database connection...');
        
        const sql = postgres(connectionString, {
            ssl: { rejectUnauthorized: false }
        });

        // اختبار بسيط
        const result = await sql`SELECT version()`;
        console.log('✅ Database connection successful!');
        console.log('📊 PostgreSQL version:', result[0]?.version?.substring(0, 50) + '...');

        // اختبار جداول المخطط
        try {
            const tablesTest = await sql`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                ORDER BY table_name
            `;
            
            console.log('\n📋 Tables in database:');
            tablesTest.forEach(table => {
                console.log(`  ✓ ${table.table_name}`);
            });

            // التحقق من أنواع المصروفات
            const expenseTypes = await sql`
                SELECT name, project_id, is_active 
                FROM expense_types 
                ORDER BY name
            `;
            
            console.log('\n💰 Expense types:');
            expenseTypes.forEach(type => {
                console.log(`  ✓ ${type.name} (Project: ${type.project_id || 'Global'}, Active: ${type.is_active})`);
            });

        } catch (error) {
            console.log('⚠️  Some tables might not exist yet:', error.message);
        }

        await sql.end();
        console.log('\n✅ Test completed successfully!');

    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        console.log('\n🔧 Troubleshooting suggestions:');
        console.log('1. Check if DATABASE_URL is correct in .env file');
        console.log('2. Verify Supabase project is active and accessible');
        console.log('3. Check network connectivity');
    }
}

testConnection();
