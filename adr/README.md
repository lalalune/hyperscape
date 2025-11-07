# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records for the Hyperscape project. ADRs document important architectural and technical decisions, including the context, alternatives considered, and consequences.

## What is an ADR?

An Architecture Decision Record (ADR) is a document that captures an important architectural decision made along with its context and consequences. ADRs help teams:

- Understand why decisions were made
- Onboard new team members efficiently
- Avoid revisiting settled decisions
- Learn from past choices
- Document architectural evolution

## ADR Index

### Infrastructure & Tooling

| ADR | Title | Status | Date | Summary |
|-----|-------|--------|------|---------|
| [0001](0001-use-bun-as-primary-package-manager.md) | Use Bun as Primary Package Manager | Accepted | 2025-11-06 | Adopt Bun 1.1.38+ for 10x faster dependency installation and improved developer experience |
| [0002](0002-adopt-turbo-for-monorepo-build-orchestration.md) | Adopt Turbo for Monorepo Build Orchestration | Accepted | 2025-11-06 | Use Turborepo for intelligent build caching, parallel execution, and dependency-aware builds |
| [0003](0003-migrate-from-docker-to-railpack-for-railway-deployment.md) | Migrate from Docker to RAILPACK | Accepted | 2025-11-06 | Switch to Railway's RAILPACK builder for simpler configuration and better monorepo support |

### Data & Persistence

| ADR | Title | Status | Date | Summary |
|-----|-------|--------|------|---------|
| [0004](0004-use-postgresql-for-primary-database.md) | Use PostgreSQL for Primary Database | Accepted | 2025-11-06 | Adopt PostgreSQL with Drizzle ORM for ACID transactions, relational integrity, and type safety |

### Application Architecture

| ADR | Title | Status | Date | Summary |
|-----|-------|--------|------|---------|
| [0005](0005-adopt-elizaos-for-ai-agent-framework.md) | Adopt ElizaOS for AI Agent Framework | Accepted | 2025-11-06 | Use ElizaOS for intelligent NPCs and autonomous agents with memory, actions, and multi-LLM support |
| [0006](0006-enforce-typescript-strict-typing-standards.md) | Enforce TypeScript Strict Typing Standards | Accepted | 2025-11-06 | Prohibit `any` types and enforce strict typing for compile-time safety and better developer experience |
| [0008](0008-adopt-privy-hd-wallets-for-user-wallet-management.md) | Adopt Privy HD Wallets for User Wallet Management | Accepted | 2025-11-06 | Hierarchical architecture: main account wallet (HD-0) funds character wallets (HD-1+), auto-create ETH+SOL, external wallet support |
| [0009](0009-semi-automated-asset-approval-workflow.md) | Semi-Automated Asset Approval Workflow | Accepted | 2025-11-06 | Implement admin-gated approval process with automated export to deployable CDN for Asset Forge |
| [0010](0010-meshy-ai-api-integration.md) | Meshy.ai API Integration for 3D Asset Generation | Accepted | 2025-11-07 | Adopt Meshy.ai as exclusive 3D generation API for image-to-3D, retexturing, and auto-rigging workflows |
| [0011](0011-vrm-avatar-system-architecture.md) | VRM Avatar System Architecture | Accepted | 2025-11-07 | Adopt VRM 1.0 as standard avatar format with complete Meshy GLB → VRM conversion and Mixamo animation retargeting |

### Quality & Testing

| ADR | Title | Status | Date | Summary |
|-----|-------|--------|------|---------|
| [0007](0007-real-gameplay-testing-with-playwright.md) | Real Gameplay Testing with Playwright | Accepted | 2025-11-06 | Use Playwright for real browser testing with no mocks, validating both data and visual rendering |

## ADR Lifecycle

ADRs can have the following statuses:

- **Proposed** - Under discussion, not yet approved
- **Accepted** - Approved and currently in effect
- **Deprecated** - No longer recommended, but not yet replaced
- **Superseded** - Replaced by a newer ADR (linked)

## Creating New ADRs

To create a new ADR, use the `/adr-create` command:

```bash
/adr-create Title of Your Decision
```

Or manually create a file following this format:
- Filename: `NNNN-title-with-dashes.md` (e.g., `0012-use-graphql-for-api.md`)
- Number sequentially (next number is 0012)
- Use the template from `/adr-create` command

## ADR Template Structure

Each ADR should include:

1. **Title** - Clear, descriptive decision statement
2. **Date** - When the decision was made
3. **Status** - Proposed, Accepted, Deprecated, or Superseded
4. **Context** - Current situation, pain points, and requirements
5. **Decision** - What we decided to do
6. **Alternatives Considered** - Other options evaluated and why they were rejected
7. **Consequences** - Positive, negative, and neutral impacts
8. **Implementation** - Action items, timeline, and success metrics
9. **References** - Links to documentation, commits, related ADRs
10. **Notes** - Additional context and insights

## Key Decisions Summary

### Core Technology Stack
- **Runtime**: Bun 1.1.38+ (ADR-0001)
- **Build System**: Turborepo 2.5.5+ (ADR-0002)
- **Deployment**: Railway with RAILPACK (ADR-0003)
- **Database**: PostgreSQL with Drizzle ORM (ADR-0004)
- **AI Framework**: ElizaOS (ADR-0005)
- **Language**: TypeScript with strict typing (ADR-0006)
- **Testing**: Playwright for real gameplay testing (ADR-0007)
- **Wallet Management**: Privy HD Wallets (ADR-0008)
- **3D Asset Generation**: Meshy.ai API (ADR-0010)

### Architecture Principles
1. **No mocks** - Real testing with actual systems
2. **Strict typing** - No `any` types allowed
3. **Monorepo** - All packages in single repository
4. **Type safety** - Compile-time error detection
5. **Real scenarios** - Test actual gameplay flows

### Development Standards
- All features must have Playwright tests
- All tests must pass before merging
- No `any` or `unknown` types in production code
- Shared types from @hyperscape/shared
- Build orchestration via Turbo
- Package management via Bun

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Project development guidelines and standards
- [README.md](../README.md) - Main project documentation
- [packages/*/README.md](../packages/) - Package-specific documentation

## Questions or Feedback

If you have questions about an ADR or want to propose changes:

1. **Proposing a new decision** - Use `/adr-create` to start a new ADR
2. **Challenging a decision** - Create a new ADR that supersedes the old one
3. **Clarifying a decision** - Update the Notes section of existing ADR
4. **Deprecating a decision** - Change status to Deprecated and document why

ADRs are living documents. They should be updated as understanding evolves, but the core decision and reasoning should remain for historical reference.

---

**Last Updated**: 2025-11-07
**Total ADRs**: 11
**Active ADRs**: 11
