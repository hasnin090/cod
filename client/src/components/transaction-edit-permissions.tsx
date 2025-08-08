import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Shield, Timer } from 'lucide-react';
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

interface TransactionEditPermissionToggleProps {
  userId: number;
}

export function TransactionEditPermissionToggle({ userId }: TransactionEditPermissionToggleProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  // جلب حالة الصلاحية للمستخدم
  const { data: userPermissions = [], refetch: refetchUserPermissions } = useQuery<TransactionEditPermission[]>({
    queryKey: [`/api/transaction-edit-permissions/user/${userId}`],
    enabled: !!userId,
  });

  // التحقق من وجود صلاحية نشطة
  const hasActivePermission = userPermissions.some(p => p.isActive);
  const activePermission = userPermissions.find(p => p.isActive);

  // تبديل الصلاحية (منح أو إلغاء)
  const togglePermissionMutation = useMutation({
    mutationFn: async () => {
      if (hasActivePermission && activePermission) {
        // إلغاء الصلاحية الحالية
        return apiRequest(`/api/transaction-edit-permissions/${activePermission.id}`, 'DELETE');
      } else {
        // منح صلاحية جديدة
        return apiRequest('/api/transaction-edit-permissions', 'POST', { 
          userId,
          reason: "تفعيل صلاحية تعديل المعاملات",
        });
      }
    },
    onSuccess: () => {
      const wasActive = hasActivePermission;
      toast({
        title: "تم التحديث",
        description: wasActive ? "تم إلغاء صلاحية تعديل المعاملات" : "تم تفعيل صلاحية تعديل المعاملات (تنتهي خلال 42 ساعة)",
        className: "bg-green-50 border-green-200 text-green-800",
      });
      refetchUserPermissions();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: error.message || "فشل في تحديث الصلاحية",
      });
    },
  });

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
    <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-800 dark:to-blue-900 p-4 rounded-lg border border-blue-200 dark:border-blue-700 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <Label 
            htmlFor={`transaction-edit-${userId}`}
            className="text-sm font-medium text-blue-800 dark:text-blue-200 cursor-pointer"
          >
            تعديل المعاملات (مؤقت)
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id={`transaction-edit-${userId}`}
            checked={hasActivePermission}
            onCheckedChange={() => !togglePermissionMutation.isPending && togglePermissionMutation.mutate()}
            disabled={togglePermissionMutation.isPending}
            className="h-4 w-4 border-2 border-blue-300 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600 data-[state=checked]:text-white"
          />
          {hasActivePermission && activePermission && (
            <Badge className="text-xs bg-green-100 text-green-800 border-green-200">
              نشط
            </Badge>
          )}
          {togglePermissionMutation.isPending && (
            <Badge variant="outline" className="text-xs">
              جاري التحديث...
            </Badge>
          )}
        </div>
      </div>

      {/* عرض الوقت المتبقي إذا كانت الصلاحية نشطة */}
      {hasActivePermission && activePermission && (
        <div className="flex items-center gap-2 text-xs text-green-700 bg-green-100 dark:bg-green-900/30 p-2 rounded">
          <Timer className="h-3 w-3" />
          <span className="font-medium">{getRemainingTime(activePermission.expiresAt)}</span>
        </div>
      )}

      {/* معلومة بسيطة */}
      {!hasActivePermission && (
        <p className="text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 p-2 rounded">
          تنتهي الصلاحية تلقائياً بعد 42 ساعة من التفعيل
        </p>
      )}
    </div>
  );
}