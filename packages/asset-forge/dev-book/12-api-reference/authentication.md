# Authentication

[← Back to API Reference](../12-api-reference/)

---

## Overview

Asset Forge uses [Privy](https://privy.io) for authentication with JWT tokens. This provides secure, industry-standard authentication with support for wallet connections and traditional email/social login.

**Key Features:**
- Secure JWT-based authentication
- Wallet connection support (Web3)
- Email and social login
- Automatic session refresh
- Token rotation for security

---

## Setup

### 1. Create Privy Account

1. Visit [https://privy.io](https://privy.io)
2. Sign up for a free account
3. Create a new app from the dashboard

### 2. Get Credentials

From your Privy dashboard:
1. Copy your **App ID** (public identifier)
2. Navigate to Settings
3. Copy your **App Secret** (keep this secret!)

### 3. Configure Environment Variables

Add to `.env`:

```bash
# Privy Authentication
PRIVY_APP_ID=your_app_id_from_dashboard
PRIVY_APP_SECRET=your_app_secret_from_settings
VITE_PUBLIC_PRIVY_APP_ID=your_app_id_from_dashboard

# Security
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)
```

**Security Notes:**
- `PRIVY_APP_ID` is public (safe to expose in frontend)
- `PRIVY_APP_SECRET` must remain secret (server-side only)
- `JWT_SECRET` is used to sign JWT tokens
- `ENCRYPTION_KEY` is used to encrypt user API keys in the database

### 4. Generate Secure Secrets

```bash
# Generate JWT secret
openssl rand -base64 32

# Generate encryption key
openssl rand -base64 32
```

**Important:**
- Use different values for development and production
- Never reuse secrets across environments
- Store production secrets securely (environment variables, not in code)

---

## Authentication Flow

### 1. Frontend Login

User initiates login via Privy:
- Wallet connection (MetaMask, WalletConnect, etc.)
- Email login with magic link
- Social login (Google, Twitter, etc.)

### 2. Token Exchange

Frontend sends Privy token to backend:

```typescript
POST /api/auth/login
Content-Type: application/json

{
  "privyToken": "privy_token_from_frontend"
}
```

### 3. JWT Issued

Backend verifies Privy token and issues JWT:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_12345",
    "walletAddress": "0x1234567890abcdef",
    "email": "user@example.com",
    "createdAt": "2025-01-21T12:34:56.789Z"
  }
}
```

### 4. JWT Used for API Requests

Frontend includes JWT in `Authorization` header:

```typescript
fetch('/api/assets', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
```

---

## API Endpoints

### POST /api/auth/login

Exchange Privy token for JWT.

**Request:**
```json
{
  "privyToken": "privy_token_here"
}
```

**Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_12345",
    "walletAddress": "0x1234567890abcdef",
    "email": "user@example.com",
    "createdAt": "2025-01-21T12:34:56.789Z"
  }
}
```

**Error Responses:**

```json
// 401 - Invalid Privy token
{
  "error": "Invalid authentication token"
}

// 500 - Server error
{
  "error": "Authentication failed"
}
```

### GET /api/auth/me

Get current authenticated user information.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
{
  "id": "user_12345",
  "walletAddress": "0x1234567890abcdef",
  "email": "user@example.com",
  "createdAt": "2025-01-21T12:34:56.789Z",
  "isAdmin": false
}
```

**Error Responses:**

```json
// 401 - No token provided
{
  "error": "Authentication required"
}

// 401 - Invalid token
{
  "error": "Invalid token"
}
```

### POST /api/auth/logout

Logout (client-side token removal).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
{
  "message": "Logged out successfully"
}
```

**Note:** JWT tokens are stateless. Logout is primarily client-side (removing the token). The server doesn't maintain a session.

---

## Protected Routes

Most API routes require authentication. Include the JWT token in the `Authorization` header:

### Asset Routes
```typescript
// Get all user assets
GET /api/assets
Authorization: Bearer <jwt_token>

// Get specific asset
GET /api/assets/:assetId
Authorization: Bearer <jwt_token>

// Generate new asset
POST /api/generate
Authorization: Bearer <jwt_token>
```

### User Routes
```typescript
// Get user profile
GET /api/user/profile
Authorization: Bearer <jwt_token>

// Update user settings
PUT /api/user/settings
Authorization: Bearer <jwt_token>
```

### Project Routes
```typescript
// List projects
GET /api/projects
Authorization: Bearer <jwt_token>

// Create project
POST /api/projects
Authorization: Bearer <jwt_token>
```

---

## Admin Routes

Admin routes require both authentication **AND** admin role.

### Admin-Only Endpoints

```typescript
// Admin dashboard stats
GET /api/admin/stats
Authorization: Bearer <jwt_token>
// Requires: user.isAdmin === true

// Promote user to admin
POST /api/admin/promote
Authorization: Bearer <jwt_token>
// Requires: user.isAdmin === true

// Manage prompts
GET /api/admin/prompts
Authorization: Bearer <jwt_token>
// Requires: user.isAdmin === true
```

### Checking Admin Status

```typescript
const response = await fetch('/api/auth/me', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const user = await response.json();
if (user.isAdmin) {
  // User has admin privileges
}
```

---

## Error Responses

### 401 Unauthorized

No authentication token provided or token is invalid.

```json
{
  "error": "Authentication required"
}
```

**Solutions:**
- Ensure user is logged in
- Check token is included in Authorization header
- Verify token hasn't expired
- Re-authenticate if needed

### 403 Forbidden

Authenticated but lacks required permissions (e.g., not an admin).

```json
{
  "error": "Admin access required"
}
```

**Solutions:**
- User needs admin role
- Contact admin to grant permissions
- Check if accessing admin-only route

### 500 Internal Server Error

Authentication system error.

```json
{
  "error": "Authentication failed"
}
```

**Solutions:**
- Check server logs
- Verify environment variables are set correctly
- Ensure Privy service is accessible

---

## Client-Side Usage

### React Hook Example

```typescript
import { usePrivy } from '@privy-io/react-auth';

function MyComponent() {
  const { login, logout, authenticated, user } = usePrivy();

  const handleLogin = async () => {
    await login();
    // Privy handles the login flow
    // After success, exchange for JWT
  };

  const handleLogout = async () => {
    await logout();
    // Clear local JWT token
  };

  return (
    <div>
      {authenticated ? (
        <button onClick={handleLogout}>Logout</button>
      ) : (
        <button onClick={handleLogin}>Login</button>
      )}
    </div>
  );
}
```

### Making Authenticated Requests

```typescript
// Store token after login
const { token } = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ privyToken })
}).then(r => r.json());

// Save token (localStorage, state management, etc.)
localStorage.setItem('jwt_token', token);

// Use token for authenticated requests
const assets = await fetch('/api/assets', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
}).then(r => r.json());
```

---

## Security Best Practices

### Token Storage

**Recommended:**
- Use `httpOnly` cookies (most secure)
- Store in memory (state management)

**Acceptable:**
- LocalStorage (convenient, but vulnerable to XSS)

**Never:**
- Store in URL parameters
- Store in public code
- Log tokens to console in production

### Token Expiration

JWT tokens expire after 24 hours by default.

**Handle expiration:**
```typescript
fetch('/api/assets', {
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(response => {
  if (response.status === 401) {
    // Token expired, re-authenticate
    redirectToLogin();
  }
  return response.json();
});
```

### Environment Variables

**Development (.env.development):**
```bash
PRIVY_APP_ID=dev_app_id
PRIVY_APP_SECRET=dev_secret
JWT_SECRET=dev_jwt_secret_32_chars_min
ENCRYPTION_KEY=dev_encryption_key_base64
```

**Production (.env.production):**
```bash
PRIVY_APP_ID=prod_app_id
PRIVY_APP_SECRET=prod_secret
JWT_SECRET=prod_jwt_secret_different_from_dev
ENCRYPTION_KEY=prod_encryption_key_different_from_dev
```

**Never:**
- Commit `.env` files to git
- Reuse secrets across environments
- Share secrets in public channels
- Use example/placeholder values in production

---

## Troubleshooting

### "Invalid authentication token"

**Cause:** Privy token is invalid or expired.

**Solutions:**
1. Check Privy App ID matches in frontend and backend
2. Verify token is being sent correctly
3. Re-authenticate user

### "JWT secret not configured"

**Cause:** `JWT_SECRET` environment variable not set.

**Solutions:**
1. Generate secret: `openssl rand -base64 32`
2. Add to `.env`: `JWT_SECRET=generated_secret`
3. Restart server

### "Failed to verify Privy token"

**Cause:** Cannot connect to Privy API or invalid App Secret.

**Solutions:**
1. Check internet connection
2. Verify `PRIVY_APP_SECRET` is correct
3. Ensure Privy service is accessible
4. Check Privy dashboard for service status

### Token expires too quickly

**Cause:** Default expiration is 24 hours.

**Solutions:**
1. Implement token refresh on frontend
2. Prompt user to re-login
3. Adjust expiration in JWT signing (server-side)

---

## Related Documentation

**Setup:**
- [Installation Guide](../02-getting-started/installation.md) - Initial setup
- [Configuration Guide](../02-getting-started/configuration.md) - Environment variables

**API Reference:**
- [REST API](rest-api.md) - All API endpoints
- [Frontend API](frontend-api.md) - Client-side API usage

**Security:**
- [Deployment Guide](../14-deployment/environment-setup.md) - Production secrets

---

[← Back to API Reference](../12-api-reference/) | [Next: REST API →](rest-api.md)
