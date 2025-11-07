Progressive canary deployment with automatic traffic shifting and rollback.

## Instructions

Deploy new version using canary pattern:

1. **Deploy canary version** (10% traffic)
2. **Monitor metrics** for 5 minutes:
   - Error rate < 0.1%
   - Latency increase < 10%
   - No critical errors
3. **If metrics good**: Shift to 50% traffic
4. **Monitor** another 5 minutes
5. **If still good**: Complete rollout to 100%
6. **If metrics bad**: Automatic rollback

## Usage

\`\`\`bash
/canary-deploy user-service v2.0.0
\`\`\`

## Canary Config

\`\`\`yaml
canary:
  steps:
    - percentage: 10
      duration: 5m
    - percentage: 50
      duration: 5m
    - percentage: 100
  metrics:
    - name: error_rate
      threshold: 0.001
    - name: latency_p99
      threshold: 200ms
\`\`\`
