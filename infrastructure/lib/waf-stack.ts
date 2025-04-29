import * as cdk from 'aws-cdk-lib';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { PerfectMatchConfig } from './config';

/**
 * WAF stack properties
 */
export interface WafStackProps extends cdk.StackProps {
  config: PerfectMatchConfig;
  apiGateway?: apigateway.RestApi;
  cloudfrontDistribution?: cloudfront.Distribution;
}

/**
 * Enhanced Web Application Firewall (WAF) Stack
 * 
 * This stack implements comprehensive security measures to protect the application
 * from various web attacks, malicious traffic patterns, and unauthorized access attempts.
 * The WAF implementation follows security best practices and includes multiple layers
 * of protection to safeguard both API Gateway and CloudFront distribution endpoints.
 */
export class WafStack extends cdk.Stack {
  // Public properties for other stacks to reference
  public readonly apiWafAcl: wafv2.CfnWebACL;
  public readonly cloudfrontWafAcl: wafv2.CfnWebACL;

  constructor(scope: Construct, id: string, props: WafStackProps) {
    super(scope, id, props);

    // Create a log group for WAF logs with extended retention
    const wafLogGroup = new logs.LogGroup(this, 'WafLogGroup', {
      logGroupName: `/aws/waf/perfect-match-${props.config.environment}`,
      retention: logs.RetentionDays.SIX_MONTHS, // Extended retention for better security audit trail
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Retain logs even if stack is deleted
    });

    // Enhanced WAF logging configuration with more sensitive fields redacted
    const logConfiguration = {
      logDestinationConfigs: [
        `arn:aws:logs:${this.region}:${this.account}:log-group:${wafLogGroup.logGroupName}`,
      ],
      redactedFields: [
        {
          jsonBody: {
            sensitiveWords: [
              "password",
              "token",
              "authorization",
              "refreshToken",
              "apiKey",
              "secret",
              "creditCard",
              "cardNumber",
              "cvv",
              "ssn",
              "socialSecurity",
              "phone",
              "address",
              "birthdate",
              "dob",
              "location",
              "gps",
              "coordinates"
            ]
          }
        },
        {
          queryString: {} // Redact all query strings for maximum privacy
        },
        {
          singleHeader: {
            name: "authorization"
          }
        },
        {
          singleHeader: {
            name: "cookie"
          }
        }
      ],
    };

    /**
     * Comprehensive WAF Rules Configuration
     * 
     * This implementation includes multiple layers of protection:
     * 1. Core Rule Set (CRS) - Standard protection against OWASP Top 10 vulnerabilities
     * 2. Rate-based protection - Defense against DDoS and brute force attacks
     * 3. IP reputation filtering - Blocking known malicious IPs
     * 4. Application-specific rules - Custom protections for dating app specific endpoints
     * 5. Bot control - Identifying and mitigating automated threats
     */
    const enhancedSecurityRules: wafv2.CfnWebACL.RuleProperty[] = [
      // AWS Managed Rules - Core rule set (CRS) for general web protection
      {
        name: 'AWSManagedRulesCommonRuleSet',
        priority: 0,
        statement: {
          managedRuleGroupStatement: {
            vendorName: 'AWS',
            name: 'AWSManagedRulesCommonRuleSet',
            excludedRules: [] // Include all rules in this managed rule group
          }
        },
        overrideAction: {
          none: {}
        },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: 'AWSManagedRulesCommonRuleSet'
        }
      },
      
      // SQL Injection Protection - Critical for any application with database interaction
      {
        name: 'AWSManagedRulesSQLiRuleSet',
        priority: 1,
        statement: {
          managedRuleGroupStatement: {
            vendorName: 'AWS',
            name: 'AWSManagedRulesSQLiRuleSet',
            excludedRules: [] // Include all rules for comprehensive SQL injection protection
          }
        },
        overrideAction: {
          none: {}
        },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: 'AWSManagedRulesSQLiRuleSet'
        }
      },
      
      // Cross-Site Scripting (XSS) Protection - Enhanced beyond basic XSS protection
      {
        name: 'AWSManagedRulesXSSRuleSet',
        priority: 2,
        statement: {
          managedRuleGroupStatement: {
            vendorName: 'AWS',
            name: 'AWSManagedRulesXSSRuleSet',
            excludedRules: [] // Include all XSS protection rules
          }
        },
        overrideAction: {
          none: {}
        },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: 'AWSManagedRulesXSSRuleSet'
        }
      },
      
      // Known Bad Inputs Protection
      {
        name: 'AWSManagedRulesKnownBadInputsRuleSet',
        priority: 3,
        statement: {
          managedRuleGroupStatement: {
            vendorName: 'AWS',
            name: 'AWSManagedRulesKnownBadInputsRuleSet',
            excludedRules: []
          }
        },
        overrideAction: {
          none: {}
        },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: 'AWSManagedRulesKnownBadInputsRuleSet'
        }
      },
      
      // IP Reputation List - Block requests from known malicious IP addresses
      {
        name: 'AWSManagedRulesAmazonIpReputationList',
        priority: 4,
        statement: {
          managedRuleGroupStatement: {
            vendorName: 'AWS',
            name: 'AWSManagedRulesAmazonIpReputationList',
            excludedRules: []
          }
        },
        overrideAction: {
          none: {}
        },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: 'AWSManagedRulesAmazonIpReputationList'
        }
      },
      
      // Bot Control - Identify and mitigate common bot traffic
      {
        name: 'AWSManagedRulesBotControlRuleSet',
        priority: 5,
        statement: {
          managedRuleGroupStatement: {
            vendorName: 'AWS',
            name: 'AWSManagedRulesBotControlRuleSet',
            excludedRules: []
          }
        },
        overrideAction: {
          none: {}
        },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: 'AWSManagedRulesBotControlRuleSet'
        }
      },
      
      // Global rate-based rule - Limits overall requests per IP
      {
        name: 'GlobalRateLimit',
        priority: 6,
        action: {
          block: {}
        },
        statement: {
          rateBasedStatement: {
            limit: 3000, // 3000 requests per 5 minutes (600/minute) per IP address
            aggregateKeyType: 'IP'
          }
        },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: 'GlobalRateLimit'
        }
      },
      
      // Custom application-specific rules for dating app protection
      // Rate limiting for profile viewing
      {
        name: 'ProfileViewingRateLimit',
        priority: 10,
        action: {
          block: {},
        },
        statement: {
          rateBasedStatement: {
            limit: 100, // Limit to 100 requests per 5 minutes
            aggregateKeyType: 'IP',
            scopeDownStatement: {
              byteMatchStatement: {
                fieldToMatch: {
                  uriPath: {},
                },
                positionalConstraint: 'CONTAINS',
                searchString: '/api/v1/profiles/', // Path for profile viewing
                textTransformations: [
                  {
                    priority: 0,
                    type: 'NONE',
                  },
                ],
              },
            },
          },
        },
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          metricName: 'ProfileViewingRateLimit',
          sampledRequestsEnabled: true,
        },
      },
      
      // Rate limiting for messaging endpoints
      {
        name: 'MessagingRateLimit',
        priority: 20,
        action: {
          block: {},
        },
        statement: {
          rateBasedStatement: {
            limit: 60, // Limit to 60 requests per 5 minutes
            aggregateKeyType: 'IP',
            scopeDownStatement: {
              byteMatchStatement: {
                fieldToMatch: {
                  uriPath: {},
                },
                positionalConstraint: 'CONTAINS',
                searchString: '/api/v1/messaging/', // Path for messaging
                textTransformations: [
                  {
                    priority: 0,
                    type: 'NONE',
                  },
                ],
              },
            },
          },
        },
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          metricName: 'MessagingRateLimit',
          sampledRequestsEnabled: true,
        },
      },
      
      // Protection against profile scraping (bot detection)
      {
        name: 'ProfileScrapingProtection',
        priority: 30,
        action: {
          block: {},
        },
        statement: {
          andStatement: {
            statements: [
              {
                byteMatchStatement: {
                  fieldToMatch: {
                    uriPath: {},
                  },
                  positionalConstraint: 'CONTAINS',
                  searchString: '/api/v1/profiles/',
                  textTransformations: [
                    {
                      priority: 0,
                      type: 'NONE',
                    },
                  ],
                },
              },
              {
                rateBasedStatement: {
                  limit: 200, // Limit to 200 requests per 5 minutes
                  aggregateKeyType: 'IP',
                },
              },
              {
                // Detect unusual patterns (sequential access, etc)
                sizeConstraintStatement: {
                  fieldToMatch: {
                    queryString: {},
                  },
                  comparisonOperator: 'GT',
                  size: 100, // Large query strings often used in scraping
                  textTransformations: [
                    {
                      priority: 0,
                      type: 'NONE',
                    },
                  ],
                },
              },
            ],
          },
        },
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          metricName: 'ProfileScrapingProtection',
          sampledRequestsEnabled: true,
        },
      },
      
      // Bot protection for registration and authentication
      {
        name: 'AuthenticationBotProtection',
        priority: 40,
        action: {
          block: {},
        },
        statement: {
          andStatement: {
            statements: [
              {
                byteMatchStatement: {
                  fieldToMatch: {
                    uriPath: {},
                  },
                  positionalConstraint: 'CONTAINS',
                  searchString: '/api/v1/auth/', // Auth endpoints
                  textTransformations: [
                    {
                      priority: 0,
                      type: 'NONE',
                    },
                  ],
                },
              },
              {
                rateBasedStatement: {
                  limit: 50, // Limit to 50 auth requests per 5 minutes
                  aggregateKeyType: 'IP',
                },
              },
            ],
          },
        },
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          metricName: 'AuthenticationBotProtection',
          sampledRequestsEnabled: true,
        },
      },
      
      // Cross-site scripting protection
      {
        name: 'XSSProtection',
        priority: 50,
        action: {
          block: {},
        },
        statement: {
          xssMatchStatement: {
            fieldToMatch: {
              allQueryArguments: {},
            },
            textTransformations: [
              {
                priority: 0,
                type: 'URL_DECODE',
              },
              {
                priority: 1,
                type: 'HTML_ENTITY_DECODE',
              },
            ],
          },
        },
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          metricName: 'XSSProtection',
          sampledRequestsEnabled: true,
        },
      },
      
      // SQL injection protection
      {
        name: 'SQLInjectionProtection',
        priority: 60,
        action: {
          block: {},
        },
        statement: {
          sqliMatchStatement: {
            fieldToMatch: {
              body: {},
            },
            sensitivityLevel: 'HIGH',
            textTransformations: [
              {
                priority: 0,
                type: 'URL_DECODE',
              },
              {
                priority: 1,
                type: 'HTML_ENTITY_DECODE',
              },
            ],
          },
        },
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          metricName: 'SQLInjectionProtection',
          sampledRequestsEnabled: true,
        },
      },
      
      // Geo blocking (optional - uncomment if needed to restrict by country)
      /*
      {
        name: 'GeoBlocking',
        priority: 70,
        action: {
          block: {},
        },
        statement: {
          geoMatchStatement: {
            countryCodes: ['CN', 'RU', 'NK'], // Example countries to block
          },
        },
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          metricName: 'GeoBlocking',
          sampledRequestsEnabled: true,
        },
      },
      */
    ];

    // Create the WAF ACL for API Gateway
    this.apiWafAcl = new wafv2.CfnWebACL(this, 'ApiWafAcl', {
      name: `perfect-match-api-waf-${props.config.environment}`,
      description: 'WAF for Perfect Match API Gateway',
      scope: 'REGIONAL',
      defaultAction: {
        allow: {},
      },
      rules: enhancedSecurityRules,
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: 'PerfectMatchApiWaf',
        sampledRequestsEnabled: true,
      },
      ...(props.config.environment === 'prod' ? { loggingConfiguration: logConfiguration } : {}),
    });

    // Create the WAF ACL for CloudFront (with similar but adjusted rules)
    this.cloudfrontWafAcl = new wafv2.CfnWebACL(this, 'CloudFrontWafAcl', {
      name: `perfect-match-cf-waf-${props.config.environment}`,
      description: 'WAF for Perfect Match CloudFront Distribution',
      scope: 'CLOUDFRONT',
      defaultAction: {
        allow: {},
      },
      rules: [
        // Adjust some rules for CloudFront context
        ...enhancedSecurityRules.map((rule: wafv2.CfnWebACL.RuleProperty) => {
          // Make a deep copy of the rule
          const cfRule = JSON.parse(JSON.stringify(rule));
          
          // Adjust URI paths for CloudFront
          if (cfRule.statement.rateBasedStatement?.scopeDownStatement?.byteMatchStatement) {
            const searchString = cfRule.statement.rateBasedStatement.scopeDownStatement.byteMatchStatement.searchString;
            cfRule.statement.rateBasedStatement.scopeDownStatement.byteMatchStatement.searchString = 
              searchString.replace('/api/v1', '');
          }
          
          if (cfRule.statement.andStatement?.statements) {
            cfRule.statement.andStatement.statements.forEach((statement: any) => {
              if (statement.byteMatchStatement?.searchString) {
                statement.byteMatchStatement.searchString = 
                  statement.byteMatchStatement.searchString.replace('/api/v1', '');
              }
            });
          }
          
          return cfRule;
        }),
      ],
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: 'PerfectMatchCloudFrontWaf',
        sampledRequestsEnabled: true,
      },
      ...(props.config.environment === 'prod' && { loggingConfiguration: logConfiguration }),
    });

    // Associate WAF with API Gateway if provided
    if (props.apiGateway) {
      new wafv2.CfnWebACLAssociation(this, 'ApiWafAssociation', {
        resourceArn: props.apiGateway.deploymentStage.stageArn,
        webAclArn: this.apiWafAcl.attrArn,
      });
    }

    // CloudFront association is done in the CloudFront distribution creation
    // by passing the WAF ACL ARN. This is typically done in the domain-stack.ts

    // Outputs
    new cdk.CfnOutput(this, 'ApiWafAclArn', {
      value: this.apiWafAcl.attrArn,
      description: 'ARN of the API Gateway WAF ACL',
      exportName: `${id}-api-waf-arn`,
    });

    new cdk.CfnOutput(this, 'CloudFrontWafAclArn', {
      value: this.cloudfrontWafAcl.attrArn,
      description: 'ARN of the CloudFront WAF ACL',
      exportName: `${id}-cf-waf-arn`,
    });
  }
}
