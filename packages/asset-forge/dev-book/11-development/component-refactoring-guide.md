# Component Refactoring Guide

## Overview

This guide documents the refactoring patterns used to split large, monolithic React components into smaller, more maintainable pieces.

## Refactoring Principles

### 1. Single Responsibility Principle
Each component and hook should have one clear responsibility:
- **Components** handle UI rendering and user interaction
- **Hooks** handle business logic and state management
- **Services** handle data fetching and external APIs

### 2. Extract Hooks First
Before splitting UI components, extract business logic into custom hooks:
```typescript
// Before: All logic in component
function LargeComponent() {
  const [state, setState] = useState()
  // 100+ lines of logic
  return <UI />
}

// After: Logic in custom hook
function useLargeComponentLogic() {
  const [state, setState] = useState()
  // 100+ lines of logic
  return { state, actions }
}

function LargeComponent() {
  const { state, actions } = useLargeComponentLogic()
  return <UI />
}
```

### 3. Component Composition
Break down large components into smaller sub-components:
```typescript
// Before: Single large component
function LargeComponent() {
  return (
    <div>
      {/* 500+ lines of JSX */}
    </div>
  )
}

// After: Composed of smaller components
function LargeComponent() {
  return (
    <div>
      <Header />
      <MainContent />
      <Sidebar />
      <Footer />
    </div>
  )
}
```

### 4. Context for Shared State
Use React Context when multiple components need access to the same state:
```typescript
// Create context for shared state
const ThreeViewerContext = createContext<ThreeViewerState | null>(null)

function ThreeViewerProvider({ children }) {
  const state = useThreeViewerState()
  return (
    <ThreeViewerContext.Provider value={state}>
      {children}
    </ThreeViewerContext.Provider>
  )
}

// Consume context in sub-components
function SubComponent() {
  const { state, actions } = useContext(ThreeViewerContext)
  return <div>{/* Use state and actions */}</div>
}
```

## Refactoring Process

### Step 1: Analyze the Component
Identify:
- State variables and their relationships
- Business logic functions
- UI sections that can be extracted
- Props and their usage
- Side effects (useEffect hooks)

### Step 2: Extract Custom Hooks
Create hooks for each major concern:
- `useThreeRenderer` - Rendering setup
- `useThreeCamera` - Camera controls
- `useThreeAnimation` - Animation management
- `useThreeExport` - Export functionality
- `useThreeModel` - Model loading

### Step 3: Create Sub-Components
Break UI into logical sections:
- `ThreeViewerControls` - Control buttons
- `ThreeViewerStats` - Statistics display
- `AnimationControls` - Animation UI

### Step 4: Refactor Main Component
Update the main component to use extracted pieces:
```typescript
function ThreeViewer(props: ThreeViewerProps, ref) {
  // Use custom hooks
  const renderer = useThreeRenderer(containerRef, config)
  const camera = useThreeCamera(renderer.refs.camera, renderer.refs.renderer)
  const animation = useThreeAnimation(model)
  const exporter = useThreeExport(scene, camera, renderer)

  // Render sub-components
  return (
    <div ref={containerRef}>
      <ThreeViewerControls {...controlProps} />
      <ThreeViewerStats {...statsProps} />
    </div>
  )
}
```

### Step 5: Test Thoroughly
- Verify TypeScript compilation
- Run existing tests
- Test all user interactions
- Ensure no behavioral changes

## File Organization

```
src/
├── components/
│   └── shared/
│       └── ThreeViewer/
│           ├── index.ts
│           ├── ThreeViewerControls.tsx
│           ├── ThreeViewerStats.tsx
│           └── AnimationControls.tsx
├── hooks/
│   └── three/
│       ├── index.ts
│       ├── useThreeRenderer.ts
│       ├── useThreeCamera.ts
│       ├── useThreeAnimation.ts
│       ├── useThreeExport.ts
│       └── useThreeModel.ts
└── services/
    └── three/
        ├── ModelLoader.ts
        └── ExportService.ts
```

## Success Criteria

A successful refactoring should achieve:
- ✅ No component exceeds 500 lines
- ✅ No component has more than 5 useEffect hooks
- ✅ Each component has a single, clear responsibility
- ✅ TypeScript compilation succeeds with no errors
- ✅ All tests pass
- ✅ No behavioral changes
- ✅ Improved maintainability and testability

## Common Patterns

### Pattern 1: State Management Hook
```typescript
export const useComponentState = () => {
  const [state1, setState1] = useState()
  const [state2, setState2] = useState()

  const action1 = useCallback(() => {
    // Logic here
  }, [dependencies])

  return {
    state: { state1, state2 },
    actions: { action1, setState1, setState2 }
  }
}
```

### Pattern 2: Refs Management Hook
```typescript
export const useComponentRefs = () => {
  const ref1 = useRef(null)
  const ref2 = useRef(null)

  return {
    refs: { ref1, ref2 },
    actions: { /* ref operations */ }
  }
}
```

### Pattern 3: Side Effects Hook
```typescript
export const useComponentEffects = (dependencies) => {
  useEffect(() => {
    // Setup
    return () => {
      // Cleanup
    }
  }, [dependencies])
}
```

## Anti-Patterns to Avoid

### ❌ Don't: Create Circular Dependencies
```typescript
// Bad: Component A imports Component B, Component B imports Component A
import { ComponentB } from './ComponentB'
```

### ❌ Don't: Extract Too Much
```typescript
// Bad: Over-extraction makes code harder to follow
const useButtonClickHandler = () => { /* 3 lines */ }
const useButtonStyleCalculator = () => { /* 2 lines */ }
```

### ❌ Don't: Break Existing Behavior
Always test thoroughly after refactoring to ensure no functionality is lost.

### ❌ Don't: Mix Concerns
```typescript
// Bad: Hook handles both rendering AND data fetching
export const useThreeRendererAndData = () => {
  // Rendering logic
  // Data fetching logic
}
```

## Best Practices

### ✅ Do: Keep Hooks Focused
Each hook should handle one aspect of the component's functionality.

### ✅ Do: Document Hook APIs
```typescript
/**
 * useThreeRenderer Hook
 * Manages WebGL renderer, scene, camera, and lighting setup
 *
 * @param containerRef - Ref to the container element
 * @param config - Renderer configuration options
 * @returns Renderer refs and action methods
 */
export const useThreeRenderer = (containerRef, config) => {
  // Implementation
}
```

### ✅ Do: Use TypeScript Interfaces
```typescript
export interface ThreeRendererConfig {
  lightMode?: boolean
  isLightBackground?: boolean
  showGroundPlane?: boolean
}
```

### ✅ Do: Export Types
```typescript
export { useThreeRenderer } from './useThreeRenderer'
export type { ThreeRendererConfig } from './useThreeRenderer'
```

## Resources

- [React Hooks Documentation](https://react.dev/reference/react)
- [Component Composition](https://react.dev/learn/passing-props-to-a-component)
- [Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)
- [TypeScript with React](https://react.dev/learn/typescript)

## Next Steps

After completing the refactoring:
1. Update tests to cover new hooks and components
2. Update documentation for changed APIs
3. Review and merge pull request
4. Monitor for any issues in production
5. Apply learned patterns to other large components
