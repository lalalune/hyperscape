# Refactoring Patterns

## Overview

This document describes common refactoring patterns used in the Asset Forge codebase to maintain clean, maintainable code.

## Pattern 1: Extract Custom Hook

### When to Use
- Component has >10 state variables
- Complex business logic mixed with UI
- Logic needs to be reused across components

### Implementation
```typescript
// Before
function ComplexComponent() {
  const [state1, setState1] = useState()
  const [state2, setState2] = useState()
  // ... 10 more state variables

  useEffect(() => {
    // Complex logic
  }, [dependencies])

  const handleAction = () => {
    // Complex business logic
  }

  return <div>{/* UI */}</div>
}

// After
function useComplexLogic() {
  const [state1, setState1] = useState()
  const [state2, setState2] = useState()

  useEffect(() => {
    // Complex logic
  }, [dependencies])

  const handleAction = useCallback(() => {
    // Complex business logic
  }, [dependencies])

  return {
    state: { state1, state2 },
    actions: { handleAction, setState1, setState2 }
  }
}

function ComplexComponent() {
  const { state, actions } = useComplexLogic()
  return <div>{/* UI using state and actions */}</div>
}
```

### Benefits
- Separates business logic from UI
- Makes logic reusable
- Easier to test in isolation
- Reduces component complexity

## Pattern 2: Component Composition

### When to Use
- Component has >500 lines
- Multiple distinct UI sections
- Repeated UI patterns

### Implementation
```typescript
// Before
function LargeComponent() {
  return (
    <div>
      {/* Header section - 100 lines */}
      {/* Main content - 300 lines */}
      {/* Sidebar - 100 lines */}
      {/* Footer - 100 lines */}
    </div>
  )
}

// After
function Header() {
  return <div>{/* Header content */}</div>
}

function MainContent() {
  return <div>{/* Main content */}</div>
}

function Sidebar() {
  return <div>{/* Sidebar content */}</div>
}

function Footer() {
  return <div>{/* Footer content */}</div>
}

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

### Benefits
- Smaller, focused components
- Better code organization
- Easier to understand and maintain
- Enables parallel development

## Pattern 3: Compound Components

### When to Use
- Components that work together
- Flexible component composition
- Internal state sharing

### Implementation
```typescript
// Create compound component pattern
interface ThreeViewerComposition {
  Controls: React.FC<ControlsProps>
  Stats: React.FC<StatsProps>
  Canvas: React.FC<CanvasProps>
}

const ThreeViewer: React.FC<Props> & ThreeViewerComposition = (props) => {
  return <div>{props.children}</div>
}

ThreeViewer.Controls = ThreeViewerControls
ThreeViewer.Stats = ThreeViewerStats
ThreeViewer.Canvas = ThreeViewerCanvas

// Usage
<ThreeViewer>
  <ThreeViewer.Canvas />
  <ThreeViewer.Controls />
  <ThreeViewer.Stats />
</ThreeViewer>
```

### Benefits
- Flexible component composition
- Clear relationship between components
- Intuitive API
- Shared context

## Pattern 4: Context Provider

### When to Use
- Multiple components need same state
- Deep prop drilling
- Global state for a feature

### Implementation
```typescript
// Create context
interface ThreeViewerContextValue {
  scene: Scene | null
  camera: Camera | null
  actions: {
    resetCamera: () => void
    takeScreenshot: () => void
  }
}

const ThreeViewerContext = createContext<ThreeViewerContextValue | null>(null)

// Provider component
export function ThreeViewerProvider({ children }: { children: React.ReactNode }) {
  const renderer = useThreeRenderer()
  const camera = useThreeCamera()

  const value: ThreeViewerContextValue = {
    scene: renderer.scene,
    camera: camera.camera,
    actions: {
      resetCamera: camera.actions.resetCamera,
      takeScreenshot: renderer.actions.takeScreenshot
    }
  }

  return (
    <ThreeViewerContext.Provider value={value}>
      {children}
    </ThreeViewerContext.Provider>
  )
}

// Hook to use context
export function useThreeViewer() {
  const context = useContext(ThreeViewerContext)
  if (!context) {
    throw new Error('useThreeViewer must be used within ThreeViewerProvider')
  }
  return context
}

// Usage in sub-components
function SubComponent() {
  const { scene, camera, actions } = useThreeViewer()
  return <button onClick={actions.resetCamera}>Reset Camera</button>
}
```

### Benefits
- Eliminates prop drilling
- Centralized state management
- Type-safe API
- Easy to test

## Pattern 5: Render Props

### When to Use
- Need to share logic with flexible rendering
- Component library patterns
- Controlled vs uncontrolled behavior

### Implementation
```typescript
interface ThreeViewerRenderProps {
  scene: Scene | null
  camera: Camera | null
  isLoading: boolean
  actions: {
    resetCamera: () => void
  }
}

function ThreeViewer({ children }: { children: (props: ThreeViewerRenderProps) => React.ReactNode }) {
  const renderer = useThreeRenderer()
  const camera = useThreeCamera()
  const [isLoading, setIsLoading] = useState(false)

  const renderProps: ThreeViewerRenderProps = {
    scene: renderer.scene,
    camera: camera.camera,
    isLoading,
    actions: {
      resetCamera: camera.actions.resetCamera
    }
  }

  return <div>{children(renderProps)}</div>
}

// Usage
<ThreeViewer>
  {({ scene, camera, isLoading, actions }) => (
    <div>
      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <>
          <Canvas scene={scene} camera={camera} />
          <button onClick={actions.resetCamera}>Reset</button>
        </>
      )}
    </div>
  )}
</ThreeViewer>
```

### Benefits
- Maximum flexibility
- Inversion of control
- Clear data flow
- Easy to understand

## Pattern 6: Hook Composition

### When to Use
- Multiple hooks work together
- Complex orchestration logic
- Shared setup/cleanup

### Implementation
```typescript
// Individual hooks
function useThreeRenderer(container: HTMLElement) {
  // Renderer setup
  return { scene, renderer, camera }
}

function useThreeCamera(camera: Camera) {
  // Camera controls
  return { controls, actions }
}

function useThreeAnimation(scene: Scene) {
  // Animation logic
  return { animations, actions }
}

// Composed hook
function useThreeViewer(containerRef: RefObject<HTMLDivElement>) {
  const renderer = useThreeRenderer(containerRef.current!)
  const camera = useThreeCamera(renderer.camera)
  const animation = useThreeAnimation(renderer.scene)

  // Orchestration logic
  useEffect(() => {
    // Setup
    return () => {
      // Cleanup
    }
  }, [renderer, camera, animation])

  return {
    renderer,
    camera,
    animation
  }
}

// Usage
function ThreeViewer() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { renderer, camera, animation } = useThreeViewer(containerRef)

  return <div ref={containerRef}>{/* UI */}</div>
}
```

### Benefits
- Modular hook design
- Clear separation of concerns
- Reusable building blocks
- Easier testing

## Pattern 7: Factory Hook

### When to Use
- Dynamic instance creation
- Object pooling
- Resource management

### Implementation
```typescript
function useRendererPool(maxSize: number = 3) {
  const poolRef = useRef<WebGLRenderer[]>([])

  const acquire = useCallback(() => {
    if (poolRef.current.length > 0) {
      return poolRef.current.pop()!
    }
    return new WebGLRenderer({ antialias: true })
  }, [])

  const release = useCallback((renderer: WebGLRenderer) => {
    if (poolRef.current.length < maxSize) {
      poolRef.current.push(renderer)
    } else {
      renderer.dispose()
    }
  }, [maxSize])

  useEffect(() => {
    return () => {
      poolRef.current.forEach(r => r.dispose())
      poolRef.current = []
    }
  }, [])

  return { acquire, release }
}
```

### Benefits
- Efficient resource management
- Performance optimization
- Controlled lifecycle
- Memory management

## Choosing the Right Pattern

Use this decision tree:

1. **Is the component too large (>500 lines)?**
   - Yes → Use **Component Composition** (Pattern 2)
   - No → Continue

2. **Is business logic mixed with UI?**
   - Yes → Use **Extract Custom Hook** (Pattern 1)
   - No → Continue

3. **Do multiple components need the same state?**
   - Yes → Use **Context Provider** (Pattern 4)
   - No → Continue

4. **Do components work together closely?**
   - Yes → Use **Compound Components** (Pattern 3)
   - No → Continue

5. **Need flexible rendering control?**
   - Yes → Use **Render Props** (Pattern 5)
   - No → Continue

6. **Multiple hooks need orchestration?**
   - Yes → Use **Hook Composition** (Pattern 6)
   - No → Current design is likely fine

## Anti-Patterns

### ❌ Premature Optimization
Don't extract every small piece of code. Extract when:
- Component exceeds 500 lines
- Logic is reused in multiple places
- Testing becomes difficult

### ❌ Over-Abstraction
Don't create abstractions that are harder to understand than the original code.

### ❌ Breaking React Rules
- Don't call hooks conditionally
- Don't call hooks in loops
- Don't call hooks inside regular functions

### ❌ Creating Circular Dependencies
Ensure your extracted pieces don't import each other in circles.

## Checklist

Before refactoring:
- [ ] Understand the current code completely
- [ ] Identify the main responsibilities
- [ ] Choose the appropriate pattern(s)
- [ ] Plan the extraction strategy
- [ ] Ensure tests exist

During refactoring:
- [ ] Extract one piece at a time
- [ ] Test after each extraction
- [ ] Update TypeScript types
- [ ] Update documentation
- [ ] Run TypeScript compiler

After refactoring:
- [ ] All tests pass
- [ ] No behavioral changes
- [ ] TypeScript compiles with no errors
- [ ] Code is more maintainable
- [ ] Documentation is updated

## Resources

- [React Patterns](https://reactpatterns.com/)
- [Refactoring UI](https://refactoringui.com/)
- [Clean Code](https://www.amazon.com/Clean-Code-Handbook-Software-Craftsmanship/dp/0132350882)
- [Refactoring: Improving the Design of Existing Code](https://martinfowler.com/books/refactoring.html)
