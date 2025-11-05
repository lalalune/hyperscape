Generate SLA compliance reports showing uptime and performance metrics

## Instructions

Execute the sla report workflow:

1. Parse arguments: $ARGUMENTS
2. Validate prerequisites
3. Execute main workflow
4. Verify completion
5. Generate report

## Usage

```bash
/sla-report [arguments]
```

## Example

```bash
# Generate SLA compliance reports showing uptime and performance metrics
/sla-report
```

## Output Format

```
✅ sla-report completed successfully
Duration: Xs
Status: SUCCESS
```

## Error Handling

If the command fails, it will:
- Display clear error message
- Suggest remediation steps
- Rollback if applicable
- Log to audit trail

## Related Commands

- `/incident-declare` - For production issues
- `/rollback-emergency` - For emergency rollbacks
- `/sla-report` - For compliance reporting
