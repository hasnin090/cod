import * as React from 'react';
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
import { Clock, User, Building, CheckCircle, XCircle, Shield, Plus, Trash2, Timer } from 'lucide-react';
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

interface User {
  id: number;
  name: string;
  username: string;
  role: string;
}

interface Project {
  id: number;
  name: string;
  description: string;
}

function TransactionPermissionsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isGrantDialogOpen, setIsGrantDialogOpen] = useState(false);
  const [permissionType, setPermissionType] = useState<'user' | 'project'>('user');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  // جلب الصلاحيات النشطة
  const { data: permissions = [], refetch: refetchPermissions, isLoading } = useQuery<TransactionEditPermission[]>({
    queryKey: ['/api/transaction-edit-permissions'],
    enabled: user?.role === 'admin',
  });

  // جلب المستخدمين والمشاريع للاختيار
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
    enabled: user?.role === 'admin',
  });

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
      refetchPermissions();
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
      refetchPermissions();
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
    setSelectedUserId('');
    setSelectedProjectId('');
    setReason('');
    setNotes('');
  };

  const handleGrantPermission = () => {
    const data: any = { reason, notes };
    
    if (permissionType === 'user' && selectedUserId) {
      data.userId = parseInt(selectedUserId);
    } else if (permissionType === 'project' && selectedProjectId) {
      data.projectId = parseInt(selectedProjectId);
    } else {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: "يرجى اختيار مستخدم أو مشروع",
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

  if (user?.role !== 'admin') {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              غير مصرح
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>هذه الصفحة متاحة للمديرين فقط.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">صلاحيات تعديل المعاملات</h1>
          <p className="text-muted-foreground mt-2">
            إدارة الصلاحيات المؤقتة لتعديل المعاملات المالية للمستخدمين والمشاريع
          </p>
        </div>

        <Dialog open={isGrantDialogOpen} onOpenChange={setIsGrantDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              منح صلاحية جديدة
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>منح صلاحية تعديل المعاملات</DialogTitle>
              <DialogDescription>
                منح صلاحية مؤقتة (42 ساعة) لتعديل المعاملات المالية
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
                        مستخدم محدد
                      </div>
                    </SelectItem>
                    <SelectItem value="project">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4" />
                        مشروع محدد
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {permissionType === 'user' && (
                <div>
                  <Label>اختر المستخدم</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر مستخدم" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map(user => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          <div className="flex items-center gap-2">
                            <span>{user.name}</span>
                            <Badge variant="outline">{user.role}</Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            الصلاحيات النشطة ({permissions.length})
          </CardTitle>
          <CardDescription>
            الصلاحيات المؤقتة النشطة حالياً لتعديل المعاملات المالية
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>جاري التحميل...</p>
          ) : permissions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              لا توجد صلاحيات نشطة حالياً
            </p>
          ) : (
            <div className="space-y-4">
              {permissions.map((permission) => (
                <Card key={permission.id} className="border-l-4 border-l-green-500">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          {permission.userId ? (
                            <>
                              <User className="h-4 w-4 text-blue-500" />
                              <span className="font-medium">المستخدم: {permission.userName}</span>
                            </>
                          ) : (
                            <>
                              <Building className="h-4 w-4 text-purple-500" />
                              <span className="font-medium">المشروع: {permission.projectName}</span>
                            </>
                          )}
                          <Badge variant="secondary">نشط</Badge>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            <span>منح في: {format(new Date(permission.grantedAt), 'yyyy/MM/dd HH:mm')}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Timer className="h-3 w-3" />
                            <span>{getRemainingTime(permission.expiresAt)}</span>
                          </div>
                        </div>

                        {permission.reason && (
                          <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm">
                            <strong>السبب:</strong> {permission.reason}
                          </div>
                        )}

                        {permission.notes && (
                          <div className="p-2 bg-blue-50 dark:bg-blue-900 rounded text-sm">
                            <strong>ملاحظات:</strong> {permission.notes}
                          </div>
                        )}
                      </div>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>إلغاء الصلاحية</AlertDialogTitle>
                            <AlertDialogDescription>
                              هل أنت متأكد من إلغاء هذه الصلاحية؟ لن يتمكن {permission.userId ? permission.userName : `مستخدمو مشروع ${permission.projectName}`} من تعديل المعاملات بعد الآن.
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* معلومات عامة */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            معلومات هامة
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5"></div>
            <p>الصلاحيات تنتهي تلقائياً بعد 42 ساعة من منحها</p>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5"></div>
            <p>يمكن إلغاء الصلاحيات يدوياً في أي وقت من قبل المدير</p>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5"></div>
            <p>لا يمكن منح نفس الصلاحية للمستخدم أو المشروع أكثر من مرة في نفس الوقت</p>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5"></div>
            <p>جميع العمليات تُسجل في سجل الأنشطة للمراجعة</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default TransactionPermissionsPage;