# Plugin Hyperscape Developer & User Guide

> **Complete documentation for the ElizaOS Hyperscape plugin - AI agents in 3D multiplayer worlds**

Welcome to the comprehensive documentation for Plugin Hyperscape! This guide covers everything from getting started to advanced development topics.

---

## 📖 Quick Navigation

### 🚀 Getting Started
Perfect for new users and developers:
- [Installation Guide](02-getting-started/installation.md) - Set up your development environment
- [Configuration](02-getting-started/configuration.md) - Environment variables and settings
- [Quick Start](02-getting-started/quick-start.md) - Create your first AI agent in minutes
- [ElizaOS Setup](02-getting-started/elizaos-setup.md) - Integrate with ElizaOS
- [Troubleshooting](02-getting-started/troubleshooting.md) - Common issues and solutions

### 👤 User Guides
Learn how to use each feature:
- [Using Actions](03-user-guides/using-actions.md) - How agents interact with the world
- [Creating Characters](03-user-guides/creating-characters.md) - Define agent personalities and behaviors
- [Running Agents](03-user-guides/running-agents.md) - Start and manage your AI agents
- [Goal-Based AI](03-user-guides/goal-based-ai.md) - Configure autonomous agent behaviors
- [Testing Agents](03-user-guides/testing-agents.md) - Test your agents with real gameplay

### 🏗️ Architecture
Understand the system design:
- [Plugin Overview](04-architecture/plugin-overview.md) - High-level architecture
- [ElizaOS Integration](04-architecture/elizaos-integration.md) - How the plugin integrates with ElizaOS
- [Action System](04-architecture/action-system.md) - Action architecture and flow
- [Provider System](04-architecture/provider-system.md) - Context providers for AI decisions
- [Service Architecture](04-architecture/service-architecture.md) - HyperscapeService design

### 🎮 Actions (20+ Actions)
Complete action reference:
- [perception](05-actions/perception.md) - Scan environment and identify entities
- [goto](05-actions/goto.md) - Navigate to locations and entities
- [use](05-actions/use.md) - Use items and interact with objects
- [unuse](05-actions/unuse.md) - Stop using an item
- [stop](05-actions/stop.md) - Stop current movement
- [walk_randomly](05-actions/walk_randomly.md) - Wander around the world
- [ambient](05-actions/ambient.md) - Perform idle behaviors and emotes
- [build](05-actions/build.md) - Place and modify world entities
- [reply](05-actions/reply.md) - Respond to chat messages
- [ignore](05-actions/ignore.md) - Ignore messages or users
- [chopTree](05-actions/chopTree.md) - Chop trees for wood (RPG)
- [catchFish](05-actions/catchFish.md) - Catch fish (RPG)
- [lightFire](05-actions/lightFire.md) - Start campfires (RPG)
- [cookFood](05-actions/cookFood.md) - Cook food items (RPG)
- [bankItems](05-actions/bankItems.md) - Deposit/withdraw items from bank (RPG)
- [checkInventory](05-actions/checkInventory.md) - Check inventory contents
- [continue](05-actions/continue.md) - Continue previous action
- [Actions Overview](05-actions/actions-overview.md) - All actions at a glance

### 🧠 Evaluators
Goal-based AI system:
- [Goal Evaluator](06-evaluators/goal.md) - Goal-driven agent behavior
- [Boredom Evaluator](06-evaluators/boredom.md) - Prevent agent stagnation
- [Fact Evaluator](06-evaluators/fact.md) - Learn and remember facts
- [Evaluators Overview](06-evaluators/evaluators-overview.md) - Complete evaluation system

### 🧪 Testing
Real testing methodology:
- [Visual Testing](07-testing/visual-testing.md) - ColorDetector and visual verification
- [Playwright Integration](07-testing/playwright.md) - Browser automation for testing
- [Real World Testing](07-testing/real-world-testing.md) - No mocks, real gameplay
- [Test Framework](07-testing/test-framework.md) - Modular testing architecture
- [ColorDetector](07-testing/color-detector.md) - Visual entity detection

### ⚛️ Frontend
Dashboard and monitoring:
- [Dashboard Overview](08-frontend/dashboard-overview.md) - React dashboard
- [Components](08-frontend/components.md) - UI components
- [Monitoring](08-frontend/monitoring.md) - Agent monitoring and visualization
- [Integration](08-frontend/integration.md) - Integrate dashboard with agents

### 🔧 Managers & Providers
Core systems:
- [Managers Overview](09-managers-providers/managers-overview.md) - All managers
- [Behavior Manager](09-managers-providers/behavior-manager.md) - Agent behavior coordination
- [Playwright Manager](09-managers-providers/playwright-manager.md) - Browser automation
- [Build Manager](09-managers-providers/build-manager.md) - World building capabilities
- [Message Manager](09-managers-providers/message-manager.md) - Chat message handling
- [Multi-Agent Manager](09-managers-providers/multi-agent-manager.md) - Multiple agent coordination
- [Providers Overview](09-managers-providers/providers-overview.md) - All providers
- [World Provider](09-managers-providers/world-provider.md) - World state context
- [Character Provider](09-managers-providers/character-provider.md) - Character state context

### 📦 Content Packs
Character and content systems:
- [Content Pack System](10-content-packs/content-pack-system.md) - Reusable content
- [Character Definitions](10-content-packs/character-definitions.md) - Define characters
- [Creating Content Packs](10-content-packs/creating-content-packs.md) - Build your own
- [Example Content Packs](10-content-packs/examples.md) - Sample packs

### 💻 Development
Build new features:
- [Setup Guide](11-development/setup-guide.md) - Dev environment
- [Code Standards](11-development/code-standards.md) - TypeScript conventions
- [Adding Actions](11-development/adding-actions.md) - Create new actions
- [Adding Providers](11-development/adding-providers.md) - Create new providers
- [Adding Evaluators](11-development/adding-evaluators.md) - Create new evaluators
- [Debugging](11-development/debugging.md) - Debug techniques

### 📚 API Reference
Complete API documentation:
- [Action API](12-api-reference/action-api.md) - Action interface and handlers
- [Provider API](12-api-reference/provider-api.md) - Provider interface
- [Manager API](12-api-reference/manager-api.md) - Manager interfaces
- [Service API](12-api-reference/service-api.md) - HyperscapeService API
- [Types Reference](12-api-reference/types.md) - TypeScript types

### 🧪 Testing Guide
Writing comprehensive tests:
- [Testing Philosophy](13-testing-guide/testing-philosophy.md) - Real testing approach
- [Writing Action Tests](13-testing-guide/writing-action-tests.md) - Test actions
- [Writing Visual Tests](13-testing-guide/writing-visual-tests.md) - Visual verification
- [E2E Testing](13-testing-guide/e2e-testing.md) - End-to-end tests
- [Test Utilities](13-testing-guide/test-utilities.md) - Helper functions

### 🚀 Deployment
Production deployment:
- [Building the Plugin](14-deployment/building.md) - Production builds
- [Publishing to npm](14-deployment/publishing.md) - Publish your plugin
- [CI/CD](14-deployment/cicd.md) - Continuous integration
- [Monitoring](14-deployment/monitoring.md) - Production monitoring

### 📎 Appendix
Additional resources:
- [Glossary](15-appendix/glossary.md) - Terms and concepts
- [FAQ](15-appendix/faq.md) - Common questions
- [Resources](15-appendix/resources.md) - External resources
- [Changelog](15-appendix/changelog.md) - Version history

---

## 📊 Overview

### What is Plugin Hyperscape?

Plugin Hyperscape is an **ElizaOS plugin that integrates AI agents into Hyperscape 3D multiplayer worlds**. It enables autonomous agents to join virtual worlds, navigate environments, interact with objects, chat with users, and perform actions just like human players.

### Key Features

- **🤖 Autonomous Agents**: AI agents that navigate, interact, and play autonomously
- **🎮 20+ Actions**: Complete action system for world interaction (movement, combat, crafting, etc.)
- **🧠 Goal-Based AI**: Sophisticated evaluator system for intelligent decision-making
- **🎯 Real Testing**: Visual testing with ColorDetector, Playwright integration, no mocks
- **🏗️ RPG Systems**: Full RPG integration (skills, inventory, banking, crafting)
- **💬 Natural Chat**: Agents respond to players with personality and context
- **📊 Dashboard**: React-based monitoring and control dashboard
- **📦 Content Packs**: Reusable character definitions and behaviors

### Technology Stack

- **ElizaOS**: AI agent framework (LLM integration, memory, evaluators)
- **Hyperscape**: 3D multiplayer game engine (Three.js, WebSocket)
- **TypeScript**: Strongly-typed codebase (no `any` types)
- **Playwright**: Browser automation for real-world testing
- **React**: Frontend dashboard and monitoring
- **Vitest**: Testing framework with real gameplay verification

### Architecture

```
┌─────────────────────────────────────────────────────┐
│              ElizaOS Agent Runtime                   │
│  ┌────────────┐  ┌────────────┐  ┌───────────────┐ │
│  │  Actions   │  │ Evaluators │  │   Providers   │ │
│  │ (20+ ops)  │  │ (Goal-AI)  │  │  (Context)    │ │
│  └────────────┘  └────────────┘  └───────────────┘ │
└──────────────────────┬──────────────────────────────┘
                       │ Plugin Interface
┌──────────────────────┴──────────────────────────────┐
│           HyperscapeService (Plugin)                 │
│  ┌────────────┐  ┌────────────┐  ┌───────────────┐ │
│  │  Managers  │  │   Client   │  │  RPG Systems  │ │
│  │ (Behavior) │  │ (WebSocket)│  │  (Skills)     │ │
│  └────────────┘  └────────────┘  └───────────────┘ │
└──────────────────────┬──────────────────────────────┘
                       │ WebSocket
┌──────────────────────┴──────────────────────────────┐
│           Hyperscape Game World                      │
│  3D Environment, Entities, Players, NPCs             │
└─────────────────────────────────────────────────────┘
```

---

## 🎯 Quick Start

### Prerequisites

- Node.js 18+ or Bun runtime
- ElizaOS CLI installed (`npm install -g elizaos`)
- Hyperscape server running (local or remote)

### Installation

```bash
# Navigate to your ElizaOS project
cd my-elizaos-project

# Install the plugin
npm install @hyperscape/plugin-hyperscape

# Or using bun
bun add @hyperscape/plugin-hyperscape
```

### Configure Your Agent

Create a character file `characters/my-agent.json`:

```json
{
  "name": "TestAgent",
  "bio": [
    "A friendly AI agent exploring the Hyperscape world.",
    "Loves to help players and explore new areas."
  ],
  "plugins": ["@hyperscape/plugin-hyperscape"],
  "settings": {
    "DEFAULT_HYPERSCAPE_WS_URL": "ws://localhost:5555/ws"
  }
}
```

### Run Your Agent

```bash
# Start the agent
elizaos start --character characters/my-agent.json

# Or in development mode
elizaos dev --character characters/my-agent.json
```

### What Happens Next?

1. The agent connects to the Hyperscape world
2. Uses `perception` action to scan the environment
3. Uses `goto` to navigate to interesting locations
4. Uses `reply` to respond to player messages
5. Uses goal evaluators to decide what to do next

---

## 📈 Documentation Stats

- **Total Pages**: 70+ markdown files
- **Code Examples**: 300+ examples
- **Actions Documented**: 20+
- **Evaluators Documented**: 3
- **Providers Documented**: 10+
- **Managers Documented**: 9
- **Test Examples**: 50+

---

## 🤝 Contributing

See [Development Guide](11-development/setup-guide.md) for contributing guidelines.

---

## 📝 License

Part of the Hyperscape project.

---

## 🔗 Related Documentation

- [Hyperscape Main README](../../../README.md)
- [Hyperscape Package Docs](../../hyperscape/README.md)
- [Asset Forge Docs](../../asset-forge/dev-book/README.md)
- [ElizaOS Documentation](https://elizaos.ai/docs)

---

**Last Updated**: 2025-10-22
**Version**: 1.0.0
