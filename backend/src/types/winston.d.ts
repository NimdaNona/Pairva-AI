declare module 'winston' {
  export interface Logger {
    error: LogMethod;
    warn: LogMethod;
    info: LogMethod;
    debug: LogMethod;
    verbose: LogMethod;
  }

  export interface LogMethod {
    (message: string, meta?: any): Logger;
    (message: string, ...meta: any[]): Logger;
    (message: any): Logger;
    (infoObject: object): Logger;
  }

  export interface Format {
    transform: (info: any) => any;
    options?: any;
  }

  export interface TransformableInfo {
    level: string;
    message: string;
    [key: string]: any;
  }

  export interface Profiler {
    start: (id: string) => Profiler;
    done: (info: object) => Logger;
  }

  export class Container {
    constructor(options?: LoggerOptions);
    add(id: string, options?: LoggerOptions): Logger;
    get(id: string, options?: LoggerOptions): Logger;
    has(id: string): boolean;
    close(id: string): void;
  }

  export interface LogEntry {
    level: string;
    message: string;
    [optionName: string]: any;
  }

  export interface LoggerOptions {
    level?: string;
    format?: Format;
    defaultMeta?: any;
    exitOnError?: boolean;
    silent?: boolean;
    transports?: Transport[];
  }

  export interface Transport {
    level?: string;
    silent?: boolean;
    handleExceptions?: boolean;
    handleRejections?: boolean;
    format?: Format;
  }

  export class transports {
    static File: any;
    static Console: any;
    static DailyRotateFile: any;
  }

  export class format {
    static colorize(options?: any): Format;
    static combine(...formats: Format[]): Format;
    static errors(options?: any): Format;
    static json(options?: any): Format;
    static label(options?: any): Format;
    static metadata(options?: any): Format;
    static ms(options?: any): Format;
    static padLevels(options?: any): Format;
    static prettyPrint(options?: any): Format;
    static printf(fn: (info: any) => string): Format;
    static simple(options?: any): Format;
    static splat(options?: any): Format;
    static timestamp(options?: { format?: string }): Format;
    static uncolorize(options?: any): Format;
  }

  export function createLogger(options?: LoggerOptions): Logger;
  
  export function add(transport: Transport): Logger;
  export function remove(transport: Transport): Logger;
  export function clear(): void;
  export function cli(): void;
  export function configure(options: LoggerOptions): void;
  export function log(level: string, message: string, meta?: any): Logger;
  export function debug(message: string, meta?: any): Logger;
  export function info(message: string, meta?: any): Logger;
  export function warn(message: string, meta?: any): Logger;
  export function error(message: string, meta?: any): Logger;
}

declare module 'winston-daily-rotate-file' {
  import { Transport } from 'winston';

  export interface DailyRotateFileTransportOptions {
    filename?: string;
    dirname?: string;
    datePattern?: string;
    zippedArchive?: boolean;
    maxSize?: string;
    maxFiles?: string;
    format?: any;
    level?: string;
    options?: any;
    auditFile?: string;
    utc?: boolean;
  }

  export default class DailyRotateFile extends Transport {
    constructor(options?: DailyRotateFileTransportOptions);
  }
}

declare module 'nestjs-cls' {
  import { ModuleMetadata, Provider, DynamicModule, Type } from '@nestjs/common';

  export interface ClsModuleOptions {
    middleware?: {
      mount?: boolean;
      generateId?: boolean;
      idGenerator?: () => string;
    };
    global?: boolean;
  }

  export interface ClsModuleOptionsFactory {
    createClsOptions(): Promise<ClsModuleOptions> | ClsModuleOptions;
  }

  export interface ClsModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
    useExisting?: Type<ClsModuleOptionsFactory>;
    useClass?: Type<ClsModuleOptionsFactory>;
    useFactory?: (...args: any[]) => Promise<ClsModuleOptions> | ClsModuleOptions;
    inject?: any[];
    global?: boolean;
  }

  export class ClsService {
    get<T = any>(key: string): T;
    set<T = any>(key: string, value: T): void;
    has(key: string): boolean;
    getId(): string;
    run<T = any>(callback: (cls: ClsService) => T): T;
  }

  export class ClsModule {
    static forRoot(options?: ClsModuleOptions): DynamicModule;
    static forRootAsync(options: ClsModuleAsyncOptions): DynamicModule;
  }
}
