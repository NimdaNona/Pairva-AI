import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Middleware that generates and manages correlation IDs for request tracing
 * across service boundaries. This ensures that a single user action can be
 * traced through all services and components it touches.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CorrelationIdMiddleware.name);
  
  // Header names for correlation and causation tracking
  private readonly CORRELATION_ID_HEADER = 'X-Correlation-ID';
  private readonly CAUSATION_ID_HEADER = 'X-Causation-ID';
  private readonly REQUEST_ID_HEADER = 'X-Request-ID';
  
  /**
   * Middleware function that processes the request
   * - Extracts existing correlation ID from headers if present
   * - Generates a new correlation ID if none exists
   * - Adds the correlation ID to the request object for use in services
   * - Sets correlation ID in the response headers
   */
  use(req: Request, res: Response, next: NextFunction): void {
    // Extract or generate correlation ID
    const correlationId = 
      req.headers[this.CORRELATION_ID_HEADER.toLowerCase()] as string || 
      uuidv4();
      
    // Generate a unique request ID for this specific request
    const requestId = uuidv4();
    
    // Save the previous request ID as the causation ID if it exists
    const causationId = 
      req.headers[this.REQUEST_ID_HEADER.toLowerCase()] as string || 
      requestId;

    // Attach to request object for use in controllers and services
    req['correlationId'] = correlationId;
    req['requestId'] = requestId;
    req['causationId'] = causationId;
    
    // Set the response headers for downstream services
    res.setHeader(this.CORRELATION_ID_HEADER, correlationId);
    res.setHeader(this.REQUEST_ID_HEADER, requestId);
    res.setHeader(this.CAUSATION_ID_HEADER, causationId);
    
    // Log request with correlation ID
    this.logger.debug(
      `Request ${req.method} ${req.url} | CorrelationID: ${correlationId} | RequestID: ${requestId}`
    );
    
    // Add response listener to log completed requests
    res.on('finish', () => {
      this.logger.debug(
        `Response ${res.statusCode} ${req.method} ${req.url} | CorrelationID: ${correlationId} | RequestID: ${requestId}`
      );
    });

    next();
  }
}

/**
 * Extended Request interface to include correlation ID properties
 */
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      requestId?: string;
      causationId?: string;
    }
  }
}
