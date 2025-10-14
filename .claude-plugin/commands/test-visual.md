---
description: Run visual tests for a feature with colored cube proxies
allowed-tools:
  - Bash(cd packages/plugin-hyperscape*)
  - Bash(bun test *)
  - Read(packages/plugin-hyperscape/src/__tests__/**/*.test.ts)
  - Read(logs/*.log)
  - Glob(packages/plugin-hyperscape/src/__tests__/**)
argument-hint: "[feature] - Optional: specific feature to test (e.g., woodcutting, fishing)"
model: opus
thinking: true
---

Execute visual tests for: $1

Steps:
1. Launch Playwright browser
2. Load mini-world for $1
3. Run colored cube proxy tests
4. Capture screenshots
5. Analyze with ColorDetector
6. Report pass/fail with visual evidence

Commands:
```bash
cd packages/plugin-hyperscape
bun test visual --grep "$1"
```

Visual testing methodology:
- Real Hyperscape worlds (no mocks)
- Colored cube proxies for entities
- Screenshot analysis
- Three.js scene hierarchy validation
