# Build Commands

## Asset-Forge Commands
```bash
# Development
cd packages/asset-forge
bun run dev                  # Start dev server (port 5173)
bun run dev:server           # Start API server only

# Building
bun run build                # Build for production
bun run preview              # Preview production build

# Testing
bun test                     # Run all tests
bun test --watch             # Watch mode
bun test --coverage          # With coverage

# Database
bun run db:generate          # Generate migration
bun run db:migrate           # Apply migrations
bun run db:push              # Push schema (dev only)
bun run db:studio            # Launch Drizzle Studio

# Type Checking
bun tsc                      # Check types
bun tsc --noEmit             # Check without output
```

## Root Level Commands
```bash
# Install dependencies
bun install

# Run specific package
bun --filter asset-forge dev
bun --filter client dev
```
