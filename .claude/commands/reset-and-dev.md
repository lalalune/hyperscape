# Reset and Dev - Full Development Environment Reset

Reset the entire development environment including database AND client auth state.

## Steps to Execute

### 1. Kill all dev processes
Kill any processes running on ports 3000, 3333, and 5555:
```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3333 | xargs kill -9 2>/dev/null || true
lsof -ti:5555 | xargs kill -9 2>/dev/null || true
```

### 2. Clear the database
Reset all user and character data:
```bash
docker exec -i hyperscape-postgres psql -U hyperscape -d hyperscape -c "TRUNCATE TABLE characters, users CASCADE;"
```

### 3. Start dev servers
Start the development servers in the background:
```bash
bun run dev
```

### 4. IMPORTANT - Clear Browser Auth State
After database reset, users must clear browser localStorage to see the login screen.

**Tell the user:**
> Database has been reset. To test as a new user, open your browser console (F12) and run:
> ```javascript
> localStorage.removeItem('privy_auth_token');
> localStorage.removeItem('privy_user_id');
> localStorage.removeItem('farcaster_fid');
> location.reload();
> ```
> This clears the cached auth tokens so Privy will prompt for login.

## Why localStorage Clearing is Needed

The client's `PrivyAuthManager.restoreFromStorage()` checks localStorage for cached auth tokens on page load. If tokens exist (even after database reset), it sets `isAuthenticated: true` without validating against the server.

This causes:
- Users bypass the Privy login screen
- Server creates anonymous users instead of prompting authentication
- Old cached credentials may not match new database state

## Expected Result

After completing all steps:
1. Dev servers running on ports 3333 (client) and 5555 (server)
2. Database cleared of all users and characters
3. User informed to clear localStorage for fresh login experience
