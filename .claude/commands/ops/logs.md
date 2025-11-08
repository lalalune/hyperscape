---
description: View application and error logs
allowed-tools: [Bash, Read]
argument-hint: [error|access|all|tail]
---

# View Logs

View application logs, error logs, and debugging output.

## Usage

- `/ops/logs` or `/ops/logs all` - Show all recent logs
- `/ops/logs error` - Show only error logs
- `/ops/logs tail` - Follow logs in real-time
- `/ops/logs access` - Show access/request logs

## All Recent Logs

```bash
!`cd /Users/home/hyperscape-5 && echo "=== Recent Logs ===" && if [ -d logs ]; then find logs -type f -name "*.log" -mtime -1 -exec sh -c 'echo "=== {} ===" && tail -20 {}' \; ; else echo "No logs directory found"; fi`
```

## Error Logs Only

```bash
!`cd /Users/home/hyperscape-5 && echo "=== Error Logs ===" && if [ -d logs ]; then find logs -type f -name "*error*.log" -o -name "*.err" -exec sh -c 'echo "=== {} ===" && cat {}' \; ; else echo "No error logs found"; fi`
```

## Tail Logs (Real-time)

```bash
!`cd /Users/home/hyperscape-5 && if [ -d logs ]; then echo "Following logs (Ctrl+C to stop)..." && tail -f logs/*.log 2>/dev/null; else echo "No logs directory - start dev server to generate logs"; fi`
```

## Access/Request Logs

```bash
!`cd /Users/home/hyperscape-5 && echo "=== Access Logs ===" && if [ -d logs ]; then find logs -type f -name "*access*.log" -o -name "*request*.log" -exec sh -c 'echo "=== {} ===" && tail -50 {}' \; ; else echo "No access logs found"; fi`
```

## Test Error Logs

```bash
!`cd /Users/home/hyperscape-5 && echo "=== Test Error Logs ===" && find logs -type f -name "test-*.log" 2>/dev/null -exec sh -c 'echo "=== {} ===" && cat {}' \; || echo "No test logs found"`
```

## Log Statistics

```bash
!`cd /Users/home/hyperscape-5 && echo "=== Log Statistics ===" && if [ -d logs ]; then echo "Total log files: $(find logs -type f -name "*.log" | wc -l)" && echo "Total log size: $(du -sh logs 2>/dev/null | cut -f1)" && echo && echo "Log files:" && ls -lh logs/*.log 2>/dev/null | awk '{print $9, $5}'; else echo "No logs directory"; fi`
```

## Clear Old Logs

Remove logs older than 7 days:

```bash
!`cd /Users/home/hyperscape-5 && if [ -d logs ]; then echo "Clearing logs older than 7 days..." && find logs -type f -name "*.log" -mtime +7 -delete && echo "✅ Old logs cleared"; else echo "No logs directory"; fi`
```

## Log Locations

Common log locations in the project:

- `/logs/` - Application logs
- `/logs/error/` - Error logs
- `/logs/test/` - Test execution logs
- `/tmp/` - Temporary build and test logs

## Create Logs Directory

If logs directory doesn't exist:

```bash
!`cd /Users/home/hyperscape-5 && mkdir -p logs/error logs/test && echo "✅ Logs directory structure created"`
```

## Search Logs

Search for specific text in logs:

```bash
!`if [ -n "$ARGUMENTS" ]; then cd /Users/home/hyperscape-5 && echo "Searching logs for: $ARGUMENTS" && grep -r "$ARGUMENTS" logs/ 2>/dev/null || echo "Not found"; else echo "Provide search term: /ops/logs <search-term>"; fi`
```

## Log Formats

### Error Log Format

```
[YYYY-MM-DD HH:MM:SS] ERROR: Error message
  at functionName (file.ts:line:column)
  ...stack trace...
```

### Access Log Format

```
[YYYY-MM-DD HH:MM:SS] METHOD /path status:200 duration:123ms
```

## Common Log Patterns

### Find Errors

```bash
!`cd /Users/home/hyperscape-5 && grep -r "ERROR\|FATAL\|CRITICAL" logs/ 2>/dev/null | tail -20`
```

### Find Slow Requests (>1s)

```bash
!`cd /Users/home/hyperscape-5 && grep -r "duration:[0-9]\{4,\}ms" logs/ 2>/dev/null | tail -20`
```

### Find Database Errors

```bash
!`cd /Users/home/hyperscape-5 && grep -r "database\|sqlite\|SQL" logs/ 2>/dev/null | grep -i "error" | tail -20`
```

## Troubleshooting

### No Logs Generated

If logs aren't being created:

1. Check logs directory exists: `/ops/logs all`
2. Ensure dev server is running: `/dev`
3. Check file permissions
4. Verify logging configuration

### Logs Too Large

If logs are consuming too much space:

```bash
!`cd /Users/home/hyperscape-5 && echo "Large log files:" && find logs -type f -name "*.log" -size +10M -exec ls -lh {} \;`
```

## See Also

- `/dev` - Start dev server (generates logs)
- `/test` - Run tests (creates test logs)
- @packages/asset-forge/server/ - Server logging configuration
