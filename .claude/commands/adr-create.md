Create an Architecture Decision Record (ADR) to document important architectural decisions.

## Instructions

When this command is run, create a comprehensive ADR following the standard format.

### Arguments

Use $ARGUMENTS for the ADR title: $ARGUMENTS

If no title is provided, prompt the user for:
1. Decision title
2. Context (why is this decision needed?)
3. Options considered
4. Decision made
5. Consequences

### ADR Format

Create a new file in `docs/adr/` or `architecture/decisions/` with the format:
- Filename: `NNNN-title-with-dashes.md` (e.g., `0001-use-microservices-architecture.md`)
- Number sequentially (0001, 0002, etc.)

### ADR Template

```markdown
# [NUMBER]. [Title]

Date: [YYYY-MM-DD]

## Status

[Proposed | Accepted | Deprecated | Superseded]

## Context

[Describe the forces at play, including technological, political, social, and project-specific. This is the "why" - why are we making this decision?]

### Current Situation
- [Current state]
- [Pain points]
- [Requirements]

### Drivers
- [Business drivers]
- [Technical drivers]
- [Team/organizational drivers]

## Decision

[Describe the decision in full sentences. Use "We will..." format]

We will [decision statement].

### Key Points
- [Key decision point 1]
- [Key decision point 2]
- [Key decision point 3]

## Alternatives Considered

### Alternative 1: [Name]
**Pros:**
- [Pro 1]
- [Pro 2]

**Cons:**
- [Con 1]
- [Con 2]

**Reason for rejection:** [Why this wasn't chosen]

### Alternative 2: [Name]
**Pros:**
- [Pro 1]

**Cons:**
- [Con 1]

**Reason for rejection:** [Why this wasn't chosen]

## Consequences

### Positive
- [Positive consequence 1]
- [Positive consequence 2]

### Negative
- [Negative consequence 1]
- [Negative consequence 2]

### Neutral
- [Neutral impact 1]

### Risks
- [Risk 1] - Mitigation: [How to address]
- [Risk 2] - Mitigation: [How to address]

## Implementation

### Action Items
- [ ] [Task 1]
- [ ] [Task 2]
- [ ] [Task 3]

### Timeline
- [Milestone 1]: [Date]
- [Milestone 2]: [Date]

### Success Metrics
- [Metric 1]: [Target]
- [Metric 2]: [Target]

## References

- [Link to related documentation]
- [Link to research/articles]
- [Related ADRs]

## Notes

[Additional context, assumptions, or constraints]
```

## What This Does

1. Checks if ADR directory exists (`docs/adr/` or `architecture/decisions/`)
2. If not, creates it
3. Finds the next ADR number by checking existing files
4. Creates a new ADR file with the template
5. Prompts user to fill in key sections
6. Can optionally create a git commit with the ADR

## Implementation Steps

```bash
# 1. Determine ADR directory
adr_dir="docs/adr"
if [ ! -d "$adr_dir" ]; then
  mkdir -p "$adr_dir"
  echo "Created ADR directory: $adr_dir"
fi

# 2. Find next number
last_number=$(ls -1 $adr_dir/*.md 2>/dev/null | sort -r | head -1 | sed -E 's/.*\/([0-9]+)-.*/\1/' || echo "0000")
next_number=$(printf "%04d" $((10#$last_number + 1)))

# 3. Create filename
title="$ARGUMENTS"
filename="${next_number}-${title// /-}.md"
filepath="$adr_dir/$filename"

# 4. Generate ADR from template
# ... (create file with template)

# 5. Notify user
echo "✅ Created ADR: $filepath"
echo "📝 Please edit and fill in the sections"
```

## Output Format

Create the ADR file and provide a summary:

```markdown
✅ Architecture Decision Record Created

**File:** docs/adr/0001-migrate-to-microservices.md
**Number:** 0001
**Title:** Migrate to Microservices

Next steps:
1. Edit the ADR and fill in all sections
2. Share with team for review
3. Update status to "Accepted" when approved
4. Commit to version control

Quick commands:
- Edit: vim docs/adr/0001-migrate-to-microservices.md
- View: cat docs/adr/0001-migrate-to-microservices.md
- List all: ls -1 docs/adr/
```

## Examples

### Example 1: Create ADR for microservices decision

**Command:**
```bash
/adr-create Migrate to Microservices Architecture
```

**Result:**
```
✅ Created docs/adr/0001-migrate-to-microservices-architecture.md

The ADR has been created with the standard template.

Please fill in these key sections:
- Context: Why are we considering this change?
- Decision: What exactly are we doing?
- Alternatives: What other options did we consider?
- Consequences: What are the impacts?

Once complete, share with team for review.
```

### Example 2: Create ADR for database choice

**Command:**
```bash
/adr-create Use PostgreSQL for Primary Database
```

**Result:**
```
✅ Created docs/adr/0002-use-postgresql-for-primary-database.md

Template includes:
- Technical context (scalability, ACID requirements)
- Alternatives considered (MySQL, MongoDB, etc.)
- Decision rationale
- Migration plan
- Performance implications
```

## Options

### Interactive Mode
If no title provided:
```
📝 Creating new ADR

Title: [user input]
Context: [user input - optional]
Status: [Proposed/Accepted] (default: Proposed)

Creating ADR...
```

### Compliance Mode
For regulated environments:
```
--compliance flag adds:
- Regulatory impact section
- Compliance checklist
- Security considerations
- Audit trail requirements
```

### Team Review Mode
```
--review flag creates:
- Draft PR with ADR
- Assigns reviewers
- Creates discussion thread
```

## Integration

### With Git
```bash
# Optionally commit the ADR
git add docs/adr/0001-*.md
git commit -m "docs: Add ADR-0001 for microservices migration"
```

### With PR Creation
```bash
# Can trigger /pr-creator command
/pr-creator "ADR-0001: Migrate to Microservices"
```

### With Team Notification
```bash
# Can notify via Slack/Teams
Notify #architecture channel about new ADR
```

## Notes

**ADR Lifecycle:**
- **Proposed** - Under discussion
- **Accepted** - Approved and in effect
- **Deprecated** - No longer recommended
- **Superseded** - Replaced by another ADR

**Best Practices:**
- Create ADR for all significant decisions
- Keep ADRs immutable (don't edit, supersede instead)
- Review ADRs quarterly
- Link ADRs to related documentation
- Include quantitative data when possible

**Common ADR Topics:**
- Architecture patterns (microservices, serverless)
- Technology choices (databases, frameworks)
- Infrastructure decisions (cloud providers, CDN)
- Security policies (authentication, encryption)
- Process changes (deployment, testing)
- API standards (REST, GraphQL, versioning)

**When to Create an ADR:**
- Technology stack decisions
- Architecture pattern changes
- Security policy changes
- Significant refactoring
- New service introduction
- Database schema changes
- API contract changes
- Deployment strategy changes
- Compliance-related changes
