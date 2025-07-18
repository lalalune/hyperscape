# Hyperscape Packages

This directory contains the modular packages for the Hyperscape RPG project.

## Package Structure

### @hyperscape/rpg-core
The core RPG game logic packaged as a Hyperfy plugin. This includes:
- All game systems (combat, inventory, skills, etc.)
- Entity definitions
- World management
- Public API for external interaction

### @hyperscape/test-framework
A generic testing framework for Hyperfy applications that provides:
- Scenario-based testing
- Plugin loading and initialization
- Test runners (scenario, load, visual)
- Validation helpers
- Performance metrics

### @hyperscape/rpg-tests
Test scenarios specifically for the RPG, organized by category:
- Combat tests
- Banking tests
- Movement tests
- Item/inventory tests
- Skill tests
- NPC interaction tests

## Architecture

The new architecture provides clean separation of concerns:

1. **RPG Core** - Self-contained game logic with no test dependencies
2. **Test Framework** - Generic framework that can test any Hyperfy app
3. **RPG Tests** - Specific test scenarios for the RPG using the framework

## Key Benefits

- **Modularity**: Each package has a single responsibility
- **Clean APIs**: Tests interact through public APIs, not internals
- **Reusability**: Test framework can be used for any Hyperfy app
- **Maintainability**: Clear boundaries make code easier to understand
- **Testability**: RPG can be tested as a black box

## Usage

### Running the RPG
```bash
# Build the RPG core
cd packages/rpg-core
npm install
npm run build

# The RPG can now be loaded as a Hyperfy plugin
```

### Running Tests
```bash
# Build the test framework
cd packages/test-framework
npm install
npm run build

# Build and run RPG tests
cd packages/rpg-tests
npm install
npm run build
npm test

# Run specific test categories
npm run test:combat
npm run test:banking
npm run test:movement
```

### Writing New Tests

Tests follow a consistent pattern with 4 phases:

```typescript
class MyTestScenario implements TestScenario {
  async setup(context: TestContext): Promise<void> {
    // Prepare test environment
  }
  
  async execute(context: TestContext): Promise<void> {
    // Perform test actions
  }
  
  async validate(context: TestContext): Promise<TestValidation> {
    // Check results
  }
  
  async cleanup(context: TestContext): Promise<void> {
    // Restore original state
  }
}
```

## Development Workflow

1. Make changes to RPG core
2. Build the package: `npm run build`
3. Write/update tests in rpg-tests
4. Run tests to verify changes: `npm test`
5. Check test reports in `test-results/`

## Future Enhancements

- [ ] Visual regression testing
- [ ] Load testing scenarios
- [ ] Performance benchmarks
- [ ] Integration with CI/CD
- [ ] Test coverage reporting
- [ ] Automated test generation 