Manage on-call rotation schedule and escalation policies

## Instructions

Execute the oncall schedule workflow:

1. Parse arguments: $ARGUMENTS
2. Validate prerequisites
3. Execute main workflow
4. Verify completion
5. Generate report

## Usage

```bash
/oncall-schedule [arguments]
```

## Example

```bash
# Manage on-call rotation schedule and escalation policies
/oncall-schedule
```

## Output Format

```
✅ oncall-schedule completed successfully
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
