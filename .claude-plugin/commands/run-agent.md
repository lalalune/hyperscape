---
description: Launch a test agent in Hyperscape world
allowed-tools:
  - Bash(cd packages/plugin-hyperscape*)
  - Bash(bun run *)
  - Bash(bun test *)
  - Read(characters/*.json)
  - Read(packages/plugin-hyperscape/src/**/*.ts)
  - Read(logs/*.log)
argument-hint: "<character-name> - Name of character file in characters/ directory"
model: opus
---

Launch test agent with character: $1

Steps:
1. Load character from characters/$1.json
2. Build plugin-hyperscape
3. Start Hyperscape world
4. Connect agent via WebSocket
5. Monitor agent actions in real-time
6. Save interaction logs

Commands:
```bash
cd packages/plugin-hyperscape
bun run build
bun run test:agents characters/$1.json
```

Monitor agent actions:
- PERCEIVE - Observe surroundings
- GOTO - Navigate to locations
- USE/UNUSE - Interact with objects
- CHOP_TREE, CATCH_FISH, COOK_FOOD - RPG skills
- REPLY - Chat with players
