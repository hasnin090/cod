import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { Activity, User as UserIcon, FileText, Settings, FolderOpen, Eye, Edit, Trash2, LogIn, LogOut, Plus, Clock, Filter } from 'lucide-react';

interface ActivityLog {
  id: number;
  action: string;
  entityType: string;
  entityId: number;
  details: string;
  timestamp: string;
  userId: number | null;
}

interface User {
  id: number;
  name: string;
  username: string;
  role: string;
}

interface Filter {
  entityType?: string;
  userId?: number;
  startDate?: string;
  endDate?: string;
}

export default function Activities() {
  const [filter, setFilter] = useState<Filter>({});
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  
  // التحقق من صلاحيات المستخدم، إذا لم يكن مدير يتم التوجيه إلى الصفحة الرئيسية
  useEffect(() => {
    if (user && user.role !== 'admin') {
      setLocation('/');
    }
  }, [user, setLocation]);
  
  // إذا لم يكن المستخدم مدير، لا نعرض أي محتوى
  if (!user || user.role !== 'admin') {
    return null;
  }
  
  const { data: logs, isLoading: logsLoading } = useQuery<ActivityLog[]>({
    queryKey: ['/api/activity-logs', filter],
    queryFn: async ({ queryKey }) => {
      const [_, filterParams] = queryKey;
      const params = new URLSearchParams();
      
      if (filterParams && typeof filterParams === 'object') {
        const f = filterParams as Filter;
        if (f.entityType) params.append('entityType', String(f.entityType));
        if (f.userId) params.append('userId', String(f.userId));
        if (f.startDate) params.append('startDate', String(f.startDate));
        if (f.endDate) params.append('endDate', String(f.endDate));
      }
      
      const response = await fetch(`/api/activity-logs?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch activity logs');
      return response.json();
    }
  });
  
  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
  
  const handleFilterChange = (newFilter: Partial<Filter>) => {
    setFilter({ ...filter, ...newFilter });
  };
  
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return format(date, 'yyyy/MM/dd hh:mm a', { locale: ar });
  };
  
  const getUserName = (userId: number | null | undefined) => {
    if (usersLoading) {
      return 'جاري التحميل...';
    }
    
    // إذا كان userId فارغ أو null أو undefined
    if (!userId || userId === null || userId === undefined) {
      return 'النظام';
    }
    
    if (!users || users.length === 0) {
      return 'غير محدد';
    }
    
    const user = users.find(u => u.id === Number(userId));
    if (user) {
      return user.name || user.username || `مستخدم #${userId}`;
    } else {
      return `مستخدم غير معروف #${userId}`;
    }
  };
  
  const getActionText = (action: string) => {
    switch (action) {
      case 'create': return 'إضافة';
      case 'update': return 'تحديث';
      case 'delete': return 'حذف';
      case 'login': return 'تسجيل دخول';
      case 'logout': return 'تسجيل خروج';
      default: return action;
    }
  };
  
  const getEntityTypeText = (entityType: string) => {
    switch (entityType) {
      case 'transaction': return 'معاملة مالية';
      case 'project': return 'مشروع';
      case 'user': return 'مستخدم';
      case 'document': return 'مستند';
      case 'setting': return 'إعداد';
      default: return entityType;
    }
  };
  
  const getActionColor = (action: string) => {
    switch (action) {
      case 'create': return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800';
      case 'update': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
      case 'delete': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
      case 'login': return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800';
      case 'logout': return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800';
      default: return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'create': return <Plus className="w-3 h-3" />;
      case 'update': return <Edit className="w-3 h-3" />;
      case 'delete': return <Trash2 className="w-3 h-3" />;
      case 'login': return <LogIn className="w-3 h-3" />;
      case 'logout': return <LogOut className="w-3 h-3" />;
      default: return <Activity className="w-3 h-3" />;
    }
  };

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case 'transaction': return <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
      case 'project': return <FolderOpen className="w-5 h-5 text-green-600 dark:text-green-400" />;
      case 'user': return <UserIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />;
      case 'document': return <FileText className="w-5 h-5 text-orange-600 dark:text-orange-400" />;
      case 'setting': return <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />;
      case 'expense_type': return <Settings className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
      default: return <Activity className="w-5 h-5 text-gray-600 dark:text-gray-400" />;
    }
  };
  
  return (
    <div className="space-y-4 md:space-y-6 p-3 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4 md:mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
            <Activity className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">سجل النشاطات</h1>
            <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">تتبع جميع العمليات والأنشطة في النظام</p>
          </div>
        </div>
      </div>
      
      <Card className="border-0 shadow-lg bg-white dark:bg-gray-800">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-800 dark:text-gray-200">
            <Filter className="w-5 h-5" />
            تصفية سجل النشاطات
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="filterEntityType" className="text-sm font-medium text-gray-700 dark:text-gray-300">نوع العنصر</Label>
              <Select 
                onValueChange={(value) => handleFilterChange({ entityType: value || undefined })}
                value={filter.entityType || ""}
              >
                <SelectTrigger id="filterEntityType" className="w-full h-10">
                  <SelectValue placeholder="كل الأنواع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الأنواع</SelectItem>
                  <SelectItem value="transaction">معاملة مالية</SelectItem>
                  <SelectItem value="project">مشروع</SelectItem>
                  <SelectItem value="user">مستخدم</SelectItem>
                  <SelectItem value="document">مستند</SelectItem>
                  <SelectItem value="setting">إعداد</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="filterUser" className="text-sm font-medium text-gray-700 dark:text-gray-300">المستخدم</Label>
              <Select 
                onValueChange={(value) => handleFilterChange({ userId: value ? parseInt(value) : undefined })}
                value={filter.userId?.toString() || ""}
              >
                <SelectTrigger id="filterUser" className="w-full h-10">
                  <SelectValue placeholder="كل المستخدمين" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل المستخدمين</SelectItem>
                  {!usersLoading && users?.map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="startDate" className="text-sm font-medium text-gray-700 dark:text-gray-300">من تاريخ</Label>
              <Input
                id="startDate"
                type="date"
                className="w-full h-10"
                onChange={(e) => handleFilterChange({ startDate: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="endDate" className="text-sm font-medium text-gray-700 dark:text-gray-300">إلى تاريخ</Label>
              <Input
                id="endDate"
                type="date"
                className="w-full h-10"
                onChange={(e) => handleFilterChange({ endDate: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {logsLoading ? (
        <div className="text-center py-20">
          <div className="spinner w-8 h-8 mx-auto"></div>
          <p className="mt-4 text-muted">جاري تحميل البيانات...</p>
        </div>
      ) : logs && logs.length > 0 ? (
        <div className="space-y-4" id="activitiesList">
          {logs.map((log) => (
            <Card key={log.id} className="border-0 shadow-md hover:shadow-lg transition-all duration-200 bg-white dark:bg-gray-800">
              <CardContent className="p-4 md:p-5">
                <div className="flex flex-col space-y-4 md:flex-row md:items-start md:gap-4 md:space-y-0">
                  {/* رأس البطاقة للهاتف */}
                  <div className="flex items-center justify-between md:hidden">
                    <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg border border-blue-100 dark:border-blue-800">
                      <UserIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm font-semibold text-blue-700 dark:text-blue-300 min-w-0">
                        {getUserName(log.userId)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="font-medium">{formatTimestamp(log.timestamp)}</span>
                    </div>
                  </div>

                  {/* أيقونة نوع العنصر */}
                  <div className="flex-shrink-0 self-start">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl flex items-center justify-center border border-blue-100 dark:border-blue-800">
                      {getEntityIcon(log.entityType)}
                    </div>
                  </div>
                  
                  {/* المحتوى الرئيسي */}
                  <div className="flex-1 min-w-0 space-y-3">
                    {/* رأس البطاقة للكمبيوتر */}
                    <div className="hidden md:flex md:items-center md:justify-between">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg border border-blue-100 dark:border-blue-800">
                          <UserIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <span className="text-sm font-semibold text-blue-700 dark:text-blue-300 truncate">
                            {getUserName(log.userId)}
                          </span>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={`${getActionColor(log.action)} border text-xs font-medium flex items-center gap-1.5 px-2.5 py-1`}
                        >
                          {getActionIcon(log.action)}
                          {getActionText(log.action)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="font-medium">{formatTimestamp(log.timestamp)}</span>
                      </div>
                    </div>
                    
                    {/* نوع العملية والعنصر للهاتف */}
                    <div className="flex flex-wrap items-center gap-2 md:hidden">
                      <Badge 
                        variant="outline" 
                        className={`${getActionColor(log.action)} border text-xs font-medium flex items-center gap-1.5 px-2.5 py-1`}
                      >
                        {getActionIcon(log.action)}
                        {getActionText(log.action)}
                      </Badge>
                      <span className="text-xs text-gray-500 dark:text-gray-400">على</span>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md">
                        {getEntityTypeText(log.entityType)}
                      </span>
                    </div>

                    {/* نوع العنصر للكمبيوتر */}
                    <div className="hidden md:flex md:items-center md:gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">النوع:</span>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md">
                        {getEntityTypeText(log.entityType)}
                      </span>
                    </div>
                    
                    {/* تفاصيل النشاط */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-100 dark:border-gray-600">
                      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed break-words">
                        {log.details}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-0 shadow-md bg-white dark:bg-gray-800">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Activity className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">لا توجد سجلات نشاط</h3>
            <p className="text-gray-500 dark:text-gray-400">لا توجد سجلات نشاط متطابقة مع معايير التصفية المحددة</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
