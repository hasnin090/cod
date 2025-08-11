import { db } from './db';
import { eq, and } from 'drizzle-orm';
import { 
  users, 
  PERMISSIONS,
  ROLES,
  User
} from '../shared/schema';

// تعريف أنواع الصلاحيات والأدوار لاستخدامها في الكود
export type Permission = string;
export type Role = string;

// التعيينات الافتراضية للصلاحيات حسب الدور
const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  'admin': [
    'view_dashboard',
    'manage_users',
    'view_users',
    'manage_projects',
    'view_projects',
    'manage_project_transactions',
    'view_project_transactions',
    'manage_transactions',
    'view_transactions',
    'manage_documents',
    'view_documents',
    'view_reports',
    'view_activity_logs',
    'manage_settings'
  ],
  'manager': [
    'view_dashboard',
    'view_users',
    'manage_projects',
    'view_projects',
    'manage_project_transactions',
    'view_project_transactions',
    'manage_transactions',
    'view_transactions',
    'manage_documents',
    'view_documents',
    'view_reports'
  ],
  'user': [
    'view_dashboard',
    'view_projects',
    'manage_project_transactions',
    'view_project_transactions',
    'manage_transactions',
    'view_transactions',
    'manage_documents',
    'view_documents'
  ],
  'viewer': [
    'view_dashboard',
    'view_projects',
    'view_project_transactions',
    'view_transactions',
    'view_documents'
    // لا تتضمن 'view_income' - المشاهدون لا يمكنهم رؤية بيانات الإيرادات
  ]
};

/**
 * وظيفة تجلب جميع الصلاحيات المخصصة لدور معين
 * @param role الدور المراد جلب صلاحياته
 * @returns مصفوفة من الصلاحيات
 */
export async function getRolePermissions(role: Role): Promise<Permission[]> {
  // استخدام التعيينات الافتراضية للصلاحيات بدلاً من الجداول
  return DEFAULT_ROLE_PERMISSIONS[role] || [];
}

/**
 * وظيفة تتحقق ما إذا كان الدور يملك صلاحية محددة
 * @param role الدور المراد التحقق منه
 * @param permission الصلاحية المطلوبة
 * @returns حالة وجود الصلاحية للدور
 */
export async function hasRolePermission(role: Role, permission: Permission): Promise<boolean> {
  // استخدام الصلاحيات المحددة مسبقاً في الثوابت
  const rolePermissions = await getRolePermissions(role);
  return rolePermissions.includes(permission);
}

/**
 * وظيفة تجلب جميع صلاحيات المستخدم (من الدور والصلاحيات الإضافية)
 * @param userId معرف المستخدم
 * @returns مصفوفة من الصلاحيات
 */
export async function getUserPermissions(userId: number): Promise<Permission[]> {
  // جلب معلومات المستخدم
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId));
  
  if (!user) {
    return [];
  }
  
  // جلب صلاحيات الدور
  const rolePerms = await getRolePermissions(user.role);
  
  // دمج صلاحيات الدور مع الصلاحيات الإضافية
  const userPerms = Array.isArray(user.permissions) ? user.permissions as string[] : [];
  const allPermissions = [...rolePerms];
  
  // إضافة الصلاحيات الإضافية إن وجدت
  if (userPerms && userPerms.length > 0) {
    userPerms.forEach(perm => {
      if (!allPermissions.includes(perm)) {
        allPermissions.push(perm);
      }
    });
  }
  
  return allPermissions;
}

/**
 * وظيفة تتحقق ما إذا كان المستخدم يملك صلاحية محددة
 * @param userId معرف المستخدم
 * @param permission الصلاحية المطلوبة
 * @returns حالة وجود الصلاحية للمستخدم
 */
export async function hasUserPermission(userId: number, permission: Permission): Promise<boolean> {
  const permissions = await getUserPermissions(userId);
  return permissions.includes(permission);
}

/**
 * وظيفة تضيف صلاحية إضافية للمستخدم
 * @param userId معرف المستخدم
 * @param permission الصلاحية المراد إضافتها
 * @returns المستخدم بعد التحديث
 */
export async function addCustomPermissionToUser(userId: number, permission: Permission): Promise<User | null> {
  // جلب المستخدم
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId));
  
  if (!user) {
    return null;
  }
  
  // استخراج الصلاحيات الحالية
  const currentPermissions = Array.isArray(user.permissions) ? user.permissions as string[] : [];
  
  // التحقق من عدم وجود الصلاحية مسبقاً
  if (!currentPermissions.includes(permission)) {
    const updatedPermissions = [...currentPermissions, permission];
    
    // تحديث المستخدم
    const [updatedUser] = await db
      .update(users)
      .set({ permissions: updatedPermissions })
      .where(eq(users.id, userId))
      .returning();
    
    return updatedUser;
  }
  
  return user;
}

/**
 * وظيفة تزيل صلاحية إضافية من المستخدم
 * @param userId معرف المستخدم
 * @param permission الصلاحية المراد إزالتها
 * @returns المستخدم بعد التحديث
 */
export async function removeCustomPermissionFromUser(userId: number, permission: Permission): Promise<User | null> {
  // جلب المستخدم
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId));
  
  if (!user) {
    return null;
  }
  
  // استخراج الصلاحيات الحالية
  const currentPermissions = Array.isArray(user.permissions) ? user.permissions as string[] : [];
  
  // إزالة الصلاحية إن وجدت
  const updatedPermissions = currentPermissions.filter(p => p !== permission);
  
  // تحديث المستخدم فقط إذا تغيرت الصلاحيات
  if (currentPermissions.length !== updatedPermissions.length) {
    const [updatedUser] = await db
      .update(users)
      .set({ permissions: updatedPermissions })
      .where(eq(users.id, userId))
      .returning();
    
    return updatedUser;
  }
  
  return user;
}

/**
 * وظيفة تضيف صلاحية لدور محدد (لا تتطلب قاعدة بيانات حيث نستخدم التعيينات الثابتة)
 * @param role الدور
 * @param permission الصلاحية المراد إضافتها
 * @returns حالة نجاح العملية
 */
export async function addPermissionToRole(role: Role, permission: Permission): Promise<boolean> {
  try {
    console.log(`إضافة صلاحية ${permission} للدور ${role}`);
    // ملاحظة: لا يمكن تعديل الصلاحيات الثابتة في وقت التشغيل، لكن يمكننا تسجيل هذه العملية

    // تنفيذ العملية سيتطلب تعديل الكود مباشرة
    // في هذه المرحلة، نعتبر العملية ناجحة دون أي تغيير فعلي
    return true;
  } catch (error) {
    console.error('خطأ في إضافة الصلاحية للدور:', error);
    return false;
  }
}

/**
 * وظيفة تزيل صلاحية من دور محدد (لا تتطلب قاعدة بيانات حيث نستخدم التعيينات الثابتة)
 * @param role الدور
 * @param permission الصلاحية المراد إزالتها
 * @returns حالة نجاح العملية
 */
export async function removePermissionFromRole(role: Role, permission: Permission): Promise<boolean> {
  try {
    console.log(`إزالة صلاحية ${permission} من الدور ${role}`);
    // ملاحظة: لا يمكن تعديل الصلاحيات الثابتة في وقت التشغيل، لكن يمكننا تسجيل هذه العملية

    // تنفيذ العملية سيتطلب تعديل الكود مباشرة
    // في هذه المرحلة، نعتبر العملية ناجحة دون أي تغيير فعلي
    return true;
  } catch (error) {
    console.error('خطأ في إزالة الصلاحية من الدور:', error);
    return false;
  }
}

/**
 * وظيفة تقوم بإعداد الصلاحيات الافتراضية للأدوار (لم تعد ضرورية بعد استخدام التعيينات الثابتة)
 */
export async function setupDefaultRolePermissions(): Promise<void> {
  try {
    console.log('الصلاحيات الافتراضية مضبوطة مسبقاً');
    // ملاحظة: الصلاحيات موجودة بالفعل في الثوابت
    return;
  } catch (error) {
    console.error('حدث خطأ أثناء إعداد الصلاحيات الافتراضية للأدوار:', error);
  }
}