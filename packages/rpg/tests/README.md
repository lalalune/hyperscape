# RPG Testing Framework

This directory contains comprehensive tests for the RPG package following the testing methodology outlined in CLAUDE.md.

## Test Types

### Unit Tests (`/unit`)
- Individual system testing
- Component testing
- Utility function testing
- Mock-free testing with real components

### Integration Tests (`/integration`) 
- System interaction testing
- Multi-component workflows
- Real Hyperfy world testing

### Visual Tests (`/visual`)
- Playwright-based browser testing
- Screenshot validation using colored cubes
- Camera rig testing
- Pixel analysis for entity verification

### Test Worlds (`/worlds`)
- Minimal Hyperfy worlds for specific test scenarios
- Color-coded entity proxies
- Overhead camera configurations

## Testing Principles

1. **Real Code Only** - No mocks, spies, or test framework abstractions
2. **Visual Verification** - Screenshot testing with colored entity proxies
3. **Real Runtime** - All tests use actual Hyperfy client and runtime
4. **Error Logging** - Comprehensive error collection and verification
5. **Multi-modal Testing** - Three.js scene inspection + visual + programmatic

## Running Tests

```bash
npm test                 # Run all tests
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only 
npm run test:visual      # Visual tests only
```

## Test World Setup

Each test creates a mini-world with:
- Overhead orthographic camera
- Colored cube proxies for entities
- Error logging capture
- Scene state verification