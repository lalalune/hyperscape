Analyze and prioritize technical debt across codebase

## Instructions

Execute the tech debt audit workflow:

1. Parse arguments: $ARGUMENTS
2. Validate prerequisites
3. Execute main workflow
4. Verify completion
5. Generate report

## Usage

```bash
/tech-debt-audit [arguments]
```

## Example

```bash
# Analyze and prioritize technical debt across codebase
/tech-debt-audit
```

## Output Format

```
✅ tech-debt-audit completed successfully
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
