# Cursor Rules Index Memory

Complete index of all rules in `.cursor/rules/` with descriptions and usage.

## Plugin Development Rules

### Core Principles
- **plugin-eliza-core-principles.mdc** - Core architectural principles, service-first architecture, component registration order
- **plugin-eliza-directory-structure.mdc** - Directory structure and file organization
- **plugin-eliza-config-templates.mdc** - Configuration and templates

### Component Rules
- **plugin-eliza-actions.mdc** - Action implementation patterns
- **plugin-eliza-action-patterns.mdc** - Advanced action patterns (chaining, callbacks, composition)
- **plugin-eliza-providers.mdc** - Provider implementation patterns
- **plugin-eliza-provider-patterns.mdc** - Advanced provider patterns (conditional, aggregating)
- **plugin-eliza-services-runtime.mdc** - Service lifecycle and management
- **plugin-eliza-service-managers.mdc** - Manager implementation patterns
- **plugin-eliza-components.mdc** - Component interfaces and best practices

### Runtime Rules
- **plugin-eliza-providers-runtime.mdc** - Provider system runtime patterns
- **plugin-eliza-services-runtime.mdc** - Service system runtime patterns
- **plugin-eliza-events-runtime.mdc** - Event system runtime patterns
- **plugin-eliza-messaging-runtime.mdc** - Messaging runtime patterns (Socket.IO)

### Configuration & Development
- **plugin-eliza-character-config.mdc** - Character configuration patterns
- **plugin-eliza-memory-state.mdc** - Memory and state management patterns
- **plugin-eliza-database-schema.mdc** - Database schema patterns
- **plugin-eliza-development.mdc** - Development workflow and best practices
- **plugin-eliza-architecture.mdc** - Plugin architecture and initialization

### Quality & Patterns
- **plugin-eliza-error-handling.mdc** - Error handling patterns
- **plugin-eliza-logging.mdc** - Logging patterns and standards
- **plugin-eliza-performance.mdc** - Performance optimization patterns
- **plugin-eliza-security.mdc** - Security patterns (API keys, validation, WebSocket)

### Testing & Systems
- **plugin-eliza-systems-testing.mdc** - Systems and testing patterns

## ElizaOS Rules

### Documentation
- **elizaos-documentation.mdc** - Documentation enforcement rules
- **elizaos-docs-visitor.mdc** - Documentation visitor patterns
- **elizaos.mdc** - General ElizaOS rules

### Commands
- **elizaos-commands.mdc** - Custom command patterns (/elizaos-research, /elizaos-validate)

## Hyperscape Rules

### Engine & Game
- **hyperscape-docs.mdc** - Hyperscape engine documentation
- **hyperscape-plugin-eliza.mdc** - Plugin overview and quick reference
- **hyperscape.mdc** - Hyperscape engine rules
- **gdd.mdc** - Game Design Document (complete game specification)
- **lore.mdc** - Game world lore and regions

## General Rules

### Code Quality
- **typescript-strong-typing.mdc** - TypeScript strong typing rules
- **no-any-quick-reference.mdc** - Quick reference for avoiding `any` and `unknown`
- **testing.mdc** - Testing standards
- **testing_rules.mdc** - Testing rules
- **general.mdc** - General development guidelines

### Technology
- **techstack.mdc** - Technology stack overview
- **models.mdc** - LLM model usage patterns
- **packages.mdc** - Package management rules

### Verification
- **kluster-code-verify.mdc** - kluster code verification rules

## Rule Usage Patterns

### When Creating Actions
1. Check: `plugin-eliza-actions.mdc`
2. Check: `plugin-eliza-action-patterns.mdc`
3. Check: `plugin-eliza-error-handling.mdc`
4. Check: `plugin-eliza-logging.mdc`

### When Creating Providers
1. Check: `plugin-eliza-providers.mdc`
2. Check: `plugin-eliza-provider-patterns.mdc`
3. Check: `plugin-eliza-providers-runtime.mdc`
4. Check: `plugin-eliza-performance.mdc`

### When Creating Services
1. Check: `plugin-eliza-services-runtime.mdc`
2. Check: `plugin-eliza-service-managers.mdc`
3. Check: `plugin-eliza-error-handling.mdc`
4. Check: `plugin-eliza-security.mdc`

### When Creating Event Handlers
1. Check: `plugin-eliza-events-runtime.mdc`
2. Check: `plugin-eliza-error-handling.mdc`
3. Check: `plugin-eliza-logging.mdc`

### When Implementing Messaging
1. Check: `plugin-eliza-messaging-runtime.mdc`
2. Check: `plugin-eliza-security.mdc`
3. Check: `plugin-eliza-error-handling.mdc`

### When Configuring Character
1. Check: `plugin-eliza-character-config.mdc`
2. Check: `plugin-eliza-memory-state.mdc`
3. Check: `plugin-eliza-config-templates.mdc`

### When Working with Database
1. Check: `plugin-eliza-database-schema.mdc`
2. Check: `plugin-eliza-memory-state.mdc`

### When Testing
1. Check: `plugin-eliza-systems-testing.mdc`
2. Check: `testing.mdc`
3. Check: `testing_rules.mdc`

## Rule Enforcement

### Automatic Enforcement
- **Hooks**: Enforce rules automatically via Cursor hooks
- **After File Edit**: `enforce-plugin-rules.sh` checks for violations
- **Before Prompt**: Research and KISS reminders

### Manual Reference
- **Rules Directory**: `.cursor/rules/` contains all rules
- **Memory Files**: `.cursor/memory/` contains detailed references
- **Documentation**: Rules reference ElizaOS documentation

## Rule Categories

### Architecture Rules
- Core principles, directory structure, architecture patterns

### Component Rules
- Actions, Providers, Services, Evaluators, Components

### Runtime Rules
- Providers runtime, Services runtime, Events runtime, Messaging runtime

### Quality Rules
- Error handling, Logging, Performance, Security

### Development Rules
- Development workflow, Testing, Configuration

### Documentation Rules
- ElizaOS documentation, Documentation visitor

## Quick Reference

### Most Important Rules
1. **plugin-eliza-core-principles.mdc** - Start here for architecture
2. **plugin-eliza-actions.mdc** - For action implementation
3. **plugin-eliza-providers.mdc** - For provider implementation
4. **plugin-eliza-services-runtime.mdc** - For service implementation
5. **plugin-eliza-error-handling.mdc** - For error handling
6. **plugin-eliza-logging.mdc** - For logging
7. **plugin-eliza-performance.mdc** - For performance
8. **plugin-eliza-security.mdc** - For security

### ElizaOS Integration
- **elizaos-documentation.mdc** - Documentation enforcement
- **elizaos-commands.mdc** - Custom commands
- **elizaos-docs-visitor.mdc** - Documentation visitor

### Hyperscape Integration
- **hyperscape-docs.mdc** - Engine documentation
- **hyperscape-plugin-eliza.mdc** - Plugin overview
- **gdd.mdc** - Game design

## Rule File Locations

All rules are in: `/Users/home/hyperscape/.cursor/rules/`

Rule files use `.mdc` extension and follow Cursor's rule format:
- Frontmatter with `description`, `globs`, `alwaysApply`
- Markdown content with code examples
- Rules marked with ✅ (required) and ❌ (forbidden)

