# Reset Database and Restart Dev Server

This command will:
1. Kill all dev processes on ports 3000, 3333, 5555
2. Clear all user and character data from the PostgreSQL database
3. Start fresh dev servers with `bun run dev`

Execute the following commands in sequence:

```bash
# Step 1: Kill all dev processes
echo "🔪 Killing dev processes..."
lsof -ti:3000,3333,5555 | xargs kill -9 2>/dev/null || echo "No processes to kill"
sleep 2

# Step 2: Clear database
echo "🗑️  Clearing database..."
cat /Users/home/hyperscape/clear-users.sql | docker exec -i hyperscape-postgres psql -U hyperscape -d hyperscape

# Step 3: Start dev servers
echo "🚀 Starting dev servers..."
cd /Users/home/hyperscape && bun run dev
```

Run all steps in background mode so you can continue working while servers start.
