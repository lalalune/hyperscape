# ElizaOS Frontend Standards Memory

Complete reference for ElizaOS frontend development standards and patterns.

## Core Standards

### TypeScript Standards

**NO `any` or `unknown` Types**:
- ✅ Use specific types or union types
- ✅ Import types from `@elizaos/core` (UUID, IAgentRuntime, Memory, State, Agent)
- ✅ Use `import type` for type-only imports
- ❌ NEVER use `any` or `unknown`
- ❌ NEVER use `as any` or `as unknown`

**Type Imports**:
```typescript
import type { UUID, IAgentRuntime, Memory, State, Agent } from '@elizaos/core';
```

**Type Definitions**:
- ✅ Use interfaces for object shapes
- ✅ Use type aliases for unions
- ✅ Use classes for complex types when needed
- ✅ Share types across modules

### React Component Standards

**Component Structure**:
```typescript
import React from 'react';
import type { UUID } from '@elizaos/core';

interface ComponentProps {
  agentId: UUID;
  // ... other props
}

export function Component({ agentId }: ComponentProps) {
  // Component logic
  return <div>...</div>;
}
```

**Required Patterns**:
- ✅ Type all props with interfaces
- ✅ Use proper TypeScript types (no `any`)
- ✅ Handle loading states
- ✅ Handle error states
- ✅ Use proper error messages
- ✅ Export components as named exports

**Forbidden Patterns**:
- ❌ `any` types in props or state
- ❌ `console.log` in production code
- ❌ Unhandled errors
- ❌ Missing loading states
- ❌ Missing error states

### Hook Standards

**Hook Structure**:
```typescript
import { useMemo } from 'react';
import type { UUID } from '@elizaos/core';

export function useCustomHook(agentId: UUID | undefined) {
  const result = useMemo(() => {
    // Hook logic
    return data;
  }, [dependencies]);

  return {
    data: result,
    isLoading: false,
    error: null,
  };
}
```

**Required Patterns**:
- ✅ Type all parameters
- ✅ Return typed results
- ✅ Include loading state
- ✅ Include error state
- ✅ Use proper TypeScript types
- ✅ Handle undefined/null cases

**Forbidden Patterns**:
- ❌ `any` types
- ❌ Missing error handling
- ❌ Missing loading states
- ❌ Unhandled edge cases

### Error Handling Standards

**Error Handling Pattern**:
```typescript
if (error) {
  return (
    <Alert variant="destructive">
      <AlertDescription>
        {error instanceof Error ? error.message : 'Unknown error'}
      </AlertDescription>
    </Alert>
  );
}
```

**Required Patterns**:
- ✅ Check for errors
- ✅ Display user-friendly error messages
- ✅ Use `instanceof Error` checks
- ✅ Provide fallback messages
- ✅ Log errors appropriately

**Forbidden Patterns**:
- ❌ Exposing internal error details
- ❌ Skipping error handling
- ❌ Using `any` for error types

### Loading State Standards

**Loading State Pattern**:
```typescript
if (isLoading) {
  return (
    <div>
      <Skeleton />
      {/* Loading UI */}
    </div>
  );
}
```

**Required Patterns**:
- ✅ Show loading indicators
- ✅ Use skeleton loaders
- ✅ Provide loading feedback
- ✅ Handle loading states gracefully

### WebSocket Standards

**WebSocket Hook Pattern**:
```typescript
import { useEffect, useRef, useState } from 'react';
import type { UUID } from '@elizaos/core';

export function useWebSocket(options: {
  agentId: UUID | undefined;
  url: string;
  autoReconnect?: boolean;
}) {
  const wsRef = useRef<WebSocket | null>(null);
  const [state, setState] = useState<StateType>({
    status: 'disconnected',
    data: null,
    error: null,
  });

  useEffect(() => {
    if (!options.agentId) return;

    const ws = new WebSocket(`${options.url}?agentId=${options.agentId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setState(prev => ({ ...prev, status: 'connected' }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        // Handle message
      } catch (error) {
        setState(prev => ({ ...prev, error: 'Failed to parse message' }));
      }
    };

    ws.onerror = (error) => {
      setState(prev => ({ ...prev, status: 'error', error: 'Connection error' }));
    };

    ws.onclose = () => {
      setState(prev => ({ ...prev, status: 'disconnected' }));
      // Reconnect logic
    };

    return () => {
      ws.close();
    };
  }, [options.agentId, options.url]);

  return state;
}
```

**Required Patterns**:
- ✅ Type WebSocket state
- ✅ Handle connection errors
- ✅ Handle message parsing errors
- ✅ Implement reconnection logic
- ✅ Clean up on unmount
- ✅ Use proper error messages

### Import Standards

**Import Order**:
1. React imports
2. Third-party imports
3. ElizaOS type imports (`@elizaos/core`)
4. Local type imports
5. Component imports
6. Hook imports
7. Utility imports
8. Style imports

**Example**:
```typescript
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import type { UUID } from '@elizaos/core';
import type { PlayerStats } from '@/types/hyperscape';
import { usePlayerStats } from '@/hooks/hyperscape/useHyperscapeAgent';
```

### Component Export Standards

**Export Pattern**:
```typescript
// Named export (preferred)
export function ComponentName() { }

// Default export (if needed)
export default ComponentName;
```

**Index File Pattern**:
```typescript
export { ComponentName } from './ComponentName';
export type { ComponentProps } from './ComponentName';
```

## Forger Frontend Compliance

### ✅ Compliant Patterns Found

1. **TypeScript Types**:
   - ✅ Uses `import type { UUID } from '@elizaos/core'`
   - ✅ No `any` types found in Hyperscape components
   - ✅ Proper type definitions

2. **Error Handling**:
   - ✅ `error instanceof Error` checks
   - ✅ User-friendly error messages
   - ✅ Proper error display components

3. **Loading States**:
   - ✅ Skeleton loaders
   - ✅ Loading indicators
   - ✅ Proper loading UI

4. **Component Structure**:
   - ✅ Typed props interfaces
   - ✅ Named exports
   - ✅ Proper component organization

5. **Hooks**:
   - ✅ Typed parameters
   - ✅ Typed return values
   - ✅ Loading and error states
   - ✅ Proper cleanup

6. **WebSocket Integration**:
   - ✅ Typed WebSocket state
   - ✅ Error handling
   - ✅ Reconnection logic
   - ✅ Proper cleanup

### Standards Checklist

Before implementing frontend components, verify:

- [ ] Uses `import type` for type-only imports
- [ ] Imports types from `@elizaos/core` (UUID, etc.)
- [ ] No `any` or `unknown` types
- [ ] Proper error handling with `instanceof Error`
- [ ] Loading states implemented
- [ ] Error states implemented
- [ ] Typed props interfaces
- [ ] Named exports
- [ ] Proper WebSocket error handling
- [ ] Cleanup in useEffect hooks

## Reference Files

### Forger Frontend (Compliant)
- `/Users/home/eliza/forger/src/frontend/components/hyperscape/` - All components follow standards
- `/Users/home/eliza/forger/src/frontend/hooks/hyperscape/` - All hooks follow standards
- `/Users/home/eliza/forger/src/frontend/types/hyperscape/` - All types properly defined

### ElizaOS Core Types
- `@elizaos/core` - UUID, IAgentRuntime, Memory, State, Agent, etc.

## Best Practices

1. **Always import types from `@elizaos/core`**
2. **Never use `any` or `unknown`**
3. **Always handle errors gracefully**
4. **Always show loading states**
5. **Always type WebSocket messages**
6. **Always clean up resources**
7. **Always use `import type` for type-only imports**

