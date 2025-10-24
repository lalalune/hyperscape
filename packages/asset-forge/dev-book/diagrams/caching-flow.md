# Caching Flow Diagram

> **Visual representation of the multi-layer caching architecture**

This diagram illustrates how requests flow through Asset Forge's caching layers.

---

## Complete Caching Flow

```mermaid
graph TB
    User[User Action]
    Component[React Component]

    subgraph "Application Cache Layer"
        AssetCache[Asset Cache Service<br/>LRU + TTL]
        CacheHit{Cache Hit?}
        CacheMiss[Cache Miss]
    end

    subgraph "Deduplication Layer"
        Dedupe[Request Deduplicator]
        InFlight{In-Flight?}
        SharedPromise[Share Promise]
        NewRequest[New Request]
    end

    subgraph "Network Layer"
        API[Backend API]
        Response[HTTP Response]
    end

    subgraph "Rendering Layer"
        RendererPool[WebGL Renderer Pool]
        Renderer[Shared Renderer]
    end

    User --> Component
    Component --> AssetCache
    AssetCache --> CacheHit

    CacheHit -->|Yes<br/>0-2ms| Component
    CacheHit -->|No| CacheMiss

    CacheMiss --> Dedupe
    Dedupe --> InFlight

    InFlight -->|Yes| SharedPromise
    InFlight -->|No| NewRequest

    SharedPromise --> Component
    NewRequest --> API

    API --> Response
    Response --> AssetCache
    AssetCache --> Component

    Component --> RendererPool
    RendererPool --> Renderer
    Renderer --> User

    style CacheHit fill:#10b981
    style CacheMiss fill:#f59e0b
    style SharedPromise fill:#3b82f6
    style Response fill:#8b5cf6
```

---

## Detailed Cache Hierarchy

```mermaid
graph LR
    subgraph "Browser"
        HTTP[HTTP Cache<br/>Static Assets<br/>1 year TTL]
    end

    subgraph "Application Memory"
        L1[Asset Cache<br/>Metadata: 5min<br/>Models: 30min<br/>Presets: 60min]
        L2[Request Dedupe<br/>In-Flight Only<br/>Auto-cleanup]
        L3[Component Memo<br/>React.memo<br/>useMemo]
    end

    subgraph "Resource Pool"
        Pool[Renderer Pool<br/>Max 4 Renderers<br/>Idle: 30s cleanup]
    end

    HTTP --> L1
    L1 --> L2
    L2 --> L3
    L3 --> Pool

    style HTTP fill:#e0e7ff
    style L1 fill:#dbeafe
    style L2 fill:#d1fae5
    style L3 fill:#fef3c7
    style Pool fill:#ffe4e6
```

---

## Request Flow Timeline

```mermaid
sequenceDiagram
    participant U as User
    participant C as Component
    participant AC as Asset Cache
    participant RD as Deduplicator
    participant API as Backend

    Note over U,API: First Request (Cache Miss)

    U->>C: Load page
    C->>AC: get('assets:list')
    AC-->>C: null (miss)

    C->>RD: deduplicate('GET::/api/assets')
    Note over RD: No in-flight request
    RD->>API: HTTP GET /api/assets
    Note over API: 150ms
    API-->>RD: Assets Data
    RD-->>AC: Store in cache
    AC-->>C: Assets Data
    C-->>U: Render UI

    Note over U,API: Second Request (Cache Hit)

    U->>C: Refresh
    C->>AC: get('assets:list')
    Note over AC: Found! Not expired
    AC-->>C: Cached Assets (0ms)
    C-->>U: Instant Render

    Note over U,API: Third Request (Deduplicated)

    U->>C: Another component loads
    C->>AC: get('assets:list')
    Note over AC: Expired! Remove
    AC-->>C: null (miss)
    C->>RD: deduplicate('GET::/api/assets')
    Note over RD: Request already in-flight!
    RD-->>C: Shared Promise
    Note over API: Original request completes
    C-->>U: All callers receive data
```

---

## Cache Invalidation Patterns

```mermaid
graph TB
    Mutation[Mutation<br/>Create/Update/Delete]

    subgraph "Invalidation Strategies"
        Immediate[Immediate<br/>cache.delete]
        Pattern[Pattern-Based<br/>cache.invalidate regex]
        TTL[Time-Based<br/>Auto-expire]
        Event[Event-Based<br/>WebSocket update]
    end

    subgraph "Affected Caches"
        Single[Single Asset<br/>asset:123]
        List[Asset List<br/>assets:list]
        Related[Related Data<br/>asset:123:*]
        Filtered[Filtered Lists<br/>assets:type:*]
    end

    Mutation --> Immediate
    Mutation --> Pattern
    Mutation --> Event

    Immediate --> Single
    Immediate --> List
    Pattern --> Related
    Pattern --> Filtered

    TTL -.-> Single
    TTL -.-> List
    TTL -.-> Related
    TTL -.-> Filtered

    Event --> Single
    Event --> List

    style Mutation fill:#ef4444
    style Immediate fill:#10b981
    style Pattern fill:#3b82f6
    style TTL fill:#f59e0b
    style Event fill:#8b5cf6
```

---

## Performance Impact

```mermaid
graph LR
    subgraph "Without Caching"
        R1[Request 1<br/>180ms]
        R2[Request 2<br/>165ms]
        R3[Request 3<br/>175ms]
        T1[Total: 520ms]

        R1 --> R2 --> R3 --> T1
    end

    subgraph "With Caching"
        C1[Request 1<br/>180ms miss]
        C2[Request 2<br/>1ms hit]
        C3[Request 3<br/>0ms hit]
        T2[Total: 181ms]

        C1 --> C2 --> C3 --> T2
    end

    T1 -.->|65% faster| T2

    style T1 fill:#ef4444
    style T2 fill:#10b981
```

---

## Cache Coordination Example

```mermaid
graph TB
    Component[Component Requests Asset]

    CacheSvc[Asset Cache Service]
    Dedupe[Request Deduplicator]
    API[Fetch from API]

    Component --> Check1{Check Cache}
    Check1 -->|Hit| Return1[Return Cached<br/>0-2ms]
    Check1 -->|Miss| Dedupe

    Dedupe --> Check2{In-Flight?}
    Check2 -->|Yes| Return2[Share Promise]
    Check2 -->|No| API

    API --> Store[Store in Cache]
    Store --> Return3[Return Fresh Data<br/>150-200ms]

    Return1 --> Component
    Return2 --> Component
    Return3 --> Component

    style Check1 fill:#10b981
    style Check2 fill:#3b82f6
    style Store fill:#8b5cf6
```

---

## Memory Management

```mermaid
graph TB
    subgraph "Cache Capacity Management"
        Add[Add New Entry]
        Check{Cache Full?}
        Evict[Evict LRU Entry]
        Store[Store Entry]
    end

    subgraph "Entry Lifecycle"
        Create[Entry Created<br/>TTL Set]
        Access[Entry Accessed<br/>Move to MRU]
        Expire[Entry Expires<br/>Auto-Remove]
        Cleanup[Cleanup Resources<br/>Revoke Blob URLs]
    end

    Add --> Check
    Check -->|Yes| Evict
    Check -->|No| Store
    Evict --> Store

    Store --> Create
    Create --> Access
    Access --> Expire
    Expire --> Cleanup

    style Check fill:#f59e0b
    style Evict fill:#ef4444
    style Cleanup fill:#10b981
```

---

## Usage Example

```typescript
// Complete cache flow in a component
function AssetList() {
  const [assets, setAssets] = useState<Asset[]>([])
  const cache = AssetCacheService.getInstance()

  useEffect(() => {
    async function loadAssets() {
      const cacheKey = 'assets:list'

      // 1. Check cache
      const cached = cache.get<Asset[]>(cacheKey)
      if (cached) {
        console.log('Cache HIT - 0ms')
        setAssets(cached)
        return
      }

      // 2. Deduplicate request
      const dedupeKey = 'GET::/api/assets'
      const data = await requestDeduplicator.deduplicate(dedupeKey, async () => {
        console.log('Cache MISS - Fetching from API')
        const response = await fetch('/api/assets')
        return response.json()
      })

      // 3. Store in cache
      cache.set(cacheKey, data, 'metadata') // 5min TTL
      setAssets(data)
    }

    loadAssets()
  }, [])

  return <div>{assets.map(a => <AssetCard key={a.id} asset={a} />)}</div>
}
```

---

## Related Documentation

- [Request Deduplication](../04-architecture/request-deduplication.md)
- [Asset Caching](../04-architecture/asset-caching.md)
- [Caching Strategy](../04-architecture/caching-strategy.md)
- [Performance Architecture](../04-architecture/performance-architecture.md)

---

**Last Updated:** 2025-10-24
**Version:** 1.0.0
