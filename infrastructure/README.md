# Perfect Match Infrastructure

This directory contains the AWS CDK (Cloud Development Kit) code for deploying the Perfect Match application infrastructure. The infrastructure is defined as code using TypeScript and is organized into modular stacks.

## Architecture Overview

The infrastructure consists of the following stacks:

- **Network Stack**: VPC, subnets, security groups, VPC endpoints
- **Data Stack**: PostgreSQL RDS, DocumentDB, ElastiCache Redis
- **Storage Stack**: S3 buckets, CloudFront distribution
- **Pipeline Stack**: CI/CD pipeline with CodeCommit, CodeBuild, CodePipeline

For a detailed overview of the infrastructure architecture, see [INFRASTRUCTURE.md](../docs/INFRASTRUCTURE.md).

## Prerequisites

- [Node.js](https://nodejs.org/) (v14 or later)
- [AWS CLI](https://aws.amazon.com/cli/) installed and configured
- [AWS CDK](https://aws.amazon.com/cdk/) installed globally: `npm install -g aws-cdk`
- AWS account with appropriate permissions

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the appropriate environment file for your target environment:

```bash
# For development
cp .env.dev .env

# For staging
cp .env.staging .env

# For production
cp .env.prod .env
```

3. Edit the `.env` file to update any environment-specific configurations, especially:
   - AWS account ID
   - AWS region
   - Email addresses for notifications
   - Resource sizing parameters

## Deployment

### Bootstrap the AWS Environment (First Time Only)

Before deploying CDK stacks for the first time in an AWS account/region, you need to bootstrap the environment:

```bash
cdk bootstrap aws://ACCOUNT-NUMBER/REGION
```

### Synthesize CloudFormation Templates

To review the CloudFormation templates that will be generated:

```bash
cdk synth
```

This will generate the CloudFormation templates in the `cdk.out` directory without deploying any resources.

### Deploy All Stacks

To deploy all stacks to the specified environment:

```bash
# Deploy to development (default)
cdk deploy --all --context environment=dev

# Deploy to staging
cdk deploy --all --context environment=staging

# Deploy to production
cdk deploy --all --context environment=prod
```

### Deploy Specific Stacks

To deploy specific stacks only:

```bash
# Example: Deploy only network and data stacks
cdk deploy perfect-match-dev-network perfect-match-dev-data
```

### Compare Changes Before Deployment

To see what changes will be made before deploying:

```bash
cdk diff
```

### Destroy Resources

To remove all deployed resources (use with caution, especially in production):

```bash
cdk destroy --all
```

## Stack Outputs

After deployment, each stack will output important resource identifiers and endpoints. These can be used for configuring the application.

Examples of stack outputs:
- VPC ID
- Security Group IDs
- Database endpoints and connection details
- S3 bucket names
- CloudFront distribution URL

## Environment Configuration

The infrastructure supports multiple environments (dev, staging, prod) with environment-specific configurations:

| Aspect | Development | Staging | Production |
|--------|-------------|---------|------------|
| RDS Instance | db.t3.micro | db.t3.small | db.m6g.large |
| DocumentDB | Single instance | 2 instances | 3 instances |
| Redis | Single node, no replicas | 1 shard, 1 replica | 2 shards, 2 replicas |
| NAT Gateways | 1 | 1 | 3 (one per AZ) |
| VPC Endpoints | Minimal | Comprehensive | Comprehensive |
| CloudFront | Price Class 100 | Price Class 100 | Price Class All |
| Monitoring | Basic | Enhanced | Enhanced |

## Directory Structure

```
infrastructure/
├── bin/                     # Entry point for CDK app
│   └── perfect-match.ts     # Main CDK application definition
├── lib/                     # Stack definitions
│   ├── config.ts            # Configuration management
│   ├── network-stack.ts     # VPC, subnets, security groups
│   ├── data-stack.ts        # RDS, DocumentDB, ElastiCache
│   ├── storage-stack.ts     # S3 buckets, CloudFront
│   └── pipeline-stack.ts    # CI/CD Pipeline
├── .env.dev                 # Development environment configuration
├── .env.staging             # Staging environment configuration
├── .env.prod                # Production environment configuration
├── cdk.json                 # CDK configuration
├── package.json             # Node.js dependencies
└── tsconfig.json            # TypeScript configuration
```

## Monitoring and Logging

The infrastructure includes:
- CloudWatch Dashboards for service monitoring
- CloudWatch Alarms for critical metrics
- CloudWatch Logs for centralized logging
- SNS topics for notifications

## Security

Security features in the infrastructure:
- Encryption at rest for all data stores
- Encryption in transit (TLS) for all communications
- IAM roles with least privilege principles
- Security groups with strict access controls
- VPC design with proper isolation
- Secrets management for credentials

## Cost Optimization

Cost optimization strategies:
- Environment-specific resource sizing
- Auto-scaling for demand-based resources
- S3 lifecycle policies for storage cost management
- Reserved Instances consideration for production

## Troubleshooting

Common issues and solutions:

- **CDK Bootstrap Error**: Ensure you've bootstrapped the AWS environment for CDK
- **Deployment Failure**: Check CloudFormation events in AWS console for detailed error messages
- **Permission Issues**: Ensure your AWS credentials have sufficient permissions
- **Resource Limit Errors**: Request limit increases from AWS if needed

## Next Steps

After successfully deploying the infrastructure:
1. Set up the application code repositories
2. Configure the CI/CD pipeline for application deployment
3. Deploy the initial application components
