# Architecture Patterns

## Tech Stack
- **Frontend**: React + Vite + TypeScript
- **3D**: Three.js + React Three Fiber
- **Backend**: Elysia (Bun) + TypeScript
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Privy (JWT)
- **Deployment**: Railway

## Design Principles
- **Modular**: Each feature is self-contained
- **Type-Safe**: TypeScript strict mode everywhere
- **RESTful APIs**: Follow REST conventions
- **Database First**: Schema-driven development

## Package Structure
```
packages/
├── asset-forge/        # Main 3D asset management app
│   ├── src/           # React frontend
│   └── server/        # Elysia backend
├── client/            # Game client
└── hyperscape/        # Game engine core
```

## Key Patterns
- **Service Layer**: Business logic in services (e.g., `TeamService`)
- **Route Layer**: HTTP handlers in routes (e.g., `teams.ts`)
- **Schema Layer**: Database schemas with Drizzle
- **Component Layer**: Reusable React components

## State Management
- React hooks (`useState`, `useEffect`) for local state
- Context API for shared state
- No Redux/MobX unless absolutely necessary
