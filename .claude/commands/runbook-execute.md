Execute predefined runbooks for common operational procedures

## Instructions

Execute the runbook execute workflow:

1. Parse arguments: $ARGUMENTS
2. Validate prerequisites
3. Execute main workflow
4. Verify completion
5. Generate report

## Usage

```bash
/runbook-execute [arguments]
```

## Example

```bash
# Execute predefined runbooks for common operational procedures
/runbook-execute
```

## Output Format

```
✅ runbook-execute completed successfully
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
