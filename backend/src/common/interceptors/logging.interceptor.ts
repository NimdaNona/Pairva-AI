import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

/**
 * Logging interceptor
 * Logs request and response details for all API calls
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    
    const { method, originalUrl, ip, body } = request;
    const userAgent = request.get('user-agent') || 'unknown';
    const requestId = request.headers['x-request-id'] || `req-${Date.now()}`;
    
    // Log request details
    this.logger.log({
      message: `Incoming Request`,
      requestId,
      method,
      url: originalUrl,
      ip,
      userAgent,
      body: this.sanitizeBody(body),
    });

    const startTime = Date.now();

    return next
      .handle()
      .pipe(
        tap(() => {
          // Log response details
          const responseTime = Date.now() - startTime;
          const statusCode = response.statusCode;

          this.logger.log({
            message: `Outgoing Response`,
            requestId,
            method,
            url: originalUrl,
            statusCode,
            responseTime: `${responseTime}ms`,
          });
        }),
      );
  }

  /**
   * Sanitize request body to remove sensitive information before logging
   */
  private sanitizeBody(body: any): any {
    if (!body) return {};
    
    // Create a copy to avoid modifying the original
    const sanitized = { ...body };
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'passwordConfirmation', 'token', 'secret', 'authorization'];
    
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }
}
