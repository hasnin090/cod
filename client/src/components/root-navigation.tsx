import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  BarChart3,
  Building2,
  Calendar,
  CreditCard,
  Database,
  DollarSign,
  FileIcon,
  MessageSquare,
  Settings,
  Shield,
  TrendingUp,
  Users,
  Archive,
  Activity,
  CheckCircle,
  Cloud
} from "lucide-react";

interface NavigationCard {
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  path: string;
  color: string;
  bgGradient: string;
  category: 'main' | 'financial' | 'management' | 'system';
  permission?: 'admin' | 'manager';
}

const navigationCards: NavigationCard[] = [
  // الأقسام الرئيسية
  {
    title: "العمليات المالية",
    description: "إضافة وإدارة العمليات والمعاملات المالية",
    icon: DollarSign,
    path: "/transactions",
    color: "text-green-600",
    bgGradient: "bg-gradient-to-br from-green-50 to-green-100",
    category: "financial"
  },
  {
    title: "المشاريع",
    description: "إدارة المشاريع ومتابعة حالتها",
    icon: Building2,
    path: "/projects",
    color: "text-purple-600",
    bgGradient: "bg-gradient-to-br from-purple-50 to-purple-100",
    category: "main"
  },
  {
    title: "المستندات",
    description: "إدارة وتنظيم المستندات والملفات",
    icon: FileIcon,
    path: "/documents",
    color: "text-orange-600",
    bgGradient: "bg-gradient-to-br from-orange-50 to-orange-100",
    category: "main"
  },

  // القسم المالي
  {
    title: "الذمم المدينة",
    description: "متابعة المستحقات والديون",
    icon: CreditCard,
    path: "/receivables",
    color: "text-amber-600",
    bgGradient: "bg-gradient-to-br from-amber-50 to-amber-100",
    category: "financial"
  },
  {
    title: "الدفعات المؤجلة",
    description: "إدارة الدفعات والاستحقاقات المؤجلة",
    icon: Calendar,
    path: "/deferred-payments",
    color: "text-rose-600",
    bgGradient: "bg-gradient-to-br from-rose-50 to-rose-100",
    category: "financial"
  },
  {
    title: "التقارير",
    description: "تقارير مالية وإحصائية شاملة",
    icon: TrendingUp,
    path: "/reports",
    color: "text-teal-600",
    bgGradient: "bg-gradient-to-br from-teal-50 to-teal-100",
    category: "financial",
    permission: "admin"
  },

  // إدارة العمليات
  {
    title: "المستخدمين",
    description: "إدارة حسابات المستخدمين والصلاحيات",
    icon: Users,
    path: "/users",
    color: "text-indigo-600",
    bgGradient: "bg-gradient-to-br from-indigo-50 to-indigo-100",
    category: "management"
  },
  {
    title: "الموظفين",
    description: "إدارة بيانات الموظفين والحضور",
    icon: Users,
    path: "/employees",
    color: "text-pink-600",
    bgGradient: "bg-gradient-to-br from-pink-50 to-pink-100",
    category: "management",
    permission: "admin"
  },
  {
    title: "الأرشيف",
    description: "أرشيف العمليات والمستندات القديمة",
    icon: Archive,
    path: "/archive",
    color: "text-gray-600",
    bgGradient: "bg-gradient-to-br from-gray-50 to-gray-100",
    category: "management"
  },
  {
    title: "سجل النشاطات",
    description: "تتبع جميع العمليات في النظام",
    icon: Activity,
    path: "/activities",
    color: "text-cyan-600",
    bgGradient: "bg-gradient-to-br from-cyan-50 to-cyan-100",
    category: "management"
  },
  {
    title: "الأعمال المنجزة",
    description: "متابعة حالة إنجاز المشاريع",
    icon: CheckCircle,
    path: "/completed-works",
    color: "text-emerald-600",
    bgGradient: "bg-gradient-to-br from-emerald-50 to-emerald-100",
    category: "management",
    permission: "manager"
  },
  {
    title: "الإعدادات",
    description: "إعدادات النظام والتفضيلات",
    icon: Settings,
    path: "/settings",
    color: "text-slate-600",
    bgGradient: "bg-gradient-to-br from-slate-50 to-slate-100",
    category: "management"
  },

  // إدارة النظام
  {
    title: "إدارة قاعدة البيانات",
    description: "صيانة وإدارة قاعدة البيانات",
    icon: Database,
    path: "/database-management",
    color: "text-red-600",
    bgGradient: "bg-gradient-to-br from-red-50 to-red-100",
    category: "system",
    permission: "admin"
  },
  {
    title: "تكامل واتساب",
    description: "إعدادات وإدارة تكامل واتساب",
    icon: MessageSquare,
    path: "/whatsapp-integration",
    color: "text-green-600",
    bgGradient: "bg-gradient-to-br from-green-50 to-green-100",
    category: "system",
    permission: "admin"
  },
  {
    title: "إدارة النظام",
    description: "إعدادات متقدمة وإدارة النظام",
    icon: Shield,
    path: "/system-management",
    color: "text-red-600",
    bgGradient: "bg-gradient-to-br from-red-50 to-red-100",
    category: "system",
    permission: "admin"
  },
  {
    title: "التخزين المختلط",
    description: "إدارة التخزين السحابي والمحلي",
    icon: Cloud,
    path: "/hybrid-storage",
    color: "text-blue-600",
    bgGradient: "bg-gradient-to-br from-blue-50 to-blue-100",
    category: "system",
    permission: "admin"
  }
];

export function RootNavigation() {
  const { user } = useAuth();

  const filteredCards = navigationCards.filter((card) => {
    if (!card.permission) return true;
    if (card.permission === "admin" && user?.role === "admin") return true;
    if (card.permission === "manager" && (user?.role === "admin" || user?.role === "manager")) return true;
    return false;
  });

  const categorizeCards = (category: string) => 
    filteredCards.filter((card) => card.category === category);

  const mainCards = categorizeCards("main");
  const financialCards = categorizeCards("financial");
  const managementCards = categorizeCards("management");
  const systemCards = categorizeCards("system");

  const CategorySection = ({ title, cards }: { title: string; cards: NavigationCard[] }) => {
    if (cards.length === 0) return null;

    return (
      <div className="mb-12">
        <h2 className="root-heading-md text-center mb-8">{title}</h2>
        <div className="root-grid">
          {cards.map((card) => {
            const IconComponent = card.icon;
            return (
              <Link key={card.path} href={card.path}>
                <div className="root-navigation-card group">
                  <div className={`w-20 h-20 rounded-2xl ${card.bgGradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-all duration-300 shadow-lg`}>
                    <IconComponent className={`w-10 h-10 ${card.color}`} />
                  </div>
                  <h3 className="root-heading-sm text-center mb-3">{card.title}</h3>
                  <p className="root-text-muted text-sm text-center leading-relaxed">{card.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="root-container-wide">
      <div className="text-center mb-16">
        <h1 className="root-heading-lg text-4xl mb-6">نظام المحاسبة المهني</h1>
        <p className="root-text-muted text-xl">
          مرحباً بك <span className="root-text font-semibold">{user?.name || user?.username}</span>، 
          اختر القسم الذي تريد الوصول إليه
        </p>
      </div>

      <CategorySection title="الأقسام الرئيسية" cards={[...mainCards, ...financialCards.slice(0, 1)]} />
      <CategorySection title="الإدارة المالية" cards={financialCards} />
      <CategorySection title="إدارة العمليات" cards={managementCards} />
      {systemCards.length > 0 && (
        <CategorySection title="إدارة النظام" cards={systemCards} />
      )}
    </div>
  );
}