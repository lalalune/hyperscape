Create a comprehensive pull request with auto-generated description, checklist, and proper formatting.

## What This Does

1. Analyzes commits since branching
2. Generates PR title and description
3. Creates checklist
4. Adds labels based on changes
5. Creates PR using GitHub CLI

## Instructions

```bash
# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
  echo "❌ GitHub CLI (gh) is not installed"
  echo "Install: brew install gh"
  exit 1
fi

# Ensure authenticated
gh auth status || gh auth login

# Get current branch and base branch
CURRENT_BRANCH=$(git branch --show-current)
BASE_BRANCH=${1:-main}

echo "📝 Creating PR from $CURRENT_BRANCH to $BASE_BRANCH..."

# Get commits
COMMITS=$(git log $BASE_BRANCH..$CURRENT_BRANCH --oneline)
NUM_COMMITS=$(echo "$COMMITS" | wc -l | tr -d ' ')

# Analyze changes
FILES_CHANGED=$(git diff $BASE_BRANCH...$CURRENT_BRANCH --name-only)
NUM_FILES=$(echo "$FILES_CHANGED" | wc -l | tr -d ' ')

# Detect change types
HAS_TESTS=$(echo "$FILES_CHANGED" | grep -c "test\|spec" || true)
HAS_DOCS=$(echo "$FILES_CHANGED" | grep -c "README\|\.md" || true)
HAS_CONFIG=$(echo "$FILES_CHANGED" | grep -c "config\|\.json\|\.yaml" || true)

# Generate PR title from branch name or first commit
if [[ $CURRENT_BRANCH =~ ^(feat|fix|chore|docs|refactor|test)/ ]]; then
  TYPE=$(echo $CURRENT_BRANCH | cut -d'/' -f1)
  TITLE=$(echo $CURRENT_BRANCH | cut -d'/' -f2- | tr '-' ' ' | sed 's/\b\(.\)/\u\1/g')
  PR_TITLE="$TYPE: $TITLE"
else
  PR_TITLE=$(git log -1 --pretty=%s)
fi

# Generate description
PR_BODY=$(cat <<EOF
## Summary

<!-- Brief description of changes -->

## Changes

$(echo "$COMMITS" | sed 's/^/- /')

## Type of Change

- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Breaking change (fix or feature causing existing functionality to change)
- [ ] Documentation update
- [ ] Refactoring
- [ ] Performance improvement

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed
- [ ] All tests passing

## Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests cover changes
- [ ] Branch is up-to-date with base branch

## Files Changed

**Total files:** $NUM_FILES
**Commits:** $NUM_COMMITS

<details>
<summary>View changed files</summary>

\`\`\`
$FILES_CHANGED
\`\`\`
</details>

## Screenshots

<!-- Add screenshots if applicable -->

## Additional Notes

<!-- Any additional context -->
EOF
)

# Create PR
gh pr create \
  --title "$PR_TITLE" \
  --body "$PR_BODY" \
  --base "$BASE_BRANCH" \
  --head "$CURRENT_BRANCH"

echo ""
echo "✅ Pull request created successfully!"
echo ""
echo "Next steps:"
echo "  • Fill in the PR description details"
echo "  • Request reviewers: gh pr edit --add-reviewer user1,user2"
echo "  • Add labels: gh pr edit --add-label bug,enhancement"
echo "  • View PR: gh pr view --web"
```

## Usage Examples

```bash
# Create PR to main
/pr-creator

# Create PR to develop
/pr-creator develop

# View created PR
gh pr view --web
```
