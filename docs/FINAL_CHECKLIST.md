# Perfect Match Production Pre-Launch Checklist

This checklist should be completed before launching the Perfect Match application in production.

## Infrastructure Verification

- [ ] **CloudFormation Stacks**
  - [ ] All CloudFormation stacks are in CREATE_COMPLETE or UPDATE_COMPLETE state
  - [ ] No stacks in ROLLBACK or FAILED state
  - [ ] Review any drift detection results

- [ ] **ECR Repositories**
  - [ ] perfectmatch-backend repository exists and contains images
  - [ ] perfectmatch-frontend repository exists and contains images
  - [ ] Image tags are properly versioned with production tags

- [ ] **IAM Roles and Policies**
  - [ ] ECS execution role exists with proper permissions
  - [ ] Lambda execution roles exist with proper permissions
  - [ ] Permission boundaries applied to all roles for security
  - [ ] No overly permissive policies (e.g., "*" permissions)

- [ ] **S3 Buckets**
  - [ ] Frontend assets bucket exists with proper configuration
  - [ ] Backend uploads bucket exists with proper configuration
  - [ ] Logs bucket exists for centralized logging
  - [ ] All buckets have encryption enabled
  - [ ] Backend buckets have public access blocked
  - [ ] Appropriate CORS configuration on relevant buckets

## Security Verification

- [ ] **WAF Configuration**
  - [ ] WAF WebACL exists and is associated with resources
  - [ ] SQL injection protection rules enabled
  - [ ] XSS protection rules enabled
  - [ ] Rate limiting rules enabled
  - [ ] IP reputation lists configured

- [ ] **CloudFront Distribution**
  - [ ] Distribution is enabled
  - [ ] HTTPS enforcement enabled (redirect-to-https or https-only)
  - [ ] Security headers properly configured (HSTS, X-Content-Type-Options, etc.)
  - [ ] Origin access identity configured for S3 buckets
  - [ ] Geo-restrictions configured if needed

- [ ] **SSL/TLS Certificates**
  - [ ] Certificates valid for all domains (app, api, etc.)
  - [ ] Certificates not expiring within 90 days
  - [ ] Certificates associated with CloudFront and Load Balancers
  - [ ] Modern TLS versions enforced (TLS 1.2+)

- [ ] **Security Groups**
  - [ ] No overly permissive security groups (0.0.0.0/0 for SSH, RDP)
  - [ ] No groups allowing all traffic (0.0.0.0/0 all protocols)
  - [ ] Proper port restrictions to only required services
  - [ ] Security groups follow least privilege principle

## Database Verification

- [ ] **RDS Instance**
  - [ ] Instance in available state
  - [ ] Multi-AZ enabled for high availability
  - [ ] Storage encryption enabled
  - [ ] Backup retention period set to at least 7 days
  - [ ] Enhanced monitoring enabled
  - [ ] Parameter groups properly configured and in-sync

- [ ] **Database Connection**
  - [ ] Application can successfully connect to the database
  - [ ] Connection pooling properly configured
  - [ ] Connection timeouts and retries properly configured
  - [ ] Read/Write permissions verified

- [ ] **MongoDB Configuration** (if applicable)
  - [ ] DocumentDB cluster in available state
  - [ ] Storage encryption enabled
  - [ ] Connection parameters properly configured in SSM Parameter Store

- [ ] **Redis Cache**
  - [ ] ElastiCache cluster in available state
  - [ ] Using recent Redis version (6.x+)
  - [ ] Properly configured for in-memory caching
  - [ ] Encryption in-transit and at-rest enabled

## Application Verification

- [ ] **ECS Services**
  - [ ] Services in ACTIVE state
  - [ ] Desired task count equals running task count
  - [ ] No ongoing deployments or rollbacks
  - [ ] Task definitions properly configured
  - [ ] Health checks passing

- [ ] **API Gateway**
  - [ ] API Gateway REST APIs properly configured
  - [ ] Production stage deployed
  - [ ] Custom domain configured
  - [ ] Health endpoint accessible
  - [ ] All critical endpoints functioning

- [ ] **Health Endpoints**
  - [ ] API health endpoint returns 200 OK
  - [ ] Frontend loads successfully
  - [ ] Custom domain health endpoints accessible
  - [ ] Backend reports healthy status to ELB health checks

- [ ] **Critical User Flows**
  - [ ] Authentication flow working (signup, login, token refresh)
  - [ ] Profile creation and update functioning
  - [ ] Matching algorithm operational
  - [ ] Messaging between users working
  - [ ] Notification delivery functioning

## Monitoring Verification

- [ ] **CloudWatch Dashboards**
  - [ ] Production overview dashboard created
  - [ ] Service-specific dashboards created (API, DB, etc.)
  - [ ] Key metrics displayed with appropriate thresholds

- [ ] **CloudWatch Alarms**
  - [ ] CPU utilization alarms configured
  - [ ] Memory utilization alarms configured
  - [ ] Error rate alarms configured
  - [ ] Latency alarms configured
  - [ ] All alarms have notification actions

- [ ] **SNS Topics**
  - [ ] Alert topics created with appropriate subscriptions
  - [ ] Operation team members subscribed to critical alerts
  - [ ] Escalation topics configured for critical issues

- [ ] **Logs**
  - [ ] Log groups created and receiving logs
  - [ ] Log retention policies configured
  - [ ] Log metrics and filters created for key error patterns
  - [ ] Log insights queries prepared for common troubleshooting

## Final Verification

- [ ] **Environment Variables**
  - [ ] All required environment variables set in SSM Parameter Store
  - [ ] Sensitive values properly encrypted
  - [ ] Feature flags correctly configured for production

- [ ] **Load Testing**
  - [ ] System tested under expected peak load
  - [ ] Auto-scaling verified under load
  - [ ] Performance meets or exceeds requirements

- [ ] **Security Scan**
  - [ ] Vulnerability scan performed on infrastructure
  - [ ] OWASP Top 10 vulnerabilities assessed
  - [ ] Dependency scanning completed
  - [ ] No critical or high security issues outstanding

- [ ] **Backup and Recovery**
  - [ ] Database backup process verified
  - [ ] Backup restoration tested
  - [ ] Point-in-time recovery capabilities confirmed
  - [ ] Disaster recovery plan finalized and tested

---

## Sign-off

This checklist was completed and the production environment is ready for launch.

Date: _______________________

Operations Engineer: _______________________

Approver: _______________________
