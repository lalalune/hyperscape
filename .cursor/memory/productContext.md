# Product Context

## Project Scope
Hyperscape is a 3D multiplayer game engine built on three.js with:
- Voice communication via LiveKit
- VRM avatar system
- Application abstraction for self-contained world apps
- RPG game built as standalone .hyp app

## Components
- **Hyperscape Engine** (`packages/hypefy`) - Core 3D multiplayer engine
- **Plugin Hyperscape** (`packages/plugin-hyperscape`) - ElizaOS integration
- **Client** (`packages/client`) - React frontend
- **Server** (`packages/server`) - Backend API and game server
- **Shared** (`packages/shared`) - Shared types and utilities
- **Asset Forge** (`packages/asset-forge`) - Asset management system

## Architecture Decisions
- ECS (Entity Component System) architecture
- SQLite for persistence (PostgreSQL in production)
- Privy for authentication and wallet management
- ElizaOS for AI agent framework
- Playwright for real gameplay testing

## Technology Stack Details
- **Frontend**: React, TypeScript, Vite
- **Backend**: Node.js, Bun runtime, Drizzle ORM
- **3D Engine**: Three.js via Hyperscape abstractions
- **Testing**: Playwright, real gameplay testing
- **Deployment**: Railway with Railpack

