# Asset Forge State Management

This directory contains Zustand stores for managing application state in Asset Forge.

## Stores

### User Store (`userStore.ts`)

Manages user profile, usage statistics, and generation history.

**State:**
- `user` - Current authenticated user from Privy
- `profile` - Extended user profile with Asset Forge data
- `usage` - Usage statistics (generations, API calls, storage)
- `history` - Generation history with filters
- `loading` - Loading state
- `error` - Error messages

**Actions:**
```typescript
import { useUserStore } from '@/stores'

// Fetch user profile
await useUserStore.getState().fetchProfile()

// Update profile
await useUserStore.getState().updateProfile({ name: 'John Doe' })

// Fetch usage stats
await useUserStore.getState().fetchUsage()

// Fetch history with filters
await useUserStore.getState().fetchHistory({
  page: 1,
  limit: 20,
  provider: 'openai',
  status: 'completed'
})

// Export user data (GDPR)
const blob = await useUserStore.getState().exportData()

// Delete account
await useUserStore.getState().deleteAccount('confirmation-code')
```

**Usage in Components:**
```typescript
import { useUserStore } from '@/stores'

function ProfileCard() {
  const { profile, loading, fetchProfile } = useUserStore()

  useEffect(() => {
    fetchProfile()
  }, [])

  if (loading) return <div>Loading...</div>
  if (!profile) return null

  return (
    <div>
      <h2>{profile.name}</h2>
      <p>{profile.email}</p>
    </div>
  )
}
```

### Projects Store (`projectsStore.ts`)

Manages project CRUD operations and filtering.

**State:**
- `projects` - Array of user projects
- `selectedProject` - Currently selected project
- `filters` - Current filter state (page, limit, type, gameStyle, gameType)
- `loading` - Loading state
- `error` - Error messages

**Actions:**
```typescript
import { useProjectsStore } from '@/stores'

// Fetch projects with filters
await useProjectsStore.getState().fetchProjects({
  type: 'game',
  gameStyle: 'rpg',
  gameType: 'multiplayer'
})

// Create new project
const project = await useProjectsStore.getState().createProject({
  name: 'My RPG',
  type: 'game',
  gameStyle: 'rpg',
  gameType: 'multiplayer',
  artDirection: 'low-poly'
})

// Update project
await useProjectsStore.getState().updateProject(projectId, {
  name: 'Updated Name'
})

// Delete project
await useProjectsStore.getState().deleteProject(projectId)

// Share project
const { shareId, shareUrl } = await useProjectsStore.getState().shareProject(projectId)

// Select project
useProjectsStore.getState().selectProject(project)

// Update filters
useProjectsStore.getState().setFilters({ page: 2 })
```

**Usage in Components:**
```typescript
import { useProjectsStore } from '@/stores'

function ProjectsList() {
  const { projects, filters, fetchProjects, setFilters } = useProjectsStore()

  useEffect(() => {
    fetchProjects()
  }, [filters])

  return (
    <div>
      {projects.map(project => (
        <ProjectCard key={project.id} project={project} />
      ))}
      <Pagination
        page={filters.page}
        onChange={(page) => setFilters({ page })}
      />
    </div>
  )
}
```

### Admin Store (`adminStore.ts`)

Manages admin-only features (whitelist, users, statistics).

**State:**
- `whitelist` - Whitelist entries
- `users` - All users with pagination
- `stats` - Admin statistics
- `loading` - Loading state
- `error` - Error messages
- `currentPage` - Current pagination page
- `totalPages` - Total pages for users

**Actions:**
```typescript
import { useAdminStore } from '@/stores'

// Fetch whitelist
await useAdminStore.getState().fetchWhitelist()

// Add to whitelist
await useAdminStore.getState().addToWhitelist('0x1234...', 'Early supporter')

// Remove from whitelist
await useAdminStore.getState().removeFromWhitelist('0x1234...')

// Fetch all users
await useAdminStore.getState().fetchUsers(1, 50)

// Fetch admin stats
await useAdminStore.getState().fetchStats()
```

**Usage in Components:**
```typescript
import { useAdminStore } from '@/stores'

function AdminDashboard() {
  const { stats, loading, fetchStats } = useAdminStore()

  useEffect(() => {
    fetchStats()
  }, [])

  if (loading) return <div>Loading...</div>
  if (!stats) return null

  return (
    <div>
      <h2>Total Users: {stats.totalUsers}</h2>
      <p>Active Users (30d): {stats.activeUsers30Days}</p>
      <p>Total Generations: {stats.totalGenerations}</p>
    </div>
  )
}
```

## API Services

All stores use corresponding API services from `@/services/api`:

- `UserService` - User profile and data endpoints
- `ProjectService` - Project CRUD operations
- `AdminService` - Admin-only endpoints
- `APIKeyService` - Encrypted API key management

### Authentication

All API services automatically include authentication headers using `privyAuthManager`:

```typescript
private getAuthHeaders(): HeadersInit {
  const token = privyAuthManager.getToken()
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }
}
```

## Error Handling

All stores implement consistent error handling:

```typescript
try {
  const data = await SomeService.fetchData()
  set({ data, loading: false })
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Operation failed'
  set({ error: errorMessage, loading: false })
  throw error
}
```

## Best Practices

1. **Always check authentication** - Services will throw if user is not authenticated
2. **Handle errors** - Wrap store actions in try/catch blocks
3. **Use loading states** - Display loading UI while fetching data
4. **Clear errors** - Reset error state when retrying operations
5. **Selective subscriptions** - Only subscribe to needed state slices

Example:
```typescript
// Good - Only subscribe to needed state
const profile = useUserStore(state => state.profile)
const loading = useUserStore(state => state.loading)

// Less optimal - Subscribes to entire store
const { profile, loading } = useUserStore()
```

## Environment Variables

Required environment variables (see `.env.example`):

- `VITE_API_URL` - API base URL (default: `/api`)
- `VITE_PUBLIC_PRIVY_APP_ID` - Privy authentication app ID
- `PRIVY_APP_SECRET` - Privy app secret (backend)
- `JWT_SECRET` - JWT secret for token generation (backend)
- `ENCRYPTION_KEY` - 32-byte encryption key for API keys (backend)

## Testing

Test stores using the built-in Zustand testing utilities:

```typescript
import { useUserStore } from '@/stores'

describe('userStore', () => {
  it('should fetch profile', async () => {
    const { fetchProfile } = useUserStore.getState()
    await fetchProfile()
    const { profile } = useUserStore.getState()
    expect(profile).toBeDefined()
  })
})
```
