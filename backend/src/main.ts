import { NestFactory } from '@nestjs/core';
import { ValidationPipe, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { SecurityMiddleware } from './common/middlewares/security.middleware';
import { RateLimitMiddleware } from './common/middlewares/rate-limit.middleware';
import { CorrelationIdMiddleware } from './common/middlewares/correlation-id.middleware';
import { LoggingService } from './common/services/logging.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  
  // Global validation pipe for DTO validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  
  // Enable CORS
  app.enableCors({
    origin: configService.get('CORS_ORIGINS', '*').split(','),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  
  // Use security middleware for advanced security headers
  const securityMiddleware = new SecurityMiddleware(configService);
  app.use(securityMiddleware.use.bind(securityMiddleware));
  
  // Apply correlation ID middleware first to generate IDs for all requests
  const correlationIdMiddleware = new CorrelationIdMiddleware();
  app.use(correlationIdMiddleware.use.bind(correlationIdMiddleware));
  
  // Apply rate limiting to all API routes
  const rateLimitMiddleware = new RateLimitMiddleware(configService);
  app.use(rateLimitMiddleware.use.bind(rateLimitMiddleware));
  
  // Override logger with our custom implementation
  app.useLogger(app.get(LoggingService));
  
  // Global prefix for all routes
  app.setGlobalPrefix('api/v1');
  
  // Setup Swagger documentation
  const options = new DocumentBuilder()
    .setTitle('Perfect Match API')
    .setDescription('The Perfect Match API Documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('api/docs', app, document);
  
  // Start the server
  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
  console.log(`Application running on port ${port}`);
}

bootstrap();
