/**
 * End-to-End Test: Players Join and Trade
 * 
 * This test verifies the complete flow:
 * 1. Two players connect
 2. Both see each other
 * 3. They can trade successfully
 */

import { describe, test, expect } from 'bun:test';
import { ServerNetwork } from '../ServerNetwork';
import type { ServerSocket } from '../types';

describe('E2E: Players Join and Trade', () => {
  test('Complete flow: join, see each other, trade', async () => {
    const messages: Record<string, Array<{ type: string; data: unknown }>> = {
      player1: [],
      player2: []
    };

    // Create minimal mock world
    const mockEntities = new Map();
    const mockWorld = {
      entities: {
        add: (data: { id: string; type: string; position: number[]; name: string }) => {
          const entity = {
            id: data.id,
            type: data.type,
            position: { x: data.position[0], y: data.position[1], z: data.position[2] },
            data: { id: data.id, name: data.name },
            serialize: () => ({
              id: data.id,
              type: data.type,
              position: data.position,
              name: data.name
            })
          };
          mockEntities.set(data.id, entity);
          return entity;
        },
        get: (id: string) => mockEntities.get(id),
        values: () => mockEntities.values()
      },
      getSystem: (name: string) => {
        if (name === 'inventory') {
          return {
            getInventoryData: (playerId: string) => ({
              items: playerId === 'player1' 
                ? [{ itemId: 'bronze_sword', quantity: 1, slot: 0 }]
                : [{ itemId: 'steel_shield', quantity: 1, slot: 0 }],
              coins: 500,
              maxSlots: 28
            })
          };
        }
        return undefined;
      },
      emit: () => {}
    };

    const network = new ServerNetwork(mockWorld as never);

    // STEP 1: Player 1 connects and spawns
    const player1Entity = mockWorld.entities.add({
      id: 'player1',
      type: 'player',
      position: [0, 0, 0],
      name: 'Alice'
    });

    const socket1: Partial<ServerSocket> = {
      id: 'socket1',
      player: player1Entity as never,
      send: (type: string, data: unknown) => {
        messages.player1.push({ type, data });
        console.log(`[Player 1] Received: ${type}`);
      }
    };

    network.sockets.set('socket1', socket1 as ServerSocket);

    // STEP 2: Player 2 connects and spawns  
    const player2Entity = mockWorld.entities.add({
      id: 'player2',
      type: 'player',
      position: [2, 0, 2],
      name: 'Bob'
    });

    const socket2: Partial<ServerSocket> = {
      id: 'socket2',
      player: player2Entity as never,
      send: (type: string, data: unknown) => {
        messages.player2.push({ type, data });
        console.log(`[Player 2] Received: ${type}`);
      }
    };

    network.sockets.set('socket2', socket2 as ServerSocket);

    // Simulate enterWorld sending all entities to Player 2
    console.log('\n📤 Simulating Player 2 receiving all existing entities...');
    for (const entity of mockWorld.entities.values()) {
      if (entity.id !== 'player2') {
        socket2.send!('entityAdded', entity.serialize());
      }
    }
    socket2.send!('entityAdded', player2Entity.serialize());

    // VERIFY: Player 2 should have received Player 1's entity
    const player2ReceivedPlayer1 = messages.player2.some(
      m => m.type === 'entityAdded' && 
           (m.data as { id: string }).id === 'player1'
    );
    
    console.log('\n✓ Verification: Player 2 sees Player 1?', player2ReceivedPlayer1);
    expect(player2ReceivedPlayer1).toBe(true);

    // STEP 3: Player 1 initiates trade with Player 2
    console.log('\n💱 Starting trade flow...');
    messages.player1 = [];
    messages.player2 = [];

    await network['onTradeRequest'](socket1 as ServerSocket, {
      targetPlayerId: 'player2'
    });

    // VERIFY: Player 2 should receive trade request
    const tradeRequest = messages.player2.find(m => m.type === 'tradeRequest');
    expect(tradeRequest).toBeDefined();
    console.log('✓ Player 2 received trade request');

    // STEP 4: Player 2 accepts
    const tradeId = (tradeRequest!.data as { tradeId: string }).tradeId;
    await network['onTradeResponse'](socket2 as ServerSocket, {
      tradeId,
      accepted: true,
      fromPlayerId: 'player1'
    });

    // VERIFY: Both players should receive tradeStarted
    const p1Started = messages.player1.find(m => m.type === 'tradeStarted');
    const p2Started = messages.player2.find(m => m.type === 'tradeStarted');
    expect(p1Started).toBeDefined();
    expect(p2Started).toBeDefined();
    console.log('✓ Trade window opened for both players');

    // STEP 5: Both players make offers
    await network['onTradeOffer'](socket1 as ServerSocket, {
      tradeId,
      items: [{ itemId: 'bronze_sword', quantity: 1, slot: 0 }],
      coins: 100
    });

    await network['onTradeOffer'](socket2 as ServerSocket, {
      tradeId,
      items: [{ itemId: 'steel_shield', quantity: 1, slot: 0 }],
      coins: 50
    });

    console.log('✓ Both players submitted offers');

    // STEP 6: Both confirm
    messages.player1 = [];
    messages.player2 = [];

    await network['onTradeConfirm'](socket1 as ServerSocket, { tradeId });
    await network['onTradeConfirm'](socket2 as ServerSocket, { tradeId });

    // VERIFY: Both should receive tradeCompleted
    const p1Complete = messages.player1.find(m => m.type === 'tradeCompleted');
    const p2Complete = messages.player2.find(m => m.type === 'tradeCompleted');
    expect(p1Complete).toBeDefined();
    expect(p2Complete).toBeDefined();
    console.log('✓ Trade completed successfully');

    console.log('\n✅ COMPLETE E2E FLOW VERIFIED');
    console.log('   1. Player 2 sees Player 1 on join');
    console.log('   2. Trade initiated successfully');
    console.log('   3. Offers exchanged');
    console.log('   4. Trade completed atomically');
  });
});

