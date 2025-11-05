Toggle feature flags on/off for gradual feature rollouts

## Instructions

Execute the feature flag toggle workflow:

1. Parse arguments: $ARGUMENTS
2. Validate prerequisites
3. Execute main workflow
4. Verify completion
5. Generate report

## Usage

```bash
/feature-flag-toggle [arguments]
```

## Example

```bash
# Toggle feature flags on/off for gradual feature rollouts
/feature-flag-toggle
```

## Output Format

```
✅ feature-flag-toggle completed successfully
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
