import * as cdk from 'aws-cdk-lib';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as codecommit from 'aws-cdk-lib/aws-codecommit';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as chatbot from 'aws-cdk-lib/aws-chatbot';
import { Construct } from 'constructs';
import { PerfectMatchConfig } from './config';

/**
 * Pipeline stack properties including configuration
 */
export interface PipelineStackProps extends cdk.StackProps {
  config: PerfectMatchConfig;
}

/**
 * Stack for CI/CD pipeline including CodeBuild and CodePipeline
 */
export class PipelineStack extends cdk.Stack {
  // Public properties exposed for other stacks
  public readonly pipeline: codepipeline.Pipeline;
  public readonly artifactBucket: s3.Bucket;
  public readonly repository: codecommit.Repository;

  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    const env = props.config.environment;

    // Create artifact bucket
    this.artifactBucket = new s3.Bucket(this, 'ArtifactBucket', {
      bucketName: `perfect-match-artifacts-${env}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      lifecycleRules: [
        {
          id: 'ExpireOldArtifacts',
          enabled: true,
          expiration: cdk.Duration.days(30)
        }
      ]
    });

    // Create CodeCommit repository if needed
    this.repository = new codecommit.Repository(this, 'Repository', {
      repositoryName: props.config.repositoryName,
      description: 'Perfect Match application repository',
    });

    // Create SNS topic for pipeline notifications
    const pipelineNotificationTopic = new sns.Topic(this, 'PipelineNotifications', {
      topicName: `perfect-match-pipeline-notifications-${env}`,
      displayName: 'Perfect Match Pipeline Notifications',
    });

    // Add email subscription to the SNS topic
    pipelineNotificationTopic.addSubscription(
      new subscriptions.EmailSubscription(props.config.alarmEmail)
    );

    // Create the Source Artifact
    const sourceOutput = new codepipeline.Artifact('SourceOutput');

    // Create the Build Artifact
    const buildOutput = new codepipeline.Artifact('BuildOutput');

    // Create source stage
    const sourceAction = new codepipeline_actions.CodeCommitSourceAction({
      actionName: 'Source',
      repository: this.repository,
      branch: props.config.branchName,
      output: sourceOutput,
      trigger: codepipeline_actions.CodeCommitTrigger.POLL,
    });

    // Create CI/CD Pipeline
    this.pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: `perfect-match-pipeline-${env}`,
      artifactBucket: this.artifactBucket,
      restartExecutionOnUpdate: true,
      stages: [
        {
          stageName: 'Source',
          actions: [sourceAction],
        },
      ],
    });

    // Create backend build project
    const backendBuildProject = new codebuild.PipelineProject(this, 'BackendBuild', {
      projectName: `perfect-match-backend-build-${env}`,
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
        privileged: true, // Needed for Docker builds
        computeType: codebuild.ComputeType.SMALL,
        environmentVariables: {
          NODE_ENV: { value: env },
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
              'echo Installing backend dependencies...',
              'cd backend',
              'npm ci',
            ],
          },
          pre_build: {
            commands: [
              'echo Running backend tests...',
              'npm run test',
              'echo Logging in to Amazon ECR...',
              'aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com',
            ],
          },
          build: {
            commands: [
              'echo Building the backend...',
              'npm run build',
              'echo Building the Docker image...',
              'docker build -t perfect-match-backend:$CODEBUILD_RESOLVED_SOURCE_VERSION .',
              'docker tag perfect-match-backend:$CODEBUILD_RESOLVED_SOURCE_VERSION $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/perfect-match-backend:$CODEBUILD_RESOLVED_SOURCE_VERSION',
              'docker tag perfect-match-backend:$CODEBUILD_RESOLVED_SOURCE_VERSION $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/perfect-match-backend:latest',
            ],
          },
          post_build: {
            commands: [
              'echo Pushing the Docker image...',
              'docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/perfect-match-backend:$CODEBUILD_RESOLVED_SOURCE_VERSION',
              'docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/perfect-match-backend:latest',
              'echo Writing image definitions file...',
              'aws ecr describe-images --repository-name perfect-match-backend --image-ids imageTag=latest --query imageDetails[].imageTags[0] --output text > backend-tag.txt',
            ],
          },
        },
        artifacts: {
          files: [
            'backend-tag.txt',
            'backend/dist/**/*',
            'backend/package.json',
            'backend/appspec.yml',
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

    // Create frontend build project
    const frontendBuildProject = new codebuild.PipelineProject(this, 'FrontendBuild', {
      projectName: `perfect-match-frontend-build-${env}`,
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
        computeType: codebuild.ComputeType.SMALL,
        environmentVariables: {
          NODE_ENV: { value: env },
          REACT_APP_API_URL: { value: `https://${props.config.apiSubdomain}.${props.config.domainName}` },
          REACT_APP_ENV: { value: env },
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
              'echo Running frontend tests...',
              'npm run test',
            ],
          },
          build: {
            commands: [
              'echo Building the frontend...',
              'npm run build',
            ],
          },
          post_build: {
            commands: [
              'echo Frontend build completed on `date`',
              'cd build',
              'echo Deploying to S3 bucket...',
              // Use pre-signed URLs to upload to the assets bucket
              // In a real setup, you would configure proper permissions
              // or use a more secure deployment mechanism
              'aws s3 sync . s3://perfect-match-assets-$NODE_ENV/ --delete',
              'echo Creating CloudFront invalidation to refresh cache...',
              'aws cloudfront create-invalidation --distribution-id $(aws cloudformation describe-stacks --stack-name perfect-match-$NODE_ENV-storage --query "Stacks[0].Outputs[?ExportName==\'perfect-match-$NODE_ENV-storage-cloudfront-id\'].OutputValue" --output text) --paths "/*"',
            ],
          },
        },
        artifacts: {
          files: [
            'frontend/build/**/*',
          ],
          'base-directory': '.',
        },
        cache: {
          paths: [
            'frontend/node_modules/**/*',
          ],
        },
      }),
    });

    // Add build stage
    this.pipeline.addStage({
      stageName: 'Build',
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: 'Backend_Build',
          project: backendBuildProject,
          input: sourceOutput,
          outputs: [buildOutput],
        }),
        new codepipeline_actions.CodeBuildAction({
          actionName: 'Frontend_Build',
          project: frontendBuildProject,
          input: sourceOutput,
        }),
      ],
    });

    // For production, add a manual approval stage
    if (env === 'prod') {
      this.pipeline.addStage({
        stageName: 'Approval',
        actions: [
          new codepipeline_actions.ManualApprovalAction({
            actionName: 'Approve',
            notificationTopic: pipelineNotificationTopic,
            additionalInformation: 'Please review the changes before deploying to production.',
          }),
        ],
      });
    }

    // Add deploy stage
    // In a real-world scenario, you would need to configure properly
    // the deployment actions based on your infrastructure
    // This is a placeholder for ECS deployment
    /*
    this.pipeline.addStage({
      stageName: 'Deploy',
      actions: [
        new codepipeline_actions.EcsDeployAction({
          actionName: 'Deploy_Backend',
          service: ecsService, // This would be defined elsewhere
          input: buildOutput,
        }),
      ],
    });
    */

    // Grant necessary permissions
    const codeBuildServiceRole = new iam.Role(this, 'CodeBuildServiceRole', {
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
      roleName: `perfect-match-codebuild-service-role-${env}`,
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonECR-FullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudFrontFullAccess'),
      ],
    });

    backendBuildProject.role?.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonECR-FullAccess')
    );

    frontendBuildProject.role?.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess')
    );

    frontendBuildProject.role?.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('CloudFrontFullAccess')
    );

    // Add CloudWatch Events to trigger the pipeline when new code is committed
    // Already handled by the CodeCommitSourceAction trigger option

    // Export pipeline artifacts
    new cdk.CfnOutput(this, 'PipelineName', {
      value: this.pipeline.pipelineName,
      exportName: `${id}-pipeline-name`,
      description: 'Pipeline Name',
    });

    new cdk.CfnOutput(this, 'RepositoryName', {
      value: this.repository.repositoryName,
      exportName: `${id}-repository-name`,
      description: 'Repository Name',
    });

    new cdk.CfnOutput(this, 'RepositoryArn', {
      value: this.repository.repositoryArn,
      exportName: `${id}-repository-arn`,
      description: 'Repository ARN',
    });

    new cdk.CfnOutput(this, 'RepositoryCloneUrlHttp', {
      value: this.repository.repositoryCloneUrlHttp,
      exportName: `${id}-repository-clone-url-http`,
      description: 'Repository Clone URL (HTTP)',
    });
  }
}
