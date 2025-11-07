# 0007. Real Gameplay Testing with Playwright

Date: 2025-11-06

## Status

Accepted

## Context

Hyperscape is a complex 3D multiplayer game with player interactions, AI agents, inventory systems, combat mechanics, and world state synchronization. Testing requires validating both game logic and visual rendering in a real browser environment with actual gameplay scenarios.

### Current Situation
- Complex game systems requiring integration testing:
  - 3D rendering (Three.js scenes)
  - Multiplayer synchronization (WebSockets)
  - AI agent behaviors (ElizaOS)
  - Combat mechanics (damage, death, loot)
  - Inventory and trading systems
  - Quest and skill progression
  - Resource gathering and respawning
  - NPC spawning and behavior

### Traditional Testing Challenges
- **Mocking complexity**: Game systems deeply interconnected, mocks don't reflect reality
- **Rendering validation**: Can't verify 3D visuals with unit tests
- **Integration gaps**: Unit tests pass but features broken in browser
- **Flaky tests**: Mock-based tests give false confidence
- **Maintenance burden**: Mocks require constant updates as code changes
- **No visual regression**: Can't detect rendering bugs
- **Multiplayer scenarios**: Hard to test player-player interactions with mocks

### Requirements
- **Real browser testing** - Test in actual Chrome/Firefox environment
- **3D rendering verification** - Validate Three.js scenes and objects
- **Visual testing** - Screenshot analysis for rendering correctness
- **End-to-end scenarios** - Full gameplay flows (login → play → logout)
- **Multiplayer testing** - Multiple concurrent player sessions
- **No mocks** - Use real instances of all systems
- **Automated** - Run in CI/CD pipeline
- **Debuggable** - Save screenshots and logs on failure

### Drivers
- **Confidence** - Know features actually work in browser
- **Regression prevention** - Catch breaking changes before production
- **Visual validation** - Detect rendering bugs and UI issues
- **Real scenarios** - Test actual gameplay, not simplified mocks
- **Documentation** - Tests demonstrate how systems work together

## Decision

We will **use Playwright for real gameplay testing** with actual Hyperscape instances, real Three.js rendering, and no mocks or test framework abstractions. Tests validate both data correctness and visual rendering.

### Key Points
- **NO mocks, spies, or test framework abstractions**
- **Build mini-worlds** for each feature test
- **Use real Hyperscape instances** with Playwright browser automation
- **Test multimodal verification** - data introspection + visual validation
- **Three.js testing** - Check scene hierarchy and object positions
- **Visual testing** - Screenshot analysis with colored cube proxies
- **System integration** - ECS systems and data introspection
- **LLM verification** - GPT-4o for image analysis when needed
- **All tests must pass** - No merging with failing tests

### Testing Methods

#### 1. Three.js Testing
Inspect scene hierarchy and object positions:
```typescript
// Check player exists in Three.js scene
const scene = world.scene;
const playerMesh = scene.getObjectByName('player-123');
expect(playerMesh.position.x).toBeCloseTo(10);
expect(playerMesh.position.y).toBeCloseTo(0);
```

#### 2. Visual Testing with Proxies
Use colored cubes for visual verification:
- 🔴 **Red** - Players
- 🟢 **Green** - Goblins
- 🔵 **Blue** - Items
- 🟡 **Yellow** - Trees
- 🟣 **Purple** - Banks
- 🟨 **Beige** - Stores

```typescript
// Take screenshot and verify player (red cube) visible
await page.screenshot({ path: 'player-test.png' });
// Visual inspection or LLM analysis confirms red cube at expected position
```

#### 3. System Integration Testing
Test ECS systems and data:
```typescript
// Test combat system
await player.attack(goblin);
expect(goblin.health).toBeLessThan(100);
expect(goblin.state).toBe('combat');
```

#### 4. LLM Verification
Use GPT-4o for complex visual analysis:
```typescript
// Analyze screenshot to verify game state
const analysis = await gpt4o.analyzeImage('combat-test.png',
  'Verify the red cube (player) is near the green cube (goblin) and combat is happening'
);
expect(analysis.combatVisible).toBe(true);
```

### Implementation Details
```typescript
// Example real gameplay test
import { test, expect } from '@playwright/test';

test('player can attack and defeat goblin', async ({ page }) => {
  // 1. Build mini-world
  const world = await createTestWorld();
  const player = await world.spawnPlayer({ x: 0, y: 0 });
  const goblin = await world.spawnGoblin({ x: 5, y: 0 });

  // 2. Navigate to game
  await page.goto('http://localhost:3000');
  await page.waitForSelector('.game-canvas');

  // 3. Perform gameplay action
  await page.click('.attack-button');

  // 4. Verify data
  await page.waitForTimeout(1000); // Wait for combat
  const goblinHealth = await world.getEntityHealth(goblin.id);
  expect(goblinHealth).toBeLessThan(100);

  // 5. Visual verification
  await page.screenshot({ path: 'test-results/combat-test.png' });

  // 6. Check Three.js scene
  const goblinPosition = await world.getEntityPosition(goblin.id);
  expect(goblinPosition.x).toBeCloseTo(5);

  // 7. Verify loot drop on death
  await player.attack(goblin); // Finish off
  const loot = await world.getEntitiesNear(goblin.position, 2);
  expect(loot.some(e => e.type === 'item')).toBe(true);
});
```

## Alternatives Considered

### Alternative 1: Jest/Vitest Unit Tests with Mocks
**Pros:**
- Fast execution
- Easy to write
- Good for pure logic testing
- Standard practice in industry

**Cons:**
- **Doesn't test real integration** - Mocks miss edge cases
- **Can't validate rendering** - No browser, no Three.js
- **False confidence** - Tests pass but features broken
- **Mock maintenance** - Mocks drift from reality
- **No visual regression** - Can't detect rendering bugs

**Reason for rejection:** Unit tests valuable for pure logic but insufficient for complex game systems. Hyperscape's value is in integration of systems (3D rendering + AI + multiplayer), not individual functions. Unit tests can't validate what matters most.

### Alternative 2: Cypress for E2E Testing
**Pros:**
- Popular E2E framework
- Good developer experience
- Time-travel debugging
- Good documentation

**Cons:**
- Encourages mocking and stubbing
- More opinionated than Playwright
- Worse performance for parallel tests
- Weaker multi-browser support
- Harder to test multiple players simultaneously

**Reason for rejection:** Cypress philosophy includes mocking network requests and stubbing backends. Hyperscape needs real server, real database, real game state. Playwright's flexibility and performance better match our needs.

### Alternative 3: Puppeteer (Browser Automation)
**Pros:**
- Lower-level control
- Chrome DevTools Protocol access
- Good for screenshots
- Lightweight

**Cons:**
- No built-in test runner
- Manual test organization
- Less structured than Playwright
- Weaker cross-browser support
- More boilerplate

**Reason for rejection:** Playwright is Puppeteer's successor from same team with better API, cross-browser support, and built-in test runner. No reason to use Puppeteer over Playwright.

### Alternative 4: Selenium WebDriver
**Pros:**
- Industry standard for decades
- Multi-language support
- Extensive ecosystem
- Cross-browser support

**Cons:**
- Slower than Playwright
- More verbose API
- Flakier tests (waits, timing)
- Older architecture
- Worse developer experience

**Reason for rejection:** Selenium is legacy technology. Playwright offers same cross-browser support with modern API, better performance, and more reliable tests.

### Alternative 5: Manual Testing Only
**Pros:**
- No test code to write
- Human judgment of quality
- Can spot visual issues easily
- Flexible exploration

**Cons:**
- **Not scalable** - Can't test every change manually
- **Slow feedback** - Wait for human tester
- **Inconsistent** - Human error, missed cases
- **No regression prevention** - Easy to break old features
- **Expensive** - Human time costly

**Reason for rejection:** Manual testing essential for exploratory testing and UX validation but insufficient for regression prevention. Automated tests catch regressions instantly while manual testers focus on new features.

## Consequences

### Positive
- **Real confidence** - Tests validate actual gameplay in browser
- **Visual regression detection** - Screenshots catch rendering bugs
- **Integration validation** - All systems tested together
- **No mock drift** - Tests use real code, always accurate
- **Debugging capability** - Screenshots and logs on failure
- **Documentation** - Tests show how systems work
- **Multiplayer testing** - Can test player interactions
- **Comprehensive coverage** - Data + visual + interaction validation
- **CI/CD integration** - Automated regression prevention

### Negative
- **Slower than unit tests** - Browser startup, real rendering takes time
- **More complex setup** - Need database, server, test worlds
- **Resource intensive** - Requires headless browser in CI
- **Debugging harder** - More components involved in failures
- **Flakiness risk** - Timing issues with real async operations
- **Test data management** - Need to create test worlds for each scenario

### Neutral
- Tests run in CI/CD pipeline (slower but thorough)
- Screenshots saved to test-results/ directory
- Error logs saved to /logs folder
- Can run headless for CI or headed for debugging
- Tests serve as integration documentation

### Risks
- **Risk 1: Test flakiness due to timing**
  - Mitigation: Use Playwright's built-in waiting mechanisms
  - Best practice: Wait for specific conditions, not arbitrary timeouts
  - Status: Playwright's auto-waiting reduces flakiness significantly

- **Risk 2: Slow test execution in CI**
  - Mitigation: Run tests in parallel with Playwright workers
  - Optimization: Only run affected tests for quick feedback
  - Trade-off: Slower than unit tests but much more valuable

- **Risk 3: Complex test setup and maintenance**
  - Mitigation: Create helper functions for common scenarios
  - Pattern: Reusable world builders, entity spawners
  - Benefit: Setup complexity pays off in test reliability

- **Risk 4: Resource requirements for CI**
  - Mitigation: Use Railway or GitHub Actions with sufficient resources
  - Cost: Worth investment for regression prevention
  - Optimization: Parallel execution reduces total time

## Implementation

### Action Items
- [x] Add Playwright dependencies
- [x] Create test world builders (mini-worlds)
- [x] Implement colored cube proxies for visual testing
- [x] Set up screenshot capture on test failure
- [x] Configure error logging to /logs folder
- [x] Define testing standards in CLAUDE.md
- [x] Create example tests for key features
- [ ] Document visual proxy system for team
- [ ] Add LLM-based visual verification helpers
- [ ] Optimize test parallelization
- [ ] Create test data fixtures and factories

### Timeline
- **2025**: Playwright testing methodology established
- **Oct-Nov 2025**: Test coverage expanded for key features
- **Nov 6, 2025**: ADR documented
- **Ongoing**: All new features require passing tests

### Success Metrics
- ✅ Every feature has Playwright tests - **ENFORCED**
- ✅ All tests pass before merge - **REQUIRED**
- ✅ Zero production bugs that tests should have caught - **MONITORING**
- [ ] Test execution time < 10 minutes (Target: 5 minutes) - **OPTIMIZING**
- [ ] 90%+ confidence in test reliability - **MEASURING**

## References

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Visual Testing](https://playwright.dev/docs/test-snapshots)
- CLAUDE.md testing-standards.mdc - Real Testing Standards
- packages/server/package.json:64 - @playwright/test dependency
- Root package.json:103 - playwright dependency
- README.md - Testing methodology overview

## Notes

**From CLAUDE.md testing standards:**

> ## Core Principles
> - NO mocks, spies, or test framework abstractions
> - Build mini-worlds for each feature test
> - Use real Hyperscape instances with Playwright
> - Test multimodal verification (data + visual)
>
> ## Testing Methods
> 1. **Three.js Testing** - Check scene hierarchy and positions
> 2. **Visual Testing** - Screenshot analysis with colored cube proxies
> 3. **System Integration** - ECS systems and data introspection
> 4. **LLM Verification** - GPT-4o for image analysis when needed
>
> ## Visual Testing Proxies
> - 🔴 Players
> - 🟢 Goblins
> - 🔵 Items
> - 🟡 Trees
> - 🟣 Banks
> - 🟨 Stores
>
> ## Requirements
> - Every feature MUST have tests
> - All tests MUST pass before moving on
> - Use real gameplay, real objects, real data
> - Save error logs to /logs folder

**Philosophy: Real Testing Over Mocking**

Traditional testing pyramid (unit > integration > E2E) assumes mocks are acceptable. Hyperscape inverts this for game logic:

1. **E2E/Integration Tests** (Primary) - Real gameplay scenarios with Playwright
2. **Unit Tests** (Secondary) - Pure logic functions with no dependencies
3. **Mocks** (Never) - Forbidden except for external APIs

**Rationale:** Game value is in system integration. A perfectly tested inventory function is worthless if it doesn't work with the UI, database, and multiplayer sync. Real tests catch real bugs.

**Visual proxy system:**
Colored cubes replace complex 3D models in tests for:
- **Faster rendering** - Simple geometry loads instantly
- **Clear identification** - Color coding obvious in screenshots
- **Deterministic** - No complex animations or variations
- **LLM-friendly** - GPT-4o easily identifies colored cubes

Example: Testing goblin spawning
- Spawn goblin entity in database
- Render green cube at goblin position
- Screenshot shows green cube where expected
- LLM verifies "green cube visible at coordinates X,Y"

**Mini-world pattern:**
Each test creates isolated world:
```typescript
const world = await createTestWorld({
  players: [{ id: 'p1', position: { x: 0, y: 0 } }],
  npcs: [{ type: 'goblin', position: { x: 10, y: 0 } }],
  items: [{ type: 'sword', position: { x: 5, y: 0 } }],
});
```

Isolated worlds prevent:
- Test interference (one test's data affecting another)
- Flakiness from shared state
- Hard-to-debug cross-test pollution

**Multimodal verification:**
Tests validate multiple aspects:
1. **Data correctness** - Database reflects expected state
2. **Scene correctness** - Three.js objects in correct positions
3. **Visual correctness** - Screenshot shows expected rendering
4. **Behavior correctness** - Actions produce expected results

Example: Combat test validates
- Database: Goblin health decreased
- Scene: Goblin mesh still exists (didn't despawn prematurely)
- Visual: Red cube (player) near green cube (goblin)
- Behavior: Combat state active, damage numbers shown

**Debugging workflow:**
1. Test fails
2. Check saved screenshot in test-results/
3. Check error logs in /logs folder
4. Run test in headed mode to watch visually
5. Inspect Three.js scene in browser DevTools
6. Fix bug
7. Verify test passes

**Performance optimization:**
- Parallel test execution (Playwright workers)
- Headless mode in CI (faster than headed)
- Reuse browser contexts where possible
- Screenshot only on failure (save disk space)
- Optimize test world creation (reusable fixtures)

**Future enhancements:**
- Visual regression testing (compare screenshots to baselines)
- Performance profiling in tests (FPS, memory)
- Network simulation (latency, packet loss)
- Mobile device emulation
- Accessibility testing (screen readers, keyboard nav)

**Test organization:**
```
tests/
├── combat/           # Combat system tests
├── inventory/        # Inventory and trading
├── quests/          # Quest progression
├── multiplayer/     # Player-player interaction
├── npcs/            # AI agent behaviors
├── rendering/       # Visual tests
└── fixtures/        # Reusable test data
```

**Commit evidence:**
Multiple commits show fixes and improvements validated via tests:
- "fix vrm animations" - Animation tests caught regression
- "fix: Resources now spawn in same locations for all players" - Multiplayer test verified synchronization
- "fix: quest NPCs can be attackable and drop loot" - Integration test validated new behavior

**Cost-benefit:**
Yes, Playwright tests are slower than unit tests. But:
- **Unit test**: 10ms, 90% confidence (mocks)
- **Playwright test**: 5s, 99.9% confidence (real)

100x slower, 10x more confidence = worth it for game systems.

**Enforcement:**
Per compliance checklist in CLAUDE.md:
```
## Pre-Deployment Checklist
- [ ] All tests pass (no failing tests allowed)
- [ ] All features have comprehensive tests
```

No merging code without passing tests. No exceptions.
