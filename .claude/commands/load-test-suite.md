Execute comprehensive load testing suite with reporting

## Instructions

Execute the load test suite workflow:

1. Parse arguments: $ARGUMENTS
2. Validate prerequisites
3. Execute main workflow
4. Verify completion
5. Generate report

## Usage

```bash
/load-test-suite [arguments]
```

## Example

```bash
# Execute comprehensive load testing suite with reporting
/load-test-suite
```

## Output Format

```
✅ load-test-suite completed successfully
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
