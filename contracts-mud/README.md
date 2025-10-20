# Hyperscape MMO Contracts

**Moved from**: `/contracts/src/games/mmo/` (formerly `/contracts/src/hyperscape/`)  
**New Location**: `/vendor/hyperscape/contracts-mud/`

## Why Here?

Hyperscape is a MUD-based autonomous world game that:
1. Uses MUD v2 framework (incompatible with Foundry-only compilation)
2. Has its own build system (`bun run build`)
3. Has its own test suite (`bun run test`)
4. Belongs with the Hyperscape vendor app, not core Jeju contracts

## Structure

```
contracts-mud/
├── mmo/                    # MMO game implementation
│   ├── src/
│   │   ├── systems/       # Game logic (8 systems)
│   │   ├── libraries/     # Shared mechanics (Combat, Item, XP)
│   │   └── codegen/       # Auto-generated MUD tables
│   ├── mud.config.ts      # MUD world configuration
│   ├── package.json       # MUD dependencies
│   └── worlds.json        # Deployed world addresses
└── README.md              # This file
```

## Building

```bash
cd /Users/shawwalters/jeju/vendor/hyperscape/contracts-mud/mmo
bun install
bun run build
```

## Deploying

```bash
cd /Users/shawwalters/jeju/vendor/hyperscape/contracts-mud/mmo
bun run deploy:local  # Localnet
```

## Testing

MUD tests run separately:
```bash
cd /Users/shawwalters/jeju/vendor/hyperscape/contracts-mud/mmo
bun run test
```

## Integration with Jeju

The Hyperscape game integrates with Jeju's infrastructure through:
- **Token Contracts**: Deploy RPGGold/RPGItems for player economy
- **Identity Registry**: Register the World contract as a game
- **Marketplace**: Trade items on JejuBazaar
- **Paymaster**: Players pay gas with any token

See `/scripts/deploy-rpg-game.ts` for full deployment flow.

---

*These contracts are part of the Hyperscape vendor app and compile separately from the main Jeju contracts.*
