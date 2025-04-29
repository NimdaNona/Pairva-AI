declare module 'redis' {
  export interface RedisClientOptions {
    url?: string;
    socket?: {
      host?: string;
      port?: number;
      path?: string;
      connectTimeout?: number;
      reconnectStrategy?: Function;
      noDelay?: boolean;
      keepAlive?: number;
      tls?: boolean;
    };
    username?: string;
    password?: string;
    name?: string;
    database?: number;
    commandsQueueMaxLength?: number;
    readonly?: boolean;
    legacyMode?: boolean;
    disableOfflineQueue?: boolean;
    scripts?: Record<string, any>;
  }

  export interface RedisClientType {
    on(event: string, listener: Function): this;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    quit(): Promise<void>;
    sendCommand(args: string[]): Promise<any>;
    // Add other methods as needed
  }

  export function createClient(options?: RedisClientOptions): RedisClientType;
}
