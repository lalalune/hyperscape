# ElizaOS Documentation Index

Complete index of all ElizaOS documentation pages with usage mapping.

## Documentation Structure

### GETTING STARTED

#### Overview
- **URL**: https://docs.elizaos.ai/
- **Purpose**: General framework overview, capabilities, plugin ecosystem
- **Use When**: Starting new projects, understanding framework capabilities
- **Key Info**: 90+ plugins, TypeScript framework, autonomous agents

#### Installation
- **URL**: https://docs.elizaos.ai/installation
- **Purpose**: Setup instructions, prerequisites, installation steps
- **Use When**: Setting up development environment, installing ElizaOS
- **Key Info**: Package manager setup, dependencies, environment requirements

#### Quickstart
- **URL**: https://docs.elizaos.ai/quickstart
- **Purpose**: Create and run first agent in 3 minutes
- **Use When**: Creating first agent, learning basics
- **Key Info**: Three commands to live agent, basic character setup

#### What You Can Build
- **URL**: https://docs.elizaos.ai/what-you-can-build
- **Purpose**: Examples and use cases
- **Use When**: Understanding framework capabilities, planning projects
- **Key Info**: Real-world examples, use case patterns

### GUIDES

#### Customize an Agent
- **URL**: https://docs.elizaos.ai/guides/customize-an-agent
- **Purpose**: Agent personality, behavior customization
- **Use When**: Creating character files, defining agent personalities
- **Key Info**: Character configuration, personality settings

#### Add Multiple Agents
- **URL**: https://docs.elizaos.ai/guides/add-multiple-agents
- **Purpose**: Multi-agent setup and coordination
- **Use When**: Running multiple agents, agent coordination
- **Key Info**: Multi-agent patterns, coordination strategies

#### Test a Project
- **URL**: https://docs.elizaos.ai/guides/test-a-project
- **Purpose**: Testing strategies and patterns
- **Use When**: Writing tests, validating agent behavior
- **Key Info**: Testing frameworks, test patterns

#### Deploy a Project
- **URL**: https://docs.elizaos.ai/guides/deploy-a-project
- **Purpose**: Deployment strategies and production setup
- **Use When**: Deploying agents to production
- **Key Info**: Deployment options, production configuration

#### Create a Plugin
- **URL**: https://docs.elizaos.ai/guides/create-a-plugin
- **Purpose**: Step-by-step plugin creation guide
- **Use When**: Creating new plugins, implementing actions/providers/services
- **Key Info**: Plugin structure, component patterns, testing

#### Publish a Plugin
- **URL**: https://docs.elizaos.ai/guides/publish-a-plugin
- **Purpose**: Publishing plugins to registry
- **Use When**: Sharing plugins, contributing to ecosystem
- **Key Info**: Publishing process, registry requirements

#### Contribute to Core
- **URL**: https://docs.elizaos.ai/guides/contribute-to-core
- **Purpose**: Contributing to ElizaOS core framework
- **Use When**: Contributing core features, framework improvements
- **Key Info**: Contribution guidelines, core architecture

### PROJECTS

#### Overview
- **URL**: https://docs.elizaos.ai/projects/overview
- **Purpose**: Project structure, character configuration, runtime setup
- **Use When**: Setting up projects, configuring agents, understanding project lifecycle
- **Key Info**: Project structure, character files, plugin loading

#### Environment Variables
- **URL**: https://docs.elizaos.ai/projects/environment-variables
- **Purpose**: Required API keys, configuration options
- **Use When**: Setting up .env files, configuring providers, troubleshooting config
- **Key Info**: Required variables, API keys, server configuration

### AGENTS

#### Character Interface
- **URL**: https://docs.elizaos.ai/agents/character-interface
- **Purpose**: Character file structure and properties
- **Use When**: Creating character files, defining agent personalities
- **Key Info**: Character properties, personality configuration
- **Critical Content**: Character vs Agent distinction, Character interface (name, bio required; id, username, system, templates, adjectives, topics, knowledge, messageExamples, postExamples, style, plugins, settings, secrets optional), bio formats (single string vs array), system prompt configuration, templates object structure, message examples (2D array format), style configuration (all, chat, post), knowledge configuration (string facts, file references, directories), plugin management (basic and environment-based), settings and secrets management, validation and testing

#### Personality and Behavior
- **URL**: https://docs.elizaos.ai/agents/personality-and-behavior
- **Purpose**: Defining agent personalities and behaviors
- **Critical Content**: Personality design principles (consistency over complexity, purpose-driven design, cultural awareness, evolutionary potential), bio writing guidelines (professional, educational, creative agents), backstory development, conversation style (message examples strategy, style configuration patterns), behavioral traits (adjectives selection, topics and domain expertise, behavioral consistency matrix), voice and tone (formal vs informal spectrum, emotional range), response patterns (post examples by platform, dynamic response templates), personality archetypes (The Helper, The Expert, The Companion, The Analyst), knowledge integration (plugin-knowledge, knowledge organization strategies), advanced personality features (multi-persona agents, personality evolution, contextual personality shifts), testing personality consistency
- **Use When**: Customizing agent behavior, personality design
- **Key Info**: Personality patterns, behavior configuration

#### Memory and State
- **URL**: https://docs.elizaos.ai/agents/memory-and-state
- **Purpose**: Agent memory system, state management
- **Critical Content**: Memory architecture overview (creation, retrieval, composition flow), Memory interface (id, entityId, roomId, worldId, content, embedding, createdAt, metadata), Memory lifecycle (creation, storage, retrieval), Context management (context window, context selection strategies - recency-based, importance-based, hybrid approach), State composition (State interface, provider contributions), Memory types (short-term memory, long-term memory, knowledge memory), Memory operations (creating memories with metadata, retrieving memories - paginated, filtered, searching memories - semantic, hybrid), Embeddings and vectors (embedding generation with caching, vector search with cosine similarity, vector indexing), State management (State structure, state updates), Performance optimization (memory pruning - time-based, importance-based, caching strategies - multi-level, database optimization - batch operations, indexes), Advanced patterns (memory networks, temporal patterns, multi-agent memory)
- **Use When**: Implementing memory features, state persistence
- **Key Info**: Memory storage, state management patterns

#### Runtime and Lifecycle
- **URL**: https://docs.elizaos.ai/agents/runtime-and-lifecycle
- **Purpose**: Agent runtime, lifecycle management
- **Use When**: Understanding agent lifecycle, runtime management
- **Key Info**: Runtime lifecycle, initialization, shutdown

### PLUGINS

#### Architecture
- **URL**: https://docs.elizaos.ai/plugins/architecture
- **Purpose**: Plugin architecture, component structure, lifecycle
- **Use When**: Designing plugins, understanding plugin structure, component registration
- **Key Info**: Plugin interface, component types, registration order
- **Critical Content**: Plugin interface structure, initialization lifecycle, component registration order (Database → Actions → Evaluators → Providers → Models → Routes → Events → Services), plugin priority system, plugin dependencies, configuration access, conditional loading, routes, event system, database adapters

#### Components
- **URL**: https://docs.elizaos.ai/plugins/components
- **Purpose**: Plugin components (actions, providers, services, etc.)
- **Use When**: Implementing plugin components, understanding component interfaces
- **Key Info**: Component types, interfaces, patterns
- **Critical Content**: Component types overview (Actions, Providers, Evaluators, Services), Action interface (name, description, similes, examples, validate, handler), Core actions (13 bootstrap actions), Provider interface (name, description, dynamic, position, private, get), Core providers (character, time, knowledge, recentMessages, actions, facts, settings), Evaluator interface (name, description, alwaysRun, examples, validate, handler), Core evaluators (reflection, fact, goal), Service abstract class (serviceType, capabilityDescription, start, stop), Service types, Component interaction (execution flow, state composition, service access)

#### Development
- **URL**: https://docs.elizaos.ai/plugins/development
- **Purpose**: Plugin development workflow and best practices
- **Use When**: Developing plugins, following best practices
- **Key Info**: Development workflow, best practices
- **Critical Content**: Plugin scaffolding with CLI (Quick Plugin vs Full Plugin), manual plugin creation, using plugins in projects (monorepo vs outside), testing (test structure, test utilities, testing actions/providers/services/evaluators, E2E testing), development workflow (dev mode, building, publishing, version management), debugging (debug logging, VS Code config), common issues and solutions

#### Patterns
- **URL**: https://docs.elizaos.ai/plugins/patterns
- **Purpose**: Common plugin patterns and examples
- **Use When**: Implementing common patterns, learning from examples
- **Key Info**: Pattern examples, common implementations
- **Critical Content**: Action chaining, callbacks, composition, ActionResult interface, HandlerCallback, ActionContext, multi-step workflows, decision-making actions, API integration patterns, provider patterns (conditional, aggregating)

#### Webhooks and Routes
- **URL**: https://docs.elizaos.ai/plugins/webhooks-and-routes
- **Purpose**: HTTP endpoints, webhooks, routes
- **Use When**: Adding HTTP endpoints, webhook handlers
- **Key Info**: Route patterns, webhook handling

#### Database Schema
- **URL**: https://docs.elizaos.ai/plugins/database-schema
- **Purpose**: Database schema patterns for plugins
- **Use When**: Adding database support, schema design
- **Key Info**: Schema patterns, database adapters
- **Critical Content**: Shared tables (no agentId), agent-specific tables (with agentId), repository pattern, Drizzle ORM schema definitions, actions for writing data (parseKeyValueXml), providers for reading data, database access via runtime.databaseAdapter.db, transactions, complex queries, embeddings and vector search, time-series data, error handling, type safety, migration strategy

#### Migration
- **URL**: https://docs.elizaos.ai/plugins/migration
- **Purpose**: Plugin migration patterns and versioning
- **Use When**: Upgrading plugins, handling breaking changes
- **Key Info**: Migration patterns, versioning strategies

#### Reference
- **URL**: https://docs.elizaos.ai/plugins/reference
- **Purpose**: Plugin API reference
- **Use When**: Looking up API details, interface definitions
- **Key Info**: API reference, interface definitions
- **Critical Content**: Plugin interface (name, description, init, actions, providers, evaluators, services, adapter, models, events, routes, dependencies, priority, schema), Action interface (name, similes, description, examples, handler, validate, ActionResult, HandlerCallback, ActionContext), Provider interface (name, description, dynamic, position, private, get, ProviderResult), Evaluator interface (alwaysRun, description, similes, examples, handler, name, validate), Service abstract class (serviceType, capabilityDescription, start, stop), Memory interface, Content interface, State interface, Character interface, Route types, Event types (EventType enum, PluginEvents, EventHandler), IDatabaseAdapter interface, ModelType enum, ModelHandler type, Runtime interface (IAgentRuntime), Common enums (ChannelType, ServiceType), Helper functions (composePromptFromState, parseKeyValueXml, generateId, addHeader), Environment variables

### RUNTIME

#### Core
- **URL**: https://docs.elizaos.ai/runtime/core
- **Purpose**: Core runtime functionality
- **Use When**: Understanding runtime internals, core features
- **Key Info**: Runtime core, internal APIs

#### Memory & State
- **URL**: https://docs.elizaos.ai/runtime/memory-and-state
- **Purpose**: Memory system, state management
- **Use When**: Implementing memory features, state persistence
- **Key Info**: Memory APIs, state management

#### Events
- **URL**: https://docs.elizaos.ai/runtime/events
- **Purpose**: Event system, event handling
- **Use When**: Implementing event handlers, event-driven features
- **Key Info**: Event types, event handling patterns
- **Critical Content**: Event architecture (event source → emit → queue → handlers), Core event types (WORLD, ENTITY, ROOM, MESSAGE, VOICE, RUN, ACTION, EVALUATOR, MODEL, SERVICE events), Event payloads (MessagePayload, WorldPayload, EntityPayload, ActionPayload, ModelPayload), Event handler registration (plugin events object, handler implementation), Event emission (runtime.emit, service emission, action emission), Event listeners (runtime.on, runtime.once, runtime.off), Event patterns (request-response, event chaining, event aggregation), Custom events (module augmentation, custom payloads), Error handling (global error handler, safe event handlers), Performance considerations (event batching, event throttling)

#### Providers
- **URL**: https://docs.elizaos.ai/runtime/providers
- **Purpose**: Provider system, context providers
- **Use When**: Creating providers, understanding provider system
- **Key Info**: Provider interface, provider patterns
- **Critical Content**: Provider interface (name, description, dynamic, private, position, get method), Provider types (standard, dynamic, private), Built-in providers (ACTIONS, ACTION_STATE, CHARACTER, RECENT_MESSAGES, FACTS, ENTITIES, RELATIONSHIPS, etc.), State composition (composeState method signature, parameters, composition process, usage patterns), Provider registration (plugin registration, manual registration, provider position), Custom providers (creating custom providers, provider best practices, provider dependencies), State cache management (cache architecture, cache usage, cache optimization), Provider execution flow (selection, parallel execution, aggregation, caching), Performance optimization (parallel execution, timeout handling), Common issues (circular dependencies, memory leaks, debugging)

#### Model Management
- **URL**: https://docs.elizaos.ai/runtime/model-management
- **Purpose**: LLM model management, provider integration
- **Use When**: Configuring models, managing model providers
- **Key Info**: Model configuration, provider integration

#### Services
- **URL**: https://docs.elizaos.ai/runtime/services
- **Purpose**: Service system, service lifecycle
- **Use When**: Creating services, managing service lifecycle
- **Key Info**: Service interface, lifecycle patterns
- **Critical Content**: Service interface (abstract Service class, serviceType, capabilityDescription, start, stop), Service types (core service types, plugin service types via module augmentation), Service lifecycle (registration, queuing, initialization, start, running, stop, cleanup), Common service patterns (platform integration service, background task service, data service, model provider service), Service registration (plugin registration, manual registration), Service management (getting services, service communication), Error handling (graceful initialization, error recovery, graceful shutdown), Model Context Protocol (MCP) services (STDIO servers, SSE servers, MCP configuration), Best practices (service design, configuration, performance, reliability)

#### Messaging
- **URL**: https://docs.elizaos.ai/runtime/messaging
- **Purpose**: Message handling, communication patterns
- **Use When**: Implementing message handlers, communication features
- **Key Info**: Message patterns, communication APIs
- **Critical Content**: Architecture (Socket.IO not raw WebSockets, direct connection, channel-based communication, message filtering), Socket.IO events and message types (SOCKET_MESSAGE_TYPE enum - ROOM_JOINING, SEND_MESSAGE, MESSAGE, ACK, THINKING, CONTROL), Key events (messageBroadcast, messageComplete, controlMessage, connection_established), Socket.IO client implementation (connection setup, room joining CRITICAL, listening for broadcasts, sending messages), Key points (correct event name messageBroadcast not message, room joining required, exact message format), Complete message flow (client connects → joins room → sends message → server broadcasts → clients filter), Debugging steps (verify events, check room ID, CORS issues, transport issues), Socket.IO version compatibility (v4.x recommended), Common mistakes (wrong event name, not joining room, ID mismatch, missing fields, CORS blocked), Server-side implementation (SocketIOService, handleRoomJoin, handleMessage, broadcasting)

#### Sessions API
- **URL**: https://docs.elizaos.ai/runtime/sessions-api
- **Purpose**: Session management API
- **Use When**: Managing sessions, session persistence
- **Key Info**: Session APIs, session management

### REST REFERENCE

#### Agents
- **URL**: https://docs.elizaos.ai/rest-reference/agents
- **Purpose**: REST API for agent management
- **Use When**: Managing agents via API, programmatic agent creation
- **Key Info**: Agent API endpoints, request/response formats

#### Create a New Agent
- **URL**: https://docs.elizaos.ai/rest-reference/agents/create-a-new-agent
- **Purpose**: API endpoint for creating agents
- **Use When**: Creating agents programmatically, API integration
- **Key Info**: POST /api/agents, request format, response format

### CLI REFERENCE

#### CLI Commands
- **URL**: https://docs.elizaos.ai/cli-reference
- **Purpose**: Command-line interface reference
- **Use When**: Using CLI tools, automation scripts
- **Key Info**: CLI commands, command options

### PLUGIN REGISTRY

#### Registry Overview
- **URL**: https://docs.elizaos.ai/plugin-registry
- **Purpose**: Available plugins, plugin catalog
- **Use When**: Finding plugins, exploring plugin ecosystem
- **Key Info**: Plugin catalog, plugin search

#### Knowledge Plugin
- **URL**: https://docs.elizaos.ai/plugin-registry/knowledge
- **Purpose**: Knowledge & RAG system plugin
- **Use When**: Implementing document processing, RAG features
- **Key Info**: Knowledge plugin, RAG patterns

#### LLM Providers
- **URL**: https://docs.elizaos.ai/plugin-registry/llm
- **Purpose**: LLM provider plugins (OpenAI, Anthropic, etc.)
- **Use When**: Configuring model providers, LLM integration
- **Key Info**: Provider plugins, model configuration

#### OpenAI Plugin
- **URL**: https://docs.elizaos.ai/plugin-registry/llm/openai
- **Purpose**: OpenAI integration plugin
- **Use When**: Using OpenAI models, GPT integration
- **Key Info**: OpenAI configuration, API keys

#### Anthropic Plugin
- **URL**: https://docs.elizaos.ai/plugin-registry/llm/anthropic
- **Purpose**: Anthropic Claude integration plugin
- **Use When**: Using Claude models, Anthropic integration
- **Key Info**: Anthropic configuration, API keys

## File/Task to Documentation Mapping

### When Working on Actions
**Required Pages:**
1. https://docs.elizaos.ai/guides/create-a-plugin (Action patterns)
2. https://docs.elizaos.ai/plugins/architecture (Action interface)
3. https://docs.elizaos.ai/plugins/components (Action component details)

**Related Pages:**
- https://docs.elizaos.ai/plugins/patterns (Action pattern examples)
- https://docs.elizaos.ai/runtime/providers (Provider context for actions)

### When Working on Providers
**Required Pages:**
1. https://docs.elizaos.ai/guides/create-a-plugin (Provider patterns)
2. https://docs.elizaos.ai/plugins/architecture (Provider interface)
3. https://docs.elizaos.ai/runtime/providers (Provider system details)

**Related Pages:**
- https://docs.elizaos.ai/plugins/components (Provider component details)
- https://docs.elizaos.ai/plugins/patterns (Provider pattern examples)

### When Working on Services
**Required Pages:**
1. https://docs.elizaos.ai/guides/create-a-plugin (Service patterns)
2. https://docs.elizaos.ai/plugins/architecture (Service interface)
3. https://docs.elizaos.ai/runtime/services (Service lifecycle)

**Related Pages:**
- https://docs.elizaos.ai/plugins/components (Service component details)
- https://docs.elizaos.ai/agents/runtime-and-lifecycle (Agent lifecycle)

### When Working on Plugin Entry Point
**Required Pages:**
1. https://docs.elizaos.ai/plugins/architecture (Plugin interface)
2. https://docs.elizaos.ai/guides/create-a-plugin (Plugin structure)
3. https://docs.elizaos.ai/projects/overview (Project structure)

**Related Pages:**
- https://docs.elizaos.ai/plugins/components (Component registration)
- https://docs.elizaos.ai/plugins/development (Development workflow)

### When Working on Configuration
**Required Pages:**
1. https://docs.elizaos.ai/projects/environment-variables (Environment variables)
2. https://docs.elizaos.ai/plugins/architecture (Plugin configuration)
3. https://docs.elizaos.ai/guides/create-a-plugin (Configuration patterns)

**Related Pages:**
- https://docs.elizaos.ai/plugins/database-schema (Database config)
- https://docs.elizaos.ai/runtime/model-management (Model config)

### When Working on Event Handlers
**Required Pages:**
1. https://docs.elizaos.ai/runtime/events (Event system)
2. https://docs.elizaos.ai/plugins/architecture (Event handlers)
3. https://docs.elizaos.ai/guides/create-a-plugin (Event handler patterns)

**Related Pages:**
- https://docs.elizaos.ai/runtime/messaging (Message handling)
- https://docs.elizaos.ai/plugins/webhooks-and-routes (Webhook events)

### When Working on Tests
**Required Pages:**
1. https://docs.elizaos.ai/guides/test-a-project (Testing strategies)
2. https://docs.elizaos.ai/guides/create-a-plugin (Plugin testing)
3. https://docs.elizaos.ai/plugins/development (Development workflow)

**Related Pages:**
- https://docs.elizaos.ai/plugins/patterns (Test patterns)
- https://docs.elizaos.ai/guides/create-a-plugin (E2E testing)

### When Working on Deployment
**Required Pages:**
1. https://docs.elizaos.ai/guides/deploy-a-project (Deployment guide)
2. https://docs.elizaos.ai/projects/environment-variables (Production config)
3. https://docs.elizaos.ai/rest-reference/agents (API deployment)

**Related Pages:**
- https://docs.elizaos.ai/projects/overview (Project structure)
- https://docs.elizaos.ai/cli-reference (CLI deployment)

## Quick Reference by Task Type

### Creating New Features
- Start: https://docs.elizaos.ai/guides/create-a-plugin
- Reference: https://docs.elizaos.ai/plugins/architecture
- Examples: https://docs.elizaos.ai/plugins/patterns

### Understanding Framework
- Overview: https://docs.elizaos.ai/
- Architecture: https://docs.elizaos.ai/plugins/architecture
- Runtime: https://docs.elizaos.ai/runtime/core

### Troubleshooting
- Configuration: https://docs.elizaos.ai/projects/environment-variables
- Development: https://docs.elizaos.ai/plugins/development
- Migration: https://docs.elizaos.ai/plugins/migration

### Integration
- REST API: https://docs.elizaos.ai/rest-reference/agents
- CLI: https://docs.elizaos.ai/cli-reference
- Plugin Registry: https://docs.elizaos.ai/plugin-registry

