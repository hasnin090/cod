import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const loginSchema = z.object({
  email: z.string().email("بريد إلكتروني غير صالح").min(1, "البريد الإلكتروني مطلوب"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const { login, loginWithGoogle } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [shakeAnimation, setShakeAnimation] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: LoginFormValues) => {
    try {
      setIsLoading(true);
      console.log('Login form submitted with:', values);
      
      // تنظيف البيانات
      const ok = await login(values.email.trim(), values.password);
      if (ok === null) {
        // will be handled by onAuthStateChange; just redirect soon
        setTimeout(() => {
          window.location.assign('/?auth=' + new Date().getTime());
        }, 800);
      }
      
    } catch (error) {
      setShakeAnimation(true);
      setTimeout(() => setShakeAnimation(false), 500);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-gray-900 flex flex-col items-center justify-center z-50 transition-opacity duration-300 px-4 py-6">
      <div className="w-full max-w-md">
        {/* إضافة شعار وعنوان البرنامج قبل بطاقة تسجيل الدخول */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex justify-center mb-3 sm:mb-5">
            <img src="/logo.svg" alt="شعار Code-01" className="h-16 sm:h-24 w-auto" />
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold text-primary mb-2 sm:mb-3 drop-shadow-md">Code-01</h1>
          <div className="bg-primary/10 dark:bg-primary/20 rounded-lg py-1.5 sm:py-2 px-4 sm:px-6 inline-block shadow-sm">
            <p className="text-primary dark:text-primary-foreground text-sm sm:text-lg font-bold">نظام المحاسبة المتكامل</p>
          </div>
        </div>
        
        <div className={`bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-8 shadow-xl border border-gray-100 dark:border-slate-700 transition-all ${shakeAnimation ? 'shake' : ''}`}>
          <h2 className="text-gray-800 dark:text-gray-100 text-lg sm:text-2xl font-bold text-center mb-4 sm:mb-6">تسجيل الدخول إلى النظام</h2>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 sm:space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        {...field}
                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base rounded-lg bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 focus:border-primary dark:focus:border-blue-400 text-gray-800 dark:text-gray-100 font-medium outline-none transition-all placeholder:text-gray-500 dark:placeholder:text-gray-400"
                        placeholder="البريد الإلكتروني"
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage className="text-red-600 text-xs sm:text-sm font-medium" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base rounded-lg bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 focus:border-primary dark:focus:border-blue-400 text-gray-800 dark:text-gray-100 font-medium outline-none transition-all placeholder:text-gray-500 dark:placeholder:text-gray-400"
                        placeholder="كلمة المرور"
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage className="text-red-600 text-xs sm:text-sm font-medium" />
                  </FormItem>
                )}
              />
              
              <Button
                type="submit"
                className="w-full py-2.5 sm:py-3 mt-4 sm:mt-5 text-sm sm:text-base rounded-lg bg-gradient-to-r from-primary to-primary-light text-white font-bold transition-all hover:shadow-lg transform hover:-translate-y-0.5 active:translate-y-0"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="spinner mr-2"></span>
                    جاري تسجيل الدخول...
                  </>
                ) : "دخول"}
              </Button>
              
              <div className="mt-4 sm:mt-6">
                <Separator className="my-3 sm:my-4">
                  <span className="px-2 text-xs sm:text-sm text-muted-foreground">أو</span>
                </Separator>
                
                <Button
                  type="button"
                  variant="outline"
                  className="w-full py-2.5 sm:py-3 mt-2 sm:mt-3 text-xs sm:text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-600 hover:border-gray-400 dark:hover:border-slate-500 transition-colors"
                  onClick={async () => {
                    try {
                      setIsLoading(true);
                      await loginWithGoogle();
                    } catch (error) {
                      console.error('Google login error:', error);
                      setShakeAnimation(true);
                      setTimeout(() => setShakeAnimation(false), 500);
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  disabled={isLoading}
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 ml-2" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z"
                    />
                  </svg>
                  تسجيل الدخول باستخدام جوجل
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
      
      {/* إضافة حقوق الملكية في أسفل الصفحة */}
      <div className="mt-4 sm:mt-8 text-center">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          جميع الحقوق محفوظة &copy; {new Date().getFullYear()} Code-01
        </p>
      </div>
    </div>
  );
}
