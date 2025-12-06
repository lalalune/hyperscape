# Interaction System Production Quality Review

**Date**: December 2024
**Overall Rating**: 8/10

## Architecture Overview

The interaction system uses a hybrid event/frame-based detection pattern (OSRS-style):
- `InteractionRouter` orchestrates handlers via composition
- `ActionQueueService` manages frame-based action execution
- `RaycastService` handles entity detection
- `VisualFeedbackService` provides RS3-style visual indicators
- Specialized handlers for each entity type (NPC, Item, Resource, etc.)

## Ratings by Category

### Security: 7/10

**Issues Identified:**

1. **CustomEvent Spoofing Risk**
   - Location: `InteractionRouter.ts` event listeners
   - Risk: Malicious browser code could dispatch fake `hyperscape:movement:stopped` events
   - Mitigation: Server validates all actions (server-authoritative model)
   - Recommendation: Add event origin validation or use internal pub/sub

2. **No Client-Side Input Validation**
   - Location: `ActionQueueService.ts` - `changes.p` array not validated
   - Risk: Malformed position data could cause NaN propagation
   - Mitigation: Server validates all incoming data
   - Recommendation: Add defensive checks for array bounds and numeric values

### Error Handling: 6/10

**Issues Identified:**

1. **No try/catch on onExecute Callbacks**
   - Location: `ActionQueueService.ts:149` - `action.onExecute()`
   - Risk: Handler exception kills entire action queue processing
   - Recommendation: Wrap in try/catch with error logging

   ```typescript
   // Current (risky)
   action.onExecute();

   // Recommended
   try {
     action.onExecute();
   } catch (error) {
     console.error(`[ActionQueue] Handler error for ${action.actionId}:`, error);
   }
   ```

2. **Silent Failures Hide Bugs**
   - Location: Multiple handlers return silently on missing entities
   - Risk: Legitimate bugs masked as expected race conditions
   - Recommendation: Add debug-mode logging toggle

   ```typescript
   // Current
   if (!entity) return;

   // Recommended
   if (!entity) {
     if (DEBUG_INTERACTIONS) {
       console.debug(`[ItemHandler] Entity ${entityId} not found (expected during spam-click)`);
     }
     return;
   }
   ```

### Code Quality: 8/10

**Issues Identified:**

1. **Handlers Map Not Cleared in destroy()**
   - Location: `InteractionRouter.ts:destroy()`
   - Risk: Minor memory leak if router is recreated
   - Recommendation: Add `this.handlers.clear()` in destroy

2. **Magic Strings for Network Messages**
   - Location: Various handlers use string literals like `"pickupItem"`, `"attack"`
   - Risk: Typos cause silent failures
   - Recommendation: Create constants file for message types

   ```typescript
   // Recommended: packages/shared/src/network/MessageTypes.ts
   export const MESSAGE_TYPES = {
     PICKUP_ITEM: "pickupItem",
     ATTACK: "attack",
     GATHER_RESOURCE: "gatherResource",
     // ...
   } as const;
   ```

3. **Inconsistent Error Logging**
   - Some paths log errors, others fail silently
   - Recommendation: Establish consistent logging policy

## Strengths

- Clean separation of concerns (handlers, services, router)
- Well-documented constants with clear explanations
- Server-authoritative model protects against client manipulation
- Proper debouncing prevents spam-click abuse
- Double entity existence check (queue time + execute time) handles race conditions

## Recommendations Priority

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| High | Add try/catch to onExecute | Low | Prevents queue crashes |
| Medium | Add debug logging toggle | Low | Easier debugging |
| Medium | Clear handlers in destroy() | Trivial | Memory safety |
| Low | Message type constants | Medium | Type safety |
| Low | Event origin validation | Medium | Defense in depth |

## Notes

- Server-side validation is the primary security layer
- Client-side issues are mitigated by server-authoritative architecture
- Silent failures for race conditions are intentional but should be toggleable for debugging
