import type { Request, Response, NextFunction } from 'express';

export declare function authenticate(req: Request, res: Response, next: NextFunction): void;
export default authenticate;
