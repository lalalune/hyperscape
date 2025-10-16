# CLAUDE.md - Cursor Rules Documentation

This document provides a comprehensive overview of all Cursor rules and their locations within the Hyperscape project. These rules guide development practices, coding standards, and project architecture.

## 📁 Directory Structure

```
/Users/home/dev/hyperscape/
├── .cursor/
│   ├── rules/                    # Cursor Rules (TO BE CREATED)
│   ├── workflows/                # Development Workflows (TO BE CREATED)
│   └── memory/                   # Memory Bank (TO BE CREATED)
├── adr/                         # Architectural Decision Records (TO BE CREATED)
└── CLAUDE.md                    # This file
```

## 🎯 Required Cursor Rules Directory Structure

### `.cursor/rules/` - Development Rules

The following rule files should be created in `.cursor/rules/`:

#### 1. **coding-standards.mdc**
```markdown
---
alwaysApply: true
globs: *.ts,*.tsx,*.js,*.jsx
---
# TypeScript Strong Typing Rules

## Core Principles
- NO `any` or `unknown` types
- Prefer classes over interfaces for type definitions
- Share types across modules from types/core.ts
- Avoid property checks on polymorphic objects
- Make strong type assumptions based on context

## Required Patterns
- Use non-null assertions: `value!`
- Define return types explicitly on public methods
- Use discriminated unions for variant types
- Import types with `import type { TypeName }`

## Forbidden Patterns
- `as any` - NEVER use this
- Property existence checks like `'property' in object`
- Optional chaining for type narrowing
```

#### 2. **architecture-patterns.mdc**
```markdown
---
alwaysApply: true
description: Hyperscape architecture and development patterns
---
# Hyperscape Architecture Patterns

## Tech Stack
- Hyperscape (packages/hypefy) - 3D multiplayer game engine
- ElizaOS - AI agent framework with plugin-hyperscape
- Three.js - 3D graphics library
- Playwright - Browser automation for testing
- SQLite - Persistence layer

## Core Principles
- Always make features self-contained and modular
- Build toward the general case, not specific examples
- Separate data from logic - no hardcoded data
- Use existing Hyperscape systems instead of new abstractions
- Keep RPG isolated from Hyperscape core as standalone .hyp app

## File Organization
- Define types in types.ts files
- Use existing types before creating new ones
- Make packages self-contained with workspace imports
- Avoid circular dependencies
```

#### 3. **testing-standards.mdc**
```markdown
---
alwaysApply: true
description: Testing methodologies and requirements
---
# Real Testing Standards

## Core Principles
- NO mocks, spies, or test framework abstractions
- Build mini-worlds for each feature test
- Use real Hyperscape instances with Playwright
- Test multimodal verification (data + visual)

## Testing Methods
1. **Three.js Testing** - Check scene hierarchy and positions
2. **Visual Testing** - Screenshot analysis with colored cube proxies
3. **System Integration** - ECS systems and data introspection
4. **LLM Verification** - GPT-4o for image analysis when needed

## Visual Testing Proxies
- 🔴 Players
- 🟢 Goblins  
- 🔵 Items
- 🟡 Trees
- 🟣 Banks
- 🟨 Stores

## Requirements
- Every feature MUST have tests
- All tests MUST pass before moving on
- Use real gameplay, real objects, real data
- Save error logs to /logs folder
```

#### 4. **development-workflow.mdc**
```markdown
---
alwaysApply: true
description: Development workflow and file management
---
# Development Workflow Rules

## File Management
- NEVER create new files unless absolutely necessary
- Revise existing files instead of creating _v2.ts
- Delete old files completely when replacing
- Update all imports in dependent files
- Clean up orphaned files immediately

## Code Quality
- Write production code only - no examples or shortcuts
- Implement complete functionality, no TODOs
- Don't work around problems - fix root causes
- Research Hyperscape systems before creating new ones

## Environment Setup
- Use environment variables in .env with dotenv
- Keep Hyperscape isolated from RPG code
- Make each package self-contained and modular
- Use workspace imports for package communication
```

#### 5. **security-protocols.mdc**
```markdown
---
alwaysApply: true
description: Security requirements and practices
---
# Security Protocols

## API Keys and Credentials
- Store API keys in root .env file
- Use dotenv package for environment variable access
- Never hardcode credentials in source code
- Document all required API keys and credentials

## Data Protection
- All authentication handled by Privy (industry-standard)
- JWT tokens for secure session management
- No passwords stored on Hyperscape servers
- Automatic session refresh and token rotation

## Web3 Security
- Maintain flexibility for both Web3 and traditional auth
- Implement proper wallet connection strategies
- Support blockchain interactions securely
- Ensure proper transaction handling
```

#### 6. **performance-guidelines.mdc**
```markdown
---
globs: *.ts,*.tsx
description: Performance optimization standards
---
# Performance Guidelines

## Hyperscape Optimization
- Use Hyperscape abstractions where possible
- Minimize test-specific code and objects
- Optimize for 50-100 concurrent players
- Monitor memory usage (4GB+ recommended)

## Three.js Best Practices
- Leverage Hyperscape's 3D abstractions
- Use existing scene hierarchy patterns
- Optimize rendering for multiplayer scenarios
- Implement proper cleanup on unmount

## Database Performance
- SQLite handles thousands of players efficiently
- Use proper indexing for player data
- Optimize queries for real-time updates
```

#### 7. **api-standards.mdc**
```markdown
---
description: API versioning and documentation standards
---
# API Standards

## REST API Endpoints
- GET /api/state - Available state queries
- GET /api/state/player-stats?playerId=123 - Player information
- POST /api/actions/attack - Execute player actions
- GET /api/actions/available?playerId=123 - Available actions

## Documentation Requirements
- Document all API endpoints thoroughly
- Include request/response examples
- Specify required parameters and authentication
- Maintain API versioning for breaking changes

## Error Handling
- Implement comprehensive error handling
- Provide meaningful error messages
- Log errors to /logs folder for debugging
- Handle edge cases gracefully
```

#### 8. **compliance-checklist.mdc**
```markdown
---
alwaysApply: true
description: Security and compliance checklist
---
# Compliance Checklist

## Pre-Deployment Checklist
- [ ] All tests pass (no failing tests allowed)
- [ ] No `any` types in production code
- [ ] All features have comprehensive tests
- [ ] Error logs are properly handled
- [ ] API keys are in environment variables
- [ ] No hardcoded data in source code
- [ ] File dependencies are updated
- [ ] Documentation is current

## Code Review Requirements
- [ ] TypeScript strict typing enforced
- [ ] Real tests implemented (no mocks)
- [ ] Performance impact assessed
- [ ] Security implications reviewed
- [ ] Backward compatibility maintained
```

### `.cursor/workflows/` - Development Workflows

#### 1. **project-initialization.md**
- Project setup process
- Environment configuration
- Dependency installation
- Initial testing verification

#### 2. **feature-development.md**
- Feature implementation flow
- Testing requirements
- Code review process
- Deployment procedures

#### 3. **testing-workflow.md**
- Test execution procedures
- Visual testing setup
- Error log collection
- Test result validation

#### 4. **deployment-process.md**
- Production deployment steps
- Environment variable setup
- Database migration procedures
- Performance monitoring

### `.cursor/memory/` - Memory Bank

#### 1. **activeContext.md**
- Current session state and objectives
- Active blockers and issues
- Recent decisions and rationale

#### 2. **productContext.md**
- Project scope and components
- Architecture decisions
- Technology stack details

#### 3. **progress.md**
- Work status and completed tasks
- Next steps and priorities
- Timeline and milestones

#### 4. **decisionLog.md**
- Technical decisions and alternatives
- Architecture choices and rationale
- Trade-offs and considerations

## 🚀 Current Workspace Rules (Already Applied)

The following rules are currently active in the workspace:

### Always Applied Rules
1. **Development Guidelines** - Real code only, no mocks, comprehensive testing
2. **Tech Stack Rules** - Hyperscape, ElizaOS, Three.js, Playwright, SQLite
3. **TypeScript Strong Typing** - No `any` types, prefer classes over interfaces
4. **File Management** - No new files unless necessary, clean up after yourself
5. **Testing Standards** - Real gameplay testing with Playwright and visual verification

### Agent Requestable Rules
1. **elizaos** - ElizaOS AI agent integration into Hyperscape
2. **hyperscape-docs** - Hyperscape docs and Three.js engine references
3. **lore** - Game lore, world generation, and region information
4. **models** - LLM model usage (OpenAI, Anthropic, MeshyAI)
5. **no-any-quick-reference** - Quick reference for avoiding `any` and `unknown`

## 📋 Implementation Status

### ✅ Completed
- [x] Workspace-level rules defined and active
- [x] Agent requestable rules configured
- [x] Development guidelines established
- [x] Testing standards defined

### 🚧 To Be Implemented
- [ ] Create `.cursor/rules/` directory structure
- [ ] Generate all 8 required rule files (.mdc format)
- [ ] Create `.cursor/workflows/` directory and workflow files
- [ ] Create `.cursor/memory/` directory and memory bank files
- [ ] Create `adr/` directory for architectural decision records

## 🎯 Next Steps

1. **Create Directory Structure**
   ```bash
   mkdir -p .cursor/{rules,workflows,memory}
   mkdir -p adr
   ```

2. **Generate Rule Files**
   - Create all 8 `.mdc` rule files in `.cursor/rules/`
   - Ensure proper frontmatter metadata
   - Include comprehensive rule content

3. **Setup Workflows**
   - Create workflow templates in `.cursor/workflows/`
   - Define development process flows
   - Document deployment procedures

4. **Initialize Memory Bank**
   - Create memory bank files in `.cursor/memory/`
   - Document current project state
   - Track decisions and progress

## 📚 Related Documentation

- [README.md](README.md) - Main project documentation
- [LORE.md](LORE.md) - Game world and lore information
- [packages/hyperscape/README.md](packages/hyperscape/README.md) - Engine documentation
- [packages/plugin-hyperscape/README.md](packages/plugin-hyperscape/README.md) - AI agent integration
- [eslint.config.js](eslint.config.js) - Code quality configuration

---

**Note**: This document serves as a blueprint for implementing comprehensive Cursor rules. The actual rule files should be created in the specified directories with the `.mdc` extension and proper frontmatter metadata as shown in the examples above.
