import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';

/**
 * Security middleware that adds important security headers to all responses.
 * 
 * Implements:
 * - Content-Security-Policy: Restricts which resources can be loaded
 * - Strict-Transport-Security: Forces HTTPS connections
 * - X-Content-Type-Options: Prevents MIME type sniffing
 * - X-Frame-Options: Prevents clickjacking
 * - X-XSS-Protection: Adds an additional layer of XSS protection in some browsers
 * - Referrer-Policy: Controls how much referrer information is sent
 */
@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  private readonly isDevelopment: boolean;
  private readonly frontendOrigin: string;
  private readonly apiOrigin: string;

  constructor(private readonly configService: ConfigService) {
    this.isDevelopment = this.configService.get<string>('NODE_ENV', 'development') === 'development';
    this.frontendOrigin = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    this.apiOrigin = this.configService.get<string>('API_URL', 'http://localhost:8000');
  }

  use(req: Request, res: Response, next: NextFunction): void {
    // Content Security Policy
    const cspDirectives = this.buildCspDirectives();
    res.setHeader('Content-Security-Policy', cspDirectives);

    // Strict Transport Security (only in production)
    if (!this.isDevelopment) {
      // Set HSTS header for 1 year, including subdomains, preload
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
      );
    }

    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Prevent embedding in iframes (anti-clickjacking)
    res.setHeader('X-Frame-Options', 'DENY');

    // Enable browser's XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Control referrer information
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Allow sending of credentials only to the same origin
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Remove X-Powered-By header
    res.removeHeader('X-Powered-By');

    next();
  }

  /**
   * Builds CSP directives based on environment
   * More restrictive in production, more permissive in development
   */
  private buildCspDirectives(): string {
    // Define sources
    const selfSource = "'self'";
    const dataSources = "data:";
    const blobSources = "blob:";
    const unsafeSources = this.isDevelopment ? "'unsafe-eval' 'unsafe-inline'" : "";
    
    // Define trusted external sources
    const trustedCdns = [
      "https://cdn.jsdelivr.net",  // Font Awesome
      "https://fonts.googleapis.com",  // Google Fonts
      "https://fonts.gstatic.com"  // Google Fonts resources
    ].join(' ');

    // Define trusted services
    const imageSources = [selfSource, dataSources, blobSources, 
      "https://s3.amazonaws.com", // AWS S3 
      "https://*.cloudfront.net", // CloudFront CDN
      "https://stripe.com",       // Stripe
      "https://*.stripe.com"      // Stripe
    ].join(' ');

    const scriptSources = [selfSource]
      .concat(this.isDevelopment ? ["'unsafe-eval'", "'unsafe-inline'"] : [])
      .concat(["https://js.stripe.com"]) // Stripe
      .join(' ');

    const connectSources = [selfSource, this.frontendOrigin, this.apiOrigin]
      .concat(this.isDevelopment ? ["ws:"]: []) // WebSockets for development
      .concat([
        "https://*.amazonaws.com",    // AWS
        "https://api.stripe.com",     // Stripe
        "https://cognito-idp.*.amazonaws.com" // Cognito
      ])
      .join(' ');

    // Build the complete CSP header
    return [
      `default-src ${selfSource}`,
      `script-src ${scriptSources}`,
      `style-src ${selfSource} ${unsafeSources} ${trustedCdns}`,
      `img-src ${imageSources}`,
      `font-src ${selfSource} ${dataSources} ${trustedCdns}`,
      `connect-src ${connectSources}`,
      `media-src ${selfSource}`,
      `frame-src https://*.stripe.com`,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "block-all-mixed-content",
      "upgrade-insecure-requests"
    ].join('; ');
  }
}
