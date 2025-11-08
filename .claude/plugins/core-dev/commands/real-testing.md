---
description: Real gameplay testing with Playwright (ADR-0007)
---

# Real Gameplay Testing

Following **ADR-0007**: Real gameplay testing with Playwright, NO mocks or test framework abstractions.

## Testing Methods

1. **Three.js Testing** - Inspect scene hierarchy and object positions
2. **Visual Testing** - Screenshot analysis with colored cube proxies
3. **System Integration** - ECS systems and data introspection
4. **LLM Verification** - GPT-4o for complex visual analysis

## Visual Proxy Colors

- 🔴 Red - Players
- 🟢 Green - Goblins
- 🔵 Blue - Items
- 🟡 Yellow - Trees
- 🟣 Purple - Banks
- 🟨 Beige - Stores

## Requirements

- Every feature MUST have tests
- All tests MUST pass before moving on
- Use real gameplay, real objects, real data
- Save error logs to /logs folder
- Build mini-worlds for each test scenario

What feature do you want to test? I'll:
1. Build a mini-world for testing
2. Create Playwright test with real browser
3. Verify both data correctness and visual rendering
4. Ensure all tests pass before completing
