import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Clock, User, Building, CheckCircle, XCircle, Shield, Plus, Trash2, Timer, Edit } from 'lucide-react';
import { format } from 'date-fns';

interface TransactionEditPermission {
  id: number;
  userId?: number;
  projectId?: number;
  grantedBy: number;
  grantedAt: string;
  expiresAt: string;
  isActive: boolean;
  revokedBy?: number;
  revokedAt?: string;
  reason?: string;
  notes?: string;
  grantedByName?: string;
  userName?: string;
  projectName?: string;
}

interface Project {
  id: number;
  name: string;
  description: string;
}

interface TransactionEditPermissionsProps {
  userId: number;
  userName: string;
}

export function TransactionEditPermissions({ userId, userName }: TransactionEditPermissionsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isGrantDialogOpen, setIsGrantDialogOpen] = useState(false);
  const [permissionType, setPermissionType] = useState<'user' | 'project'>('user');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  // جلب الصلاحيات النشطة للمستخدم
  const { data: userPermissions = [], refetch: refetchUserPermissions } = useQuery<TransactionEditPermission[]>({
    queryKey: [`/api/transaction-edit-permissions/user/${userId}`],
    enabled: !!userId,
  });

  // جلب المشاريع للاختيار
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
    enabled: user?.role === 'admin',
  });

  // منح صلاحية جديدة
  const grantPermissionMutation = useMutation({
    mutationFn: async (data: { userId?: number; projectId?: number; reason?: string; notes?: string }) => {
      return apiRequest('/api/transaction-edit-permissions', 'POST', data);
    },
    onSuccess: () => {
      toast({
        title: "تم بنجاح",
        description: "تم منح صلاحية تعديل المعاملات",
      });
      refetchUserPermissions();
      setIsGrantDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: error.message || "فشل في منح الصلاحية",
      });
    },
  });

  // إلغاء صلاحية
  const revokePermissionMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/transaction-edit-permissions/${id}`, 'DELETE');
    },
    onSuccess: () => {
      toast({
        title: "تم بنجاح",
        description: "تم إلغاء صلاحية تعديل المعاملات",
      });
      refetchUserPermissions();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: error.message || "فشل في إلغاء الصلاحية",
      });
    },
  });

  const resetForm = () => {
    setPermissionType('user');
    setSelectedProjectId('');
    setReason('');
    setNotes('');
  };

  const handleGrantPermission = () => {
    const data: any = { reason, notes };
    
    if (permissionType === 'user') {
      data.userId = userId;
    } else if (permissionType === 'project' && selectedProjectId) {
      data.projectId = parseInt(selectedProjectId);
    } else {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: "يرجى اختيار مشروع عند اختيار النوع مشروع محدد",
      });
      return;
    }

    grantPermissionMutation.mutate(data);
  };

  const getRemainingTime = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffInHours = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours <= 0) return 'منتهية الصلاحية';
    if (diffInHours === 1) return 'ساعة واحدة متبقية';
    if (diffInHours <= 24) return `${diffInHours} ساعة متبقية`;
    const days = Math.ceil(diffInHours / 24);
    return `${days} ${days === 1 ? 'يوم' : 'أيام'} متبقية`;
  };

  // إظهار هذا الجزء فقط للمديرين
  if (user?.role !== 'admin') {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-800 dark:to-purple-900 p-6 rounded-xl border border-purple-200 dark:border-purple-700 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          <h3 className="text-lg font-semibold text-purple-800 dark:text-purple-200">
            صلاحيات تعديل المعاملات
          </h3>
        </div>

        <Dialog open={isGrantDialogOpen} onOpenChange={setIsGrantDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              منح صلاحية
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>منح صلاحية تعديل المعاملات</DialogTitle>
              <DialogDescription>
                منح صلاحية مؤقتة (42 ساعة) لـ {userName}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>نوع الصلاحية</Label>
                <Select value={permissionType} onValueChange={(value: 'user' | 'project') => setPermissionType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        صلاحية عامة للمستخدم
                      </div>
                    </SelectItem>
                    <SelectItem value="project">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4" />
                        صلاحية مشروع محدد
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {permissionType === 'project' && (
                <div>
                  <Label>اختر المشروع</Label>
                  <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر مشروع" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map(project => (
                        <SelectItem key={project.id} value={project.id.toString()}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label>سبب منح الصلاحية (اختياري)</Label>
                <Input
                  placeholder="مثال: تعديل معاملة خاطئة"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              <div>
                <Label>ملاحظات إضافية (اختياري)</Label>
                <Textarea
                  placeholder="أي ملاحظات أو تفاصيل إضافية"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsGrantDialogOpen(false)}>
                إلغاء
              </Button>
              <Button onClick={handleGrantPermission} disabled={grantPermissionMutation.isPending}>
                {grantPermissionMutation.isPending ? 'جاري المنح...' : 'منح الصلاحية'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* الصلاحيات النشطة */}
      <div className="space-y-3">
        {userPermissions.filter(p => p.isActive).length === 0 ? (
          <p className="text-sm text-purple-600 dark:text-purple-400 text-center py-4">
            لا توجد صلاحيات نشطة حالياً
          </p>
        ) : (
          userPermissions.filter(p => p.isActive).map((permission) => (
            <Card key={permission.id} className="border-l-4 border-l-purple-500 bg-white dark:bg-gray-800">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      {permission.userId ? (
                        <>
                          <User className="h-4 w-4 text-blue-500" />
                          <span className="font-medium text-sm">صلاحية عامة</span>
                        </>
                      ) : (
                        <>
                          <Building className="h-4 w-4 text-purple-500" />
                          <span className="font-medium text-sm">المشروع: {permission.projectName}</span>
                        </>
                      )}
                      <Badge variant="secondary" className="text-xs">نشط</Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>منح: {format(new Date(permission.grantedAt), 'yyyy/MM/dd HH:mm')}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Timer className="h-3 w-3" />
                        <span>{getRemainingTime(permission.expiresAt)}</span>
                      </div>
                    </div>

                    {permission.reason && (
                      <div className="p-2 bg-purple-50 dark:bg-purple-900 rounded text-xs">
                        <strong>السبب:</strong> {permission.reason}
                      </div>
                    )}
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>إلغاء الصلاحية</AlertDialogTitle>
                        <AlertDialogDescription>
                          هل أنت متأكد من إلغاء هذه الصلاحية؟ لن يتمكن {userName} من تعديل المعاملات بعد الآن.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => revokePermissionMutation.mutate(permission.id)}
                          disabled={revokePermissionMutation.isPending}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {revokePermissionMutation.isPending ? 'جاري الإلغاء...' : 'إلغاء الصلاحية'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* معلومات مفيدة */}
      <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-lg text-xs text-purple-700 dark:text-purple-300">
        <p className="font-medium mb-1">معلومات هامة:</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>الصلاحيات تنتهي تلقائياً بعد 42 ساعة</li>
          <li>يمكن إلغاء الصلاحيات يدوياً في أي وقت</li>
          <li>جميع العمليات تُسجل في سجل الأنشطة</li>
        </ul>
      </div>
    </div>
  );
}