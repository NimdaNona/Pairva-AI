import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { PerfectMatchConfig } from './config';

/**
 * Properties for the MonitoringStack
 */
export interface MonitoringStackProps extends cdk.StackProps {
  /**
   * Configuration for the Perfect Match application
   */
  config: PerfectMatchConfig;
  
  /**
   * Optional lambda functions to monitor
   */
  lambdaFunctions?: Record<string, lambda.Function>;
  
  /**
   * Optional CloudWatch log groups to monitor
   */
  logGroups?: Record<string, logs.LogGroup>;
  
  /**
   * Optional API Gateway stage to monitor
   */
  apiGatewayStage?: apigateway.Stage;
  
  /**
   * Optional RDS database cluster to monitor
   */
  databaseCluster?: rds.DatabaseCluster | rds.DatabaseInstance;
  
  /**
   * Optional MongoDB cluster to monitor
   */
  mongoDbCluster?: any;
}

/**
 * CDK Stack for creating CloudWatch monitoring dashboards, alarms, and metrics
 * for the Perfect Match application
 */
export class MonitoringStack extends cdk.Stack {
  // Public properties for access from other stacks
  public readonly alarmTopic: sns.Topic;
  public readonly criticalAlarmTopic: sns.Topic;
  public readonly dashboards: Record<string, cloudwatch.Dashboard> = {};
  
  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);
    
    const config = props.config;
    const env = config.environment;
    
    // Create SNS topics for alarms with different severity levels
    this.alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      displayName: `PerfectMatch-${env}-Alarms`,
      topicName: `perfect-match-${env}-alarms`,
    });
    
    this.criticalAlarmTopic = new sns.Topic(this, 'CriticalAlarmTopic', {
      displayName: `PerfectMatch-${env}-CriticalAlarms`,
      topicName: `perfect-match-${env}-critical-alarms`,
    });
    
    // Add email subscriptions based on environment
    if (env === 'prod' || env === 'staging') {
      // Subscribe to standard alarms
      if (config.monitoring?.alarmEmails?.length) {
        config.monitoring.alarmEmails.forEach((email: string) => {
          this.alarmTopic.addSubscription(
            new subscriptions.EmailSubscription(email, {
              filterPolicy: {
                severity: sns.SubscriptionFilter.stringFilter({
                  allowlist: ['MEDIUM', 'HIGH'],
                }),
              },
            })
          );
        });
      }
      
      // Subscribe to critical alarms
      if (config.monitoring?.criticalAlarmEmails?.length) {
        config.monitoring.criticalAlarmEmails.forEach((email: string) => {
          this.criticalAlarmTopic.addSubscription(
            new subscriptions.EmailSubscription(email)
          );
        });
      }
    }
    
    // Create different types of dashboards
    if (config.monitoring?.dashboardsEnabled !== false) {
      this.createServiceDashboards(props);
      this.createBusinessDashboards(props);
      this.createInfrastructureDashboards(props);
    }
    
    // Create alarms
    if (config.monitoring?.alarmsEnabled !== false) {
      this.createServiceAlarms(props);
      this.createBusinessAlarms(props);
      this.createInfrastructureAlarms(props);
    }
    
    // Outputs
    new cdk.CfnOutput(this, 'AlarmTopicArn', {
      value: this.alarmTopic.topicArn,
      description: 'ARN of the alarm notification SNS topic',
      exportName: `${id}-alarm-topic-arn`,
    });
    
    new cdk.CfnOutput(this, 'CriticalAlarmTopicArn', {
      value: this.criticalAlarmTopic.topicArn,
      description: 'ARN of the critical alarm notification SNS topic',
      exportName: `${id}-critical-alarm-topic-arn`,
    });
  }

  /**
   * Helper method to create a metric with standard properties
   * @param metricName The name of the metric to create
   * @param unit The unit for the metric (Count, Milliseconds, etc.)
   * @param namespace The CloudWatch namespace for the metric
   * @param statistic The statistic to use for the metric
   * @returns A CloudWatch metric object
   */
  private createMetric(
    metricName: string, 
    unit: string, 
    namespace: string,
    statistic: cloudwatch.Statistic = cloudwatch.Statistic.SUM
  ): cloudwatch.Metric {
    return new cloudwatch.Metric({
      metricName,
      namespace: `PerfectMatch/${namespace}`,
      unit: unit as any, // CloudWatch units are strings but typed as enum
      statistic: statistic.toString(),
      period: Duration.minutes(1),
    });
  }

  /**
   * Create a CloudWatch alarm for a metric
   * @param id Unique identifier for the alarm
   * @param metric The metric to create an alarm for
   * @param threshold The threshold value for the alarm
   * @param evaluationPeriods Number of periods to evaluate the alarm
   * @param comparisonOperator Comparison operator for the alarm
   * @param alarmDescription Description of the alarm
   * @param treatMissingData How to treat missing data
   * @param topic Optional SNS topic to notify
   * @returns The created CloudWatch alarm
   */
  private createAlarm(
    id: string,
    metric: cloudwatch.Metric,
    threshold: number,
    evaluationPeriods: number,
    comparisonOperator: cloudwatch.ComparisonOperator,
    alarmDescription: string,
    treatMissingData: cloudwatch.TreatMissingData = cloudwatch.TreatMissingData.NOT_BREACHING,
    topic: sns.ITopic | undefined = undefined
  ): cloudwatch.Alarm {
    const alarm = new cloudwatch.Alarm(this, id, {
      metric,
      threshold,
      evaluationPeriods,
      comparisonOperator,
      alarmDescription,
      treatMissingData,
    });

    if (topic) {
      alarm.addAlarmAction(new actions.SnsAction(topic));
    }

    return alarm;
  }
  
  /**
   * Create service-level dashboards for monitoring application components
   */
  private createServiceDashboards(props: MonitoringStackProps) {
    const dashboardPrefix = `PerfectMatch-${props.config.environment}`;
    
    // Authentication service dashboard
    const authDashboard = new cloudwatch.Dashboard(this, 'AuthDashboard', {
      dashboardName: `${dashboardPrefix}-Auth-Service`,
    });
    
    this.dashboards['auth'] = authDashboard;
    
    // Add widgets to auth dashboard
    authDashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: `# Authentication Service Dashboard
          \n## Key Metrics for Authentication Service
          \nMonitors login attempts, token refresh, registration, and auth failures`,
        width: 24,
        height: 2,
      }),
      
      new cloudwatch.GraphWidget({
        title: 'Authentication Requests',
        left: [
          this.createMetric('SignInAttempts', 'Count', 'Auth'),
          this.createMetric('SignUpAttempts', 'Count', 'Auth'),
          this.createMetric('TokenRefresh', 'Count', 'Auth'),
        ],
        width: 12,
        height: 6,
      }),
      
      new cloudwatch.GraphWidget({
        title: 'Authentication Failures',
        left: [
          this.createMetric('SignInFailures', 'Count', 'Auth'),
          this.createMetric('SignUpFailures', 'Count', 'Auth'),
          this.createMetric('TokenRefreshFailures', 'Count', 'Auth'),
        ],
        width: 12,
        height: 6,
      }),
      
      new cloudwatch.GraphWidget({
        title: 'Authentication Latency',
        left: [
          this.createMetric('SignInLatency', 'Milliseconds', 'Auth', cloudwatch.Statistic.AVERAGE),
          this.createMetric('SignUpLatency', 'Milliseconds', 'Auth', cloudwatch.Statistic.AVERAGE),
          this.createMetric('TokenRefreshLatency', 'Milliseconds', 'Auth', cloudwatch.Statistic.AVERAGE),
        ],
        width: 12,
        height: 6,
      }),
      
      new cloudwatch.LogQueryWidget({
        title: 'Recent Authentication Errors',
        logGroupNames: [
          `/aws/lambda/perfect-match-${props.config.environment}-auth-service`,
          `/perfect-match/${props.config.environment}/auth-service`,
        ],
        queryString: 'fields @timestamp, @message | filter level="error" | sort @timestamp desc | limit 20',
        width: 24,
        height: 8,
      })
    );
    
    // Profile service dashboard
    const profileDashboard = new cloudwatch.Dashboard(this, 'ProfileDashboard', {
      dashboardName: `${dashboardPrefix}-Profile-Service`,
    });
    
    this.dashboards['profile'] = profileDashboard;
    
    // Add widgets to profile dashboard
    profileDashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: `# Profile Service Dashboard
          \n## Key Metrics for Profile Management
          \nMonitors profile creation, updates, viewing, and search operations`,
        width: 24,
        height: 2,
      }),
      
      new cloudwatch.GraphWidget({
        title: 'Profile Operations',
        left: [
          this.createMetric('ProfileCreations', 'Count', 'Profiles'),
          this.createMetric('ProfileUpdates', 'Count', 'Profiles'),
          this.createMetric('ProfileViews', 'Count', 'Profiles'),
        ],
        width: 12,
        height: 6,
      }),
      
      new cloudwatch.GraphWidget({
        title: 'Profile Photo Operations',
        left: [
          this.createMetric('PhotoUploads', 'Count', 'Profiles'),
          this.createMetric('PhotoDeletions', 'Count', 'Profiles'),
        ],
        width: 12,
        height: 6,
      }),
      
      new cloudwatch.GraphWidget({
        title: 'Profile Operation Latency',
        left: [
          this.createMetric('ProfileCreationLatency', 'Milliseconds', 'Profiles', cloudwatch.Statistic.AVERAGE),
          this.createMetric('ProfileUpdateLatency', 'Milliseconds', 'Profiles', cloudwatch.Statistic.AVERAGE),
          this.createMetric('ProfileViewLatency', 'Milliseconds', 'Profiles', cloudwatch.Statistic.AVERAGE),
          this.createMetric('PhotoUploadLatency', 'Milliseconds', 'Profiles', cloudwatch.Statistic.AVERAGE),
        ],
        width: 12,
        height: 6,
      }),
      
      new cloudwatch.LogQueryWidget({
        title: 'Recent Profile Service Errors',
        logGroupNames: [
          `/aws/lambda/perfect-match-${props.config.environment}-profile-service`,
          `/perfect-match/${props.config.environment}/profile-service`,
        ],
        queryString: 'fields @timestamp, @message | filter level="error" | sort @timestamp desc | limit 20',
        width: 24,
        height: 8,
      })
    );
    
    // Add more service dashboards...
  }
  
  /**
   * Create business-level dashboards for monitoring key business metrics
   */
  private createBusinessDashboards(props: MonitoringStackProps) {
    const dashboardPrefix = `PerfectMatch-${props.config.environment}`;
    
    // User activity dashboard
    const userActivityDashboard = new cloudwatch.Dashboard(this, 'UserActivityDashboard', {
      dashboardName: `${dashboardPrefix}-User-Activity`,
    });
    
    this.dashboards['userActivity'] = userActivityDashboard;
    
    // Add widgets to user activity dashboard
    userActivityDashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: `# User Activity Dashboard
          \n## Key Business Metrics for User Engagement
          \nMonitors sign-ups, active users, sessions, and user actions`,
        width: 24,
        height: 2,
      }),
      
      new cloudwatch.GraphWidget({
        title: 'User Growth',
        left: [
          this.createMetric('NewUsers', 'Count', 'Business'),
          this.createMetric('DailyActiveUsers', 'Count', 'Business'),
          this.createMetric('MonthlyActiveUsers', 'Count', 'Business'),
        ],
        width: 12,
        height: 6,
      }),
      
      new cloudwatch.GraphWidget({
        title: 'Session Activity',
        left: [
          this.createMetric('SessionCount', 'Count', 'Business'),
          this.createMetric('AvgSessionDuration', 'Seconds', 'Business', cloudwatch.Statistic.AVERAGE),
          this.createMetric('BounceRate', 'Percent', 'Business', cloudwatch.Statistic.AVERAGE),
        ],
        width: 12,
        height: 6,
      }),
      
      new cloudwatch.GraphWidget({
        title: 'User Actions',
        left: [
          this.createMetric('ProfileViews', 'Count', 'Business'),
          this.createMetric('MessagesExchanged', 'Count', 'Business'),
          this.createMetric('MatchRequestsSent', 'Count', 'Business'),
        ],
        width: 12,
        height: 6,
      }),
      
      new cloudwatch.GraphWidget({
        title: 'Engagement Metrics',
        left: [
          this.createMetric('DailyReturningUsers', 'Count', 'Business'),
          this.createMetric('UserRetentionRate', 'Percent', 'Business', cloudwatch.Statistic.AVERAGE),
          this.createMetric('ChurnRate', 'Percent', 'Business', cloudwatch.Statistic.AVERAGE),
        ],
        width: 12,
        height: 6,
      })
    );
    
    // Add more business dashboards...
  }
  
  /**
   * Create infrastructure-level dashboards for monitoring AWS resources
   */
  private createInfrastructureDashboards(props: MonitoringStackProps) {
    const dashboardPrefix = `PerfectMatch-${props.config.environment}`;
    
    // System dashboard for overall AWS infrastructure
    const systemDashboard = new cloudwatch.Dashboard(this, 'SystemDashboard', {
      dashboardName: `${dashboardPrefix}-System`,
    });
    
    this.dashboards['system'] = systemDashboard;
    
    // Add widgets for system dashboard
    const widgets: cloudwatch.IWidget[] = [];
    
    // Title widget
    widgets.push(
      new cloudwatch.TextWidget({
        markdown: `# System Infrastructure Dashboard
          \n## Key Metrics for AWS Resources
          \nMonitors compute, database, network, and storage resources`,
        width: 24,
        height: 2,
      })
    );
    
    // Lambda metrics if available
    if (props.lambdaFunctions && Object.keys(props.lambdaFunctions).length > 0) {
      const lambdaMetrics: cloudwatch.IMetric[] = [];
      
      // Add each lambda's invocation metric
      Object.values(props.lambdaFunctions).forEach(func => {
        lambdaMetrics.push(func.metricInvocations());
      });
      
      widgets.push(
        new cloudwatch.GraphWidget({
          title: 'Lambda Invocations',
          left: lambdaMetrics,
          width: 12,
          height: 6,
        })
      );
      
      // Lambda errors
      const lambdaErrorMetrics: cloudwatch.IMetric[] = [];
      Object.values(props.lambdaFunctions).forEach(func => {
        lambdaErrorMetrics.push(func.metricErrors());
      });
      
      widgets.push(
        new cloudwatch.GraphWidget({
          title: 'Lambda Errors',
          left: lambdaErrorMetrics,
          width: 12,
          height: 6,
        })
      );
    }
    
    // RDS metrics if available
    if (props.databaseCluster) {
      widgets.push(
        new cloudwatch.GraphWidget({
          title: 'Database CPU Utilization',
          left: [props.databaseCluster.metricCPUUtilization()],
          width: 12,
          height: 6,
        }),
        
        new cloudwatch.GraphWidget({
          title: 'Database Connections',
          left: [props.databaseCluster.metricDatabaseConnections()],
          width: 12,
          height: 6,
        })
      );
    }
    
    // Add widgets to dashboard
    systemDashboard.addWidgets(...widgets);
  }
  
  /**
   * Create service-level alarms for application components
   */
  private createServiceAlarms(props: MonitoringStackProps) {
    const env = props.config.environment;
    
    // Auth service alarms
    this.createAlarm(
      'AuthFailuresAlarm',
      this.createMetric('SignInFailures', 'Count', 'Auth'),
      20, // threshold
      2, // evaluationPeriods
      cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      `High number of authentication failures in ${env} environment`,
      cloudwatch.TreatMissingData.NOT_BREACHING,
      this.alarmTopic
    );
    
    this.createAlarm(
      'TokenRefreshFailuresAlarm',
      this.createMetric('TokenRefreshFailures', 'Count', 'Auth'),
      10, // threshold
      2, // evaluationPeriods
      cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      `High number of token refresh failures in ${env} environment`,
      cloudwatch.TreatMissingData.NOT_BREACHING,
      this.alarmTopic
    );
    
    // API Latency alarms
    this.createAlarm(
      'HighAuthLatencyAlarm',
      this.createMetric('SignInLatency', 'Milliseconds', 'Auth', cloudwatch.Statistic.AVERAGE),
      1000, // threshold (1 second)
      3, // evaluationPeriods
      cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      `High authentication latency in ${env} environment`,
      cloudwatch.TreatMissingData.NOT_BREACHING,
      this.alarmTopic
    );
    
    // Add more service alarms as needed
  }
  
  /**
   * Create business-level alarms for key metrics
   */
  private createBusinessAlarms(props: MonitoringStackProps) {
    const env = props.config.environment;
    
    // Only create critical business alarms in production
    if (env === 'prod') {
      // User engagement alarm
      this.createAlarm(
        'DailyActiveUsersAlarm',
        this.createMetric('DailyActiveUsers', 'Count', 'Business'),
        props.config.environment === 'prod' ? 100 : 10, // threshold based on environment
        1, // evaluationPeriods
        cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
        `Daily active users below threshold in ${env} environment`,
        cloudwatch.TreatMissingData.BREACHING,
        this.criticalAlarmTopic
      );
      
      // High churn rate alarm
      this.createAlarm(
        'HighChurnRateAlarm',
        this.createMetric('ChurnRate', 'Percent', 'Business', cloudwatch.Statistic.AVERAGE),
        5, // threshold (5%)
        1, // evaluationPeriods
        cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        `Churn rate above threshold in ${env} environment`,
        cloudwatch.TreatMissingData.NOT_BREACHING,
        this.criticalAlarmTopic
      );
    }
    
    // Add more business alarms as needed
  }
  
  /**
   * Create infrastructure-level alarms for AWS resources
   */
  private createInfrastructureAlarms(props: MonitoringStackProps) {
    const env = props.config.environment;
    
    // Lambda errors alarm
    if (props.lambdaFunctions) {
      Object.entries(props.lambdaFunctions).forEach(([name, func]) => {
        this.createAlarm(
          `${name}ErrorsAlarm`,
          func.metricErrors(),
          5, // threshold
          2, // evaluationPeriods
          cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
          `High error rate in ${name} Lambda function in ${env} environment`,
          cloudwatch.TreatMissingData.NOT_BREACHING,
          this.alarmTopic
        );
      });
    }
    
    // Database alarms
    if (props.databaseCluster) {
      this.createAlarm(
        'DatabaseCpuAlarm',
        props.databaseCluster.metricCPUUtilization(),
        80, // threshold (80%)
        3, // evaluationPeriods
        cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        `High CPU utilization in database in ${env} environment`,
        cloudwatch.TreatMissingData.NOT_BREACHING,
        this.alarmTopic
      );
      
      this.createAlarm(
        'DatabaseConnectionsAlarm',
        props.databaseCluster.metricDatabaseConnections(),
        props.config.environment === 'prod' ? 100 : 50, // threshold based on environment
        3, // evaluationPeriods
        cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        `High number of database connections in ${env} environment`,
        cloudwatch.TreatMissingData.NOT_BREACHING,
        this.alarmTopic
      );
    }
    
    // Add more infrastructure alarms as needed
  }
}
