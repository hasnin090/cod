import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { 
  FileText, FileImage, File, FileIcon, Download, Eye, 
  Trash2, Loader2, Info, ArrowUpDown, Clock, Tag, CheckCircle2, XCircle, Lock,
  Search, ZoomIn
} from 'lucide-react';
import { ImageViewer } from '@/components/image-viewer';
import { ImageLightbox } from '@/components/image-lightbox';
import { Button } from '@/components/ui/button';
import { deleteFile } from '@/lib/storage-helpers';
import { getFileType, getReadableFileSize } from '@/lib/file-utils';
import { getFileTypeLabel, getFileTypeIcon, getFileTypeBadgeClasses } from '@/lib/file-helpers';
import { Badge } from '@/components/ui/badge';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Avatar } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Document {
  id: number;
  name: string;
  description?: string;
  fileUrl: string;
  fileType: string;
  uploadDate: string;
  projectId?: number;
  uploadedBy: number;
  isManagerDocument?: boolean;
}

interface Project {
  id: number;
  name: string;
}

interface DocumentListProps {
  documents: Document[];
  projects: Project[];
  isLoading: boolean;
  onDocumentUpdated: () => void;
  isManagerSection?: boolean; // إضافة خاصية لتحديد ما إذا كان قسم المدراء
  searchQuery?: string; // إضافة خاصية للبحث النصي
}

export function DocumentList({ documents, projects, isLoading, onDocumentUpdated, isManagerSection = false, searchQuery = '' }: DocumentListProps) {
  const { user } = useAuth();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [currentDocument, setCurrentDocument] = useState<Document | null>(null);
  const [viewType, setViewType] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'type'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const { toast } = useToast();
  
  const deleteMutation = useMutation({
    mutationFn: async (document: Document) => {
      try {
        // أولا حذف الملف من Firebase Storage
        if (document.fileUrl) {
          try {
            await deleteFile(document.fileUrl);
          } catch (error) {
            console.error("فشل في حذف الملف من التخزين:", error);
            // نستمر في الحذف من قاعدة البيانات حتى لو فشل حذف الملف
          }
        }
        
        // ثم حذف السجل من قاعدة البيانات
        return apiRequest(`/api/documents/${document.id}`, 'DELETE', undefined);
      } finally {
        // تنظيف الحالة بعد الحذف
        setDocumentToDelete(null);
      }
    },
    onSuccess: () => {
      toast({
        title: "تم الحذف بنجاح",
        description: "تم حذف المستند بنجاح",
      });
      onDocumentUpdated();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: error instanceof Error ? error.message : "فشل في حذف المستند",
      });
    },
  });
  
  const handleDeleteClick = (document: Document) => {
    setDocumentToDelete(document);
    setDeleteDialogOpen(true);
  };
  
  const confirmDelete = () => {
    if (documentToDelete) {
      deleteMutation.mutate(documentToDelete);
    }
    setDeleteDialogOpen(false);
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'yyyy/MM/dd', { locale: ar });
  };
  
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const dateStr = date.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const timeStr = date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    return `${dateStr} ${timeStr}`;
  };
  
  // دالة لإبراز النص المبحوث عنه
  const highlightText = (text: string, searchQuery: string) => {
    if (!searchQuery || !text) return text;
    
    const lowerSearchQuery = searchQuery.toLowerCase().trim();
    if (!lowerSearchQuery) return text;
    
    const index = text.toLowerCase().indexOf(lowerSearchQuery);
    if (index === -1) return text;
    
    const before = text.substring(0, index);
    const match = text.substring(index, index + lowerSearchQuery.length);
    const after = text.substring(index + lowerSearchQuery.length);
    
    return (
      <>
        {before}
        <span className="bg-yellow-200 text-black font-medium px-1 rounded">{match}</span>
        {after}
      </>
    );
  };
  
  const getProjectName = (projectId?: number) => {
    if (!projectId) return 'عام';
    const project = projects.find(p => p.id === projectId);
    return project ? project.name : 'غير معروف';
  };
  
  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) {
      return <File className="h-12 w-12 text-destructive" />;
    } else if (fileType.includes('image')) {
      return <FileImage className="h-12 w-12 text-primary" />;
    } else if (fileType.includes('word')) {
      return <FileText className="h-12 w-12 text-primary-light" />;
    } else {
      return <FileIcon className="h-12 w-12 text-muted-foreground" />;
    }
  };
  
  const getFileTypeBadge = (fileType: string) => {
    return (
      <Badge variant="outline" className={`${getFileTypeBadgeClasses(fileType)} flex items-center`}>
        {getFileTypeIcon(fileType)}
        <span className="mr-1">{getFileTypeLabel(fileType)}</span>
      </Badge>
    );
  };
  
  const downloadFile = (doc: Document) => {
    // فتح الملف في نافذة جديدة للتنزيل المباشر
    toast({
      title: "بدء التنزيل",
      description: `جاري تنزيل ${doc.name}`,
    });
    
    // إنشاء عنصر الرابط وإطلاق تنزيل الملف
    const a = window.document.createElement('a');
    a.href = doc.fileUrl;
    a.download = doc.name;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
  };
  
  const previewFile = (doc: Document) => {
    setCurrentDocument(doc);
    setPreviewDialogOpen(true);
  };
  
  const isImageFile = (fileType: string) => {
    return fileType.includes('image');
  };
  
  const isPdfFile = (fileType: string) => {
    return fileType.includes('pdf');
  };
  
  const sortDocuments = (docs: Document[]) => {
    return [...docs].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime();
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'type':
          comparison = getFileType(a.fileType).localeCompare(getFileType(b.fileType));
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  };
  
  const toggleSortOrder = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };
  
  if (isLoading) {
    return (
      <div className="text-center py-20">
        <Loader2 className="w-8 h-8 mx-auto animate-spin" />
        <p className="mt-4 text-muted-foreground">جاري تحميل المستندات...</p>
      </div>
    );
  }
  
  if (documents.length === 0) {
    return (
      <div className="bg-secondary-light rounded-xl shadow-card p-10 text-center">
        <FileIcon className="h-16 w-16 mx-auto text-muted-foreground opacity-20" />
        <p className="text-muted-foreground mt-4">لا توجد مستندات حتى الآن</p>
        <p className="text-sm text-muted-foreground mt-2">أضف مستند جديد باستخدام النموذج أعلاه</p>
      </div>
    );
  }
  
  const sortedDocuments = sortDocuments(documents);
  
  return (
    <>
      {searchQuery && (
        <div className="bg-primary-light/20 rounded-xl p-3 mb-4 flex items-center">
          <Search className="h-5 w-5 text-primary ml-2" />
          <div>
            <p className="text-primary font-medium">
              نتائج البحث عن "{searchQuery}"
            </p>
            <p className="text-xs text-muted-foreground">
              تم العثور على {documents.length} {documents.length === 1 ? 'مستند' : 'مستندات'}
            </p>
          </div>
        </div>
      )}
      
      <div className="bg-secondary-light rounded-xl shadow-card p-4 mb-6">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Tabs defaultValue="grid" onValueChange={(value) => setViewType(value as 'grid' | 'list')}>
              <TabsList>
                <TabsTrigger value="grid">عرض شبكي</TabsTrigger>
                <TabsTrigger value="list">عرض قائمة</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground ml-2">ترتيب حسب:</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setSortBy('date'); toggleSortOrder(); }}
              className={sortBy === 'date' ? 'bg-primary/5' : ''}
            >
              <Clock className="h-4 w-4 ml-1" />
              التاريخ
              {sortBy === 'date' && (
                <ArrowUpDown className="h-3 w-3 mr-1" />
              )}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setSortBy('name'); toggleSortOrder(); }}
              className={sortBy === 'name' ? 'bg-primary/5' : ''}
            >
              <Tag className="h-4 w-4 ml-1" />
              الاسم
              {sortBy === 'name' && (
                <ArrowUpDown className="h-3 w-3 mr-1" />
              )}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setSortBy('type'); toggleSortOrder(); }}
              className={sortBy === 'type' ? 'bg-primary/5' : ''}
            >
              <FileIcon className="h-4 w-4 ml-1" />
              النوع
              {sortBy === 'type' && (
                <ArrowUpDown className="h-3 w-3 mr-1" />
              )}
            </Button>
          </div>
        </div>
      </div>
      
      {viewType === 'grid' ? (
        <div className="grid grid-cols-1 xs:grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 xs:gap-4 sm:gap-5 lg:gap-6">
          {sortedDocuments.map((document) => (
            <Card key={document.id} className="overflow-hidden hover:shadow-md transition-shadow border-zinc-200 dark:border-zinc-700">
              <CardContent className="p-3 xs:p-4 sm:p-5 md:p-6">
                <div className="flex flex-col xs:flex-row justify-between xs:items-start mb-3 xs:mb-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-1 xs:gap-2 space-x-reverse">
                      <h3 className="text-sm xs:text-base sm:text-lg font-medium text-foreground line-clamp-1">
                        {searchQuery ? highlightText(document.name, searchQuery) : document.name}
                      </h3>
                      {(document.isManagerDocument || isManagerSection) && (
                        <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 mr-0 xs:mr-1">
                          <span className="inline-flex items-center">
                            <Lock className="ml-0.5 xs:ml-1 h-2.5 w-2.5 xs:h-3 xs:w-3" />
                            <span className="text-[10px] xs:text-xs">إداري</span>
                          </span>
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center mt-1 gap-1 xs:gap-2">
                      <p className="text-xs xs:text-sm font-medium text-primary dark:text-primary/90 line-clamp-1">
                        {getProjectName(document.projectId)}
                      </p>
                      {getFileTypeBadge(document.fileType)}
                    </div>
                    <p className="text-[10px] xs:text-xs text-muted-foreground mt-1 flex items-center">
                      <Clock className="h-2.5 w-2.5 xs:h-3 xs:w-3 inline ml-0.5 xs:ml-1" />
                      {formatDate(document.uploadDate)}
                    </p>
                  </div>
                  <div className="mt-2 xs:mt-0 xs:mr-2 sm:mr-4">
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <div className="cursor-help">{getFileIcon(document.fileType)}</div>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-80 backdrop-blur-sm bg-white/80 dark:bg-zinc-900/90 dark:border-zinc-800 shadow-lg">
                        <div className="flex justify-between space-y-1.5">
                          <div>
                            <h4 className="text-sm font-semibold">{document.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              نوع الملف: {document.fileType.split('/')[1].toUpperCase()}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              تاريخ الرفع: {formatDateTime(document.uploadDate)}
                            </p>
                          </div>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  </div>
                </div>
                
                {document.description && (
                  <p className="text-sm text-muted-foreground mt-2 mb-4 line-clamp-2">
                    {searchQuery ? highlightText(document.description, searchQuery) : document.description}
                  </p>
                )}
                
                <div className="flex justify-between mt-3 xs:mt-4">
                  <div className="flex space-x-1 xs:space-x-2 space-x-reverse">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => previewFile(document)}
                      className="h-7 xs:h-8 text-[10px] xs:text-xs px-1.5 xs:px-2 sm:px-3 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <Eye className="h-3 w-3 xs:h-4 xs:w-4 ml-0.5 xs:ml-1" />
                      <span className="xs:inline hidden">معاينة</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => downloadFile(document)}
                      className="h-7 xs:h-8 text-[10px] xs:text-xs px-1.5 xs:px-2 sm:px-3 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <Download className="h-3 w-3 xs:h-4 xs:w-4 ml-0.5 xs:ml-1" />
                      <span className="xs:inline hidden">تنزيل</span>
                    </Button>
                  </div>
                  {user?.role === 'admin' && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 xs:h-8 px-1.5 text-destructive hover:text-destructive/90 hover:bg-destructive/10 dark:hover:bg-destructive/20"
                      onClick={() => handleDeleteClick(document)}
                    >
                      <Trash2 className="h-3 w-3 xs:h-4 xs:w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-xl shadow-card overflow-hidden border border-zinc-200 dark:border-zinc-700">
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  <th className="px-2 xs:px-3 sm:px-4 md:px-6 py-2 xs:py-3 text-[10px] xs:text-xs font-medium text-muted-foreground tracking-wider">
                    اسم المستند
                  </th>
                  <th className="px-2 xs:px-3 sm:px-4 md:px-6 py-2 xs:py-3 text-[10px] xs:text-xs font-medium text-muted-foreground tracking-wider hidden sm:table-cell">
                    النوع
                  </th>
                  <th className="px-2 xs:px-3 sm:px-4 md:px-6 py-2 xs:py-3 text-[10px] xs:text-xs font-medium text-muted-foreground tracking-wider hidden md:table-cell">
                    المشروع
                  </th>
                  <th className="px-2 xs:px-3 sm:px-4 md:px-6 py-2 xs:py-3 text-[10px] xs:text-xs font-medium text-muted-foreground tracking-wider hidden sm:table-cell">
                    تاريخ الرفع
                  </th>
                  <th className="px-2 xs:px-3 sm:px-4 md:px-6 py-2 xs:py-3 text-[10px] xs:text-xs font-medium text-muted-foreground tracking-wider">
                    الإجراءات
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                {sortedDocuments.map((document) => (
                  <tr key={document.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="px-2 xs:px-3 sm:px-4 md:px-6 py-3 xs:py-4 text-[11px] xs:text-xs sm:text-sm">
                      <div className="flex items-center">
                        <div className="ml-1 xs:ml-2 flex-shrink-0">
                          {getFileIcon(document.fileType)}
                        </div>
                        <div className="mr-1 xs:mr-2 max-w-[120px] xs:max-w-[160px] sm:max-w-[200px] md:max-w-none">
                          <div className="flex flex-wrap items-center gap-1 space-x-1 xs:space-x-2 space-x-reverse">
                            <p className="font-medium line-clamp-1">
                              {searchQuery ? highlightText(document.name, searchQuery) : document.name}
                            </p>
                            {(document.isManagerDocument || isManagerSection) && (
                              <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 text-[9px] xs:text-[10px] sm:text-xs">
                                <span className="inline-flex items-center">
                                  <Lock className="ml-0.5 xs:ml-1 h-2.5 w-2.5 xs:h-3 xs:w-3" />
                                  <span className="hidden xs:inline">إداري</span>
                                </span>
                              </Badge>
                            )}
                          </div>
                          
                          {/* المشروع والتاريخ - يظهران فقط على الشاشات الصغيرة */}
                          <div className="flex flex-col mt-1 sm:hidden">
                            <span className="text-primary text-[10px] xs:text-xs line-clamp-1">{getProjectName(document.projectId)}</span>
                            <span className="text-muted-foreground text-[9px] xs:text-[10px]">{formatDate(document.uploadDate)}</span>
                          </div>
                          
                          {document.description && (
                            <p className="text-[9px] xs:text-[10px] sm:text-xs text-muted-foreground line-clamp-1">
                              {searchQuery ? highlightText(document.description, searchQuery) : document.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-2 xs:px-3 sm:px-4 md:px-6 py-3 xs:py-4 text-[11px] xs:text-xs sm:text-sm hidden sm:table-cell">
                      {getFileTypeBadge(document.fileType)}
                    </td>
                    <td className="px-2 xs:px-3 sm:px-4 md:px-6 py-3 xs:py-4 text-[11px] xs:text-xs sm:text-sm font-medium text-primary dark:text-primary/90 hidden md:table-cell">
                      <span className="line-clamp-1">{getProjectName(document.projectId)}</span>
                    </td>
                    <td className="px-2 xs:px-3 sm:px-4 md:px-6 py-3 xs:py-4 text-[11px] xs:text-xs sm:text-sm text-muted-foreground hidden sm:table-cell">
                      {formatDate(document.uploadDate)}
                    </td>
                    <td className="px-2 xs:px-3 sm:px-4 md:px-6 py-3 xs:py-4 text-[11px] xs:text-xs sm:text-sm text-right min-w-[90px] xs:min-w-[100px]">
                      <div className="flex justify-end space-x-1 xs:space-x-2 space-x-reverse">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => previewFile(document)}
                          className="h-6 xs:h-7 sm:h-8 w-6 xs:w-7 sm:w-8 p-0 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                          <Eye className="h-3 w-3 xs:h-4 xs:w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadFile(document)}
                          className="h-6 xs:h-7 sm:h-8 w-6 xs:w-7 sm:w-8 p-0 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                          <Download className="h-3 w-3 xs:h-4 xs:w-4" />
                        </Button>
                        {user?.role === 'admin' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 xs:h-7 sm:h-8 w-6 xs:w-7 sm:w-8 p-0 text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20"
                            onClick={() => handleDeleteClick(document)}
                          >
                            <Trash2 className="h-3 w-3 xs:h-4 xs:w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* حوار حذف المستند */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من رغبتك في حذف هذا المستند؟ هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              ) : null}
              تأكيد الحذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* حوار معاينة المستند */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
  <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              {currentDocument && getFileIcon(currentDocument.fileType)}
              <span className="mr-2">
                {searchQuery && currentDocument ? 
                  highlightText(currentDocument.name, searchQuery) : 
                  currentDocument?.name}
              </span>
            </DialogTitle>
            <DialogDescription>
              {searchQuery && currentDocument?.description ? 
                highlightText(currentDocument.description, searchQuery) : 
                currentDocument?.description}
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4 h-[60vh] overflow-auto bg-secondary/30 rounded-lg p-2">
            {currentDocument && (
              <>
                {isImageFile(currentDocument.fileType) ? (
                  <div className="h-full flex items-center justify-center">
                    {/* استخدام مكون ImageLightbox للصور */}
                    <div className="relative group">
                      <img 
                        src={currentDocument.fileUrl} 
                        alt={currentDocument.name || 'صورة'} 
                        className="max-w-full max-h-full object-contain cursor-zoom-in border border-secondary rounded-md hover:border-primary transition-colors" 
                        onClick={() => {
                          // دالة مساعدة لإنشاء عناصر الDOM مع خصائص متعددة
                          const createElementWithProps = <K extends keyof HTMLElementTagNameMap>(
                            tag: K, 
                            props: Record<string, any> = {}, 
                            styles: Partial<CSSStyleDeclaration> = {}, 
                            events: Record<string, any> = {}
                          ): HTMLElementTagNameMap[K] => {
                            const element = document.createElement(tag);
                            
                            // تعيين الخصائص
                            Object.entries(props).forEach(([key, value]) => {
                              (element as any)[key] = value;
                            });
                            
                            // تعيين الأنماط
                            Object.entries(styles).forEach(([key, value]) => {
                              (element.style as any)[key] = value;
                            });
                            
                            // تعيين مستمعي الأحداث
                            Object.entries(events).forEach(([eventName, handler]) => {
                              element.addEventListener(eventName, handler as EventListener);
                            });
                            
                            return element;
                          };
                          
                          // إنشاء الحاوية الرئيسية
                          const lightboxDiv = createElementWithProps('div', 
                            { id: 'image-lightbox-container' }, 
                            {
                              position: 'fixed',
                              top: '0',
                              left: '0',
                              width: '100%',
                              height: '100%',
                              zIndex: '9999',
                              background: 'rgba(0,0,0,0.9)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            },
                            {
                              click: (e: any) => {
                                if (e.target === lightboxDiv) {
                                  document.body.removeChild(lightboxDiv);
                                }
                              }
                            }
                          );
                          
                          // متغير لتتبع مستوى التكبير
                          let zoomLevel = 1;
                          
                          // إنشاء عنصر الصورة
                          const imgElement = createElementWithProps('img', 
                            { 
                              src: currentDocument.fileUrl,
                              alt: currentDocument.name || 'صورة'
                            }, 
                            {
                              maxWidth: '90%',
                              maxHeight: '90%',
                              objectFit: 'contain',
                              transition: 'transform 0.3s ease'
                            },
                            {
                              click: (e: any) => e.stopPropagation()
                            }
                          );
                          
                          // إنشاء شريط الأدوات
                          const toolbar = createElementWithProps('div', 
                            {}, 
                            {
                              position: 'absolute',
                              bottom: '20px',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              display: 'flex',
                              gap: '10px',
                              background: 'rgba(0, 0, 0, 0.6)',
                              padding: '10px',
                              borderRadius: '8px',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                            }
                          );
                          
                          // وظائف التكبير والتصغير
                          const zoomIn = (e: Event) => {
                            e.stopPropagation();
                            zoomLevel = Math.min(zoomLevel + 0.2, 3);
                            imgElement.style.transform = `scale(${zoomLevel})`;
                          };
                          
                          const zoomOut = (e: Event) => {
                            e.stopPropagation();
                            zoomLevel = Math.max(zoomLevel - 0.2, 0.5);
                            imgElement.style.transform = `scale(${zoomLevel})`;
                          };
                          
                          const resetZoom = (e: Event) => {
                            e.stopPropagation();
                            zoomLevel = 1;
                            imgElement.style.transform = 'scale(1)';
                          };
                          
                          // الأنماط المشتركة للأزرار
                          const buttonStyles = {
                            background: 'rgba(255, 255, 255, 0.2)',
                            border: 'none',
                            width: '40px',
                            height: '40px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background 0.2s ease'
                          };
                          
                          // زر التكبير
                          const zoomInBtn = createElementWithProps('button', 
                            { 
                              innerHTML: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 21L15 15M10 7V13M7 10H13M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
                              title: 'تكبير' // إضافة تلميح للمستخدم
                            }, 
                            buttonStyles,
                            { click: zoomIn }
                          );
                          
                          // زر التصغير
                          const zoomOutBtn = createElementWithProps('button', 
                            { 
                              innerHTML: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 21L15 15M7 10H13M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
                              title: 'تصغير'
                            }, 
                            buttonStyles,
                            { click: zoomOut }
                          );
                          
                          // زر إعادة تعيين الحجم
                          const resetZoomBtn = createElementWithProps('button', 
                            { 
                              innerHTML: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 12C3 16.9706 7.02944 21 12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C9.3345 3 6.93964 4.15869 5.29168 6M4 8V6H6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
                              title: 'إعادة ضبط الحجم'
                            }, 
                            buttonStyles,
                            { click: resetZoom }
                          );
                          
                          // إضافة الأزرار إلى شريط الأدوات
                          toolbar.appendChild(zoomOutBtn);
                          toolbar.appendChild(resetZoomBtn);
                          toolbar.appendChild(zoomInBtn);
                          
                          // زر الإغلاق
                          const closeButton = createElementWithProps('button', 
                            { 
                              textContent: '×',
                              title: 'إغلاق'
                            }, 
                            {
                              position: 'absolute',
                              top: '20px',
                              right: '20px',
                              background: 'transparent',
                              border: 'none',
                              color: 'white',
                              fontSize: '40px',
                              cursor: 'pointer',
                              zIndex: '10000'
                            },
                            { 
                              click: (e: any) => {
                                e.stopPropagation();
                                document.body.removeChild(lightboxDiv);
                              } 
                            }
                          );
                          
                          // تسجيل مفاتيح لوحة المفاتيح للتفاعل مع عارض الصور
                          const handleKeyDown = (e: KeyboardEvent) => {
                            switch (e.key) {
                              case 'Escape':
                                document.body.removeChild(lightboxDiv);
                                break;
                              case '+':
                              case '=': // يستخدم "=" عادة للتكبير (مع Shift)
                                zoomIn(e);
                                break;
                              case '-':
                                zoomOut(e);
                                break;
                              case '0':
                                resetZoom(e);
                                break;
                              default:
                                break;
                            }
                          };
                          
                          document.addEventListener('keydown', handleKeyDown);
                          
                          // تأمين نظيف: إزالة مستمع الحدث عند إزالة عارض الصور
                          const cleanupEventListener = () => {
                            document.removeEventListener('keydown', handleKeyDown);
                            const observer = new MutationObserver((mutations) => {
                              if (!document.body.contains(lightboxDiv)) {
                                document.removeEventListener('keydown', handleKeyDown);
                                observer.disconnect();
                              }
                            });
                            observer.observe(document.body, { childList: true });
                          };
                          
                          // إضافة العناصر إلى الصفحة
                          document.body.appendChild(lightboxDiv);
                          lightboxDiv.appendChild(imgElement);
                          lightboxDiv.appendChild(closeButton);
                          lightboxDiv.appendChild(toolbar);
                          
                          // تنظيف مستمعي الأحداث عند الإزالة
                          cleanupEventListener();
                        }}
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white p-2 text-sm text-center rounded-b-md opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        انقر للتكبير
                      </div>
                    </div>
                  </div>
                ) : isPdfFile(currentDocument.fileType) ? (
                  <iframe 
                    src={`${currentDocument.fileUrl}#toolbar=0&navpanes=0`} 
                    title={currentDocument.name}
                    className="w-full h-full"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    {getFileIcon(currentDocument.fileType)}
                    <p className="mt-4 text-muted-foreground">
                      لا يمكن معاينة هذا النوع من الملفات مباشرة.
                    </p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => window.open(currentDocument.fileUrl, '_blank')}
                    >
                      <FileIcon className="h-4 w-4 ml-2" />
                      فتح في علامة تبويب جديدة
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
          
          <DialogFooter>
            <div className="flex justify-between w-full items-center">
              <div className="flex flex-col text-sm text-muted-foreground">
                <span>المشروع: <span className="font-medium text-primary">{currentDocument && getProjectName(currentDocument.projectId)}</span></span>
                <span>تاريخ الرفع: {currentDocument && formatDateTime(currentDocument.uploadDate)}</span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => currentDocument && downloadFile(currentDocument)}
                >
                  <Download className="h-4 w-4 ml-2" />
                  تنزيل
                </Button>
                {user?.role === 'admin' && (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (currentDocument) {
                        setPreviewDialogOpen(false);
                        handleDeleteClick(currentDocument);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 ml-2" />
                    حذف المستند
                  </Button>
                )}
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
