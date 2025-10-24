# Race Condition Prevention Guide

> **Migration Guide**: Prevent race conditions with AbortController, mounted refs, and database transactions

## Why Migrate?

Race conditions cause unpredictable bugs:

- **Stale State**: Component updates after unmount cause React errors
- **Overlapping Requests**: Multiple simultaneous requests cause conflicts
- **Data Corruption**: Concurrent database writes corrupt data
- **UI Flicker**: Race conditions cause UI to flash between states
- **Cancelled Operations**: User cancels but operation continues

## When to Use

Apply race condition prevention for:
- Async operations in React components
- API requests that can be cancelled
- Database transactions with multiple operations
- Polling operations that need cancellation
- File uploads with progress tracking
- State updates after async operations

## Migration Steps

### Step 1: Identify Race Conditions

Look for these patterns:
- setState after async operations
- Multiple simultaneous requests
- Database writes without transactions
- Polling without cleanup
- Component updates after unmount

### Step 2: Add Protection

Choose appropriate pattern:
- **Mounted refs**: Prevent setState after unmount
- **AbortController**: Cancel pending requests
- **Database transactions**: Atomic multi-step operations
- **Debouncing**: Prevent rapid-fire requests

### Step 3: Test Edge Cases

Test scenarios that trigger races:
- Rapid component mount/unmount
- Slow network + fast user actions
- Multiple simultaneous requests
- Database concurrent access

## Complete Examples

### Before Migration - React Race Condition

```typescript
// AssetLoader.tsx - Before (RACE CONDITION)
function AssetLoader({ assetId }: Props) {
  const [asset, setAsset] = useState<Asset | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)

    fetch(`/api/assets/${assetId}`)
      .then(res => res.json())
      .then(data => {
        // RACE: Component might be unmounted!
        setAsset(data)
        setLoading(false)
      })
      .catch(error => {
        // RACE: Component might be unmounted!
        console.error('Failed to load asset:', error)
        setLoading(false)
      })
  }, [assetId])

  return loading ? <Loading /> : <AssetView asset={asset} />
}
```

### After Migration - Protected React Component

```typescript
// AssetLoader.tsx - After (NO RACE CONDITION)
import { createLogger } from '@/utils/logger'

const logger = createLogger('AssetLoader')

function AssetLoader({ assetId }: Props) {
  const [asset, setAsset] = useState<Asset | null>(null)
  const [loading, setLoading] = useState(false)
  const isMountedRef = useRef(true)

  useEffect(() => {
    // Track mounted state
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    const loadAsset = async () => {
      try {
        if (isMountedRef.current) {
          setLoading(true)
        }

        const response = await fetch(`/api/assets/${assetId}`, {
          signal: controller.signal
        })

        const data = await response.json()

        // Only update state if still mounted
        if (isMountedRef.current) {
          setAsset(data)
          setLoading(false)
          logger.debug('Asset loaded', { assetId })
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          // Request was cancelled - this is expected
          logger.debug('Asset load cancelled', { assetId })
          return
        }

        // Only update state if still mounted
        if (isMountedRef.current) {
          logger.error('Failed to load asset', {
            assetId,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
          setLoading(false)
        }
      }
    }

    loadAsset()

    return () => {
      // Cancel pending request on unmount or assetId change
      controller.abort()
    }
  }, [assetId])

  return loading ? <Loading /> : <AssetView asset={asset} />
}
```

### Before Migration - API Polling Race

```typescript
// GenerationMonitor.ts - Before (RACE CONDITION)
class GenerationMonitor {
  private pollingInterval: NodeJS.Timer | null = null

  startPolling(pipelineId: string) {
    // RACE: Old polling continues if called multiple times!
    this.pollingInterval = setInterval(async () => {
      const status = await this.checkStatus(pipelineId)

      if (status === 'completed') {
        // RACE: Might clear wrong interval!
        clearInterval(this.pollingInterval!)
      }
    }, 1000)
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
    }
  }
}
```

### After Migration - Protected Polling

```typescript
// GenerationMonitor.ts - After (NO RACE CONDITION)
import { createLogger } from '@/utils/logger'

const logger = createLogger('GenerationMonitor')

class GenerationMonitor {
  private pollingControllers = new Map<string, AbortController>()

  startPolling(pipelineId: string) {
    // Cancel existing polling for this pipeline
    this.stopPolling(pipelineId)

    // Create new abort controller
    const controller = new AbortController()
    this.pollingControllers.set(pipelineId, controller)

    const poll = async () => {
      try {
        const response = await fetch(`/api/pipelines/${pipelineId}/status`, {
          signal: controller.signal
        })

        const status = await response.json()

        if (status.state === 'completed' || status.state === 'failed') {
          // Stop polling - operation complete
          this.stopPolling(pipelineId)
          logger.info('Polling completed', { pipelineId, state: status.state })
          return
        }

        // Continue polling if not aborted
        if (!controller.signal.aborted) {
          setTimeout(poll, 1000)
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          // Polling was cancelled - this is expected
          logger.debug('Polling cancelled', { pipelineId })
          return
        }

        logger.error('Polling failed', {
          pipelineId,
          error: error instanceof Error ? error.message : 'Unknown error'
        })

        // Retry polling on error (if not aborted)
        if (!controller.signal.aborted) {
          setTimeout(poll, 5000) // Longer delay on error
        }
      }
    }

    // Start polling
    poll()
  }

  stopPolling(pipelineId: string) {
    const controller = this.pollingControllers.get(pipelineId)

    if (controller) {
      controller.abort()
      this.pollingControllers.delete(pipelineId)
      logger.debug('Polling stopped', { pipelineId })
    }
  }

  stopAllPolling() {
    this.pollingControllers.forEach((controller, pipelineId) => {
      controller.abort()
      logger.debug('Polling stopped', { pipelineId })
    })
    this.pollingControllers.clear()
  }
}
```

### Before Migration - Database Race

```javascript
// AssetService.mjs - Before (RACE CONDITION)
async function updateAssetMetadata(assetId, updates) {
  // RACE: Multiple calls can interleave!
  const asset = await db.get('SELECT * FROM assets WHERE id = ?', [assetId])

  const newMetadata = {
    ...asset.metadata,
    ...updates
  }

  await db.run(
    'UPDATE assets SET metadata = ? WHERE id = ?',
    [JSON.stringify(newMetadata), assetId]
  )
}
```

### After Migration - Transaction Protection

```javascript
// AssetService.mjs - After (NO RACE CONDITION)
import { createLogger } from '../utils/logger.mjs'

const logger = createLogger('AssetService')

async function updateAssetMetadata(assetId, updates) {
  return new Promise((resolve, reject) => {
    // Use transaction for atomic operation
    db.serialize(() => {
      db.run('BEGIN TRANSACTION')

      db.get(
        'SELECT * FROM assets WHERE id = ?',
        [assetId],
        (err, asset) => {
          if (err) {
            db.run('ROLLBACK')
            logger.error('Failed to fetch asset', { assetId, error: err.message })
            return reject(err)
          }

          if (!asset) {
            db.run('ROLLBACK')
            logger.warn('Asset not found', { assetId })
            return reject(new Error('Asset not found'))
          }

          const newMetadata = {
            ...asset.metadata,
            ...updates
          }

          db.run(
            'UPDATE assets SET metadata = ? WHERE id = ?',
            [JSON.stringify(newMetadata), assetId],
            (updateErr) => {
              if (updateErr) {
                db.run('ROLLBACK')
                logger.error('Failed to update asset', {
                  assetId,
                  error: updateErr.message
                })
                return reject(updateErr)
              }

              db.run('COMMIT', (commitErr) => {
                if (commitErr) {
                  db.run('ROLLBACK')
                  logger.error('Failed to commit transaction', {
                    assetId,
                    error: commitErr.message
                  })
                  return reject(commitErr)
                }

                logger.info('Asset metadata updated', { assetId })
                resolve(asset)
              })
            }
          )
        }
      )
    })
  })
}
```

## Protection Patterns

### Pattern 1: Mounted Ref (React)

Prevent setState after unmount:

```typescript
function MyComponent() {
  const isMountedRef = useRef(true)

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const fetchData = async () => {
    const data = await api.getData()

    // Only update if still mounted
    if (isMountedRef.current) {
      setData(data)
    }
  }

  return <div>...</div>
}
```

### Pattern 2: AbortController (Fetch)

Cancel pending requests:

```typescript
useEffect(() => {
  const controller = new AbortController()

  fetch('/api/data', { signal: controller.signal })
    .then(res => res.json())
    .then(data => {
      if (isMountedRef.current) {
        setData(data)
      }
    })
    .catch(error => {
      if (error.name !== 'AbortError') {
        logger.error('Fetch failed', { error: error.message })
      }
    })

  return () => {
    controller.abort()
  }
}, [])
```

### Pattern 3: Database Transactions

Atomic multi-step operations:

```javascript
async function transferAsset(fromProject, toProject, assetId) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION')

      // Step 1: Remove from source
      db.run(
        'DELETE FROM project_assets WHERE project_id = ? AND asset_id = ?',
        [fromProject, assetId],
        (err) => {
          if (err) {
            db.run('ROLLBACK')
            return reject(err)
          }

          // Step 2: Add to destination
          db.run(
            'INSERT INTO project_assets (project_id, asset_id) VALUES (?, ?)',
            [toProject, assetId],
            (insertErr) => {
              if (insertErr) {
                db.run('ROLLBACK')
                return reject(insertErr)
              }

              // Commit if both steps succeed
              db.run('COMMIT', (commitErr) => {
                if (commitErr) {
                  db.run('ROLLBACK')
                  return reject(commitErr)
                }
                resolve()
              })
            }
          )
        }
      )
    })
  })
}
```

### Pattern 4: Request Deduplication

Prevent duplicate simultaneous requests:

```typescript
class APIClient {
  private pendingRequests = new Map<string, Promise<any>>()

  async fetch(url: string) {
    // Return existing promise if request is pending
    if (this.pendingRequests.has(url)) {
      logger.debug('Returning cached promise', { url })
      return this.pendingRequests.get(url)!
    }

    // Create new request
    const promise = fetch(url)
      .then(res => res.json())
      .finally(() => {
        // Remove from pending when complete
        this.pendingRequests.delete(url)
      })

    this.pendingRequests.set(url, promise)
    return promise
  }
}
```

### Pattern 5: Debouncing

Delay execution until rapid calls stop:

```typescript
function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
) {
  const timeoutRef = useRef<NodeJS.Timeout>()

  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      callback(...args)
    }, delay)
  }, [callback, delay])
}

// Usage
function SearchInput() {
  const [query, setQuery] = useState('')

  const debouncedSearch = useDebounce((searchQuery: string) => {
    // Only executes after user stops typing for 300ms
    performSearch(searchQuery)
  }, 300)

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    debouncedSearch(value)
  }

  return <input value={query} onChange={handleChange} />
}
```

### Pattern 6: Optimistic Updates with Rollback

Update UI immediately, rollback on error:

```typescript
function useOptimisticUpdate() {
  const [items, setItems] = useState<Item[]>([])

  const deleteItem = async (itemId: string) => {
    // Save current state for rollback
    const previousItems = items

    // Optimistic update - remove immediately
    setItems(items.filter(item => item.id !== itemId))

    try {
      await api.deleteItem(itemId)
      logger.info('Item deleted', { itemId })
    } catch (error) {
      // Rollback on error
      setItems(previousItems)
      logger.error('Delete failed, rolled back', {
        itemId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  return { items, deleteItem }
}
```

## Best Practices

### 1. Always Clean Up Async Operations

```typescript
// GOOD - Cleanup in useEffect
useEffect(() => {
  const controller = new AbortController()
  fetchData(controller.signal)

  return () => {
    controller.abort()
  }
}, [])

// BAD - No cleanup
useEffect(() => {
  fetchData()
}, []) // Request continues after unmount!
```

### 2. Check Mounted Before setState

```typescript
// GOOD - Check before update
if (isMountedRef.current) {
  setData(newData)
}

// BAD - Update unconditionally
setData(newData) // React warning if unmounted!
```

### 3. Handle AbortError

```typescript
// GOOD - Ignore AbortError
catch (error) {
  if (error.name === 'AbortError') {
    return // Expected cancellation
  }
  logger.error('Unexpected error', { error })
}

// BAD - Log abort as error
catch (error) {
  logger.error('Error', { error }) // Noisy logs!
}
```

### 4. Use Transactions for Multi-Step DB Operations

```javascript
// GOOD - Transaction ensures atomicity
db.run('BEGIN TRANSACTION')
await step1()
await step2()
db.run('COMMIT')

// BAD - Steps can fail independently
await step1() // Succeeds
await step2() // Fails - but step1 already committed!
```

## Common Pitfalls

### Pitfall 1: Forgetting to Check Mounted

```typescript
// BAD - No mounted check
useEffect(() => {
  fetchData().then(data => {
    setData(data) // React warning!
  })
}, [])

// GOOD - Check mounted state
useEffect(() => {
  fetchData().then(data => {
    if (isMountedRef.current) {
      setData(data)
    }
  })
}, [])
```

### Pitfall 2: Not Aborting Requests

```typescript
// BAD - Request continues after unmount
useEffect(() => {
  fetch('/api/data')
    .then(res => res.json())
    .then(setData)
}, [])

// GOOD - Abort on cleanup
useEffect(() => {
  const controller = new AbortController()

  fetch('/api/data', { signal: controller.signal })
    .then(res => res.json())
    .then(setData)

  return () => controller.abort()
}, [])
```

### Pitfall 3: Nested Async Without Transactions

```javascript
// BAD - Race condition possible
async function updateBoth(id1, id2) {
  await updateRecord(id1)  // Commits
  await updateRecord(id2)  // Could fail!
}

// GOOD - Transaction ensures both or neither
async function updateBoth(id1, id2) {
  return new Promise((resolve, reject) => {
    db.run('BEGIN TRANSACTION')
    db.run('UPDATE ...', [id1], (err1) => {
      if (err1) {
        db.run('ROLLBACK')
        return reject(err1)
      }
      db.run('UPDATE ...', [id2], (err2) => {
        if (err2) {
          db.run('ROLLBACK')
          return reject(err2)
        }
        db.run('COMMIT', resolve)
      })
    })
  })
}
```

### Pitfall 4: Multiple Timers Without Cleanup

```typescript
// BAD - Old timers keep running
const handleChange = (value: string) => {
  setTimeout(() => {
    search(value)
  }, 300)
}

// GOOD - Clear old timer
const timeoutRef = useRef<NodeJS.Timeout>()

const handleChange = (value: string) => {
  if (timeoutRef.current) {
    clearTimeout(timeoutRef.current)
  }

  timeoutRef.current = setTimeout(() => {
    search(value)
  }, 300)
}
```

## Troubleshooting

### Issue: React warning about setState on unmounted component

**Cause**: setState called after component unmounts

**Solution**: Use mounted ref:

```typescript
const isMountedRef = useRef(true)

useEffect(() => {
  return () => {
    isMountedRef.current = false
  }
}, [])

// Check before setState
if (isMountedRef.current) {
  setState(newValue)
}
```

### Issue: Multiple requests to same endpoint

**Cause**: Rapid state changes trigger multiple fetches

**Solution**: Use debouncing or request deduplication

### Issue: Database constraint violations

**Cause**: Concurrent writes without transactions

**Solution**: Wrap multi-step operations in transactions

### Issue: Stale data displayed

**Cause**: Old request completes after newer request

**Solution**: Use AbortController to cancel old requests

## Migration Checklist

### React Components
- [ ] Add isMountedRef to components with async operations
- [ ] Check mounted before all setState calls
- [ ] Add AbortController for all fetch calls
- [ ] Pass signal to fetch options
- [ ] Handle AbortError in catch blocks
- [ ] Clean up timers in useEffect return
- [ ] Cancel subscriptions on unmount

### API Clients
- [ ] Track pending requests with Map
- [ ] Implement request cancellation
- [ ] Store AbortControllers for each request
- [ ] Clean up controllers when requests complete
- [ ] Add request deduplication if needed

### Database Operations
- [ ] Wrap multi-step operations in transactions
- [ ] Use BEGIN/COMMIT/ROLLBACK properly
- [ ] Handle transaction errors
- [ ] Ensure rollback on any step failure
- [ ] Test concurrent access scenarios

### Testing
- [ ] Test rapid mount/unmount
- [ ] Test slow network conditions
- [ ] Test multiple simultaneous requests
- [ ] Verify no React warnings in console
- [ ] Test database concurrent writes
- [ ] Verify cleanup in DevTools

## Related Documentation

- [AbortController MDN](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
- [React useEffect Cleanup](https://react.dev/reference/react/useEffect#cleanup-function)
- [SQLite Transactions](https://www.sqlite.org/lang_transaction.html)
- [Logger Migration Guide](/Users/home/hyperscape-1/packages/asset-forge/dev-book/11-development/migrations/console-to-logger.md)
- [Memory Leak Prevention](/Users/home/hyperscape-1/packages/asset-forge/dev-book/11-development/migrations/memory-leak-prevention.md)

## Examples in Codebase

See these files for real-world examples:

- `/Users/home/hyperscape-1/packages/asset-forge/src/hooks/useAssets.ts`
- `/Users/home/hyperscape-1/packages/asset-forge/src/services/api/GenerationAPIClient.ts`
- `/Users/home/hyperscape-1/packages/asset-forge/src/components/ArmorFitting/MeshFittingDebugger/index.tsx`

---

**Last Updated**: 2025-10-24
**Migration Priority**: High
**Estimated Time**: 15-25 minutes per component
