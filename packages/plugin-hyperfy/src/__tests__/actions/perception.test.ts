import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { hyperfyScenePerceptionAction } from '../../actions/perception';
import { createMockRuntime } from '../test-utils';
import { createMockWorld, createMockPuppeteerManager } from '../helpers/mock-world';

describe('HYPERFY_SCENE_PERCEPTION Action', () => {
  let mockRuntime: any;
  let mockWorld: any;
  let mockService: any;
  let mockPuppeteerManager: any;

  beforeEach(() => {
    mock.restore();
    mockRuntime = createMockRuntime();
    mockWorld = createMockWorld();
    mockPuppeteerManager = createMockPuppeteerManager();

    mockService = {
      isConnected: mock().mockReturnValue(true),
      getWorld: mock().mockReturnValue(mockWorld),
      getPuppeteerManager: mock().mockReturnValue(mockPuppeteerManager),
    };

    mockRuntime.getService = mock().mockReturnValue(mockService);
  });

  describe('validate', () => {
    it('should return true when all requirements are met', async () => {
      const result = await hyperfyScenePerceptionAction.validate(mockRuntime, {} as any, {} as any);

      expect(result).toBe(true);
      expect(mockService.isConnected).toHaveBeenCalled();
      expect(mockService.getWorld).toHaveBeenCalled();
    });

    it('should return false when service is not connected', async () => {
      mockService.isConnected.mockReturnValue(false);

      const result = await hyperfyScenePerceptionAction.validate(mockRuntime, {} as any, {} as any);

      expect(result).toBe(false);
    });

    it('should return false when world is null', async () => {
      mockService.getWorld.mockReturnValue(null);

      const result = await hyperfyScenePerceptionAction.validate(mockRuntime, {} as any, {} as any);

      expect(result).toBe(false);
    });

    it('should return false when service is null', async () => {
      mockRuntime.getService.mockReturnValue(null);

      const result = await hyperfyScenePerceptionAction.validate(mockRuntime, {} as any, {} as any);

      expect(result).toBe(false);
    });
  });

  describe('handler', () => {
    let mockMessage: any;
    let mockState: any;
    let mockCallback: any;

    beforeEach(() => {
      mockMessage = {
        id: 'msg-123',
        content: {
          text: 'Look around and tell me what you see',
        },
      };

      mockState = {
        values: {},
        data: {},
        text: 'test state',
      };

      mockCallback = mock();

      // Mock composeState
      mockRuntime.composeState = mock().mockResolvedValue({
        ...mockState,
        hyperfyStatus: 'Connected to world',
      });

      // Mock model responses
      mockRuntime.useModel = mock()
        .mockResolvedValueOnce(
          '<response><snapshotType>LOOK_AROUND</snapshotType><parameter></parameter></response>'
        ) // Snapshot selection
        .mockResolvedValueOnce(
          'I can see a crystal glowing in the distance and some blocks scattered around.'
        ) // Image description
        .mockResolvedValueOnce(
          '<response><thought>Observing the environment</thought><text>I can see a crystal glowing in the distance and some blocks scattered around. The lighting is soft and ambient.</text><emote>looking around</emote></response>'
        ); // Final response
    });

    it('should capture and describe a 360 view', async () => {
      await hyperfyScenePerceptionAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      );

      expect(mockPuppeteerManager.snapshotEquirectangular).toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('crystal glowing'),
          thought: expect.stringContaining('Observing'),
          emote: 'looking around',
        })
      );
    });

    it('should look in a specific direction', async () => {
      mockMessage.content.text = 'Look to your left';
      mockRuntime.useModel
        .mockReset()
        .mockResolvedValueOnce(
          '<response><snapshotType>LOOK_DIRECTION</snapshotType><parameter>left</parameter></response>'
        )
        .mockResolvedValueOnce('I see a doorway to the left')
        .mockResolvedValueOnce(
          '<response><thought>Looking left</thought><text>To my left, I can see a doorway</text></response>'
        );

      await hyperfyScenePerceptionAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      );

      expect(mockPuppeteerManager.snapshotFacingDirection).toHaveBeenCalledWith('left');
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('doorway'),
        })
      );
    });

    it('should look at a specific entity', async () => {
      mockMessage.content.text = 'Look at the crystal';
      mockRuntime.useModel
        .mockReset()
        .mockResolvedValueOnce(
          '<response><snapshotType>LOOK_AT_ENTITY</snapshotType><parameter>entity-1</parameter></response>'
        )
        .mockResolvedValueOnce('The crystal is glowing with a blue light')
        .mockResolvedValueOnce(
          '<response><thought>Examining the crystal</thought><text>The crystal is glowing with a beautiful blue light</text></response>'
        );

      await hyperfyScenePerceptionAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      );

      expect(mockWorld.controls.followEntity).toHaveBeenCalledWith('entity-1');
      expect(mockPuppeteerManager.snapshotViewToTarget).toHaveBeenCalledWith([0, 0, 0]);
    });

    it('should handle unclear requests', async () => {
      mockRuntime.useModel
        .mockReset()
        .mockResolvedValueOnce(
          '<response><snapshotType>NONE</snapshotType><parameter>Could you be more specific about what you want me to look at?</parameter></response>'
        );

      await hyperfyScenePerceptionAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      );

      expect(mockPuppeteerManager.snapshotEquirectangular).not.toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Could you be more specific about what you want me to look at?',
          thought: 'Unable to determine observation type',
        })
      );
    });

    it('should handle snapshot failures', async () => {
      mockPuppeteerManager.snapshotEquirectangular.mockRejectedValue(
        new Error('Screenshot failed')
      );

      await hyperfyScenePerceptionAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      );

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          thought: 'Snapshot failed.',
          metadata: expect.objectContaining({
            error: 'snapshot_failure',
          }),
        })
      );
    });

    it('should handle image description failures', async () => {
      mockRuntime.useModel
        .mockReset()
        .mockResolvedValueOnce(
          '<response><snapshotType>LOOK_AROUND</snapshotType><parameter></parameter></response>'
        )
        .mockRejectedValueOnce(new Error('Vision model failed'));

      await hyperfyScenePerceptionAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      );

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          thought: 'Cannot understand the scene.',
          metadata: expect.objectContaining({
            error: 'vision_failure',
          }),
        })
      );
    });

    it('should handle missing puppeteer manager', async () => {
      mockService.getPuppeteerManager.mockReturnValue(null);

      await hyperfyScenePerceptionAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      );

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Unable to capture visual. Screenshot service not available.',
        })
      );
    });

    it('should handle invalid direction parameter', async () => {
      mockRuntime.useModel
        .mockReset()
        .mockResolvedValueOnce(
          '<response><snapshotType>LOOK_DIRECTION</snapshotType><parameter>invalid-direction</parameter></response>'
        );

      await hyperfyScenePerceptionAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      );

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          thought: 'Snapshot failed.',
          metadata: expect.objectContaining({
            error: 'snapshot_failure',
          }),
        })
      );
    });

    it('should handle missing entity for LOOK_AT_ENTITY', async () => {
      mockRuntime.useModel
        .mockReset()
        .mockResolvedValueOnce(
          '<response><snapshotType>LOOK_AT_ENTITY</snapshotType><parameter>non-existent</parameter></response>'
        );

      await hyperfyScenePerceptionAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      );

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          thought: 'Snapshot failed.',
          metadata: expect.objectContaining({
            error: 'snapshot_failure',
          }),
        })
      );
    });
  });

  describe('examples', () => {
    it('should have valid examples array', () => {
      expect(hyperfyScenePerceptionAction.examples).toBeDefined();
      expect(Array.isArray(hyperfyScenePerceptionAction.examples)).toBe(true);
      expect(hyperfyScenePerceptionAction.examples!.length).toBeGreaterThan(0);
    });

    it('should have properly formatted examples', () => {
      if (!hyperfyScenePerceptionAction.examples) {
        throw new Error('Examples should be defined');
      }

      hyperfyScenePerceptionAction.examples.forEach((example: any) => {
        expect(Array.isArray(example)).toBe(true);
        expect(example.length).toBe(2);

        const [user, agent] = example;
        expect(user).toHaveProperty('name');
        expect(user).toHaveProperty('content');
        expect(user.content).toHaveProperty('text');

        expect(agent).toHaveProperty('name');
        expect(agent).toHaveProperty('content');
        expect(agent.content).toHaveProperty('text');
        expect(agent.content).toHaveProperty('actions');
        expect(agent.content.actions).toContain('HYPERFY_SCENE_PERCEPTION');
      });
    });
  });

  describe('similes', () => {
    it('should include expected similes', () => {
      expect(hyperfyScenePerceptionAction.similes).toBeDefined();
      expect(hyperfyScenePerceptionAction.similes).toContain('LOOK_AROUND');
      expect(hyperfyScenePerceptionAction.similes).toContain('OBSERVE_SURROUNDINGS');
      expect(hyperfyScenePerceptionAction.similes).toContain('LOOK_AT_SCENE');
      expect(hyperfyScenePerceptionAction.similes).toContain('CHECK_VIEW');
    });
  });
});
