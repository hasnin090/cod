import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { DocumentForm } from '@/components/document-form';
import { DocumentList } from '@/components/document-list';
import { queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  FileText, Plus, Search, Filter, Upload, Download, 
  Eye, Calendar, File, FolderOpen, Archive, Settings,
  FileImage, FileSpreadsheet, Clock, Shield
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface Document {
  id: number;
  name: string;
  fileName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  description?: string;
  projectId?: number;
  isManagerDocument: boolean;
  uploadedBy: number;
  uploadedAt: string;
  downloadCount: number;
}

interface Project {
  id: number;
  name: string;
}

interface DocumentFilter {
  searchQuery?: string;
  projectId?: string;
  fileType?: string;
  isManagerDocument?: boolean;
  dateRange?: string;
}

export default function Documents() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // حالات الفلترة والعرض
  const [activeTab, setActiveTab] = useState<'overview' | 'all' | 'projects' | 'manager'>('overview');
  const [filter, setFilter] = useState<DocumentFilter>({});
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  // جلب البيانات
  const { data: documents, isLoading: documentsLoading } = useQuery<Document[]>({
    queryKey: ['/api/documents'],
    queryFn: async () => {
      const response = await fetch('/api/documents');
      if (!response.ok) throw new Error('فشل في جلب الوثائق');
      return response.json();
    },
  });

  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
    queryFn: async () => {
      const response = await fetch('/api/projects');
      if (!response.ok) throw new Error('فشل في جلب المشاريع');
      return response.json();
    },
  });

  // تصفية الوثائق
  const filteredDocuments = useMemo(() => {
    if (!documents) return [];
    
    return documents.filter(document => {
      // فلترة حسب البحث
      if (filter.searchQuery) {
        const searchTerm = filter.searchQuery.toLowerCase();
        const matchesName = document.name.toLowerCase().includes(searchTerm);
        const matchesFileName = document.fileName.toLowerCase().includes(searchTerm);
        const matchesDescription = document.description?.toLowerCase().includes(searchTerm);
        if (!matchesName && !matchesFileName && !matchesDescription) return false;
      }
      
      // فلترة حسب المشروع
      if (filter.projectId && filter.projectId !== 'all') {
        if (document.projectId?.toString() !== filter.projectId) return false;
      }
      
      // فلترة حسب نوع الملف
      if (filter.fileType && filter.fileType !== 'all') {
        const fileType = getFileType(document.fileType);
        if (fileType !== filter.fileType) return false;
      }
      
      // فلترة حسب نوع الوثيقة (إدارية أم عامة)
      if (filter.isManagerDocument !== undefined) {
        if (document.isManagerDocument !== filter.isManagerDocument) return false;
      }
      
      return true;
    });
  }, [documents, filter]);

  // إحصائيات الوثائق
  const statistics = useMemo(() => {
    if (!documents?.length) {
      return {
        total: 0,
        general: 0,
        manager: 0,
        totalSize: 0,
        recentUploads: 0
      };
    }

    const totalSize = documents.reduce((sum, doc) => sum + (doc.fileSize || 0), 0);
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 7);
    
    return {
      total: documents.length,
      general: documents.filter(d => !d.isManagerDocument).length,
      manager: documents.filter(d => d.isManagerDocument).length,
      totalSize,
      recentUploads: documents.filter(d => new Date(d.uploadedAt) > recentDate).length
    };
  }, [documents]);

  // دالة لتحديد نوع الملف
  const getFileType = (mimeType: string): string => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.includes('pdf')) return 'pdf';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'document';
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'spreadsheet';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation';
    return 'other';
  };

  // دالة لتحويل حجم الملف
  const formatFileSize = (bytes: number): string => {
    if (!bytes) return '0 بايت';
    const k = 1024;
    const sizes = ['بايت', 'كيلوبايت', 'ميجابايت', 'جيجابايت'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // دالة لتحديد أيقونة نوع الملف
  const getFileIcon = (fileType: string) => {
    switch (getFileType(fileType)) {
      case 'image': return <FileImage className="h-5 w-5" />;
      case 'pdf': return <FileText className="h-5 w-5" />;
      case 'document': return <File className="h-5 w-5" />;
      case 'spreadsheet': return <FileSpreadsheet className="h-5 w-5" />;
      default: return <File className="h-5 w-5" />;
    }
  };

  // إضافة وثيقة جديدة
  const handleDocumentAdded = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
    setShowUploadDialog(false);
    toast({
      title: "تم الرفع بنجاح",
      description: "تم رفع الوثيقة الجديدة بنجاح",
    });
  };

  // فحص الصلاحيات
  const isManagerOrAdmin = user?.role === 'admin' || user?.role === 'manager';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* الهيدر الرئيسي */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-primary/10 p-3 rounded-xl">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  إدارة الوثائق
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  إدارة ومشاركة الملفات والوثائق الخاصة بالمشاريع
                </p>
              </div>
            </div>
            
            {user?.role !== 'viewer' && (
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => setShowUploadDialog(true)}
                  size="lg"
                  className="bg-primary hover:bg-primary/90 shadow-lg"
                >
                  <Upload className="h-5 w-5 ml-2" />
                  رفع وثيقة جديدة
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* إحصائيات سريعة */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-700">إجمالي الوثائق</p>
                  <p className="text-2xl font-bold text-blue-900">{statistics.total}</p>
                </div>
                <div className="bg-blue-200 p-3 rounded-full">
                  <FileText className="h-6 w-6 text-blue-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700">الوثائق العامة</p>
                  <p className="text-2xl font-bold text-green-900">{statistics.general}</p>
                </div>
                <div className="bg-green-200 p-3 rounded-full">
                  <FolderOpen className="h-6 w-6 text-green-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-amber-700">الوثائق الإدارية</p>
                  <p className="text-2xl font-bold text-amber-900">{statistics.manager}</p>
                </div>
                <div className="bg-amber-200 p-3 rounded-full">
                  <Shield className="h-6 w-6 text-amber-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-700">المساحة المستخدمة</p>
                  <p className="text-2xl font-bold text-purple-900">
                    {formatFileSize(statistics.totalSize)}
                  </p>
                </div>
                <div className="bg-purple-200 p-3 rounded-full">
                  <Archive className="h-6 w-6 text-purple-700" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* قسم البحث والفلترة */}
        <Card className="mb-8 shadow-lg">
          <CardHeader className="bg-gray-50 border-b border-gray-200">
            <CardTitle className="flex items-center gap-3 text-xl text-gray-900">
              <Filter className="h-6 w-6" />
              البحث والفلترة
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* البحث */}
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="البحث في الوثائق..."
                  value={filter.searchQuery || ''}
                  onChange={(e) => setFilter({ ...filter, searchQuery: e.target.value })}
                  className="pr-10"
                />
              </div>

              {/* المشروع */}
              <Select
                value={filter.projectId || 'all'}
                onValueChange={(value) => setFilter({ ...filter, projectId: value === 'all' ? undefined : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="جميع المشاريع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع المشاريع</SelectItem>
                  {projects?.map((project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* نوع الملف */}
              <Select
                value={filter.fileType || 'all'}
                onValueChange={(value) => setFilter({ ...filter, fileType: value === 'all' ? undefined : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="جميع أنواع الملفات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الأنواع</SelectItem>
                  <SelectItem value="image">صور</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="document">مستندات</SelectItem>
                  <SelectItem value="spreadsheet">جداول بيانات</SelectItem>
                  <SelectItem value="other">أخرى</SelectItem>
                </SelectContent>
              </Select>

              {/* إعادة تعيين الفلاتر */}
              <Button
                variant="outline"
                onClick={() => setFilter({})}
                className="w-full"
              >
                مسح الفلاتر
              </Button>
            </div>

            {/* عرض الفلاتر النشطة */}
            {(filter.searchQuery || filter.projectId || filter.fileType) && (
              <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-gray-200">
                <span className="text-sm font-medium text-gray-700">الفلاتر النشطة:</span>
                
                {filter.searchQuery && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    البحث: {filter.searchQuery}
                  </Badge>
                )}
                
                {filter.projectId && filter.projectId !== 'all' && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    المشروع: {projects?.find(p => p.id.toString() === filter.projectId)?.name}
                  </Badge>
                )}
                
                {filter.fileType && filter.fileType !== 'all' && (
                  <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                    النوع: {filter.fileType}
                  </Badge>
                )}
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
                  <FileText className="h-4 w-4 ml-2" />
                  جميع الوثائق
                </TabsTrigger>
                <TabsTrigger 
                  value="projects"
                  className="data-[state=active]:bg-white data-[state=active]:text-blue-600"
                >
                  <FolderOpen className="h-4 w-4 ml-2" />
                  وثائق المشاريع
                </TabsTrigger>
                {isManagerOrAdmin && (
                  <TabsTrigger 
                    value="manager"
                    className="data-[state=active]:bg-white data-[state=active]:text-amber-600"
                  >
                    <Shield className="h-4 w-4 ml-2" />
                    الوثائق الإدارية
                  </TabsTrigger>
                )}
              </TabsList>
            </Tabs>
          </CardHeader>
          
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)}>
              <TabsContent value="overview" className="p-6">
                <div className="space-y-6">
                  {/* آخر الوثائق المرفوعة */}
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      آخر الوثائق المرفوعة
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredDocuments.slice(0, 6).map((document) => (
                        <Card key={document.id} className="hover:shadow-lg transition-shadow border-l-4 border-l-primary">
                          <CardHeader className="pb-3">
                            <div className="flex items-start gap-3">
                              <div className="bg-gray-100 p-2 rounded-lg">
                                {getFileIcon(document.fileType)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <CardTitle className="text-base font-semibold text-gray-900 truncate">
                                  {document.name}
                                </CardTitle>
                                <p className="text-sm text-gray-600 mt-1">
                                  {document.fileName}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">
                                {formatFileSize(document.fileSize)}
                              </Badge>
                              {document.isManagerDocument && (
                                <Badge className="bg-amber-100 text-amber-800 text-xs">
                                  إداري
                                </Badge>
                              )}
                            </div>
                          </CardHeader>
                          
                          <CardContent className="pt-0">
                            <div className="flex items-center justify-between text-sm text-gray-600">
                              <span>تاريخ الرفع</span>
                              <span>{format(new Date(document.uploadedAt), 'dd/MM/yyyy', { locale: ar })}</span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="all" className="p-6">
                <DocumentList 
                  documents={filteredDocuments} 
                  projects={projects || []}
                  isLoading={documentsLoading}
                />
              </TabsContent>

              <TabsContent value="projects" className="p-6">
                <DocumentList 
                  documents={filteredDocuments.filter(d => d.projectId && !d.isManagerDocument)} 
                  projects={projects || []}
                  isLoading={documentsLoading}
                />
              </TabsContent>

              {isManagerOrAdmin && (
                <TabsContent value="manager" className="p-6">
                  <DocumentList 
                    documents={filteredDocuments.filter(d => d.isManagerDocument)} 
                    projects={projects || []}
                    isLoading={documentsLoading}
                  />
                </TabsContent>
              )}
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* حوار رفع وثيقة جديدة */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Upload className="h-5 w-5" />
              رفع وثيقة جديدة
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <DocumentForm 
              projects={projects || []} 
              onSubmit={handleDocumentAdded}
              isLoading={projectsLoading}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}