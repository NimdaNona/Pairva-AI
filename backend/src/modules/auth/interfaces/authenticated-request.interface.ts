import { Request } from 'express';
import { UserEntity } from '../entities/user.entity';

/**
 * Extends the Express Request interface to include the user property
 * that gets attached by the authentication guards
 */
export interface AuthenticatedRequest extends Request {
  user: UserEntity & {
    // For backward compatibility with code that expects userId instead of id
    userId?: string;
  };
}
