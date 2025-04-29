import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';
import { PerfectMatchConfig } from './config';

/**
 * Storage stack properties including configuration
 */
export interface StorageStackProps extends cdk.StackProps {
  config: PerfectMatchConfig;
}

/**
 * Stack for storage resources including S3 buckets and CloudFront distribution
 */
export class StorageStack extends cdk.Stack {
  // Public properties exposed for other stacks
  public readonly mediaBucket: s3.Bucket;
  public readonly assetsBucket: s3.Bucket;
  public readonly logBucket: s3.Bucket;
  public readonly cloudFrontDistribution?: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    const env = props.config.environment;

    // Create S3 bucket for access logs
    this.logBucket = new s3.Bucket(this, 'LogBucket', {
      bucketName: props.config.logStorageBucketName,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          id: 'ExpireOldLogs',
          enabled: true,
          expiration: cdk.Duration.days(365),
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30)
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90)
            }
          ]
        }
      ]
    });

    // Create S3 bucket for media uploads (user profile pictures, etc.)
    this.mediaBucket = new s3.Bucket(this, 'MediaBucket', {
      bucketName: props.config.mediaStorageBucketName,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: props.config.environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
      cors: [
        {
          allowedHeaders: ['*'],
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.HEAD
          ],
          allowedOrigins: ['*'], // This will be restricted in production
          exposedHeaders: [
            'ETag',
            'x-amz-meta-custom-header',
            'x-amz-server-side-encryption',
            'x-amz-request-id', 
            'x-amz-id-2'
          ],
          maxAge: 3000
        }
      ],
      serverAccessLogsBucket: this.logBucket,
      serverAccessLogsPrefix: 'media-bucket-logs/',
      lifecycleRules: [
        {
          id: 'DeleteTemporaryUploads',
          enabled: true,
          prefix: 'temp/',
          expiration: cdk.Duration.days(1)
        }
      ]
    });

    // Create S3 bucket for static assets (frontend application)
    this.assetsBucket = new s3.Bucket(this, 'AssetsBucket', {
      bucketName: props.config.assetStorageBucketName,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: props.config.environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
      serverAccessLogsBucket: this.logBucket,
      serverAccessLogsPrefix: 'assets-bucket-logs/',
    });

    // Create CloudFront distribution for assets if enabled
    if (props.config.enableCloudFront) {
      // CloudFront log group for access logs
      const cloudfrontLogGroup = new logs.LogGroup(this, 'CloudFrontLogs', {
        logGroupName: `/aws/cloudfront/perfect-match-${env}`,
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });

      // CloudFront Origin Access Identity for S3
      const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI', {
        comment: `OAI for Perfect Match ${env}`
      });

      // Grant read access to the OAI
      this.assetsBucket.grantRead(originAccessIdentity);
      this.mediaBucket.grantRead(originAccessIdentity);

      /**
       * Enhanced Security Headers Policy for CloudFront
       * 
       * This configuration implements a comprehensive set of HTTP security headers following
       * OWASP best practices and security recommendations.
       * 
       * Security Headers Implemented:
       * 1. Content-Security-Policy (CSP): Defines trusted sources for content loading
       * 2. Strict-Transport-Security (HSTS): Enforces HTTPS connections
       * 3. X-Content-Type-Options: Prevents MIME type sniffing
       * 4. X-Frame-Options: Prevents clickjacking attacks
       * 5. X-XSS-Protection: Additional XSS protection layer for older browsers
       * 6. Referrer-Policy: Controls information in the Referer header
       * 7. Permissions-Policy: Restricts what browser features can be used
       */
      const responseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeadersPolicy', {
        responseHeadersPolicyName: `perfect-match-security-headers-${env}`,
        securityHeadersBehavior: {
          // Content Security Policy (CSP)
          contentSecurityPolicy: {
            contentSecurityPolicy: [
              "default-src 'self'",
              "img-src 'self' data: https://*",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.pairva.ai",
              "style-src 'self' 'unsafe-inline' https://*.pairva.ai",
              "connect-src 'self' https://*.pairva.ai https://*.amazonaws.com",
              "font-src 'self' https://*.pairva.ai",
              "media-src 'self'",
              "object-src 'none'",
              "frame-src 'self'",
              "upgrade-insecure-requests",
              "block-all-mixed-content"
            ].join('; '),
            override: true
          },
          // HTTP Strict Transport Security (HSTS)
          strictTransportSecurity: {
            accessControlMaxAge: cdk.Duration.days(730), // 2 years (extended from 1 year)
            includeSubdomains: true,
            preload: true,
            override: true
          },
          // X-Content-Type-Options
          contentTypeOptions: {
            override: true
          },
          // Referrer Policy
          referrerPolicy: {
            referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
            override: true
          },
          // X-XSS-Protection
          xssProtection: {
            protection: true,
            modeBlock: true,
            override: true
          },
          // X-Frame-Options
          frameOptions: {
            frameOption: cloudfront.HeadersFrameOption.DENY,
            override: true
          }
        },
        // Custom headers for additional security
        customHeadersBehavior: {
          customHeaders: [
            {
              header: 'Permissions-Policy',
              value: 'camera=(), microphone=(), geolocation=(self), payment=(self)',
              override: true
            },
            {
              header: 'Cache-Control',
              value: 'no-store, max-age=0',
              override: false // Only applied where not explicitly set
            }
          ]
        }
      });

      // Import ACM Certificate if certificateArn is provided
      const certificate = props.config.certificateArn ? 
        acm.Certificate.fromCertificateArn(this, 'CloudFrontCertificate', props.config.certificateArn) :
        undefined;

      // CloudFront distribution with custom domain if certificate is provided
      this.cloudFrontDistribution = new cloudfront.Distribution(this, 'AssetsCDN', {
        defaultRootObject: 'index.html',
        domainNames: certificate ? 
          [props.config.domainName, `${props.config.wwwSubdomain}.${props.config.domainName}`] : 
          undefined,
        certificate,
        defaultBehavior: {
          origin: new origins.S3Origin(this.assetsBucket, {
            originAccessIdentity
          }),
          compress: true,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          responseHeadersPolicy,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN
        },
        additionalBehaviors: {
          '/media/*': {
            origin: new origins.S3Origin(this.mediaBucket, {
              originAccessIdentity
            }),
            compress: true,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            responseHeadersPolicy,
            cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
            originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN
          }
        },
        errorResponses: [
          {
            httpStatus: 404,
            responseHttpStatus: 200,
            responsePagePath: '/index.html',
            ttl: cdk.Duration.minutes(0)
          }
        ],
        // Enable WAF for production
        webAclId: props.config.environment === 'prod' ? undefined : undefined, // Will be set when WAF is configured
        enableLogging: true,
        logBucket: this.logBucket,
        logFilePrefix: 'cloudfront-logs/',
        logIncludesCookies: true,
        minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
        httpVersion: cloudfront.HttpVersion.HTTP2,
        priceClass: props.config.environment === 'prod' 
          ? cloudfront.PriceClass.PRICE_CLASS_ALL 
          : cloudfront.PriceClass.PRICE_CLASS_100,
        comment: `Perfect Match CDN - ${env}`
      });

      // DNS records will be created in the domain stack

      // Export CloudFront distribution ARNs and URLs
      new cdk.CfnOutput(this, 'CloudFrontDomainName', {
        value: this.cloudFrontDistribution.distributionDomainName,
        exportName: `${id}-cloudfront-domain`,
        description: 'CloudFront Domain Name',
      });

      new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
        value: this.cloudFrontDistribution.distributionId,
        exportName: `${id}-cloudfront-id`,
        description: 'CloudFront Distribution ID',
      });
    }

    // Create IAM role for frontend to access S3 buckets
    const s3AccessRole = new iam.Role(this, 'S3AccessRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Role for accessing S3 buckets',
      roleName: `perfect-match-s3-access-role-${env}`,
    });

    // Grant read/write access to buckets
    this.mediaBucket.grantReadWrite(s3AccessRole);
    this.assetsBucket.grantReadWrite(s3AccessRole);

    // Export storage resource ARNs and URLs
    new cdk.CfnOutput(this, 'MediaBucketName', {
      value: this.mediaBucket.bucketName,
      exportName: `${id}-media-bucket-name`,
      description: 'Media Bucket Name',
    });

    new cdk.CfnOutput(this, 'AssetsBucketName', {
      value: this.assetsBucket.bucketName,
      exportName: `${id}-assets-bucket-name`,
      description: 'Assets Bucket Name',
    });

    new cdk.CfnOutput(this, 'LogBucketName', {
      value: this.logBucket.bucketName,
      exportName: `${id}-log-bucket-name`,
      description: 'Log Bucket Name',
    });

    new cdk.CfnOutput(this, 'S3AccessRoleArn', {
      value: s3AccessRole.roleArn,
      exportName: `${id}-s3-access-role-arn`,
      description: 'S3 Access Role ARN',
    });
  }
}
