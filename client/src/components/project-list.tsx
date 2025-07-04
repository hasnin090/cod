import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useAuth } from '@/hooks/use-auth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, CalendarIcon } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

interface Project {
  id: number;
  name: string;
  description: string;
  startDate: string;
  status: string;
  progress: number;
}

interface ProjectListProps {
  projects: Project[];
  isLoading: boolean;
  onProjectUpdated: () => void;
}

const editProjectSchema = z.object({
  name: z.string().min(3, "اسم المشروع يجب أن يحتوي على الأقل 3 أحرف"),
  description: z.string().min(10, "وصف المشروع يجب أن يحتوي على الأقل 10 أحرف"),
  startDate: z.date({
    required_error: "تاريخ البدء مطلوب",
  }),
  status: z.enum(["active", "completed", "paused"], {
    required_error: "حالة المشروع مطلوبة",
  }),
  progress: z.number().min(0).max(100),
});

type EditProjectFormValues = z.infer<typeof editProjectSchema>;

export function ProjectList({ projects, isLoading, onProjectUpdated }: ProjectListProps) {
  const { user } = useAuth();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const { toast } = useToast();
  
  const [forceDeleteDialogOpen, setForceDeleteDialogOpen] = useState(false);
  const [errorData, setErrorData] = useState<{
    message: string;
    transactionsCount?: number;
    canForceDelete?: boolean;
    projectId?: number;
  } | null>(null);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);

  const editForm = useForm<EditProjectFormValues>({
    resolver: zodResolver(editProjectSchema),
    defaultValues: {
      name: "",
      description: "",
      startDate: new Date(),
      status: "active",
      progress: 0,
    },
  });
  
  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: EditProjectFormValues }) => {
      return apiRequest(`/api/projects/${id}`, 'PUT', data);
    },
    onSuccess: (data) => {
      toast({
        title: "تم التحديث بنجاح",
        description: `تم تحديث المشروع "${data?.name || 'الجديد'}" بنجاح`,
      });
      setEditDialogOpen(false);
      setProjectToEdit(null);
      editForm.reset();
      onProjectUpdated();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: error instanceof Error ? error.message : "فشل في تحديث المشروع",
      });
      console.error("Error updating project:", error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, force = false }: { id: number; force?: boolean }) => {
      const url = force ? `/api/projects/${id}?force=true` : `/api/projects/${id}`;
      return apiRequest(url, 'DELETE', undefined);
    },
    onSuccess: (data) => {
      toast({
        title: "تم الحذف بنجاح",
        description: "تم حذف المشروع بنجاح",
      });
      onProjectUpdated();
    },
    onError: async (error: any) => {
      // التحقق من أن الخطأ ليس مجرد كائن فارغ أو undefined
      if (!error || (typeof error === 'object' && Object.keys(error).length === 0)) {
        console.log("Received empty error object, ignoring");
        return;
      }

      // محاولة استخراج رسالة الخطأ من استجابة الخادم
      let errorMessage = "فشل في حذف المشروع";
      let transactionsCount = 0;
      let projectId = projectToDelete?.id;
      
      try {
        if (error.response && error.response.status === 400) {
          // استجابة 400 تعني أن هناك سبب محدد لعدم القدرة على حذف المشروع
          const responseData = await error.response.json();
          
          if (responseData.message) {
            errorMessage = responseData.message;
            transactionsCount = responseData.transactionsCount || 0;
            
            // عرض مربع حوار خطأ تفصيلي بدلاً من toast فقط
            setErrorData({
              message: errorMessage,
              transactionsCount,
              canForceDelete: responseData.canForceDelete || false,
              projectId
            });
            setErrorDialogOpen(true);
            
            // لا نزال نعرض إشعار toast للتنبيه
            toast({
              variant: "destructive",
              title: "تعذر حذف المشروع",
              description: "يرجى مراجعة التفاصيل في نافذة الخطأ",
            });
            
            return; // الخروج مبكرًا لأننا سنعرض مربع حوار مخصص
          }
        }
        
        // إذا كان هناك خطأ فعلي في الشبكة أو الخادم
        if (error.response && error.response.status >= 500) {
          errorMessage = "خطأ في الخادم، يرجى المحاولة لاحقاً";
        } else if (error.message) {
          errorMessage = error.message;
        }
        
      } catch (jsonError) {
        console.error("خطأ في معالجة استجابة الخطأ:", jsonError);
      }
      
      // عرض toast فقط للأخطاء الفعلية
      if (error.response || error.message) {
        toast({
          variant: "destructive",
          title: "تعذر حذف المشروع",
          description: errorMessage,
        });
      }
      
      console.error("خطأ حذف المشروع:", error);
    },
  });
  
  const handleEditClick = (project: Project) => {
    setProjectToEdit(project);
    
    // التحقق من صحة التاريخ قبل الاستخدام
    let startDate: Date;
    try {
      startDate = project.startDate ? new Date(project.startDate) : new Date();
      if (isNaN(startDate.getTime())) {
        startDate = new Date();
      }
    } catch (error) {
      console.error('Error parsing start date:', error);
      startDate = new Date();
    }
    
    editForm.reset({
      name: project.name,
      description: project.description,
      startDate: startDate,
      status: project.status as "active" | "completed" | "paused",
      progress: project.progress,
    });
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (project: Project) => {
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
  };
  
  const confirmDelete = () => {
    if (projectToDelete) {
      deleteMutation.mutate({ id: projectToDelete.id, force: false });
    }
    setDeleteDialogOpen(false);
  };

  const confirmForceDelete = () => {
    if (projectToDelete) {
      deleteMutation.mutate({ id: projectToDelete.id, force: true });
    }
    setErrorDialogOpen(false);
    setDeleteDialogOpen(false);
    setProjectToDelete(null);
  };

  const onEditSubmit = (data: EditProjectFormValues) => {
    if (projectToEdit) {
      editMutation.mutate({ id: projectToEdit.id, data });
    }
  };
  
  const formatDate = (dateString: string | Date | null | undefined) => {
    if (!dateString) return 'غير محدد';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'تاريخ غير صحيح';
      }
      return format(date, 'yyyy/MM/dd', { locale: ar });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'تاريخ غير صحيح';
    }
  };
  
  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'نشط';
      case 'paused': return 'متوقف مؤقتاً';
      case 'completed': return 'مكتمل';
      default: return status;
    }
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-success bg-opacity-20 text-success';
      case 'paused': return 'bg-warning bg-opacity-20 text-warning';
      case 'completed': return 'bg-info bg-opacity-20 text-info';
      default: return 'bg-muted bg-opacity-20 text-muted';
    }
  };
  
  if (isLoading) {
    return (
      <div className="text-center py-20">
        <div className="spinner w-8 h-8 mx-auto"></div>
        <p className="mt-4 text-muted">جاري تحميل البيانات...</p>
      </div>
    );
  }
  
  if (projects.length === 0) {
    return (
      <div className="bg-secondary-light rounded-xl shadow-card p-10 text-center">
        <p className="text-muted-foreground">لا توجد مشاريع حتى الآن</p>
        <p className="text-sm text-muted mt-2">أضف مشروع جديد باستخدام النموذج أعلاه</p>
      </div>
    );
  }
  
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
        {projects.map((project) => (
          <div key={project.id} className="bg-secondary-light rounded-xl shadow-card overflow-hidden">
            <div className="bg-primary p-4">
              <h3 className="text-lg font-bold text-white tracking-wide">{project.name || 'مشروع جديد'}</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-foreground">{project.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">تاريخ البدء: <span className="font-medium">{formatDate(project.startDate)}</span></span>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(project.status)}`}>
                  {getStatusText(project.status)}
                </span>
              </div>
              <div className="pt-2">
                <p className="text-sm text-foreground mb-1">التقدم في العمل: <span className="font-medium">{project.progress}%</span></p>
                <div className="w-full h-2 bg-secondary rounded-full">
                  <div 
                    className="h-2 bg-primary-light rounded-full" 
                    style={{ width: `${project.progress}%` }}
                  ></div>
                </div>
              </div>
              {user?.role === 'admin' ? (
                <div className="flex justify-between mt-4 pt-3 border-t border-gray-100">
                  <button 
                    className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-sm font-medium flex items-center"
                    onClick={() => handleEditClick(project)}
                  >
                    <i className="fas fa-edit ml-1.5"></i>
                    تعديل
                  </button>
                  <button 
                    className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-medium flex items-center"
                    onClick={() => handleDeleteClick(project)}
                  >
                    <i className="fas fa-trash-alt ml-1.5"></i>
                    حذف
                  </button>
                </div>
              ) : (
                <div className="mt-4 pt-3 border-t border-gray-100 text-muted-foreground text-xs text-center">
                  <p>
                    <i className="fas fa-eye ml-1"></i>
                    {user?.role === 'viewer' ? 'مشاهدة فقط' : 'لا تملك صلاحية التعديل'}
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من رغبتك في حذف هذا المشروع؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>سيتم حذف جميع المستندات المرتبطة بالمشروع</li>
              <li>سيتم إزالة جميع المستخدمين المرتبطين بالمشروع</li>
              <li className="text-destructive font-medium">ملاحظة: لا يمكن حذف المشروع إذا كان يحتوي على معاملات مالية مرتبطة به</li>
            </ul>
            <div className="text-sm bg-amber-50 dark:bg-amber-900/30 p-3 rounded-md border border-amber-200 dark:border-amber-800">
              <p className="font-medium text-amber-800 dark:text-amber-300">
                <i className="fas fa-exclamation-triangle ml-1"></i>
                إجراء الحذف لا يمكن التراجع عنه!
              </p>
            </div>
          </div>
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

      {/* نافذة تعديل المشروع */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-primary flex items-center">
              <i className="fas fa-edit ml-2"></i>
              تعديل المشروع
            </DialogTitle>
          </DialogHeader>
          
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>اسم المشروع</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="أدخل اسم المشروع"
                        disabled={editMutation.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>وصف المشروع</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={3}
                        placeholder="أدخل وصف المشروع"
                        disabled={editMutation.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>تاريخ البدء</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className="w-full h-10 text-right justify-between"
                              disabled={editMutation.isPending}
                            >
                              {field.value ? (
                                format(field.value, "yyyy/MM/dd")
                              ) : (
                                <span>اختر التاريخ</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>حالة المشروع</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value} 
                        disabled={editMutation.isPending}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="اختر حالة المشروع" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">نشط</SelectItem>
                          <SelectItem value="paused">متوقف مؤقتاً</SelectItem>
                          <SelectItem value="completed">مكتمل</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={editForm.control}
                name="progress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>نسبة التقدم (%)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min="0"
                        max="100"
                        placeholder="0"
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        disabled={editMutation.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditDialogOpen(false);
                    setProjectToEdit(null);
                    editForm.reset();
                  }}
                  disabled={editMutation.isPending}
                >
                  إلغاء
                </Button>
                <Button 
                  type="submit"
                  disabled={editMutation.isPending}
                >
                  {editMutation.isPending ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري الحفظ...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-save ml-2"></i>
                      حفظ التغييرات
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* مربع حوار تفاصيل خطأ الحذف */}
      <Dialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center">
              <i className="fas fa-exclamation-circle ml-2"></i>
              تعذر حذف المشروع
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-destructive/10 p-4 rounded-md border border-destructive/20">
              <p className="text-destructive font-medium">{errorData?.message}</p>
              
              {errorData?.transactionsCount ? (
                <p className="mt-2 flex items-center text-sm">
                  <i className="fas fa-info-circle ml-1.5"></i>
                  عدد المعاملات المرتبطة: <span className="font-bold mr-1">{errorData.transactionsCount}</span>
                </p>
              ) : null}
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">الحلول الممكنة:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>حذف أو نقل المعاملات المالية المرتبطة بالمشروع أولاً</li>
                <li>في حالة عدم استخدام المشروع، يمكن تحديثه إلى حالة "مكتمل" بدلاً من حذفه</li>
              </ul>
            </div>
            
            {errorData?.projectId ? (
              <div className="pt-2 border-t space-y-3">
                <div className="flex justify-end">
                  <Button 
                    variant="outline"
                    className="bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700"
                    onClick={() => {
                      // توجيه المستخدم إلى صفحة المعاملات المالية مع تصفية المشروع المحدد
                      window.location.href = `/transactions?projectId=${errorData.projectId}`;
                    }}
                  >
                    <i className="fas fa-search ml-1.5"></i>
                    عرض المعاملات المرتبطة
                  </Button>
                </div>
                
                {errorData?.canForceDelete && (
                  <div className="bg-red-50 p-3 rounded-md border border-red-200">
                    <div className="flex items-start space-x-3">
                      <i className="fas fa-exclamation-triangle text-red-500 mt-1"></i>
                      <div className="flex-1">
                        <h4 className="font-medium text-red-800 mb-2">حذف قسري (خطر)</h4>
                        <p className="text-sm text-red-700 mb-3">
                          سيتم حذف المشروع مع جميع المعاملات المالية المرتبطة به نهائياً. هذا الإجراء لا يمكن التراجع عنه.
                        </p>
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setErrorDialogOpen(false)}
                          >
                            إلغاء
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setErrorDialogOpen(false);
                              confirmForceDelete();
                            }}
                            disabled={deleteMutation.isPending}
                          >
                            {deleteMutation.isPending ? (
                              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                            ) : (
                              <i className="fas fa-trash ml-2"></i>
                            )}
                            حذف قسري
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
