#!/bin/bash

# Script to wire up all route handlers in server/api.mjs
# Adds import statements and route definitions for auth, admin, user, projects, teams, and API keys

set -e

API_FILE="server/api.mjs"
TEMP_FILE="server/api.mjs.temp"

echo "🔌 Wiring up route handlers in Asset Forge API..."
echo ""

# Check if routes are already wired up
if grep -q "POST_login" "$API_FILE"; then
  echo "⚠️  Routes appear to be already wired up. Exiting to avoid duplicates."
  echo "   If you want to re-run, please restore from backup first."
  exit 1
fi

echo "📝 Adding import statements..."

# Find the line number where imports end (after voice-manifest imports)
IMPORT_LINE=$(grep -n "from './routes/voice-manifest.mjs'" "$API_FILE" | cut -d: -f1)

if [ -z "$IMPORT_LINE" ]; then
  echo "❌ Could not find import section. Please add imports manually."
  exit 1
fi

# Create a temporary file with new imports inserted
head -n "$IMPORT_LINE" "$API_FILE" > "$TEMP_FILE"

# Add new imports
cat >> "$TEMP_FILE" << 'EOF'

// Auth routes
import { POST_login, GET_me, POST_logout } from './routes/auth.mjs'

// Admin routes
import {
  POST_addToWhitelist,
  POST_removeFromWhitelist,
  GET_whitelist,
  GET_allUsers,
  GET_stats,
  GET_activity,
  requireAdmin
} from './routes/admin.mjs'

// User routes
import {
  GET_profile,
  PUT_profile,
  GET_usage,
  GET_history,
  DELETE_account,
  POST_export
} from './routes/user.mjs'

// API Keys routes
import {
  POST_addApiKey,
  GET_apiKeys,
  PUT_updateApiKey,
  DELETE_apiKey
} from './routes/api-keys.mjs'

// Projects routes
import {
  POST_createProject,
  GET_projects,
  GET_project,
  PUT_updateProject,
  DELETE_project,
  POST_shareProject
} from './routes/projects.mjs'

// Teams routes
import {
  POST_createTeam,
  GET_teamPreview,
  POST_joinTeam,
  GET_myTeam,
  GET_teamMembers,
  POST_leaveTeam,
  DELETE_team,
  PUT_updateTeam,
  DELETE_removeMember,
  POST_transferOwnership
} from './routes/teams.mjs'
EOF

# Add the rest of the file after imports
tail -n +$((IMPORT_LINE + 1)) "$API_FILE" >> "$TEMP_FILE"

# Now add route handlers before error handling middleware
# Find the line with error handling middleware
ERROR_LINE=$(grep -n "^// Error handling middleware" "$TEMP_FILE" | cut -d: -f1)

if [ -z "$ERROR_LINE" ]; then
  echo "❌ Could not find error handling middleware line."
  exit 1
fi

echo "📝 Adding route handlers..."

# Create final file with route handlers inserted
head -n $((ERROR_LINE - 1)) "$TEMP_FILE" > "$API_FILE.final"

# Add all the new route handlers
cat >> "$API_FILE.final" << 'EOF'

// =====================================================================
// AUTHENTICATION ROUTES
// =====================================================================

app.post('/api/auth/login', (req, res) => {
  POST_login(req, res)
})

app.get('/api/auth/me', authenticateUser, (req, res) => {
  GET_me(req, res)
})

app.post('/api/auth/logout', (req, res) => {
  POST_logout(req, res)
})

// =====================================================================
// USER ROUTES
// =====================================================================

app.get('/api/user/profile', authenticateUser, (req, res) => {
  GET_profile(req, res)
})

app.put('/api/user/profile', authenticateUser, (req, res) => {
  PUT_profile(req, res)
})

app.get('/api/user/usage', authenticateUser, (req, res) => {
  GET_usage(req, res)
})

app.get('/api/user/history', authenticateUser, (req, res) => {
  GET_history(req, res)
})

app.delete('/api/user/account', authenticateUser, (req, res) => {
  DELETE_account(req, res)
})

app.post('/api/user/export', authenticateUser, (req, res) => {
  POST_export(req, res)
})

// =====================================================================
// API KEYS ROUTES
// =====================================================================

app.post('/api/user/api-keys', authenticateUser, (req, res) => {
  POST_addApiKey(req, res)
})

app.get('/api/user/api-keys', authenticateUser, (req, res) => {
  GET_apiKeys(req, res)
})

app.put('/api/user/api-keys/:id', authenticateUser, (req, res) => {
  PUT_updateApiKey(req, res)
})

app.delete('/api/user/api-keys/:id', authenticateUser, (req, res) => {
  DELETE_apiKey(req, res)
})

// =====================================================================
// PROJECTS ROUTES
// =====================================================================

app.post('/api/projects', authenticateUser, (req, res) => {
  POST_createProject(req, res)
})

app.get('/api/projects', authenticateUser, (req, res) => {
  GET_projects(req, res)
})

app.get('/api/projects/:id', authenticateUser, (req, res) => {
  GET_project(req, res)
})

app.put('/api/projects/:id', authenticateUser, (req, res) => {
  PUT_updateProject(req, res)
})

app.delete('/api/projects/:id', authenticateUser, (req, res) => {
  DELETE_project(req, res)
})

app.post('/api/projects/:id/share', authenticateUser, (req, res) => {
  POST_shareProject(req, res)
})

// =====================================================================
// TEAMS ROUTES
// =====================================================================

app.post('/api/teams/create', authenticateUser, (req, res) => {
  POST_createTeam(req, res)
})

app.get('/api/teams/preview/:inviteCode', (req, res) => {
  GET_teamPreview(req, res)
})

app.post('/api/teams/join', authenticateUser, (req, res) => {
  POST_joinTeam(req, res)
})

app.get('/api/teams/my-team', authenticateUser, (req, res) => {
  GET_myTeam(req, res)
})

app.get('/api/teams/:teamId/members', authenticateUser, (req, res) => {
  GET_teamMembers(req, res)
})

app.post('/api/teams/:teamId/leave', authenticateUser, (req, res) => {
  POST_leaveTeam(req, res)
})

app.delete('/api/teams/:teamId', authenticateUser, (req, res) => {
  DELETE_team(req, res)
})

app.put('/api/teams/:teamId', authenticateUser, (req, res) => {
  PUT_updateTeam(req, res)
})

app.delete('/api/teams/:teamId/members/:memberId', authenticateUser, (req, res) => {
  DELETE_removeMember(req, res)
})

app.post('/api/teams/:teamId/transfer-ownership', authenticateUser, (req, res) => {
  POST_transferOwnership(req, res)
})

// =====================================================================
// ADMIN ROUTES
// =====================================================================

app.post('/api/admin/whitelist/add', authenticateUser, requireAdmin, (req, res) => {
  POST_addToWhitelist(req, res)
})

app.post('/api/admin/whitelist/remove', authenticateUser, requireAdmin, (req, res) => {
  POST_removeFromWhitelist(req, res)
})

app.get('/api/admin/whitelist', authenticateUser, requireAdmin, (req, res) => {
  GET_whitelist(req, res)
})

app.get('/api/admin/users', authenticateUser, requireAdmin, (req, res) => {
  GET_allUsers(req, res)
})

app.get('/api/admin/stats', authenticateUser, requireAdmin, (req, res) => {
  GET_stats(req, res)
})

app.get('/api/admin/activity', authenticateUser, requireAdmin, (req, res) => {
  GET_activity(req, res)
})

EOF

# Add the rest of the file from error handling middleware onwards
tail -n +$ERROR_LINE "$TEMP_FILE" >> "$API_FILE.final"

# Replace original file with final version
mv "$API_FILE.final" "$API_FILE"

# Clean up temp files
rm -f "$TEMP_FILE"

echo ""
echo "✅ Route handlers wired up successfully!"
echo ""
echo "📊 Summary of added routes:"
echo "  • Authentication routes: 3 (login, me, logout)"
echo "  • User profile routes: 6 (profile, usage, history, account, export)"
echo "  • API keys routes: 4 (add, get, update, delete)"
echo "  • Projects routes: 6 (create, list, get, update, delete, share)"
echo "  • Teams routes: 10 (create, preview, join, my-team, members, leave, delete, update, remove member, transfer ownership)"
echo "  • Admin routes: 6 (whitelist add/remove/list, users, stats, activity)"
echo "  • Total: 35 new route handlers"
echo ""
echo "📝 Next steps:"
echo "  1. Review changes: git diff $API_FILE"
echo "  2. Test the API server starts without errors"
echo "  3. Test authentication flows"
echo "  4. Update frontend to use new routes"
echo ""
