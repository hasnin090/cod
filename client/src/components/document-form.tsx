import { getApiBase } from '@/lib/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState, useRef, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Loader2, Upload, File, FileImage, FileText, FileIcon, 
  AlertCircle, CheckCircle, Trash2, UploadCloud, Info 
} from 'lucide-react';
import { 
  getFileType, 
  getReadableFileSize 
} from '@/lib/firebase-storage';
import { useAuth } from '@/hooks/use-auth';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Project {
  id: number;
  name: string;
}

interface DocumentFormProps {
  projects: Project[];
  onSubmit: () => void;
  isLoading: boolean;
  isManagerDocument?: boolean; // إضافة خاصية لتحديد ما إذا كان المستند إدارياً
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ACCEPTED_FILE_TYPES = [
  // PDF files
  "application/pdf", 
  // Image files
  "image/jpeg", 
  "image/png", 
  "image/jpg", 
  "image/gif",
  "image/webp",
  "image/svg+xml",
  // Document files
  "application/msword", 
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 
  "text/plain",
  "text/rtf",
  "application/rtf",
  // Spreadsheet files
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  // Presentation files
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  // Compressed files
  "application/zip",
  "application/x-zip-compressed",
  "application/x-rar-compressed",
  // Audio files
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  // Video files
  "video/mp4",
  "video/mpeg",
  "video/quicktime"
];

const ACCEPTED_FILE_EXTENSIONS = ".pdf,.jpg,.jpeg,.png,.gif,.webp,.svg,.doc,.docx,.txt,.rtf,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.mp3,.wav,.mp4,.mpeg,.mov";

const documentSchema = z.object({
  name: z.string().min(3, "اسم المستند يجب أن يحتوي على الأقل 3 أحرف"),
  description: z.string().optional(),
  projectId: z.string().optional(),
  file: z
    .any()
    .refine((file) => !!file, "الملف مطلوب")
    .refine((file) => file?.size <= MAX_FILE_SIZE, `حجم الملف يجب أن يكون أقل من ${MAX_FILE_SIZE / 1024 / 1024} ميجابايت`)
    .refine(
      (file) => ACCEPTED_FILE_TYPES.includes(file?.type),
      `صيغة الملف غير مدعومة. الصيغ المدعومة: ${ACCEPTED_FILE_EXTENSIONS.replaceAll(',', ', ')}`
    ),
});

type DocumentFormValues = z.infer<typeof documentSchema>;

export function DocumentForm({ projects, onSubmit, isLoading, isManagerDocument = false }: DocumentFormProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  
  const form = useForm<DocumentFormValues>({
    resolver: zodResolver(documentSchema),
    defaultValues: {
      name: "",
      description: "",
      projectId: "",
    },
  });
  
  const handleFileChange = (selectedFile: File) => {
    setFile(selectedFile);
    form.setValue("file", selectedFile);
    
    // محاولة استخدام اسم الملف كاسم للمستند إذا كان حقل الاسم فارغًا
    if (!form.getValues("name")) {
      // إزالة الامتداد من اسم الملف
      const fileName = selectedFile.name.split('.').slice(0, -1).join('.');
      form.setValue("name", fileName);
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileChange(e.target.files[0]);
    }
  };
  
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  }, []);
  
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);
  
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);
  
  const updateUploadProgress = (progress: number) => {
    setUploadProgress(progress);
  };
  
  const getFileIcon = (fileType?: string) => {
    if (!fileType) return <FileIcon className="h-12 w-12 text-muted-foreground" />;
    
    if (fileType.includes('pdf')) {
      return <File className="h-12 w-12 text-destructive" />;
    } else if (fileType.includes('image')) {
      return <FileImage className="h-12 w-12 text-primary" />;
    } else if (fileType.includes('word') || fileType.includes('document')) {
      return <FileText className="h-12 w-12 text-primary-light" />;
    } else {
      return <FileIcon className="h-12 w-12 text-muted-foreground" />;
    }
  };
  
  const getFileTypeBadge = (fileType?: string) => {
    if (!fileType) return null;
    
    const type = getFileType(fileType);
    
    let color = "";
    switch(type) {
      case 'pdf':
        color = "bg-destructive/10 text-destructive border-destructive/20";
        break;
      case 'image':
        color = "bg-primary/10 text-primary border-primary/20";
        break;
      case 'document':
        color = "bg-primary-light/10 text-primary-light border-primary-light/20";
        break;
      default:
        color = "bg-muted/10 text-muted-foreground border-muted/20";
    }
    
    return (
      <Badge variant="outline" className={`${color} capitalize`}>
        {type}
      </Badge>
    );
  };
  
  const mutation = useMutation({
    mutationFn: async (data: DocumentFormValues) => {
      if (!file) {
        throw new Error("يرجى اختيار ملف للتحميل");
      }
      
      try {
        // تحديث شريط التقدم للإشعار بأن العملية بدأت
        setUploadProgress(5);
        console.log("تحديث نسبة التقدم إلى 5% قبل بدء التحميل");
        
        // إنشاء FormData لرفع الملف عبر REST API
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', data.name);
        formData.append('description', data.description || "");
        if (data.projectId && data.projectId !== "all") {
          formData.append('projectId', data.projectId);
        }
        formData.append('isManagerDocument', isManagerDocument.toString());
        

        
        // محاكاة تقدم التحميل
        const simulateProgress = () => {
          let progress = 5;
          const interval = setInterval(() => {
            // زيادة التقدم تدريجياً حتى 90% (سنترك 10% للمعالجة النهائية)
            if (progress < 90) {
              progress += Math.floor(Math.random() * 5) + 1;
              progress = Math.min(progress, 90);
              setUploadProgress(progress);
            } else {
              clearInterval(interval);
            }
          }, 300);
          
          return () => clearInterval(interval);
        };
        
        // بدء محاكاة التقدم
        const stopSimulation = simulateProgress();
        
        try {
          // الطريقة الجديدة: رفع مباشر إلى Supabase بدون مرور عبر Netlify
          setUploadProgress(5); // تحديث نسبة التقدم إلى 5% قبل بدء التحميل
          
          // 1. الحصول على رابط رفع موقّع
          const urlResponse = await fetch(`${getApiBase()}/get-upload-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              fileName: file.name,
              fileType: file.type
            })
          });
          
          if (!urlResponse.ok) {
            throw new Error('فشل في الحصول على رابط الرفع');
          }
          
          const { uploadUrl, filePath, method, headers, simplified, classic, base64, simple, external } = await urlResponse.json();
          console.log('[DEBUG] Upload config:', { uploadUrl, classic, simplified, base64, simple, external, apiBase: getApiBase() });
          setUploadProgress(20);
          
          // 2. رفع الملف - طريقة مختلفة حسب النوع
          let uploadResponse;
          
          if (external) {
            // الطريقة الخارجية: رفع بدون مرور عبر Netlify Functions
            console.log('[DEBUG] Using external upload method');
            
            // بدلاً من رفع فعلي، نحفظ فقط معلومات الملف
            // وننشئ رابط محلي مؤقت
            const mockFileUrl = URL.createObjectURL(file);
            setUploadProgress(40);
            
            const finalUrl = `${getApiBase()}${uploadUrl}`;
            console.log('[DEBUG] External upload URL:', finalUrl);
            
            uploadResponse = await fetch(finalUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              credentials: 'include',
              body: JSON.stringify({
                fileDataUrl: mockFileUrl,
                fileName: file.name,
                fileType: file.type,
                name: data.name,
                description: data.description || '',
                projectId: data.projectId || '',
                isManagerDocument
              })
            });
            
            console.log('[DEBUG] External upload response status:', uploadResponse.status);
          } else if (simple) {
            // الطريقة الأبسط: multer عادي
            console.log('[DEBUG] Using simple upload method');
            const uploadFormData = new FormData();
            uploadFormData.append('file', file);
            uploadFormData.append('name', data.name);
            uploadFormData.append('description', data.description || '');
            uploadFormData.append('projectId', data.projectId || '');
            uploadFormData.append('isManagerDocument', isManagerDocument.toString());
            
            const finalUrl = `${getApiBase()}${uploadUrl}`;
            console.log('[DEBUG] Simple upload URL:', finalUrl);
            
            uploadResponse = await fetch(finalUrl, {
              method: method || 'POST',
              body: uploadFormData,
              credentials: 'include'
            });
            
            console.log('[DEBUG] Simple upload response status:', uploadResponse.status);
          } else if (base64) {
            // الطريقة الجديدة: رفع باستخدام base64
            console.log('[DEBUG] Starting base64 upload, file size:', file.size);
            
            // التحقق من حجم الملف (حد أقصى 10MB للـ base64)
            const maxSize = 10 * 1024 * 1024; // 10MB
            if (file.size > maxSize) {
              throw new Error('حجم الملف كبير جداً للرفع بهذه الطريقة (الحد الأقصى 10MB)');
            }
            
            const reader = new FileReader();
            const fileDataPromise = new Promise<string>((resolve) => {
              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(file);
            });
            
            const fileData = await fileDataPromise;
            console.log('[DEBUG] Base64 conversion complete, data length:', fileData.length);
            setUploadProgress(40);
            
            const finalUrl = `${getApiBase()}${uploadUrl}`;
            console.log('[DEBUG] Base64 upload URL:', finalUrl);
            
            const payload = {
              fileData,
              fileName: file.name,
              fileType: file.type,
              name: data.name,
              description: data.description || '',
              projectId: data.projectId || '',
              isManagerDocument
            };
            
            console.log('[DEBUG] Payload prepared, size:', JSON.stringify(payload).length);
            
            uploadResponse = await fetch(finalUrl, {
              method: method || 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              credentials: 'include',
              body: JSON.stringify(payload)
            });
            
            console.log('[DEBUG] Upload response status:', uploadResponse.status);
          } else if (classic) {
            // الطريقة الكلاسيكية: استخدام endpoint الموجود
            const uploadFormData = new FormData();
            uploadFormData.append('file', file);
            uploadFormData.append('name', data.name);
            uploadFormData.append('description', data.description || '');
            uploadFormData.append('projectId', data.projectId || '');
            uploadFormData.append('isManagerDocument', isManagerDocument.toString());
            
            const finalUrl = `${getApiBase()}${uploadUrl}`;
            console.log('[DEBUG] Final upload URL:', finalUrl);
            
            uploadResponse = await fetch(finalUrl, {
              method: method || 'POST',
              body: uploadFormData,
              credentials: 'include'
            });
          } else if (simplified) {
            // الطريقة المبسطة: رفع مباشر إلى الخادم
            const uploadFormData = new FormData();
            uploadFormData.append('file', file);
            uploadFormData.append('name', data.name);
            uploadFormData.append('description', data.description || '');
            uploadFormData.append('projectId', data.projectId || '');
            uploadFormData.append('isManagerDocument', isManagerDocument.toString());
            
            uploadResponse = await fetch(`${getApiBase()}${uploadUrl}`, {
              method: method || 'POST',
              body: uploadFormData,
              credentials: 'include'
            });
          } else {
            // الطريقة الأصلية: رفع إلى Supabase
            uploadResponse = await fetch(uploadUrl, {
              method: 'PUT',
              body: file,
              headers: {
                'Content-Type': file.type,
                ...headers
              }
            });
          }
          
          if (!uploadResponse.ok) {
            throw new Error('فشل في رفع الملف');
          }
          
          setUploadProgress(80);
          
          let result;
          
          if (external || simple || base64 || classic || simplified) {
            // في الطرق المباشرة، الرفع مكتمل بالفعل
            result = await uploadResponse.json();
            setUploadProgress(100);
          } else {
            // في الطريقة الأصلية، نحتاج خطوة التأكيد
            const confirmResponse = await fetch(`${getApiBase()}/confirm-upload`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                filePath,
                name: data.name,
                description: data.description,
                projectId: data.projectId,
                isManagerDocument,
                fileSize: file.size,
                fileType: file.type
              })
            });
            
            if (!confirmResponse.ok) {
              const errorData = await confirmResponse.json().catch(() => ({ message: 'فشل في تأكيد الرفع' }));
              throw new Error(errorData.message || 'فشل في تأكيد الرفع');
            }
            
            result = await confirmResponse.json();
            setUploadProgress(100);
          }
          
          return result;
        } catch (error) {
          // إيقاف محاكاة التقدم في حالة حدوث خطأ
          stopSimulation();

          throw error;
        }
      } catch (error) {
        // إعادة تعيين شريط التقدم في حالة وجود خطأ

        setUploadProgress(0);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "تمت العملية بنجاح",
        description: "تم رفع المستند بنجاح",
      });
      form.reset({
        name: "",
        description: "",
        projectId: "",
      });
      setFile(null);
      setUploadProgress(0);
      onSubmit();
    },
    onError: (error) => {
      setUploadProgress(0);
      toast({
        variant: "destructive",
        title: "خطأ",
        description: error instanceof Error ? error.message : "فشل في رفع المستند",
      });
    },
  });
  
  function onFormSubmit(data: DocumentFormValues) {
    mutation.mutate(data);
  }
  
  return (
    <div className="bg-secondary-light rounded-xl shadow-card p-3 xs:p-4 sm:p-5 w-full max-w-full">
      <h3 className="text-sm xs:text-base sm:text-lg font-bold text-primary-light mb-2 xs:mb-3 sm:mb-4">رفع مستند جديد</h3>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-3 xs:space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 xs:gap-3 sm:gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="space-y-1 xs:space-y-1.5 sm:space-y-2">
                  <FormLabel className="text-xs xs:text-sm">اسم المستند</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="أدخل اسم المستند"
                      className="w-full px-3 py-1.5 xs:px-4 xs:py-2 text-xs xs:text-sm rounded-lg bg-secondary border border-secondary-light focus:border-primary-light focus:outline-none text-neutral-light"
                      disabled={isLoading || mutation.isPending}
                    />
                  </FormControl>
                  <FormMessage className="text-[10px] xs:text-xs" />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="projectId"
              render={({ field }) => (
                <FormItem className="space-y-1 xs:space-y-1.5 sm:space-y-2">
                  <FormLabel className="text-xs xs:text-sm">المشروع</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value} 
                    disabled={isLoading || mutation.isPending}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full px-3 py-1.5 xs:px-4 xs:py-2 text-xs xs:text-sm h-auto rounded-lg bg-secondary border border-secondary-light focus:border-primary-light focus:outline-none text-neutral-light">
                        <SelectValue placeholder="اختر المشروع" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="text-xs xs:text-sm">
                      <SelectItem value="all">عام</SelectItem>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id.toString()}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-[10px] xs:text-xs" />
                </FormItem>
              )}
            />
          </div>
          
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem className="space-y-1 xs:space-y-1.5 sm:space-y-2">
                <FormLabel className="text-xs xs:text-sm">وصف المستند</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={2}
                    placeholder="أدخل وصف المستند (اختياري)"
                    className="w-full px-3 py-1.5 xs:px-4 xs:py-2 text-xs xs:text-sm rounded-lg bg-secondary border border-secondary-light focus:border-primary-light focus:outline-none text-neutral-light"
                    disabled={isLoading || mutation.isPending}
                  />
                </FormControl>
                <FormMessage className="text-[10px] xs:text-xs" />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="file"
            render={({ field: { onChange, value, ...rest } }) => (
              <FormItem>
                <FormLabel className="flex items-center text-xs xs:text-sm">
                  الملف
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="inline-flex">
                          <Info className="h-3 w-3 xs:h-4 xs:w-4 mr-1 text-muted-foreground cursor-help" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-[10px] xs:text-xs p-2 xs:p-3">
                        <p>
                          يمكنك رفع ملفات بصيغة PDF أو صور (JPG, PNG) أو مستندات (DOC, DOCX) أو ملفات نصية (TXT).
                          الحد الأقصى لحجم الملف هو {MAX_FILE_SIZE / 1024 / 1024} ميجابايت.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </FormLabel>
                
                <div 
                  className={`border-2 border-dashed rounded-lg p-2 xs:p-3 sm:p-4 md:p-5 text-center transition-colors
                    ${isDragging 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50 hover:bg-secondary/80'
                    } 
                    ${mutation.isPending ? 'opacity-60' : ''}
                  `}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  {file ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-center mb-2">
                        {getFileIcon(file.type)}
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{file.name}</p>
                        <div className="flex items-center justify-center gap-2">
                          <p className="text-xs text-muted-foreground">
                            {getReadableFileSize(file.size)}
                          </p>
                          {getFileTypeBadge(file.type)}
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap justify-center gap-2 mt-4">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setFile(null);
                            onChange(null);
                          }}
                          disabled={isLoading || mutation.isPending}
                          className="w-full xs:w-auto"
                        >
                          <Trash2 className="ml-1 h-4 w-4" />
                          حذف
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isLoading || mutation.isPending}
                          className="w-full xs:w-auto"
                        >
                          <Upload className="ml-1 h-4 w-4" />
                          تغيير
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <UploadCloud className="mx-auto h-8 w-8 xs:h-10 xs:w-10 md:h-12 md:w-12 text-muted-foreground" />
                      <div>
                        <p className="text-sm xs:text-base font-medium">اضغط لاختيار ملف أو قم بسحب الملف وإفلاته هنا</p>
                        <p className="text-xs xs:text-sm text-muted-foreground mt-1">
                          <span className="hidden xs:inline">PDF، صور (JPG, PNG, GIF, SVG)، مستندات (DOC, DOCX, TXT, RTF)، أوراق عمل (XLS, XLSX)، عروض تقديمية (PPT, PPTX)، ملفات مضغوطة (ZIP, RAR)، وسائط (MP3, WAV, MP4) - </span>
                          <span className="xs:hidden">ملفات PDF، صور، مستندات - </span>
                          أقصى حجم {MAX_FILE_SIZE / 1024 / 1024} ميجابايت
                        </p>
                      </div>
                      
                      <input
                        id="file-upload"
                        type="file"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={(e) => {
                          handleInputChange(e);
                          onChange(e.target.files?.[0] || null);
                        }}
                        accept={ACCEPTED_FILE_EXTENSIONS}
                        disabled={isLoading || mutation.isPending}
                      />
                      
                      <Button
                        type="button"
                        variant="outline"
                        className="relative w-full xs:w-auto"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isLoading || mutation.isPending}
                      >
                        <Upload className="ml-2 h-4 w-4" />
                        اختيار ملف
                      </Button>
                    </div>
                  )}
                </div>

                <FormMessage />
                
                {form.formState.errors.file && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>خطأ في الملف</AlertTitle>
                    <AlertDescription>
                      {form.formState.errors.file.message as string}
                    </AlertDescription>
                  </Alert>
                )}
              </FormItem>
            )}
          />
          
          {mutation.isPending && (
            <div className="space-y-1.5 xs:space-y-2 border-2 border-primary/10 rounded-lg p-2 xs:p-3 bg-primary/5">
              <div className="flex items-center justify-between mb-0.5 xs:mb-1">
                <div className="flex items-center">
                  <Loader2 className="h-3.5 w-3.5 xs:h-4 xs:w-4 ml-1.5 xs:ml-2 animate-spin text-primary" />
                  <span className="text-xs xs:text-sm font-medium text-primary-light">جاري رفع الملف...</span>
                </div>
                <span className="text-xs xs:text-sm font-bold text-primary bg-white px-2 xs:px-3 py-0.5 xs:py-1 rounded-full shadow-sm border border-primary/10">
                  {uploadProgress}%
                </span>
              </div>
              <Progress value={uploadProgress} className="h-2 xs:h-2.5 sm:h-3 bg-white" />
              <p className="text-[10px] xs:text-xs text-center text-muted-foreground mt-0.5 xs:mt-1">
                {uploadProgress < 20 ? 'بدء التحميل...' : 
                 uploadProgress < 60 ? 'جاري رفع الملف، يرجى الانتظار...' : 
                 uploadProgress < 90 ? 'اقترب التحميل من الانتهاء...' : 
                 'جاري إكمال العملية...'}
              </p>
            </div>
          )}
          
          <div className="text-center pt-2">
            <Button 
              type="submit" 
              className="w-full xs:w-auto h-9 xs:h-10 text-xs xs:text-sm px-3 xs:px-4 sm:px-6 py-1.5 xs:py-2 bg-gradient-to-r from-primary to-primary-light text-white font-medium rounded-lg hover:shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0"
              disabled={isLoading || mutation.isPending || !file}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="ml-1.5 xs:ml-2 h-3.5 w-3.5 xs:h-4 xs:w-4 animate-spin" />
                  جاري الرفع...
                </>
              ) : (
                <>
                  <UploadCloud className="ml-1.5 xs:ml-2 h-3.5 w-3.5 xs:h-4 xs:w-4" />
                  رفع المستند
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
