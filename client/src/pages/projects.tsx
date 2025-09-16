import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ProjectForm } from '@/components/project-form';
import { ProjectList } from '@/components/project-list';
import { queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  FolderOpen, Plus, Search, Filter, BarChart3, Users, 
  Calendar, Target, TrendingUp, Clock, CheckCircle2, 
  AlertCircle, Pause, Play, Eye, Settings
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface Project {
  id: number;
  name: string;
  description: string;
  startDate: string;
  endDate?: string;
  status: 'active' | 'completed' | 'pending' | 'paused';
  progress: number;
  budget?: number;
  spent?: number;
  teamSize?: number;
  priority: 'high' | 'medium' | 'low';
}

interface ProjectFilter {
  searchQuery?: string;
  status?: string;
  priority?: string;
}

export default function Projects() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // حالات الفلترة والعرض
  const [activeTab, setActiveTab] = useState<'overview' | 'all' | 'active' | 'completed'>('overview');
  const [filter, setFilter] = useState<ProjectFilter>({});
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // جلب البيانات
  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
    queryFn: async () => {
      const response = await fetch('/api/projects');
      if (!response.ok) throw new Error('فشل في جلب المشاريع');
      return response.json();
    },
  });

  // تصفية المشاريع
  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    
    return projects.filter(project => {
      // فلترة حسب البحث
      if (filter.searchQuery) {
        const searchTerm = filter.searchQuery.toLowerCase();
        const matchesName = project.name.toLowerCase().includes(searchTerm);
        const matchesDescription = project.description?.toLowerCase().includes(searchTerm);
        if (!matchesName && !matchesDescription) return false;
      }
      
      // فلترة حسب الحالة
      if (filter.status && project.status !== filter.status) return false;
      
      // فلترة حسب الأولوية
      if (filter.priority && project.priority !== filter.priority) return false;
      
      return true;
    });
  }, [projects, filter]);

  // إحصائيات المشاريع
  const statistics = useMemo(() => {
    if (!projects?.length) {
      return {
        total: 0,
        active: 0,
        completed: 0,
        pending: 0,
        paused: 0,
        avgProgress: 0,
        totalBudget: 0,
        totalSpent: 0
      };
    }

    return {
      total: projects.length,
      active: projects.filter(p => p.status === 'active').length,
      completed: projects.filter(p => p.status === 'completed').length,
      pending: projects.filter(p => p.status === 'pending').length,
      paused: projects.filter(p => p.status === 'paused').length,
      avgProgress: Math.round(projects.reduce((sum, p) => sum + p.progress, 0) / projects.length),
      totalBudget: projects.reduce((sum, p) => sum + (p.budget || 0), 0),
      totalSpent: projects.reduce((sum, p) => sum + (p.spent || 0), 0)
    };
  }, [projects]);

  const handleProjectUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
    toast({
      title: "تم الحفظ بنجاح",
      description: "تم تحديث بيانات المشروع بنجاح",
    });
  };

  // دالة لتحديد لون الحالة
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'completed': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'paused': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <Play className="h-4 w-4" />;
      case 'completed': return <CheckCircle2 className="h-4 w-4" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'paused': return <Pause className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'نشط';
      case 'completed': return 'مكتمل';
      case 'pending': return 'قيد الانتظار';
      case 'paused': return 'متوقف';
      default: return 'غير محدد';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* الهيدر الرئيسي */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-primary/10 p-3 rounded-xl">
                <FolderOpen className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  إدارة المشاريع
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  إدارة ومتابعة جميع المشاريع وحالة التقدم
                </p>
              </div>
            </div>
            
            {user?.role !== 'viewer' && (
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 shadow-lg"
              >
                <Plus className="h-5 w-5 ml-2" />
                مشروع جديد
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* إحصائيات سريعة */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-700">إجمالي المشاريع</p>
                  <p className="text-2xl font-bold text-blue-900">{statistics.total}</p>
                </div>
                <div className="bg-blue-200 p-3 rounded-full">
                  <FolderOpen className="h-6 w-6 text-blue-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700">المشاريع النشطة</p>
                  <p className="text-2xl font-bold text-green-900">{statistics.active}</p>
                </div>
                <div className="bg-green-200 p-3 rounded-full">
                  <Play className="h-6 w-6 text-green-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-700">المشاريع المكتملة</p>
                  <p className="text-2xl font-bold text-purple-900">{statistics.completed}</p>
                </div>
                <div className="bg-purple-200 p-3 rounded-full">
                  <CheckCircle2 className="h-6 w-6 text-purple-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-amber-700">قيد الانتظار</p>
                  <p className="text-2xl font-bold text-amber-900">{statistics.pending}</p>
                </div>
                <div className="bg-amber-200 p-3 rounded-full">
                  <Clock className="h-6 w-6 text-amber-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-teal-50 to-teal-100 border-teal-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-teal-700">متوسط التقدم</p>
                  <p className="text-2xl font-bold text-teal-900">{statistics.avgProgress}%</p>
                </div>
                <div className="bg-teal-200 p-3 rounded-full">
                  <BarChart3 className="h-6 w-6 text-teal-700" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* نموذج إضافة مشروع جديد */}
        {user?.role !== 'viewer' && (
          <Card className="mb-8 shadow-lg border-primary/20">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b border-primary/20">
              <CardTitle className="flex items-center gap-3 text-xl text-primary">
                <Plus className="h-6 w-6" />
                إضافة مشروع جديد
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <ProjectForm onSubmit={handleProjectUpdated} />
            </CardContent>
          </Card>
        )}

        {/* قسم البحث والفلترة */}
        <Card className="mb-8 shadow-lg">
          <CardHeader className="bg-gray-50 border-b border-gray-200">
            <CardTitle className="flex items-center gap-3 text-xl text-gray-900">
              <Filter className="h-6 w-6" />
              البحث والفلترة
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {/* البحث */}
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="البحث في اسم المشروع أو الوصف..."
                  value={filter.searchQuery || ''}
                  onChange={(e) => setFilter({ ...filter, searchQuery: e.target.value })}
                  className="pr-10"
                />
              </div>

              {/* حالة المشروع */}
              <Select
                value={filter.status || 'all'}
                onValueChange={(value) => setFilter({ ...filter, status: value === 'all' ? undefined : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="حالة المشروع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  <SelectItem value="active">نشط</SelectItem>
                  <SelectItem value="completed">مكتمل</SelectItem>
                  <SelectItem value="pending">قيد الانتظار</SelectItem>
                  <SelectItem value="paused">متوقف</SelectItem>
                </SelectContent>
              </Select>

              {/* الأولوية */}
              <Select
                value={filter.priority || 'all'}
                onValueChange={(value) => setFilter({ ...filter, priority: value === 'all' ? undefined : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="الأولوية" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الأولويات</SelectItem>
                  <SelectItem value="high">عالية</SelectItem>
                  <SelectItem value="medium">متوسطة</SelectItem>
                  <SelectItem value="low">منخفضة</SelectItem>
                </SelectContent>
              </Select>

              {/* وضع العرض */}
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === 'cards' ? "default" : "outline"}
                  onClick={() => setViewMode('cards')}
                  size="sm"
                >
                  <BarChart3 className="h-4 w-4 ml-2" />
                  بطاقات
                </Button>
                <Button
                  variant={viewMode === 'table' ? "default" : "outline"}
                  onClick={() => setViewMode('table')}
                  size="sm"
                >
                  <Eye className="h-4 w-4 ml-2" />
                  جدول
                </Button>
              </div>
            </div>

            {/* عرض الفلاتر النشطة */}
            {(filter.searchQuery || filter.status || filter.priority) && (
              <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-gray-200">
                <span className="text-sm font-medium text-gray-700">الفلاتر النشطة:</span>
                
                {filter.searchQuery && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    البحث: {filter.searchQuery}
                  </Badge>
                )}
                
                {filter.status && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    الحالة: {getStatusText(filter.status)}
                  </Badge>
                )}
                
                {filter.priority && (
                  <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                    الأولوية: {filter.priority === 'high' ? 'عالية' : filter.priority === 'medium' ? 'متوسطة' : 'منخفضة'}
                  </Badge>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilter({})}
                  className="text-red-600 hover:bg-red-50"
                >
                  مسح الفلاتر
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* التبويبات والمحتوى */}
        <Card className="shadow-lg">
          <CardHeader className="bg-white border-b border-gray-200">
            <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)}>
              <TabsList className="grid w-full grid-cols-4 bg-gray-100">
                <TabsTrigger 
                  value="overview" 
                  className="data-[state=active]:bg-white data-[state=active]:text-primary"
                >
                  <Eye className="h-4 w-4 ml-2" />
                  نظرة عامة
                </TabsTrigger>
                <TabsTrigger 
                  value="all"
                  className="data-[state=active]:bg-white data-[state=active]:text-primary"
                >
                  <FolderOpen className="h-4 w-4 ml-2" />
                  جميع المشاريع
                </TabsTrigger>
                <TabsTrigger 
                  value="active"
                  className="data-[state=active]:bg-white data-[state=active]:text-green-600"
                >
                  <Play className="h-4 w-4 ml-2" />
                  النشطة
                </TabsTrigger>
                <TabsTrigger 
                  value="completed"
                  className="data-[state=active]:bg-white data-[state=active]:text-blue-600"
                >
                  <CheckCircle2 className="h-4 w-4 ml-2" />
                  المكتملة
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)}>
              <TabsContent value="overview" className="p-6">
                <div className="space-y-6">
                  {/* مؤشرات الأداء */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-6 rounded-lg border border-emerald-200">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-emerald-900">معدل الإنجاز</h3>
                        <TrendingUp className="h-6 w-6 text-emerald-600" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-emerald-700">متوسط التقدم</span>
                          <span className="text-sm font-bold text-emerald-900">{statistics.avgProgress}%</span>
                        </div>
                        <Progress value={statistics.avgProgress} className="h-2" />
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-sky-50 to-sky-100 p-6 rounded-lg border border-sky-200">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-sky-900">إنتاجية الفريق</h3>
                        <Users className="h-6 w-6 text-sky-600" />
                      </div>
                      <div className="text-2xl font-bold text-sky-900">
                        {statistics.active} مشروع نشط
                      </div>
                      <p className="text-sm text-sky-700 mt-2">من أصل {statistics.total} مشروع</p>
                    </div>

                    <div className="bg-gradient-to-br from-violet-50 to-violet-100 p-6 rounded-lg border border-violet-200">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-violet-900">معدل الإكمال</h3>
                        <Target className="h-6 w-6 text-violet-600" />
                      </div>
                      <div className="text-2xl font-bold text-violet-900">
                        {statistics.total > 0 ? Math.round((statistics.completed / statistics.total) * 100) : 0}%
                      </div>
                      <p className="text-sm text-violet-700 mt-2">{statistics.completed} مشروع مكتمل</p>
                    </div>
                  </div>

                  {/* المشاريع الأخيرة */}
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      المشاريع الحديثة
                    </h3>
                    
                    {viewMode === 'cards' ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredProjects.slice(0, 6).map((project) => (
                          <Card key={project.id} className="hover:shadow-lg transition-shadow border-l-4 border-l-primary">
                            <CardHeader className="pb-3">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <CardTitle className="text-lg font-semibold text-gray-900 mb-1">
                                    {project.name}
                                  </CardTitle>
                                  <p className="text-sm text-gray-600 line-clamp-2">
                                    {project.description}
                                  </p>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2 mt-3">
                                <Badge className={getStatusColor(project.status)}>
                                  {getStatusIcon(project.status)}
                                  <span className="mr-1">{getStatusText(project.status)}</span>
                                </Badge>
                                <Badge className={getPriorityColor(project.priority)}>
                                  {project.priority === 'high' ? 'عالية' : 
                                   project.priority === 'medium' ? 'متوسطة' : 'منخفضة'}
                                </Badge>
                              </div>
                            </CardHeader>
                            
                            <CardContent className="pt-0">
                              <div className="space-y-3">
                                <div>
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="text-sm text-gray-600">التقدم</span>
                                    <span className="text-sm font-semibold text-gray-900">{project.progress}%</span>
                                  </div>
                                  <Progress value={project.progress} className="h-2" />
                                </div>
                                
                                <div className="flex items-center justify-between text-sm text-gray-600">
                                  <span>تاريخ البدء</span>
                                  <span>{format(new Date(project.startDate), 'dd/MM/yyyy', { locale: ar })}</span>
                                </div>
                                
                                {project.teamSize && (
                                  <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <Users className="h-4 w-4" />
                                    <span>{project.teamSize} عضو</span>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <ProjectList 
                        projects={filteredProjects} 
                        onProjectUpdated={handleProjectUpdated}
                        isLoading={isLoading}
                      />
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="all" className="p-6">
                <ProjectList 
                  projects={filteredProjects} 
                  onProjectUpdated={handleProjectUpdated}
                  isLoading={isLoading}
                />
              </TabsContent>

              <TabsContent value="active" className="p-6">
                <ProjectList 
                  projects={filteredProjects.filter(p => p.status === 'active')} 
                  onProjectUpdated={handleProjectUpdated}
                  isLoading={isLoading}
                />
              </TabsContent>

              <TabsContent value="completed" className="p-6">
                <ProjectList 
                  projects={filteredProjects.filter(p => p.status === 'completed')} 
                  onProjectUpdated={handleProjectUpdated}
                  isLoading={isLoading}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}