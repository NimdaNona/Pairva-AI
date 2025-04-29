import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import * as rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { createClient, RedisClientType } from 'redis';

/**
 * Rate-limiting middleware with Redis-backed storage for distributed environments
 * Defines different rate limits for various endpoint categories:
 * - Authentication endpoints (login, signup, token refresh)
 * - Profile viewing endpoints
 * - Messaging endpoints
 * - General API endpoints
 */
@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitMiddleware.name);
  private readonly isProduction: boolean;
  private readonly redisClient: RedisClientType;
  private readonly redisEnabled: boolean;

  // Rate limiter instances for different endpoint types
  private readonly authLimiter: any;
  private readonly profileLimiter: any;
  private readonly messagingLimiter: any;
  private readonly defaultLimiter: any;

  constructor(private readonly configService: ConfigService) {
    this.isProduction = this.configService.get<string>('NODE_ENV', 'development') === 'production';
    this.redisEnabled = this.configService.get<string>('REDIS_ENABLED', 'false') === 'true';
    
    // Setup Redis client for production environments
    if (this.redisEnabled && this.isProduction) {
      const redisUrl = this.configService.get<string>('REDIS_URL');
      if (redisUrl) {
        try {
          this.redisClient = createClient({ url: redisUrl });
          this.redisClient.on('error', (err: Error) => {
            this.logger.error(`Redis client error: ${err.message}`);
          });
          this.logger.log('Redis client initialized for rate limiting');
        } catch (error) {
          this.logger.error(`Failed to initialize Redis client: ${error.message}`);
          this.redisEnabled = false;
        }
      } else {
        this.logger.warn('Redis URL not provided, using memory store for rate limiting');
        this.redisEnabled = false;
      }
    }

    // Create store based on environment
    const store = this.createStore();

    // Initialize rate limiters with different thresholds
    this.authLimiter = this.createLimiter({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 30, // 30 requests per window
      message: 'Too many authentication requests, please try again later',
      store,
    });

    this.profileLimiter = this.createLimiter({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 150, // 150 requests per window
      message: 'Too many profile viewing requests, please try again later',
      store,
    });

    this.messagingLimiter = this.createLimiter({
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: 100, // 100 requests per window
      message: 'Too many messaging requests, please try again later',
      store,
    });

    this.defaultLimiter = this.createLimiter({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 300, // 300 requests per window
      message: 'Too many requests, please try again later',
      store,
    });
  }

  /**
   * Middleware function that applies rate limiting based on the request path
   */
  use(req: Request, res: Response, next: NextFunction): void {
    const path = req.path.toLowerCase();

    // Select the appropriate limiter based on the request path
    if (path.includes('/auth/') || path.includes('/login') || path.includes('/refresh-token')) {
      return this.authLimiter(req, res, next);
    } else if (path.includes('/profiles/')) {
      return this.profileLimiter(req, res, next);
    } else if (path.includes('/messaging/') || path.includes('/conversations/')) {
      return this.messagingLimiter(req, res, next);
    } else {
      return this.defaultLimiter(req, res, next);
    }
  }

  /**
   * Creates a store for the rate limiter
   * Uses Redis in production if available, otherwise falls back to memory store
   */
  private createStore() {
    if (this.redisEnabled && this.redisClient && this.isProduction) {
      // Use Redis store for distributed rate limiting in production
      return new RedisStore({
        // @ts-ignore - Type compatibility issue with newer Redis client
        sendCommand: (...args: string[]) => this.redisClient.sendCommand(args),
        prefix: 'rl:',
      });
    }
    // Default to memory store for development or when Redis is unavailable
    return undefined;
  }

  /**
   * Creates a rate limiter with the specified configuration
   */
  private createLimiter(options: rateLimit.Options): any {
    return rateLimit.default({
      ...options,
      standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
      legacyHeaders: false, // Disable the `X-RateLimit-*` headers
      // Add custom response handler to return proper error format
      handler: (req: Request, res: Response) => {
        res.status(429).json({
          statusCode: 429,
          message: options.message || 'Too Many Requests',
          error: 'Too Many Requests',
        });
      },
    });
  }
}
