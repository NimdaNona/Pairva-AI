/**
 * Configuration loader for the application
 * Organizes environment variables into structured configuration objects
 */
export default () => ({
  environment: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  
  // JWT Authentication
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  
  // CORS Configuration
  cors: {
    origins: process.env.CORS_ORIGINS || '*',
  },
  
  // Database Configuration
  database: {
    // PostgreSQL configuration for structured data
    postgres: {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
      username: process.env.POSTGRES_USERNAME || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
      database: process.env.POSTGRES_DATABASE || 'perfectmatch',
      synchronize: process.env.POSTGRES_SYNCHRONIZE === 'true' || false,
      ssl: process.env.POSTGRES_SSL === 'true' || false,
      logging: process.env.POSTGRES_LOGGING === 'true' || false,
    },
    
    // MongoDB configuration for flexible schema data
    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/perfectmatch',
    },
    
    // Redis configuration for caching
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || '',
      ttl: parseInt(process.env.REDIS_TTL || '3600', 10), // 1 hour
    },
  },
  
  // AWS Configuration
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    s3: {
      mediaBucket: process.env.MEDIA_BUCKET_NAME || 'perfect-match-media-dev',
      assetsBucket: process.env.ASSETS_BUCKET_NAME || 'perfect-match-assets-dev',
      logsBucket: process.env.LOG_BUCKET_NAME || 'perfect-match-logs-dev',
    },
    cloudfront: {
      domain: process.env.CLOUDFRONT_DOMAIN,
      enabled: process.env.ENABLE_CLOUDFRONT === 'true' || true,
    },
    cognito: {
      userPoolId: process.env.COGNITO_USER_POOL_ID,
      clientId: process.env.COGNITO_CLIENT_ID,
    },
  },
  
  // OpenAI Configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4',
    matchingPromptTemplate: process.env.OPENAI_MATCHING_PROMPT_TEMPLATE,
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '3000', 10),
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
  },
  
  // Fallback AI Provider (DeepSeek) Configuration
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY,
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    enabled: process.env.DEEPSEEK_ENABLED === 'true' || false,
  },
  
  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
  },
  
  // Feature Flags
  features: {
    enableEmailNotifications: process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true' || false,
    enablePremiumFeatures: process.env.ENABLE_PREMIUM_FEATURES === 'true' || true,
    maxMatchesPerDay: parseInt(process.env.MAX_MATCHES_PER_DAY || '10', 10),
    maxFreeMatches: parseInt(process.env.MAX_FREE_MATCHES || '10', 10),
    maxPremiumMatches: parseInt(process.env.MAX_PREMIUM_MATCHES || '50', 10),
  },
});
