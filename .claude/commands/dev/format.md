---
description: Format code with Prettier
allowed-tools: [Bash]
argument-hint: [check|write]
---

# Format Code

Format code using Prettier for consistent code style across the project.

## Usage

- `/dev/format` or `/dev/format write` - Format and save changes
- `/dev/format check` - Check formatting without making changes

## Check Formatting (No Changes)

```bash
!`cd /Users/home/hyperscape-5 && echo "=== Prettier Format Check ===" && bun x prettier --check "packages/asset-forge/**/*.{ts,tsx,js,jsx,json,css}" 2>&1 && echo -e "\n✅ All files properly formatted" || (echo -e "\n❌ Some files need formatting" && echo "Run: /dev/format write" && exit 1)`
```

## Format Code (Write Changes)

```bash
!`cd /Users/home/hyperscape-5 && echo "=== Formatting Code with Prettier ===" && bun x prettier --write "packages/asset-forge/**/*.{ts,tsx,js,jsx,json,css}" 2>&1 && echo -e "\n✅ Code formatted successfully" && echo "Review changes with: git diff"`
```

## File Types Formatted

- **TypeScript**: `*.ts`, `*.tsx`
- **JavaScript**: `*.js`, `*.jsx`
- **JSON**: `*.json`
- **CSS**: `*.css`
- **HTML**: `*.html`
- **Markdown**: `*.md`

## Formatting Rules

Prettier enforces:
- 2-space indentation
- Single quotes for strings
- Trailing commas in objects/arrays
- Semicolons at statement ends
- 80-character line width
- Consistent spacing

## Integration

Formatting runs:
- **Pre-commit**: Automatically via git hooks
- **CI/CD**: Verified in deployment pipeline
- **IDE**: Real-time with Prettier extension

## See Also

- `/dev/lint` - Code quality checks
- `/git/commit` - Commit with formatting check
- @.prettierrc - Prettier configuration
