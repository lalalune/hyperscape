# Agent Workflow Procedures Memory

Standard workflows and procedures for common development tasks.

## Standard Development Workflow

### 1. Before Starting Work
1. **Check Existing Code**
   - Search codebase for similar functionality
   - Check if feature already exists
   - Review existing patterns

2. **Research Requirements**
   - Use `/elizaos-research <topic>` for ElizaOS patterns
   - Check relevant rule files in `.cursor/rules/`
   - Review memory files in `.cursor/memory/`
   - Visit ElizaOS documentation if needed

3. **Plan Implementation**
   - Identify which component type (Action, Provider, Service, etc.)
   - Review component-specific rules
   - Check existing examples
   - Plan error handling and logging

### 2. During Implementation
1. **Follow Patterns**
   - Use templates from `agent-development-patterns.md`
   - Follow rules from `.cursor/rules/`
   - Use established patterns from existing code

2. **Write Code**
   - Use TypeScript strict typing (no `any`)
   - Implement proper error handling
   - Add structured logging
   - Validate inputs with Zod

3. **Check Hooks**
   - Hooks will automatically check for violations
   - Review hook output for warnings
   - Fix any violations before continuing

### 3. After Implementation
1. **Validate Code**
   - Use `/elizaos-validate <file>` to check against patterns
   - Review hook violations
   - Check for TypeScript errors

2. **Write Tests**
   - Write real gameplay tests (no mocks)
   - Use Playwright for E2E tests
   - Use visual testing with colored cubes
   - Verify all tests pass

3. **Update Documentation**
   - Update memories if patterns change
   - Add examples if needed
   - Document any new patterns

## Component Creation Workflows

### Creating a New Action

**Step 1: Research**
```bash
# Use command to research
/elizaos-research action interface structure

# Check rule file
.cursor/rules/plugin-eliza-actions.mdc

# Check memory
.cursor/memory/elizaos-action-patterns.md
```

**Step 2: Check Existing**
```typescript
// Search for similar actions
grep -r "name: '.*ACTION'" packages/plugin-eliza/src/actions/
```

**Step 3: Implement**
```typescript
// Use template from agent-development-patterns.md
export const myAction: Action = {
  name: 'MY_ACTION',
  // ... implementation
};
```

**Step 4: Validate**
```bash
/elizaos-validate packages/plugin-eliza/src/actions/my-action.ts
```

**Step 5: Test**
```typescript
// Write real gameplay test
test('my action test', async () => {
  // Real test implementation
});
```

### Creating a New Provider

**Step 1: Research**
```bash
/elizaos-research provider patterns
```

**Step 2: Check Existing**
```typescript
grep -r "name: '.*PROVIDER'" packages/plugin-eliza/src/providers/
```

**Step 3: Implement**
```typescript
export const myProvider: Provider = {
  name: 'MY_PROVIDER',
  // ... implementation
};
```

**Step 4: Validate**
```bash
/elizaos-validate packages/plugin-eliza/src/providers/my-provider.ts
```

**Step 5: Test**
```typescript
test('my provider test', async () => {
  // Test provider get method
});
```

### Creating a New Service

**Step 1: Research**
```bash
/elizaos-research service lifecycle
```

**Step 2: Check Existing**
```typescript
grep -r "extends Service" packages/plugin-eliza/src/services/
```

**Step 3: Implement**
```typescript
export class MyService extends Service {
  static serviceType = 'my-service';
  // ... implementation
}
```

**Step 4: Validate**
```bash
/elizaos-validate packages/plugin-eliza/src/services/my-service.ts
```

**Step 5: Test**
```typescript
test('my service test', async () => {
  // Test service lifecycle
});
```

## Debugging Workflow

### 1. Identify Issue
- Check error logs in `/logs` folder
- Review hook violations
- Check TypeScript errors
- Review test failures

### 2. Investigate
- Check relevant rule files
- Review memory files for patterns
- Search codebase for similar issues
- Check ElizaOS documentation

### 3. Fix Issue
- Follow established patterns
- Fix root cause (don't work around)
- Add proper error handling
- Add logging for debugging

### 4. Verify Fix
- Run tests
- Check hook violations
- Validate with `/elizaos-validate`
- Review logs

## Testing Workflow

### 1. Write Test
```typescript
// Use real gameplay testing
test('feature test', async () => {
  const world = await createViewerWorld({ assetsDir: './assets' });
  // Test implementation
  await world.cleanup();
});
```

### 2. Run Test
```bash
bun test packages/plugin-eliza/src/__tests__/my-test.ts
```

### 3. Verify Results
- Check test output
- Review error logs
- Verify visual testing results
- Check Three.js scene hierarchy

### 4. Fix Issues
- Fix failing tests
- Add missing test cases
- Improve test coverage

## Code Review Workflow

### 1. Self-Review
- Check hook violations
- Run `/elizaos-validate` on changed files
- Verify all tests pass
- Review error handling
- Check logging

### 2. Pattern Check
- Verify follows established patterns
- Check against rule files
- Review memory files
- Ensure no duplicate code

### 3. Quality Check
- No `any` types
- Proper error handling
- Structured logging
- Input validation
- Security checks

## Documentation Workflow

### 1. Update Memories
- Add new patterns to `agent-development-patterns.md`
- Update workflows in `agent-workflow-procedures.md`
- Update project context in `agent-project-context.md`

### 2. Update Rules
- Add new rules if patterns emerge
- Update existing rules if patterns change
- Document exceptions

### 3. Update Indexes
- Update `rules-index.md` if rules added
- Update `hooks-index.md` if hooks added
- Update `master-index.md` for major changes

## Common Procedures

### Adding New Dependency
1. Check if dependency already exists
2. Add to `package.json`
3. Run `bun install`
4. Update types if needed
5. Test integration

### Fixing TypeScript Errors
1. Check error message
2. Review type definitions
3. Check `@hyperscape/shared` for types
4. Use type guards if needed
5. Avoid `any` types

### Fixing Hook Violations
1. Read violation message
2. Check relevant rule file
3. Fix violation following pattern
4. Re-run hooks to verify

### Updating Configuration
1. Check `src/config/constants.ts`
2. Update environment variables if needed
3. Document changes
4. Test configuration

## Emergency Procedures

### Service Not Connecting
1. Check service initialization
2. Verify API keys
3. Check connection retry logic
4. Review error logs
5. Test connection manually

### Tests Failing
1. Check test logs
2. Verify test setup
3. Check for race conditions
4. Review visual testing setup
5. Check Three.js scene hierarchy

### Build Errors
1. Check TypeScript errors
2. Verify imports
3. Check package dependencies
4. Review build configuration
5. Clean and rebuild

## Best Practices Checklist

Before committing code, verify:
- [ ] All tests pass
- [ ] No hook violations
- [ ] No TypeScript errors
- [ ] Proper error handling
- [ ] Structured logging
- [ ] Input validation
- [ ] Security checks
- [ ] Documentation updated
- [ ] No duplicate code
- [ ] Follows patterns

