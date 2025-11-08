# Coding Standards

## Research-First Protocol (MOST IMPORTANT)

**Code writing is your LAST priority - Exhaust research first**

### The Workflow (NEVER skip):
1. **RESEARCH with deepwiki** - Claude's knowledge is outdated, always use deepwiki for external libraries, frameworks, APIs
2. **GATHER CONTEXT** - Read files, Grep patterns, Glob to understand existing code
3. **REUSE existing code** - Triple check if this already exists in the codebase
4. **ASK USER for verification** - Never assume, always verify when uncertain
5. **KEEP IT SIMPLE** - No over-engineering, simplest solution wins
6. **WRITE CODE** - Only after completing steps 1-5

### Core Principles
- **Reuse > Create** - Prefer editing existing files over creating new ones
- **Simple > Complex** - Avoid over-engineering and abstractions
- **Ask > Assume** - When ANY uncertainty exists, ask the user
- **Research > Memory** - Use deepwiki for current information, don't trust outdated knowledge
- **Context > Guessing** - Read all related files before making changes

## TypeScript Strong Typing
- **NO `any` or `unknown` types** - Always use specific types
- Use non-null assertions `value!` when you're certain value exists
- Define return types explicitly on all public methods
- Import types with `import type { TypeName }` for type-only imports

## Code Style
- Use 2-space indentation for TypeScript/JavaScript
- Use descriptive variable names (no single letters except loop counters)
- Prefer `const` over `let`, never use `var`
- Use template literals for string concatenation

## File Organization
- One component/class per file
- Co-locate related files (component + test + styles)
- Use barrel exports (`index.ts`) sparingly
- Avoid circular dependencies

## Error Handling
- Always use try-catch for async operations
- Provide meaningful error messages
- Log errors with context (timestamp, user ID, action)
- Never swallow errors silently
