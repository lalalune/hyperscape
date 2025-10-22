# Changelog

[← Back to Index](../README.md)

---

## Version History

All notable changes to Plugin Hyperscape are documented here.

---

## [1.0.0] - 2025-10-22

### 🎉 Initial Release

First stable release of Plugin Hyperscape.

### Added

#### Core Features
- **ElizaOS Plugin Architecture**: Complete integration with ElizaOS framework
- **HyperscapeService**: WebSocket connection and state management
- **20+ Actions**: Complete action system for world interaction
- **3 Evaluators**: Goal-based AI with boredom and fact learning
- **10+ Providers**: Context injection for informed decision-making

#### Actions
- `perception`: Environment scanning and entity identification
- `goto`: Navigation to locations and entities
- `use`: Item usage and object interaction
- `unuse`: Stop using current item
- `stop`: Stop all movement
- `walk_randomly`: Random exploration
- `ambient`: Emotes and animations
- `build`: Place and modify world entities
- `reply`: Chat message responses
- `ignore`: Message/user filtering
- `chopTree`: Woodcutting skill action
- `catchFish`: Fishing skill action
- `lightFire`: Firemaking skill action
- `cookFood`: Cooking skill action
- `bankItems`: Banking system interaction
- `checkInventory`: Inventory inspection
- `continue`: Continue previous action

#### Evaluators
- **Goal Evaluator**: Pursue explicit goals with priorities
- **Boredom Evaluator**: Prevent agent stagnation
- **Fact Evaluator**: Learn and recall world facts

#### Providers
- **World Provider**: Nearby entities, location, environment
- **Character Provider**: Health, inventory, equipment
- **Skills Provider**: Skill levels and XP
- **Banking Provider**: Bank contents and locations
- **Actions Provider**: Available actions context
- **Emote Provider**: Available emotes
- **Boredom Provider**: Boredom level tracking
- **Facts Provider**: Learned world facts
- **Time Provider**: Time of day and duration

#### Managers
- **BehaviorManager**: Coordinate agent behaviors
- **PlaywrightManager**: Browser automation for testing
- **BuildManager**: World building operations
- **MessageManager**: Chat message handling
- **MultiAgentManager**: Multi-agent coordination
- **EmoteManager**: Emote and animation management
- **ContentPackLoader**: Load character content packs
- **DynamicActionLoader**: Load RPG actions dynamically
- **VoiceManager**: Voice chat integration

#### Testing
- **VisualTestFramework**: Visual verification with ColorDetector
- **Playwright Integration**: Real browser testing
- **State Verification**: Inventory, skills, position checks
- **Real Testing Philosophy**: No mocks, real gameplay testing

#### Frontend
- **React Dashboard**: Agent monitoring interface
- **Tailwind CSS**: Modern styling
- **Component Library**: Reusable UI components

#### Content Packs
- **Character Definitions**: Reusable character configurations
- **Behavior Presets**: Pre-configured behavior patterns
- **Content Pack System**: Shareable content bundles

### Documentation
- Complete dev-book with 70+ markdown files
- Installation and quick start guides
- Action documentation for all 20+ actions
- Testing guides and examples
- API reference documentation
- FAQ and troubleshooting
- Architecture diagrams

### Developer Experience
- TypeScript 5.3+ with strict typing (no `any` types)
- ESLint configuration for code quality
- Vitest for unit testing
- Playwright for E2E testing
- Hot reload support with `elizaos dev`

---

## [0.9.0] - 2025-10-15 (Beta)

### Added
- Beta release for early testing
- Core action system (15 actions)
- Basic evaluators (goal, boredom)
- WebSocket connection to Hyperscape
- Initial documentation

### Known Issues
- Pathfinding occasionally fails on complex terrain
- Visual testing requires manual ColorDetector setup
- Limited multi-agent support

---

## [0.8.0] - 2025-10-08 (Alpha)

### Added
- Alpha release for internal testing
- Basic action system (10 actions)
- HyperscapeService implementation
- WebSocket client

### Known Issues
- Unstable WebSocket connection
- Limited error handling
- No visual testing

---

## Upcoming Features

### [1.1.0] - Planned

#### Actions
- `attack`: Combat action for enemies
- `defend`: Defensive stance
- `trade`: Trade with NPCs
- `craft`: Crafting system integration
- `smelt`: Smelting ores to bars
- `mine`: Mining ores from rocks

#### Evaluators
- **Danger Evaluator**: Detect and respond to threats
- **Social Evaluator**: Optimize social interactions
- **Efficiency Evaluator**: Optimize resource gathering

#### Features
- **Voice Chat**: Full voice communication support
- **Quest System**: Dynamic quest generation and completion
- **Team Coordination**: Advanced multi-agent team tasks
- **Learning System**: Reinforcement learning from gameplay

#### Performance
- Action caching for faster validation
- Optimized pathfinding
- Reduced WebSocket bandwidth
- Better memory management

---

### [1.2.0] - Planned

#### Combat System
- Full combat mechanics (attack, defend, flee)
- Damage calculation
- Health and death handling
- Combat AI strategies

#### Crafting System
- Recipe system
- Crafting actions
- Resource requirements
- Skill-based success rates

#### Advanced Testing
- LLM-based test verification
- Visual regression testing
- Performance benchmarking
- Multi-agent stress testing

---

### [2.0.0] - Future

#### Breaking Changes
- New action interface with async validation
- Refactored evaluator system
- Updated provider API

#### Major Features
- Machine learning-based action selection
- Dynamic world generation
- Procedural quest generation
- Advanced NPC interactions

---

## Migration Guides

### 0.9.0 → 1.0.0

**Breaking Changes**:
- None (backward compatible)

**New Features**:
- 5 new RPG actions
- Enhanced testing framework
- Content pack system

**Migration Steps**:
```bash
# Update package
npm install @hyperscape/plugin-hyperscape@latest

# No code changes required
```

---

### Future: 1.x → 2.0.0

**Breaking Changes** (planned):
- Action interface changes
- Evaluator API refactor
- Provider context structure changes

**Migration Steps** (when released):
```typescript
// Old (1.x)
validate: async (runtime, message) => { ... }

// New (2.0)
validate: async (context: ActionContext) => { ... }
```

---

## Versioning

Plugin Hyperscape follows [Semantic Versioning](https://semver.org/):

- **Major (X.0.0)**: Breaking changes
- **Minor (1.X.0)**: New features (backward compatible)
- **Patch (1.0.X)**: Bug fixes (backward compatible)

---

## Release Process

1. **Development**: Feature branches → `develop` branch
2. **Testing**: CI/CD pipeline runs all tests
3. **Review**: Code review and approval
4. **Release**: Merge to `main` → publish to npm
5. **Documentation**: Update dev-book and CHANGELOG

---

## Support

For issues with specific versions:
- **Latest (1.0.0)**: Full support
- **Beta (0.9.0)**: Limited support
- **Alpha (0.8.0)**: No longer supported

---

## See Also

- [Installation Guide](../02-getting-started/installation.md)
- [Upgrading](../02-getting-started/installation.md#upgrading)
- [GitHub Releases](https://github.com/HyperscapeAI/hyperscape/releases)

---

[← Back to Index](../README.md)
