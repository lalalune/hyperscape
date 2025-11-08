---
name: disaster-recovery-planner
description: Design disaster recovery strategies including backup, failover, RTO/RPO planning, and multi-region deployment for business continuity.
allowed-tools: [Read, Write, Edit, Bash, Grep, Glob]
---

# Disaster Recovery Planner

Design comprehensive disaster recovery strategies for business continuity.

## RTO/RPO Targets

| Tier | RTO | RPO | Cost | Use Case |
|------|-----|-----|------|----------|
| Critical | < 1 hour | < 5 min | High | Payment, Auth |
| Important | < 4 hours | < 1 hour | Medium | Orders, Inventory |
| Standard | < 24 hours | < 24 hours | Low | Reports, Analytics |

## Multi-Region Failover

```yaml
# AWS Route53 Health Checks and Failover
Resources:
  PrimaryHealthCheck:
    Type: AWS::Route53::HealthCheck
    Properties:
      HealthCheckConfig:
        Type: HTTPS
        ResourcePath: /health
        FullyQualifiedDomainName: api-us-east-1.example.com
        Port: 443
        RequestInterval: 30
        FailureThreshold: 3

  DNSFailover:
    Type: AWS::Route53::RecordSet
    Properties:
      HostedZoneId: Z123456
      Name: api.example.com
      Type: A
      SetIdentifier: Primary
      Failover: PRIMARY
      AliasTarget:
        HostedZoneId: Z123456
        DNSName: api-us-east-1.example.com
      HealthCheckId: !Ref PrimaryHealthCheck
```

## Database Backup Strategy

```bash
# Automated backup script
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="production_db"
S3_BUCKET="s3://backups-${DB_NAME}"
RETENTION_DAYS=30

# Full backup daily
pg_dump -Fc $DB_NAME | \
  aws s3 cp - "${S3_BUCKET}/full/${TIMESTAMP}.dump"

# Point-in-time recovery (WAL archiving)
aws s3 sync /var/lib/postgresql/wal_archive \
  "${S3_BUCKET}/wal/" --delete

# Cleanup old backups
aws s3 ls "${S3_BUCKET}/full/" | \
  while read -r line; do
    createDate=$(echo $line | awk '{print $1" "$2}')
    if [[ $(date -d "$createDate" +%s) -lt $(date -d "-${RETENTION_DAYS} days" +%s) ]]; then
      fileName=$(echo $line | awk '{print $4}')
      aws s3 rm "${S3_BUCKET}/full/${fileName}"
    fi
  done
```

## Best Practices
- ✅ Test DR procedures quarterly
- ✅ Automate backup verification
- ✅ Document runbooks thoroughly
- ✅ Multi-region for critical systems
- ✅ Monitor backup success/failure
