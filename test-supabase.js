import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// تحميل متغيرات البيئة
dotenv.config({ override: true });

async function testSupabaseConnection() {
  console.log('🔄 Testing Supabase connection...');
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables');
    console.log('SUPABASE_URL:', supabaseUrl ? '✅ Present' : '❌ Missing');
    console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✅ Present' : '❌ Missing');
    return false;
  }
  
  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    // اختبار بسيط - محاولة قراءة المستخدمين
    const { data, error } = await supabase
      .from('users')
      .select('id, username')
      .limit(1);
    
    if (error) {
      console.error('❌ Supabase query error:', error.message);
      return false;
    }
    
    console.log('✅ Supabase connection successful!');
    console.log('📊 Test query result:', data?.length || 0, 'users found');
    return true;
    
  } catch (error) {
    console.error('❌ Supabase connection failed:', error);
    return false;
  }
}

// تشغيل الاختبار
testSupabaseConnection().then(success => {
  if (success) {
    console.log('🎉 Supabase is ready for production!');
    process.exit(0);
  } else {
    console.log('💥 Supabase connection failed. Check your environment variables.');
    process.exit(1);
  }
}).catch(error => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});