# Common Workflows

## Database Migrations
1. Edit TypeScript schema in `server/db/schema/`
2. Generate migration: `bun run db:generate`
3. Review generated SQL in `server/db/migrations/`
4. Apply migration: `bun run db:migrate`
5. Commit both schema and migration files

## Adding a New API Endpoint
1. Define types in service file
2. Implement business logic in service class
3. Create route handler with TypeBox validation
4. Add Swagger documentation
5. Write tests for the endpoint
6. Run tests: `bun test`

## Adding a New 3D Component
1. Create component in `src/components/`
2. Use Three.js hooks from `@react-three/fiber`
3. Implement proper cleanup in `useEffect`
4. Add loading states and error boundaries
5. Test visually with Playwright screenshots

## Git Workflow
- Create feature branch from `main`
- Make commits with descriptive messages
- Run tests before pushing
- Create PR with description and test plan
- Merge after approval and CI pass
