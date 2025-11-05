# Claudius Installer Skill

**Activation phrases:**
- "install claudius skills"
- "setup claudius configuration"
- "configure my .claude from claudius"
- "install [kit-name] from claudius"
- "recommend claudius setup for my project"

**Description:**
Automatically installs and configures Claude Code extensions from the Claudius Skills repository. This skill can analyze your project, recommend appropriate kits, and install skills, commands, agents, and hooks tailored to your needs.

---

## What This Skill Does

1. **Analyzes Your Project**
   - Detects frameworks (React, Vue, Django, Express, etc.)
   - Identifies project type (frontend, backend, fullstack, mobile, etc.)
   - Checks existing dependencies and configuration
   - Determines appropriate skill level (starter, intermediate, advanced)

2. **Recommends Configuration**
   - Suggests relevant kits based on project analysis
   - Recommends specific skills for detected frameworks
   - Proposes useful commands for your workflow
   - Identifies helpful agents for your domain

3. **Installs Configuration**
   - Clones/updates the claudius-skills repository
   - Copies selected skills, commands, agents, and hooks
   - Updates `.claude` directory structure
   - Preserves existing configurations (no overwrites without confirmation)

4. **Manages Updates**
   - Checks for updates to installed components
   - Shows what's new in the repository
   - Allows selective updates
   - Maintains version tracking

---

## Usage Examples

### Interactive Setup (Recommended)
```
User: "Setup claudius for my project"

Agent will:
1. Analyze your project structure
2. Show recommendations
3. Ask for confirmation
4. Install selected components
5. Provide usage instructions
```

### Specific Kit Installation
```
User: "Install the intermediate kit from claudius"

Agent will install the complete intermediate kit:
- 10 framework-specific skills
- 15 workflow commands
- 6 specialist agents
- Relevant hooks
```

### Targeted Installation
```
User: "I need React and testing skills from claudius"

Agent will install:
- react-component-generator skill
- test-helper skill
- test-writer agent
- /test command
- Relevant hooks
```

### Update Existing Installation
```
User: "Update my claudius skills to latest version"

Agent will:
1. Check claudius-skills repository for updates
2. Compare installed versions
3. Show what's changed
4. Offer to update components
```

---

## Installation Methods

### Method 1: Direct Clone (Recommended)
Clones the full repository to a local directory for fast access:

```bash
# Repository cloned to: ~/.claudius-skills/
# All kits and components available locally
```

### Method 2: GitHub API
Fetches individual files on-demand via GitHub API:

```bash
# No local clone required
# Slower but no disk space usage
# Requires internet connection
```

### Method 3: Git Submodule
Adds claudius-skills as a git submodule:

```bash
# Repository linked to your project
# Version controlled
# Easy to update
```

---

## Configuration Files

### Repository Location
Default: `~/.claudius-skills/`

Can be customized via:
```json
{
  "claudius": {
    "repositoryPath": "/custom/path/to/claudius-skills",
    "repositoryUrl": "https://github.com/Dexploarer/claudius-skills.git",
    "autoUpdate": true,
    "updateCheckInterval": "7d"
  }
}
```

### Installed Components Tracking
Location: `.claude/.claudius-manifest.json`

```json
{
  "version": "1.0.0",
  "installedAt": "2025-11-05T00:00:00Z",
  "lastUpdated": "2025-11-05T00:00:00Z",
  "repositoryCommit": "f28b746...",
  "components": {
    "kits": ["intermediate-kit"],
    "skills": [
      "react-component-generator",
      "test-helper",
      "version-checker"
    ],
    "commands": [
      "/commit",
      "/test",
      "/review"
    ],
    "agents": [
      "code-reviewer",
      "test-writer"
    ],
    "hooks": [
      "prevent-force-push",
      "secret-scanning"
    ]
  }
}
```

---

## Implementation Steps

### Step 1: Ensure Repository Access
```bash
# Check if repository exists locally
if [ ! -d ~/.claudius-skills ]; then
  git clone https://github.com/Dexploarer/claudius-skills.git ~/.claudius-skills
else
  cd ~/.claudius-skills && git pull origin main
fi
```

### Step 2: Analyze Current Project
```bash
# Detect package.json, requirements.txt, etc.
# Identify frameworks from dependencies
# Check existing .claude directory
# Determine project complexity
```

### Step 3: Generate Recommendations
```typescript
interface ProjectAnalysis {
  type: 'frontend' | 'backend' | 'fullstack' | 'mobile' | 'cli' | 'library';
  frameworks: string[];
  languages: string[];
  complexity: 'starter' | 'intermediate' | 'advanced' | 'enterprise';
  recommendations: {
    kits: string[];
    skills: string[];
    commands: string[];
    agents: string[];
    hooks: string[];
  };
}
```

### Step 4: Install Selected Components
```bash
# Copy skills
cp -r ~/.claudius-skills/[kit]/.claude/skills/* ./.claude/skills/

# Copy commands
cp -r ~/.claudius-skills/[kit]/.claude/commands/* ./.claude/commands/

# Copy agents
cp -r ~/.claudius-skills/[kit]/.claude/subagents/* ./.claude/subagents/

# Copy hooks
cp -r ~/.claudius-skills/[kit]/.claude/hooks/* ./.claude/hooks/

# Copy rules
cp -r ~/.claudius-skills/[kit]/.claude/rules/* ./.claude/rules/
```

### Step 5: Update Manifest
```bash
# Create/update .claude/.claudius-manifest.json
# Record installed components
# Save installation metadata
```

### Step 6: Verify Installation
```bash
# Check all files copied successfully
# Verify no conflicts with existing configs
# Test that Claude can load new components
```

---

## Project Detection Rules

### Frontend Projects
**Detection:**
- `package.json` with React, Vue, Angular, Svelte
- Presence of `src/components/`
- Frontend build tools (Vite, Webpack, Parcel)

**Recommendations:**
- Intermediate Kit (React/Vue/Svelte skills)
- Frontend-specific commands (`/bundle-analyze`, `/lighthouse-ci`)
- Performance hooks (`build-size-alert`)

### Backend Projects
**Detection:**
- `package.json` with Express, Fastify, Nest
- `requirements.txt` with Django, Flask, FastAPI
- API directories (`routes/`, `controllers/`, `api/`)

**Recommendations:**
- Intermediate Kit (API generation skills)
- Backend commands (`/api-docs-generate`, `/db-backup`)
- Security hooks (`secret-scanning`, `cors-configuration-check`)

### Full Stack Projects
**Detection:**
- Both frontend and backend indicators
- Next.js, Nuxt, Remix, SvelteKit

**Recommendations:**
- Intermediate Kit (full-stack skills)
- Both frontend and backend commands
- Comprehensive hook suite

### Enterprise Projects
**Detection:**
- Microservices architecture
- Kubernetes/Docker configs
- CI/CD pipelines
- Multiple services

**Recommendations:**
- Advanced Kit (enterprise skills)
- DevOps commands (`/canary-deploy`, `/rollback-emergency`)
- Production hooks (compliance, monitoring)

### ElizaOS Projects
**Detection:**
- `package.json` with `@ai16z/eliza`
- `characters/` directory
- ElizaOS configuration files

**Recommendations:**
- Eliza OS Kit
- ElizaOS-specific commands (`/dev-agent`, `/test-character`)
- ElizaOS specialist agents

---

## Conflict Resolution

### Existing Skills
If user already has skills with same name:
1. Show diff between existing and new
2. Ask user which to keep
3. Option to rename and keep both
4. Option to merge (if compatible)

### Existing Commands
If command already exists:
1. Preserve existing by default
2. Offer to view new version
3. Allow manual merge

### Existing Hooks
If hook exists:
1. Check if it's compatible
2. Offer to merge trigger conditions
3. Preserve user customizations

---

## Update Management

### Check for Updates
```bash
# Fetch latest from repository
cd ~/.claudius-skills && git fetch origin

# Compare installed commit with latest
INSTALLED_COMMIT=$(cat .claude/.claudius-manifest.json | jq -r '.repositoryCommit')
LATEST_COMMIT=$(cd ~/.claudius-skills && git rev-parse origin/main)

# Show what's changed
cd ~/.claudius-skills && git log $INSTALLED_COMMIT..$LATEST_COMMIT --oneline
```

### Selective Updates
```typescript
interface UpdateOptions {
  updateAll: boolean;
  updateKits: string[];
  updateSkills: string[];
  updateCommands: string[];
  updateAgents: string[];
  updateHooks: string[];
  preserveCustomizations: boolean;
}
```

---

## Advanced Features

### Custom Kit Creation
```
User: "Create a custom kit with React, testing, and security skills"

Agent will:
1. Cherry-pick requested components
2. Create custom kit structure
3. Install to .claude/
4. Document custom configuration
```

### Multi-Project Setup
```
User: "Setup claudius for all my projects in ~/workspace"

Agent will:
1. Scan all directories for projects
2. Analyze each project independently
3. Generate per-project recommendations
4. Batch install configurations
```

### Team Sharing
```
User: "Export my claudius setup for my team"

Agent will:
1. Package current configuration
2. Include manifest and customizations
3. Create shareable archive
4. Generate installation instructions
```

---

## Troubleshooting

### Repository Not Found
```bash
# Verify git is installed
git --version

# Check network connectivity
ping github.com

# Try manual clone
git clone https://github.com/Dexploarer/claudius-skills.git ~/.claudius-skills
```

### Permission Errors
```bash
# Ensure write access to .claude directory
chmod -R u+w .claude/

# Check ownership
ls -la .claude/
```

### Conflicts During Installation
```bash
# Backup existing .claude directory
cp -r .claude .claude.backup

# Try installation again
# If issues persist, restore backup
mv .claude.backup .claude
```

### Components Not Loading
```bash
# Verify file structure
ls -R .claude/

# Check for syntax errors in markdown
# Ensure proper frontmatter format
# Verify activation phrases are clear
```

---

## Integration with Other Tools

### VS Code Integration
```json
{
  "tasks": [
    {
      "label": "Update Claudius Skills",
      "type": "shell",
      "command": "cd ~/.claudius-skills && git pull"
    }
  ]
}
```

### Git Hooks
```bash
# .git/hooks/post-merge
#!/bin/bash
echo "Checking for claudius-skills updates..."
claude "check for claudius updates"
```

### CI/CD
```yaml
# .github/workflows/update-claude-config.yml
name: Update Claude Configuration
on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly
jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Update Claudius Skills
        run: |
          git submodule update --remote claudius-skills
          # Run update command
```

---

## Best Practices

### Initial Setup
1. Start with the recommended kit for your project type
2. Install core skills first (version-checker, class-builder)
3. Add framework-specific skills as needed
4. Enable security hooks from the start

### Ongoing Maintenance
1. Check for updates monthly
2. Review new skills/commands quarterly
3. Remove unused components to keep .claude clean
4. Share useful custom configurations with team

### Performance Optimization
1. Don't install all kits at once (choose what you need)
2. Remove skills you don't use
3. Keep repository local for faster access
4. Use selective updates instead of full reinstalls

---

## Security Considerations

### Repository Verification
```bash
# Verify repository authenticity
cd ~/.claudius-skills
git remote -v
# Should show: https://github.com/Dexploarer/claudius-skills.git

# Verify commit signatures (if available)
git verify-commit HEAD
```

### Safe Installation
- Always review components before installation
- Check for suspicious code in skills/commands
- Verify hooks don't have unintended side effects
- Backup existing configuration before updates

### Access Control
```bash
# Restrict write access to .claude directory
chmod 755 .claude/
chmod 644 .claude/**/*

# Prevent accidental modifications
# (Claude can still read and use configurations)
```

---

## Example Session

```
User: "Setup claudius for my React project"

Claude (via claudius-installer skill):
> Analyzing your project...
>
> Detected:
> - Framework: React 18.2 with TypeScript
> - Build Tool: Vite 4.x
> - Testing: Vitest + React Testing Library
> - Project Type: Frontend SPA
>
> Recommended Setup:
> ✓ Intermediate Kit (React + Testing skills)
> ✓ Skills: react-component-generator, test-helper, version-checker
> ✓ Commands: /test, /review, /commit, /bundle-analyze
> ✓ Agents: code-reviewer, test-writer
> ✓ Hooks: test-coverage-enforcement, build-size-alert, secret-scanning
>
> Would you like me to install this configuration? (yes/no/customize)

User: "yes"

Claude:
> Installing claudius configuration...
> ✓ Cloned repository to ~/.claudius-skills
> ✓ Copied 5 skills
> ✓ Copied 8 commands
> ✓ Copied 3 agents
> ✓ Copied 4 hooks
> ✓ Copied React framework rules
> ✓ Created .claudius-manifest.json
>
> Installation complete! 🎉
>
> Try these commands:
> - "generate a Button component" (uses react-component-generator)
> - "write tests for this component" (uses test-helper)
> - "/review" (runs code review)
>
> Run "show me my claudius setup" anytime to see installed components.
```

---

## API Reference

### Project Analysis
```typescript
analyzeProject(rootPath: string): ProjectAnalysis

interface ProjectAnalysis {
  rootPath: string;
  projectType: ProjectType;
  frameworks: Framework[];
  languages: Language[];
  complexity: ComplexityLevel;
  existingClaudeConfig: boolean;
  recommendations: Recommendations;
}
```

### Installation
```typescript
installComponents(
  components: ComponentSelection,
  options?: InstallOptions
): InstallResult

interface ComponentSelection {
  kits?: string[];
  skills?: string[];
  commands?: string[];
  agents?: string[];
  hooks?: string[];
}

interface InstallOptions {
  overwrite?: boolean;
  backup?: boolean;
  merge?: boolean;
  preserveCustomizations?: boolean;
}
```

### Updates
```typescript
checkForUpdates(): UpdateInfo
updateComponents(selection: UpdateSelection): UpdateResult

interface UpdateInfo {
  hasUpdates: boolean;
  updatedComponents: ComponentUpdate[];
  breaking: boolean;
  changesSummary: string;
}
```

---

## Version History

### v1.0.0 (Current)
- Initial release
- Full kit installation support
- Project analysis and recommendations
- Update management
- Conflict resolution

### Roadmap
- v1.1.0: Team sharing and export features
- v1.2.0: Custom kit builder UI
- v1.3.0: Multi-project batch setup
- v2.0.0: Web-based configuration manager

---

**Last Updated:** 2025-11-05
**Maintained by:** Claudius Skills Project
**Repository:** https://github.com/Dexploarer/claudius-skills
