import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { DocumentForm } from '@/components/document-form';
import { DocumentList, DocumentSidebar } from '@/components/document';
import { DocumentLinker } from '@/components/document-library/document-linker';
import { BulkFolderUpload } from '@/components/document-library/bulk-folder-upload';
import { queryClient } from '@/lib/queryClient';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/use-auth';
import { Badge } from "@/components/ui/badge";
import { Lock, ShieldAlert, FileText, AlertCircle, CalendarIcon, File, FileImage, Clock, Filter, Search, Download, Eye, Calendar as CalendarIcon2, Plus, Upload, X, Folder, FolderOpen, Paperclip, Link } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format, addDays } from "date-fns";
import { ar } from "date-fns/locale";
import {
  Calendar
} from "@/components/ui/calendar";
import { getMainFileType, getFileTypeIconName, getFileTypeLabel, getFileTypeBadgeClasses } from "@/utils/file-utils";
import { EmptyState, SectionHeader, LoadingState, FileTypeIcon, FileTypeBadge } from '@/components/common';
import type { Document, Project } from '@/types';

interface Filter {
  projectId?: number;
  isManagerDocument?: boolean;
  fileType?: string;
  searchQuery?: string;
  dateRange?: {
    from: Date | null | undefined;
    to: Date | null | undefined;
  };
}

export default function Documents() {
  const [filter, setFilter] = useState<Filter>({});
  const [activeTab, setActiveTab] = useState("general"); // "general", "projects", o "manager"
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showReuploadDialog, setShowReuploadDialog] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [reuploadFile, setReuploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteAttachmentDialog, setShowDeleteAttachmentDialog] = useState(false);
  const [attachmentToDelete, setAttachmentToDelete] = useState<Transaction | null>(null);
  const [isDeletingAttachment, setIsDeletingAttachment] = useState(false);
  const { user } = useAuth();
  const isManagerOrAdmin = user?.role === 'admin' || user?.role === 'manager';

  // العادية المستندات
  const { data: documents, isLoading: documentsLoading } = useQuery<Document[]>({
    queryKey: ['/api/documents', { ...filter, isManagerDocument: false }],
    queryFn: async ({ queryKey }) => {
      const [_, filterParams] = queryKey as [string, { projectId?: number, isManagerDocument?: boolean }];
      const params = new URLSearchParams();
      
      if (filterParams.projectId) params.append('projectId', String(filterParams.projectId));
      if (filterParams.isManagerDocument !== undefined) params.append('isManagerDocument', String(filterParams.isManagerDocument));
      
      const response = await fetch(`/api/documents?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch documents');
      return response.json();
    }
  });
  
  // المستندات الإدارية (خاصة بالمدراء)
  const { data: managerDocuments, isLoading: managerDocumentsLoading } = useQuery<Document[]>({
    queryKey: ['/api/documents', { ...filter, isManagerDocument: true }],
    queryFn: async ({ queryKey }) => {
      const [_, filterParams] = queryKey as [string, { projectId?: number, isManagerDocument?: boolean }];
      const params = new URLSearchParams();
      
      if (filterParams.projectId) params.append('projectId', String(filterParams.projectId));
      params.append('isManagerDocument', 'true');
      
      const response = await fetch(`/api/documents?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch manager documents');
      return response.json();
    },
    enabled: isManagerOrAdmin // تفعيل هذا الاستعلام فقط للمديرين
  });
  
  // استخدام الأنواع من ملف الأنواع المشتركة

  interface Transaction {
    id: number;
    date: string;
    amount: number;
    type: string;
    description: string;
    projectId?: number;
    createdBy: number;
    fileUrl?: string;
    fileType?: string;
  }
  
  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });
  
  // الحصول على المعاملات التي تحتوي على مرفقات
  const { data: transactionsWithAttachments, isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: ['/api/transactions/attachments'],
    queryFn: async () => {
      const response = await fetch('/api/transactions?withAttachments=true');
      if (!response.ok) throw new Error('Failed to fetch transactions with attachments');
      const transactions = await response.json();
      // فلترة المعاملات التي تحتوي فقط على مرفقات
      return transactions.filter((transaction: Transaction) => transaction.fileUrl);
    },
    enabled: activeTab === "attachments"
  });
  
  const handleFilterChange = (newFilter: Partial<Filter>) => {
    setFilter({ ...filter, ...newFilter });
  };
  
  const handleDocumentUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
  };
  
  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };
  
  // التعامل مع إعادة رفع المستند المرفق
  const handleReuploadClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setShowReuploadDialog(true);
  };

  // التعامل مع حذف مرفق المعاملة
  const handleDeleteAttachmentClick = (transaction: Transaction) => {
    setAttachmentToDelete(transaction);
    setShowDeleteAttachmentDialog(true);
  };
  
  // إعادة تعيين حالة إعادة الرفع
  const resetReuploadState = () => {
    setSelectedTransaction(null);
    setReuploadFile(null);
    setShowReuploadDialog(false);
    setIsUploading(false);
  };

  // حذف مرفق المعاملة
  const handleDeleteAttachmentSubmit = async () => {
    if (!attachmentToDelete) return;
    
    setIsDeletingAttachment(true);
    
    try {
      const response = await fetch(`/api/transactions/${attachmentToDelete.id}/delete-attachment`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('فشل في حذف المرفق');
      }
      
      // تحديث البيانات
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions/attachments'] });
      
      // إعادة تعيين الحالة
      setAttachmentToDelete(null);
      setShowDeleteAttachmentDialog(false);
      
      alert('تم حذف المرفق بنجاح!');
    } catch (error) {
      console.error('خطأ في حذف المرفق:', error);
      alert('حدث خطأ أثناء حذف المرفق. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsDeletingAttachment(false);
    }
  };
  
  // رفع الملف المحدث للمعاملة
  const handleReuploadSubmit = async () => {
    if (!selectedTransaction || !reuploadFile) return;
    
    setIsUploading(true);
    
    try {
      // إنشاء نموذج بيانات للرفع
      const formData = new FormData();
      formData.append('file', reuploadFile);
      formData.append('transactionId', selectedTransaction.id.toString());
      
      // إرسال طلب تحديث المرفق
      const response = await fetch(`/api/transactions/${selectedTransaction.id}/reupload-attachment`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('فشل في تحديث المرفق');
      }
      
      // تحديث البيانات
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions/attachments'] });
      
      // إغلاق الحوار
      resetReuploadState();
      
      // إظهار رسالة نجاح
      alert('تم تحديث المرفق بنجاح');
    } catch (error) {
      console.error('خطأ في تحديث المرفق:', error);
      alert('حدث خطأ أثناء تحديث المرفق');
    } finally {
      setIsUploading(false);
    }
  };

  // حذف المستند
  const handleDeleteDocument = async () => {
    if (!documentToDelete) return;
    
    setIsDeleting(true);
    
    try {
      const response = await fetch(`/api/documents/${documentToDelete.id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'فشل في حذف المستند');
      }
      
      // تحديث البيانات
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      
      // إغلاق الحوار
      setShowDeleteDialog(false);
      setDocumentToDelete(null);
      
      // إظهار رسالة نجاح
      alert('تم حذف المستند بنجاح');
    } catch (error) {
      console.error('خطأ في حذف المستند:', error);
      alert(error instanceof Error ? error.message : 'حدث خطأ أثناء حذف المستند');
    } finally {
      setIsDeleting(false);
    }
  };
  
  // تحديد المستندات المناسبة حسب علامة التبويب النشطة وتطبيق الفلاتر
  const getActiveDocuments = () => {
    let activeDocuments = activeTab === "manager" ? (managerDocuments || []) : (documents || []);
    
    // فلترة حسب نوع الملف
    if (filter.fileType && filter.fileType !== 'all') {
      activeDocuments = activeDocuments.filter(doc => {
        const type = getMainFileType(doc.fileType);
        return type === filter.fileType;
      });
    }
    
    // فلترة حسب التاريخ
    if (filter.dateRange?.from || filter.dateRange?.to) {
      activeDocuments = activeDocuments.filter(doc => {
        const uploadDate = new Date(doc.uploadDate);
        
        // التحقق من تاريخ البداية
        if (filter.dateRange?.from) {
          const fromDate = new Date(filter.dateRange.from);
          fromDate.setHours(0, 0, 0, 0);
          if (uploadDate < fromDate) {
            return false;
          }
        }
        
        // التحقق من تاريخ النهاية
        if (filter.dateRange?.to) {
          const toDate = new Date(filter.dateRange.to);
          toDate.setHours(23, 59, 59, 999);
          if (uploadDate > toDate) {
            return false;
          }
        }
        
        return true;
      });
    }
    
    // فلترة حسب البحث النصي
    if (filter.searchQuery) {
      const searchTerm = filter.searchQuery.toLowerCase().trim();
      activeDocuments = activeDocuments.filter(doc => {
        return (
          doc.name.toLowerCase().includes(searchTerm) || 
          (doc.description && doc.description.toLowerCase().includes(searchTerm)) ||
          projects?.find(p => p.id === doc.projectId)?.name.toLowerCase().includes(searchTerm)
        );
      });
    }
    
    return activeDocuments;
  };

  // تحديد حالة التحميل المناسبة حسب علامة التبويب النشطة
  const isActiveTabLoading = () => {
    if (activeTab === "manager") {
      return managerDocumentsLoading;
    }
    return documentsLoading;
  };
  
  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="py-6 px-4 pb-mobile-nav-large">
  <div className="page-container max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[hsl(var(--primary))] flex items-center gap-3">
            <FileText className="w-8 h-8 text-[hsl(var(--primary))]" />
            إدارة المستندات
          </h1>
          <p className="text-[hsl(var(--muted-foreground))] mt-2">إدارة وتنظيم مستندات المشاريع والملفات المهمة</p>
        </div>
        
        <div className="bg-card border border-border rounded-xl shadow-sm p-4 sm:p-6 mb-6">
          <Tabs defaultValue="all" value={activeTab} onValueChange={handleTabChange} className="w-full">
            {/* شريط التبويبات المحسن */}
            <div className="flex flex-col space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-lg font-semibold text-foreground flex items-center">
                  <Folder className="ml-2 h-5 w-5 text-primary" />
                  تصنيف المستندات
                </h2>
                
                {user?.role !== 'viewer' && (
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="h-9 px-4 text-sm rounded-lg flex items-center gap-2"
                    onClick={() => setShowUploadDialog(true)}
                  >
                    <Upload className="h-4 w-4" />
                    رفع مستند جديد
                  </Button>
                )}
              </div>
              
              {/* التبويبات بتصميم أنيق ومنظم */}
              <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 gap-1 bg-muted/30 p-1 rounded-lg h-auto">
                <TabsTrigger 
                  value="all" 
                  className="flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary rounded-md transition-all"
                >
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">المستندات العامة</span>
                  <span className="sm:hidden">عامة</span>
                </TabsTrigger>
                
                <TabsTrigger 
                  value="projects" 
                  className="flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary rounded-md transition-all"
                >
                  <FolderOpen className="h-4 w-4" />
                  <span className="hidden sm:inline">حسب المشروع</span>
                  <span className="sm:hidden">مشاريع</span>
                </TabsTrigger>
                
                {isManagerOrAdmin && (
                  <TabsTrigger 
                    value="manager" 
                    className="flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-amber-600 rounded-md transition-all col-span-2 lg:col-span-1"
                  >
                    <Lock className="h-4 w-4" />
                    <span className="hidden sm:inline">مستندات إدارية</span>
                    <span className="sm:hidden">إدارية</span>
                  </TabsTrigger>
                )}
                
                <TabsTrigger 
                  value="attachments" 
                  className="flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary rounded-md transition-all"
                >
                  <Paperclip className="h-4 w-4" />
                  <span className="hidden sm:inline">مرفقات المعاملات</span>
                  <span className="sm:hidden">مرفقات</span>
                </TabsTrigger>
                
                <TabsTrigger 
                  value="link-manager" 
                  className="flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-blue-600 rounded-md transition-all"
                >
                  <Link className="h-4 w-4" />
                  <span className="hidden sm:inline">ربط الملفات</span>
                  <span className="sm:hidden">ربط</span>
                </TabsTrigger>
              </TabsList>
            </div>
        
        {activeTab === "manager" && !isManagerOrAdmin && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>لا يمكن الوصول</AlertTitle>
            <AlertDescription>
              لا تملك الصلاحيات اللازمة للوصول إلى مستندات المدراء.
            </AlertDescription>
          </Alert>
        )}
        
        <TabsContent value="all" className="p-0">
          {/* العامة المستندات محتوى - تصميم متجاوب تم تخصيصه للعرض العمودي في الشاشات الصغيرة */}
          <div className="flex flex-col lg:flex-row gap-2 sm:gap-3 md:gap-4 lg:gap-5">
            {/* شريط جانبي للشاشات الكبيرة */}
            <div className="hidden lg:block w-64 xl:w-72 shrink-0">
              <DocumentSidebar
                documents={documents || []}
                projects={projects || []}
                filter={filter}
                onFilterChange={handleFilterChange}
                onUploadClick={() => setShowUploadDialog(true)}
                className="sticky top-16"
              />
            </div>
            
            {/* شريط بحث بسيط للجوال */}
            <div className="block lg:hidden mb-4">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute right-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="بحث عن مستند..."
                    value={filter.searchQuery || ''}
                    onChange={(e) => handleFilterChange({ searchQuery: e.target.value })}
                    className="pl-2 pr-8 h-9 text-xs sm:text-sm"
                  />
                </div>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="h-9 px-2 sm:px-3 flex items-center gap-1"
                    >
                      <Filter className="h-3.5 w-3.5" />
                      <span className="text-xs hidden xs:inline">فلترة</span>
                      {(filter.projectId || filter.fileType || filter.dateRange?.from) && (
                        <Badge variant="secondary" className="ml-1 h-5 rounded-full px-1.5 text-[10px]">
                          {(filter.projectId ? 1 : 0) + (filter.fileType ? 1 : 0) + (filter.dateRange?.from ? 1 : 0)}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-4" align="end">
                    <div className="space-y-4">
                      <h3 className="font-semibold text-sm">خيارات الفلترة</h3>
                      
                      <div>
                        <Label htmlFor="mobileProjectFilter" className="text-xs mb-1.5 block">المشروع</Label>
                        <Select
                          value={filter.projectId?.toString() || 'all'}
                          onValueChange={(value) => handleFilterChange({ projectId: value === 'all' ? undefined : value ? parseInt(value) : undefined })}
                        >
                          <SelectTrigger id="mobileProjectFilter" className="w-full h-9 text-xs">
                            <SelectValue placeholder="كل المشاريع" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">كل المشاريع</SelectItem>
                            {!projectsLoading && projects?.map((project: Project) => (
                              <SelectItem key={project.id} value={project.id.toString()}>
                                {project.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label htmlFor="mobileTypeFilter" className="text-xs mb-1.5 block">نوع الملف</Label>
                        <Select
                          value={filter.fileType || 'all'}
                          onValueChange={(value) => handleFilterChange({ fileType: value === 'all' ? undefined : value })}
                        >
                          <SelectTrigger id="mobileTypeFilter" className="w-full h-9 text-xs">
                            <SelectValue placeholder="كل الأنواع" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">كل الأنواع</SelectItem>
                            <SelectItem value="image">صور</SelectItem>
                            <SelectItem value="pdf">PDF</SelectItem>
                            <SelectItem value="document">مستندات</SelectItem>
                            <SelectItem value="spreadsheet">جداول بيانات</SelectItem>
                            <SelectItem value="presentation">عروض تقديمية</SelectItem>
                            <SelectItem value="other">أخرى</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label className="text-xs mb-1.5 block">تاريخ الرفع</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full justify-start text-right h-9 text-xs font-normal"
                            >
                              <CalendarIcon className="ml-2 h-3.5 w-3.5" />
                              {filter.dateRange?.from ? (
                                filter.dateRange.to ? (
                                  <>
                                    من {format(filter.dateRange.from, "P", { locale: ar })}
                                    <br />
                                    إلى {format(filter.dateRange.to, "P", { locale: ar })}
                                  </>
                                ) : (
                                  format(filter.dateRange.from, "P", { locale: ar })
                                )
                              ) : (
                                "اختر التاريخ..."
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              locale={ar}
                              mode="range"
                              initialFocus
                              selected={{ 
                                from: filter.dateRange?.from || undefined, 
                                to: filter.dateRange?.to || undefined
                              }}
                              onSelect={(range) => handleFilterChange({ 
                                dateRange: { 
                                  from: range?.from, 
                                  to: range?.to 
                                } 
                              })}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      
                      {/* أزرار سريعة للتصفية */}
                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => {
                            const today = new Date();
                            const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                            handleFilterChange({
                              dateRange: {
                                from: lastWeek,
                                to: today,
                              },
                            });
                          }}
                          className="text-xs h-9"
                        >
                          آخر أسبوع
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => {
                            const today = new Date();
                            const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                            handleFilterChange({
                              dateRange: {
                                from: lastMonth,
                                to: today,
                              },
                            });
                          }}
                          className="text-xs h-9"
                        >
                          آخر شهر
                        </Button>
                      </div>
                      
                      {/* زر مسح الفلتر */}
                      {(filter.projectId || filter.fileType || filter.dateRange?.from || filter.searchQuery) && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setFilter({})}
                          className="w-full mt-2 text-xs h-9 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        >
                          <X className="ml-1.5 h-3.5 w-3.5" />
                          مسح جميع الفلاتر
                        </Button>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            
            {/* القسم الرئيسي */}
            <div className="flex-1 space-y-6">

              
              {/* قسم الفلترة - للشاشات المتوسطة فقط، سيختفي على الشاشات الكبيرة والصغيرة */}
              <div className="hidden md:block lg:hidden bg-[hsl(var(--card))] border border-[hsl(var(--border))] p-4 xs:p-5 sm:p-6 rounded-xl shadow-sm fade-in">
                <h3 className="text-base xs:text-lg sm:text-xl font-bold text-[hsl(var(--primary))] mb-3 sm:mb-5 flex items-center flex-wrap space-x-1 xs:space-x-2 space-x-reverse">
                  <Filter className="h-4 w-4 xs:h-5 xs:w-5 text-[hsl(var(--primary))]" />
                  <span>فلترة المستندات</span>
                </h3>
                
                <div className="flex flex-wrap gap-2 xs:gap-3 sm:gap-4 items-end">
                  <div className="flex-1 min-w-[140px]">
                    <Label htmlFor="searchQuery" className="text-xs xs:text-sm mb-1 block">بحث عن مستند</Label>
                    <div className="relative">
                      <Search className="absolute right-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        id="searchQuery"
                        placeholder="اسم المستند أو الوصف..."
                        value={filter.searchQuery || ''}
                        onChange={(e) => handleFilterChange({ searchQuery: e.target.value })}
                        className="pl-2 pr-8 h-8 text-xs sm:text-sm"
                      />
                    </div>
                  </div>
                  
                  <div className="w-full xs:w-auto">
                    <Label htmlFor="projectFilter" className="text-xs xs:text-sm mb-1 block">المشروع</Label>
                    <Select
                      value={filter.projectId?.toString() || 'all'}
                      onValueChange={(value) => handleFilterChange({ projectId: value === 'all' ? undefined : value ? parseInt(value) : undefined })}
                    >
                      <SelectTrigger id="projectFilter" className="w-full xs:w-[140px] h-8 text-xs sm:text-sm">
                        <SelectValue placeholder="كل المشاريع" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">كل المشاريع</SelectItem>
                        {!projectsLoading && projects?.map((project: Project) => (
                          <SelectItem key={project.id} value={project.id.toString()}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="w-full xs:w-auto">
                    <Label htmlFor="typeFilter" className="text-xs xs:text-sm mb-1 block">نوع الملف</Label>
                    <Select
                      value={filter.fileType || 'all'}
                      onValueChange={(value) => handleFilterChange({ fileType: value === 'all' ? undefined : value })}
                    >
                      <SelectTrigger id="typeFilter" className="w-full xs:w-[140px] h-8 text-xs sm:text-sm">
                        <SelectValue placeholder="كل الأنواع" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">كل الأنواع</SelectItem>
                        <SelectItem value="image">صور</SelectItem>
                        <SelectItem value="pdf">PDF</SelectItem>
                        <SelectItem value="document">مستندات</SelectItem>
                        <SelectItem value="spreadsheet">جداول بيانات</SelectItem>
                        <SelectItem value="presentation">عروض تقديمية</SelectItem>
                        <SelectItem value="other">أخرى</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="w-full xs:w-auto mb-0 sm:mb-0">
                    <Label className="text-xs xs:text-sm mb-1 block">تاريخ الرفع</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full xs:w-[200px] justify-start text-right h-8 text-xs sm:text-sm font-normal"
                        >
                          <CalendarIcon className="ml-2 h-3.5 w-3.5" />
                          {filter.dateRange?.from ? (
                            filter.dateRange.to ? (
                              <>
                                من {format(filter.dateRange.from, "PPP", { locale: ar })}
                                <br />
                                إلى {format(filter.dateRange.to, "PPP", { locale: ar })}
                              </>
                            ) : (
                              format(filter.dateRange.from, "PPP", { locale: ar })
                            )
                          ) : (
                            "اختر التاريخ..."
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          initialFocus
                          mode="range"
                          selected={{
                            from: filter.dateRange?.from || undefined,
                            to: filter.dateRange?.to || undefined,
                          }}
                          onSelect={(range) =>
                            handleFilterChange({
                              dateRange: {
                                from: range?.from,
                                to: range?.to,
                              },
                            })
                          }
                          locale={ar}
                          className="p-2"
                        />
                        <div className="flex border-t border-border p-2 justify-between">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleFilterChange({ dateRange: undefined })}
                            className="text-xs sm:text-sm"
                          >
                            إعادة ضبط
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => {
                              const today = new Date();
                              const nextWeek = addDays(today, 7);
                              handleFilterChange({
                                dateRange: {
                                  from: today,
                                  to: nextWeek,
                                },
                              });
                            }}
                            className="text-xs sm:text-sm"
                          >
                            آخر أسبوع
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
            </div>

            {/* قسم العرض */}
            <div className="space-y-6 sm:space-y-8">
              {/* عرض المستندات - نسخة الجوال */}
              <div className="block md:hidden">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-[hsl(var(--primary))]">المستندات العامة</h3>
                  {getActiveDocuments() && (
                    <Badge className="bg-[hsl(var(--primary))] px-2 py-0.5 text-white">
                      {getActiveDocuments().length} مستند
                    </Badge>
                  )}
                </div>
                
                {isActiveTabLoading() ? (
                  <div className="text-center py-10 bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-xl shadow-sm">
                    <div className="spinner w-10 h-10 mx-auto"></div>
                    <p className="mt-4 text-[hsl(var(--muted-foreground))]">جاري تحميل المستندات...</p>
                  </div>
                ) : getActiveDocuments()?.length === 0 ? (
                  <div className="text-center py-12 bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-xl shadow-sm">
                    <div className="text-5xl mb-4 opacity-20">📁</div>
                    <p className="text-[hsl(var(--foreground))] font-medium">لا توجد مستندات</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">قم برفع مستند جديد للبدء</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {getActiveDocuments()?.map((doc: Document) => {
                      const projectName = projects?.find((p: Project) => p.id === doc.projectId)?.name || 'عام';
                      return (
                        <div
                          key={doc.id}
                          className={`p-2 xs:p-2.5 sm:p-4 rounded-md border shadow-sm hover:shadow transition-shadow ${doc.isManagerDocument ? 'bg-amber-50 border-amber-200' : 'bg-card border-border'}`}
                        >
                          <div className="flex justify-between items-start mb-2 xs:mb-3">
                            <h4 className="font-medium text-sm xs:text-base break-words w-[70%] overflow-hidden overflow-wrap-anywhere">
                              <span className="break-all">{doc.name}</span>
                              {doc.isManagerDocument && (
                                <Badge className="ml-1 xs:ml-2 mt-1 inline-flex bg-amber-100 text-amber-800 border-amber-300">
                                  <Lock className="h-2.5 w-2.5 xs:h-3 xs:w-3 mr-0.5 xs:mr-1" />
                                  <span className="text-[10px] xs:text-xs">إداري</span>
                                </Badge>
                              )}
                            </h4>
                            
                            <Badge className={`scale-75 xs:scale-90 md:scale-100 origin-right leading-tight px-1.5 xs:px-2 min-w-fit ${getFileTypeBadgeClasses(doc.fileType)}`}>
                              {getFileTypeIconName(doc.fileType)}
                              <span className="inline-block mr-0.5 xs:mr-1 text-[9px] xs:text-[10px] md:text-xs">{getFileTypeLabel(doc.fileType)}</span>
                            </Badge>
                          </div>
                          
                          {doc.description && (
                            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{doc.description}</p>
                          )}
                          
                          <div className="flex flex-wrap items-center text-[10px] xs:text-xs text-muted-foreground gap-x-2 xs:gap-x-3 gap-y-1 mb-3">
                            <span className="flex items-center">
                              <i className="fas fa-folder-open ml-0.5 xs:ml-1"></i>
                              {projectName}
                            </span>
                            <span className="flex items-center">
                              <i className="fas fa-calendar-alt ml-0.5 xs:ml-1"></i>
                              {new Date(doc.uploadDate).toLocaleDateString('ar-SA')}
                            </span>
                            {doc.fileSize && (
                              <span className="flex items-center">
                                <i className="fas fa-file-alt ml-0.5 xs:ml-1"></i>
                                {Math.round(doc.fileSize / 1024)} كيلوبايت
                              </span>
                            )}
                          </div>
                          
                          {/* أزرار التفاعل - للشاشات المتوسطة والكبيرة */}
                          <div className="hidden xs:flex justify-end space-x-2 space-x-reverse">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-xs"
                              onClick={() => window.open(doc.fileUrl, '_blank')}
                            >
                              <Eye className="ml-1 h-3 w-3" />
                              عرض
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-xs"
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = doc.fileUrl;
                                link.download = doc.name;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }}
                            >
                              <Download className="ml-1 h-3 w-3" />
                              تحميل
                            </Button>
                            {/* زر الحذف فقط لمستندات المشاريع وللمديرين فقط */}
                            {doc.projectId && (user?.role === 'admin' || user?.role === 'manager') && (
                              <Button 
                                size="sm" 
                                variant="destructive" 
                                className="text-xs"
                                onClick={() => {
                                  setDocumentToDelete(doc);
                                  setShowDeleteDialog(true);
                                }}
                              >
                                <X className="ml-1 h-3 w-3" />
                                حذف
                              </Button>
                            )}
                          </div>
                          
                          {/* أزرار التفاعل - للشاشات الصغيرة جدًا بتنسيق شبكة */}
                          <div className="xs:hidden grid grid-cols-3 gap-1 xs:gap-2 mt-2">
                            <Button 
                              size="sm" 
                              variant="default" 
                              className="w-full px-1 py-0.5 h-auto text-[8px] leading-tight min-h-0"
                              onClick={() => window.open(doc.fileUrl, '_blank')}
                            >
                              <Eye className="ml-0.5 h-2 w-2" />
                              عرض
                            </Button>
                            <Button 
                              size="sm" 
                              variant="secondary" 
                              className="w-full px-1 py-0.5 h-auto text-[8px] leading-tight min-h-0"
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = doc.fileUrl;
                                link.download = doc.name;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }}
                            >
                              <Download className="ml-0.5 h-2 w-2" />
                              تحميل
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive" 
                              className="w-full px-1 py-0.5 h-auto text-[8px] leading-tight min-h-0"
                              onClick={async () => {
                                if(confirm('هل أنت متأكد من رغبتك في حذف هذا المستند؟')) {
                                  try {
                                    // أولاً محاولة حذف الملف من Firebase Storage
                                    try {
                                      const { deleteFile } = await import('@/lib/firebase-storage');
                                      if (doc.fileUrl) {
                                        await deleteFile(doc.fileUrl);
                                      }
                                    } catch (error) {
                                      console.error("فشل في حذف الملف من التخزين:", error);
                                    }
                                    
                                    // ثم حذف السجل من قاعدة البيانات
                                    await fetch(`/api/documents/${doc.id}`, { method: 'DELETE' });
                                    handleDocumentUpdated();
                                  } catch (error) {
                                    alert('حدث خطأ أثناء حذف المستند. يرجى المحاولة مرة أخرى.');
                                    console.error(error);
                                  }
                                }
                              }}
                            >
                              <i className="fas fa-trash-alt ml-0.5 text-[8px]"></i>
                              حذف
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
              {/* عرض المستندات - نسخة سطح المكتب */}
              <div className="hidden md:block">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-[hsl(var(--primary))]">المستندات العامة</h3>
                  {getActiveDocuments() && (
                    <Badge className="bg-[hsl(var(--primary))] px-2 py-0.5 text-white">
                      {getActiveDocuments().length} مستند
                    </Badge>
                  )}
                </div>
                
                <DocumentList 
                  documents={getActiveDocuments()} 
                  projects={projects || []} 
                  isLoading={isActiveTabLoading() || projectsLoading}
                  onDocumentUpdated={handleDocumentUpdated}
                  isManagerSection={false}
                  searchQuery={filter.searchQuery}
                />
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="projects" className="p-0">
          {/* مستندات المشاريع - تصميم محسّن */}
          <div className="flex flex-col gap-5 sm:gap-7 lg:gap-8">
            {/* شريط أدوات المشاريع */}
            <div className="bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-xl shadow-sm p-4 sm:p-5">
              <div className="flex flex-col xs:flex-row justify-between items-start xs:items-center gap-3">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-[hsl(var(--foreground))]">مستندات المشاريع</h3>
                  <p className="text-xs sm:text-sm text-[hsl(var(--muted-foreground))]">تصفح المستندات حسب تصنيف المشاريع</p>
                </div>
                

              </div>
            </div>
            
            {/* عرض المشاريع والمستندات */}
            <div className="space-y-6">
              {projectsLoading ? (
                <div className="text-center py-16 bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-xl shadow-sm">
                  <div className="spinner w-12 h-12 mx-auto"></div>
                  <p className="mt-4 text-[hsl(var(--muted-foreground))]">جاري تحميل المشاريع...</p>
                </div>
              ) : projects?.length === 0 ? (
                <div className="text-center py-16 bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-xl shadow-sm">
                  <div className="text-6xl mb-4 opacity-20">📋</div>
                  <p className="text-lg font-medium mb-1">لا توجد مشاريع</p>
                  <p className="text-[hsl(var(--muted-foreground))] max-w-md mx-auto">
                    لا يوجد حالياً أي مشاريع في النظام. يرجى إضافة مشاريع أولاً ليمكنك تنظيم المستندات.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6">
                  {projects?.map((project: Project) => {
                    // فلترة المستندات المتعلقة بالمشروع الحالي
                    const projectDocuments = documents?.filter(doc => doc.projectId === project.id) || [];
                    
                    // فحص ما إذا كان هناك مستندات لهذا المشروع بعد تطبيق الفلاتر
                    let filteredProjectDocuments = [...projectDocuments];
                    
                    // تطبيق فلتر نوع الملف
                    if (filter.fileType) {
                      filteredProjectDocuments = filteredProjectDocuments.filter(doc => {
                        const type = getMainFileType(doc.fileType);
                        return type === filter.fileType;
                      });
                    }
                    
                    // تطبيق فلتر النص
                    if (filter.searchQuery) {
                      const query = filter.searchQuery.toLowerCase();
                      filteredProjectDocuments = filteredProjectDocuments.filter(doc => 
                        doc.name.toLowerCase().includes(query) || 
                        (doc.description && doc.description.toLowerCase().includes(query))
                      );
                    }
                    
                    // تطبيق فلتر التاريخ
                    if (filter.dateRange?.from || filter.dateRange?.to) {
                      filteredProjectDocuments = filteredProjectDocuments.filter(doc => {
                        const uploadDate = new Date(doc.uploadDate);
                        
                        // التحقق من تاريخ البداية
                        if (filter.dateRange?.from) {
                          const fromDate = new Date(filter.dateRange.from);
                          fromDate.setHours(0, 0, 0, 0);
                          if (uploadDate < fromDate) return false;
                        }
                        
                        // التحقق من تاريخ النهاية
                        if (filter.dateRange?.to) {
                          const toDate = new Date(filter.dateRange.to);
                          toDate.setHours(23, 59, 59, 999);
                          if (uploadDate > toDate) return false;
                        }
                        
                        return true;
                      });
                    }
                    
                    // عدم عرض المشاريع التي ليس لها مستندات بعد تطبيق الفلاتر
                    if (filteredProjectDocuments.length === 0) return null;
                    
                    return (
                      <div key={project.id} className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] overflow-hidden shadow-sm hover:shadow-md transition-all">
                        <div className="bg-[hsl(var(--primary))] bg-opacity-10 p-4 sm:p-5 border-b border-[hsl(var(--border))]">
                          <div className="flex justify-between items-center flex-wrap gap-2">
                            <h3 className="text-base sm:text-lg font-bold text-[hsl(var(--primary))] flex items-center">
                              <File className="ml-2 h-5 w-5" />
                              {project.name}
                            </h3>
                            
                            <Badge variant="outline" className="bg-white text-[hsl(var(--primary))] border-[hsl(var(--primary))] border-opacity-30 px-2.5 py-0.5">
                              {filteredProjectDocuments.length} مستند
                            </Badge>
                          </div>
                          
                          {project.description && (
                            <p className="text-xs sm:text-sm mt-2 text-[hsl(var(--muted-foreground))] line-clamp-2">
                              {project.description}
                            </p>
                          )}
                        </div>
                        
                        <div className="p-4 sm:p-5">
                          <div className="grid grid-cols-1 gap-3 sm:gap-4 md:gap-5">
                            {filteredProjectDocuments.map((doc: Document) => (
                              <div
                                key={doc.id}
                                className="flex flex-col bg-[hsl(var(--background))] hover:bg-[hsl(var(--accent))] hover:bg-opacity-10 rounded-md border border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] hover:border-opacity-30 p-2 xs:p-2.5 sm:p-3 transition-all h-full"
                              >
                                <div className="flex justify-between items-start mb-2 sm:mb-3">
                                  <div className="flex items-center">
                                    <FileTypeIcon fileType={doc.fileType} className="h-6 w-6 sm:h-7 sm:w-7 text-[hsl(var(--primary))]" />
                                  </div>
                                  
                                  <FileTypeBadge fileType={doc.fileType} />
                                </div>
                                
                                <h4 className="font-medium text-xs sm:text-sm lg:text-base line-clamp-1 xs:line-clamp-2 mb-1 sm:mb-2">{doc.name}</h4>
                                
                                {doc.description && (
                                  <p className="text-[10px] xs:text-xs sm:text-xs text-[hsl(var(--muted-foreground))] line-clamp-1 xs:line-clamp-2 mb-auto">{doc.description}</p>
                                )}
                                
                                <div className="mt-2 pt-2 flex flex-wrap xs:flex-nowrap justify-between items-center gap-y-2 text-[10px] xs:text-xs text-[hsl(var(--muted-foreground))] border-t border-[hsl(var(--border))] border-opacity-50">
                                  <span className="flex items-center text-[10px] xs:text-xs w-full xs:w-auto">
                                    <Clock className="ml-1 h-2.5 w-2.5 xs:h-3 xs:w-3" />
                                    <span className="truncate">{new Date(doc.uploadDate).toLocaleDateString('ar-SA')}</span>
                                  </span>
                                  
                                  <div className="flex space-x-1 space-x-reverse ml-auto">
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-6 w-6 p-0 rounded-full hover:bg-[hsl(var(--primary))] hover:bg-opacity-10 hover:text-[hsl(var(--primary))]"
                                      onClick={() => window.open(doc.fileUrl, '_blank')}
                                      title="عرض المستند"
                                    >
                                      <Eye className="h-3 w-3" />
                                    </Button>
                                    
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-6 w-6 p-0 rounded-full hover:bg-[hsl(var(--primary))] hover:bg-opacity-10 hover:text-[hsl(var(--primary))]"
                                      onClick={() => {
                                        const link = document.createElement('a');
                                        link.href = doc.fileUrl;
                                        link.download = doc.name;
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                      }}
                                      title="تنزيل المستند"
                                    >
                                      <Download className="h-3 w-3" />
                                    </Button>
                                    
                                    {/* زر الحذف للمديرين فقط */}
                                    {(user?.role === 'admin' || user?.role === 'manager') && (
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-6 w-6 p-0 rounded-full hover:bg-destructive hover:bg-opacity-10 hover:text-destructive"
                                        onClick={() => {
                                          setDocumentToDelete(doc);
                                          setShowDeleteDialog(true);
                                        }}
                                        title="حذف المستند"
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  }).filter(Boolean)}
                </div>
              )}
              
              {/* مستندات بدون مشروع - محسّن */}
              {!projectsLoading && documents && documents.filter(doc => !doc.projectId).length > 0 && (
                <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] overflow-hidden shadow-sm hover:shadow-md transition-all mt-4">
                  <div className="bg-[hsl(var(--muted))] bg-opacity-30 p-4 sm:p-5 border-b border-[hsl(var(--border))]">
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <h3 className="text-base sm:text-lg font-bold text-[hsl(var(--muted-foreground))] flex items-center">
                        <File className="ml-2 h-5 w-5" />
                        مستندات عامة
                      </h3>
                      <Badge variant="outline" className="bg-white text-[hsl(var(--muted-foreground))] border-[hsl(var(--muted-foreground))] border-opacity-30 px-2.5 py-0.5">
                        {documents?.filter(doc => !doc.projectId).length ?? 0} مستند
                      </Badge>
                    </div>
                    <p className="text-xs sm:text-sm mt-2 text-[hsl(var(--muted-foreground))] opacity-80">
                      مستندات غير مرتبطة بمشروع معين
                    </p>
                  </div>
                  
                  <div className="p-4 sm:p-5">
                    <div className="grid grid-cols-1 gap-3 sm:gap-4 md:gap-5">
                      {documents
                        ?.filter(doc => !doc.projectId)
                        .map((doc: Document) => (
                          <div
                            key={doc.id}
                            className="flex flex-col bg-[hsl(var(--background))] hover:bg-[hsl(var(--accent))] hover:bg-opacity-10 rounded-md border border-[hsl(var(--border))] hover:border-[hsl(var(--muted-foreground))] hover:border-opacity-30 p-2 xs:p-2.5 sm:p-3 transition-all h-full"
                          >
                            <div className="flex justify-between items-start mb-2 sm:mb-3">
                              <div className="flex items-center">
                                <FileTypeIcon fileType={doc.fileType} className="h-6 w-6 sm:h-7 sm:w-7 text-[hsl(var(--muted-foreground))]" />
                              </div>
                              
                              <FileTypeBadge fileType={doc.fileType} />
                            </div>
                            
                            <h4 className="font-medium text-xs sm:text-sm lg:text-base line-clamp-1 xs:line-clamp-2 mb-1 sm:mb-2">{doc.name}</h4>
                            
                            {doc.description && (
                              <p className="text-[10px] xs:text-xs sm:text-xs text-[hsl(var(--muted-foreground))] line-clamp-1 xs:line-clamp-2 mb-auto">{doc.description}</p>
                            )}
                            
                            <div className="mt-2 pt-2 flex flex-wrap xs:flex-nowrap justify-between items-center gap-y-2 text-[10px] xs:text-xs text-[hsl(var(--muted-foreground))] border-t border-[hsl(var(--border))] border-opacity-50">
                              <span className="flex items-center text-[10px] xs:text-xs w-full xs:w-auto">
                                <Clock className="ml-1 h-2.5 w-2.5 xs:h-3 xs:w-3" />
                                <span className="truncate">{new Date(doc.uploadDate).toLocaleDateString('ar-SA')}</span>
                              </span>
                              
                              <div className="flex space-x-1 space-x-reverse ml-auto">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-6 w-6 p-0 rounded-full hover:bg-[hsl(var(--muted-foreground))] hover:bg-opacity-10"
                                  onClick={() => window.open(doc.fileUrl, '_blank')}
                                  title="عرض المستند"
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>
                                
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-6 w-6 p-0 rounded-full hover:bg-[hsl(var(--muted-foreground))] hover:bg-opacity-10"
                                  onClick={() => {
                                    const link = document.createElement('a');
                                    link.href = doc.fileUrl;
                                    link.download = doc.name;
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                  }}
                                  title="تنزيل المستند"
                                >
                                  <Download className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="manager" className="p-0">
          {/* مستندات المدراء */}
          {isManagerOrAdmin && (
            <div className="flex flex-col gap-4 sm:gap-6 lg:gap-8">
              {/* قسم الفلتر والفورم */}
              <div className="space-y-6 sm:space-y-8">
                {/* معلومات مستندات المدراء */}
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 p-4 xs:p-5 sm:p-6 rounded-xl shadow-sm slide-in-left">
                  <h3 className="text-base xs:text-lg sm:text-xl font-bold text-amber-800 dark:text-amber-400 mb-3 sm:mb-5 flex items-center flex-wrap space-x-1 xs:space-x-2 space-x-reverse">
                    <Lock className="h-4 w-4 xs:h-5 xs:w-5 text-amber-600 dark:text-amber-500" />
                    <span>مستندات إدارية</span>
                    <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700/60 mr-1 xs:mr-1.5 sm:mr-2 mt-0.5 xs:mt-0">
                      <Lock className="ml-0.5 xs:ml-1 h-2.5 w-2.5 xs:h-3 xs:w-3" />
                      <span className="text-[10px] xs:text-xs">مقيّد</span>
                    </Badge>
                  </h3>
                  <div className="mb-4 bg-amber-100 dark:bg-amber-900/60 border-r-4 border-amber-500 dark:border-amber-600 p-3 rounded-tr rounded-br text-xs sm:text-sm text-amber-800 dark:text-amber-300">
                    <AlertCircle className="inline-flex ml-1.5 h-4 w-4" />
                    المستندات الإدارية مرئية فقط للمدراء والمسؤولين. استخدم هذا القسم لتخزين المستندات السرية والحساسة.
                  </div>
                  <div className="flex justify-center mt-4">
                    <Button 
                      variant="outline" 
                      className="bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/60 dark:hover:bg-amber-800/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700/60"
                      onClick={() => setShowUploadDialog(true)}
                    >
                      <Upload className="ml-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span>رفع مستند إداري جديد</span>
                    </Button>
                  </div>
                </div>
                
                {/* قسم الفلترة */}
                <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] p-4 xs:p-5 sm:p-6 rounded-xl shadow-sm slide-in-right">
                  <h3 className="text-base xs:text-lg sm:text-xl font-bold text-[hsl(var(--primary))] mb-3 sm:mb-5 flex items-center flex-wrap space-x-1 xs:space-x-2 space-x-reverse">
                    <Filter className="h-4 w-4 xs:h-5 xs:w-5 text-[hsl(var(--primary))]" />
                    <span>فلترة المستندات الإدارية</span>
                  </h3>
                  
                  <div className="flex flex-wrap gap-2 xs:gap-3 sm:gap-4 items-end">
                    <div className="flex-1 min-w-[140px]">
                      <Label htmlFor="searchQuery" className="text-xs xs:text-sm mb-1 block">بحث عن مستند</Label>
                      <div className="relative">
                        <Search className="absolute right-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          id="searchQuery"
                          placeholder="اسم المستند أو الوصف..."
                          value={filter.searchQuery || ''}
                          onChange={(e) => handleFilterChange({ searchQuery: e.target.value })}
                          className="pl-2 pr-8 h-8 text-xs sm:text-sm"
                        />
                      </div>
                    </div>
                    
                    <div className="w-full xs:w-auto">
                      <Label htmlFor="projectFilter" className="text-xs xs:text-sm mb-1 block">المشروع</Label>
                      <Select
                        value={filter.projectId?.toString() || 'all'}
                        onValueChange={(value) => handleFilterChange({ projectId: value !== 'all' ? parseInt(value) : undefined })}
                      >
                        <SelectTrigger id="projectFilter" className="w-full xs:w-[140px] h-8 text-xs sm:text-sm">
                          <SelectValue placeholder="كل المشاريع" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">كل المشاريع</SelectItem>
                          {!projectsLoading && projects?.map((project: Project) => (
                            <SelectItem key={project.id} value={project.id.toString()}>
                              {project.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="w-full xs:w-auto">
                      <Label htmlFor="typeFilter" className="text-xs xs:text-sm mb-1 block">نوع الملف</Label>
                      <Select
                        value={filter.fileType || 'all'}
                        onValueChange={(value) => handleFilterChange({ fileType: value === 'all' ? undefined : value })}
                      >
                        <SelectTrigger id="typeFilter" className="w-full xs:w-[140px] h-8 text-xs sm:text-sm">
                          <SelectValue placeholder="كل الأنواع" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">كل الأنواع</SelectItem>
                          <SelectItem value="image">صور</SelectItem>
                          <SelectItem value="pdf">PDF</SelectItem>
                          <SelectItem value="document">مستندات</SelectItem>
                          <SelectItem value="spreadsheet">جداول بيانات</SelectItem>
                          <SelectItem value="presentation">عروض تقديمية</SelectItem>
                          <SelectItem value="other">أخرى</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="w-full xs:w-auto mb-0 sm:mb-0">
                      <Label className="text-xs xs:text-sm mb-1 block">تاريخ الرفع</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full xs:w-[200px] justify-start text-right h-8 text-xs sm:text-sm font-normal"
                          >
                            <CalendarIcon className="ml-2 h-3.5 w-3.5" />
                            {filter.dateRange?.from ? (
                              filter.dateRange.to ? (
                                <>
                                  من {format(filter.dateRange.from, "PPP", { locale: ar })}
                                  <br />
                                  إلى {format(filter.dateRange.to, "PPP", { locale: ar })}
                                </>
                              ) : (
                                format(filter.dateRange.from, "PPP", { locale: ar })
                              )
                            ) : (
                              "اختر التاريخ..."
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            initialFocus
                            mode="range"
                            selected={{
                              from: filter.dateRange?.from || undefined,
                              to: filter.dateRange?.to || undefined,
                            }}
                            onSelect={(range) =>
                              handleFilterChange({
                                dateRange: {
                                  from: range?.from,
                                  to: range?.to,
                                },
                              })
                            }
                            locale={ar}
                            className="p-2"
                          />
                          <div className="flex border-t border-border p-2 justify-between">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleFilterChange({ dateRange: undefined })}
                              className="text-xs sm:text-sm"
                            >
                              إعادة ضبط
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => {
                                const today = new Date();
                                const nextWeek = addDays(today, 7);
                                handleFilterChange({
                                  dateRange: {
                                    from: today,
                                    to: nextWeek,
                                  },
                                });
                              }}
                              className="text-xs sm:text-sm"
                            >
                              آخر أسبوع
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>
              </div>

              {/* قسم العرض */}
              <div className="space-y-6 sm:space-y-8">
                {/* عرض المستندات */}
                <div className="block">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-amber-700 dark:text-amber-500 flex items-center space-x-2 space-x-reverse">
                      <Lock className="ml-1.5 h-4 w-4" />
                      <span>مستندات المدراء</span>
                      <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700/60 mr-2">
                        منطقة مقيدة
                      </Badge>
                    </h3>
                    {managerDocuments && (
                      <Badge className="bg-amber-600 dark:bg-amber-700 px-2 py-0.5 text-white">
                        {managerDocuments.length} مستند
                      </Badge>
                    )}
                  </div>

                  <DocumentList 
                    documents={getActiveDocuments()} 
                    projects={projects || []} 
                    isLoading={isActiveTabLoading() || projectsLoading}
                    onDocumentUpdated={handleDocumentUpdated}
                    isManagerSection={true}
                    searchQuery={filter.searchQuery}
                  />
                </div>
              </div>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="link-manager" className="p-0">
          {/* مكتبة إدارة الملفات والربط اليدوي */}
          <div className="space-y-6">
            {/* قسم رفع المجلدات بكميات كبيرة */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 p-1 rounded-lg">
              <BulkFolderUpload 
                onUploadComplete={(documentIds) => {
                  // تحديث المستندات بعد الرفع
                  queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
                }}
                className="bg-white dark:bg-background rounded-lg"
              />
            </div>
            
            {/* مكتبة الربط اليدوي */}
            <DocumentLinker />
          </div>
        </TabsContent>
        
        <TabsContent value="attachments" className="p-0">
          {/* مرفقات المعاملات */}
          <div className="flex flex-col gap-4 sm:gap-6 lg:gap-8">
            {/* عنوان القسم */}
            <div className="bg-[hsl(var(--primary))] text-white p-4 xs:p-5 sm:p-6 rounded-xl shadow-sm mb-2 slide-in-right">
              <h3 className="text-base xs:text-lg sm:text-xl font-bold mb-1 sm:mb-2 flex items-center">
                <FileImage className="ml-2 h-5 w-5" />
                مرفقات المعاملات المالية
              </h3>
              <p className="text-xs sm:text-sm opacity-90">
                عرض جميع المرفقات والمستندات الداعمة للمعاملات المالية في النظام
              </p>
            </div>
            
            {/* قائمة المرفقات */}
            <div className="space-y-5">
              {transactionsLoading ? (
                <div className="text-center py-16 bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-xl shadow-sm">
                  <div className="spinner w-12 h-12 mx-auto"></div>
                  <p className="mt-4 text-[hsl(var(--muted-foreground))]">جاري تحميل مرفقات المعاملات...</p>
                </div>
              ) : transactionsWithAttachments?.length === 0 ? (
                <div className="text-center py-16 bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-xl shadow-sm">
                  <div className="text-6xl mb-4 opacity-20">🔍</div>
                  <p className="text-lg font-medium mb-1">لا توجد مرفقات للمعاملات</p>
                  <p className="text-[hsl(var(--muted-foreground))] max-w-md mx-auto">
                    لا يوجد حالياً أي معاملات مالية تحتوي على مرفقات في النظام. يمكنك إضافة مرفقات عند إنشاء معاملات جديدة.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:gap-4 md:gap-5">
                  {transactionsWithAttachments?.map((transaction: Transaction) => {
                    const projectName = projects?.find(p => p.id === transaction.projectId)?.name || 'بدون مشروع';
                    return (
                      <Card key={transaction.id} className="overflow-hidden border border-border">
                        <CardHeader className="p-4 bg-[hsl(var(--muted))]">
                          <div className="flex justify-between items-center">
                            <Badge className={transaction.type === 'deposit' ? 'bg-green-100 text-green-800 border-green-300' : 'bg-orange-100 text-orange-800 border-orange-300'}>
                              {transaction.type === 'deposit' ? 'إيداع' : 'سحب'}
                            </Badge>
                            <Badge className={getFileTypeBadgeClasses(transaction.fileType || '')}>
                              {getFileTypeIconName(transaction.fileType || '')}
                              <span className="mr-1">{getFileTypeLabel(transaction.fileType || '')}</span>
                            </Badge>
                          </div>
                          <CardTitle className="text-base mt-2 mb-0">
                            {new Intl.NumberFormat('ar-IQ').format(transaction.amount)} د.ع
                          </CardTitle>
                          <CardDescription className="text-xs line-clamp-1">
                            {transaction.description}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-3 space-x-reverse text-xs text-muted-foreground mb-3">
                            <span className="flex items-center">
                              <i className="fas fa-folder-open ml-1"></i>
                              {projectName}
                            </span>
                            <span className="flex items-center">
                              <i className="fas fa-calendar-alt ml-1"></i>
                              {new Date(transaction.date).toLocaleDateString('ar-SA')}
                            </span>
                          </div>
                          
                          <div className="flex flex-wrap justify-center gap-2 mt-3">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-xs"
                              onClick={() => window.open(transaction.fileUrl, '_blank')}
                            >
                              <Eye className="ml-1 h-3 w-3" />
                              عرض المرفق
                            </Button>
                            
                            <Button
                              size="sm"
                              variant="secondary"
                              className="text-xs"
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = transaction.fileUrl || '';
                                link.download = `مرفق_معاملة_${transaction.id}`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }}
                            >
                              <Download className="ml-1 h-3 w-3" />
                              تحميل
                            </Button>
                            
                            {/* أزرار المدراء - إعادة رفع وحذف المرفق */}
                            {isManagerOrAdmin && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs"
                                  onClick={() => handleReuploadClick(transaction)}
                                >
                                  <Upload className="ml-1 h-3 w-3" />
                                  إعادة رفع المستند
                                </Button>
                                
                                {/* زر حذف المرفق - للمدراء فقط */}
                                {user?.role === 'admin' && (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="text-xs"
                                    onClick={() => handleDeleteAttachmentClick(transaction)}
                                  >
                                    <X className="ml-1 h-3 w-3" />
                                    حذف المرفق
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
        </Tabs>
        </div>
      
      {/* نافذة منبثقة لرفع مستند جديد */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
  <DialogContent size="lg" className="app-window mx-auto p-3 xs:p-4 sm:p-5 md:p-6 overflow-hidden">
          <DialogHeader className="space-y-1 sm:space-y-2">
            <DialogTitle className="text-base xs:text-lg sm:text-xl text-[hsl(var(--primary))] font-bold flex items-center">
              <Upload className="ml-1.5 xs:ml-2 h-4 w-4 xs:h-5 xs:w-5" />
              <span>رفع مستند جديد</span>
            </DialogTitle>
            <DialogDescription className="text-xs xs:text-sm text-muted-foreground">
              قم بإضافة ملف جديد لأرشيف المستندات
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-2">
            <DocumentForm 
              projects={projects || []} 
              onSubmit={() => {
                handleDocumentUpdated();
                setShowUploadDialog(false);
              }} 
              isLoading={projectsLoading}
              isManagerDocument={activeTab === "manager"}
            />
          </div>
        </DialogContent>
      </Dialog>
      
      {/* نافذة حوار إعادة رفع المستند المرفق */}
      <Dialog open={showReuploadDialog} onOpenChange={(open) => !open && resetReuploadState()}>
  <DialogContent size="md" className="app-window">
          <DialogHeader>
            <DialogTitle>إعادة رفع مستند مرفق</DialogTitle>
            <DialogDescription>
              يمكنك رفع نسخة جديدة أكثر وضوحاً من المستند المرفق للمعاملة
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            {selectedTransaction && (
              <div className="text-xs border p-3 rounded-lg bg-muted/30">
                <p><strong>المشروع:</strong> {projects?.find(p => p.id === selectedTransaction.projectId)?.name || 'بدون مشروع'}</p>
                <p><strong>نوع المعاملة:</strong> {selectedTransaction.type === 'income' ? 'إيداع' : 'سحب'}</p>
                <p><strong>المبلغ:</strong> {new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR' }).format(selectedTransaction.amount)}</p>
                <p><strong>الوصف:</strong> {selectedTransaction.description}</p>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="reupload-file">اختر الملف الجديد</Label>
              <Input
                id="reupload-file"
                type="file"
                className="cursor-pointer"
                onChange={(e) => setReuploadFile(e.target.files ? e.target.files[0] : null)}
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              />
              <p className="text-xs text-muted-foreground">
                يمكنك رفع صور أو مستندات PDF أو ملفات Office.
              </p>
            </div>
            
            <div className="flex gap-2 justify-end mt-4">
              <Button variant="outline" onClick={resetReuploadState}>
                إلغاء
              </Button>
              <Button 
                onClick={handleReuploadSubmit} 
                disabled={!reuploadFile || isUploading}
              >
                {isUploading ? (
                  <>
                    <div className="spinner w-4 h-4 ml-2"></div>
                    جاري الرفع...
                  </>
                ) : 'رفع المستند الجديد'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* نافذة تأكيد حذف المستند */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
  <DialogContent size="md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <X className="h-5 w-5" />
              تأكيد حذف المستند
            </DialogTitle>
            <DialogDescription>
              هل أنت متأكد من رغبتك في حذف هذا المستند؟ لا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          
          {documentToDelete && (
            <div className="py-4">
              <div className="bg-muted/30 p-3 rounded-lg border">
                <p className="text-sm font-medium mb-1">{documentToDelete.name}</p>
                <p className="text-xs text-muted-foreground">
                  المشروع: {projects?.find(p => p.id === documentToDelete.projectId)?.name || 'غير محدد'}
                </p>
                <p className="text-xs text-muted-foreground">
                  تاريخ الرفع: {new Date(documentToDelete.uploadDate).toLocaleDateString('ar-SA')}
                </p>
              </div>
            </div>
          )}
          
          <div className="flex gap-2 justify-end">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowDeleteDialog(false);
                setDocumentToDelete(null);
              }}
              disabled={isDeleting}
            >
              إلغاء
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteDocument}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <div className="spinner w-4 h-4 ml-2"></div>
                  جاري الحذف...
                </>
              ) : (
                <>
                  <X className="h-4 w-4 ml-2" />
                  حذف المستند
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* نافذة تأكيد حذف مرفق المعاملة */}
      <Dialog open={showDeleteAttachmentDialog} onOpenChange={setShowDeleteAttachmentDialog}>
  <DialogContent size="md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <X className="h-5 w-5" />
              تأكيد حذف المرفق
            </DialogTitle>
            <DialogDescription>
              هل أنت متأكد من رغبتك في حذف مرفق هذه المعاملة؟ سيتم حذف الملف نهائياً ولا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          
          {attachmentToDelete && (
            <div className="py-4">
              <div className="text-sm border p-3 rounded-lg bg-muted/30">
                <p><strong>وصف المعاملة:</strong> {attachmentToDelete.description}</p>
                <p><strong>المبلغ:</strong> {new Intl.NumberFormat('ar-IQ').format(attachmentToDelete.amount)} د.ع</p>
                <p><strong>التاريخ:</strong> {new Date(attachmentToDelete.date).toLocaleDateString('ar-SA')}</p>
                <p><strong>نوع الملف:</strong> {attachmentToDelete.fileType || 'غير محدد'}</p>
              </div>
            </div>
          )}
          
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteAttachmentDialog(false)}
              disabled={isDeletingAttachment}
            >
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAttachmentSubmit}
              disabled={isDeletingAttachment}
            >
              {isDeletingAttachment ? (
                <>
                  <div className="spinner w-4 h-4 ml-2"></div>
                  جاري الحذف...
                </>
              ) : (
                <>
                  <X className="h-4 w-4 ml-2" />
                  حذف المرفق
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </div>
      </div>
    </div>
  );
}