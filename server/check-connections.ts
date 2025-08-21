import dotenv from 'dotenv';
import path from 'path';
import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';
import dns from 'dns';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const DATABASE_URL = process.env.DATABASE_URL;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkPostgresConnection() {
  console.log('🔍  1. فحص الاتصال بقاعدة بيانات PostgreSQL (Neon)...');
  if (!DATABASE_URL) {
    console.error('❌  خطأ: متغير DATABASE_URL غير موجود في ملف .env');
    return;
  }

  console.log('    - تم العثور على DATABASE_URL.');

  // DNS diagnostics: inspect how Node resolves the hostname
  try {
    const url = new URL(DATABASE_URL);
    const host = url.hostname;
    console.log(`    - المضيف المستهدف: ${host}`);
    // Keep Node's DNS order verbatim to avoid reordering surprises
    // Note: not all Node versions support this; ignore if it throws
    try { (dns as any).setDefaultResultOrder?.('verbatim'); } catch {}
    const lookedUp = await new Promise<{addresses: string[]; family: number | 'mixed'}>((resolve) => {
      dns.lookup(host, { all: true }, (err, addresses) => {
        if (err) {
          console.warn(`    - تحذير DNS (lookup): ${err.message}`);
          resolve({ addresses: [], family: 'mixed' });
        } else {
          resolve({ addresses: addresses.map(a => a.address), family: addresses.length ? addresses[0].family : 'mixed' });
        }
      });
    });
    if (lookedUp.addresses.length) {
      console.log(`    - نتائج DNS من Node (lookup): ${lookedUp.addresses.join(', ')}`);
    } else {
      console.log('    - لم تُرجِع عملية DNS lookup أي عناوين في Node.');
    }
  } catch (e: any) {
    console.warn(`    - تخطّي تشخيص DNS بسبب خطأ: ${e.message}`);
  }

  let sql;
  try {
    // @ts-ignore
    sql = postgres(DATABASE_URL, {
      ssl: 'require',
      max: 1,
      connect_timeout: 10,
    });

    console.log('    - جارٍ محاولة الاتصال...');
    const result = await sql`SELECT NOW();`;
    
    console.log('✅  نجاح! تم الاتصال بقاعدة البيانات بنجاح.');
    console.log(`    - الوقت الحالي من قاعدة البيانات: ${result[0].now}`);
  } catch (error: any) {
    console.error('❌  فشل الاتصال بقاعدة البيانات:');
    if (error.message.includes('timed out')) {
        console.error('    - السبب: انتهت مهلة الاتصال. تحقق من جدار الحماية أو صحة رابط الاتصال.');
    } else if (error.message.includes('does not exist')) {
        console.error('    - السبب: اسم قاعدة البيانات أو المستخدم غير صحيح.');
    } else if (error.message.includes('password authentication failed')) {
        console.error('    - السبب: كلمة المرور غير صحيحة. تأكد من نسخها بشكل صحيح.');
    } else {
        console.error(`    - تفاصيل الخطأ: ${error.message}`);
    }
  } finally {
    if (sql) {
      await sql.end();
    }
  }
  console.log('--------------------------------------------------');
}

async function checkSupabaseConnection() {
  console.log('🔍  2. فحص الاتصال بـ Supabase Storage...');
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌  خطأ: متغيرات SUPABASE_URL أو SUPABASE_SERVICE_ROLE_KEY غير موجودة.');
    return;
  }

  console.log('    - تم العثور على مفاتيح Supabase.');

  try {
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log('    - جارٍ محاولة الاتصال وفحص الـ buckets...');
    const { data, error } = await supabaseClient.storage.listBuckets();

    if (error) {
      throw new Error(error.message);
    }

    console.log('✅  نجاح! تم الاتصال بـ Supabase Storage بنجاح.');
    console.log(`    - تم العثور على ${data.length} buckets:`, data.map(b => b.name).join(', '));
  } catch (error: any) {
    console.error('❌  فشل الاتصال بـ Supabase:');
    if (error.message.includes('Invalid API key')) {
        console.error('    - السبب: مفتاح الخدمة (SERVICE_ROLE_KEY) غير صحيح.');
    } else if (error.message.includes('failed to fetch')) {
        console.error('    - السبب: فشل في الوصول إلى رابط Supabase. تحقق من صحة SUPABASE_URL.');
    } else {
        console.error(`    - تفاصيل الخطأ: ${error.message}`);
    }
  }
  console.log('--------------------------------------------------');
}

async function runChecks() {
  console.log('🚀 بدء فحص الاتصالات...');
  console.log('==================================================');
  await checkPostgresConnection();
  await checkSupabaseConnection();
  console.log('🏁 انتهى الفحص.');
}

runChecks();
