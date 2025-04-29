import * as cdk from 'aws-cdk-lib';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codedeploy from 'aws-cdk-lib/aws-codedeploy';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as codecommit from 'aws-cdk-lib/aws-codecommit';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as chatbot from 'aws-cdk-lib/aws-chatbot';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { PerfectMatchConfig } from './config';

/**
 * Pipeline stack properties including configuration
 */
export interface EnhancedPipelineStackProps extends cdk.StackProps {
  config: PerfectMatchConfig;
  ecsCluster?: ecs.Cluster;
  ecsService?: ecs.FargateService;
  loadBalancer?: elbv2.ApplicationLoadBalancer;
  productionListener?: elbv2.ApplicationListener;
  testListener?: elbv2.ApplicationListener;
  vpc?: ec2.Vpc;
}

/**
 * Deployment strategy options
 */
export enum DeploymentStrategy {
  BLUE_GREEN = 'BLUE_GREEN',
  ROLLING = 'ROLLING',
  ALL_AT_ONCE = 'ALL_AT_ONCE'
}

/**
 * Traffic routing configuration for blue/green deployments
 */
export interface TrafficRoutingConfig {
  type: 'ALL_AT_ONCE' | 'TIME_BASED' | 'LINEAR';
  timeBasedCanary?: {
    stepPercentage: number;
    intervalMinutes: number;
  };
  timeBasedLinear?: {
    stepPercentage: number;
    intervalMinutes: number;
  };
}

/**
 * Enhanced Stack for CI/CD pipeline including comprehensive testing and zero-downtime deployments
 */
export class EnhancedPipelineStack extends cdk.Stack {
  // Public properties exposed for other stacks
  public readonly pipeline: codepipeline.Pipeline;
  public readonly artifactBucket: s3.Bucket;
  public readonly repository: codecommit.Repository;
  public readonly ecrRepository: ecr.Repository;
  public readonly deploymentGroup: codedeploy.EcsDeploymentGroup;
  public readonly rollbackAlarmTopic: sns.Topic;
  public readonly deploymentApplication: codedeploy.EcsApplication;
  public readonly rollbackAlarms: cloudwatch.Alarm[] = [];

  constructor(scope: Construct, id: string, props: EnhancedPipelineStackProps) {
    super(scope, id, props);

    const env = props.config.environment;

    // Create artifact bucket with improved security and lifecycle rules
    this.artifactBucket = new s3.Bucket(this, 'ArtifactBucket', {
      bucketName: `perfect-match-artifacts-${env}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      lifecycleRules: [
        {
          id: 'ExpireOldArtifacts',
          enabled: true,
          expiration: cdk.Duration.days(30),
          noncurrentVersionExpiration: cdk.Duration.days(7),
        },
        {
          id: 'TransitionToInfrequentAccess',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(7),
            },
          ],
        },
      ],
      versioned: true, // Enable versioning for better artifact management
    });

    // Create ECR repository for Docker images
    this.ecrRepository = new ecr.Repository(this, 'ECRRepository', {
      repositoryName: `perfect-match-${env}`,
      removalPolicy: env === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      lifecycleRules: [
        {
          // Keep only the last 10 images for non-production environments
          maxImageCount: env === 'prod' ? 100 : 10,
          rulePriority: 1,
        },
        {
          // Remove untagged images after 14 days
          tagStatus: ecr.TagStatus.UNTAGGED,
          maxImageAge: cdk.Duration.days(14),
          rulePriority: 2,
        },
      ],
      imageScanOnPush: true, // Enable security scanning on push
    });

    // Create CodeCommit repository if needed
    this.repository = new codecommit.Repository(this, 'Repository', {
      repositoryName: props.config.repositoryName,
      description: 'Perfect Match application repository',
    });

    // Create SNS topic for pipeline notifications with enhanced event filtering
    const pipelineNotificationTopic = new sns.Topic(this, 'PipelineNotifications', {
      topicName: `perfect-match-pipeline-notifications-${env}`,
      displayName: 'Perfect Match Pipeline Notifications',
    });

    // Create SNS topic for deployment rollbacks
    this.rollbackAlarmTopic = new sns.Topic(this, 'RollbackAlarmTopic', {
      topicName: `perfect-match-rollback-alarms-${env}`,
      displayName: 'Perfect Match Deployment Rollback Alarms',
    });

    // Add email subscription to the SNS topics
    pipelineNotificationTopic.addSubscription(
      new subscriptions.EmailSubscription(props.config.alarmEmail)
    );
    
    this.rollbackAlarmTopic.addSubscription(
      new subscriptions.EmailSubscription(props.config.alarmEmail)
    );

    // Add Slack notification for critical events (if configured)
    if (props.config.slackWorkspaceId && props.config.slackChannelId) {
      const slackNotifications = new chatbot.SlackChannelConfiguration(this, 'SlackNotifications', {
        slackChannelConfigurationName: `perfect-match-slack-${env}`,
        slackWorkspaceId: props.config.slackWorkspaceId,
        slackChannelId: props.config.slackChannelId,
        notificationTopics: [pipelineNotificationTopic, this.rollbackAlarmTopic],
      });
    }

    // Create the Source Artifact
    const sourceOutput = new codepipeline.Artifact('SourceOutput');

    // Create separate artifacts for each component
    const backendBuildOutput = new codepipeline.Artifact('BackendBuildOutput');
    const frontendBuildOutput = new codepipeline.Artifact('FrontendBuildOutput');
    const testOutput = new codepipeline.Artifact('TestOutput');

    // Create source stage with improved trigger options
    const sourceAction = new codepipeline_actions.CodeCommitSourceAction({
      actionName: 'Source',
      repository: this.repository,
      branch: props.config.branchName,
      output: sourceOutput,
      trigger: codepipeline_actions.CodeCommitTrigger.EVENTS, // Use CloudWatch Events for faster triggering
      eventRole: new iam.Role(this, 'EventRole', {
        assumedBy: new iam.ServicePrincipal('events.amazonaws.com'),
      }),
    });

    // Create a dedicated test project for comprehensive testing
    const testProject = new codebuild.PipelineProject(this, 'TestProject', {
      projectName: `perfect-match-tests-${env}`,
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
        privileged: true, // Needed for E2E tests with browsers
        computeType: codebuild.ComputeType.MEDIUM, // Increased compute for faster tests
        environmentVariables: {
          NODE_ENV: { value: 'test' },
          CI: { value: 'true' },
          AWS_ACCOUNT_ID: { value: props.config.account },
          AWS_REGION: { value: props.config.region },
        },
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            'runtime-versions': {
              nodejs: '16',
            },
            commands: [
              'echo Installing dependencies...',
              'npm ci', // Install root dependencies
              'cd backend && npm ci',
              'cd ../frontend && npm ci',
            ],
          },
          pre_build: {
            commands: [
              'echo Running linting...',
              'cd backend && npm run lint',
              'cd ../frontend && npm run lint',
            ],
          },
          build: {
            commands: [
              // Backend unit tests
              'echo Running backend unit tests...',
              'cd backend && npm run test',
              
              // Backend integration tests
              'echo Running backend integration tests...',
              'cd backend && npm run test:integration',
              
              // Frontend unit tests
              'echo Running frontend unit tests...',
              'cd ../frontend && npm run test',
              
              // End-to-end tests (if environment supports it)
              `if [ "$NODE_ENV" != "prod" ]; then
                echo Starting services for E2E tests...
                docker-compose -f docker-compose.test.yml up -d
                echo Running E2E tests...
                cd frontend && npm run test:e2e
                echo Stopping test services...
                docker-compose -f docker-compose.test.yml down
              fi`,
            ],
          },
          post_build: {
            commands: [
              'echo Tests completed',
              'echo Generating test reports...',
              'mkdir -p test-reports',
              'cp -r backend/coverage test-reports/backend-coverage',
              'cp -r frontend/coverage test-reports/frontend-coverage',
              'if [ -d frontend/cypress/reports ]; then cp -r frontend/cypress/reports test-reports/e2e-reports; fi',
            ],
          },
        },
        artifacts: {
          files: [
            'test-reports/**/*',
          ],
          'base-directory': '.',
        },
        cache: {
          paths: [
            'node_modules/**/*',
            'backend/node_modules/**/*',
            'frontend/node_modules/**/*',
          ],
        },
        reports: {
          UnitTestReports: {
            files: [
              'backend/junit.xml',
              'frontend/junit.xml',
            ],
            'base-directory': '.',
            'file-format': 'JUNITXML',
          },
          CoverageReports: {
            files: [
              'backend/coverage/clover.xml',
              'frontend/coverage/clover.xml',
            ],
            'base-directory': '.',
            'file-format': 'CLOVERXML',
          },
        },
      }),
      // Configure logging and timeout
      logging: {
        cloudWatch: {
          logGroup: new logs.LogGroup(this, 'TestLogs', {
            logGroupName: `/aws/codebuild/perfect-match-tests-${env}`,
            retention: logs.RetentionDays.ONE_MONTH,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
          }),
        },
      },
      timeout: cdk.Duration.minutes(30), // Longer timeout for comprehensive tests
    });

    // Create backend build project with improved Docker builds and blue/green deployment support
    const backendBuildProject = new codebuild.PipelineProject(this, 'BackendBuild', {
      projectName: `perfect-match-backend-build-${env}`,
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
        privileged: true, // Needed for Docker builds
        computeType: codebuild.ComputeType.MEDIUM, // Increased for faster builds
        environmentVariables: {
          NODE_ENV: { value: env },
          AWS_ACCOUNT_ID: { value: props.config.account },
          AWS_REGION: { value: props.config.region },
          REPOSITORY_URI: { value: this.ecrRepository.repositoryUri },
          COMMIT_HASH: { value: '$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)' },
          DEPLOYMENT_TYPE: { value: 'BLUE_GREEN' }, // Default to blue/green deployment
        },
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            'runtime-versions': {
              nodejs: '16',
            },
            commands: [
              'echo Installing backend dependencies...',
              'cd backend',
              'npm ci',
              'npm i -g @nestjs/cli' // Install NestJS CLI for improved builds
            ],
          },
          pre_build: {
            commands: [
              'echo Logging in to Amazon ECR...',
              'aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $REPOSITORY_URI',
              'COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)',
              'IMAGE_TAG=${COMMIT_HASH:=latest}',
              // Generate build info file for versioning
              'echo "{\"version\": \"$IMAGE_TAG\", \"buildTime\": \"$(date)\", \"branch\": \"$CODEBUILD_WEBHOOK_TRIGGER\", \"commit\": \"$CODEBUILD_RESOLVED_SOURCE_VERSION\"}" > build-info.json',
              // Create deployment timestamp for blue/green identification
              'DEPLOYMENT_TIME=$(date +%Y%m%d%H%M%S)',
              'echo "DEPLOYMENT_TIME=$DEPLOYMENT_TIME" >> build-info.json',
            ],
          },
          build: {
            commands: [
              'echo Building the backend with optimizations...',
              'npm run build', // Build with NestJS
              'echo Building the Docker image...',
              // Use multi-stage Docker build for smaller images with health check
              'docker build -t $REPOSITORY_URI:$IMAGE_TAG -t $REPOSITORY_URI:latest --build-arg NODE_ENV=$NODE_ENV --build-arg BUILD_VERSION=$IMAGE_TAG .',
            ],
          },
          post_build: {
            commands: [
              'echo Pushing the Docker image...',
              'docker push $REPOSITORY_URI:$IMAGE_TAG',
              'docker push $REPOSITORY_URI:latest',
              'echo Writing task definition file...',
              // Generate task definition file for blue/green deployment with enhanced health checks
              'CONTAINER_NAME="perfect-match-backend"',
              'echo \'{"family":"perfect-match-task-${NODE_ENV}","containerDefinitions":[{"name":"\'$CONTAINER_NAME\'","image":"\'$REPOSITORY_URI:$IMAGE_TAG\'","essential":true,"healthCheck":{"command":["CMD-SHELL","curl -f http://localhost:3000/api/health || exit 1"],"interval":30,"timeout":5,"retries":3,"startPeriod":60},"logConfiguration":{"logDriver":"awslogs","options":{"awslogs-group":"/ecs/perfect-match-${NODE_ENV}","awslogs-region":"${AWS_REGION}","awslogs-stream-prefix":"ecs"}},"portMappings":[{"containerPort":3000,"hostPort":3000,"protocol":"tcp"}],"environment":[{"name":"NODE_ENV","value":"${NODE_ENV}"},{"name":"BUILD_VERSION","value":"$IMAGE_TAG"},{"name":"DEPLOYMENT_TIME","value":"$DEPLOYMENT_TIME"}],"secrets":[{"name":"DB_PASSWORD","valueFrom":"db-password-arn"},{"name":"JWT_SECRET","valueFrom":"jwt-secret-arn"}]}]}\' > taskdef.json',
              // Create artifacts definitions
              'printf \'{"ImageURI":"%s"}\' $REPOSITORY_URI:$IMAGE_TAG > imageDefinition.json',
              'echo "Creating application specification file for CodeDeploy..."',
              // Enhanced appspec.json for blue/green deployment with traffic routing configuration
              'echo \'{\
                "version": 1,\
                "Resources": [\
                  {\
                    "TargetService": {\
                      "Type": "AWS::ECS::Service",\
                      "Properties": {\
                        "TaskDefinition": "<TASK_DEFINITION>",\
                        "LoadBalancerInfo": {\
                          "ContainerName": "\'$CONTAINER_NAME\'",\
                          "ContainerPort": 3000\
                        },\
                        "PlatformVersion": "LATEST",\
                        "NetworkConfiguration": {\
                          "AwsvpcConfiguration": {\
                            "Subnets": ["<SUBNET_1>", "<SUBNET_2>", "<SUBNET_3>"],\
                            "SecurityGroups": ["<SECURITY_GROUP>"],\
                            "AssignPublicIp": "DISABLED"\
                          }\
                        },\
                        "CapacityProviderStrategy": [\
                          {\
                            "Base": 1,\
                            "CapacityProvider": "FARGATE",\
                            "Weight": 1\
                          }\
                        ]\
                      }\
                    }\
                  }\
                ],\
                "Hooks": [\
                  {\
                    "BeforeInstall": "LambdaFunctionToValidateBeforeInstall",\
                    "AfterInstall": "LambdaFunctionToValidateAfterTraffic",\
                    "AfterAllowTestTraffic": "LambdaFunctionToValidateAfterTestTrafficStarts",\
                    "BeforeAllowTraffic": "LambdaFunctionToValidateBeforeAllowingProductionTraffic",\
                    "AfterAllowTraffic": "LambdaFunctionToValidateAfterProductionTraffic"\
                  }\
                ]\
              }\' > appspec.json',
              // Create a deployment configuration script for later use in the pipeline
              'echo "Creating deployment configuration script..."',
              'echo "#!/bin/bash" > deploy-config.sh',
              'echo "# This script configures the deployment strategy for CodeDeploy" >> deploy-config.sh',
              'echo "export DEPLOYMENT_GROUP_NAME=perfect-match-${NODE_ENV}-deployment" >> deploy-config.sh',
              'echo "export APPLICATION_NAME=perfect-match-${NODE_ENV}-application" >> deploy-config.sh',
              'echo "export S3_BUCKET=${CODEBUILD_RESOLVED_SOURCE_VERSION}" >> deploy-config.sh',
              'echo "export COMMIT_ID=${CODEBUILD_RESOLVED_SOURCE_VERSION}" >> deploy-config.sh',
              'chmod +x deploy-config.sh',
              // Create health check script for verification
              'echo "Creating health check script for deployment validation..."',
              'echo "#!/bin/bash" > health-check.sh',
              'echo "# This script validates the deployment by checking application health" >> health-check.sh',
              'echo "API_URL=\"https://api.${NODE_ENV}.pairva.ai/api/health\"" >> health-check.sh',
              'echo "MAX_RETRIES=30" >> health-check.sh',
              'echo "RETRY_INTERVAL=10" >> health-check.sh',
              'echo "for i in \$(seq 1 \$MAX_RETRIES); do" >> health-check.sh',
              'echo "  echo \"Attempt \$i of \$MAX_RETRIES: Checking API health...\"" >> health-check.sh',
              'echo "  RESPONSE=\$(curl -s -o /dev/null -w \"%{http_code}\" \$API_URL)" >> health-check.sh',
              'echo "  if [ \"\$RESPONSE\" = \"200\" ]; then" >> health-check.sh',
              'echo "    echo \"Health check passed: \$API_URL returned 200\"" >> health-check.sh',
              'echo "    exit 0" >> health-check.sh',
              'echo "  else" >> health-check.sh',
              'echo "    echo \"Health check failed: \$API_URL returned \$RESPONSE\"" >> health-check.sh',
              'echo "    sleep \$RETRY_INTERVAL" >> health-check.sh',
              'echo "  fi" >> health-check.sh',
              'echo "done" >> health-check.sh',
              'echo "echo \"Health check failed after \$MAX_RETRIES attempts\"" >> health-check.sh',
              'echo "exit 1" >> health-check.sh',
              'chmod +x health-check.sh',
              // Create rollback script
              'echo "Creating rollback script..."',
              'echo "#!/bin/bash" > rollback.sh',
              'echo "# This script triggers a manual rollback of a blue/green deployment" >> rollback.sh',
              'echo "DEPLOYMENT_ID=\$1" >> rollback.sh',
              'echo "if [ -z \"\$DEPLOYMENT_ID\" ]; then" >> rollback.sh',
              'echo "  echo \"Usage: rollback.sh <deployment-id>\"" >> rollback.sh',
              'echo "  echo \"Fetching latest deployment ID...\"" >> rollback.sh',
              'echo "  DEPLOYMENT_ID=\$(aws deploy list-deployments --application-name perfect-match-${NODE_ENV}-application --deployment-group-name perfect-match-${NODE_ENV}-deployment --query \"deployments[0]\" --output text)" >> rollback.sh',
              'echo "  echo \"Latest deployment ID: \$DEPLOYMENT_ID\"" >> rollback.sh',
              'echo "fi" >> rollback.sh',
              'echo "echo \"Rolling back deployment \$DEPLOYMENT_ID...\"" >> rollback.sh',
              'echo "aws deploy stop-deployment --deployment-id \$DEPLOYMENT_ID --auto-rollback-enabled" >> rollback.sh',
              'echo "echo \"Rollback initiated. Check AWS Console for status.\"" >> rollback.sh',
              'chmod +x rollback.sh',
            ],
          },
        },
        artifacts: {
          files: [
            'backend/taskdef.json',
            'backend/appspec.json',
            'backend/imageDefinition.json',
            'backend/build-info.json',
            'backend/deploy-config.sh',
            'backend/health-check.sh',
            'backend/rollback.sh',
            'backend/scripts/**/*',
          ],
          'base-directory': '.',
        },
        cache: {
          paths: [
            'backend/node_modules/**/*',
          ],
        },
      }),
    });

    // Create frontend build project with enhanced optimization
    const frontendBuildProject = new codebuild.PipelineProject(this, 'FrontendBuild', {
      projectName: `perfect-match-frontend-build-${env}`,
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
        computeType: codebuild.ComputeType.MEDIUM,
        environmentVariables: {
          NODE_ENV: { value: env },
          REACT_APP_API_URL: { value: `https://${props.config.apiSubdomain}.${props.config.domainName}` },
          REACT_APP_ENV: { value: env },
          COMMIT_HASH: { value: '$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)' },
          PUBLIC_URL: { value: `https://${props.config.domainName}` },
        },
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            'runtime-versions': {
              nodejs: '16',
            },
            commands: [
              'echo Installing frontend dependencies...',
              'cd frontend',
              'npm ci',
            ],
          },
          pre_build: {
            commands: [
              'echo Setting up build version info...',
              'COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)',
              'VERSION_TAG=${COMMIT_HASH:=latest}',
              // Create version info file for the frontend
              'echo "window.APP_VERSION=\\"$VERSION_TAG\\";" > public/version.js',
              'echo "window.APP_BUILD_TIME=\\"$(date)\\";" >> public/version.js',
              // Add deployment type info for blue/green identification
              'echo "window.DEPLOYMENT_TYPE=\\"BLUE_GREEN\\";" >> public/version.js',
              'echo "window.DEPLOYMENT_TIME=\\"$(date +%Y%m%d%H%M%S)\\";" >> public/version.js',
            ],
          },
          build: {
            commands: [
              'echo Building the frontend with optimizations...',
              'npm run build',
              // Analyze bundle size for optimization feedback
              'npm run analyze-bundle || true',
            ],
          },
          post_build: {
            commands: [
              'echo Frontend build completed on `date`',
              'echo Preparing assets for deployment...',
              // Compress static assets for better performance
              'find build -type f -name "*.js" -exec gzip -9 -k {} \\;',
              'find build -type f -name "*.css" -exec gzip -9 -k {} \\;',
              'find build -type f -name "*.html" -exec gzip -9 -k {} \\;',
              'find build -type f -name "*.json" -exec gzip -9 -k {} \\;',
              'find build -type f -name "*.svg" -exec gzip -9 -k {} \\;',
              'echo Deploying to S3 bucket with optimized caching...',
              'cd build',
              // Upload with appropriate cache settings
              'aws s3 sync --delete \
                --cache-control "max-age=31536000,public,immutable" \
                --exclude "*" \
                --include "static/js/*" \
                --include "static/css/*" \
                --include "static/media/*" \
                . s3://perfect-match-assets-$NODE_ENV/',
              'aws s3 sync --delete \
                --cache-control "max-age=86400,public" \
                --exclude "static/js/*" \
                --exclude "static/css/*" \
                --exclude "static/media/*" \
                --exclude "index.html" \
                . s3://perfect-match-assets-$NODE_ENV/',
              'aws s3 cp \
                --cache-control "max-age=0,no-cache,no-store,must-revalidate" \
                index.html s3://perfect-match-assets-$NODE_ENV/',
              'echo Creating CloudFront invalidation to refresh cache...',
              'aws cloudfront create-invalidation --distribution-id $(aws cloudformation describe-stacks --stack-name perfect-match-$NODE_ENV-storage --query "Stacks[0].Outputs[?ExportName==\'perfect-match-$NODE_ENV-storage-cloudfront-id\'].OutputValue" --output text) --paths "/*"',
            ],
          },
        },
        artifacts: {
          files: [
            'frontend/build/**/*',
            'frontend/bundle-analysis.html',
          ],
          'base-directory': '.',
        },
        cache: {
          paths: [
            'frontend/node_modules/**/*',
          ],
        },
      }),
      // Configure logging
      logging: {
        cloudWatch: {
          logGroup: new logs.LogGroup(this, 'FrontendBuildLogs', {
            logGroupName: `/aws/codebuild/perfect-match-frontend-build-${env}`,
            retention: logs.RetentionDays.ONE_MONTH,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
          }),
        },
      },
    });

    // Create a separate E2E test project for post-deployment validation
    const e2eTestProject = new codebuild.PipelineProject(this, 'E2ETest', {
      projectName: `perfect-match-e2e-test-${env}`,
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
        privileged: true, // Needed for browser testing
        computeType: codebuild.ComputeType.MEDIUM,
        environmentVariables: {
          NODE_ENV: { value: env },
          CYPRESS_BASE_URL: { value: `https://${props.config.domainName}` },
          API_URL: { value: `https://${props.config.apiSubdomain}.${props.config.domainName}` },
        },
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            'runtime-versions': {
              nodejs: '16',
            },
            commands: [
              'echo Installing E2E test dependencies...',
              'cd frontend',
              'npm ci',
            ],
          },
          build: {
            commands: [
              'echo Running post-deployment E2E tests...',
              'npm run test:e2e -- --config baseUrl=$CYPRESS_BASE_URL',
            ],
          },
          post_build: {
            commands: [
              'echo E2E tests completed on `date`',
              'mkdir -p test-reports',
              'cp -r cypress/reports test-reports/e2e-reports || true',
              'cp -r cypress/screenshots test-reports/screenshots || true',
              'cp -r cypress/videos test-reports/videos || true',
            ],
          },
        },
        artifacts: {
          files: [
            'frontend/test-reports/**/*',
          ],
          'base-directory': '.',
        },
        reports: {
          E2ETestReports: {
            files: [
              'frontend/cypress/results/*.xml',
            ],
            'base-directory': '.',
            'file-format': 'JUNITXML',
          },
        },
      }),
    });
    
    // Create health check verification project for deployment validation
    const healthCheckProject = new codebuild.PipelineProject(this, 'HealthCheck', {
      projectName: `perfect-match-health-check-${env}`,
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
        computeType: codebuild.ComputeType.SMALL,
        environmentVariables: {
          NODE_ENV: { value: env },
          API_URL: { value: `https://${props.config.apiSubdomain}.${props.config.domainName}` },
        },
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          build: {
            commands: [
              'echo "Running health check verification..."',
              'curl -f "$API_URL/api/health" || exit 1',
              'echo "Health check passed!"',
            ],
          },
        },
      }),
    });

    // Create Lambda functions for CodeDeploy hooks
    const validateDeploymentLambda = new lambda.Function(this, 'ValidateDeploymentLambda', {
      functionName: `perfect-match-validate-deployment-${env}`,
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('Deployment validation event:', JSON.stringify(event, null, 2));
          
          // Perform any custom validation logic here
          const deploymentId = event.DeploymentId;
          const lifecycleEventHookExecutionId = event.LifecycleEventHookExecutionId;
          const deploymentStatus = 'Succeeded'; // Or 'Failed' based on validation
          
          console.log(\`Deployment \${deploymentId} validation: \${deploymentStatus}\`);
          
          // Return success to CodeDeploy
          return {
            status: deploymentStatus,
            lifecycleEventHookExecutionId: lifecycleEventHookExecutionId
          };
        }
      `),
      timeout: cdk.Duration.minutes(5),
      environment: {
        NODE_ENV: env,
        API_URL: `https://${props.config.apiSubdomain}.${props.config.domainName}`,
      },
    });

    // Create CodeDeploy application for ECS blue/green deployments
    this.deploymentApplication = new codedeploy.EcsApplication(this, 'DeploymentApplication', {
      applicationName: `perfect-match-${env}-application`,
    });

    // Create CodeDeploy deployment group for ECS blue/green deployments
    if (props.ecsService && props.productionListener && props.testListener) {
      // Create rollback alarms
      const apiErrorAlarm = new cloudwatch.Alarm(this, 'ApiErrorAlarm', {
        alarmName: `perfect-match-${env}-api-errors`,
        alarmDescription: 'Alarm for API errors that should trigger a deployment rollback',
        metric: new cloudwatch.Metric({
          namespace: 'AWS/ApiGateway',
          metricName: '5XXError',
          dimensionsMap: {
            ApiName: `perfect-match-${env}-api`,
          },
          statistic: 'Sum',
          period: cdk.Duration.minutes(1),
        }),
        threshold: 5,
        evaluationPeriods: 2,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      const cpuUtilizationAlarm = new cloudwatch.Alarm(this, 'CpuUtilizationAlarm', {
        alarmName: `perfect-match-${env}-cpu-utilization`,
        alarmDescription: 'Alarm for high CPU utilization that should trigger a deployment rollback',
        metric: new cloudwatch.Metric({
          namespace: 'AWS/ECS',
          metricName: 'CPUUtilization',
          dimensionsMap: {
            ClusterName: props.ecsCluster?.clusterName || '',
            ServiceName: props.ecsService.serviceName,
          },
          statistic: 'Average',
          period: cdk.Duration.minutes(1),
        }),
        threshold: 90,
        evaluationPeriods: 3,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      this.rollbackAlarms.push(apiErrorAlarm, cpuUtilizationAlarm);

      // Create target groups for blue/green deployment
      const blueTargetGroup = new elbv2.ApplicationTargetGroup(this, 'BlueTargetGroup', {
        targetGroupName: `perfect-match-${env}-blue`,
        vpc: props.vpc!,
        port: 3000,
        protocol: elbv2.ApplicationProtocol.HTTP,
        targetType: elbv2.TargetType.IP,
        healthCheck: {
          path: '/api/health',
          timeout: cdk.Duration.seconds(5),
          interval: cdk.Duration.seconds(30),
          healthyHttpCodes: '200',
        },
      });

      const greenTargetGroup = new elbv2.ApplicationTargetGroup(this, 'GreenTargetGroup', {
        targetGroupName: `perfect-match-${env}-green`,
        vpc: props.vpc!,
        port: 3000,
        protocol: elbv2.ApplicationProtocol.HTTP,
        targetType: elbv2.TargetType.IP,
        healthCheck: {
          path: '/api/health',
          timeout: cdk.Duration.seconds(5),
          interval: cdk.Duration.seconds(30),
          healthyHttpCodes: '200',
        },
      });

      // Create deployment group
      this.deploymentGroup = new codedeploy.EcsDeploymentGroup(this, 'DeploymentGroup', {
        application: this.deploymentApplication,
        deploymentGroupName: `perfect-match-${env}-deployment`,
        service: props.ecsService,
        blueGreenDeploymentConfig: {
          deploymentApprovalWaitTime: cdk.Duration.hours(2),
          terminationWaitTime: cdk.Duration.minutes(30),
          blueTargetGroup: blueTargetGroup,
          greenTargetGroup: greenTargetGroup,
          listener: props.productionListener,
          testListener: props.testListener,
        },
        deploymentConfig: codedeploy.EcsDeploymentConfig.CANARY_10PERCENT_5MINUTES,
        alarms: this.rollbackAlarms,
        autoRollback: {
          failedDeployment: true,
          stoppedDeployment: true,
          deploymentInAlarm: true,
        },
      });

      // Add deployment validation lambda as a hook
      const deploymentRole = new iam.Role(this, 'DeploymentRole', {
        assumedBy: new iam.ServicePrincipal('codedeploy.amazonaws.com'),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('AWSCodeDeployRoleForECS'),
        ],
      });

      // Grant permissions for the lambda to invoke CodeDeploy lifecycle hooks
      validateDeploymentLambda.addPermission('InvokeByCodeDeploy', {
        principal: new iam.ServicePrincipal('codedeploy.amazonaws.com'),
        action: 'lambda:InvokeFunction',
      });
    }

    // Create the pipeline
    this.pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: `perfect-match-${env}-pipeline`,
      artifactBucket: this.artifactBucket,
      restartExecutionOnUpdate: true,
      crossAccountKeys: false, // More secure for single account deployments
    });

    // Add source stage
    this.pipeline.addStage({
      stageName: 'Source',
      actions: [sourceAction],
    });

    // Add test stage
    this.pipeline.addStage({
      stageName: 'Test',
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: 'RunTests',
          project: testProject,
          input: sourceOutput,
          outputs: [testOutput],
        }),
      ],
    });

    // Add build stage
    this.pipeline.addStage({
      stageName: 'Build',
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: 'BuildBackend',
          project: backendBuildProject,
          input: sourceOutput,
          outputs: [backendBuildOutput],
        }),
        new codepipeline_actions.CodeBuildAction({
          actionName: 'BuildFrontend',
          project: frontendBuildProject,
          input: sourceOutput,
          outputs: [frontendBuildOutput],
        }),
      ],
    });

    // Add deployment stage
    if (props.ecsService && this.deploymentGroup) {
      // Add blue/green ECS deployment action
      this.pipeline.addStage({
        stageName: 'Deploy',
        actions: [
          new codepipeline_actions.CodeDeployEcsDeployAction({
            actionName: 'DeployToECS',
            deploymentGroup: this.deploymentGroup,
            appSpecTemplateInput: backendBuildOutput,
            taskDefinitionTemplateInput: backendBuildOutput,
            containerImageInputs: [
              {
                input: backendBuildOutput,
                taskDefinitionPlaceholder: 'IMAGE_NAME',
              },
            ],
          }),
          new codepipeline_actions.CodeBuildAction({
            actionName: 'VerifyDeployment',
            project: healthCheckProject,
            input: backendBuildOutput,
            runOrder: 2, // Run after the deployment
          }),
        ],
      });

      // Add post-deployment E2E test stage
      this.pipeline.addStage({
        stageName: 'E2ETests',
        actions: [
          new codepipeline_actions.CodeBuildAction({
            actionName: 'RunE2ETests',
            project: e2eTestProject,
            input: sourceOutput,
          }),
        ],
      });
    }

    // Create notification rule for the pipeline
    const pipelineNotificationRule = new cdk.aws_codestarnotifications.NotificationRule(this, 'PipelineNotificationRule', {
      detailType: cdk.aws_codestarnotifications.DetailType.FULL,
      events: [
        'codepipeline-pipeline-pipeline-execution-succeeded',
        'codepipeline-pipeline-pipeline-execution-failed',
        'codepipeline-pipeline-manual-approval-needed',
      ],
      source: this.pipeline,
      targets: [pipelineNotificationTopic],
    });

    // Output the key resources
    new cdk.CfnOutput(this, 'PipelineConsoleUrl', {
      value: `https://console.aws.amazon.com/codepipeline/home?region=${props.config.region}#/view/${this.pipeline.pipelineName}`,
      description: 'URL to the Pipeline Console',
      exportName: `perfect-match-${env}-pipeline-console-url`,
    });

    new cdk.CfnOutput(this, 'ECRRepositoryUrl', {
      value: this.ecrRepository.repositoryUri,
      description: 'ECR Repository URI',
      exportName: `perfect-match-${env}-ecr-repository-uri`,
    });

    new cdk.CfnOutput(this, 'CodeCommitCloneUrlHttp', {
      value: this.repository.repositoryCloneUrlHttp,
      description: 'CodeCommit Repository Clone URL (HTTP)',
      exportName: `perfect-match-${env}-codecommit-clone-url-http`,
    });

    new cdk.CfnOutput(this, 'ArtifactBucketName', {
      value: this.artifactBucket.bucketName,
      description: 'Artifact Bucket Name',
      exportName: `perfect-match-${env}-artifact-bucket-name`,
    });
  }
}
