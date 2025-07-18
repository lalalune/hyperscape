import type { World } from '../../types/index.js';
import { System } from './System.js';
export interface ExtendedChatMessage {
    id: string;
    from: string;
    fromId?: string;
    body: string;
    text: string;
    timestamp: number;
    createdAt: string;
}
export type ChatListener = (messages: ExtendedChatMessage[]) => void;
export declare class Chat extends System {
  msgs: ExtendedChatMessage[];
  private chatListeners;
  constructor(world: World);
  add(msg: ExtendedChatMessage, broadcast?: boolean): void;
  command(text: string): void;
  clear(broadcast?: boolean): void;
  send(text: string): ExtendedChatMessage | undefined;
  serialize(): ExtendedChatMessage[];
  deserialize(msgs: ExtendedChatMessage[]): void;
  subscribe(callback: ChatListener): () => void;
  destroy(): void;
}
