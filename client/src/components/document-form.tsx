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
  Loader2, Upload, File as FileIcon, FileImage, FileText, 
  AlertCircle, CheckCircle, Trash2, UploadCloud, Info 
} from 'lucide-react';
import { getFileType, getReadableFileSize } from '@/lib/file-utils';
import { useAuth } from '@/hooks/use-auth';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface Project {
  id: number;
  name: string;
}

interface DocumentFormProps {
  projects: Project[];
  onSubmit: () => void;
  isLoading: boolean;
  isManagerDocument?: boolean;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ACCEPTED_FILE_TYPES = [
  "application/pdf", 
  "image/jpeg", "image/png", "image/jpg", "image/gif",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain", "application/rtf",
  "application/zip", "application/x-rar-compressed",
  "audio/mpeg", "audio/wav", "video/mp4"
];

const ACCEPTED_FILE_EXTENSIONS = ".pdf,.jpg,.jpeg,.png,.gif,.docx,.xlsx,.pptx,.txt,.rtf,.zip,.rar,.mp3,.wav,.mp4";

const documentSchema = z.object({
  name: z.string().min(1, "اسم المستند مطلوب"),
  description: z.string().optional(),
  projectId: z.string().optional(),
  file: z.instanceof(File, { message: "يرجى اختيار ملف" })
    .refine((file) => file.size <= MAX_FILE_SIZE, `حجم الملف يجب أن يكون أقل من ${MAX_FILE_SIZE / 1024 / 1024} ميجابايت`)
    .refine(
      (file) => ACCEPTED_FILE_TYPES.includes(file.type),
      "نوع الملف غير مدعوم"
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
    
    if (!form.getValues("name")) {
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

  const mutation = useMutation({
    mutationFn: async (data: DocumentFormValues) => {
      if (!file) throw new Error('لم يتم تحديد ملف');
      
      let stopSimulation: (() => void) | null = null;
      
      try {
        // محاكاة تقدم الرفع
        const simulateProgress = () => {
          let currentProgress = 0;
          const interval = setInterval(() => {
            currentProgress += Math.random() * 15;
            if (currentProgress > 90) currentProgress = 90;
            setUploadProgress(currentProgress);
          }, 200);
          
          stopSimulation = () => clearInterval(interval);
          return stopSimulation;
        };
        
        stopSimulation = simulateProgress();
        
        try {
          // 1. طلب رابط الرفع
          const urlResponse = await fetch(`${getApiBase()}/api/upload-url`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              fileName: file.name,
              fileType: file.type
            })
          });
          
          if (!urlResponse.ok) {
            throw new Error('فشل في الحصول على رابط الرفع');
          }
          
          const { uploadUrl, supabase } = await urlResponse.json();
          setUploadProgress(20);
          
          // 2. رفع الملف
          let uploadResponse;
          
          if (supabase) {
            const reader = new FileReader();
            const fileData = await new Promise<string>((resolve) => {
              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(file);
            });
            
            setUploadProgress(40);
            
            const finalUrl = `${getApiBase()}${uploadUrl}`;
            
            uploadResponse = await fetch(finalUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              credentials: 'include',
              body: JSON.stringify({
                fileData,
                fileName: file.name,
                fileType: file.type,
                name: data.name,
                description: data.description || '',
                projectId: data.projectId || '',
                isManagerDocument
              })
            });
            
            if (!uploadResponse.ok) {
              const errorText = await uploadResponse.text();
              throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText}`);
            }
          }
          
          setUploadProgress(100);
          const result = await uploadResponse!.json();
          
          stopSimulation?.();
          return result;
        } catch (error) {
          stopSimulation?.();
          throw error;
        }
      } catch (error) {
        setUploadProgress(0);
        throw error;
      }
    },
    onSuccess: (result) => {
      let title = "تمت العملية بنجاح";
      let description = "تم رفع المستند بنجاح";
      
      if (result?.infoOnly) {
        title = "تم حفظ المعلومات";
        description = "تم حفظ معلومات المستند (نظام الرفع قيد التطوير)";
      }
      
      toast({
        title,
        description,
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
    <div className="bg-secondary-light rounded-xl shadow-card p-6 w-full max-w-4xl mx-auto">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-primary-light mb-2">رفع مستند جديد</h3>
        <p className="text-sm text-muted-foreground">يمكنك رفع المستندات المختلفة مثل PDF، الصور، والمستندات النصية</p>
      </div>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-6">
          {/* معلومات المستند */}
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <FileText className="h-5 w-5 ml-2 text-primary" />
              معلومات المستند
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">اسم المستند *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="أدخل اسم المستند"
                        className="w-full px-4 py-3 text-sm rounded-lg bg-white border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                        disabled={isLoading || mutation.isPending}
                      />
                    </FormControl>
                    <FormMessage className="text-xs text-red-600" />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">المشروع</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                      disabled={isLoading || mutation.isPending}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full px-4 py-3 text-sm rounded-lg bg-white border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20">
                          <SelectValue placeholder="اختر المشروع (اختياري)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">بدون مشروع</SelectItem>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id.toString()}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-xs text-red-600" />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="mt-4">
                  <FormLabel className="text-sm font-medium text-gray-700">الوصف</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="أضف وصفاً للمستند (اختياري)"
                      className="w-full px-4 py-3 text-sm rounded-lg bg-white border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none min-h-[80px] resize-none"
                      disabled={isLoading || mutation.isPending}
                    />
                  </FormControl>
                  <FormMessage className="text-xs text-red-600" />
                </FormItem>
              )}
            />
          </div>

          {/* قسم رفع الملف */}
          <FormField
            control={form.control}
            name="file"
            render={({ field: { value, onChange, ...field } }) => (
              <FormItem>
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Upload className="h-5 w-5 ml-2 text-primary" />
                    رفع الملف
                  </h4>
                  
                  <div
                    className={`relative border-2 border-dashed rounded-lg p-6 transition-all ${
                      isDragging 
                        ? 'border-primary bg-primary/5' 
                        : file 
                          ? 'border-green-300 bg-green-50'
                          : 'border-gray-300 hover:border-primary hover:bg-gray-50'
                    }`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                  >
                    {file ? (
                      <div className="space-y-4">
                        <div className="flex items-start gap-4 p-4 bg-white rounded-lg border border-gray-200">
                          <div className="flex-shrink-0">
                            {getFileType(file.type) === 'image' ? (
                              <FileImage className="h-10 w-10 text-blue-500" />
                            ) : getFileType(file.type) === 'pdf' ? (
                              <FileText className="h-10 w-10 text-red-500" />
                            ) : (
                              <FileIcon className="h-10 w-10 text-gray-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {getReadableFileSize(file.size)} • {getFileType(file.type)}
                            </p>
                            <div className="flex items-center mt-2">
                              <CheckCircle className="h-4 w-4 text-green-500 ml-1" />
                              <span className="text-xs text-green-600">جاهز للرفع</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex gap-2 justify-center">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setFile(null);
                              onChange(null);
                            }}
                            disabled={isLoading || mutation.isPending}
                            className="text-red-600 border-red-200 hover:bg-red-50"
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
                          >
                            <Upload className="ml-1 h-4 w-4" />
                            تغيير الملف
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center space-y-4">
                        <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
                        <div className="space-y-2">
                          <p className="text-base font-medium text-gray-900">اختر ملفاً أو اسحبه هنا</p>
                          <p className="text-sm text-gray-500">
                            PDF، صور، مستندات، جداول بيانات، عروض تقديمية
                          </p>
                          <p className="text-xs text-gray-400">
                            أقصى حجم {MAX_FILE_SIZE / 1024 / 1024} ميجابايت
                          </p>
                        </div>
                        
                        <input
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
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isLoading || mutation.isPending}
                          className="bg-white hover:bg-gray-50"
                        >
                          <Upload className="ml-2 h-4 w-4" />
                          اختيار ملف
                        </Button>
                      </div>
                    )}
                  </div>
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
          
          {/* شريط التقدم */}
          {mutation.isPending && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <Loader2 className="h-5 w-5 ml-2 animate-spin text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">جاري رفع الملف...</span>
                </div>
                <span className="text-sm font-bold text-blue-600 bg-white px-3 py-1 rounded-full">
                  {uploadProgress}%
                </span>
              </div>
              <Progress value={uploadProgress} className="h-3 bg-white border border-blue-200" />
              <p className="text-xs text-center text-blue-600 mt-2">
                {uploadProgress < 20 ? 'بدء التحميل...' : 
                 uploadProgress < 60 ? 'جاري رفع الملف، يرجى الانتظار...' : 
                 uploadProgress < 90 ? 'اقترب التحميل من الانتهاء...' : 
                 'جاري إكمال العملية...'}
              </p>
            </div>
          )}
          
          {/* زر الإرسال */}
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <Button 
              type="submit" 
              className="w-full md:w-auto h-12 text-base px-8 bg-primary hover:bg-primary/90"
              disabled={isLoading || mutation.isPending || !file}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                  جاري الرفع...
                </>
              ) : (
                <>
                  <UploadCloud className="ml-2 h-5 w-5" />
                  رفع المستند
                </>
              )}
            </Button>
            
            {!file && (
              <p className="text-xs text-gray-500 mt-2">يرجى اختيار ملف للمتابعة</p>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}