import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    
    // إذا كانت الاستجابة 401 (غير مصرح)، قم بمسح localStorage وإعادة التوجيه
    if (res.status === 401) {
      localStorage.removeItem('auth_user');
      // إعادة التوجيه إلى صفحة تسجيل الدخول
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest<T = any>(
  url: string,
  method: string,
  data?: unknown | undefined,
): Promise<T> {
  console.log(`Making API request: ${url} ${method}`, data);
  
  try {
    const res = await fetch(url, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });
    
    console.log(`Response received: ${res.status} ${res.statusText}`);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`API error (${res.status})`, errorText);
      throw new Error(`${res.status}: ${errorText || res.statusText}`);
    }
    
    // تحويل الرد إلى JSON تلقائيًا
    const jsonData = await res.json().catch(() => ({}));
    return jsonData as T;
  } catch (error) {
    console.error(`Request failed to ${method} ${url}:`, error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (res.status === 401) {
      // مسح بيانات المستخدم المحلية
      localStorage.removeItem('auth_user');
      
      if (unauthorizedBehavior === "returnNull") {
        return null;
      }
      
      // إعادة التوجيه إلى صفحة تسجيل الدخول
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: true,
      staleTime: 0, // البيانات تعتبر قديمة فوراً
      retry: 1,
      retryOnMount: true,
    },
    mutations: {
      retry: false,
    },
  },
});
