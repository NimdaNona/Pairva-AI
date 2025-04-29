import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
} from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { ConfigService } from '@nestjs/config';

/**
 * Timeout interceptor
 * Adds a timeout to all API calls to prevent hanging requests
 */
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  private readonly defaultTimeout = 30000; // 30 seconds default timeout
  
  constructor(private readonly configService: ConfigService) {}
  
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Get timeout value from config or use default
    const timeoutValue = this.configService.get<number>('API_TIMEOUT') || this.defaultTimeout;
    
    return next.handle().pipe(
      timeout(timeoutValue),
      catchError(err => {
        if (err instanceof TimeoutError) {
          return throwError(() => new RequestTimeoutException('Request processing timeout'));
        }
        return throwError(() => err);
      }),
    );
  }
}
