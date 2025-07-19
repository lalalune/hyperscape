// Mock types for @elizaos/core until the package is available

export interface ActionResult {
  text: string
  success: boolean
  values?: Record<string, any>
  data?: Record<string, any>
}

export interface Action {
  name: string
  similes?: string[]
  description: string
  examples: ActionExample[][]
  handler: (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    options?: any,
    callback?: HandlerCallback
  ) => Promise<ActionResult>
  validate?: (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State
  ) => Promise<boolean> | boolean
}

export interface ActionExample {
  user: string
  assistant: string
  content?: {
    text: string
    action?: string
    [key: string]: any
  }
}

export type UUID = `${string}-${string}-${string}-${string}-${string}`

export interface Memory {
  id: UUID
  userId: UUID
  roomId: UUID
  agentId: UUID
  content: {
    text: string
    action?: string
    [key: string]: any
  }
  createdAt: number
  type?: string
  [key: string]: any
}

export interface State {
  [key: string]: any
}

export interface HandlerCallback {
  (response: ActionResult): void
}

export interface MessageReceivedHandlerParams {
  runtime: IAgentRuntime
  message: Memory
  callback?: HandlerCallback
  onComplete?: () => void
}

export interface IAgentRuntime extends RuntimeExtensions {
  agentId: string
  character?: Character
  actions?: Action[]
  getService<T extends Service>(service: string): T
  registerAction(action: Action): void
  on?(event: string, handler: (data: any) => void): void
  off?(event: string, handler: (data: any) => void): void
  processMemory?(memory: Memory): Promise<void>
  updateState?(updates: Partial<State>): void
  decide?(state: State): Promise<ActionResult>
  emit?(event: string, data: any): void
  addEmbeddingToMemory?(memory: Memory): Promise<void>
  createMemory?(memory: Memory | any, type?: string): Promise<void>
  getParticipantUserState?(roomId: string, agentId: string): Promise<any>
  composeState?(
    message: Memory,
    providers?: string[],
    includeRecent?: boolean
  ): Promise<State>
  getRoom?(roomId: string): Promise<any>
  useModel?(modelType: string, options: any): Promise<any>
  processActions?(
    message: Memory,
    responseMessages: any[],
    state: State,
    callback: HandlerCallback
  ): Promise<void>
  evaluate?(
    message: Memory,
    state: State,
    shouldRespond: boolean,
    callback: HandlerCallback,
    responseMessages: any[]
  ): Promise<void>
}

export interface Character {
  name: string
  bio: string
  [key: string]: any
}

export abstract class Service {
  static serviceName: string
}

export interface Content {
  text: string
  [key: string]: any
}

export interface Provider {
  get(
    runtime: IAgentRuntime,
    message: Memory,
    state?: State
  ): Promise<ProviderResult>
}

export interface ProviderResult {
  text: string
  data?: Record<string, any>
  values?: Record<string, any>
}

export const ModelType = {
  SMALL: 'small',
  MEDIUM: 'medium',
  LARGE: 'large',
  TEXT_SMALL: 'text-small',
  TEXT_LARGE: 'text-large',
  OBJECT_LARGE: 'object-large',
  IMAGE_DESCRIPTION: 'image-description',
} as const

export type ModelType = (typeof ModelType)[keyof typeof ModelType]

export function composePromptFromState(params: {
  state?: State
  template?: string
}): string {
  if (params.template && params.state) {
    return `${params.template}\n\nState: ${JSON.stringify(params.state)}`
  }
  return params.template || JSON.stringify(params.state || {})
}

export const logger = {
  info: (...args: any[]) => console.log('[INFO]', ...args),
  warn: (...args: any[]) => console.warn('[WARN]', ...args),
  error: (...args: any[]) => console.error('[ERROR]', ...args),
  debug: (...args: any[]) => console.debug('[DEBUG]', ...args),
}

export const EventType = {
  CONTENT_LOADED: 'content_loaded',
  CONTENT_UNLOADED: 'content_unloaded',
} as const

export abstract class Client {
  abstract start(): Promise<void>
  abstract stop(): Promise<void>
}

export interface Plugin {
  name: string
  description: string
  actions?: Action[]
  providers?: Provider[]
  clients?: Client[]
  config?: any
}

// Generate a mock UUID
export function generateUUID(): UUID {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  }) as UUID
}

export function createUniqueUuid(runtime?: any, messageId?: string): UUID {
  // Ignore the parameters for mock implementation
  return generateUUID()
}

export function asUUID(str: string): UUID {
  return str as UUID
}

export function parseKeyValueXml(xml: string): Record<string, any> {
  // Simple key-value parser for mock
  const result: Record<string, any> = {}
  const regex = /<(\w+)>(.*?)<\/\1>/g
  let match
  while ((match = regex.exec(xml)) !== null) {
    result[match[1]] = match[2]
  }
  return result
}

export function truncateToCompleteSentence(
  text: string,
  maxLength: number = 500
): string {
  if (text.length <= maxLength) return text

  const truncated = text.substring(0, maxLength)
  const lastSentenceEnd = Math.max(
    truncated.lastIndexOf('.'),
    truncated.lastIndexOf('!'),
    truncated.lastIndexOf('?')
  )

  if (lastSentenceEnd > 0) {
    return truncated.substring(0, lastSentenceEnd + 1)
  }

  return truncated
}

export enum ChannelType {
  CHANNEL = 'channel',
  DM = 'dm',
  GROUP = 'group',
}

export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString()
}

export function getEntityDetails(entity: any): Record<string, any> {
  return {
    id: entity?.id || 'unknown',
    type: entity?.type || 'unknown',
    position: entity?.position || { x: 0, y: 0, z: 0 },
  }
}

export function addHeader(text: string, header: string): string {
  return `# ${header}\n\n${text}`
}

export function composeActionExamples(examples: ActionExample[][]): string {
  return examples
    .map(exampleSet =>
      exampleSet
        .map(
          example => `User: ${example.user}\nAssistant: ${example.assistant}`
        )
        .join('\n')
    )
    .join('\n\n')
}

export function formatActionNames(actions: Action[]): string {
  return actions.map(action => action.name).join(', ')
}

// Additional missing exports
export const elizaLogger = logger

export interface Evaluator {
  evaluate(message: Memory, state: State): Promise<any>
}

export enum PlayerRole {
  INNOCENT = 'innocent',
  MAFIA = 'mafia',
  DETECTIVE = 'detective',
  IMPOSTOR = 'impostor',
  CREWMATE = 'crewmate',
}

export interface GameState {
  players: any[]
  phase: string
  [key: string]: any
}

export interface ITestCaseResult {
  success: boolean
  message?: string
  name?: string
  error?: Error
}

// Mock runtime extensions
export interface RuntimeExtensions {
  getEntityById?(id: string): any
  getRPGStateManager?(): any
}

export interface EventHandler {
  (event: string, data: any): void
}

export interface TestSuite {
  name: string
  tests: Array<() => Promise<void>>
}

export interface Plugin {
  name: string
  description: string
  actions?: Action[]
  providers?: Provider[]
  services?: any[]
  init?(): Promise<void>
}
