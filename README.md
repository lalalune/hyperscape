# Hyperscape Monorepo

AI-powered virtual world platform with RPG elements, built on Hyperfy.

## Overview

This monorepo contains all the packages for the Hyperscape ecosystem:

- **@hyperscape/hyperfy** - Core 3D virtual world engine
- **@hyperscape/rpg** - Core RPG game logic
- **@elizaos/plugin-hyperfy** - ElizaOS integration plugin
- **@hyperscape/ai-creation** - AI-powered content generation
- **@hyperscape/rpg-tests** - RPG test scenarios
- **@hyperscape/test-framework** - Testing utilities

## Tech Stack

- **Build System**: [Turborepo](https://turbo.build/)
- **Package Manager**: npm workspaces
- **Language**: TypeScript
- **3D Engine**: Three.js
- **Runtime**: Node.js 22.11.0

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Build all packages**:
   ```bash
   npm run build
   ```

3. **Start development mode**:
   ```bash
   npm run dev
   ```

## Available Commands

### Global Commands

- `npm run build` - Build all packages with caching
- `npm run dev` - Start development mode for all packages
- `npm run test` - Run tests across all packages
- `npm run lint` - Lint all packages
- `npm run clean` - Clean build artifacts
- `npm run typecheck` - Type check all TypeScript code

### Package-specific Commands

- `npm run build:hyperfy` - Build only the Hyperfy engine
- `npm run build:rpg-core` - Build only the RPG core
- `npm run dev:hyperfy` - Run Hyperfy in dev mode

### Utilities

- `npm run graph` - Visualize the build dependency graph
- `npm run list:workspaces` - List all workspace packages

## Package Structure

```
hyperscape/
├── packages/
│   ├── hyperfy/           # Core virtual world engine
│   ├── rpg-core/          # RPG game logic
│   ├── rpg-tests/         # Test scenarios
│   ├── test-framework/    # Testing utilities
│   └── plugin-hyperfy/    # ElizaOS integration
├── turbo.json             # Turborepo configuration
├── package.json           # Root workspace config
└── .npmrc                 # npm configuration
```

## Turbo Features

This monorepo uses Turborepo for:

- **Incremental Builds**: Only rebuild what changed
- **Parallel Execution**: Run tasks in parallel when possible
- **Smart Caching**: Cache build outputs locally
- **Dependency Graph**: Automatic task ordering based on dependencies

## Development Tips

1. **Faster Builds**: Turbo caches build outputs. After the first build, subsequent builds only rebuild changed packages.

2. **Filtered Builds**: Build specific packages:
   ```bash
   npx turbo run build --filter=@hyperscape/hyperfy
   ```

3. **Watch Mode**: Most packages support watch mode:
   ```bash
   npm run dev
   ```

4. **Dependency Graph**: Visualize package dependencies:
   ```bash
   npm run graph
   ```

## Missing Dependencies

Some packages reference private @elizaos packages that aren't in the public npm registry. See `workspace-setup.md` for details on handling these.

## Contributing

1. Make changes in the relevant package
2. Run `npm run build` to verify everything builds
3. Run `npm run test` to ensure tests pass
4. Commit your changes

## License

MIT 