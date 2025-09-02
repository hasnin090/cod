import 'dotenv/config';
import postgres from 'postgres';

async function testConnection() {
  try {
    console.log('Testing database connection...');
    console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
    
    const sql = postgres(process.env.DATABASE_URL);
    
    // Test basic connection
    const result = await sql`SELECT version()`;
    console.log('✅ Connected to PostgreSQL:', result[0].version);
    
    // Test if our tables exist
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    
    console.log('📋 Existing tables:', tables.map(t => t.table_name));
    console.log('✅ Database connection successful');
    
    await sql.end();
    
  } catch (error) {
    console.error('❌ Database error:', error);
    process.exit(1);
  }
}

testConnection();
