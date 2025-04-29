import { Injectable, LoggerService, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import 'winston-daily-rotate-file';
import { ClsService } from 'nestjs-cls';

/**
 * LogLevel enum for standardized log levels across the application
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  VERBOSE = 'verbose',
}

/**
 * LogContext interface for structured logging with context
 */
export interface LogContext {
  correlationId?: string;
  requestId?: string;
  causationId?: string;
  userId?: string;
  resource?: string;
  action?: string;
  module?: string;
  metadata?: Record<string, any>;
}

/**
 * Centralized logging service for standardized log management across the application
 */
@Injectable({ scope: Scope.TRANSIENT })
export class LoggingService implements LoggerService {
  private logger: winston.Logger;
  private context?: string;
  private static sampleRates: Record<string, number> = {
    // Default sampling rates for different log categories
    'database': 0.1,  // Log 10% of database operations
    'auth': 1.0,      // Log 100% of auth operations
    'matching': 0.5,  // Log 50% of matching operations
    'messaging': 0.2, // Log 20% of messaging operations
    'default': 0.5,   // Default for uncategorized operations
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly clsService: ClsService,
  ) {
    this.initializeLogger();
  }

  /**
   * Initialize the Winston logger with appropriate transports and formats
   */
  private initializeLogger(): void {
    const environment = this.configService.get<string>('NODE_ENV', 'development');
    const logLevel = this.configService.get<string>('LOG_LEVEL', 'info');
    const serviceName = this.configService.get<string>('SERVICE_NAME', 'perfect-match-api');
    
    // Create custom format with correlation IDs and other context
    const customFormat = winston.format.printf(({ level, message, timestamp, ...metadata }: { level: string; message: string; timestamp: string; [key: string]: any }) => {
      // Extract context from CLS if available
      const correlationId = this.clsService.get('correlationId') || metadata.correlationId || 'unknown';
      const requestId = this.clsService.get('requestId') || metadata.requestId || 'unknown';
      const userId = this.clsService.get('userId') || metadata.userId;
      
      // Format output based on environment
      if (environment === 'production') {
        // JSON format for production for easier parsing by log aggregation tools
        return JSON.stringify({
          timestamp,
          service: serviceName,
          level,
          message,
          context: this.context,
          correlationId,
          requestId,
          userId,
          ...metadata,
        });
      }
      
      // More human-readable format for development
      return `${timestamp} [${serviceName}] ${level.toUpperCase()} [${correlationId}] ${this.context ? `[${this.context}]` : ''}: ${message} ${
        Object.keys(metadata).length ? JSON.stringify(metadata) : ''
      }`;
    });

    // Create console transport for all environments
    const consoleTransport = new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: environment !== 'production' }),
        winston.format.timestamp(),
        customFormat,
      ),
    });
    
    // Create file transport for rotating logs in production and staging
    const fileTransports = [];
    if (environment !== 'development') {
      // Add daily rotating file for non-development environments
      const fileTransport = new winston.transports.DailyRotateFile({
        filename: `logs/%DATE%-${serviceName}.log`,
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
      });
      fileTransports.push(fileTransport);
      
      // Add separate error log file for easier error tracking
      const errorFileTransport = new winston.transports.DailyRotateFile({
        filename: `logs/%DATE%-${serviceName}-error.log`,
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '30d',
        level: 'error',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
      });
      fileTransports.push(errorFileTransport);
    }

    // Configure the Winston logger
    this.logger = winston.createLogger({
      level: logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
        winston.format.json(),
      ),
      defaultMeta: {
        service: serviceName,
      },
      transports: [
        consoleTransport,
        ...fileTransports,
      ],
    });
  }

  /**
   * Set the context for the logger
   * @param context The context name (usually the class or module name)
   */
  setContext(context: string): this {
    this.context = context;
    return this;
  }

  /**
   * Log an error message
   * @param message The message to log
   * @param trace Optional error stack trace
   * @param context Optional log context
   */
  error(message: any, trace?: string, context?: LogContext): void {
    const logObj = this.formatLogObject(LogLevel.ERROR, message, context);
    
    if (trace) {
      logObj.trace = trace;
    }
    
    this.logger.error(logObj.message, { ...logObj, level: LogLevel.ERROR });
  }

  /**
   * Log a warning message
   * @param message The message to log
   * @param context Optional log context
   */
  warn(message: any, context?: LogContext): void {
    const logObj = this.formatLogObject(LogLevel.WARN, message, context);
    this.logger.warn(logObj.message, { ...logObj, level: LogLevel.WARN });
  }

  /**
   * Log an info message
   * @param message The message to log
   * @param context Optional log context
   */
  log(message: any, context?: LogContext): void {
    this.info(message, context);
  }

  /**
   * Log an info message (alias for log)
   * @param message The message to log
   * @param context Optional log context
   */
  info(message: any, context?: LogContext): void {
    // Apply sampling if specified in context
    if (this.shouldSample(context)) {
      const logObj = this.formatLogObject(LogLevel.INFO, message, context);
      this.logger.info(logObj.message, { ...logObj, level: LogLevel.INFO });
    }
  }

  /**
   * Log a debug message
   * @param message The message to log
   * @param context Optional log context
   */
  debug(message: any, context?: LogContext): void {
    // Apply sampling at a higher rate for debug logs
    if (this.shouldSample(context, 0.25)) { // Default to 25% sampling for debug logs
      const logObj = this.formatLogObject(LogLevel.DEBUG, message, context);
      this.logger.debug(logObj.message, { ...logObj, level: LogLevel.DEBUG });
    }
  }

  /**
   * Log a verbose message
   * @param message The message to log
   * @param context Optional log context
   */
  verbose(message: any, context?: LogContext): void {
    // Apply sampling at a higher rate for verbose logs
    if (this.shouldSample(context, 0.1)) { // Default to 10% sampling for verbose logs
      const logObj = this.formatLogObject(LogLevel.VERBOSE, message, context);
      this.logger.verbose(logObj.message, { ...logObj, level: LogLevel.VERBOSE });
    }
  }

  /**
   * Log a message with performance timing information
   * @param operation The operation name
   * @param durationMs The duration in milliseconds
   * @param context Optional log context
   */
  performance(operation: string, durationMs: number, context?: LogContext): void {
    // Always log slow operations
    const isSlow = durationMs > 1000; // 1 second threshold
    
    // Apply sampling for normal operations
    if (isSlow || this.shouldSample(context, 0.2)) {
      const logObj = this.formatLogObject(
        LogLevel.INFO, 
        `Performance: ${operation} completed in ${durationMs}ms`, 
        context
      );
      
      logObj.performance = {
        operation,
        durationMs,
        isSlow,
      };
      
      this.logger.info(logObj.message, { ...logObj, level: LogLevel.INFO });
    }
  }

  /**
   * Log a sensitive operation with redacted sensitive data
   * @param message The message to log
   * @param sensitiveData Data to be redacted
   * @param context Optional log context
   */
  sensitive(message: any, sensitiveData: Record<string, any>, context?: LogContext): void {
    // These operations are always logged for security audit purposes
    const logObj = this.formatLogObject(LogLevel.INFO, message, context);
    
    // Create a redacted copy of the sensitive data
    const redactedData = Object.keys(sensitiveData).reduce((acc, key) => {
      // Depending on the key name, redact or preserve the data
      if (
        key.toLowerCase().includes('password') ||
        key.toLowerCase().includes('token') ||
        key.toLowerCase().includes('secret') ||
        key.toLowerCase().includes('credit') ||
        key.toLowerCase().includes('card') ||
        key.toLowerCase().includes('ssn') ||
        key.toLowerCase().includes('social')
      ) {
        acc[key] = '[REDACTED]';
      } else if (typeof sensitiveData[key] === 'string') {
        // Partially redact other string values
        const value = sensitiveData[key] as string;
        if (value.length > 4) {
          acc[key] = value.substring(0, 2) + '***' + value.substring(value.length - 2);
        } else {
          acc[key] = '****';
        }
      } else {
        // Non-string values are logged as-is
        acc[key] = sensitiveData[key];
      }
      return acc;
    }, {} as Record<string, any>);
    
    logObj.sensitiveOperation = true;
    logObj.redactedData = redactedData;
    
    this.logger.info(logObj.message, { ...logObj, level: LogLevel.INFO });
  }

  /**
   * Format a log object with standardized metadata
   * @param level The log level
   * @param message The message to log
   * @param context Optional log context
   * @returns Formatted log object
   */
  private formatLogObject(level: LogLevel, message: any, context?: LogContext): Record<string, any> {
    let formattedMessage: string;
    
    if (typeof message === 'object') {
      try {
        formattedMessage = JSON.stringify(message);
      } catch (error) {
        formattedMessage = `[Object: ${message.toString()}]`;
      }
    } else {
      formattedMessage = String(message);
    }
    
    // Get correlation ID from CLS or context
    const correlationId = this.clsService.get('correlationId') || 
                         (context && context.correlationId) || 
                         'unknown';
                         
    // Get request ID from CLS or context
    const requestId = this.clsService.get('requestId') || 
                     (context && context.requestId) || 
                     'unknown';
                     
    // Get causation ID from CLS or context
    const causationId = this.clsService.get('causationId') || 
                       (context && context.causationId) || 
                       'unknown';
                       
    // Get user ID from CLS or context
    const userId = this.clsService.get('userId') || 
                  (context && context.userId);
                  
    // Build the log object with metadata
    const logObj: Record<string, any> = {
      message: formattedMessage,
      level: level,
      correlationId: correlationId,
      requestId: requestId,
      causationId: causationId,
      timestamp: new Date().toISOString(),
      context: this.context,
    };
    
    // Add user ID if available
    if (userId) {
      logObj.userId = userId;
    }
    
    // Add additional context if provided
    if (context) {
      if (context.resource) logObj.resource = context.resource;
      if (context.action) logObj.action = context.action;
      if (context.module) logObj.module = context.module;
      
      // Add any additional metadata
      if (context.metadata) {
        Object.entries(context.metadata).forEach(([key, value]) => {
          logObj[key] = value;
        });
      }
    }
    
    return logObj;
  }

  /**
   * Determine if a log should be sampled based on its context
   * @param context The log context
   * @param defaultRate The default sampling rate to use if not specified
   * @returns Boolean indicating whether to log the message
   */
  private shouldSample(context?: LogContext, defaultRate?: number): boolean {
    // Always log if sampling is disabled
    if (this.configService.get<string>('DISABLE_LOG_SAMPLING', 'false') === 'true') {
      return true;
    }
    
    // Error and warning levels are always logged
    if (context && context.metadata && context.metadata.level) {
      const level = context.metadata.level as LogLevel;
      if (level === LogLevel.ERROR || level === LogLevel.WARN) {
        return true;
      }
    }
    
    // Determine sampling rate based on module
    let rate = defaultRate || 0.5; // Default to 50% if not specified
    
    // Get sampling rate based on module
    if (context && context.module) {
      rate = LoggingService.sampleRates[context.module] || 
             LoggingService.sampleRates['default'];
    }
    
    // Generate random number between 0 and 1
    const random = Math.random();
    
    // Log if random number is less than the sampling rate
    return random < rate;
  }

  /**
   * Update sampling rates for different log categories
   * @param category The log category
   * @param rate The sampling rate (0.0 to 1.0)
   */
  static updateSamplingRate(category: string, rate: number): void {
    if (rate < 0 || rate > 1) {
      throw new Error('Sampling rate must be between 0 and 1');
    }
    LoggingService.sampleRates[category] = rate;
  }
}
