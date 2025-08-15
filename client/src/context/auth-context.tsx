import React, { 
  createContext, 
  useContext,
  useState, 
  useEffect, 
  ReactNode 
} from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { getSupabase } from '@/lib/supabase';

interface User {
  id: number;
  username: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User | null>;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: false, // Changed to false to avoid infinite loading state
  login: async () => null,
  loginWithGoogle: async () => {},
  logout: () => {},
});

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false); // Changed to false
  const { toast } = useToast();

  // تحقق من جلسة المستخدم مرة واحدة فقط عند تحميل التطبيق
  useEffect(() => {
    let isMounted = true;
    
    const checkSession = async () => {
      if (!isMounted) return;
      
      try {
        setIsLoading(true);
        
        // تحقق من صحة الجلسة مع الخادم دائماً
        try {
          const response = await fetch('/api/auth/session', {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
          });
          
          if (!isMounted) return;
          
          if (response.ok) {
            const userData = await response.json();
            setUser(userData);
            localStorage.setItem('auth_user', JSON.stringify(userData));
          } else {
            // الجلسة منتهية أو غير صحيحة
            setUser(null);
            localStorage.removeItem('auth_user');
            
            // إعادة التوجيه إلى صفحة تسجيل الدخول إذا لم نكن بها بالفعل
            if (response.status === 401 && window.location.pathname !== '/login') {
              window.location.href = '/login';
            }
          }
        } catch (error) {
          if (isMounted) {
            setUser(null);
            localStorage.removeItem('auth_user');
          }
        }
      } catch (error) {
        if (isMounted) {
          setUser(null);
          localStorage.removeItem('auth_user');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    checkSession();
    
    // فحص دوري للجلسة كل 5 دقائق
    const intervalId = setInterval(async () => {
      if (!isMounted) return;
      
      try {
        const response = await fetch('/api/auth/session', {
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok && response.status === 401) {
          // الجلسة انتهت
          setUser(null);
          localStorage.removeItem('auth_user');
          
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
      } catch (error) {
        console.error('Session check failed:', error);
      }
    }, 5 * 60 * 1000); // كل 5 دقائق
    
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  // استمع لتغييرات مصادقة Supabase
  useEffect(() => {
  const supabase = getSupabase();
  const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        setIsLoading(true);
        if (session?.access_token) {
          // أبلغ الخادم بالتوكن لتثبيت الجلسة السيرفرية
          const response = await fetch('/api/auth/supabase-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ token: session.access_token }),
          });
          if (response.ok) {
            const userData = await response.json();
            setUser(userData);
            localStorage.setItem('auth_user', JSON.stringify(userData));
          } else {
            setUser(null);
            localStorage.removeItem('auth_user');
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          localStorage.removeItem('auth_user');
        }
      } finally {
        setIsLoading(false);
      }
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<User | null> => {
    try {
      setIsLoading(true);
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // سيتم إطلاق onAuthStateChange ومعه سننشئ جلسة على الخادم ونحدد user
      
      // إظهار رسالة النجاح
      toast({
        title: "تم تسجيل الدخول بنجاح",
        description: `مرحباً بك`,
      });
      return null;
    } catch (error: any) {
      console.error('Login error:', error);
      const message = error.message || 'خطأ في تسجيل الدخول';
      toast({
        variant: "destructive",
        title: "فشل تسجيل الدخول",
        description: message,
      });
      // نرجع قيمة فارغة في حالة الخطأ
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // إضافة تسجيل الدخول باستخدام جوجل
  const loginWithGoogle = async () => {
    try {
      setIsLoading(true);
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
  if (error) throw error;
      
      toast({
        title: "جاري تسجيل الدخول بواسطة Google",
        description: "يرجى الانتظار...",
      });
    } catch (error: any) {
      console.error('Google login error:', error);
      const message = error.message || 'خطأ في تسجيل الدخول باستخدام Google';
      toast({
        variant: "destructive",
        title: "فشل تسجيل الدخول",
        description: message,
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      
  const supabase = getSupabase();
  await supabase.auth.signOut();
      
      // إزالة بيانات المستخدم من التخزين المحلي
      localStorage.removeItem('auth_user');
      
      try {
        // تسجيل الخروج من API
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include'
        });
      } catch (apiError) {
        console.error('API logout error:', apiError);
        // نستمر حتى مع وجود خطأ
      }
      
      // تحديث حالة المستخدم في التطبيق
      setUser(null);
      
      // إظهار رسالة النجاح
      toast({
        title: "تم تسجيل الخروج بنجاح",
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
