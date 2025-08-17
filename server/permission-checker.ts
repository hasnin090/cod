import type { Request, Response, NextFunction } from "express";
import { getUserPermissions, hasUserPermission } from "./permissions";

// نظام فحص الصلاحيات المحدث
export const checkPermission = (requiredPermission: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
  const userId = (req as any).user?.id as number | undefined;
  if (!userId) {
        return res.status(401).json({ message: "غير مصرح" });
      }
  const hasPermission = await hasUserPermission(userId, requiredPermission);
      
      if (!hasPermission) {
        return res.status(403).json({ 
          message: "ليس لديك صلاحية لتنفيذ هذا الإجراء",
          requiredPermission 
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({ message: "خطأ في فحص الصلاحيات" });
    }
  };
};

// فحص صلاحيات متعددة (يجب أن يملك إحداها على الأقل)
export const checkAnyPermission = (permissions: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
  const userId = (req as any).user?.id as number | undefined;
  if (!userId) {
        return res.status(401).json({ message: "غير مصرح" });
      }
  const userPermissions = await getUserPermissions(userId);
      const hasAnyPermission = permissions.some(permission => 
        userPermissions.includes(permission)
      );
      
      if (!hasAnyPermission) {
        return res.status(403).json({ 
          message: "ليس لديك صلاحية لتنفيذ هذا الإجراء",
          requiredPermissions: permissions 
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({ message: "خطأ في فحص الصلاحيات" });
    }
  };
};

// فحص صلاحيات جميعها مطلوبة
export const checkAllPermissions = (permissions: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
  const userId = (req as any).user?.id as number | undefined;
  if (!userId) {
        return res.status(401).json({ message: "غير مصرح" });
      }
  const userPermissions = await getUserPermissions(userId);
      const hasAllPermissions = permissions.every(permission => 
        userPermissions.includes(permission)
      );
      
      if (!hasAllPermissions) {
        const missingPermissions = permissions.filter(permission => 
          !userPermissions.includes(permission)
        );
        
        return res.status(403).json({ 
          message: "ليس لديك جميع الصلاحيات المطلوبة",
          missingPermissions 
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({ message: "خطأ في فحص الصلاحيات" });
    }
  };
};

// فحص الوصول للمشروع
export const checkProjectAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
  const userId = (req as any).user?.id as number | undefined;
  if (!userId) {
      return res.status(401).json({ message: "غير مصرح" });
    }

    const projectId = parseInt(req.params.projectId || req.body.projectId);
    
    if (!projectId) {
      return res.status(400).json({ message: "معرف المشروع مطلوب" });
    }

    // إذا كان المستخدم مدير، يمكنه الوصول لجميع المشاريع
  const userPermissions = await getUserPermissions(userId);
    if (userPermissions.includes('manage_users')) {
      return next();
    }

    // فحص إذا كان المستخدم مخصص للمشروع
    const { storage } = await import('./storage');
  const hasAccess = await storage.checkUserProjectAccess(userId, projectId);
    
    if (!hasAccess) {
      return res.status(403).json({ 
        message: "ليس لديك صلاحية للوصول لهذا المشروع" 
      });
    }

    next();
  } catch (error) {
    console.error('Project access check error:', error);
    return res.status(500).json({ message: "خطأ في فحص صلاحية الوصول للمشروع" });
  }
};