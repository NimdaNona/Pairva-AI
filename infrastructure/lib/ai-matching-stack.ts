import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';

export interface AiMatchingStackProps extends cdk.StackProps {
  stage: string;
  vpc: cdk.aws_ec2.IVpc;
  userPool?: cdk.aws_cognito.IUserPool | null;
  userPoolClient?: cdk.aws_cognito.IUserPoolClient | null;
  dbCluster: cdk.aws_rds.IDatabaseCluster;
  dbSecret: cdk.aws_secretsmanager.ISecret;
  mongoDbCluster: cdk.aws_docdb.IDatabaseCluster;
  mongoDbSecret: cdk.aws_secretsmanager.ISecret;
}

export class AiMatchingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AiMatchingStackProps) {
    super(scope, id, props);

    // SQS Queues for match processing
    const matchCandidateQueue = new sqs.Queue(this, 'MatchCandidateQueue', {
      visibilityTimeout: Duration.minutes(5),
      retentionPeriod: Duration.days(14),
      deadLetterQueue: {
        queue: new sqs.Queue(this, 'MatchCandidateDeadLetterQueue', {
          retentionPeriod: Duration.days(14),
        }),
        maxReceiveCount: 5,
      },
    });

    // OpenAI API Key Secret
    const openAiApiKeySecret = new secretsmanager.Secret(this, 'OpenAiApiKey', {
      description: 'OpenAI GPT-4.1 API Key for Perfect Match AI',
      secretName: `${props.stage}/perfectmatch/openai-api-key`,
    });

    // Store the OpenAI API key in the secret
    new StringParameter(this, 'OpenAiApiKeyParam', {
      parameterName: `/perfectmatch/${props.stage}/openai-api-key`,
      stringValue: openAiApiKeySecret.secretName,
      description: 'Reference to the OpenAI API key in Secrets Manager',
    });

    // Lambda execution role with SQS permissions
    const lambdaExecutionRole = new iam.Role(this, 'MatchingLambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Grant SQS permissions
    matchCandidateQueue.grantSendMessages(lambdaExecutionRole);
    matchCandidateQueue.grantConsumeMessages(lambdaExecutionRole);

    // Match Processing Lambda
    const matchProcessingLambda = new lambda.Function(this, 'MatchProcessingLambda', {
      functionName: `perfectmatch-${props.stage}-match-processing`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'dist/handlers/processMatches.handler',
      code: lambda.Code.fromAsset('../backend/dist', {
        exclude: ['node_modules']
      }),
      timeout: Duration.minutes(15),
      memorySize: 1024,
      role: lambdaExecutionRole,
      vpc: props.vpc,
      environment: {
        STAGE: props.stage,
        DB_SECRET_ARN: props.dbSecret.secretArn,
        MONGODB_SECRET_ARN: props.mongoDbSecret.secretArn,
        MATCH_CANDIDATE_QUEUE_URL: matchCandidateQueue.queueUrl,
        OPENAI_API_KEY_SECRET_ARN: openAiApiKeySecret.secretArn,
        OPENAI_MODEL: 'gpt-4.1',
      },
    });

    // AI Worker Lambda for compatibility analysis
    const aiWorkerLambda = new lambda.Function(this, 'AiWorkerLambda', {
      functionName: `perfectmatch-${props.stage}-ai-worker`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'dist/handlers/aiWorker.handler',
      code: lambda.Code.fromAsset('../backend/dist', {
        exclude: ['node_modules']
      }),
      timeout: Duration.minutes(5),
      memorySize: 1024,
      role: lambdaExecutionRole,
      vpc: props.vpc,
      environment: {
        STAGE: props.stage,
        DB_SECRET_ARN: props.dbSecret.secretArn,
        MONGODB_SECRET_ARN: props.mongoDbSecret.secretArn,
        OPENAI_API_KEY_SECRET_ARN: openAiApiKeySecret.secretArn,
        OPENAI_MODEL: 'gpt-4.1',
      },
    });

    // Grant permissions to access secrets
    props.dbSecret.grantRead(matchProcessingLambda);
    props.mongoDbSecret.grantRead(matchProcessingLambda);
    openAiApiKeySecret.grantRead(matchProcessingLambda);
    props.dbSecret.grantRead(aiWorkerLambda);
    props.mongoDbSecret.grantRead(aiWorkerLambda);
    openAiApiKeySecret.grantRead(aiWorkerLambda);

    // SQS event source for AI Worker Lambda
    new lambda.EventSourceMapping(this, 'SqsEventSource', {
      target: aiWorkerLambda,
      eventSourceArn: matchCandidateQueue.queueArn,
      batchSize: 5,
    });

    // Schedule match processing to run daily
    const scheduleRule = new events.Rule(this, 'MatchProcessingSchedule', {
      schedule: events.Schedule.cron({ minute: '0', hour: '3' }), // 3:00 AM UTC
      description: 'Daily match processing schedule',
    });

    scheduleRule.addTarget(new targets.LambdaFunction(matchProcessingLambda));

    // REST API
    const api = new apigateway.RestApi(this, 'MatchingServiceApi', {
      restApiName: `perfect-match-matching-api-${props.stage}`,
      description: 'Perfect Match AI Matching Service API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
        allowCredentials: true,
      },
    });

    // API Gateway authorizer (conditional based on whether we have a userPool)
    let authorizer: apigateway.IAuthorizer | undefined;
    let authorizationType = apigateway.AuthorizationType.NONE; // Default to no auth if no userPool

    if (props.userPool) {
      authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'MatchingServiceAuthorizer', {
        cognitoUserPools: [props.userPool]
      });
      authorizationType = apigateway.AuthorizationType.COGNITO;
    }

    // API resources and methods
    const matchesResource = api.root.addResource('matches');
    const matchResource = matchesResource.addResource('{matchId}');
    const compatibilityResource = matchResource.addResource('compatibility');
    const likeResource = matchResource.addResource('like');
    const searchResource = api.root.addResource('search');
    const processResource = api.root.addResource('process');
    const analyzeResource = api.root.addResource('analyze');

    // Lambda function for match APIs
    const matchApiLambda = new lambda.Function(this, 'MatchApiLambda', {
      functionName: `perfectmatch-${props.stage}-match-api`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'dist/handlers/matchApi.handler',
      code: lambda.Code.fromAsset('../backend/dist', {
        exclude: ['node_modules']
      }),
      timeout: Duration.seconds(30),
      memorySize: 512,
      role: lambdaExecutionRole,
      vpc: props.vpc,
      environment: {
        STAGE: props.stage,
        DB_SECRET_ARN: props.dbSecret.secretArn,
        MONGODB_SECRET_ARN: props.mongoDbSecret.secretArn,
      },
    });

    props.dbSecret.grantRead(matchApiLambda);
    props.mongoDbSecret.grantRead(matchApiLambda);

    // Define method options based on whether we have authorization
    const methodOptions = authorizer ? {
      authorizer,
      authorizationType
    } : {};

    // GET /matches
    matchesResource.addMethod('GET', new apigateway.LambdaIntegration(matchApiLambda), methodOptions);

    // GET /matches/{matchId}
    matchResource.addMethod('GET', new apigateway.LambdaIntegration(matchApiLambda), methodOptions);

    // GET /matches/{matchId}/compatibility
    compatibilityResource.addMethod('GET', new apigateway.LambdaIntegration(matchApiLambda), methodOptions);

    // PUT /matches/{matchId}/like
    likeResource.addMethod('PUT', new apigateway.LambdaIntegration(matchApiLambda), methodOptions);

    // GET /search
    searchResource.addMethod('GET', new apigateway.LambdaIntegration(matchApiLambda), methodOptions);

    // POST /process (admin only)
    processResource.addMethod('POST', new apigateway.LambdaIntegration(matchProcessingLambda), methodOptions);

    // POST /analyze
    analyzeResource.addMethod('POST', new apigateway.LambdaIntegration(aiWorkerLambda), methodOptions);

    // Outputs
    new cdk.CfnOutput(this, 'MatchCandidateQueueUrl', {
      value: matchCandidateQueue.queueUrl,
      description: 'Match Candidate Queue URL',
    });

    new cdk.CfnOutput(this, 'MatchingApiUrl', {
      value: api.url,
      description: 'AI Matching Service API URL',
    });

    new cdk.CfnOutput(this, 'OpenAiApiKeySecretArn', {
      value: openAiApiKeySecret.secretArn,
      description: 'OpenAI API Key Secret ARN',
    });
  }
}
