import * as cdk from 'aws-cdk-lib';

/**
 * Configuration interface for Perfect Match infrastructure
 */
export interface PerfectMatchConfig {
  // Environment information
  account: string;
  region: string;
  environment: string; // 'dev' | 'staging' | 'prod'
  
  // Network configuration
  vpcCidr: string;
  availabilityZones: string[];
  
  // Database configuration
  rdsInstanceType: string;
  rdsEngine: string;
  rdsEngineVersion: string;
  rdsBackupRetentionDays: number;
  
  documentDbInstanceType: string;
  documentDbInstanceCount: number;
  
  redisNodeType: string;
  redisNumShards: number;
  redisReplicasPerShard: number;
  
  // S3 configuration
  mediaStorageBucketName: string;
  assetStorageBucketName: string;
  logStorageBucketName: string;
  
  // CDN configuration
  enableCloudFront: boolean;
  
  // Domain configuration
  domainName: string;
  wwwSubdomain: string;
  apiSubdomain: string;
  certificateArn: string;
  apiCertificateArn?: string;
  
  // Notifications configuration
  slackWorkspaceId?: string;
  slackChannelId?: string;
  
  // CI/CD configuration
  repositoryName: string;
  branchName: string;
  
  // Monitoring configuration
  monitoring?: {
    alarmEmails?: string[];
    criticalAlarmEmails?: string[];
    dashboardsEnabled?: boolean;
    alarmsEnabled?: boolean;
    logRetentionDays?: number;
  };
  alarmEmail: string; // For backward compatibility
  enableEnhancedMonitoring: boolean;
}

/**
 * Load and validate configuration based on context and environment variables
 */
export function getConfig(app: cdk.App): PerfectMatchConfig {
  // Get environment from context or default to 'dev'
  const environment = app.node.tryGetContext('environment') || 'dev';
  
  // Default configuration
  const defaultConfig: PerfectMatchConfig = {
    account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID || '',
    region: process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || 'us-east-1',
    environment,
    
    // Network
    vpcCidr: '10.0.0.0/16',
    availabilityZones: ['us-east-1a', 'us-east-1b', 'us-east-1c'],
    
    // Databases
    rdsInstanceType: 'db.t3.small',
    rdsEngine: 'postgres',
    rdsEngineVersion: '14.7',
    rdsBackupRetentionDays: 7,
    
    documentDbInstanceType: 'db.t3.medium',
    documentDbInstanceCount: 1,
    
    redisNodeType: 'cache.t3.small',
    redisNumShards: 1,
    redisReplicasPerShard: 1,
    
    // Storage
    mediaStorageBucketName: `perfect-match-media-${environment}`,
    assetStorageBucketName: `perfect-match-assets-${environment}`,
    logStorageBucketName: `perfect-match-logs-${environment}`,
    
    // CDN
    enableCloudFront: true,
    
    // Domain configuration
    domainName: 'pairva.ai',
    wwwSubdomain: 'www',
    apiSubdomain: 'api',
    certificateArn: process.env.CERTIFICATE_ARN || '',
    apiCertificateArn: process.env.API_CERTIFICATE_ARN || process.env.CERTIFICATE_ARN || '',
    
    // CI/CD
    repositoryName: 'perfect-match',
    branchName: environment === 'prod' ? 'main' : environment === 'staging' ? 'staging' : 'develop',
    
    // Monitoring
    alarmEmail: process.env.ALARM_EMAIL || 'alerts@example.com',
    enableEnhancedMonitoring: environment === 'prod',
    monitoring: {
      alarmEmails: process.env.ALARM_EMAILS ? process.env.ALARM_EMAILS.split(',') : [process.env.ALARM_EMAIL || 'alerts@example.com'],
      criticalAlarmEmails: process.env.CRITICAL_ALARM_EMAILS ? process.env.CRITICAL_ALARM_EMAILS.split(',') : [process.env.ALARM_EMAIL || 'alerts@example.com'],
      dashboardsEnabled: environment !== 'dev',
      alarmsEnabled: true,
      logRetentionDays: environment === 'prod' ? 90 : environment === 'staging' ? 30 : 7,
    },
  };
  
  // Environment-specific overrides
  const environmentConfigs: Record<string, Partial<PerfectMatchConfig>> = {
    dev: {
      // Lower-cost resources for development
      rdsInstanceType: 'db.t3.micro',
      documentDbInstanceType: 'db.t3.medium',
      documentDbInstanceCount: 1,
      redisNodeType: 'cache.t2.small',
      redisNumShards: 1,
      redisReplicasPerShard: 0,
      enableEnhancedMonitoring: false,
    },
    staging: {
      // Medium-sized resources for staging
      rdsInstanceType: 'db.t3.small',
      documentDbInstanceType: 'db.t3.medium',
      documentDbInstanceCount: 2,
      redisNodeType: 'cache.t3.small',
      redisNumShards: 1,
      redisReplicasPerShard: 1,
      enableEnhancedMonitoring: true,
    },
    prod: {
      // Production-grade resources
      rdsInstanceType: 'db.m6g.large',
      rdsBackupRetentionDays: 30,
      documentDbInstanceType: 'db.r5.large',
      documentDbInstanceCount: 3,
      redisNodeType: 'cache.m6g.large',
      redisNumShards: 2,
      redisReplicasPerShard: 2,
      enableEnhancedMonitoring: true,
    },
  };
  
  // Merge default config with environment-specific overrides
  const environmentConfig = environmentConfigs[environment] || {};
  const config = { ...defaultConfig, ...environmentConfig };
  
  // Validate required config values
  if (!config.account) {
    throw new Error('AWS account ID is required. Set CDK_DEFAULT_ACCOUNT or AWS_ACCOUNT_ID environment variable.');
  }
  
  if (!config.region) {
    throw new Error('AWS region is required. Set CDK_DEFAULT_REGION or AWS_REGION environment variable.');
  }
  
  return config;
}
