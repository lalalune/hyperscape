# Hyperscape E2E Tests

End-to-end tests for Hyperscape multiplayer functionality. These tests use **real game systems** - no mocks, no fakes, just actual gameplay scenarios.

## Philosophy

Following the project's testing guidelines:
- ✅ **Real systems only** - Tests interact with actual game systems, network, and rendering
- ✅ **Visual verification** - Screenshots and scene inspection to verify behavior
- ✅ **Multimodal testing** - Test through UI, game state, and visual output
- ❌ **No mocks** - We test the real runtime, not simulated behavior
- ❌ **No shortcuts** - Tests must pass 100% or they're considered failures

## Test Files

### `multiplayer-visibility.spec.ts`
Tests that players can see each other in multiplayer:
- **2-player test**: Verifies both players appear in entity lists, minimap, and 3D scene
- **3-player test**: Verifies all players see each other correctly
- **Movement sync**: Verifies player movement is broadcast to other clients
- **Position validation**: Ensures players spawn at reasonable locations

### `debug-economy-panel.spec.ts`
Tests the debug panel functionality (F9 key):
- **Item spawning**: Verifies debug spawn adds items to inventory
- **Gold addition**: Verifies add gold button increases coins
- **Death trigger**: Verifies death event processes correctly
- **Sequential operations**: Tests multiple operations in realistic workflows
- **Panel toggling**: Verifies F9 key shows/hides panel

## Prerequisites

1. **Server must be running** on `http://localhost:3333`
   ```bash
   cd vendor/hyperscape
   bun run dev
   ```

2. **Playwright installed**
   ```bash
   bun install
   npx playwright install chromium
   ```

## Running Tests

### Run all E2E tests
```bash
bun run test:e2e
```

### Run specific test suites
```bash
# Multiplayer tests only
bun run test:e2e:multiplayer

# Debug panel tests only
bun run test:e2e:debug
```

### Run with UI (interactive mode)
```bash
bun run test:e2e:ui
```

### Run all tests (unit + e2e)
```bash
bun run test:all
```

## Test Output

Tests generate:
- **Screenshots** in `test-results/` directory
- **Videos** for failed tests (if configured)
- **HTML report** in `playwright-report/`
- **Console logs** from both server and client

## Debugging Failed Tests

1. **Check screenshots** - Visual verification of what went wrong
   ```
   test-results/multiplayer-player1-view.png
   test-results/multiplayer-player2-view.png
   ```

2. **Read console logs** - Tests log important state changes
   ```
   [Player1]: Spawned with ID: abc123
   [Player2]: Spawned with ID: def456
   Player 1 sees 2 player(s)
   ```

3. **Run in UI mode** - Step through tests interactively
   ```bash
   bun run test:e2e:ui
   ```

4. **Check server logs** - Server console shows network events
   ```
   [ServerNetwork] Player joined: abc123
   [DEBUG] Spawning item bronze_sword for player abc123
   ```

## Common Issues

### Players not seeing each other
- Check if server is broadcasting `entityAdded` packets
- Verify client `ClientNetwork` is handling entity packets
- Check console for network errors
- Look for entities at wrong positions (underground, far away)

### Debug panel not working
- Verify F9 key toggles panel visibility
- Check that `world.network.send()` is sending to server
- Verify server `handleDebugEvent()` is receiving events
- Check that event names match between client and server

### Tests timing out
- Increase timeout in test or playwright.config.ts
- Check if server is responding (curl http://localhost:3333)
- Verify game loads in browser manually first

## Writing New Tests

When adding new tests:

1. **Use real systems** - Query actual game state, don't mock
   ```typescript
   const inventory = await page.evaluate(() => {
     const world = (window as any).world;
     const inventorySystem = world.getSystem('inventory');
     return inventorySystem.getPlayerInventory(playerId);
   });
   ```

2. **Take screenshots** - Visual proof tests work
   ```typescript
   await page.screenshot({ 
     path: 'test-results/my-test.png' 
   });
   ```

3. **Log important state** - Help debugging
   ```typescript
   console.log('Player position:', position);
   ```

4. **Verify through multiple angles**
   - UI elements visible
   - Game state correct
   - Network events sent
   - Visual appearance matches

5. **Clean up resources**
   ```typescript
   try {
     // ... test code
   } finally {
     await context.close();
   }
   ```

## Integration with CI/CD

Tests can run in CI with:
```bash
# Headless mode (default)
bun run test:e2e

# With retries
bun run test:e2e --retries=2

# Generate artifacts
bun run test:e2e --reporter=html
```

Artifacts to save:
- `test-results/` - Screenshots and traces
- `playwright-report/` - HTML test report

## Related Documentation

- [Hyperscape Testing Guide](../../../docs/testing.md)
- [Playwright Documentation](https://playwright.dev)
- [Project Testing Rules](../../../../.cursor/rules/vendor/hyperscape/testing_rules.mdc)

