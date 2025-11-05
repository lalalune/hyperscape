# /claudius-info

Display information about your Claudius Skills installation.

**Description:**
Shows what Claudius components are installed, version information, and usage statistics.

---

## Usage

```bash
# Show full installation info
/claudius-info

# Show specific information
/claudius-info version
/claudius-info components
/claudius-info stats
```

---

## Example Output

```
User: /claudius-info

Agent:
📦 Claudius Skills Installation

Version Information:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Repository: https://github.com/Dexploarer/claudius-skills
Installation Version: 1.0.0
Repository Commit: f28b746abc...
Installed: 2025-10-15
Last Updated: 2025-11-05
Local Repository: ~/.claudius-skills

Installed Kits:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Intermediate Kit

Installed Components:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Skills (10):
  ✓ react-component-generator
  ✓ test-helper
  ✓ version-checker
  ✓ bundle-analyzer
  ✓ api-documentation-generator
  ✓ express-api-generator
  ✓ graphql-schema-generator
  ✓ database-migration-helper
  ✓ testing-framework-helper
  ✓ class-builder

Commands (15):
  ✓ /commit
  ✓ /test
  ✓ /review
  ✓ /bundle-analyze
  ✓ /api-docs-generate
  ✓ /db-backup
  ✓ /deploy
  ✓ /dependency-update
  ✓ /docker-build
  ✓ /health-check
  ✓ /migration-create
  ✓ /performance-profile
  ✓ /security-audit
  ✓ /version-bump
  ✓ /pr-creator

Agents (6):
  ✓ code-reviewer
  ✓ test-writer
  ✓ api-designer
  ✓ database-architect
  ✓ devops-engineer
  ✓ performance-optimizer

Hooks (8):
  ✓ secret-scanning
  ✓ prevent-force-push
  ✓ test-coverage-enforcement
  ✓ build-size-alert
  ✓ linting-enforcement
  ✓ env-file-protection
  ✓ dependency-vulnerability-scan
  ✓ commit-message-standards

Quick Actions:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Check for updates: /claudius-update
- View examples: "show claudius examples"
- Get recommendations: "recommend more claudius skills"
- Documentation: ~/.claudius-skills/README.md
```

---

**Command Version:** 1.0.0
