/**
 * System Schema (Unified)
 * ملف سِكما موحد يجمع:
 * - تعريف الأدوار والصلاحيات الافتراضية
 * - تجميعة الجداول (Drizzle) من schema.ts لإعادة التصدير المركزي
 * - كتالوج "عمليات" النظام وربطها بالصلاحيات/الأدوار المطلوبة
 * ملاحظة: هذا الملف ليس مصدر ترحيل للمخطط؛ ملف الترحيل يبقى shared/schema.ts
 */

// استيراد كل عناصر المخطط الأساسي للاستخدام المحلي
import * as S from './schema';
// وإعادة تصديرها للاستعمال الخارجي من نقطة مركزية واحدة
export * from './schema';

// خريطة الصلاحيات الافتراضية لكل دور
// إبقاءها متوافقة مع server/permissions.ts
export const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  admin: [
    'view_dashboard',
    'manage_users', 'view_users',
    'manage_projects', 'view_projects',
    'manage_project_transactions', 'view_project_transactions',
    'manage_transactions', 'view_transactions',
    'manage_documents', 'view_documents',
    'view_reports', 'view_activity_logs',
    'manage_settings', 'view_income'
  ],
  manager: [
    'view_dashboard', 'view_users',
    'manage_projects', 'view_projects',
    'manage_project_transactions', 'view_project_transactions',
    'manage_transactions', 'view_transactions',
    'manage_documents', 'view_documents',
    'view_reports', 'view_income'
  ],
  user: [
    'view_dashboard', 'view_projects',
    'manage_project_transactions', 'view_project_transactions',
    'manage_transactions', 'view_transactions',
    'manage_documents', 'view_documents'
  ],
  viewer: [
    'view_dashboard', 'view_projects',
    'view_project_transactions', 'view_transactions',
    'view_documents'
  ],
};

// تعريف مفاتيح العمليات على مستوى النظام (مستوى منطقي أعلى من مسارات HTTP)
export type SystemOperationKey =
  // مصادقة
  | 'auth.login' | 'auth.logout'
  // مستخدمون
  | 'user.create' | 'user.update' | 'user.delete' | 'user.list' | 'user.assignProject' | 'user.removeProject'
  // مشاريع
  | 'project.create' | 'project.update' | 'project.delete' | 'project.list'
  // معاملات
  | 'transaction.create' | 'transaction.update' | 'transaction.delete' | 'transaction.list' | 'transaction.export'
  // مستندات
  | 'document.upload' | 'document.link' | 'document.delete' | 'document.list'
  // سجل النشاطات
  | 'activityLog.view'
  // إعدادات
  | 'settings.update' | 'settings.view'
  // صناديق
  | 'fund.deposit' | 'fund.withdraw' | 'fund.adminTransaction' | 'fund.list'
  // أنواع المصروفات ودَفتر الأستاذ
  | 'expenseType.manage' | 'expenseType.view' | 'ledger.view' | 'ledger.create'
  // دفعات مؤجلة
  | 'deferredPayment.create' | 'deferredPayment.pay' | 'deferredPayment.delete' | 'deferredPayment.list'
  // موظفون
  | 'employee.create' | 'employee.update' | 'employee.delete' | 'employee.list' | 'employee.paySalary' | 'employee.resetSalaries'
  // صلاحيات تعديل المعاملات
  | 'transactionEditPermission.grant' | 'transactionEditPermission.revoke' | 'transactionEditPermission.view'
  // أعمال منجزة
  | 'completedWork.create' | 'completedWork.update' | 'completedWork.delete' | 'completedWork.list' | 'completedWork.archive'
  // نظام التخزين الهجين وSupabase
  | 'cloud.init' | 'cloud.sync' | 'cloud.migrate' | 'hybridStorage.status' | 'hybridStorage.backupNow' | 'hybridStorage.config'
  // إدارة قاعدة البيانات
  | 'admin.db.setup';

// كتالوج العمليات وربطها بالصلاحيات/الأدوار المطلوبة
export const OPERATIONS_CATALOG: Record<SystemOperationKey, {
  description: string;
  requiredAnyPermissions?: string[]; // يكفي امتلاك واحد منها
  requiredAllPermissions?: string[]; // يجب امتلاكها كلها
  allowedRoles?: string[]; // أدوار مسموحة مباشرة
}> = {
  // Auth
  'auth.login': { description: 'تسجيل الدخول' },
  'auth.logout': { description: 'تسجيل الخروج' },

  // Users
  'user.create': { description: 'إنشاء مستخدم', allowedRoles: ['admin'] },
  'user.update': { description: 'تحديث مستخدم', allowedRoles: ['admin'] },
  'user.delete': { description: 'حذف مستخدم', allowedRoles: ['admin'] },
  'user.list': { description: 'عرض المستخدمين', requiredAnyPermissions: ['view_users'] },
  'user.assignProject': { description: 'ربط مستخدم بمشروع', allowedRoles: ['admin'] },
  'user.removeProject': { description: 'إزالة ربط مستخدم بمشروع', allowedRoles: ['admin'] },

  // Projects
  'project.create': { description: 'إنشاء مشروع', requiredAnyPermissions: ['manage_projects'] },
  'project.update': { description: 'تحديث مشروع', requiredAnyPermissions: ['manage_projects'] },
  'project.delete': { description: 'حذف مشروع', allowedRoles: ['admin'] },
  'project.list': { description: 'عرض المشاريع', requiredAnyPermissions: ['view_projects'] },

  // Transactions
  'transaction.create': { description: 'إنشاء معاملة', requiredAnyPermissions: ['manage_transactions', 'manage_project_transactions'] },
  'transaction.update': { description: 'تحديث معاملة', requiredAnyPermissions: ['manage_transactions'] },
  'transaction.delete': { description: 'حذف معاملة', requiredAnyPermissions: ['manage_transactions'] },
  'transaction.list': { description: 'عرض المعاملات', requiredAnyPermissions: ['view_transactions', 'view_project_transactions'] },
  'transaction.export': { description: 'تصدير المعاملات', requiredAnyPermissions: ['view_transactions'] },

  // Documents
  'document.upload': { description: 'رفع مستند', requiredAnyPermissions: ['manage_documents'] },
  'document.link': { description: 'ربط مستند بمعاملة', requiredAnyPermissions: ['manage_documents'] },
  'document.delete': { description: 'حذف مستند', requiredAnyPermissions: ['manage_documents'] },
  'document.list': { description: 'عرض المستندات', requiredAnyPermissions: ['view_documents'] },

  // Activity Logs
  'activityLog.view': { description: 'عرض سجل النشاطات', requiredAnyPermissions: ['view_activity_logs'] },

  // Settings
  'settings.update': { description: 'تحديث الإعدادات', requiredAnyPermissions: ['manage_settings'] },
  'settings.view': { description: 'عرض الإعدادات', requiredAnyPermissions: ['manage_settings', 'view_dashboard'] },

  // Funds
  'fund.deposit': { description: 'إيداع في صندوق مشروع', requiredAnyPermissions: ['manage_project_transactions'] },
  'fund.withdraw': { description: 'سحب من صندوق مشروع', requiredAnyPermissions: ['manage_project_transactions'] },
  'fund.adminTransaction': { description: 'عملية صندوق المدير', allowedRoles: ['admin'] },
  'fund.list': { description: 'عرض الصناديق', requiredAnyPermissions: ['view_projects', 'view_transactions'] },

  // Expense Types & Ledger
  'expenseType.manage': { description: 'إدارة أنواع المصروفات', requiredAnyPermissions: ['manage_transactions'] },
  'expenseType.view': { description: 'عرض أنواع المصروفات', requiredAnyPermissions: ['view_transactions'] },
  'ledger.view': { description: 'عرض دفتر الأستاذ', requiredAnyPermissions: ['view_transactions'] },
  'ledger.create': { description: 'إنشاء مدخل دفتر أستاذ', requiredAnyPermissions: ['manage_transactions'] },

  // Deferred Payments
  'deferredPayment.create': { description: 'إنشاء دفعة مؤجلة', requiredAnyPermissions: ['manage_transactions'] },
  'deferredPayment.pay': { description: 'تسجيل دفعة على مستحق', requiredAnyPermissions: ['manage_transactions'] },
  'deferredPayment.delete': { description: 'حذف مستحق', allowedRoles: ['admin', 'manager'] },
  'deferredPayment.list': { description: 'عرض المستحقات', requiredAnyPermissions: ['view_transactions'] },

  // Employees
  'employee.create': { description: 'إنشاء موظف', requiredAnyPermissions: ['manage_projects'] },
  'employee.update': { description: 'تحديث موظف', requiredAnyPermissions: ['manage_projects'] },
  'employee.delete': { description: 'حذف موظف', requiredAnyPermissions: ['manage_projects'] },
  'employee.list': { description: 'عرض الموظفين', requiredAnyPermissions: ['view_projects'] },
  'employee.paySalary': { description: 'صرف راتب موظف', requiredAnyPermissions: ['manage_transactions'] },
  'employee.resetSalaries': { description: 'إعادة تعيين رواتب الموظفين', allowedRoles: ['admin', 'manager'] },

  // Transaction Edit Permissions
  'transactionEditPermission.grant': { description: 'منح صلاحية تعديل المعاملات', allowedRoles: ['admin', 'manager'] },
  'transactionEditPermission.revoke': { description: 'سحب صلاحية تعديل المعاملات', allowedRoles: ['admin', 'manager'] },
  'transactionEditPermission.view': { description: 'عرض صلاحيات التعديل', requiredAnyPermissions: ['view_transactions'] },

  // Completed Works
  'completedWork.create': { description: 'إضافة عمل منجز', requiredAnyPermissions: ['manage_projects'] },
  'completedWork.update': { description: 'تحديث عمل منجز', requiredAnyPermissions: ['manage_projects'] },
  'completedWork.delete': { description: 'حذف عمل منجز', requiredAnyPermissions: ['manage_projects'] },
  'completedWork.list': { description: 'عرض الأعمال المنجزة', requiredAnyPermissions: ['view_projects'] },
  'completedWork.archive': { description: 'أرشفة عمل منجز', requiredAnyPermissions: ['manage_projects'] },

  // Cloud & Hybrid Storage
  'cloud.init': { description: 'تهيئة التخزين السحابي', allowedRoles: ['admin'] },
  'cloud.sync': { description: 'مزامنة الملفات للسحابة', allowedRoles: ['admin'] },
  'cloud.migrate': { description: 'هجرة آمنة للسحابة', allowedRoles: ['admin'] },
  'hybridStorage.status': { description: 'فحص حالة التخزين الهجين', requiredAnyPermissions: ['view_dashboard'] },
  'hybridStorage.backupNow': { description: 'نسخ احتياطي فوري', allowedRoles: ['admin'] },
  'hybridStorage.config': { description: 'تحديث إعدادات التخزين الهجين', allowedRoles: ['admin'] },

  // DB Admin
  'admin.db.setup': { description: 'إعداد/ترحيل قاعدة البيانات وإنشاء admin', allowedRoles: ['admin'] },
};

// تجميعة وصول موحدة للجداول (تسهّل الاستيراد في المواضع الأخرى)
export const Tables = {
  users: S.users,
  projects: S.projects,
  transactions: S.transactions,
  userProjects: S.userProjects,
  documents: S.documents,
  documentTransactionLinks: S.documentTransactionLinks,
  activityLogs: S.activityLogs,
  settings: S.settings,
  transactionEditPermissions: S.transactionEditPermissions,
  expenseTypes: S.expenseTypes,
  ledgerEntries: S.ledgerEntries,
  funds: S.funds,
  employees: S.employees,
  accountCategories: S.accountCategories,
  deferredPayments: S.deferredPayments,
};

// أدوات مساعدة بسيطة للتحقق من الصلاحيات مقابل كتالوج العمليات
export function canRoleExecute(operation: SystemOperationKey, role: string, permissions: string[] = []): boolean {
  const rule = OPERATIONS_CATALOG[operation];
  if (!rule) return false;
  if (rule.allowedRoles?.includes(role)) return true;

  const hasAny = (rule.requiredAnyPermissions ?? []).some(p => permissions.includes(p));
  const hasAll = (rule.requiredAllPermissions ?? []).every(p => permissions.includes(p));
  if (rule.requiredAllPermissions && rule.requiredAllPermissions.length > 0) {
    return hasAll;
  }
  return hasAny;
}
