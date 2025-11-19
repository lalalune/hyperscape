# Agent Development Patterns Memory

Common development patterns and code snippets for Hyperscape plugin development.

## Action Development Patterns

### Basic Action Template
```typescript
import type { Action, ActionResult } from '@elizaos/core';
import type { HyperscapeService } from '../service';

export const myAction: Action = {
  name: 'MY_ACTION',
  similes: ['ALTERNATIVE_NAME', 'SIMILAR_ACTION'],
  description: 'Clear description of what this action does in Hyperscape',
  
  validate: async (runtime, message, state) => {
    const service = runtime.getService<HyperscapeService>('hyperscapeService');
    if (!service || !service.isConnected()) {
      return false;
    }
    // Additional validation logic
    return true;
  },
  
  handler: async (runtime, message, state, options, callback) => {
    try {
      const service = runtime.getService<HyperscapeService>('hyperscapeService');
      if (!service || !service.isConnected()) {
        await callback?.({
          text: 'Cannot execute action: Hyperscape service not available',
          error: true
        });
        return {
          success: false,
          error: new Error('Hyperscape service not available')
        };
      }

      // Action logic here
      const result = await performAction(service, message, state);

      // Notify user of success
      await callback?.({
        text: `Action completed: ${result.message}`,
        action: 'MY_ACTION'
      });

      return {
        success: true,
        text: result.message,
        values: { result: result.data },
        data: { actionResult: result }
      };
    } catch (error) {
      runtime.logger.error(`[MY_ACTION] Error:`, {
        error,
        messageId: message.id,
        entityId: message.entityId,
        roomId: message.roomId
      });

      await callback?.({
        text: `Failed to execute action: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: true
      });

      return {
        success: false,
        text: `Action failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  },
  
  examples: [
    [
      { name: 'user', content: { text: 'Example user message' } },
      { name: 'agent', content: { text: 'Example agent response', actions: ['MY_ACTION'] } }
    ]
  ]
};
```

### Action with State Composition
```typescript
handler: async (runtime, message, state, options, callback) => {
  // Compose state with needed providers
  const composedState = await runtime.composeState(message, ['CHARACTER', 'RECENT_MESSAGES'], true);
  
  // Use composed state
  const result = await performAction(composedState);
  
  return { success: true, text: result.message };
}
```

### Action with Callback Updates
```typescript
handler: async (runtime, message, state, options, callback) => {
  // Send immediate feedback
  await callback?.({
    text: 'Starting to process your request...',
    source: message.content.source
  });
  
  // Perform action logic
  const result = await performAction();
  
  // Send success message
  await callback?.({
    text: `Completed: ${result.message}`,
    action: 'MY_ACTION'
  });
  
  return { success: true, text: result.message };
}
```

## Provider Development Patterns

### Basic Provider Template
```typescript
import type { Provider, ProviderResult } from '@elizaos/core';
import type { HyperscapeService } from '../service';

export const myProvider: Provider = {
  name: 'MY_PROVIDER',
  description: 'What context this provider supplies',
  dynamic: true, // Set to true for real-time data
  
  get: async (runtime, message, state) => {
    try {
      const service = runtime.getService<HyperscapeService>('hyperscapeService');
      if (!service || !service.isConnected()) {
        return {
          values: {},
          data: {},
          text: ''
        };
      }

      const data = await fetchProviderData(service, message, state);

      return {
        values: { myData: data.summary },
        data: { myData: data },
        text: `Provider context: ${data.summary}`
      };
    } catch (error) {
      runtime.logger.warn(`[MY_PROVIDER] Error fetching data:`, {
        error,
        messageId: message.id
      });

      return {
        values: {},
        data: {},
        text: ''
      };
    }
  }
};
```

### Provider with Timeout
```typescript
get: async (runtime, message) => {
  const fetchData = async () => {
    const data = await externalAPI.fetch();
    return formatProviderResult(data);
  };

  return Promise.race([
    fetchData(),
    new Promise<ProviderResult>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), 5000)
    )
  ]).catch(error => {
    runtime.logger.warn(`[MY_PROVIDER] Provider timeout:`, {
      error: error.message,
      timeout: 5000
    });
    return { values: {}, data: {}, text: '' };
  });
}
```

### Provider with Cache
```typescript
get: async (runtime, message, state) => {
  // Check cache first
  const cacheKey = `provider:${message.id}`;
  const cached = runtime.cache?.get(cacheKey);
  if (cached && !isExpired(cached)) {
    return cached;
  }

  // Fetch fresh data
  const data = await fetchData();

  // Cache result
  const result = {
    values: { data },
    data: { data },
    text: `Data: ${data}`
  };
  
  runtime.cache?.set(cacheKey, result, 60000); // Cache for 1 minute
  return result;
}
```

## Service Development Patterns

### Basic Service Template
```typescript
import { Service, IAgentRuntime, logger } from '@elizaos/core';

export class MyService extends Service {
  static serviceType = 'my-service';
  capabilityDescription = 'Description of what this service provides';
  
  private client: any;
  private initialized = false;

  constructor(protected runtime: IAgentRuntime) {
    super();
  }

  static async start(runtime: IAgentRuntime): Promise<MyService> {
    logger.info(`[MyService] Starting initialization`);
    
    try {
      const service = new MyService(runtime);
      await service.initialize();
      service.initialized = true;
      
      logger.info(`[MyService] Initialized successfully`);
      return service;
    } catch (error) {
      logger.error(`[MyService] Initialization failed:`, {
        error,
        fallback: 'Service created with reduced functionality'
      });
      
      const service = new MyService(runtime);
      service.initialized = false;
      return service;
    }
  }

  async stop(): Promise<void> {
    logger.info(`[MyService] Stopping service`);
    
    try {
      await this.cleanup();
      logger.info(`[MyService] Stopped gracefully`);
    } catch (error) {
      logger.error(`[MyService] Error during stop:`, {
        error,
        action: 'Force cleanup'
      });
      this.forceCleanup();
    }
  }

  private async initialize(): Promise<void> {
    const apiKey = this.runtime.getSetting('MY_API_KEY');
    if (!apiKey) {
      logger.warn('[MyService] API key not configured');
      return;
    }

    this.client = new MyClient({ apiKey });
    await this.client.connect();
  }

  private async cleanup(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
    }
  }

  private forceCleanup(): void {
    // Force cleanup logic
  }
}
```

### Service with Connection Retry
```typescript
private async connectWithRetry(maxRetries = 3): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await this.client.connect();
      this.runtime.logger.info('[MyService] Connected successfully');
      return;
    } catch (error) {
      this.runtime.logger.error(`[MyService] Connection attempt ${i + 1} failed:`, error);

      if (i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        this.runtime.logger.error('[MyService] All connection attempts failed');
      }
    }
  }
}
```

## Error Handling Patterns

### Standard Error Handling
```typescript
try {
  // Operation
  const result = await performOperation();
  return { success: true, text: result.message };
} catch (error) {
  // Log error
  runtime.logger.error(`[Component] Error:`, {
    error,
    context: { messageId: message.id, entityId: message.entityId }
  });

  // Notify user
  await callback?.({
    text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    error: true
  });

  // Return error result
  return {
    success: false,
    error: error instanceof Error ? error : new Error(String(error))
  };
}
```

### Service Availability Check
```typescript
const service = runtime.getService<HyperscapeService>('hyperscapeService');
if (!service || !service.isConnected()) {
  await callback?.({
    text: 'Service not available',
    error: true
  });
  return {
    success: false,
    error: new Error('Service not available')
  };
}
```

## Logging Patterns

### Structured Logging
```typescript
// Error logging
runtime.logger.error(`[Component] Error message:`, {
  error,
  context: {
    messageId: message.id,
    entityId: message.entityId,
    roomId: message.roomId,
    action: 'ACTION_NAME'
  }
});

// Warning logging
runtime.logger.warn(`[Component] Warning message:`, {
  reason: 'Service not configured',
  fallback: 'Using default behavior'
});

// Info logging
runtime.logger.info(`[Component] Info message:`, {
  action: 'ACTION_NAME',
  result: 'success',
  duration: Date.now() - startTime
});

// Debug logging
runtime.logger.debug(`[Component] Debug message:`, {
  step: 'processing',
  data: sanitizedData
});
```

### Performance Logging
```typescript
const startTime = Date.now();

try {
  await performOperation();
  
  runtime.logger.info(`[Component] Operation completed:`, {
    operation: 'OPERATION_NAME',
    duration: Date.now() - startTime,
    success: true
  });
} catch (error) {
  runtime.logger.error(`[Component] Operation failed:`, {
    operation: 'OPERATION_NAME',
    duration: Date.now() - startTime,
    error
  });
}
```

## Input Validation Patterns

### Zod Schema Validation
```typescript
import { z } from 'zod';

const ActionInputSchema = z.object({
  targetId: z.string().uuid(),
  action: z.enum(['attack', 'gather', 'interact']),
  parameters: z.record(z.unknown()).optional()
});

handler: async (runtime, message, state, options, callback) => {
  try {
    const input = ActionInputSchema.parse(message.content);
    // Use validated input
  } catch (error) {
    if (error instanceof z.ZodError) {
      await callback?.({
        text: 'Invalid input: please check your request',
        error: true
      });
      return {
        success: false,
        error: new Error('Invalid input')
      };
    }
    throw error;
  }
}
```

### Type Guards
```typescript
function isValidEntityId(id: unknown): id is string {
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function isValidPosition(pos: unknown): pos is { x: number; y: number; z: number } {
  return (
    typeof pos === 'object' &&
    pos !== null &&
    'x' in pos &&
    'y' in pos &&
    'z' in pos &&
    typeof (pos as any).x === 'number' &&
    typeof (pos as any).y === 'number' &&
    typeof (pos as any).z === 'number'
  );
}
```

## State Composition Patterns

### Selective Provider Inclusion
```typescript
// Include only needed providers
const state = await runtime.composeState(message, ['CHARACTER', 'RECENT_MESSAGES'], true);

// Include dynamic providers only when needed
const state = await runtime.composeState(message, ['FACTS', 'ENTITIES']);
```

### Using Cache
```typescript
// Use cached state (default)
const state = await runtime.composeState(message);

// Force fresh data only when needed
const freshState = await runtime.composeState(message, null, false, true);
```

## Testing Patterns

### Real Gameplay Test Template
```typescript
import { test, expect } from '@playwright/test';
import { createViewerWorld } from '@hyperscape/shared';

test('my feature test', async () => {
  const world = await createViewerWorld({
    assetsDir: './assets'
  });

  // Add entities
  const player = world.createEntity('player', { position: { x: 0, y: 0, z: 0 } });
  
  // Perform action
  await performAction(player);
  
  // Verify result
  const position = player.getComponent('position');
  expect(position).toBeDefined();
  
  // Cleanup
  await world.cleanup();
});
```

### Visual Testing Pattern
```typescript
// Use colored cube proxies
const playerProxy = createCubeProxy('player', 0xff0000); // Red
const goblinProxy = createCubeProxy('goblin', 0x00ff00); // Green

// Take screenshot
const screenshot = await page.screenshot();

// Check for colored pixels
const playerPixels = findColorPixels(screenshot, 0xff0000);
expect(playerPixels.length).toBeGreaterThan(0);
```

## Common Code Snippets

### Get HyperscapeService
```typescript
const service = runtime.getService<HyperscapeService>('hyperscapeService');
if (!service || !service.isConnected()) {
  return { success: false, error: new Error('Service not available') };
}
```

### Format Provider Result
```typescript
return {
  text: `Human-readable context for LLM`,
  values: { key: 'value' }, // For template variables
  data: { raw: 'data' } // Raw data for processing
};
```

### Create ActionResult
```typescript
return {
  success: true, // REQUIRED
  text: 'Human-readable result',
  values: { key: 'value' }, // Merge into state
  data: { raw: 'data' } // Action-specific data
};
```

### Sanitize for Logging
```typescript
function sanitizeForLogging(data: any): any {
  const sanitized = { ...data };
  delete sanitized.apiKey;
  delete sanitized.password;
  delete sanitized.token;
  return sanitized;
}
```

