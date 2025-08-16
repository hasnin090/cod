// Augment express-session with our app-specific fields
import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    username?: string;
    role?: string;
    lastActivity?: string;
    permissions?: string[];
    user?: {
      id?: number;
      username?: string;
      role?: string;
      permissions?: string[];
    };
  }
}
