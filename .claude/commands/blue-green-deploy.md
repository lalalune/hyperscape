Zero-downtime blue-green deployment with instant rollback capability

## Instructions

Execute the blue green deploy workflow:

1. Parse arguments: $ARGUMENTS
2. Validate prerequisites
3. Execute main workflow
4. Verify completion
5. Generate report

## Usage

```bash
/blue-green-deploy [arguments]
```

## Example

```bash
# Zero-downtime blue-green deployment with instant rollback capability
/blue-green-deploy
```

## Output Format

```
✅ blue-green-deploy completed successfully
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
