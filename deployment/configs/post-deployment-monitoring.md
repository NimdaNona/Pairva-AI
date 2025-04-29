# Pairva Post-Deployment Monitoring Plan

This document outlines the monitoring strategy and procedures for the Pairva application after deployment to production.

## Monitoring Strategy

### Real-time Monitoring

#### CloudWatch Dashboards
- **Main Dashboard**: A comprehensive dashboard displaying key metrics across all services
  - CPU and memory utilization for all ECS services
  - API response times (p50, p90, p99)
  - Error rates and HTTP status code distribution
  - Database connections and query performance
  - Cache hit rates

#### CloudWatch Alarms
- **High Priority Alarms** (require immediate response):
  - Backend service unhealthy (≥2 consecutive health check failures)
  - Frontend service unhealthy (≥2 consecutive health check failures)
  - API response time p99 > 2 seconds
  - 5xx error rate > 1% over 5 minutes
  - Database CPU > 80% for 5 minutes
  - Memory utilization > 85% on any service

- **Medium Priority Alarms** (require investigation within 1 hour):
  - API response time p95 > 1 second
  - 4xx error rate > 5% over 15 minutes
  - Database connections > 80% of max
  - Cache hit rate < 70%

#### Log Monitoring
- **Log Groups to Monitor**:
  - `/ecs/pairva-backend`
  - `/ecs/pairva-frontend`
  - `/aws/rds/instance/pairva-db/error`
  - CloudFront access logs
  - Application load balancer logs

- **Log Metrics to Create**:
  - Error rate (count of ERROR and FATAL log entries)
  - Authentication failures
  - Slow database queries (>100ms)
  - Failed API requests

### Performance Monitoring

#### Network
- Route 53 health checks for all domains (www.pairva.ai, api.pairva.ai)
- CloudFront distribution metrics (cache hit ratio, error rates, latency)
- API Gateway throttling and latency metrics

#### Database
- RDS performance insights for query performance
- DocumentDB CPU, memory, and connection metrics
- Redis cache hit rate and memory usage

#### Application
- ECS service CPU and memory utilization
- ECS task startup and stability metrics
- API endpoint response times by route

## Post-Deployment Verification

### Immediate Verification (0-30 minutes post-deployment)
- [ ] Run the `Test-CoreFlows.ps1` script
- [ ] Manually verify critical user journeys:
  - User login flow
  - Profile creation
  - Matching system
  - Messaging functionality
- [ ] Check all CloudWatch dashboards for abnormal patterns
- [ ] Verify all health check endpoints return 200 OK

### Short-term Verification (1-24 hours post-deployment)
- [ ] Monitor error rates for any spikes
- [ ] Analyze API response times for degradation
- [ ] Check user engagement metrics through analytics
- [ ] Verify database connection patterns are normal
- [ ] Monitor cache hit rates and memory usage

### Long-term Verification (2-7 days post-deployment)
- [ ] Analyze performance trends
- [ ] Check for memory leaks or resource consumption growth
- [ ] Review all logged errors and exceptions
- [ ] Validate scaling patterns during peak usage times
- [ ] Compare metrics with previous deployment baseline

## Alert Response Procedures

### Critical Alerts
1. Immediately acknowledge the alert
2. Verify alert in CloudWatch and review relevant logs
3. Determine if rollback is necessary
4. If rollback is needed, execute:
   ```
   .\Deploy-Production.ps1 -Rollback -Verbose
   ```
5. If not rolling back, implement immediate mitigation
6. Document incident and mitigation steps
7. Schedule post-incident review

### Non-Critical Alerts
1. Acknowledge the alert
2. Review metrics and logs to understand the context
3. Determine if immediate action is required
4. Implement fix or schedule for next deployment
5. Document the issue and resolution

## Regular Monitoring Tasks

### Daily
- Review CloudWatch dashboards and metrics
- Check error logs for new patterns
- Verify all health checks are passing
- Review performance metrics for degradation

### Weekly
- Analyze performance trends
- Review security events and access logs
- Check resource utilization trends
- Update monitoring thresholds if needed

### Monthly
- Comprehensive performance review
- Cost optimization analysis
- Review and update alarms and metrics
- Test recovery procedures

## Monitoring Tools and Access

### AWS Console Access
- CloudWatch: https://console.aws.amazon.com/cloudwatch/
- ECS: https://console.aws.amazon.com/ecs/
- RDS: https://console.aws.amazon.com/rds/
- CloudFront: https://console.aws.amazon.com/cloudfront/

### Monitoring Tools
- **PagerDuty**: For alert notification and escalation
- **Grafana**: For custom dashboard visualization
- **AWS X-Ray**: For distributed tracing of requests

## Disaster Recovery

Refer to the [Disaster Recovery Plan](docs/DISASTER_RECOVERY.md) for detailed procedures in case of:
- Region failure
- Database corruption
- Security incidents
- Application failures requiring restoration from backups

## Runbooks

### Database Performance Issues
1. Check RDS/DocumentDB performance insights
2. Review slow query logs
3. Identify problematic queries
4. Apply indexes or query optimizations
5. Scale resources if necessary

### API Performance Degradation
1. Check ECS service metrics (CPU, memory)
2. Review API Gateway throttling
3. Check database connection pool
4. Review X-Ray traces for bottlenecks
5. Scale services or optimize code paths

### Increased Error Rates
1. Identify error patterns in logs
2. Check recent deployment changes
3. Review third-party service dependencies
4. Roll back if necessary or deploy targeted fix

### Memory Issues
1. Check service memory utilization
2. Review memory usage patterns
3. Check for memory leaks
4. Restart affected services
5. Deploy optimization if necessary
