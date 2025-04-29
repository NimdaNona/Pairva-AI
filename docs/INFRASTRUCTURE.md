# Infrastructure Documentation

This document outlines the infrastructure architecture of the PerfectMatch application, deployed on AWS.

## Overview

The infrastructure is defined using AWS CDK (Cloud Development Kit) in TypeScript, allowing for infrastructure as code. The application is deployed across multiple environments (dev, staging, production) with different resource configurations for each environment.

## Architecture Components

### Network Stack
- **VPC**: Isolated network environment with public, private, and isolated subnets
- **Security Groups**: Controlled access between application components
- **NAT Gateways**: For outbound internet access from private subnets
- **VPC Endpoints**: For secure access to AWS services without internet exposure

### Data Stack
- **PostgreSQL RDS**: Relational database for user data, auth, and relationships
- **MongoDB (DocumentDB)**: For storing questionnaire data, profile details, and other flexible schema data
- **Redis Cluster**: For caching, real-time messaging, and session management

### Storage Stack
- **S3 Buckets**:
  - **Media Bucket**: User-uploaded content (profile photos, etc.)
  - **Assets Bucket**: Frontend static assets
  - **Logs Bucket**: Access logs and audit trails
- **CloudFront CDN**: Content delivery network for global distribution of static assets

### Domain & DNS Stack
- **Route 53 Configuration**: DNS management for pairva.ai domain
- **ACM Certificates**: SSL/TLS certificates for secure communication
- **Domain Mappings**:
  - Root domain (pairva.ai) -> CloudFront distribution
  - www subdomain (www.pairva.ai) -> CloudFront distribution
  - API subdomain (api.pairva.ai) -> API Gateway
  - Additional subdomains as needed for services

### AI Matching Stack
- **Vector Database**: For storing embeddings used in AI matching
- **ML Model Integration**: AWS SageMaker for personality matching algorithms
- **Similarity Search Services**: For rapid matching and recommendations

### CI/CD Pipeline
- **CodeCommit Repository**: Source code version control
- **CodeBuild Projects**: For building and testing frontend and backend
- **CodePipeline**: Orchestrates the build, test, and deployment processes
- **Deployment Environments**: Configurable dev, staging, and production environments

## Environment Configuration

The infrastructure is configured for three environments:

### Development
- Minimal resources for cost-optimization
- Single-node databases, minimal replicas
- Developer-focused features (faster deployments, easier debugging)

### Staging
- Similar to production but with reduced capacity
- Used for testing new features in a production-like environment
- Isolated from production data

### Production
- Highly available and redundant architecture
- Multi-AZ deployments for critical components
- Auto-scaling for handling production loads
- Enhanced monitoring and alerting

## Security Features

- **Network Isolation**: VPC with proper subnet segregation
- **Encryption**: Data encrypted at rest and in transit
- **IAM Roles**: Least privilege access for all services
- **Security Groups**: Restrictive inbound/outbound rules
- **WAF**: (Production) Web Application Firewall for protecting against common attacks
- **CloudTrail**: Audit logging for all API calls

## Monitoring and Logging

- **CloudWatch Alarms**: For resource utilization and application metrics
- **CloudWatch Logs**: Centralized logging for all components
- **X-Ray**: Distributed tracing for request flows
- **SNS Notifications**: For critical alerts

## DNS & Domain Configuration

The application uses custom domains with SSL/TLS encryption:

- **Primary Domain**: pairva.ai
- **Frontend**: Served via CloudFront at www.pairva.ai and pairva.ai
- **API**: api.pairva.ai, mapped to API Gateway
- **SSL/TLS**: ACM certificates for all domains and subdomains
- **DNS Management**: Route 53 hosted zone with appropriate record sets

## Deployment Process

The CI/CD pipeline automates the deployment process:

1. Code is pushed to the repository (branch-based deployments)
2. CodePipeline triggers the build and test process
3. Backend is built, tested, and containerized
4. Frontend is built, tested, and deployed to S3/CloudFront
5. For production, a manual approval step is required
6. Infrastructure changes are applied via CDK deployment

## Resource Scaling

Resources are configured to scale based on environment and load:

- **Compute**: ECS services with auto-scaling based on CPU/memory
- **Database**: RDS and DocumentDB with instance class appropriate for environment
- **Cache**: Redis shards and replicas scaled according to environment
- **Storage**: S3 buckets with lifecycle policies for cost optimization

## Cost Optimization

- Development environment uses minimal resources
- Auto-scaling to match demand
- Lifecycle policies for S3 storage
- Reserved instances for production databases
- Spot instances for non-critical workloads

## Infrastructure Management Commands

```bash
# Deploy infrastructure to development environment
cd infrastructure
npm run deploy:dev

# Deploy infrastructure to staging environment
npm run deploy:staging

# Deploy infrastructure to production environment
npm run deploy:prod

# Destroy development environment (use with caution)
npm run destroy:dev
```

## Infrastructure Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐            │
│  │ Route53     │     │ CloudFront  │     │  ACM        │            │
│  │ DNS Records │━━━━>│ Distribution│<━━━━│ Certificate │            │
│  └─────────────┘     └──────┬──────┘     └─────────────┘            │
│                             │                                       │
│                      ┌──────▼──────┐                                │
│                      │    S3       │                                │
│                      │ Static Site │                                │
│                      └──────┬──────┘                                │
│                             │                                       │
│  ┌─────────────┐      ┌─────▼─────┐      ┌─────────────┐            │
│  │  API        │      │           │      │  ECS        │            │
│  │  Gateway    │<━━━━>│    VPC    │<━━━━>│  Container  │            │
│  └─────────────┘      │           │      │  Services   │            │
│                       └─────┬─────┘      └─────────────┘            │
│                             │                                       │
│       ┌────────────┐  ┌─────▼─────┐  ┌────────────┐                 │
│       │            │  │           │  │            │                 │
│       │  Redis     │<>│  RDS      │<>│ DocumentDB │                 │
│       │  Cache     │  │ PostgreSQL│  │ MongoDB    │                 │
│       └────────────┘  └───────────┘  └────────────┘                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
