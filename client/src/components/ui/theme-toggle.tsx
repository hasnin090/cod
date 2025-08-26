import { useState, useEffect } from "react";
import { Moon, Sun, MoonStar } from "lucide-react";

interface ThemeToggleProps {
  className?: string;
  iconClassName?: string;
}

export function ThemeToggle({ className, iconClassName }: ThemeToggleProps) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isTransitioning, setIsTransitioning] = useState(false);

  // تحقق من السمة الحالية عند تحميل المكون
  useEffect(() => {
    // التحقق ما إذا كان المستخدم قد حدد موضوعاً مسبقاً في التخزين المحلي
    const storedTheme = localStorage.getItem("theme");
    
    // التحقق ما إذا كان المتصفح يفضل الوضع المظلم
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    
    // تحديد السمة الافتراضية بناءً على تفضيلات المستخدم أو المتصفح
    const defaultTheme = storedTheme || (prefersDark ? "dark" : "light");
    
    // تطبيق السمة المحفوظة أو الافتراضية
    setTheme(defaultTheme as "light" | "dark");
    applyTheme(defaultTheme as "light" | "dark");
  }, []);

  // تطبيق السمة على الصفحة
  const applyTheme = (newTheme: "light" | "dark") => {
    const root = document.documentElement;
    
    // إضافة أو إزالة صنف "dark" من عنصر <html>
    if (newTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    
    // حفظ السمة في التخزين المحلي
    localStorage.setItem("theme", newTheme);
  };

  // تبديل السمة بين الوضع المظلم والفاتح
  const toggleTheme = () => {
    if (isTransitioning) return;
    
    setIsTransitioning(true);
    const newTheme = theme === "light" ? "dark" : "light";
    
    // تطبيق تأثير انتقالي جميل
    setTimeout(() => {
      setTheme(newTheme);
      applyTheme(newTheme);
      setTimeout(() => setIsTransitioning(false), 300);
    }, 150);
  };

  // تحديد الألوان والتأثيرات حسب الوضع الحالي
  const buttonClasses = theme === "light" 
    ? "bg-sky-50 hover:bg-sky-100 dark:bg-sky-900/20 dark:hover:bg-sky-900/30" 
    : "bg-slate-900/30 hover:bg-slate-900/40 dark:bg-slate-950/50 dark:hover:bg-slate-950/60";
    
  const iconClasses = theme === "light"
    ? "text-sky-600 dark:text-sky-400"
    : "text-slate-300 dark:text-slate-200";

  return (
    <button
      onClick={toggleTheme}
      disabled={isTransitioning}
      className={`
        relative w-11 h-11 rounded-xl flex items-center justify-center
        bg-gradient-to-br from-slate-50/80 to-slate-100/80 dark:from-slate-800/80 dark:to-slate-700/80
        backdrop-blur-sm border border-slate-200/60 dark:border-slate-600/60
        hover:from-slate-100/90 hover:to-slate-200/90 dark:hover:from-slate-700/90 dark:hover:to-slate-600/90
        transform transition-all duration-300 hover:scale-[1.08] active:scale-95
        shadow-lg hover:shadow-xl group overflow-hidden
        ${isTransitioning ? 'scale-95 opacity-75' : ''}
        ${className || ''}
      `}
      aria-label="تبديل الوضع المظلم/الفاتح"
      title={theme === "light" ? "التبديل إلى الوضع المظلم" : "التبديل إلى الوضع الفاتح"}
    >
      {/* Icon container with professional styling */}
      <div className={`
        relative z-10 w-6 h-6 flex items-center justify-center
        transition-all duration-500 transform
        ${isTransitioning ? 'rotate-180 scale-75' : ''}
      `}>
        {theme === "light" ? (
          <Sun className={`w-5 h-5 text-amber-500 transition-all duration-300 ${iconClassName || ''}`} />
        ) : (
          <Moon className={`w-5 h-5 text-indigo-400 transition-all duration-300 ${iconClassName || ''}`} />
        )}
      </div>
      
      {/* Hover effect backgrounds */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 dark:from-indigo-500/10 dark:to-purple-500/10 transform scale-0 transition-transform duration-300 ease-out group-hover:scale-100"></div>
      
      {/* Animated shimmer effect */}
      <div className="absolute -inset-1 bg-gradient-to-r from-transparent via-sky-400/20 dark:via-sky-400/20 to-transparent opacity-0 group-hover:opacity-100 animate-shimmer rounded-xl"></div>
      
      {/* Border glow effect */}
      <div className="absolute inset-0 rounded-xl ring-1 ring-sky-500/20 dark:ring-sky-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      
      {/* Loading indicator when transitioning */}
      {isTransitioning && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3 h-3 border border-slate-400 dark:border-slate-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </button>
  );
}