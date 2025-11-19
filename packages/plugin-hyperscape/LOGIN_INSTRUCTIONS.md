# Hyperscape Login Instructions

## How to Access Login

The login page is available at:
```
http://localhost:3000/hyperscape/auth/login?agentId={YOUR_AGENT_ID}
```

## Quick Access

1. **Get your agent ID** from the ElizaOS UI (it's shown in the agent card)

2. **Open login page** in a new tab:
   ```
   http://localhost:3000/hyperscape/auth/login?agentId=550e8400-e29b-41d4-a716-446655440000
   ```
   (Replace with your actual agent ID)

3. **Click "Login with Privy"** button

4. **Authenticate** using wallet, email, or social login

5. **Tokens are saved automatically** - the popup will close and your agent will be authenticated

## Check Login Status

Check if your agent is authenticated:
```
http://localhost:3000/hyperscape/auth/status?agentId={YOUR_AGENT_ID}
```

## Adding Login Button to ElizaOS UI

To add a login button to the ElizaOS UI, you'll need to modify the ElizaOS frontend. The frontend is typically located in:
- `node_modules/@elizaos/cli/dist/frontend/` (if using CLI)
- Or in a separate ElizaOS frontend repository

Add a button in the agent card component that:
1. Checks auth status via `/hyperscape/auth/status?agentId={agentId}`
2. Shows "Login" if not authenticated
3. Opens `/hyperscape/auth/login?agentId={agentId}` in a popup when clicked

## Manual Login Flow

1. Navigate to: `http://localhost:3000/hyperscape/auth/login?agentId={agentId}`
2. Click "Login with Privy"
3. Complete authentication
4. Tokens are automatically saved to agent settings
5. Agent will reconnect with new auth tokens

