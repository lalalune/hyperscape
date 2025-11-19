# ElizaOS Action Patterns Memory

Complete reference for action chaining, callbacks, composition, and advanced implementation patterns in ElizaOS.

## Core Concepts

### ActionResult Interface

**Required Structure:**
```typescript
interface ActionResult {
  success: boolean;        // REQUIRED - Boolean indicating completion status
  text?: string;           // Optional human-readable description
  values?: Record<string, unknown>;  // Key-value pairs merged into state for subsequent actions
  data?: Record<string, unknown>;     // Raw data payload with action-specific results
  error?: Error;          // Error information if action failed
}
```

**Key Points:**
- `success` is the ONLY required field
- `values` are merged into state for action chaining
- `data` contains raw results for programmatic access
- Always return proper ActionResult, even for simple actions

### Handler Callback

**Type Definition:**
```typescript
export type HandlerCallback = (response: Content, files?: any) => Promise<Memory[]>;
```

**Usage Pattern:**
- Send immediate feedback before action completes
- Provide user updates during long-running operations
- Handle errors with user-friendly messages
- Always use optional chaining: `await callback?.({ ... })`

**Example:**
```typescript
await callback?.({
  text: `Starting to process your request...`,
  source: message.content.source
});
```

### Action Context

**Interface:**
```typescript
interface ActionContext {
  previousResults: ActionResult[];  // Results from previously executed actions
  getPreviousResult?: (actionName: string) => ActionResult | undefined;
}
```

**Access Pattern:**
```typescript
const context = options?.context as ActionContext;
const previousResult = context?.getPreviousResult?.('ACTION_NAME');
```

**Key Points:**
- Automatically provided in `options` parameter
- Access previous action results for chaining
- Check for existence before using: `if (previousResult?.data?.key)`

## Action Execution Flow

1. **Action Planning**: Runtime creates execution plan when multiple actions detected
2. **Sequential Execution**: Actions execute in order specified by agent
3. **State Accumulation**: Each action's results merged into accumulated state
4. **Working Memory**: Results stored in working memory (most recent 50 entries)
5. **Error Handling**: Failed actions don't stop chain unless marked as critical

## Action Patterns

### 1. Decision-Making Actions

**Pattern:** Use LLM to make intelligent decisions based on context

**Key Elements:**
- Create decision prompt template
- Use `runtime.useModel(ModelType.TEXT_SMALL)` for decisions
- Return ActionResult based on decision
- Store decision in values for state

**Example Use Cases:**
- Mute room if annoying
- Determine response strategy
- Choose between options

### 2. Multi-Step Actions

**Pattern:** Actions that perform multiple steps with intermediate feedback

**Key Elements:**
- Use callbacks for each step progress
- Return structured data for each step
- Accumulate results in data object
- Handle errors at each step

**Example Use Cases:**
- Deploy contract (compile → estimate → deploy → verify)
- Process file (upload → validate → transform → store)
- Create resource (validate → create → configure → notify)

### 3. API Integration Actions

**Pattern:** External API calls with retries and error handling

**Key Elements:**
- Implement retry logic with exponential backoff
- Use callbacks for retry attempts
- Return error details on failure
- Store API response in data

**Example Use Cases:**
- External service calls
- Third-party API integration
- Network operations

### 4. Context-Aware Actions

**Pattern:** Actions that adapt based on conversation context

**Key Elements:**
- Analyze conversation sentiment/context
- Adjust behavior based on analysis
- Store context in values
- Use runtime.useModel for context analysis

**Example Use Cases:**
- Sentiment-based responses
- Context-appropriate actions
- Adaptive behavior

## Action Composition

### Compose Multiple Actions

**Pattern:** Higher-level actions that execute sub-actions

**Key Elements:**
- Call sub-action handlers directly
- Propagate failures upward
- Merge results from sub-actions
- Create composite data structure

### Workflow Orchestration

**Pattern:** Execute multiple actions in sequence with dependencies

**Key Elements:**
- Define workflow steps with required flags
- Execute sequentially
- Merge state between steps
- Handle required vs optional steps
- Return aggregated results

## Provider Patterns

### Conditional Providers

**Pattern:** Providers that only provide data under certain conditions

**Key Elements:**
- Check conditions before providing data
- Return empty data if conditions not met
- Use `private: true` flag if needed
- Handle gracefully when unavailable

### Aggregating Providers

**Pattern:** Providers that combine data from multiple sources

**Key Elements:**
- Use `position` to run after individual providers
- Fetch from multiple sources (Promise.all)
- Aggregate and format data
- Return comprehensive overview

## Best Practices

### 1. Always Return ActionResult
```typescript
return {
  success: true,
  text: "Action completed",
  data: { /* data for next actions */ }
};
```

### 2. Use Callbacks for User Feedback
```typescript
await callback?.({
  text: "Processing your request...",
  source: message.content.source
});
```

### 3. Store Identifiers in Data
```typescript
return {
  success: true,
  data: {
    resourceId: created.id,
    resourceUrl: created.url
  }
};
```

### 4. Handle Missing Dependencies
```typescript
const previousResult = context?.getPreviousResult?.('REQUIRED_ACTION');
if (!previousResult?.success) {
  return {
    success: false,
    text: "Required previous action did not complete successfully"
  };
}
```

### 5. Maintain Backward Compatibility
- Runtime handles legacy returns (void, boolean)
- New actions should use ActionResult
- Always return proper structure

## Common Workflow Patterns

1. **Create and Configure**: Create resource → Configure it
2. **Search and Update**: Find resources → Modify them
3. **Validate and Execute**: Check conditions → Perform actions
4. **Aggregate and Report**: Collect data → Summarize

## Real-World Implementation Patterns

### Basic Action Structure
```typescript
export const actionName: Action = {
  name: 'ACTION_NAME',
  similes: ['ALTERNATIVE_NAME'],
  description: 'Action description',
  
  validate: async (runtime, message, state) => {
    return true; // or validation logic
  },
  
  handler: async (runtime, message, state, options, callback) => {
    try {
      await callback?.({ text: 'Starting...' });
      // Action logic
      return {
        success: true,
        text: 'Completed',
        data: { /* results */ }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  },
  
  examples: [
    [
      { name: 'user', content: { text: 'Example' } },
      { name: 'agent', content: { text: 'Response', actions: ['ACTION_NAME'] } }
    ]
  ]
};
```

### Complex Action Pattern (Reply)
- Compose state with providers
- Generate response using LLM
- Use ModelType.OBJECT_LARGE for structured responses
- Return response content

## Working Memory Management

- Runtime maintains working memory automatically
- Stores most recent 50 entries (configurable)
- Access via `state.data.workingMemory`
- Each entry contains: actionName, result, timestamp

## Action Chaining Examples

### Multi-Step Workflow
```
User: "Create a bug report and assign it to John"
Agent executes: REPLY, CREATE_LINEAR_ISSUE, UPDATE_LINEAR_ISSUE

Action 1: CREATE_LINEAR_ISSUE
  → Returns: { success: true, data: { issueId: "abc-123" } }

Action 2: UPDATE_LINEAR_ISSUE
  → Accesses: context.getPreviousResult('CREATE_LINEAR_ISSUE')
  → Uses: previousResult.data.issueId
  → Updates: assignee to "John"
```

## Self-Modifying Actions

**Pattern:** Actions that learn and adapt behavior

**Key Elements:**
- Retrieve past performance from memory
- Analyze patterns with LLM
- Adapt behavior based on learning
- Store feedback for future learning

## Documentation References

- **Action Interface**: https://docs.elizaos.ai/plugins/reference#action-interface
- **Plugin Components**: https://docs.elizaos.ai/plugins/components
- **Plugin Architecture**: https://docs.elizaos.ai/plugins/architecture
- **Plugin Development**: https://docs.elizaos.ai/plugins/development

