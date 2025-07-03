import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

const sql = neon(process.env.DATABASE_URL!);

/**
 * أداة إعادة تعيين كلمات المرور للمستخدمين
 */
export class PasswordResetTool {
  
  /**
   * إعادة تعيين كلمة مرور مستخدم محدد
   */
  async resetUserPassword(username: string, newPassword: string): Promise<boolean> {
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      const result = await sql(`
        UPDATE users 
        SET password = $1 
        WHERE username = $2
      `, [hashedPassword, username]);
      
      return result.count > 0;
    } catch (error) {
      console.error('خطأ في إعادة تعيين كلمة المرور:', error);
      return false;
    }
  }

  /**
   * إعادة تعيين كلمات مرور جميع المستخدمين من دور معين
   */
  async resetRolePasswords(role: string, newPassword: string): Promise<number> {
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      const result = await sql(`
        UPDATE users 
        SET password = $1 
        WHERE role = $2
      `, [hashedPassword, role]);
      
      return result.count;
    } catch (error) {
      console.error('خطأ في إعادة تعيين كلمات المرور:', error);
      return 0;
    }
  }

  /**
   * فحص قوة كلمة المرور
   */
  validatePasswordStrength(password: string): { valid: boolean; message: string } {
    if (password.length < 6) {
      return { valid: false, message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' };
    }
    return { valid: true, message: 'كلمة المرور صالحة' };
  }

  /**
   * جلب قائمة المستخدمين الذين يحتاجون إعادة تعيين كلمة المرور
   */
  async getUsersNeedingPasswordReset(): Promise<Array<{id: number, username: string, role: string}>> {
    try {
      const users = await sql(`
        SELECT id, username, role 
        FROM users 
        WHERE role IN ('viewer', 'user') 
        ORDER BY role, username
      `);
      
      return users as Array<{id: number, username: string, role: string}>;
    } catch (error) {
      console.error('خطأ في جلب المستخدمين:', error);
      return [];
    }
  }
}

export const passwordResetTool = new PasswordResetTool();