// استيراد المكتبات اللازمة
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from '../shared/schema';

// اجعل الوحدة مرنة: لا تنهار عند غياب DATABASE_URL (بيئات بدون قاعدة بيانات)
const url = process.env.DATABASE_URL;
if (!url) {
	console.warn('DATABASE_URL is not set. Running in in-memory/limited mode. DB calls will throw if invoked.');
}

// إنشاء اتصال قاعدة البيانات عند توفر المتغير، وإلا نصدر Proxy آمن
export const db: any = url
	? (() => {
			// طباعة معلومات الاتصال للتصحيح (مع إخفاء البيانات الحساسة)
			console.log(`Connecting to database... URL format: ${url.substring(0, 20)}...`);
			const sql = neon(url);
			return drizzle(sql, { schema });
		})()
	: new Proxy(
			{},
			{
				get(_target, prop) {
					throw new Error(
						`Database not configured (DATABASE_URL missing). Attempted to access db.${String(prop)}. Set DATABASE_URL in environment.`
					);
				},
			}
		);

// تصدير أنواع البيانات من المخطط
export * from '../shared/schema';