// Mock types for @elizaos/core until the package is available

export interface ActionResult {
  text: string;
  success: boolean;
  values?: Record<string, any>;
  data?: Record<string, any>;
}

export interface Action {
  name: string;
  description: string;
  examples: ActionExample[][];
  handler: (runtime: IAgentRuntime, message: Memory, state: State, callback: HandlerCallback) => Promise<ActionResult>;
  validate?: (runtime: IAgentRuntime, message: Memory, state?: State) => boolean;
}

export interface ActionExample {
  user: string;
  assistant: string;
}

export type UUID = `${string}-${string}-${string}-${string}-${string}`;

export interface Memory {
  id: UUID;
  userId: UUID;
  roomId: UUID;
  agentId: UUID;
  content: {
    text: string;
    action?: string;
    [key: string]: any;
  };
  createdAt: number;
  type?: string;
  [key: string]: any;
}

export interface State {
  [key: string]: any;
}

export interface HandlerCallback {
  (response: ActionResult): void;
}

export interface IAgentRuntime {
  agentId: string;
  character?: Character;
  getService<T extends Service>(service: string): T;
  registerAction(action: Action): void;
  on?(event: string, handler: (data: any) => void): void;
  off?(event: string, handler: (data: any) => void): void;
  processMemory?(memory: Memory): Promise<void>;
  updateState?(updates: Partial<State>): void;
  decide?(state: State): Promise<ActionResult>;
  emit?(event: string, data: any): void;
}

export interface Character {
  name: string;
  bio: string;
  [key: string]: any;
}

export abstract class Service {
  static serviceName: string;
}

export interface Content {
  text: string;
  [key: string]: any;
}

export interface Provider {
  get(runtime: IAgentRuntime, message: Memory, state?: State): Promise<ProviderResult>;
}

export interface ProviderResult {
  text: string;
  data?: Record<string, any>;
}

export const ModelType = {
  SMALL: 'small',
  MEDIUM: 'medium',
  LARGE: 'large',
} as const;

export type ModelType = typeof ModelType[keyof typeof ModelType];

export function composePromptFromState(state: State): string {
  return JSON.stringify(state);
}

export const logger = {
  info: (...args: any[]) => console.log('[INFO]', ...args),
  warn: (...args: any[]) => console.warn('[WARN]', ...args),
  error: (...args: any[]) => console.error('[ERROR]', ...args),
  debug: (...args: any[]) => console.debug('[DEBUG]', ...args),
};

export const EventType = {
  CONTENT_LOADED: 'content_loaded',
  CONTENT_UNLOADED: 'content_unloaded',
} as const;

export abstract class Client {
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
}

export interface Plugin {
  name: string;
  description: string;
  actions?: Action[];
  providers?: Provider[];
  clients?: Client[];
  config?: any;
}

// Generate a mock UUID
export function generateUUID(): UUID {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  }) as UUID;
} 