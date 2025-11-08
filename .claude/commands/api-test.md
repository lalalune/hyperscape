---
description: Test API endpoints with curl (dev server must be running)
allowed-tools: [Bash]
argument-hint: <endpoint> [method] [json-data]
---

# API Endpoint Testing

Quick API endpoint testing with curl. **Dev server must be running on http://localhost:3004** (start with `/dev backend`).

## Usage

- `/api-test /api/teams` - GET request to endpoint
- `/api-test /api/teams POST {"name":"Test"}` - POST with JSON data
- `/api-test /api/teams/123 PATCH {"name":"Updated"}` - PATCH with data
- `/api-test /api/teams/123 DELETE` - DELETE request

## GET Request (Default)

```bash
!`if [ -n "$1" ]; then echo "=== Testing GET $1 ===" && curl -s -X GET "http://localhost:3004$1" -H "Content-Type: application/json" -w "\n\nHTTP Status: %{http_code}\nTime: %{time_total}s\n" 2>&1 || (echo "❌ ERROR: Request failed" && echo "Ensure dev server is running: /dev backend" && exit 1); else echo "Provide endpoint: /api-test <endpoint>" && echo "Example: /api-test /api/teams"; fi`
```

## POST/PATCH/PUT Request with Data

```bash
!`if [ -n "$3" ]; then curl -s -X ${2:-GET} "http://localhost:3004$1" -H "Content-Type: application/json" -d '$3' -w "\n\nHTTP Status: %{http_code}\nTime: %{time_total}s\n" 2>&1; else curl -s -X ${2:-GET} "http://localhost:3004$1" -H "Content-Type: application/json" -w "\n\nHTTP Status: %{http_code}\nTime: %{time_total}s\n" 2>&1; fi || echo "ERROR: Request failed"`
```

## Available Endpoints (asset-forge)

### Teams API

```bash
# List all teams
!`curl -s http://localhost:3004/api/teams | jq`

# Get specific team
!`curl -s http://localhost:3004/api/teams/1 | jq`

# Create team
!`curl -s -X POST http://localhost:3004/api/teams -H "Content-Type: application/json" -d '{"name":"Test Team","description":"A test team"}' | jq`

# Update team
!`curl -s -X PATCH http://localhost:3004/api/teams/1 -H "Content-Type: application/json" -d '{"name":"Updated Team"}' | jq`

# Delete team
!`curl -s -X DELETE http://localhost:3004/api/teams/1`
```

### Health Check

```bash
!`curl -s http://localhost:3004/health | jq`
```

### API Documentation

```bash
!`echo "Swagger UI: http://localhost:3004/swagger"`
```

## Arguments

- `$1` - **API endpoint** (required) - e.g., `/api/teams`, `/api/teams/123`
- `$2` - **HTTP method** (optional, default: GET) - GET, POST, PATCH, PUT, DELETE
- `$3` - **JSON data** (optional) - e.g., `{"name":"Test"}`

## Prerequisites

The dev server must be running:

```bash
# Start dev server if not running
!`cd /Users/home/hyperscape-5/packages/asset-forge && bun run dev:backend &`
```

Check if server is running:

```bash
!`curl -s http://localhost:3004/health && echo "✓ Server is running" || echo "✗ Server not responding - start with /dev"`
```

## Response Formatting

Use `jq` for pretty JSON output:

```bash
!`curl -s http://localhost:3004$1 | jq .`
```

## Testing Workflows

### 1. Full CRUD Test

```bash
!`echo "Creating..." && curl -s -X POST http://localhost:3004/api/teams -H "Content-Type: application/json" -d '{"name":"CRUD Test"}' | jq && sleep 1 && echo "Reading..." && curl -s http://localhost:3004/api/teams | jq && sleep 1 && echo "Updating..." && curl -s -X PATCH http://localhost:3004/api/teams/1 -H "Content-Type: application/json" -d '{"name":"Updated"}' | jq && sleep 1 && echo "Deleting..." && curl -s -X DELETE http://localhost:3004/api/teams/1`
```

### 2. Performance Test

```bash
!`echo "Testing response time..." && for i in {1..5}; do curl -s -o /dev/null -w "Request $i: %{time_total}s\n" http://localhost:3004/api/teams; done`
```

### 3. Error Handling Test

```bash
!`echo "Testing error responses..." && curl -s http://localhost:3004/api/teams/99999 -w "\nStatus: %{http_code}\n"`
```

## See Also

- `/dev` - Start development server
- @packages/asset-forge/server/api-elysia.ts - API server implementation
- @packages/asset-forge/server/routes/ - Route handlers
- http://localhost:3004/swagger - Interactive API documentation
