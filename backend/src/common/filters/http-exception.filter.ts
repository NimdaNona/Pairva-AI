import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global HTTP exception filter
 * Handles all HTTP exceptions in a consistent format
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    
    const status = exception.getStatus() || HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = exception.getResponse();
    
    let errorResponse;
    if (typeof exceptionResponse === 'string') {
      errorResponse = {
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        message: exceptionResponse,
      };
    } else {
      const errorMessage = 
        typeof exceptionResponse === 'object' && 'message' in exceptionResponse
          ? (exceptionResponse as any).message
          : exception.message;
          
      errorResponse = {
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        message: Array.isArray(errorMessage) ? errorMessage : [errorMessage],
        ...(typeof exceptionResponse === 'object' && 'error' in exceptionResponse
          ? { error: (exceptionResponse as any).error }
          : {}),
      };
    }

    this.logger.error(
      `${request.method} ${request.url} ${status} - ${JSON.stringify(errorResponse.message)}`,
      exception.stack,
    );

    response.status(status).json(errorResponse);
  }
}
