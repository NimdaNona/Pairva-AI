# Perfect Match - Disaster Recovery Plan

## Overview

This document outlines the disaster recovery procedures for the Perfect Match application. It defines recovery objectives, procedures, and strategies to ensure business continuity in the event of a system failure, data loss, or regional AWS outage.

## Recovery Objectives

| Component | Recovery Time Objective (RTO) | Recovery Point Objective (RPO) | Criticality |
|-----------|-------------------------------|-------------------------------|-------------|
| User Authentication System | 5 minutes | Near zero (real-time) | Critical |
| Profile Database | 15 minutes | 5 minutes | Critical |
| Matching Engine | 30 minutes | 15 minutes | High |
| Messaging Service | 15 minutes | 5 minutes | High |
| Notification System | 30 minutes | 15 minutes | Medium |
| Questionnaire Engine | 1 hour | 30 minutes | Medium |
| Payment Processing | 15 minutes | Near zero (real-time) | Critical |
| Frontend Applications | 15 minutes | N/A | High |
| Media Storage | 1 hour | 1 hour | Medium |
| Analytics and Reporting | 4 hours | 24 hours | Low |

## Architecture for Disaster Recovery

The Perfect Match disaster recovery architecture is built on the following principles:

1. **Multi-region deployment**: Critical components are deployed across two AWS regions (primary: us-east-1, secondary: us-west-2)
2. **Data replication**: Continuous replication of data between regions
3. **Automated failover**: Route 53 health checks with automated DNS failover
4. **Regular backups**: Automated backup procedures with cross-region replication
5. **Infrastructure as Code**: All infrastructure defined in CDK, enabling rapid deployment in new regions

![Disaster Recovery Architecture](https://placeholder-for-dr-architecture-diagram.png)

## Disaster Recovery Procedures

### Database Recovery Procedures

#### RDS PostgreSQL Database Recovery

**Automated Failover (Multi-AZ):**
1. Automated failover will occur if the primary database instance becomes unavailable
2. No manual intervention required
3. Application should handle connection disruption (typically 60-120 seconds)

**Manual Recovery from Snapshot:**
1. Log in to AWS Management Console
2. Navigate to RDS > Snapshots
3. Select the most recent automatic snapshot or manual snapshot
4. Click "Restore Snapshot"
5. Specify new instance details:
   - DB Instance Identifier: `perfect-match-[env]-db-restored`
   - Instance type: Match or exceed the original instance specifications
   - Availability Zone: Select appropriate AZ
   - VPC Security Group: Select the same security group as the original database
6. Click "Restore DB Instance"
7. Once restoration is complete, update the application configuration to point to the new database instance
8. Verify application connectivity and data integrity

#### DynamoDB Recovery

**Point-in-Time Recovery:**
1. Log in to AWS Management Console
2. Navigate to DynamoDB > Tables
3. Select the affected table
4. Click "Backups" tab
5. Click "Restore to point in time"
6. Choose the recovery point (timestamp)
7. Specify new table name: `[original-table-name]-restored`
8. Once restoration is complete, verify data integrity
9. Update application references to the table name if necessary

**Cross-Region Recovery:**
1. For regional failures, DynamoDB global tables provide automatic replication
2. Application can be pointed to the secondary region endpoint
3. No manual restoration steps required

#### DocumentDB (MongoDB) Recovery

1. Log in to AWS Management Console
2. Navigate to DocumentDB > Clusters
3. Note the latest automated snapshot time
4. Select the most recent snapshot
5. Click "Restore"
6. Configure the new cluster:
   - Cluster identifier: `perfect-match-[env]-docdb-restored`
   - Instance type: Match or exceed the original specifications 
   - VPC and security groups: Match the original configuration
7. Click "Create cluster"
8. Once provisioned, update connection strings in application configuration
9. Verify data integrity and application functionality

### Application Recovery Procedures

#### Backend API Services

1. Verify status of Auto Scaling groups in the secondary region
2. If needed, update the target capacity of Auto Scaling groups
3. Ensure API Gateway endpoints are properly configured and accessible
4. Update Route 53 DNS records to point to the secondary region if necessary (automated via health checks)
5. Verify application health with monitoring tools
6. Test critical API endpoints for functionality

#### Frontend Application

1. Verify status of CloudFront distribution
2. Ensure S3 bucket in the secondary region contains the latest frontend assets
3. Update Route 53 DNS records to point to the secondary region CloudFront distribution if necessary
4. Clear CloudFront cache if needed: `aws cloudfront create-invalidation --distribution-id [DISTRIBUTION_ID] --paths "/*"`
5. Verify frontend application accessibility and functionality

### Message Queue Recovery

1. Verify status of SQS queues in the secondary region
2. Check for any unprocessed messages in the primary region queues
3. If needed, run the message migration utility: `node infrastructure/scripts/queue-migration.js`
4. Update application configurations to use the secondary region queue endpoints
5. Monitor queue depth and processing metrics after failover

### File Storage Recovery

1. S3 cross-region replication ensures data availability in the secondary region
2. Verify replication status: `aws s3api get-bucket-replication --bucket perfect-match-[env]-media`
3. If necessary, manually copy unreplicated objects: `aws s3 sync s3://perfect-match-[env]-media-primary s3://perfect-match-[env]-media-secondary`
4. Update application configuration to use the secondary region S3 endpoint
5. Verify file accessibility from application

## Multi-Region Failover Strategy

### Automated Failover Process

1. Route 53 health checks continuously monitor the primary region endpoints
2. When health checks fail, Route 53 automatically updates DNS records to point to the secondary region
3. DNS propagation typically takes 60 seconds or less
4. Application traffic is automatically directed to the secondary region

### Manual Failover Process

If automated failover doesn't occur or needs to be triggered manually:

1. Log in to AWS Management Console
2. Navigate to Route 53 > Health checks
3. Verify the status of health checks for primary region
4. Navigate to Route 53 > Hosted zones > [your domain]
5. Select the record sets to be updated
6. Click "Edit"
7. Update the routing policy to point to the secondary region endpoints
8. Save changes
9. Monitor DNS propagation and application availability

### Failback Process

After the primary region is restored:

1. Verify full functionality of all services in the primary region
2. Ensure data synchronization from secondary to primary region is complete
3. Update Route 53 record sets to restore traffic to the primary region (if using manual failover)
4. Monitor application performance and health during the transition
5. Keep the secondary region in standby mode

## Backup and Restoration Testing

Regular testing of backup and restoration procedures is essential:

1. Automated tests run weekly using the `infrastructure/scripts/backup-verification.sh` script
2. Full restore drills are conducted monthly in an isolated environment
3. Results of all tests are documented and reviewed
4. Any issues discovered during testing are addressed immediately

### Backup Verification Process

1. Monthly backup verification tests are scheduled on the 1st of each month
2. The automated script creates an isolated test environment
3. Latest backups are restored to this environment
4. Data integrity checks are performed
5. Test transactions are run to verify functionality
6. Tests include:
   - Database restoration
   - File storage access
   - Application functionality
   - Data integrity verification

## Blue/Green Deployment Strategy for Recovery

The Perfect Match system uses blue/green deployment to ensure minimal downtime during both regular deployments and disaster recovery:

1. During recovery, a completely new (green) environment is provisioned
2. Data is synchronized to the green environment
3. The green environment is fully tested while the blue environment remains operational
4. Traffic is gradually shifted from blue to green using weighted routing
5. Once verified, all traffic is directed to the green environment

### Blue/Green Recovery Procedure

1. Provision new (green) environment using CDK: `cdk deploy --app 'npx ts-node bin/perfect-match.ts' --context environment=[env] --context recoveryTarget=green`
2. Synchronize data to the green environment
3. Verify green environment functionality with test traffic
4. Gradually shift production traffic to green environment
5. Monitor application health during transition
6. When confirmed stable, decommission the blue environment

## Contact Information

In the event of a disaster, the following team members should be contacted immediately:

| Role | Name | Contact Number | Email | Responsibilities |
|------|------|----------------|-------|------------------|
| Lead SRE | Jane Smith | 555-123-4567 | jane.smith@example.com | Overall coordination |
| Database Admin | John Doe | 555-123-7890 | john.doe@example.com | Database recovery |
| Infrastructure Lead | Alex Johnson | 555-123-4569 | alex.johnson@example.com | AWS infrastructure |
| Security Officer | Sarah Williams | 555-123-7891 | sarah.williams@example.com | Security assessment |

## Recovery Runbooks

Detailed runbooks for specific recovery scenarios are maintained in the following location:

- [Authentication System Recovery](https://wiki.internal.example.com/runbooks/auth-recovery)
- [Database Recovery](https://wiki.internal.example.com/runbooks/database-recovery)
- [Message Queue Recovery](https://wiki.internal.example.com/runbooks/mq-recovery)
- [Storage System Recovery](https://wiki.internal.example.com/runbooks/storage-recovery)
- [Full Region Failover](https://wiki.internal.example.com/runbooks/region-failover)

## Disaster Recovery Testing Schedule

| Test Type | Frequency | Last Performed | Next Scheduled | Responsible Team |
|-----------|-----------|----------------|----------------|------------------|
| Backup Verification | Weekly | YYYY-MM-DD | YYYY-MM-DD | Database Team |
| Component Recovery | Monthly | YYYY-MM-DD | YYYY-MM-DD | Service Teams |
| Regional Failover | Quarterly | YYYY-MM-DD | YYYY-MM-DD | SRE Team |
| Full DR Test | Bi-annually | YYYY-MM-DD | YYYY-MM-DD | All Teams |

## Document History

| Version | Date | Author | Description of Changes |
|---------|------|--------|------------------------|
| 1.0 | YYYY-MM-DD | [Author Name] | Initial document |
