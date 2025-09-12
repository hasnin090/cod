import React, { ReactNode } from 'react';
import { useLocation } from 'wouter';
import NetSuiteLayout from './NetSuiteLayout';

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [location] = useLocation();

  // تحديد العنوان والوصف حسب المسار
  const getPageInfo = () => {
    switch (location) {
      case '/':
        return {
          title: 'لوحة التحكم',
          subtitle: 'مرحباً بك في نظام المحاسبة المطور',
          icon: '📊',
          breadcrumbs: [{ label: 'الرئيسية' }]
        };
      case '/transactions':
        return {
          title: 'إدارة المعاملات',
          subtitle: 'عرض وإدارة جميع المعاملات المالية',
          icon: '💳',
          breadcrumbs: [
            { label: 'الرئيسية', href: '/' },
            { label: 'المعاملات' }
          ]
        };
      case '/reports':
        return {
          title: 'التقارير والتحليلات',
          subtitle: 'عرض وإنشاء التقارير المالية',
          icon: '📈',
          breadcrumbs: [
            { label: 'الرئيسية', href: '/' },
            { label: 'التقارير' }
          ]
        };
      case '/users':
        return {
          title: 'إدارة العملاء',
          subtitle: 'عرض وإدارة جميع العملاء والموردين',
          icon: '👥',
          breadcrumbs: [
            { label: 'الرئيسية', href: '/' },
            { label: 'العملاء' }
          ]
        };
      case '/projects':
        return {
          title: 'إدارة المشاريع',
          subtitle: 'عرض وإدارة جميع المشاريع',
          icon: '📋',
          breadcrumbs: [
            { label: 'الرئيسية', href: '/' },
            { label: 'المشاريع' }
          ]
        };
      case '/employees':
        return {
          title: 'إدارة الموظفين',
          subtitle: 'عرض وإدارة الموظفين',
          icon: '👨‍💼',
          breadcrumbs: [
            { label: 'الرئيسية', href: '/' },
            { label: 'الموظفين' }
          ]
        };
      case '/documents':
        return {
          title: 'إدارة المستندات',
          subtitle: 'عرض وإدارة المستندات',
          icon: '📁',
          breadcrumbs: [
            { label: 'الرئيسية', href: '/' },
            { label: 'المستندات' }
          ]
        };
      case '/archive':
        return {
          title: 'الأرشيف',
          subtitle: 'عرض الملفات المؤرشفة',
          icon: '🗃️',
          breadcrumbs: [
            { label: 'الرئيسية', href: '/' },
            { label: 'الأرشيف' }
          ]
        };
      case '/activities':
        return {
          title: 'سجل النشاطات',
          subtitle: 'عرض سجل النشاطات والعمليات',
          icon: '📝',
          breadcrumbs: [
            { label: 'الرئيسية', href: '/' },
            { label: 'النشاطات' }
          ]
        };
      case '/settings':
        return {
          title: 'الإعدادات',
          subtitle: 'إدارة إعدادات النظام',
          icon: '⚙️',
          breadcrumbs: [
            { label: 'الرئيسية', href: '/' },
            { label: 'الإعدادات' }
          ]
        };
      default:
        return {
          title: 'النظام',
          subtitle: 'نظام المحاسبة المطور',
          icon: '🏢',
          breadcrumbs: [{ label: 'الرئيسية' }]
        };
    }
  };

  const pageInfo = getPageInfo();

  return (
    <NetSuiteLayout
      title={pageInfo.title}
      subtitle={pageInfo.subtitle}
      icon={pageInfo.icon}
      breadcrumbs={pageInfo.breadcrumbs}
    >
      {children}
    </NetSuiteLayout>
  );
};

export default AppLayout;