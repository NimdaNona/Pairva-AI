declare module 'express-rate-limit' {
  import { Request, Response, NextFunction } from 'express';

  export interface Options {
    windowMs?: number;
    max?: number;
    message?: string | object;
    statusCode?: number;
    store?: any;
    skipFailedRequests?: boolean;
    skipSuccessfulRequests?: boolean;
    standardHeaders?: boolean;
    legacyHeaders?: boolean;
    requestPropertyName?: string;
    skipLog?: boolean | ((req: Request, res: Response) => boolean);
    skip?: (req: Request, res: Response) => boolean;
    keyGenerator?: (req: Request, res: Response) => string;
    handler?: (req: Request, res: Response, next: NextFunction) => void;
    onLimitReached?: (req: Request, res: Response, optionsUsed: Options) => void;
    requestWasSuccessful?: (req: Request, res: Response) => boolean;
  }

  export type RateLimitMiddleware = (req: Request, res: Response, next: NextFunction) => void;

  export default function rateLimit(options?: Options): RateLimitMiddleware;
}
