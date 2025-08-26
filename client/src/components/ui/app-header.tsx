import { useState, useEffect, useCallback, memo, useMemo } from "react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { DatabaseStatus } from "@/components/ui/database-status";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface AppHeaderProps {
  onOpenSidebar: () => void;
}

// User avatar component
const UserAvatar = memo(({ name, role }: { name: string; role: string }) => (
  <div className="hidden md:flex items-center ml-4">
    <div className="mr-3 text-right">
      <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 transition-colors duration-300">
        {name}
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400 transition-colors duration-300 flex items-center">
        <span className="inline-block w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full mr-1.5 animate-pulse"></span>
        <span>
          {role === "admin" ? "مدير النظام" : role === "manager" ? "مدير" : "مستخدم"}
        </span>
      </div>
    </div>
    <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 rounded-full flex items-center justify-center text-white shadow-sm group relative overflow-hidden">
      <i className="fas fa-user-circle text-sm relative z-10"></i>
      <span className="absolute -inset-1 bg-gradient-to-r from-blue-600/0 via-blue-600/30 to-blue-600/0 dark:from-blue-400/0 dark:via-blue-400/20 dark:to-blue-400/0 opacity-0 group-hover:opacity-100 animate-shimmer"></span>
    </div>
  </div>
));

UserAvatar.displayName = 'UserAvatar';

// Date display component
const DateDisplay = memo(({ isMobile = false }: { isMobile?: boolean }) => {
  const dateFormat = useMemo(() => {
    if (isMobile) {
      return { regular: "d MMMM", compact: "d MMM" };
    }
    return { full: "eeee، d MMMM yyyy" };
  }, [isMobile]);
  
  // Format date once on component mount
  const formattedDate = useMemo(() => {
    const date = new Date();
    if (isMobile) {
      return {
        regular: format(date, dateFormat.regular!, { locale: ar }),
        compact: format(date, dateFormat.compact!, { locale: ar })
      };
    }
    return format(date, dateFormat.full!, { locale: ar });
  }, [isMobile, dateFormat]);
  
  if (isMobile) {
    const mobileDate = formattedDate as { regular: string; compact: string };
    return (
      <div className="md:hidden text-xs xs:text-sm font-semibold text-blue-600 dark:text-blue-300 transition-colors duration-300">
        <span className="hidden xs:inline">{mobileDate.regular}</span>
        <span className="xs:hidden">{mobileDate.compact}</span>
      </div>
    );
  }
  
  return (
    <div className="hidden md:flex flex-col items-center">
      <div className="text-base font-semibold text-blue-600 dark:text-blue-300 transition-colors duration-300">
        <i className="fas fa-calendar-day ml-1.5"></i>
        <span>{formattedDate as string}</span>
      </div>
    </div>
  );
});

DateDisplay.displayName = 'DateDisplay';

// Menu toggle button component
const MenuToggleButton = memo(({ onClick }: { onClick: () => void }) => (
  <div className="flex items-center">
    <button
      onClick={onClick}
      className="sidebar-toggle-button relative mr-2 w-11 h-11 rounded-xl bg-gradient-to-br from-blue-50/80 to-indigo-50/80 dark:from-slate-800/80 dark:to-slate-700/80 backdrop-blur-sm flex items-center justify-center text-blue-600 dark:text-blue-400 transform transition-all duration-300 hover:scale-[1.08] active:scale-95 shadow-lg hover:shadow-xl border border-blue-100/60 dark:border-slate-600/60 touch-target group overflow-hidden"
      aria-label="فتح القائمة"
    >
      {/* Icon container with gradient background */}
      <div className="relative z-10 w-6 h-6 flex items-center justify-center">
        <i className="fas fa-bars text-base font-medium"></i>
      </div>
      
      {/* Hover effect backgrounds */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 dark:from-blue-400/10 dark:to-indigo-400/10 transform scale-0 transition-transform duration-300 ease-out group-hover:scale-100"></div>
      
      {/* Animated shimmer effect */}
      <div className="absolute -inset-1 bg-gradient-to-r from-transparent via-blue-400/20 to-transparent dark:via-blue-300/20 opacity-0 group-hover:opacity-100 animate-shimmer rounded-xl"></div>
      
      {/* Border glow effect */}
      <div className="absolute inset-0 rounded-xl ring-1 ring-blue-500/20 dark:ring-blue-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
    </button>
  </div>
));

MenuToggleButton.displayName = 'MenuToggleButton';

export const AppHeader = memo(({ onOpenSidebar }: AppHeaderProps) => {
  const { user } = useAuth();
  const [scrollPosition, setScrollPosition] = useState(0);

  // Optimize scroll handler with useCallback
  const handleScroll = useCallback(() => {
    setScrollPosition(window.scrollY);
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [handleScroll]);

  // Memoize header style values
  const headerStyles = useMemo(() => {
    const headerOpacity = Math.min(0.9, Math.max(0.6, scrollPosition / 200));
    const headerBlur = Math.min(8, scrollPosition / 30);
    const isDarkMode = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    
    return {
      backdropFilter: `blur(${headerBlur}px)`,
      boxShadow: isDarkMode
        ? scrollPosition > 20 ? "0 2px 10px rgba(0, 0, 0, 0.2)" : "none"
        : scrollPosition > 20 ? "0 2px 10px rgba(0, 0, 0, 0.1)" : "none",
      background: isDarkMode
        ? `linear-gradient(180deg, rgba(17, 24, 39, ${Math.min(0.98, headerOpacity + 0.1)}) 0%, rgba(31, 41, 55, ${Math.min(0.95, headerOpacity)}) 100%)`
        : `linear-gradient(180deg, rgba(255, 255, 255, ${headerOpacity}) 0%, rgba(248, 250, 252, ${headerOpacity - 0.05}) 100%)`,
      dataTheme: isDarkMode ? 'dark' : 'light'
    };
  }, [scrollPosition]);
  
  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 xs:px-6 md:px-8 py-3 xs:py-4 md:py-5 transition-all duration-300 border-b border-slate-200/60 dark:border-slate-700/60"
      style={headerStyles}
      data-theme={headerStyles.dataTheme}
    >
      <MenuToggleButton onClick={onOpenSidebar} />
      
      {/* Center content - Date Display */}
      <div className="flex-1 flex justify-center">
        <DateDisplay />
      </div>
      
      {/* Right side controls */}
      <div className="flex items-center gap-3">
        <DateDisplay isMobile />
        <DatabaseStatus />
        
        {/* Theme toggle with enhanced styling */}
        <div className="relative">
          <ThemeToggle />
        </div>
        
        {user && <UserAvatar name={user.name} role={user.role} />}
      </div>
    </header>
  );
});