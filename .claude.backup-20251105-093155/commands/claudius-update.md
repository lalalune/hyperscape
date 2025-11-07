# /claudius-update

Check for and install updates to Claudius Skills components.

**Description:**
Checks the claudius-skills repository for updates, compares with your installed components, and offers to update them. Shows changelog and breaking changes before updating.

---

## Usage

```bash
# Check for updates
/claudius-update

# Update all components
/claudius-update all

# Update specific components
/claudius-update skills
/claudius-update commands
/claudius-update agents
/claudius-update hooks

# Force update (bypass confirmations)
/claudius-update --force
```

---

## What This Command Does

1. **Fetches Latest Repository**
   - Updates ~/.claudius-skills to latest version
   - Compares with installed commit (from manifest)

2. **Identifies Changes**
   - Lists updated components
   - Shows new features
   - Highlights breaking changes
   - Displays changelog

3. **Offers Update Options**
   - Update all components
   - Selective updates
   - Skip components with breaking changes
   - Review before updating

4. **Performs Updates**
   - Backs up existing components
   - Copies updated files
   - Preserves customizations
   - Updates manifest

5. **Verifies Success**
   - Checks all files updated
   - Tests component loading
   - Shows summary

---

## Example Session

```
User: /claudius-update

Agent:
Checking for updates...

✓ Fetched latest from repository
✓ Read installation manifest

📊 Update Status:

Current version: f28b746 (installed 2025-10-15)
Latest version:  a1b2c3d (2025-11-05)

🆕 What's New:

New Features:
✓ Railway Deployment Kit (5 skills, 6 commands, 4 agents)
✓ Enhanced version-checker with breaking change detection
✓ New strict-typing hooks for TypeScript projects

Updates Available:

Skills (3):
✓ react-component-generator
  - Added React Server Components support
  - Updated for React 19 compatibility
  - Breaking: No

✓ version-checker
  - Improved API compatibility checking
  - Added breaking change detection
  - Breaking: No

✓ bundle-analyzer
  - Added webpack 5 support
  - Performance improvements
  - Breaking: No

Commands (1):
✓ /test
  - Added Vitest browser mode support
  - Breaking: No

Agents (1):
✓ code-reviewer
  - Enhanced security scanning
  - Breaking: No

Hooks (2):
✓ secret-scanning
  - Added 50+ new secret patterns
  - Breaking: No

✓ test-coverage-enforcement
  - Configurable coverage threshold
  - Breaking: No

New Components Available:
✓ Railway Deployment Kit
✓ Strict typing hooks
✓ Knowledge cutoff awareness hooks

Update Options:
1. Update all components (recommended)
2. Selective update (choose components)
3. View detailed changelog first
4. Skip this update

What would you like to do? [1/2/3/4]

User: 1

Agent:
Updating all components...

Creating backup...
✓ Backed up to .claude/.backup/2025-11-05/

Updating components...
✓ Updated react-component-generator skill
✓ Updated version-checker skill
✓ Updated bundle-analyzer skill
✓ Updated /test command
✓ Updated code-reviewer agent
✓ Updated secret-scanning hook
✓ Updated test-coverage-enforcement hook

Updating manifest...
✓ Updated .claudius-manifest.json

✅ Update complete! 🎉

Summary:
- 3 skills updated
- 1 command updated
- 1 agent updated
- 2 hooks updated
- 0 breaking changes
- Backup: .claude/.backup/2025-11-05/

New Capabilities:
- react-component-generator now supports React Server Components
- version-checker can detect breaking changes in APIs
- secret-scanning catches 50+ more secret patterns

Try them out:
"create a Server Component for user profile"
"check version of @stripe/stripe-js for breaking changes"
```

---

## Update Options

### Update All
```bash
/claudius-update all
```
Updates all installed components to latest versions.

### Update by Type
```bash
/claudius-update skills        # Update only skills
/claudius-update commands      # Update only commands
/claudius-update agents        # Update only agents
/claudius-update hooks         # Update only hooks
```

### Selective Update
```bash
/claudius-update select
```
Presents a checklist to choose specific components.

### Force Update
```bash
/claudius-update --force
```
Bypasses confirmations and updates all components immediately.

---

## Changelog Display

Shows changes since your installation:

```
📋 Changelog (f28b746...a1b2c3d)

2025-11-05 - Railway Deployment Kit
  + Added 5 new skills for Railway.app deployment
  + Added 6 deployment commands
  + Added 4 specialist agents
  * Updated documentation with Railway patterns

2025-11-02 - React 19 Support
  * Updated react-component-generator for React 19
  * Added Server Components support
  * Added use() hook patterns
  ! Breaking: Removed deprecated lifecycle methods

2025-10-28 - Security Enhancements
  * Enhanced secret-scanning with 50+ patterns
  * Added API key rotation detection
  * Improved false positive handling

2025-10-25 - Version Checker Improvements
  * Added breaking change detection
  * Improved API compatibility checking
  * Added deprecation warnings
```

Legend:
- `+` New feature
- `*` Update/enhancement
- `!` Breaking change
- `-` Removed feature

---

## Breaking Changes

If breaking changes detected:

```
⚠️  Breaking Changes Detected

react-component-generator:
  - Removed support for class components
  - Use functional components instead

  Impact: Medium
  Migration: Use the /migrate-to-functional command

  Would you like to:
  1. Skip this update
  2. Update and see migration guide
  3. Update specific components only

test-helper:
  - Changed test file naming convention
  - Now uses .test.ts instead of .spec.ts

  Impact: Low
  Migration: Rename test files or configure pattern

  Would you like to:
  1. Skip this update
  2. Update and auto-migrate files
  3. Update but keep old naming

Choose action for each component...
```

---

## Backup and Rollback

### Automatic Backup
Every update creates a timestamped backup:

```
.claude/.backup/
├── 2025-11-05/
│   ├── skills/
│   ├── commands/
│   ├── subagents/
│   └── hooks/
└── 2025-10-15/
    └── ...
```

### Rollback to Previous Version
```bash
# List available backups
"show claudius backups"

# Rollback to specific backup
"rollback claudius to 2025-10-15"

# Rollback last update
"undo last claudius update"
```

---

## Update Strategies

### Conservative (Recommended)
- Review changelog carefully
- Skip breaking changes initially
- Test updates in development branch
- Gradual rollout

### Aggressive
- Update everything immediately
- Deal with breaking changes as they come
- Stay on cutting edge
- Good for new projects

### Selective
- Update security components immediately
- Update stable components monthly
- Carefully evaluate breaking changes
- Custom update schedule

---

## Troubleshooting

### Update Fails
```
Error: Failed to update component

Solutions:
1. Check manifest file exists: .claude/.claudius-manifest.json
2. Verify repository access: cd ~/.claudius-skills && git status
3. Check for conflicts: may need manual merge
4. Restore from backup: "rollback last update"
```

### Component Not Loading After Update
```
Error: Component not loading

Solutions:
1. Verify file syntax: check for markdown errors
2. Check activation phrases are present
3. Restart Claude Code
4. Rollback if issues persist
```

### Manifest Corruption
```
Error: Cannot read manifest

Solutions:
1. Recreate manifest: /claudius-setup
2. Or restore from backup
3. Or manually fix .claudius-manifest.json
```

---

## Best Practices

1. **Update Regularly**: Check monthly for updates
2. **Review Changes**: Always review changelog before updating
3. **Test First**: Update in a dev branch before production
4. **Keep Backups**: Don't delete old backups immediately
5. **Document**: Note which customizations you have
6. **Selective**: Don't update everything if you don't use it

---

## Related Commands

- `/claudius-setup` - Initial installation
- `/claudius-info` - Show installation information
- `/claudius-rollback` - Rollback to previous version

---

**Command Version:** 1.0.0
**Repository:** https://github.com/Dexploarer/claudius-skills
