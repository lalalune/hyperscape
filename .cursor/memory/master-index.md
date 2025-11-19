# Hyperscape Plugin - Master Index Memory

Complete master index of all rules, hooks, commands, tools, and memories for the Hyperscape plugin development.

## Quick Navigation

- [Rules](#rules) - All development rules
- [Hooks](#hooks) - All Cursor hooks
- [Commands](#commands) - All custom commands
- [Tools](#tools) - All helper tools
- [Memories](#memories) - All memory files
- [ElizaOS Documentation](#elizaos-documentation) - Complete documentation reference

## Rules

### Plugin Development Rules (20+ files)

**Core Principles**:
- `plugin-eliza-core-principles.mdc` - Core architectural principles
- `plugin-eliza-directory-structure.mdc` - Directory structure
- `plugin-eliza-config-templates.mdc` - Configuration and templates

**Components**:
- `plugin-eliza-actions.mdc` - Action implementation
- `plugin-eliza-action-patterns.mdc` - Advanced action patterns
- `plugin-eliza-providers.mdc` - Provider implementation
- `plugin-eliza-provider-patterns.mdc` - Advanced provider patterns
- `plugin-eliza-services-runtime.mdc` - Service lifecycle
- `plugin-eliza-service-managers.mdc` - Manager patterns
- `plugin-eliza-components.mdc` - Component interfaces

**Runtime**:
- `plugin-eliza-providers-runtime.mdc` - Provider runtime
- `plugin-eliza-services-runtime.mdc` - Service runtime
- `plugin-eliza-events-runtime.mdc` - Event runtime
- `plugin-eliza-messaging-runtime.mdc` - Messaging runtime (Socket.IO)

**Configuration**:
- `plugin-eliza-character-config.mdc` - Character configuration
- `plugin-eliza-memory-state.mdc` - Memory and state
- `plugin-eliza-database-schema.mdc` - Database schema
- `plugin-eliza-development.mdc` - Development workflow
- `plugin-eliza-architecture.mdc` - Plugin architecture

**Quality**:
- `plugin-eliza-error-handling.mdc` - Error handling patterns
- `plugin-eliza-logging.mdc` - Logging patterns
- `plugin-eliza-performance.mdc` - Performance optimization
- `plugin-eliza-security.mdc` - Security patterns

**Testing**:
- `plugin-eliza-systems-testing.mdc` - Systems and testing

### ElizaOS Rules (3 files)
- `elizaos-documentation.mdc` - Documentation enforcement
- `elizaos-docs-visitor.mdc` - Documentation visitor
- `elizaos-commands.mdc` - Custom commands
- `elizaos.mdc` - General ElizaOS rules

### Hyperscape Rules (5 files)
- `hyperscape-docs.mdc` - Engine documentation
- `hyperscape-plugin-eliza.mdc` - Plugin overview
- `hyperscape.mdc` - Engine rules
- `gdd.mdc` - Game Design Document
- `lore.mdc` - Game world lore

### General Rules (7 files)
- `typescript-strong-typing.mdc` - TypeScript rules
- `no-any-quick-reference.mdc` - No `any` reference
- `testing.mdc` - Testing standards
- `testing_rules.mdc` - Testing rules
- `general.mdc` - General guidelines
- `techstack.mdc` - Technology stack
- `models.mdc` - LLM models
- `packages.mdc` - Package management
- `kluster-code-verify.mdc` - Code verification

**Total Rules**: 35+ files

## Hooks

### Before Prompt Submission (5 hooks)
1. `research-reminder.sh` - Research before implementing
2. `kiss-reminder.sh` - Keep It Simple Stupid
3. `context-gatherer.sh` - Context gathering
4. `eliza-docs-hook.sh` - Eliza documentation suggestions
5. `doc-visitor-hook.sh` - Documentation visitor

### After File Edit (3 hooks)
1. `enforce-plugin-rules.sh` - Rule enforcement
2. `duplicate-checker.sh` - Code duplication detection
3. `dependency-checker.sh` - Dependency verification

### Before Read File (4 hooks)
1. `research-check.sh` - Research before reading
2. `critical-file-protection.sh` - Core file protection
3. `eliza-docs-hook.sh` - Documentation suggestions (shared)
4. `doc-visitor-hook.sh` - Documentation visitor (shared)

**Total Hooks**: 10 files

**Configuration**: `.cursor/hooks.json`

## Commands

### Custom Commands (2 commands)
1. `/elizaos-research` - Research ElizaOS patterns using Deepwiki MCP
2. `/elizaos-validate` - Validate code against ElizaOS patterns

**Documentation**:
- `elizaos-research.md` - Research command docs
- `elizaos-validate.md` - Validate command docs
- `elizaos-quick-reference.md` - Quick reference
- `README.md` - Commands overview

**Total Commands**: 6 files (2 commands + 4 docs)

## Tools

### Helper Tools (1 tool)
1. `doc-visitor.sh` - Documentation visitor tool

**Purpose**: Analyzes file paths/prompts and suggests relevant ElizaOS documentation

**Integration**: Used by hooks and commands

**Total Tools**: 1 file

## Memories

### ElizaOS Documentation (11 files)
1. `elizaos-docs-index.md` - Complete documentation index
2. `elizaos-action-patterns.md` - Action patterns reference
3. `elizaos-architecture-components.md` - Architecture reference
4. `elizaos-character-personality.md` - Character configuration
5. `elizaos-database-schema.md` - Database patterns
6. `elizaos-events.md` - Event system reference
7. `elizaos-memory-state.md` - Memory and state management
8. `elizaos-messaging.md` - Messaging system reference
9. `elizaos-providers.md` - Provider system reference
10. `elizaos-reference.md` - Complete API reference
11. `elizaos-services.md` - Service system reference

### Project Context (5 files)
1. `project-overview.md` - Complete project overview
2. `rules-index.md` - Complete rules index
3. `hooks-index.md` - Complete hooks index
4. `commands-index.md` - Complete commands index
5. `tools-index.md` - Complete tools index
6. `master-index.md` - This file

**Total Memories**: 16 files

## ElizaOS Documentation

### Complete Index
**File**: `.cursor/memory/elizaos-docs-index.md`

**Pages Indexed**: 50+ documentation pages

**Categories**:
- Getting Started
- Guides
- Projects
- Agents
- Plugins
- Runtime
- REST Reference
- CLI Reference
- Plugin Registry

**Key Pages**:
- Plugin Architecture
- Create a Plugin
- Plugin Components
- Plugin Patterns
- Database Schema
- Plugin Reference
- Character Interface
- Personality and Behavior
- Memory and State
- Providers
- Services
- Events
- Messaging

## Development Workflow

### Before Implementing
1. **Research**: Use `/elizaos-research` or check documentation
2. **Check Rules**: Review relevant rule files
3. **Check Existing**: Search codebase for similar code
4. **Documentation**: Visit relevant ElizaOS docs

### During Implementation
1. **Follow Patterns**: Use patterns from rules
2. **Error Handling**: Follow error handling patterns
3. **Logging**: Use structured logging
4. **Security**: Validate inputs, sanitize outputs

### After Implementation
1. **Validation**: Use `/elizaos-validate` to check code
2. **Testing**: Write real gameplay tests
3. **Documentation**: Update memories if needed
4. **Review**: Check hooks for violations

## Quick Reference

### Most Important Rules
1. `plugin-eliza-core-principles.mdc` - Start here
2. `plugin-eliza-actions.mdc` - For actions
3. `plugin-eliza-providers.mdc` - For providers
4. `plugin-eliza-services-runtime.mdc` - For services
5. `plugin-eliza-error-handling.mdc` - For error handling
6. `plugin-eliza-logging.mdc` - For logging
7. `plugin-eliza-performance.mdc` - For performance
8. `plugin-eliza-security.mdc` - For security

### Most Important Memories
1. `project-overview.md` - Project context
2. `elizaos-docs-index.md` - Documentation index
3. `elizaos-reference.md` - API reference
4. `rules-index.md` - Rules catalog
5. `hooks-index.md` - Hooks catalog

### Most Important Commands
1. `/elizaos-research` - Research patterns
2. `/elizaos-validate` - Validate code

### Most Important Hooks
1. `eliza-docs-hook.sh` - Documentation suggestions
2. `enforce-plugin-rules.sh` - Rule enforcement
3. `research-reminder.sh` - Research enforcement

## File Locations

### Rules
**Location**: `/Users/home/hyperscape/.cursor/rules/`
**Format**: `.mdc` files with frontmatter

### Hooks
**Location**: `/Users/home/hyperscape/.cursor/hooks/`
**Format**: `.sh` scripts (executable)
**Config**: `.cursor/hooks.json`

### Commands
**Location**: `/Users/home/hyperscape/.cursor/commands/`
**Format**: `.md` documentation + `.sh` scripts

### Tools
**Location**: `/Users/home/hyperscape/.cursor/tools/`
**Format**: `.sh` scripts (executable)

### Memories
**Location**: `/Users/home/hyperscape/.cursor/memory/`
**Format**: `.md` files

## Integration Map

```
Rules → Hooks → Commands → Tools → Memories
  ↓       ↓        ↓        ↓        ↓
Enforce  Auto    Manual   Helper  Reference
Patterns Remind  Research Analysis Context
```

## Usage Patterns

### Creating New Action
1. Check: `plugin-eliza-actions.mdc`
2. Research: `/elizaos-research action interface`
3. Check: `elizaos-action-patterns.md` memory
4. Implement: Follow patterns
5. Validate: `/elizaos-validate`
6. Test: Write real gameplay test

### Creating New Provider
1. Check: `plugin-eliza-providers.mdc`
2. Research: `/elizaos-research provider patterns`
3. Check: `elizaos-providers.md` memory
4. Implement: Follow patterns
5. Validate: `/elizaos-validate`
6. Test: Write unit test

### Creating New Service
1. Check: `plugin-eliza-services-runtime.mdc`
2. Research: `/elizaos-research service lifecycle`
3. Check: `elizaos-services.md` memory
4. Implement: Follow patterns
5. Validate: `/elizaos-validate`
6. Test: Write integration test

## Complete File Count

- **Rules**: 35+ files
- **Hooks**: 10 files
- **Commands**: 6 files
- **Tools**: 1 file
- **Memories**: 16 files
- **Config**: 1 file (hooks.json)

**Total**: 69+ files in `.cursor/` directory

## Summary

The `.cursor/` directory contains a complete development environment with:
- ✅ Comprehensive rules for all aspects of development
- ✅ Automatic hooks for rule enforcement
- ✅ Custom commands for research and validation
- ✅ Helper tools for documentation
- ✅ Complete memory files for reference
- ✅ Full integration between all components

All components work together to ensure:
- Consistent code quality
- Proper ElizaOS patterns
- Documentation compliance
- Security best practices
- Performance optimization
- Error handling standards

