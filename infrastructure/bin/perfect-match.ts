#!/usr/bin/env node
import 'dotenv/config';
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../lib/network-stack';
import { WafStack } from '../lib/waf-stack';
import { DataStack } from '../lib/data-stack';
import { StorageStack } from '../lib/storage-stack';
import { DomainStack } from '../lib/domain-stack';
import { PipelineStack } from '../lib/pipeline-stack';
import { AiMatchingStack } from '../lib/ai-matching-stack';
import { getConfig } from '../lib/config';

const app = new cdk.App();
const config = getConfig(app);

// Create a unique ID for this deployment
const id = `perfect-match-${config.environment}`;

// Network stack (VPC, subnets, security groups)
const networkStack = new NetworkStack(app, `${id}-network`, {
  env: {
    account: config.account,
    region: config.region
  },
  config
});

// Data stack (RDS, DocumentDB, ElastiCache)
const dataStack = new DataStack(app, `${id}-data`, {
  env: {
    account: config.account,
    region: config.region
  },
  vpc: networkStack.vpc,
  config
});

// Storage stack (S3, CloudFront)
const storageStack = new StorageStack(app, `${id}-storage`, {
  env: {
    account: config.account,
    region: config.region
  },
  config
});

// Domain stack (Route53, ACM certificates, domain mappings)
const domainStack = new DomainStack(app, `${id}-domain`, {
  env: {
    account: config.account,
    region: config.region
  },
  config,
  cloudfrontDistribution: storageStack.cloudFrontDistribution
});

// AI Matching stack
const aiMatchingStack = new AiMatchingStack(app, `${id}-ai-matching`, {
  env: {
    account: config.account,
    region: config.region
  },
  stage: config.environment,
  vpc: networkStack.vpc,
  // Note: In a future update, we'll need to create Cognito resources in a separate auth stack
  userPool: null as any, // Placeholder until we implement auth stack
  userPoolClient: null as any, // Placeholder until we implement auth stack
  dbCluster: dataStack.postgresInstance as any, // Using database instance until we migrate to cluster
  dbSecret: dataStack.postgresCredentialsSecret,
  mongoDbCluster: dataStack.documentDbCluster,
  mongoDbSecret: dataStack.documentDbCredentialsSecret
});

// WAF stack for API Gateway and CloudFront
const wafStack = new WafStack(app, `${id}-waf`, {
  env: {
    account: config.account,
    region: config.region
  },
  config,
  // API Gateway and CloudFront would be passed here when ready
  // apiGateway: apiStack.api,
  // cloudfrontDistribution: storageStack.cloudFrontDistribution
});

// CI/CD Pipeline stack
const pipelineStack = new PipelineStack(app, `${id}-pipeline`, {
  env: {
    account: config.account,
    region: config.region
  },
  config
});

// Add tags to all stacks
const stacks = [networkStack, dataStack, storageStack, domainStack, wafStack, pipelineStack];
stacks.forEach(stack => {
  cdk.Tags.of(stack).add('Project', 'PerfectMatch');
  cdk.Tags.of(stack).add('Environment', config.environment);
  cdk.Tags.of(stack).add('ManagedBy', 'CDK');
});

app.synth();
