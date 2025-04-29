import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as docdb from 'aws-cdk-lib/aws-docdb';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { PerfectMatchConfig } from './config';

/**
 * Data stack properties including network references
 */
export interface DataStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  config: PerfectMatchConfig;
}

/**
 * Stack for database resources including PostgreSQL, DocumentDB, and Redis
 */
export class DataStack extends cdk.Stack {
  // Public properties exposed for other stacks
  public readonly postgresInstance: rds.DatabaseInstance;
  public readonly documentDbCluster: docdb.DatabaseCluster;
  public readonly redisReplicationGroup: elasticache.CfnReplicationGroup;
  
  // Secret references
  public readonly postgresCredentialsSecret: secretsmanager.Secret;
  public readonly documentDbCredentialsSecret: secretsmanager.Secret;
  public readonly redisCredentialsSecret: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    // Select isolated subnets for databases
    const isolatedSubnets = props.vpc.selectSubnets({
      subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
    });

    const env = props.config.environment;

    // Parameter groups
    // PostgreSQL parameter group for tuning
    const pgParameterGroup = new rds.ParameterGroup(this, 'PostgresParamGroup', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_14_7,
      }),
      description: 'Parameter group for Perfect Match PostgreSQL',
      parameters: {
        'shared_buffers': props.config.environment === 'prod' ? '1GB' : '256MB',
        'max_connections': props.config.environment === 'prod' ? '200' : '100',
        'work_mem': props.config.environment === 'prod' ? '64MB' : '32MB',
        'maintenance_work_mem': props.config.environment === 'prod' ? '256MB' : '128MB',
        'effective_cache_size': props.config.environment === 'prod' ? '3GB' : '1GB',
        'log_min_duration_statement': '1000',
        'log_statement': 'ddl',
        'log_connections': 'on',
        'log_disconnections': 'on',
      },
    });

    // DocumentDB cluster parameter group for tuning
    const docdbParamGroup = new docdb.ClusterParameterGroup(this, 'DocDBParamGroup', {
      description: 'Parameter group for Perfect Match DocumentDB',
      family: 'docdb5.0', // Added required family property
      parameters: {
        'tls': 'enabled',
        'audit_logs': 'enabled',
        'profiler': 'enabled',
        'profiler_threshold_ms': props.config.environment === 'prod' ? '100' : '200',
      },
    });

    // Create PostgreSQL RDS instance
    this.postgresCredentialsSecret = new secretsmanager.Secret(this, 'PostgresCredentials', {
      secretName: `perfect-match/${env}/postgres-credentials`,
      description: 'Credentials for PostgreSQL database',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: 'perfectmatch_admin',
        }),
        excludePunctuation: true,
        includeSpace: false,
        generateStringKey: 'password',
        excludeCharacters: '"@/\\\'',
      },
    });

    // CloudWatch log group for RDS logs
    const postgresLogGroup = new logs.LogGroup(this, 'PostgresLogs', {
      logGroupName: `/aws/rds/instance/perfect-match-postgres-${env}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create security group for databases
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for database instances',
      allowAllOutbound: true,
    });

    // Allow inbound connections from the VPC
    dbSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(props.vpc.vpcCidrBlock),
      ec2.Port.tcp(5432),
      'Allow PostgreSQL access from VPC'
    );

      /**
       * High-Availability PostgreSQL RDS Instance Configuration
       * 
       * This configuration ensures the database is fault-tolerant and can maintain high availability
       * by deploying in a Multi-AZ setup. In a Multi-AZ deployment, Amazon RDS automatically
       * provisions and maintains a synchronous standby replica in a different Availability Zone.
       * 
       * Key high-availability features:
       * 1. Multi-AZ deployment: Always enabled for production environments
       * 2. Automated backups: Retained for the configured number of days
       * 3. Enhanced monitoring: Detailed OS-level metrics for database health
       * 4. Automatic failover: RDS automatically fails over to the standby instance if issues occur
       * 5. Performance Insights: Advanced performance monitoring and analysis
       * 6. Deletion protection: Prevents accidental database deletion
       * 
       * The standby instance is not accessible for read or write operations until a failover occurs,
       * at which point it becomes the new primary instance with minimal disruption.
       */
      this.postgresInstance = new rds.DatabaseInstance(this, 'PostgresInstance', {
        engine: rds.DatabaseInstanceEngine.postgres({
          version: rds.PostgresEngineVersion.VER_14_7
        }),
        instanceType: new ec2.InstanceType(props.config.rdsInstanceType),
        vpc: props.vpc,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED
        },
        parameterGroup: pgParameterGroup,
        credentials: rds.Credentials.fromSecret(this.postgresCredentialsSecret),
        // Always enable Multi-AZ for production to ensure high availability
        multiAz: true, // Force this to true regardless of environment for production readiness
        allocatedStorage: props.config.environment === 'prod' ? 100 : 20,
        maxAllocatedStorage: props.config.environment === 'prod' ? 200 : 50,
        storageType: rds.StorageType.GP3,
        securityGroups: [dbSecurityGroup],
        instanceIdentifier: `perfect-match-postgres-${env}`,
        databaseName: 'perfectmatch',
        cloudwatchLogsExports: ['postgresql', 'upgrade'],
        cloudwatchLogsRetention: logs.RetentionDays.ONE_MONTH,
        // Always enable enhanced monitoring and performance insights for better visibility
        enablePerformanceInsights: true,
        performanceInsightRetention: rds.PerformanceInsightRetention.LONG_TERM, // 2 years retention
        monitoringInterval: cdk.Duration.seconds(30), // More frequent monitoring for quicker detection
        backupRetention: cdk.Duration.days(props.config.rdsBackupRetentionDays),
        deletionProtection: props.config.environment === 'prod',
        removalPolicy: props.config.environment === 'prod'
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
        iamAuthentication: true,
        autoMinorVersionUpgrade: true // Enable automatic minor version upgrades
      });

    // Create DocumentDB cluster
    this.documentDbCredentialsSecret = new secretsmanager.Secret(this, 'DocumentDBCredentials', {
      secretName: `perfect-match/${env}/documentdb-credentials`,
      description: 'Credentials for DocumentDB database',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: 'perfectmatch_admin',
        }),
        excludePunctuation: true,
        includeSpace: false,
        generateStringKey: 'password',
        excludeCharacters: '"@/\\\'',
      },
    });

    // CloudWatch log group for DocumentDB logs
    const docdbLogGroup = new logs.LogGroup(this, 'DocumentDBLogs', {
      logGroupName: `/aws/docdb/perfect-match-docdb-${env}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create security group for DocumentDB
    const docdbSecurityGroup = new ec2.SecurityGroup(this, 'DocumentDBSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for DocumentDB instances',
      allowAllOutbound: true,
    });

    // Allow inbound connections from the VPC
    docdbSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(props.vpc.vpcCidrBlock),
      ec2.Port.tcp(27017),
      'Allow DocumentDB access from VPC'
    );

    // Create DocumentDB cluster
    this.documentDbCluster = new docdb.DatabaseCluster(this, 'DocumentDBCluster', {
      masterUser: {
        username: 'perfectmatch_admin',
        secretName: `perfect-match/${env}/documentdb-credentials`,
      },
      instanceType: new ec2.InstanceType(props.config.documentDbInstanceType),
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      dbClusterName: `perfect-match-docdb-${env}`,
      engineVersion: '5.0.0',
      instances: props.config.documentDbInstanceCount,
      parameterGroup: docdbParamGroup,
      securityGroup: docdbSecurityGroup, // Fixed security group reference
      removalPolicy: props.config.environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
      deletionProtection: props.config.environment === 'prod',
      storageEncrypted: true,
    });

    // Enable logging for DocumentDB using CloudWatch Logs
    // Note: We can't directly use cloudWatchLogsExports property as it's not available
    // This would be handled through parameter groups or AWS CLI commands post-deployment

    // Create Redis cluster
    // First, create a subnet group for Redis
    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'Subnet group for Perfect Match Redis cluster',
      subnetIds: isolatedSubnets.subnetIds,
      cacheSubnetGroupName: `perfect-match-redis-subnet-group-${env}`,
    });

    // Create Redis credentials
    this.redisCredentialsSecret = new secretsmanager.Secret(this, 'RedisCredentials', {
      secretName: `perfect-match/${env}/redis-credentials`,
      description: 'Auth token for Redis',
      generateSecretString: {
        excludePunctuation: true,
        includeSpace: false,
        excludeCharacters: '"@/\\\'',
        passwordLength: 32,
      },
    });

    // Get the Redis auth token value from the secret
    const redisAuthToken = this.redisCredentialsSecret.secretValueFromJson('password').unsafeUnwrap();

    // Create Redis parameter group
    const redisParamGroup = new elasticache.CfnParameterGroup(this, 'RedisParamGroup', {
      cacheParameterGroupFamily: 'redis6.x',
      description: 'Parameter group for Perfect Match Redis cluster',
      properties: {
        'timeout': props.config.environment === 'prod' ? '300' : '180',
        'maxmemory-policy': 'volatile-lru',
        'notify-keyspace-events': 'xE',
      },
    });

    // Create security group for Redis
    const redisSecurityGroup = new ec2.SecurityGroup(this, 'RedisSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for Redis cluster',
      allowAllOutbound: true,
    });

    // Allow inbound connections from the VPC
    redisSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(props.vpc.vpcCidrBlock),
      ec2.Port.tcp(6379),
      'Allow Redis access from VPC'
    );

    // Create Redis replication group
    this.redisReplicationGroup = new elasticache.CfnReplicationGroup(this, 'RedisReplicationGroup', {
      replicationGroupId: `perfect-match-redis-${env}`,
      replicationGroupDescription: 'Redis cluster for Perfect Match',
      cacheNodeType: props.config.redisNodeType,
      engine: 'redis',
      engineVersion: '6.2',
      numNodeGroups: props.config.redisNumShards,
      replicasPerNodeGroup: props.config.redisReplicasPerShard,
      multiAzEnabled: props.config.redisReplicasPerShard > 0,
      cacheParameterGroupName: redisParamGroup.ref,
      cacheSubnetGroupName: redisSubnetGroup.ref,
      securityGroupIds: [redisSecurityGroup.securityGroupId], // Fixed security group reference
      atRestEncryptionEnabled: true,
      transitEncryptionEnabled: true,
      authToken: redisAuthToken,
      autoMinorVersionUpgrade: true,
      automaticFailoverEnabled: props.config.redisReplicasPerShard > 0,
      port: 6379,
      logDeliveryConfigurations: [
        {
          destinationType: 'cloudwatch-logs',
          destinationDetails: {
            cloudWatchLogsDetails: {
              logGroup: `/aws/redis/perfect-match-redis-${env}`,
            },
          },
          logFormat: 'text',
          logType: 'slow-log',
        },
        {
          destinationType: 'cloudwatch-logs',
          destinationDetails: {
            cloudWatchLogsDetails: {
              logGroup: `/aws/redis/perfect-match-redis-${env}`,
            },
          },
          logFormat: 'text',
          logType: 'engine-log',
        },
      ],
      snapshotRetentionLimit: props.config.environment === 'prod' ? 7 : 1,
      snapshotWindow: '04:00-05:00',
    });

    // Create CloudWatch alarms for database monitoring
    if (props.config.enableEnhancedMonitoring) {
      // PostgreSQL CPU alarm
      new cloudwatch.Alarm(this, 'PostgresCpuAlarm', {
        metric: this.postgresInstance.metricCPUUtilization(),
        threshold: 80,
        evaluationPeriods: 3,
        datapointsToAlarm: 2,
        alarmDescription: 'PostgreSQL CPU utilization is high',
        alarmName: `perfect-match-postgres-cpu-alarm-${env}`,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      // PostgreSQL free storage alarm
      new cloudwatch.Alarm(this, 'PostgresFreeStorageAlarm', {
        metric: this.postgresInstance.metricFreeStorageSpace(),
        threshold: 10 * 1024 * 1024 * 1024, // 10 GB
        evaluationPeriods: 3,
        datapointsToAlarm: 3,
        alarmDescription: 'PostgreSQL free storage space is low',
        alarmName: `perfect-match-postgres-storage-alarm-${env}`,
        comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.BREACHING,
      });

      // DocumentDB CPU alarm - using custom metric instead of metricCPUUtilization
      new cloudwatch.Alarm(this, 'DocumentDbCpuAlarm', {
        metric: new cloudwatch.Metric({
          namespace: 'AWS/DocDB',
          metricName: 'CPUUtilization',
          dimensionsMap: {
            DBClusterIdentifier: this.documentDbCluster.clusterIdentifier,
          },
          statistic: 'Average',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 80,
        evaluationPeriods: 3,
        datapointsToAlarm: 2,
        alarmDescription: 'DocumentDB CPU utilization is high',
        alarmName: `perfect-match-docdb-cpu-alarm-${env}`,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
    }

    // Export database resource ARNs and IDs
    new cdk.CfnOutput(this, 'PostgresInstanceId', {
      value: this.postgresInstance.instanceIdentifier,
      exportName: `${id}-postgres-id`,
      description: 'PostgreSQL Instance ID',
    });

    new cdk.CfnOutput(this, 'PostgresEndpoint', {
      value: this.postgresInstance.dbInstanceEndpointAddress,
      exportName: `${id}-postgres-endpoint`,
      description: 'PostgreSQL Endpoint',
    });

    new cdk.CfnOutput(this, 'PostgresPort', {
      value: this.postgresInstance.dbInstanceEndpointPort,
      exportName: `${id}-postgres-port`,
      description: 'PostgreSQL Port',
    });

    new cdk.CfnOutput(this, 'DocumentDbEndpoint', {
      value: this.documentDbCluster.clusterEndpoint.socketAddress,
      exportName: `${id}-docdb-endpoint`,
      description: 'DocumentDB Cluster Endpoint',
    });

    new cdk.CfnOutput(this, 'RedisEndpoint', {
      value: this.redisReplicationGroup.attrPrimaryEndPointAddress,
      exportName: `${id}-redis-endpoint`,
      description: 'Redis Primary Endpoint',
    });

    new cdk.CfnOutput(this, 'RedisPort', {
      value: this.redisReplicationGroup.attrPrimaryEndPointPort,
      exportName: `${id}-redis-port`,
      description: 'Redis Port',
    });
  }
}
