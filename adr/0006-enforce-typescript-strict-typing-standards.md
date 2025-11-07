# 0006. Enforce TypeScript Strict Typing Standards

Date: 2025-11-06

## Status

Accepted

## Context

Hyperscape is a complex TypeScript codebase with multiple packages, shared types, 3D graphics integration (Three.js), database ORM (Drizzle), and AI agents (ElizaOS). Type safety is critical for preventing runtime errors in multiplayer gameplay, ensuring correct data flow, and maintaining developer productivity.

### Current Situation
- Large TypeScript monorepo with 6+ packages
- Complex type relationships:
  - Game entities (Player, NPC, Item) with ECS architecture
  - Three.js scene objects and 3D transforms
  - Database schemas and ORM types
  - WebSocket message types for multiplayer
  - AI agent action and provider types
- Multiple developers contributing code
- Need for strong type guarantees to prevent runtime errors

### Pain Points with Loose Typing
- `any` types bypass type checking, leading to runtime errors
- `unknown` types require excessive type guards
- Property existence checks (`'property' in object`) indicate weak typing
- Optional chaining for type narrowing creates verbose code
- Polymorphic objects checked at runtime instead of compile time
- Type errors discovered late in development or in production

### Requirements
- **No `any` types** - All values must have explicit types
- **Minimal type assertions** - Trust TypeScript inference where possible
- **Shared types** - Centralized type definitions across packages
- **Database type safety** - ORM schema types enforced
- **Message type safety** - WebSocket messages fully typed
- **Class-based types** - Prefer classes over interfaces for complex types
- **Explicit return types** - Public methods must declare return types

### Drivers
- **Runtime safety** - Prevent type-related bugs in multiplayer gameplay
- **Developer confidence** - Refactor safely with compiler guarantees
- **Code maintainability** - Clear contracts between modules
- **Documentation** - Types serve as inline documentation
- **IDE support** - Better autocomplete and error detection

## Decision

We will **enforce strict TypeScript typing standards** across the entire Hyperscape codebase, prohibiting `any` types and requiring explicit, strong typing for all code.

### Key Points
- **NO `any` or `unknown` types** - Forbidden in production code
- **Prefer classes over interfaces** - Classes for complex entity types
- **Share types from types/core.ts** - Centralized type definitions
- **Avoid property existence checks** - No `'property' in object` patterns
- **Make strong type assumptions** - Trust context-based types
- **Use non-null assertions** - `value!` when type is guaranteed
- **Define return types** - Explicit return types on public methods
- **Use discriminated unions** - For variant types
- **Import types explicitly** - `import type { TypeName }`

### Implementation Details
```typescript
// ✅ CORRECT: Strong typing
class PlayerEntity {
  id: string;
  position: Vector3;
  inventory: InventoryItem[];

  // Explicit return type
  getItemById(id: string): InventoryItem | undefined {
    return this.inventory.find(item => item.id === id);
  }
}

// ❌ FORBIDDEN: Using 'any'
function processData(data: any) { // NO!
  return data.someProperty;
}

// ✅ CORRECT: Generic with constraint
function processData<T extends { id: string }>(data: T) {
  return data.id;
}

// ❌ FORBIDDEN: Property existence check
if ('position' in entity) { // NO!
  entity.position.x = 0;
}

// ✅ CORRECT: Type assertion based on context
const player = entity as PlayerEntity;
player.position.x = 0;

// ✅ CORRECT: Non-null assertion when guaranteed
const item = inventory.find(i => i.id === id)!; // ! when we know it exists
```

**Shared types pattern:**
```typescript
// packages/shared/src/types/core.ts
export class Vector3 {
  x: number;
  y: number;
  z: number;
}

export class PlayerEntity {
  id: string;
  position: Vector3;
  health: number;
}

// Other packages import shared types
import type { PlayerEntity, Vector3 } from '@hyperscape/shared/types/core';
```

## Alternatives Considered

### Alternative 1: Allow `any` for Rapid Development
**Pros:**
- Faster initial development
- Skip complex type definitions
- Easier to integrate third-party libraries
- Less TypeScript compiler errors

**Cons:**
- **Runtime errors** - Type bugs discovered in production
- Technical debt accumulates quickly
- Refactoring becomes dangerous
- No IDE autocomplete or type checking
- Defeats purpose of using TypeScript

**Reason for rejection:** `any` is a short-term convenience with long-term costs. In a multiplayer game, runtime type errors can corrupt game state, create exploits, or crash servers. The cost of fixing production bugs far exceeds time spent on proper typing.

### Alternative 2: Use `unknown` Everywhere
**Pros:**
- Safer than `any`
- Forces type guards
- Compiler enforces checks

**Cons:**
- Excessive boilerplate
- Type guards clutter code
- Doesn't leverage TypeScript inference
- Makes code harder to read
- Still indicates weak typing

**Reason for rejection:** `unknown` is better than `any` but still represents failure to properly type data. Hyperscape controls most data sources (database, WebSockets, game state) and can define proper types. `unknown` should only be used for truly dynamic external data (user uploads, external APIs).

### Alternative 3: Loose TypeScript Configuration
**Pros:**
- More permissive compiler
- Fewer compiler errors
- Easier to integrate JavaScript libraries

**Cons:**
- Weak type checking
- Many errors slip through
- False sense of type safety
- Difficult to enforce standards

**Reason for rejection:** Loose TypeScript config undermines the value of TypeScript. Strict configuration catches bugs at compile time. With proper types, strict mode is beneficial, not burdensome.

### Alternative 4: JavaScript (No Types)
**Pros:**
- No type definitions needed
- Maximum flexibility
- Faster prototyping
- No compiler

**Cons:**
- **Zero type safety** - All errors at runtime
- No IDE autocomplete
- Difficult to refactor safely
- Hard to understand code contracts
- Poor for large codebases

**Reason for rejection:** JavaScript unsuitable for complex, multi-developer codebase. TypeScript's type safety is essential for Hyperscape's scale and complexity.

### Alternative 5: Mix of Strict and Permissive
**Pros:**
- Strict for critical code
- Permissive for experiments
- Gradual migration to strict

**Cons:**
- Inconsistent standards
- Confusion about what's allowed where
- Type boundary problems
- Difficult to enforce
- Permissive code spreads

**Reason for rejection:** Mixed standards create confusion and erosion. Once permissive patterns exist, developers copy them. All-or-nothing approach to strict typing prevents degradation.

## Consequences

### Positive
- **Compile-time error detection** - Catch bugs before deployment
- **Safe refactoring** - Rename, restructure with compiler confidence
- **Better IDE support** - Accurate autocomplete, inline errors
- **Self-documenting code** - Types clarify intent and contracts
- **Easier onboarding** - New developers understand code via types
- **Database safety** - Drizzle ORM types prevent schema mismatch
- **Message safety** - WebSocket messages can't have wrong structure
- **Less runtime validation** - Type system guarantees reduce checks

### Negative
- **Initial development slower** - Must define types upfront
- **Learning curve** - Team must master TypeScript advanced features
- **Longer compile times** - More type checking requires more CPU
- **Refactoring complexity** - Type changes cascade through codebase
- **Third-party integration** - Untyped libraries need type definitions

### Neutral
- Type definitions in separate files (types.ts, schema.ts)
- Explicit import statements for types
- Compiler errors must be fixed (no warnings allowed in CI)
- Regular TypeScript version updates for better inference

### Risks
- **Risk 1: Development velocity slowdown**
  - Mitigation: Invest in learning TypeScript patterns
  - Benefit: Slower upfront, faster long-term (fewer bugs)
  - Status: Team proficient with strict typing

- **Risk 2: Type definition maintenance burden**
  - Mitigation: Centralize shared types in packages/shared
  - Automation: Generate types from database schema (Drizzle)
  - Assessment: Manageable with proper organization

- **Risk 3: Over-engineering types**
  - Mitigation: Balance between safety and simplicity
  - Guideline: Use inference where safe, explicit where needed
  - Review: Code review catches overly complex types

- **Risk 4: Conflicts with external libraries**
  - Mitigation: Create type definitions or use @types/* packages
  - Workaround: Isolated wrapper modules for untyped libs
  - Status: Most dependencies have good TypeScript support

## Implementation

### Action Items
- [x] Establish coding standards in CLAUDE.md
- [x] Create `no-any-quick-reference` agent requestable rule
- [x] Define shared types in packages/shared/src/types/
- [x] Configure TypeScript strict mode
- [x] Use Drizzle ORM for database type generation
- [x] Enforce via ESLint rules (@typescript-eslint/no-explicit-any)
- [ ] Create type definition templates for common patterns
- [ ] Document type standards for team
- [ ] Add pre-commit hooks to reject `any` types
- [ ] Conduct TypeScript training sessions

### Timeline
- **2025**: Strict typing standards established
- **Oct 20, 2025**: Major TypeScript refactoring (commit `7fd0b306`)
  - "Refactor TypeScript architecture: fix World typing, centralize client types, fix shared exports, eliminate type errors across all UI components"
- **Nov 6, 2025**: ADR documented

### Success Metrics
- ✅ Zero `any` types in production code (Target: 0) - **ONGOING**
- ✅ Compiler errors fixed before merge - **ENFORCED**
- ✅ Type-related runtime errors: < 1% of bugs - **MONITORING**
- ✅ Centralized shared types used across packages - **ACHIEVED**
- [ ] ESLint `any` violations: 0 (Currently: tracked via lint warnings) - **IN PROGRESS**

## References

- [TypeScript Handbook - Strict Mode](https://www.typescriptlang.org/docs/handbook/2/basic-types.html#strictness)
- [TypeScript Deep Dive - Never Use Any](https://basarat.gitbook.io/typescript/type-system/never#never-use-any)
- CLAUDE.md coding-standards.mdc - TypeScript Strong Typing Rules
- CLAUDE.md no-any-quick-reference - Quick reference for avoiding any/unknown
- packages/shared/src/types/ - Shared type definitions
- Git commit `7fd0b306` - TypeScript architecture refactoring

## Notes

**From CLAUDE.md coding standards:**

> ## Core Principles
> - NO `any` or `unknown` types
> - Prefer classes over interfaces for type definitions
> - Share types across modules from types/core.ts
> - Avoid property checks on polymorphic objects
> - Make strong type assumptions based on context
>
> ## Required Patterns
> - Use non-null assertions: `value!`
> - Define return types explicitly on public methods
> - Use discriminated unions for variant types
> - Import types with `import type { TypeName }`
>
> ## Forbidden Patterns
> - `as any` - NEVER use this
> - Property existence checks like `'property' in object`
> - Optional chaining for type narrowing

**Major refactoring evidence:**
Commit `7fd0b306` (Oct 20, 2025): "Refactor TypeScript architecture: fix World typing, centralize client types, fix shared exports, eliminate type errors across all UI components"

This shows significant investment in proper TypeScript architecture with centralized types and eliminated errors.

**ESLint configuration:**
```javascript
// eslint.config.js rules
'@typescript-eslint/no-explicit-any': 'error',
'@typescript-eslint/no-unsafe-assignment': 'warn',
'@typescript-eslint/no-unsafe-member-access': 'warn',
```

Current max warnings: 22,100 (includes legacy code), actively being reduced.

**Class vs Interface decision:**
Classes preferred for entity types because:
- Combine type and implementation
- Support inheritance for shared behavior
- Work well with ECS architecture
- Easier to extend and refactor

Interfaces still used for:
- Pure data contracts
- API response types
- Configuration objects

**Shared types organization:**
```
packages/shared/src/
├── types/
│   ├── core.ts           # Core game types (Entity, Player, NPC)
│   ├── items.ts          # Item and inventory types
│   ├── skills.ts         # Skill and progression types
│   ├── messages.ts       # WebSocket message types
│   └── index.ts          # Re-exports
```

**Type generation from database:**
Drizzle ORM automatically generates TypeScript types from schema:
```typescript
// Database schema
export const players = pgTable('players', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  level: integer('level').notNull().default(1),
});

// Auto-generated type
export type Player = InferSelectModel<typeof players>;
```

**Non-null assertion guidelines:**
Use `!` operator only when:
1. Type system can't infer non-null but you have contextual guarantee
2. Immediately after existence check in same scope
3. Data structure guarantees (e.g., array.find in Map that must exist)

Avoid `!` when:
- Could be null/undefined in any scenario
- External data source
- Uncertain about guarantee

**Future improvements:**
- Reduce ESLint warnings from 22,100 to < 1,000
- Add stricter compiler options (noUncheckedIndexedAccess)
- Generate API types from OpenAPI schema
- Create type-safe event system for game events
- Implement branded types for IDs (EntityId, ItemId)
