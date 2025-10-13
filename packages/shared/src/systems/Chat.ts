import type { ChatMessage, World } from '../types/index';
import { uuid } from '../utils';
import { SystemBase } from './SystemBase';
import { EventType } from '../types/events';
import type { AnyEvent } from '../types/events';
import type { EventMap } from '../types/events';
import type { EventSubscription } from './EventBus';

/**
 * Chat System
 *
 * - Runs on both the server and client.
 * - Stores and handles chat messages
 * - Provides subscribe hooks for client UI
 *
 */

const CHAT_MAX_MESSAGES = 50;

export type ChatListener = (messages: ChatMessage[]) => void;

export class Chat extends SystemBase {
  msgs: ChatMessage[];
  private chatListeners: Set<ChatListener>;

  // Alias for backward compatibility with ExtendedChatMessage
  public get extendedMsgs(): ChatMessage[] {
    return this.msgs;
  }

  constructor(world: World) {
    super(world, { name: 'chat', dependencies: { required: [], optional: [] }, autoCleanup: true });
    this.msgs = [];
    this.chatListeners = new Set();
  }

  add(msg: ChatMessage, broadcast?: boolean): void {
    // add to chat messages
    this.msgs = [...this.msgs, msg];
    if (this.msgs.length > CHAT_MAX_MESSAGES) {
      this.msgs.shift();
    }
    
    // notify listeners
    Array.from(this.chatListeners).forEach(callback => {
      callback(this.msgs);
    });
    
    // trigger player chat animation if applicable
    if (msg.fromId) {
      const player = this.world.entities.players?.get(msg.fromId);
      if (player) {
        player.chat(msg.body);
      }
    }
    
    // emit chat event (typed)
    this.emitTypedEvent(EventType.CHAT_MESSAGE, {
      playerId: msg.fromId || 'system',
      text: msg.body,
    });
    
    // maybe broadcast
    if (broadcast) {
      const network = this.world.network;
      if (network?.send) {
        network.send('chatAdded', msg);
      }
    }
  }

  command(text: string): void {
    const network = this.world.network;
    if (!network || network.isServer) return;
    
    const playerId = network.id;
    const args = text
      .slice(1)
      .split(' ')
      .map(str => str.trim())
      .filter(str => !!str);
      
    const isAdminCommand = args[0] === 'admin';
    
    if (args[0] === 'stats') {
      const prefs = this.world.prefs;
      if (prefs?.setStats) {
        prefs.setStats(!prefs.stats);
      }
    }
    
    if (!isAdminCommand) {
      this.emit('command', { playerId, args });
    }
    
    if (network.send) {
      network.send('command', args);
    }
  }

  clear(broadcast?: boolean): void {
    this.msgs = [];
    
    // notify listeners
    Array.from(this.chatListeners).forEach(callback => {
      callback(this.msgs);
    });
    
    if (broadcast) {
      const network = this.world.network;
      if (network?.send) {
        network.send('chatCleared', {});
      }
    }
  }

  send(text: string): ChatMessage | undefined {
    // only available as a client
    const network = this.world.network;
    if (!network || !network.isClient) return;
    
    const player = this.world.entities.player;
    if (!player) return;
    
    const data: ChatMessage = {
      id: uuid(),
      from: player.data?.name || 'Unknown',
      fromId: player.data?.id,
      body: text,
      text: text, // for interface compatibility
      timestamp: Date.now(),
      createdAt: new Date().toISOString(),
    };
    
    this.add(data, true);
    return data;
  }

  serialize(): ChatMessage[] {
    return this.msgs;
  }

  deserialize(msgs: ChatMessage[]): void {
    this.msgs = msgs;
    
    // notify listeners
    Array.from(this.chatListeners).forEach(callback => {
      callback(msgs);
    });
  }

  // Overloads to remain compatible with SystemBase while supporting chat listeners
  subscribe(callback: ChatListener): () => void;
  subscribe<K extends keyof EventMap>(
    eventType: K,
    handler: (data: EventMap[K]) => void | Promise<void>
  ): EventSubscription;
  subscribe<T = AnyEvent>(
    eventType: string,
    handler: (data: T) => void | Promise<void>
  ): EventSubscription;
  // Implementation
  subscribe(
    arg1: ChatListener | keyof EventMap | string,
    arg2?: ((data: unknown) => void | Promise<void>)
  ): EventSubscription | (() => void) {
    if (!arg2) {
      const callback = arg1 as ChatListener;
      this.chatListeners.add(callback);
      callback(this.msgs);
      return () => {
        this.chatListeners.delete(callback);
      };
    }
    // Delegate to base typed subscribe for event bus usage
    return super.subscribe(arg1 as string, arg2 as (data: AnyEvent) => void | Promise<void>);
  }

  override destroy(): void {
    this.msgs = [];
    this.chatListeners.clear();
  }
}
