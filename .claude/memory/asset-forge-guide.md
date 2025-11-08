# Asset-Forge Specific Guide

## Project Purpose
Asset-forge is a 3D asset management and generation platform for creating game-ready 3D models, characters, and animations.

## Key Features
- **3D Viewer**: ThreeViewer.tsx component for GLB/VRM models
- **Asset Upload**: Support for GLB, VRM, FBX formats
- **AI Generation**: Integration with Meshy AI for 3D generation
- **Team Collaboration**: Multi-user teams with role-based permissions
- **Rigging & Retexture**: Advanced 3D asset processing

## Important Files
- `src/components/shared/ThreeViewer.tsx` - Main 3D viewer
- `server/api-elysia.ts` - API entry point
- `server/db/schema/` - Database schemas
- `server/routes/` - API route handlers
- `server/services/` - Business logic layer

## Database Tables
- `users` - User accounts (Privy auth)
- `projects` - Asset projects
- `assets` - 3D asset metadata
- `teams` - Collaboration teams
- `team_members` - Team memberships
- `rigging_metadata` - Rigging data
- `fitting_sessions` - Fitting workflows

## Environment Variables
Required in `.env`:
- `DATABASE_URL` - PostgreSQL connection string
- `PRIVY_APP_ID` - Privy app ID
- `PRIVY_APP_SECRET` - Privy secret
- `MESHY_API_KEY` - Meshy AI key
- `OPENAI_API_KEY` - OpenAI key

## Current Focus Areas
- Character model scaling (fixed: 1.7m default)
- Ground positioning (fixed: no double-centering)
- Visual regression testing (in progress)
- API pagination (recently added)
