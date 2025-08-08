import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Edit2, Settings } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const expenseTypeSchema = z.object({
  name: z.string().min(1, "اسم نوع المصروف مطلوب"),
  description: z.string().optional(),
  projectId: z.number().optional(),
});

type ExpenseTypeForm = z.infer<typeof expenseTypeSchema>;

interface ExpenseType {
  id: number;
  name: string;
  description: string | null;
  projectId: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Project {
  id: number;
  name: string;
  description: string | null;
}

export default function ExpenseTypesManagementPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingExpenseType, setEditingExpenseType] = useState<ExpenseType | null>(null);

  const form = useForm<ExpenseTypeForm>({
    resolver: zodResolver(expenseTypeSchema),
    defaultValues: {
      name: "",
      description: "",
      projectId: undefined,
    },
  });

  // جلب المشاريع
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // جلب أنواع المصروفات
  const { data: expenseTypes = [], isLoading: expenseTypesLoading } = useQuery<ExpenseType[]>({
    queryKey: ["/api/expense-types"],
  });

  // إضافة نوع مصروف جديد
  const createExpenseTypeMutation = useMutation({
    mutationFn: (data: ExpenseTypeForm) => apiRequest("/api/expense-types", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expense-types"] });
      toast({ title: "نجح الحفظ", description: "تم إضافة نوع المصروف بنجاح" });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({ 
        title: "خطأ", 
        description: error?.message || "حدث خطأ أثناء إضافة نوع المصروف", 
        variant: "destructive" 
      });
    },
  });

  // تحديث نوع مصروف
  const updateExpenseTypeMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number } & ExpenseTypeForm) => 
      apiRequest(`/api/expense-types/${id}`, "PATCH", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expense-types"] });
      toast({ title: "نجح التحديث", description: "تم تحديث نوع المصروف بنجاح" });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({ 
        title: "خطأ", 
        description: error?.message || "حدث خطأ أثناء تحديث نوع المصروف", 
        variant: "destructive" 
      });
    },
  });

  const onSubmit = (data: ExpenseTypeForm) => {
    if (editingExpenseType) {
      updateExpenseTypeMutation.mutate({ id: editingExpenseType.id, ...data });
    } else {
      createExpenseTypeMutation.mutate(data);
    }
  };

  const handleEdit = (expenseType: ExpenseType) => {
    setEditingExpenseType(expenseType);
    form.reset({
      name: expenseType.name,
      description: expenseType.description || "",
      projectId: expenseType.projectId || undefined,
    });
    setIsEditDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsAddDialogOpen(false);
    setIsEditDialogOpen(false);
    setEditingExpenseType(null);
    form.reset({
      name: "",
      description: "",
      projectId: undefined,
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ar-IQ');
  };

  const getProjectName = (projectId: number | null) => {
    if (!projectId) return null;
    const project = projects.find(p => p.id === projectId);
    return project ? project.name : `مشروع ${projectId}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Settings className="h-8 w-8 text-blue-600" />
            إدارة أنواع المصاريف
          </h1>
          <p className="text-muted-foreground mt-2">
            إدارة وتصنيف أنواع المصاريف وربطها بالمشاريع
          </p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="ml-2 h-4 w-4" />
              إضافة نوع مصروف
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>إضافة نوع مصروف جديد</DialogTitle>
              <DialogDescription>
                إضافة نوع مصروف جديد مع إمكانية ربطه بمشروع محدد
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>اسم نوع المصروف *</FormLabel>
                      <FormControl>
                        <Input placeholder="مثال: راتب، مصروف عام، وقود" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>الوصف</FormLabel>
                      <FormControl>
                        <Textarea placeholder="وصف نوع المصروف..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="projectId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>المشروع المرتبط</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}
                        value={field.value?.toString() || ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="اختر مشروع (اختياري - سيكون عام إذا لم تختر)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">عام (جميع المشاريع)</SelectItem>
                          {projects.map((project) => (
                            <SelectItem key={project.id} value={project.id.toString()}>
                              {project.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex justify-end gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleCloseDialog}
                  >
                    إلغاء
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createExpenseTypeMutation.isPending}
                  >
                    {createExpenseTypeMutation.isPending ? "جاري الحفظ..." : "حفظ"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* جدول أنواع المصاريف */}
      <Card>
        <CardHeader>
          <CardTitle>أنواع المصاريف المتاحة</CardTitle>
          <CardDescription>
            قائمة جميع أنواع المصاريف مع إمكانية تحريرها وربطها بالمشاريع
          </CardDescription>
        </CardHeader>
        <CardContent>
          {expenseTypesLoading ? (
            <div className="text-center py-8">جاري التحميل...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>الوصف</TableHead>
                  <TableHead>المشروع المرتبط</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>تاريخ الإنشاء</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenseTypes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      لا توجد أنواع مصاريف محددة بعد
                    </TableCell>
                  </TableRow>
                ) : (
                  expenseTypes.map((type) => (
                    <TableRow key={type.id}>
                      <TableCell className="font-medium">{type.name}</TableCell>
                      <TableCell>{type.description || "-"}</TableCell>
                      <TableCell>
                        {type.projectId ? (
                          <Badge variant="outline" className="text-xs">
                            {getProjectName(type.projectId)}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            عام (جميع المشاريع)
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={type.isActive ? "default" : "secondary"}>
                          {type.isActive ? "نشط" : "غير نشط"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(type.createdAt)}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(type)}
                        >
                          <Edit2 className="h-4 w-4 ml-1" />
                          تحرير
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* مربع حوار تحرير نوع المصروف */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>تحرير نوع المصروف</DialogTitle>
            <DialogDescription>
              تحرير نوع المصروف وربطه بمشروع محدد أو تركه عام
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>اسم نوع المصروف *</FormLabel>
                    <FormControl>
                      <Input placeholder="مثال: راتب، مصروف عام، وقود" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الوصف</FormLabel>
                    <FormControl>
                      <Textarea placeholder="وصف نوع المصروف..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>المشروع المرتبط</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}
                      value={field.value?.toString() || ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر مشروع (اختياري - سيكون عام إذا لم تختر)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">عام (جميع المشاريع)</SelectItem>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id.toString()}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleCloseDialog}
                >
                  إلغاء
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateExpenseTypeMutation.isPending}
                >
                  {updateExpenseTypeMutation.isPending ? "جاري التحديث..." : "تحديث"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}