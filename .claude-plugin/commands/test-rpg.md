---
description: Run RPG action tests with real Hyperscape instance
allowed-tools:
  - Bash(cd packages/plugin-hyperscape*)
  - Bash(bun run build)
  - Bash(bun test *)
  - Read(packages/plugin-hyperscape/src/__tests__/**/*.test.ts)
  - Read(logs/*.log)
  - Glob(packages/plugin-hyperscape/src/__tests__/**)
argument-hint: "[action-name] - Optional: specific action to test"
model: opus
thinking: true
---

Test the RPG action: $1

Execute comprehensive RPG action testing:

1. Build plugin-hyperscape
2. Start Hyperscape test server
3. Run rpg-action-bugs.test.ts for action: $1
4. Analyze logs if failures occur
5. Report results with screenshots

Commands to run:
```bash
cd packages/plugin-hyperscape
bun run build
bun test rpg-action-bugs.test.ts --grep "$1"
```

Expected colored cube proxies:
- 🔴 Red = Players
- 🟢 Green = Goblins
- 🔵 Blue = Items
- 🟡 Yellow = Trees
- 🟣 Purple = Banks
- 🟨 Yellow-Green = Stores
- 🟠 Orange = Fires
- 🔵 Blue = Fish spots
