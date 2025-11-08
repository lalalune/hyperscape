# Testing Standards

## Core Principles
- **NO MOCKS OR SPIES** - Use real implementations only
- Build mini-worlds for feature tests
- Use Playwright for browser automation
- Test both data and visual output

## Testing Stack
- **Bun Test** for unit and integration tests
- **Playwright** for E2E and visual tests
- **Percy/Chromatic** for visual regression (when applicable)

## Test Requirements
- Every feature MUST have tests before merging
- All tests MUST pass (100% pass rate required)
- Tests should run in under 30 seconds for unit tests
- E2E tests can take longer but should be parallelizable

## Test Organization
```
server/
├── routes/*.test.ts          # API tests
├── services/*.test.ts        # Service layer tests
tests/
├── e2e/                      # End-to-end tests
└── visual/                   # Visual regression tests
```

## Running Tests
- `bun test` - Run all tests
- `bun test --watch` - Watch mode
- `bun test tests/e2e` - Run specific test suite
