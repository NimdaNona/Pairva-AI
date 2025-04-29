import * as Joi from 'joi';

/**
 * Validates environment variables using Joi schema
 * This ensures that required environment variables are present and have the correct format
 */
export const validate = (config: Record<string, unknown>) => {
  const schema = Joi.object({
    NODE_ENV: Joi.string()
      .valid('development', 'production', 'test', 'staging')
      .default('development'),
    PORT: Joi.number().default(3000),
    
    // JWT Config
    JWT_SECRET: Joi.string().required(),
    JWT_EXPIRES_IN: Joi.string().default('1h'),
    JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
    
    // Database Config - PostgreSQL
    POSTGRES_HOST: Joi.string().default('localhost'),
    POSTGRES_PORT: Joi.number().default(5432),
    POSTGRES_USERNAME: Joi.string().default('postgres'),
    POSTGRES_PASSWORD: Joi.string().required(),
    POSTGRES_DATABASE: Joi.string().default('perfectmatch'),
    POSTGRES_SYNCHRONIZE: Joi.boolean().default(false),
    POSTGRES_SSL: Joi.boolean().default(false),
    POSTGRES_LOGGING: Joi.boolean().default(false),
    
    // Database Config - MongoDB
    MONGODB_URI: Joi.string().default('mongodb://localhost:27017/perfectmatch'),
    
    // Redis Config
    REDIS_HOST: Joi.string().default('localhost'),
    REDIS_PORT: Joi.number().default(6379),
    REDIS_PASSWORD: Joi.string().allow('').default(''),
    REDIS_TTL: Joi.number().default(3600),
    
    // AWS Config
    AWS_REGION: Joi.string().default('us-east-1'),
    S3_MEDIA_BUCKET: Joi.string().required(),
    S3_ASSETS_BUCKET: Joi.string().required(),
    
    // AWS Cognito (optional)
    COGNITO_USER_POOL_ID: Joi.string().optional(),
    COGNITO_CLIENT_ID: Joi.string().optional(),
    
    // OpenAI Config
    OPENAI_API_KEY: Joi.string().required(),
    OPENAI_MODEL: Joi.string().default('gpt-4'),
    OPENAI_MAX_TOKENS: Joi.number().default(3000),
    OPENAI_TEMPERATURE: Joi.number().default(0.7),
    
    // DeepSeek Config (optional fallback)
    DEEPSEEK_API_KEY: Joi.string().optional(),
    DEEPSEEK_MODEL: Joi.string().default('deepseek-chat'),
    DEEPSEEK_ENABLED: Joi.boolean().default(false),
    
    // CORS Configuration
    CORS_ORIGINS: Joi.string().default('*'),
    
    // Logging Configuration
    LOG_LEVEL: Joi.string()
      .valid('error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly')
      .default('info'),
    LOG_FORMAT: Joi.string()
      .valid('json', 'pretty')
      .default('json'),
    
    // Feature Flags
    ENABLE_EMAIL_NOTIFICATIONS: Joi.boolean().default(false),
    ENABLE_PREMIUM_FEATURES: Joi.boolean().default(true),
    MAX_MATCHES_PER_DAY: Joi.number().default(10),
    MAX_FREE_MATCHES: Joi.number().default(10),
    MAX_PREMIUM_MATCHES: Joi.number().default(50),
  });

  const { error, value } = schema.validate(config, { allowUnknown: true });

  if (error) {
    throw new Error(`Environment validation error: ${error.message}`);
  }

  return value;
};
