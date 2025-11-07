Orchestrate multi-service coordinated releases with dependency ordering and rollback support.

## Instructions

Execute a coordinated release across multiple microservices:

1. **Parse service dependencies** from argument: $ARGUMENTS
2. **Determine deployment order** using topological sort
3. **For each service** in order:
   - Run pre-deployment health checks
   - Deploy new version
   - Run post-deployment verification
   - Wait for stability (2 minutes)
4. **If any deployment fails**: Automatic rollback of all services
5. **Generate release report** with timing and status

## Usage

\`\`\`bash
/release-orchestrator user-service,order-service,payment-service
\`\`\`

## Output

\`\`\`
🚀 Release Orchestration Started

Services: 3
Order: payment-service → order-service → user-service

[1/3] Deploying payment-service v2.1.0... ✅ (45s)
[2/3] Deploying order-service v1.8.0... ✅ (52s)
[3/3] Deploying user-service v3.2.0... ✅ (38s)

✅ Release Complete
Total time: 2m 15s
All services healthy
\`\`\`
