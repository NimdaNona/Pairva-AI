import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';
import { PerfectMatchConfig } from './config';
import { WafStack } from './waf-stack';

/**
 * Network stack properties including configuration
 */
export interface NetworkStackProps extends cdk.StackProps {
  config: PerfectMatchConfig;
}

/**
 * Stack for networking resources including VPC, subnets, and security groups
 */
export class NetworkStack extends cdk.Stack {
  // Public properties exposed for other stacks
  public readonly vpc: ec2.Vpc;
  public readonly appSecurityGroup: ec2.SecurityGroup;
  public readonly databaseSecurityGroup: ec2.SecurityGroup;
  public readonly redisSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);

    // Create flow logs for VPC traffic monitoring
    const flowLogGroup = new logs.LogGroup(this, 'VpcFlowLogs', {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create the VPC with public, private and isolated subnets
    this.vpc = new ec2.Vpc(this, 'PerfectMatchVpc', {
      vpcName: `perfect-match-vpc-${props.config.environment}`,
      cidr: props.config.vpcCidr,
      maxAzs: props.config.availabilityZones.length,
      subnetConfiguration: [
        {
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: 'isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
      flowLogs: {
        'flowLog': {
          destination: ec2.FlowLogDestination.toCloudWatchLogs(flowLogGroup),
          trafficType: ec2.FlowLogTrafficType.ALL,
        },
      },
      natGateways: props.config.environment === 'prod' ? 3 : 1,
      enableDnsHostnames: true,
      enableDnsSupport: true,
    });

    // Create security group for application servers
    this.appSecurityGroup = new ec2.SecurityGroup(this, 'AppSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for application servers',
      allowAllOutbound: true,
    });

    // Create security group for database instances
    this.databaseSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for database instances',
      allowAllOutbound: false,
    });

    // Create security group for Redis instances
    this.redisSecurityGroup = new ec2.SecurityGroup(this, 'RedisSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for Redis instances',
      allowAllOutbound: false,
    });

    // Allow app to connect to database
    this.databaseSecurityGroup.addIngressRule(
      this.appSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow PostgreSQL access from app'
    );

    // Allow app to connect to DocumentDB
    this.databaseSecurityGroup.addIngressRule(
      this.appSecurityGroup,
      ec2.Port.tcp(27017),
      'Allow DocumentDB access from app'
    );

    // Allow app to connect to Redis
    this.redisSecurityGroup.addIngressRule(
      this.appSecurityGroup,
      ec2.Port.tcp(6379),
      'Allow Redis access from app'
    );

    // VPC Endpoints for AWS services
    // S3 VPC Gateway Endpoint
    this.vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    // ECR and SecretsManager VPC Interface Endpoints
    if (props.config.environment !== 'dev') {
      // These endpoints have costs associated, so we only include them in staging/prod
      this.vpc.addInterfaceEndpoint('ECRDockerEndpoint', {
        service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
        privateDnsEnabled: true,
        subnets: {
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      });

      this.vpc.addInterfaceEndpoint('ECREndpoint', {
        service: ec2.InterfaceVpcEndpointAwsService.ECR,
        privateDnsEnabled: true,
        subnets: {
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      });

      this.vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
        service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
        privateDnsEnabled: true,
        subnets: {
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      });

      this.vpc.addInterfaceEndpoint('CloudWatchLogsEndpoint', {
        service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
        privateDnsEnabled: true,
        subnets: {
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      });
    }

    // Export network resource ARNs and IDs
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      exportName: `${id}-vpc-id`,
      description: 'VPC ID',
    });

    new cdk.CfnOutput(this, 'AppSecurityGroupId', {
      value: this.appSecurityGroup.securityGroupId,
      exportName: `${id}-app-sg-id`,
      description: 'Application Security Group ID',
    });

    new cdk.CfnOutput(this, 'DatabaseSecurityGroupId', {
      value: this.databaseSecurityGroup.securityGroupId,
      exportName: `${id}-db-sg-id`,
      description: 'Database Security Group ID',
    });

    new cdk.CfnOutput(this, 'RedisSecurityGroupId', {
      value: this.redisSecurityGroup.securityGroupId,
      exportName: `${id}-redis-sg-id`,
      description: 'Redis Security Group ID',
    });
  }
}
