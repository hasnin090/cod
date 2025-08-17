declare module '../middleware/auth.js' {
  import type { Request, Response, NextFunction } from 'express';
  export function authenticate(req: Request, res: Response, next: NextFunction): void;
  const _default: typeof authenticate;
  export default _default;
}
