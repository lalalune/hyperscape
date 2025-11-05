# /claudius-setup

Interactive setup wizard for installing Claudius Skills configurations.

**Description:**
Analyzes your project and guides you through installing the appropriate Claude Code configurations from the Claudius Skills repository. This command provides recommendations based on your project type, frameworks, and complexity.

---

## Usage

```bash
/claudius-setup
```

## What This Command Does

1. **Ensures Repository Access**
   - Clones claudius-skills repository to ~/.claudius-skills if not present
   - Updates repository if already exists
   - Verifies git connectivity

2. **Analyzes Your Project**
   - Detects project type (frontend, backend, fullstack, etc.)
   - Identifies frameworks and their versions
   - Assesses project complexity
   - Checks existing .claude configuration

3. **Provides Recommendations**
   - Suggests appropriate kit (starter/intermediate/advanced)
   - Recommends specific skills for detected frameworks
   - Proposes useful commands for your workflow
   - Identifies helpful agents for your domain
   - Suggests security and quality hooks

4. **Guides Installation**
   - Presents clear options (full kit vs. custom selection)
   - Handles conflicts with existing configurations
   - Creates installation manifest
   - Verifies successful installation

5. **Provides Quick Start**
   - Shows examples of installed capabilities
   - Explains how to use new skills, commands, and agents
   - Links to relevant documentation

---

## Example Session

```
User: /claudius-setup

Agent:
Initializing Claudius Skills setup...

Step 1: Checking repository access...
✓ Repository found at ~/.claudius-skills
✓ Updated to latest version (commit: f28b746)

Step 2: Analyzing your project...
✓ Detected React 18.2 with TypeScript
✓ Build tool: Vite 4.5
✓ Testing: Vitest + React Testing Library
✓ Project type: Frontend SPA
✓ Complexity: Intermediate
✓ Existing .claude: None

Step 3: Recommendations based on analysis...

📦 Recommended Kit: Intermediate Kit
Includes:
- 10 framework-specific skills
- 15 workflow commands
- 6 specialist agents
- Recommended hooks

🎯 Specific Recommendations:

Skills:
  ✓ react-component-generator - Modern React components with TypeScript
  ✓ test-helper - Comprehensive test writing for Vitest
  ✓ version-checker - Verify package versions and API compatibility
  ✓ bundle-analyzer - Analyze and optimize bundle size
  ✓ api-documentation-generator - Generate API docs

Commands:
  ✓ /commit - Smart git commits with conventional messages
  ✓ /test - Run tests with coverage reporting
  ✓ /review - Comprehensive code review
  ✓ /bundle-analyze - Analyze bundle size and imports
  ✓ /refactor - Intelligent refactoring

Agents:
  ✓ code-reviewer - Expert code review consultant
  ✓ test-writer - Test generation specialist
  ✓ performance-optimizer - Performance tuning expert

Hooks:
  ✓ secret-scanning - Prevent committing secrets
  ✓ test-coverage-enforcement - Enforce 80% coverage
  ✓ build-size-alert - Monitor bundle size increases
  ✓ prevent-force-push - Block force pushes to main/master

Installation Options:
1. Install complete Intermediate Kit (recommended)
2. Custom selection (choose specific components)
3. Show me more details first
4. Cancel

What would you like to do? [1/2/3/4]

User: 1

Agent:
Installing Intermediate Kit...

✓ Created .claude directory structure
✓ Copied 10 skills
✓ Copied 15 commands
✓ Copied 6 agents
✓ Copied 8 hooks
✓ Copied React framework rules
✓ Created .claudius-manifest.json

✅ Installation complete! 🎉

Quick Start Guide:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Try these examples:

1. Generate a React component:
   "create a Button component with TypeScript"
   → Uses react-component-generator skill

2. Write comprehensive tests:
   "write tests for the Button component"
   → Uses test-helper skill

3. Run code review:
   /review
   → Activates code-reviewer agent

4. Analyze bundle size:
   /bundle-analyze
   → Runs bundle analysis command

5. Check package versions:
   "check version of react"
   → Uses version-checker skill

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Security Features Enabled:
- Secret scanning before commits
- Test coverage enforcement (80% minimum)
- Bundle size monitoring
- Force push prevention

Need help? Say:
- "show me my claudius setup" - See installed components
- "claudius examples" - View usage examples
- "update claudius" - Check for updates

Documentation: ~/.claudius-skills/README.md
```

---

## Options and Flags

While this is an interactive command, you can provide hints:

```bash
# Quick install recommended configuration
/claudius-setup auto

# Custom installation
/claudius-setup custom

# Show recommendations only (no install)
/claudius-setup dry-run

# Install specific kit
/claudius-setup kit=intermediate

# Install minimal setup
/claudius-setup minimal
```

---

## Prerequisites

- Git installed and configured
- Internet connection (for initial clone)
- Write access to project directory

---

## Troubleshooting

### Repository Clone Fails
```
Error: Failed to clone repository

Solutions:
1. Check internet connection
2. Verify git is installed: git --version
3. Try manual clone: git clone https://github.com/Dexploarer/claudius-skills.git ~/.claudius-skills
4. Check firewall/proxy settings
```

### Permission Errors
```
Error: Permission denied writing to .claude/

Solutions:
1. Check directory permissions: ls -la .
2. Ensure you own the directory: sudo chown -R $USER .
3. Try with appropriate permissions: chmod u+w .claude/
```

### Conflicts Detected
```
Warning: Existing .claude configuration found

Options:
1. Merge with existing (recommended)
2. Backup existing and replace
3. Install to alternate location
4. Cancel installation
```

---

## Advanced Usage

### Team Setup
Install same configuration across multiple projects:

```bash
# In first project
/claudius-setup
# ... complete setup ...

# Export configuration
"export my claudius setup for team"

# In other projects, use the exported configuration
"install claudius from team-config.json"
```

### Custom Repository
Use a fork or custom repository:

```bash
# Configure custom repository
"set claudius repository to https://github.com/my-org/custom-skills.git"

# Then run setup
/claudius-setup
```

### Offline Installation
If you have the repository locally:

```bash
# Point to local repository
"use local claudius repository at /path/to/claudius-skills"

# Run setup
/claudius-setup
```

---

## What Gets Installed

### Directory Structure Created
```
.claude/
├── skills/                 # Automatic context-aware capabilities
├── commands/               # Manual workflow shortcuts
├── subagents/              # Specialized AI consultants
├── hooks/                  # Event-driven automation
├── rules/                  # Framework and project rules
└── .claudius-manifest.json # Installation tracking
```

### Manifest File
Tracks what was installed and when:
```json
{
  "version": "1.0.0",
  "installedAt": "2025-11-05T00:00:00Z",
  "lastUpdated": "2025-11-05T00:00:00Z",
  "repositoryCommit": "f28b746...",
  "components": {
    "kits": ["intermediate-kit"],
    "skills": [...],
    "commands": [...],
    "agents": [...],
    "hooks": [...]
  }
}
```

---

## After Installation

### Verify Installation
```bash
# Check installed components
ls -la .claude/

# View manifest
cat .claude/.claudius-manifest.json

# Test a skill
"create a test component"

# Test a command
/review
```

### Update Components
```bash
# Check for updates
"check for claudius updates"

# Update all components
"update claudius components"

# Selective update
"update only claudius skills"
```

### Manage Installation
```bash
# View installed components
"show my claudius setup"

# Remove specific component
"remove [component-name] from claudius"

# Uninstall completely
"uninstall claudius configuration"
```

---

## Related Commands

- `/claudius-install <kit>` - Direct installation without wizard
- `/claudius-update` - Check for and install updates
- `/claudius-recommend` - Get recommendations without installing
- `/claudius-info` - Show repository and installation info

---

## Best Practices

1. **Start Fresh**: Best used on new projects or projects without existing .claude config
2. **Review Recommendations**: Take time to understand what's being installed
3. **Security First**: Always enable security hooks (secret-scanning, prevent-force-push)
4. **Keep Updated**: Run updates monthly to get new features and fixes
5. **Customize Later**: Start with recommended setup, customize over time

---

**Command Version:** 1.0.0
**Repository:** https://github.com/Dexploarer/claudius-skills
**Documentation:** ~/.claudius-skills/README.md
