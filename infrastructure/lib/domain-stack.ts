import * as cdk from 'aws-cdk-lib';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import { PerfectMatchConfig } from './config';

/**
 * Domain stack properties including configuration and references to other stacks' resources
 */
export interface DomainStackProps extends cdk.StackProps {
  config: PerfectMatchConfig;
  cloudfrontDistribution?: cloudfront.Distribution;
  apiGateway?: apigateway.RestApi;
}

/**
 * Stack for DNS configuration, ACM certificates, and domain mappings
 */
export class DomainStack extends cdk.Stack {
  // Public properties exposed for other stacks
  public readonly hostedZone: route53.IHostedZone;
  public readonly certificate: acm.ICertificate;
  public readonly apiDomainName?: apigateway.DomainName;

  constructor(scope: Construct, id: string, props: DomainStackProps) {
    super(scope, id, props);

    const env = props.config.environment;
    const domainName = props.config.domainName;
    const apiSubdomain = props.config.apiSubdomain;
    const wwwSubdomain = props.config.wwwSubdomain;

    // Import existing Route 53 hosted zone (since you already created it)
    this.hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: domainName,
    });

    // Import existing ACM certificate (since you already created it)
    // Note: Certificates for CloudFront must be in us-east-1 region
    this.certificate = acm.Certificate.fromCertificateArn(
      this,
      'WildcardCertificate',
      props.config.certificateArn
    );

    // If we have a CloudFront distribution, add domain configuration
    if (props.cloudfrontDistribution) {
      // Configure CloudFront with custom domain and certificate
      // This needs to be done when creating the distribution, so we'll modify props instead
      // of the existing distribution directly, and update storage-stack.ts accordingly

      // Create DNS records for root domain and www subdomain
      // pointing to CloudFront distribution
      new route53.ARecord(this, 'RootARecord', {
        zone: this.hostedZone,
        recordName: domainName,
        target: route53.RecordTarget.fromAlias(
          new targets.CloudFrontTarget(props.cloudfrontDistribution)
        ),
      });

      new route53.ARecord(this, 'WwwARecord', {
        zone: this.hostedZone,
        recordName: `${wwwSubdomain}.${domainName}`,
        target: route53.RecordTarget.fromAlias(
          new targets.CloudFrontTarget(props.cloudfrontDistribution)
        ),
      });
    }

    // Configure API Gateway custom domain if provided
    if (props.apiGateway && apiSubdomain) {
      // For API Gateway, we need a certificate in the same region as API Gateway
      // If your API Gateway is not in us-east-1, you need a separate certificate
      const apiCertificateArn = props.config.region === 'us-east-1' 
        ? props.config.certificateArn 
        : props.config.apiCertificateArn;

      if (!apiCertificateArn) {
        throw new Error('API certificate ARN is required for API Gateway custom domain');
      }

      const apiCertificate = acm.Certificate.fromCertificateArn(
        this,
        'ApiCertificate',
        apiCertificateArn
      );

      // Create custom domain for API Gateway
      this.apiDomainName = new apigateway.DomainName(this, 'ApiDomainName', {
        domainName: `${apiSubdomain}.${domainName}`,
        certificate: apiCertificate,
        endpointType: apigateway.EndpointType.REGIONAL,
      });

      // Create mapping between custom domain and API Gateway stage
      new apigateway.BasePathMapping(this, 'ApiPathMapping', {
        domainName: this.apiDomainName,
        restApi: props.apiGateway,
        stage: props.apiGateway.deploymentStage,
      });

      // Create DNS record for API Gateway
      new route53.ARecord(this, 'ApiARecord', {
        zone: this.hostedZone,
        recordName: `${apiSubdomain}.${domainName}`,
        target: route53.RecordTarget.fromAlias(
          new targets.ApiGatewayDomain(this.apiDomainName)
        ),
      });
    }

    // Export DNS-related outputs
    new cdk.CfnOutput(this, 'DomainName', {
      value: domainName,
      exportName: `${id}-domain-name`,
      description: 'Domain Name',
    });

    if (props.apiGateway && apiSubdomain) {
      new cdk.CfnOutput(this, 'ApiDomainName', {
        value: `${apiSubdomain}.${domainName}`,
        exportName: `${id}-api-domain-name`,
        description: 'API Domain Name',
      });
    }

    new cdk.CfnOutput(this, 'WebsiteDomainName', {
      value: `${wwwSubdomain}.${domainName}`,
      exportName: `${id}-website-domain-name`,
      description: 'Website Domain Name',
    });
  }
}
