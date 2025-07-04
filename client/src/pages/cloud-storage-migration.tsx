import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Cloud, 
  HardDrive, 
  Shield, 
  ArrowRight, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw,
  Database,
  FileText,
  Download
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

export default function CloudStorageMigration() {
  const [migrationStep, setMigrationStep] = useState<'verify' | 'backup' | 'migrate' | 'complete'>('verify');
  const [migrationProgress, setMigrationProgress] = useState(0);
  const queryClient = useQueryClient();

  // فحص البيانات الحالية
  const { data: verificationData, isLoading: isVerifying, refetch: refetchVerification } = useQuery({
    queryKey: ['/api/migration/verify'],
    enabled: migrationStep === 'verify'
  });

  // إنشاء نسخة احتياطية
  const backupMutation = useMutation({
    mutationFn: () => apiRequest('/api/migration/backup', { method: 'POST' }),
    onSuccess: () => {
      setMigrationStep('migrate');
      queryClient.invalidateQueries({ queryKey: ['/api/migration'] });
    }
  });

  // تنفيذ الانتقال
  const migrationMutation = useMutation({
    mutationFn: () => apiRequest('/api/migration/to-cloud', { method: 'POST' }),
    onSuccess: (data) => {
      setMigrationStep('complete');
      setMigrationProgress(100);
      queryClient.invalidateQueries({ queryKey: ['/api/storage'] });
    }
  });

  // حالة التخزين السحابي
  const { data: storageHealth } = useQuery({
    queryKey: ['/api/supabase/health']
  });

  const handleStartMigration = () => {
    setMigrationStep('backup');
    backupMutation.mutate();
  };

  const handleExecuteMigration = () => {
    migrationMutation.mutate();
  };

  const isSupabaseReady = storageHealth?.client && storageHealth?.storage;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" dir="rtl">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">الانتقال للتخزين السحابي</h1>
        <p className="text-gray-600">
          انتقال آمن من التخزين المحلي إلى التخزين السحابي مع حماية جميع العمليات الحالية
        </p>
      </div>

      {/* حالة النظام */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <HardDrive className="w-4 h-4 text-blue-600" />
            <CardTitle className="text-sm font-medium mr-2">التخزين المحلي</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">نشط</div>
            <p className="text-xs text-gray-600">النظام الحالي</p>
            {verificationData?.success && (
              <div className="mt-2 space-y-1 text-sm">
                <div>المعاملات: {verificationData.stats.transactions}</div>
                <div>الوثائق: {verificationData.stats.documents}</div>
                <div>الملفات المرفقة: {verificationData.stats.filesWithAttachments}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <Cloud className="w-4 h-4 text-purple-600" />
            <CardTitle className="text-sm font-medium mr-2">التخزين السحابي</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${isSupabaseReady ? 'text-green-600' : 'text-yellow-600'}`}>
              {isSupabaseReady ? 'جاهز' : 'غير مهيأ'}
            </div>
            <p className="text-xs text-gray-600">
              {isSupabaseReady ? 'متصل ومهيأ' : 'يتطلب إعداد'}
            </p>
            {storageHealth && (
              <div className="mt-2 space-y-1 text-sm">
                <Badge variant={storageHealth.client ? 'default' : 'secondary'}>
                  العميل: {storageHealth.client ? 'متصل' : 'غير متصل'}
                </Badge>
                <Badge variant={storageHealth.storage ? 'default' : 'secondary'}>
                  التخزين: {storageHealth.storage ? 'متاح' : 'غير متاح'}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* خطوات الانتقال */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="w-5 h-5 text-green-600 ml-2" />
            خطوات الانتقال الآمن
          </CardTitle>
          <CardDescription>
            عملية منظمة لحماية جميع البيانات والملفات أثناء الانتقال
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* الخطوة 1: فحص البيانات */}
          <div className={`flex items-center space-x-3 p-3 rounded-lg ${
            migrationStep === 'verify' ? 'bg-blue-50 border border-blue-200' : 
            ['backup', 'migrate', 'complete'].includes(migrationStep) ? 'bg-green-50 border border-green-200' : 
            'bg-gray-50'
          }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              migrationStep === 'verify' ? 'bg-blue-600 text-white' : 
              ['backup', 'migrate', 'complete'].includes(migrationStep) ? 'bg-green-600 text-white' : 
              'bg-gray-300'
            }`}>
              {['backup', 'migrate', 'complete'].includes(migrationStep) ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <Database className="w-4 h-4" />
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-medium">فحص وتحقق من البيانات</h3>
              <p className="text-sm text-gray-600">التحقق من سلامة العمليات الحالية</p>
              {isVerifying && <p className="text-sm text-blue-600">جاري الفحص...</p>}
              {verificationData?.success && (
                <p className="text-sm text-green-600">
                  تم التحقق من {verificationData.stats.transactions} معاملة و {verificationData.stats.documents} وثيقة
                </p>
              )}
            </div>
            {migrationStep === 'verify' && (
              <Button 
                onClick={() => refetchVerification()} 
                disabled={isVerifying}
                size="sm"
              >
                <RefreshCw className={`w-4 h-4 ml-1 ${isVerifying ? 'animate-spin' : ''}`} />
                فحص
              </Button>
            )}
          </div>

          {/* الخطوة 2: النسخة الاحتياطية */}
          <div className={`flex items-center space-x-3 p-3 rounded-lg ${
            migrationStep === 'backup' ? 'bg-blue-50 border border-blue-200' : 
            ['migrate', 'complete'].includes(migrationStep) ? 'bg-green-50 border border-green-200' : 
            'bg-gray-50'
          }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              migrationStep === 'backup' ? 'bg-blue-600 text-white' : 
              ['migrate', 'complete'].includes(migrationStep) ? 'bg-green-600 text-white' : 
              'bg-gray-300'
            }`}>
              {['migrate', 'complete'].includes(migrationStep) ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <Download className="w-4 h-4" />
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-medium">إنشاء نسخة احتياطية كاملة</h3>
              <p className="text-sm text-gray-600">حفظ نسخة آمنة من جميع البيانات</p>
              {backupMutation.isPending && (
                <p className="text-sm text-blue-600">جاري إنشاء النسخة الاحتياطية...</p>
              )}
              {backupMutation.isSuccess && (
                <p className="text-sm text-green-600">تم إنشاء النسخة الاحتياطية بنجاح</p>
              )}
            </div>
          </div>

          {/* الخطوة 3: تنفيذ الانتقال */}
          <div className={`flex items-center space-x-3 p-3 rounded-lg ${
            migrationStep === 'migrate' ? 'bg-blue-50 border border-blue-200' : 
            migrationStep === 'complete' ? 'bg-green-50 border border-green-200' : 
            'bg-gray-50'
          }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              migrationStep === 'migrate' ? 'bg-blue-600 text-white' : 
              migrationStep === 'complete' ? 'bg-green-600 text-white' : 
              'bg-gray-300'
            }`}>
              {migrationStep === 'complete' ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-medium">انتقال الملفات للسحابة</h3>
              <p className="text-sm text-gray-600">نقل جميع الملفات مع الاحتفاظ بنسخ محلية</p>
              {migrationMutation.isPending && (
                <div className="space-y-2">
                  <p className="text-sm text-blue-600">جاري الانتقال...</p>
                  <Progress value={migrationProgress} className="w-full" />
                </div>
              )}
              {migrationMutation.isSuccess && (
                <p className="text-sm text-green-600">
                  تم الانتقال بنجاح: {migrationMutation.data?.migratedFiles} ملف
                </p>
              )}
            </div>
            {migrationStep === 'migrate' && !migrationMutation.isPending && (
              <Button onClick={handleExecuteMigration} size="sm">
                <Cloud className="w-4 h-4 ml-1" />
                بدء الانتقال
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* التحذيرات والملاحظات */}
      {!isSupabaseReady && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            يجب إعداد التخزين السحابي (Supabase) قبل بدء عملية الانتقال. 
            تأكد من إدخال مفاتيح API الصحيحة في إعدادات النظام.
          </AlertDescription>
        </Alert>
      )}

      {verificationData?.success && migrationStep === 'verify' && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            النظام جاهز للانتقال. تم العثور على {verificationData.stats.transactions} معاملة 
            و {verificationData.stats.filesWithAttachments} ملف مرفق للانتقال.
          </AlertDescription>
        </Alert>
      )}

      {/* أزرار التحكم */}
      <div className="flex justify-center space-x-4">
        {migrationStep === 'verify' && verificationData?.success && isSupabaseReady && (
          <Button 
            onClick={handleStartMigration} 
            disabled={backupMutation.isPending}
            size="lg"
            className="bg-blue-600 hover:bg-blue-700"
          >
            {backupMutation.isPending ? (
              <RefreshCw className="w-4 h-4 ml-2 animate-spin" />
            ) : (
              <Shield className="w-4 h-4 ml-2" />
            )}
            بدء عملية الانتقال الآمن
          </Button>
        )}

        {migrationStep === 'complete' && (
          <div className="text-center space-y-4">
            <div className="text-green-600 font-medium text-lg">
              🎉 تم الانتقال بنجاح!
            </div>
            <p className="text-gray-600">
              النظام يعمل الآن بالتخزين السحابي مع الاحتفاظ بنسخ احتياطية محلية
            </p>
            <Button onClick={() => window.location.reload()}>
              تحديث الصفحة
            </Button>
          </div>
        )}
      </div>

      {/* النتائج التفصيلية */}
      {migrationMutation.isSuccess && migrationMutation.data && (
        <Card>
          <CardHeader>
            <CardTitle>نتائج الانتقال</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {migrationMutation.data.totalFiles}
                </div>
                <div className="text-sm text-gray-600">إجمالي الملفات</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {migrationMutation.data.migratedFiles}
                </div>
                <div className="text-sm text-gray-600">تم الانتقال</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">
                  {migrationMutation.data.failedFiles}
                </div>
                <div className="text-sm text-gray-600">فشل</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {migrationMutation.data.preservedTransactions}
                </div>
                <div className="text-sm text-gray-600">المعاملات المحفوظة</div>
              </div>
            </div>
            
            {migrationMutation.data.errors && migrationMutation.data.errors.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium text-red-600 mb-2">الأخطاء:</h4>
                <div className="space-y-1">
                  {migrationMutation.data.errors.map((error, index) => (
                    <div key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                      {error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}