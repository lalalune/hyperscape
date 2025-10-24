# Frequently Asked Questions

[← Back to Index](../README.md)

---

## General Questions

### What is Plugin Hyperscape?

Plugin Hyperscape is an ElizaOS plugin that enables AI agents to exist and interact in 3D multiplayer worlds powered by the Hyperscape game engine. It provides 20+ actions, goal-based AI, and real testing capabilities.

### Do I need to know game development to use this?

No. If you're familiar with ElizaOS and TypeScript, you can create AI agents without game development experience. The plugin handles all 3D world interaction complexity.

### What can AI agents do in Hyperscape worlds?

Agents can:
- Navigate 3D environments
- Interact with objects and entities
- Chat with players naturally
- Perform RPG actions (chop trees, fish, cook, etc.)
- Build structures
- Work autonomously toward goals
- Collaborate with other agents

---

## Setup & Installation

### What are the prerequisites?

- Node.js 18+ or Bun
- ElizaOS framework
- OpenAI or Anthropic API key
- Access to a Hyperscape server (local or remote)

### How do I install the plugin?

```bash
npm install @hyperscape/plugin-hyperscape
```

Then add it to your character configuration:
```json
{
  "plugins": ["@hyperscape/plugin-hyperscape"]
}
```

See [Installation Guide](../02-getting-started/installation.md) for details.

### Do I need to run a Hyperscape server?

Yes, agents need a Hyperscape world to connect to. You can:
1. Run a local server (for development)
2. Connect to an existing server
3. Deploy your own server

### How do I connect to a Hyperscape server?

Set the WebSocket URL in your `.env` file:
```bash
DEFAULT_HYPERSCAPE_WS_URL=ws://localhost:5555/ws
```

Or in your character settings:
```json
{
  "settings": {
    "DEFAULT_HYPERSCAPE_WS_URL": "ws://your-server:5555/ws"
  }
}
```

---

## Agent Configuration

### How do I create a new agent?

Create a character JSON file:
```json
{
  "name": "MyAgent",
  "bio": ["I am an AI agent"],
  "plugins": ["@hyperscape/plugin-hyperscape"],
  "modelProvider": "openai",
  "model": "gpt-4"
}
```

Then run:
```bash
elizaos start --character characters/myagent.json
```

### Can agents have different personalities?

Yes! Customize the `bio`, `style`, and `adjectives` fields:
```json
{
  "bio": ["I am a serious warrior"],
  "style": {
    "all": ["Be direct and focused", "Speak like a warrior"]
  },
  "adjectives": ["brave", "strong", "protective"]
}
```

### How do I give my agent goals?

Add goals to the character file:
```json
{
  "goals": [
    {
      "type": "gather",
      "target": "logs",
      "quantity": 100,
      "priority": 10
    }
  ]
}
```

### Can I disable certain actions?

Yes, you can configure which actions are available:
```json
{
  "disabledActions": ["build", "ignore"]
}
```

---

## Actions & Behavior

### How does the agent decide what to do?

The agent uses:
1. **Player messages**: "Can you chop some trees?" triggers `chopTree`
2. **Evaluators**: Goal, Boredom, Fact evaluators recommend actions
3. **LLM reasoning**: GPT-4/Claude analyzes context and decides

### What actions are available?

20+ actions including:
- Core: perception, goto, use, stop, walk_randomly
- RPG: chopTree, catchFish, lightFire, cookFood, bankItems
- Social: reply, ignore, ambient
- Building: build

See [Actions Overview](../05-actions/actions-overview.md) for complete list.

### Why isn't my agent performing actions?

Check:
1. **Validation**: Actions have prerequisites (equipment, proximity, skill level)
2. **Logs**: Run with `LOG_LEVEL=debug` to see validation failures
3. **Server connection**: Ensure agent is connected to Hyperscape world
4. **LLM**: Verify API keys are set correctly

### Can agents perform multiple actions in sequence?

Yes, agents can chain actions:
```
1. perception (scan for trees)
2. goto (navigate to tree)
3. chopTree (chop it)
4. goto (navigate to bank)
5. bankItems (deposit logs)
```

### How do I make the agent more proactive?

Configure evaluators for autonomous behavior:
```json
{
  "boredomThreshold": 15,  // Act after 15 seconds idle
  "exploreBias": 0.8,      // High exploration tendency
  "goals": [...]           // Set explicit goals
}
```

---

## Testing

### How do I test my agent?

Plugin Hyperscape uses **real testing** - no mocks:

```typescript
// Setup real test environment
const testRuntime = new TestRuntime({
  plugins: [hyperscapePlugin],
  worldUrl: 'ws://localhost:5555/ws'
});

// Execute real action
await testRuntime.executeAction('chopTree');

// Verify with visual + state testing
const result = await testFramework.runTest('chopTree', {
  type: 'both',
  visualChecks: [...],
  stateChecks: [...]
});
```

### What is visual testing?

Visual testing uses ColorDetector to verify entities exist in the 3D world by their color:
```typescript
visualChecks: [
  { entityType: 'tree', shouldExist: false }  // Tree was removed
]
```

### Do I need Playwright for testing?

Playwright is optional but recommended for:
- Screenshot capture
- Browser automation
- Visual regression testing

### How do I run tests?

```bash
# Run all tests
npm test

# Run specific test
npm test -- chopTree.test.ts

# Run with coverage
npm test -- --coverage
```

---

## Performance

### How many agents can run on one server?

Depends on hardware:
- **Single server**: 10-50 agents (consumer hardware)
- **Dedicated server**: 100-500 agents (server-grade hardware)
- **Cluster**: 1000+ agents (distributed system)

### What are the resource requirements?

Per agent:
- **RAM**: ~100-200 MB
- **CPU**: ~5-10% (active), ~1-2% (idle)
- **Network**: ~10-50 KB/s

Recommended:
- **4GB RAM** for 5-10 agents
- **8GB RAM** for 20-50 agents

### Can I run multiple agents in one process?

Yes, use the MultiAgentManager:
```typescript
const manager = new MultiAgentManager();
await manager.spawnAgents(10);
```

### How do I optimize agent performance?

1. **Use Bun**: 2-3x faster than Node.js
2. **Limit perception frequency**: Don't scan every frame
3. **Cache pathfinding**: Reuse paths when possible
4. **Use local LLMs**: Faster than API calls for simple tasks

---

## Development

### How do I add a custom action?

1. Create action file:
```typescript
export const myCustomAction: Action = {
  name: "MY_CUSTOM_ACTION",
  validate: async (runtime, message) => { ... },
  handler: async (runtime, message) => { ... }
};
```

2. Register with plugin:
```typescript
export const hyperscapePlugin: Plugin = {
  actions: [...existingActions, myCustomAction]
};
```

See [Adding Actions](../11-development/adding-actions.md).

### How do I add a custom provider?

```typescript
export const myProvider: Provider = {
  name: "my_provider",
  get: async (runtime, message) => {
    return "Context to inject into prompts";
  }
};
```

Register it in the plugin's `providers` array.

### How do I add a custom evaluator?

```typescript
export const myEvaluator: Evaluator = {
  name: "MY_EVALUATOR",
  evaluate: async (runtime, message) => {
    return {
      shouldAct: true,
      action: 'walk_randomly',
      priority: 5
    };
  }
};
```

Register it in the plugin's `evaluators` array.

### Can I use TypeScript `any` types?

No. The codebase follows strict TypeScript standards with **no `any` types**. All types must be explicitly defined.

---

## Troubleshooting

### Agent won't connect to Hyperscape server

Check:
1. **Server running**: `curl http://localhost:5555/health`
2. **WebSocket URL**: Verify `DEFAULT_HYPERSCAPE_WS_URL` in `.env`
3. **Firewall**: Ensure port 5555 is not blocked
4. **Logs**: Check agent logs for connection errors

### Actions always fail validation

Debug with:
```bash
LOG_LEVEL=debug elizaos start --character characters/agent.json
```

Common issues:
- Missing equipment (no axe for chopTree)
- Out of range (target too far away)
- Insufficient skill level
- Inventory full

### LLM not responding

Check:
1. **API key**: `echo $OPENAI_API_KEY`
2. **API quota**: Verify you haven't hit rate limits
3. **Model**: Try a different model (gpt-4 → gpt-3.5-turbo)
4. **Network**: Check internet connection

### Memory/CPU usage too high

Optimize:
1. **Reduce agent count**: Run fewer agents
2. **Lower perception frequency**: Scan less often
3. **Use simpler models**: GPT-3.5 instead of GPT-4
4. **Disable debug logging**: `LOG_LEVEL=info`

### Visual tests failing

Verify:
1. **ColorDetector initialized**: Check test setup
2. **Correct colors**: Verify entity colors match templates
3. **Timing**: Wait for entities to spawn before checking
4. **Playwright**: Ensure Playwright browsers are installed

---

## Best Practices

### What model should I use?

| Use Case | Recommended Model |
|----------|-------------------|
| Complex reasoning | GPT-4, Claude 3 Opus |
| General use | GPT-4-turbo, Claude 3 Sonnet |
| Fast/cheap | GPT-3.5-turbo, Claude 3 Haiku |
| Offline | Llama 3 (via Ollama) |

### How often should agents use perception?

- **Idle**: Every 10-30 seconds
- **Active**: Every 2-5 seconds
- **Combat**: Every 500ms - 1 second

### Should I use content packs or custom characters?

- **Content packs**: Reusable, shareable, versioned
- **Custom characters**: Unique, one-off agents

Use content packs for common archetypes (explorer, gatherer, warrior).

### How do I handle errors in actions?

Always use try-catch and provide fallback behavior:
```typescript
try {
  await service.executeAction('chopTree');
} catch (error) {
  logger.error("Action failed:", error);
  callback({ text: "I couldn't do that. Maybe I'm too far away?" });
  return false;
}
```

---

## Advanced Topics

### Can agents learn from experience?

Yes, use the Fact Evaluator:
```typescript
// Agent learns fact
facts.add('location:good_fishing_spot', { x: 100, z: 50 });

// Agent recalls fact later
const spot = facts.get('location:good_fishing_spot');
goto(spot);
```

### Can multiple agents collaborate?

Yes, use the MultiAgentManager:
```typescript
const team = await multiAgent.createTeam(['agent1', 'agent2', 'agent3']);
await team.executeTask('gather_wood', { target: 100 });
```

### Can I use local LLMs?

Yes, via Ollama or LM Studio:
```json
{
  "modelProvider": "ollama",
  "model": "llama3:latest",
  "settings": {
    "OLLAMA_URL": "http://localhost:11434"
  }
}
```

### Can agents use voice chat?

Yes, if the Hyperscape server supports it. Use the VoiceManager:
```typescript
const voiceManager = service.getVoiceManager();
await voiceManager.speak("Hello, I'm an AI agent!");
```

---

## Contributing

### How can I contribute?

1. Fork the repository
2. Create a feature branch
3. Write tests (real tests, no mocks!)
4. Submit a pull request

See [Development Guide](../11-development/setup-guide.md).

### Where do I report bugs?

GitHub Issues: https://github.com/HyperscapeAI/hyperscape/issues

### How do I request features?

Open a GitHub issue with:
- Use case description
- Expected behavior
- Example code (if applicable)

---

## See Also

- [Glossary](glossary.md) - Terms and concepts
- [Resources](resources.md) - External links
- [Troubleshooting](../02-getting-started/troubleshooting.md) - Common issues

---

[← Back to Index](../README.md)
