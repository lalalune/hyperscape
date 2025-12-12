/**
 * Security Smoke Test
 *
 * Quick verification that the critical security fixes are in place.
 * Run with: npx ts-node packages/server/src/tests/security-smoke-test.ts
 */

import {
  chebyshevDistance,
  INTERACTION_DISTANCE,
  SessionType,
  INPUT_LIMITS,
} from "@hyperscape/shared";

// Import validation functions
import {
  isValidItemId,
  isValidQuantity,
  wouldOverflow,
  isValidSlotIndex,
} from "../systems/ServerNetwork/services/InputValidation";

import { IntervalRateLimiter } from "../systems/ServerNetwork/services/IntervalRateLimiter";

console.log("=== Security Smoke Test ===\n");

let passed = 0;
let failed = 0;

function test(name: string, condition: boolean) {
  if (condition) {
    console.log(`✅ ${name}`);
    passed++;
  } else {
    console.log(`❌ ${name}`);
    failed++;
  }
}

// Distance calculation tests
console.log("--- Distance Calculation (Chebyshev) ---");
test(
  "Horizontal distance",
  chebyshevDistance({ x: 0, z: 0 }, { x: 5, z: 0 }) === 5,
);
test(
  "Vertical distance",
  chebyshevDistance({ x: 0, z: 0 }, { x: 0, z: 5 }) === 5,
);
test(
  "Diagonal distance (max of axes)",
  chebyshevDistance({ x: 0, z: 0 }, { x: 3, z: 5 }) === 5,
);
test(
  "Same position",
  chebyshevDistance({ x: 10, z: 10 }, { x: 10, z: 10 }) === 0,
);

// Interaction distances defined
console.log("\n--- Interaction Distances ---");
test("Store distance defined", INTERACTION_DISTANCE[SessionType.STORE] === 5);
test("Bank distance defined", INTERACTION_DISTANCE[SessionType.BANK] === 5);
test(
  "Dialogue distance defined",
  INTERACTION_DISTANCE[SessionType.DIALOGUE] === 3,
);

// Input validation tests
console.log("\n--- Input Validation ---");
test("Valid item ID accepted", isValidItemId("bronze_sword"));
test("Empty item ID rejected", !isValidItemId(""));
test("Null item ID rejected", !isValidItemId(null));
test("Too long item ID rejected", !isValidItemId("a".repeat(65)));

test("Valid quantity accepted", isValidQuantity(100));
test("Zero quantity rejected", !isValidQuantity(0));
test("Negative quantity rejected", !isValidQuantity(-1));
test("Float quantity rejected", !isValidQuantity(1.5));
test("Max int quantity accepted", isValidQuantity(INPUT_LIMITS.MAX_QUANTITY));
test(
  "Overflow quantity rejected",
  !isValidQuantity(INPUT_LIMITS.MAX_QUANTITY + 1),
);

test(
  "Overflow detection works",
  wouldOverflow(INPUT_LIMITS.MAX_QUANTITY - 5, 10),
);
test("Safe addition allowed", !wouldOverflow(100, 100));

test(
  "Valid slot index accepted",
  isValidSlotIndex(0, INPUT_LIMITS.MAX_INVENTORY_SLOTS),
);
test(
  "Negative slot rejected",
  !isValidSlotIndex(-1, INPUT_LIMITS.MAX_INVENTORY_SLOTS),
);
test(
  "Out of bounds slot rejected",
  !isValidSlotIndex(28, INPUT_LIMITS.MAX_INVENTORY_SLOTS),
);

// Rate limiting tests
console.log("\n--- Rate Limiting ---");
const rateLimiter = new IntervalRateLimiter(50);
test("First operation allowed", rateLimiter.tryOperation("player1"));
test(
  "Immediate second operation blocked",
  !rateLimiter.tryOperation("player1"),
);
test("Different player allowed", rateLimiter.tryOperation("player2"));

// Summary
console.log("\n=== Results ===");
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total: ${passed + failed}`);

if (failed > 0) {
  console.log("\n⚠️  Some tests failed! Review the implementation.");
  process.exit(1);
} else {
  console.log("\n✅ All security smoke tests passed!");
  process.exit(0);
}
