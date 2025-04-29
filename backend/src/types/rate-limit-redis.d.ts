declare module 'rate-limit-redis' {
  import { Request, Response } from 'express';
  import { RedisClientType } from 'redis';

  interface RedisStoreOptions {
    // Required function that sends Redis commands for the store to use
    sendCommand: (...args: any[]) => Promise<any>;
    // Optional prefix for Redis keys
    prefix?: string;
    // Optional key generator function
    keyGenerator?: (req: Request, res: Response) => string;
    // Optional Redis client instance
    client?: RedisClientType;
  }

  export class RedisStore {
    constructor(options: RedisStoreOptions);
    
    // Add appropriate methods
    incr(key: string, cb: (err: Error | null, hits: number) => void): void;
    decrement(key: string): Promise<void>;
    resetKey(key: string): Promise<void>;
  }

  // Allow direct import and default import support
  export default RedisStore;
}
