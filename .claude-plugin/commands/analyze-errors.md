---
description: Analyze error logs and suggest fixes
allowed-tools:
  - Read(logs/*.log)
  - Read(packages/plugin-hyperscape/src/**/*.ts)
  - Glob(logs/*)
  - Grep(packages/plugin-hyperscape/src/**)
  - Bash(cd packages/plugin-hyperscape*)
  - Bash(ls logs/)
  - Bash(grep *)
argument-hint: "[log-type] - Optional: error, test, runtime, or all"
model: opus
---

Analyze recent errors in /logs folder

Process:
1. Parse all error logs
2. Categorize by type:
   - TypeScript errors
   - Runtime errors
   - Test failures
   - Build errors
3. Identify patterns and common issues
4. Suggest fixes based on Hyperscape patterns
5. Link to relevant documentation

Commands:
```bash
# View recent error logs
ls -lt logs/ | head -10

# Search for specific error patterns
grep -r "Error:" logs/
grep -r "FAIL" logs/
grep -r "TS" logs/
```

Common error patterns:
- Type violations (any/unknown)
- Missing Hyperscape service
- WebSocket connection issues
- Three.js scene hierarchy problems
- Test timeout issues
