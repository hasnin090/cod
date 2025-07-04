import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { 
  Cloud, 
  Database, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Upload,
  Settings,
  RefreshCw,
  Shield,
  AlertCircle
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";

interface StorageProvider {
  name: string;
  displayName: string;
  icon: JSX.Element;
  color: string;
}

interface StorageStatus {
  preferred: string;
  available: string[];
  healthCheck: Record<string, boolean>;
}

interface FirebaseHealth {
  initialized: boolean;
  auth: boolean;
  storage: boolean;
}

interface SupabaseHealth {
  client: boolean;
  database: boolean;
  storage: boolean;
  lastCheck: string;
  message?: string;
  error?: string;
}

const storageProviders: Record<string, StorageProvider> = {
  local: {
    name: 'local',
    displayName: 'التخزين المحلي',
    icon: <Database className="h-4 w-4" />,
    color: 'bg-blue-500'
  },
  firebase: {
    name: 'firebase',
    displayName: 'Firebase',
    icon: <Cloud className="h-4 w-4" />,
    color: 'bg-orange-500'
  },
  supabase: {
    name: 'supabase',
    displayName: 'Supabase',
    icon: <Shield className="h-4 w-4" />,
    color: 'bg-green-500'
  }
};

export default function HybridStorageManagement() {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [targetProviders, setTargetProviders] = useState<string[]>(['local', 'firebase', 'supabase']);
  const { toast } = useToast();

  // جلب حالة التخزين مع تحديث دوري
  const { data: storageStatus, refetch: refetchStorage } = useQuery({
    queryKey: ['/api/storage/status'],
    enabled: true,
    refetchInterval: 10000, // تحديث كل 10 ثوانٍ
    staleTime: 5000 // البيانات صالحة لمدة 5 ثوانٍ
  });

  // جلب حالة Firebase
  const { data: firebaseHealth, refetch: refetchFirebase } = useQuery({
    queryKey: ['/api/firebase/health'],
    enabled: true,
    refetchInterval: 15000, // تحديث كل 15 ثانية
    staleTime: 10000
  });

  // جلب حالة Supabase
  const { data: supabaseHealth, refetch: refetchSupabase } = useQuery({
    queryKey: ['/api/supabase/health'],
    enabled: true,
    refetchInterval: 15000, // تحديث كل 15 ثانية
    staleTime: 10000
  });

  const refreshAllData = () => {
    console.log('🔄 تحديث بيانات التخزين...');
    refetchStorage();
    refetchFirebase();
    refetchSupabase();
    
    // إجبار إعادة تحميل بيانات الاستعلام
    queryClient.invalidateQueries({ queryKey: ['/api/storage/status'] });
    queryClient.invalidateQueries({ queryKey: ['/api/firebase/health'] });
    queryClient.invalidateQueries({ queryKey: ['/api/supabase/health'] });
  };

  const initializeFirebase = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest('/api/firebase/init', 'POST');
      
      if (response.success) {
        toast({
          title: "نجح الإعداد",
          description: "تم تهيئة Firebase بنجاح"
        });
        refreshAllData();
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "فشل الإعداد",
        description: error.message || "فشل في تهيئة Firebase"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const initializeSupabase = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest('/api/supabase/init', 'POST');
      
      if (response.success) {
        toast({
          title: "نجح الإعداد",
          description: "تم تهيئة Supabase بنجاح"
        });
        refreshAllData();
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "فشل الإعداد",
        description: error.message || "فشل في تهيئة Supabase"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const setPreferredProvider = async (provider: string) => {
    setIsLoading(true);
    try {
      // التحقق من حالة المزود قبل التبديل
      const isHealthy = storageStatus?.status?.healthCheck?.[provider] || provider === 'local';
      
      if (!isHealthy) {
        toast({
          variant: "destructive",
          title: "مزود التخزين غير متاح",
          description: `${storageProviders[provider].displayName} غير متاح حالياً`
        });
        return;
      }

      const response = await apiRequest('/api/storage/set-preferred', 'POST', { provider });
      
      if (response.success) {
        toast({
          title: "تم التغيير",
          description: `تم تعيين ${storageProviders[provider].displayName} كمزود تخزين أساسي`
        });
        
        // تحديث البيانات بعد فترة قصيرة للسماح للنظام بالتحديث
        setTimeout(() => {
          refreshAllData();
        }, 2000);
        
        // تحديث إضافي بعد فترة أطول للتأكد من تحديث الحالة
        setTimeout(() => {
          refreshAllData();
        }, 5000);
      } else {
        throw new Error(response.message || "فشل في تغيير مزود التخزين");
      }
    } catch (error: any) {
      console.error("خطأ في تغيير مزود التخزين:", error);
      toast({
        variant: "destructive",
        title: "فشل التغيير",
        description: error.message || "فشل في تغيير مزود التخزين"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const syncFileAcrossProviders = async () => {
    if (!selectedFile) {
      toast({
        variant: "destructive",
        title: "لم يتم تحديد ملف",
        description: "يرجى تحديد ملف للمزامنة"
      });
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('targetProviders', JSON.stringify(targetProviders));

      const response = await fetch('/api/storage/sync-file', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "تمت المزامنة",
          description: data.message
        });
        setSelectedFile(null);
      } else {
        throw new Error(data.message);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "فشلت المزامنة",
        description: error.message || "فشل في مزامنة الملف"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getHealthIcon = (isHealthy: boolean) => {
    return isHealthy ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const getHealthBadge = (isHealthy: boolean) => {
    return (
      <Badge variant={isHealthy ? "default" : "destructive"}>
        {isHealthy ? "متاح" : "غير متاح"}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">إدارة التخزين الهجين</h1>
          <p className="text-muted-foreground">
            إدارة وتكوين مزودي التخزين: المحلي، Firebase، و Supabase
          </p>
        </div>
        <Button onClick={refreshAllData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          تحديث البيانات
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
          <TabsTrigger value="firebase">Firebase</TabsTrigger>
          <TabsTrigger value="supabase">Supabase</TabsTrigger>
          <TabsTrigger value="sync">مزامنة الملفات</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.values(storageProviders).map((provider) => {
              const isHealthy = storageStatus?.status?.healthCheck?.[provider.name] || false;
              const isPreferred = storageStatus?.status?.preferred === provider.name;
              
              return (
                <Card key={provider.name} className={`${isPreferred ? 'ring-2 ring-primary' : ''}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className={`p-2 rounded-lg ${provider.color} text-white`}>
                          {provider.icon}
                        </div>
                        <CardTitle className="text-lg">{provider.displayName}</CardTitle>
                      </div>
                      {getHealthIcon(isHealthy)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span>الحالة:</span>
                      {getHealthBadge(isHealthy)}
                    </div>
                    {isPreferred && (
                      <Badge variant="outline" className="w-full justify-center">
                        المزود الأساسي
                      </Badge>
                    )}
                    {isHealthy && !isPreferred && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="w-full"
                        onClick={() => setPreferredProvider(provider.name)}
                        disabled={isLoading}
                        title={`تعيين ${provider.displayName} كمزود تخزين أساسي`}
                      >
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
                        تعيين كأساسي
                      </Button>
                    )}
                    
                    {!isHealthy && provider.name !== 'local' && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="w-full opacity-50 cursor-not-allowed"
                        disabled
                      >
                        غير متاح
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {storageStatus?.status && (
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                المزود الأساسي: <strong>{storageProviders[storageStatus.status.preferred]?.displayName}</strong> | 
                المزودات المتاحة: <strong>{storageStatus.status.available.length}</strong> من أصل 3
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="firebase" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Cloud className="h-5 w-5 text-orange-500" />
                <span>حالة Firebase</span>
              </CardTitle>
              <CardDescription>
                إدارة وفحص حالة خدمات Firebase
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {firebaseHealth?.health ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex justify-between items-center p-3 border rounded">
                    <span>التهيئة:</span>
                    {getHealthBadge(firebaseHealth.health.initialized)}
                  </div>
                  <div className="flex justify-between items-center p-3 border rounded">
                    <span>المصادقة:</span>
                    {getHealthBadge(firebaseHealth.health.auth)}
                  </div>
                  <div className="flex justify-between items-center p-3 border rounded">
                    <span>التخزين:</span>
                    {getHealthBadge(firebaseHealth.health.storage)}
                  </div>
                </div>
              ) : (
                <Alert>
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    Firebase غير مكون. يرجى التأكد من إعداد متغيرات البيئة المطلوبة.
                  </AlertDescription>
                </Alert>
              )}
              
              <Button 
                onClick={initializeFirebase}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Settings className="h-4 w-4 mr-2" />}
                تهيئة Firebase
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="supabase" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5 text-green-500" />
                <span>حالة Supabase</span>
              </CardTitle>
              <CardDescription>
                إدارة وفحص حالة خدمات Supabase
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {supabaseHealth ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex justify-between items-center p-3 border rounded">
                      <span>العميل:</span>
                      {getHealthBadge(supabaseHealth.client)}
                    </div>
                    <div className="flex justify-between items-center p-3 border rounded">
                      <span>قاعدة البيانات:</span>
                      {getHealthBadge(supabaseHealth.database)}
                    </div>
                    <div className="flex justify-between items-center p-3 border rounded">
                      <span>التخزين:</span>
                      {getHealthBadge(supabaseHealth.storage)}
                    </div>
                  </div>
                  {supabaseHealth.message && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {supabaseHealth.message}
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="text-sm text-muted-foreground">
                    آخر فحص: {new Date(supabaseHealth.lastCheck).toLocaleString('ar-SA')}
                  </div>
                </div>
              ) : (
                <Alert>
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    جاري تحميل حالة Supabase...
                  </AlertDescription>
                </Alert>
              )}
              
              <Button 
                onClick={initializeSupabase}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Settings className="h-4 w-4 mr-2" />}
                تهيئة Supabase
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sync" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <RefreshCw className="h-5 w-5" />
                <span>مزامنة الملفات</span>
              </CardTitle>
              <CardDescription>
                رفع ملف ومزامنته عبر مزودات التخزين المختلفة
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  اختيار الملف:
                </label>
                <input
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-primary file:text-primary-foreground
                    hover:file:bg-primary/90"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  مزودات التخزين المستهدفة:
                </label>
                <div className="space-y-2">
                  {Object.values(storageProviders).map((provider) => (
                    <label key={provider.name} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={targetProviders.includes(provider.name)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setTargetProviders([...targetProviders, provider.name]);
                          } else {
                            setTargetProviders(targetProviders.filter(p => p !== provider.name));
                          }
                        }}
                        className="rounded"
                      />
                      <div className="flex items-center space-x-2">
                        <div className={`p-1 rounded ${provider.color} text-white`}>
                          {provider.icon}
                        </div>
                        <span>{provider.displayName}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <Button 
                onClick={syncFileAcrossProviders}
                disabled={isLoading || !selectedFile || targetProviders.length === 0}
                className="w-full"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                مزامنة الملف
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}