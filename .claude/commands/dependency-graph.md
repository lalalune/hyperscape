Generate service dependency graph visualization

## Instructions

Execute the dependency graph workflow:

1. Parse arguments: $ARGUMENTS
2. Validate prerequisites
3. Execute main workflow
4. Verify completion
5. Generate report

## Usage

```bash
/dependency-graph [arguments]
```

## Example

```bash
# Generate service dependency graph visualization
/dependency-graph
```

## Output Format

```
✅ dependency-graph completed successfully
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
