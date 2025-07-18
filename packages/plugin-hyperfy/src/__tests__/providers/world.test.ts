import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { hyperfyProvider } from '../../providers/world';
import { createMockRuntime, createMockWorld, createMockHyperfyService } from '../test-utils';

describe('HYPERFY_WORLD_STATE Provider - Simple Tests', () => {
  let mockRuntime: any;
  let mockWorld: any;
  let mockService: any;
  let mockMessage: any;
  let mockState: any;

  beforeEach(() => {
    mock.restore();
    mockRuntime = createMockRuntime();
    mockWorld = createMockWorld();

    // Add mock message manager
    const mockMessageManager = {
      getRecentMessages: mock().mockResolvedValue({
        formattedHistory: 'No messages yet',
        lastResponseText: '',
        lastActions: [],
      }),
    };

    mockService = createMockHyperfyService();
    mockService.isConnected = mock().mockReturnValue(true);
    mockService.getWorld = mock().mockReturnValue(mockWorld);
    mockService.getMessageManager = mock().mockReturnValue(mockMessageManager);
    mockService.currentWorldId = 'test-world-123';

    mockRuntime.getService = mock().mockReturnValue(mockService);
    mockRuntime.getEntityById = mock().mockResolvedValue(null);

    mockMessage = {
      id: 'msg-123',
      entityId: 'test-entity-id',
      content: { text: 'test message' },
    };

    mockState = {
      values: {},
      data: {},
      text: '',
    };
  });

  describe('basic functionality', () => {
    it('should return formatted world state when connected', async () => {
      const result = await hyperfyProvider.get(mockRuntime, mockMessage, mockState);

      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.text).toContain('# Hyperfy World State');
      expect(result.text).toContain('## Agent Info (You)');
      expect(result.values).toBeDefined();
      expect(result.data).toBeDefined();
    });

    it('should handle disconnected state', async () => {
      mockService.isConnected.mockReturnValue(false);

      const result = await hyperfyProvider.get(mockRuntime, mockMessage, mockState);

      expect(result.text).toContain('# Hyperfy World State');
      expect(result.text).toContain('Connection Status: Disconnected');
      expect(result.values).toBeDefined();
      expect(result.values!.hyperfy_status).toBe('disconnected');
      expect(result.data).toBeDefined();
      expect(result.data!.status).toBe('disconnected');
    });

    it('should handle missing service', async () => {
      mockRuntime.getService.mockReturnValue(null);

      const result = await hyperfyProvider.get(mockRuntime, mockMessage, mockState);

      expect(result.text).toContain('# Hyperfy World State');
      expect(result.text).toContain('Connection Status: Disconnected');
      expect(result.values).toBeDefined();
      expect(result.values!.hyperfy_status).toBe('disconnected');
      expect(result.data).toBeDefined();
      expect(result.data!.status).toBe('disconnected');
    });

    it('should handle errors gracefully', async () => {
      mockService.getWorld.mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = await hyperfyProvider.get(mockRuntime, mockMessage, mockState);

      expect(result.text).toContain('# Hyperfy World State');
      expect(result.text).toContain('Status: Error retrieving state');
      expect(result.values).toBeDefined();
      expect(result.values!.hyperfy_status).toBe('error');
      expect(result.data).toBeDefined();
      expect(result.data!.status).toBe('error');
      expect(result.data!.error).toBe('Test error');
    });

    it('should include entities in world state', async () => {
      const result = await hyperfyProvider.get(mockRuntime, mockMessage, mockState);

      expect(result.text).toContain('Block Entities');
      expect(result.text).toContain('entity-1');
      expect(result.text).toContain('Sphere Entities');
      expect(result.text).toContain('entity-2');
    });

    it('should include nearby interactable objects section', async () => {
      const result = await hyperfyProvider.get(mockRuntime, mockMessage, mockState);

      expect(result.text).toContain('## Nearby Interactable Objects');
      expect(result.text).toContain('There are no interactable objects nearby');
    });

    it('should include chat history section', async () => {
      const result = await hyperfyProvider.get(mockRuntime, mockMessage, mockState);

      expect(result.text).toContain('## In-World Messages');
      expect(result.text).toContain('### Chat History');
      expect(result.text).toContain('No messages yet');
    });

    it('should include received message when present', async () => {
      mockRuntime.getEntityById.mockResolvedValue({
        names: ['TestUser'],
        metadata: {},
      });

      const result = await hyperfyProvider.get(mockRuntime, mockMessage, mockState);

      expect(result.text).toContain('### Received Message');
      expect(result.text).toContain('TestUser: test message');
      expect(result.text).toContain('### Focus your response');
    });
  });

  describe('provider metadata', () => {
    it('should have correct name', () => {
      expect(hyperfyProvider.name).toBe('HYPERFY_WORLD_STATE');
    });

    it('should have description', () => {
      expect(hyperfyProvider.description).toBeDefined();
      expect(typeof hyperfyProvider.description).toBe('string');
    });

    it('should be dynamic provider', () => {
      expect(hyperfyProvider.dynamic).toBe(true);
    });
  });
});
