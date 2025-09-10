import { useQuery } from '@tanstack/react-query';
import { ProjectForm } from '@/components/project-form';
import { ProjectList } from '@/components/project-list';
import { queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { CalendarDays, TrendingUp, Users, DollarSign, BarChart3, FolderOpen, Plus } from 'lucide-react';
import { useState } from 'react';

export default function Projects() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  
  interface Project {
    id: number;
    name: string;
    description: string;
    startDate: string;
    status: string;
    progress: number;
  }

  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });
  
  const handleProjectUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
  };

  // إحصائيات المشاريع
  const projectStats = {
    total: projects?.length || 0,
    active: projects?.filter(p => p.status === 'active').length || 0,
    completed: projects?.filter(p => p.status === 'completed').length || 0,
    pending: projects?.filter(p => p.status === 'pending').length || 0,
    avgProgress: projects?.length ? Math.round(projects.reduce((sum, p) => sum + p.progress, 0) / projects.length) : 0
  };
  
  return (
    <div className="page-container pb-mobile-nav-large">
      {/* عنوان الصفحة */}
      <div className="mb-6 space-y-2">
        <div className="flex items-center space-x-2 space-x-reverse">
          <FolderOpen className="h-6 w-6 text-primary" />
          <h1 className="section-title">إدارة المشاريع</h1>
        </div>
        <p className="section-subtitle">
          إدارة وتتبع مشاريع الشركة وحالتها ومتابعة تقدمها
        </p>
      </div>

      {/* إحصائيات سريعة */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">إجمالي المشاريع</p>
              <p className="text-xl sm:text-2xl font-bold">{projectStats.total}</p>
            </div>
            <BarChart3 className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500" />
          </div>
        </Card>
        
        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">مشاريع نشطة</p>
              <p className="text-xl sm:text-2xl font-bold text-green-600">{projectStats.active}</p>
            </div>
            <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-green-500" />
          </div>
        </Card>
        
        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">مشاريع مكتملة</p>
              <p className="text-xl sm:text-2xl font-bold text-blue-600">{projectStats.completed}</p>
            </div>
            <Users className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500" />
          </div>
        </Card>
        
        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">متوسط التقدم</p>
              <p className="text-xl sm:text-2xl font-bold text-purple-600">{projectStats.avgProgress}%</p>
            </div>
            <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 text-purple-500" />
          </div>
        </Card>
      </div>

      {/* التبويبات الرئيسية */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <TabsList className={`${user?.role === 'admin' ? 'grid-cols-3' : 'grid-cols-2'} grid w-full max-w-lg mx-auto sm:mx-0 h-auto p-1 bg-gray-100 dark:bg-gray-800 rounded-lg`}>
            <TabsTrigger 
              value="overview" 
              className="px-3 py-3 text-sm font-medium rounded-md transition-all duration-200 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm flex-1 text-gray-700 dark:text-gray-300 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white"
            >
              <div className="flex items-center gap-2 min-w-0">
                <BarChart3 className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">نظرة عامة</span>
              </div>
            </TabsTrigger>
            <TabsTrigger 
              value="list" 
              className="px-3 py-3 text-sm font-medium rounded-md transition-all duration-200 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm flex-1 text-gray-700 dark:text-gray-300 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white"
            >
              <div className="flex items-center gap-2 min-w-0">
                <FolderOpen className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">قائمة المشاريع</span>
              </div>
            </TabsTrigger>
            {user?.role === 'admin' && (
              <TabsTrigger 
                value="add" 
                className="px-3 py-3 text-sm font-medium rounded-md transition-all duration-200 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm flex-1 text-gray-700 dark:text-gray-300 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-4 w-4 flex-shrink-0 flex items-center justify-center bg-green-100 dark:bg-green-800 text-green-600 dark:text-green-300 rounded-full text-xs font-bold">+</div>
                  <span className="truncate">إضافة مشروع</span>
                </div>
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* نظرة عامة */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">حالة المشاريع</CardTitle>
                <CardDescription>توزيع المشاريع حسب الحالة</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-sm">نشطة</span>
                  </div>
                  <Badge variant="secondary">{projectStats.active}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-sm">مكتملة</span>
                  </div>
                  <Badge variant="secondary">{projectStats.completed}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <span className="text-sm">قيد الانتظار</span>
                  </div>
                  <Badge variant="secondary">{projectStats.pending}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">التقدم العام</CardTitle>
                <CardDescription>متوسط تقدم جميع المشاريع</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">التقدم الإجمالي</span>
                    <span className="text-sm font-bold">{projectStats.avgProgress}%</span>
                  </div>
                  <Progress value={projectStats.avgProgress} className="h-2" />
                  <div className="text-xs text-muted-foreground">
                    بناءً على {projectStats.total} مشروع
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* المشاريع الحديثة */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                المشاريع الحديثة
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setActiveTab('list')}
                >
                  عرض الكل
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : projects && projects.length > 0 ? (
                <div className="space-y-3">
                  {projects.slice(0, 5).map((project) => (
                    <div key={project.id} className="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-sm">{project.name}</h4>
                        <Badge 
                          variant={
                            project.status === 'active' ? 'default' :
                            project.status === 'completed' ? 'secondary' : 'outline'
                          }
                          className="text-xs"
                        >
                          {project.status === 'active' ? 'نشط' : 
                           project.status === 'completed' ? 'مكتمل' : 'معلق'}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">
                          {new Date(project.startDate).toLocaleDateString('ar-SA')}
                        </span>
                        <div className="flex items-center space-x-2 space-x-reverse">
                          <span className="text-xs font-medium">{project.progress}%</span>
                          <Progress value={project.progress} className="h-1 w-16" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>لا توجد مشاريع متاحة</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* قائمة المشاريع */}
        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">جميع المشاريع</CardTitle>
              <CardDescription>قائمة شاملة بجميع مشاريع الشركة</CardDescription>
            </CardHeader>
            <CardContent>
              <ProjectList projects={projects || []} isLoading={isLoading} onUpdate={handleProjectUpdated} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* إضافة مشروع جديد */}
        {user?.role === 'admin' && (
          <TabsContent value="add" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center space-x-2 space-x-reverse">
                  <FolderOpen className="h-5 w-5" />
                  <span>إضافة مشروع جديد</span>
                </CardTitle>
                <CardDescription>
                  أدخل تفاصيل المشروع الجديد لإضافته إلى النظام
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ProjectForm onSubmit={handleProjectUpdated} />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}