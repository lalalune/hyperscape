/**
 * WebSocket Connection Wrapper
 * 
 * This class wraps a Node.js WebSocket connection and provides a unified interface for
 * both client and server networking. It handles binary packet encoding/decoding via msgpackr
 * and manages connection lifecycle (open, close, ping/pong heartbeat).
 * 
 * **Key Features**:
 * - Binary packet protocol using msgpackr for efficient serialization
 * - Automatic heartbeat/keepalive via ping/pong
 * - Connection state tracking (alive, closed, disconnected)
 * - Associated player entity reference for game logic
 * - Graceful error handling with fallback no-op WebSocket stub
 * 
 * **Packet Protocol**:
 * All messages are sent as binary ArrayBuffers encoded with msgpackr:
 * - Format: [packet_id, data]
 * - packet_id is an integer mapped to a method name (see packets.ts)
 * - data is arbitrary game state (positions, inventory, chat messages, etc.)
 * 
 * **Heartbeat Mechanism**:
 * - Server sends periodic pings to detect dead connections
 * - Socket marks itself as not alive on ping
 * - Pong from client marks it alive again
 * - Sockets that don't respond to pings are disconnected
 * 
 * **Connection States**:
 * - `alive`: Responded to last ping (true by default)
 * - `closed`: WebSocket connection has been closed
 * - `disconnected`: Disconnect handler has been called
 * 
 * **Referenced by**: ServerNetwork (server), ClientNetwork (client)
 */

import { readPacket, writePacket } from './packets'
import type { NodeWebSocket, NetworkWithSocket, SocketOptions } from './types/networking'

import type { Entity } from './entities/Entity'

/**
 * Socket class - wraps a WebSocket connection with game-specific functionality
 */
export class Socket {
  id: string;
  ws: NodeWebSocket;
  network: NetworkWithSocket;
  player?: Entity;
  alive: boolean;
  closed: boolean;
  disconnected: boolean;
  
  constructor({ id, ws, network, player }: SocketOptions) {
    this.id = id
    this.ws = ws
    this.network = network

    this.player = player

    this.alive = true
    this.closed = false
    this.disconnected = false

    // If ws is unexpectedly undefined, install a minimal no-op stub to prevent hard crashes
    if (!this.ws) {
      this.ws = {
        on: () => {},
        ping: () => {},
        terminate: () => {},
        send: () => {},
        close: () => {},
      } as unknown as NodeWebSocket
    }

    // Use Node.js WebSocket event handling
    this.ws.on('message', (arg?: unknown) => {
      console.log('[Socket] ========== RAW MESSAGE EVENT FIRED ==========');
      console.log('[Socket] Socket ID:', this.id);
      console.log('[Socket] Message arg type:', typeof arg, arg ? arg.constructor.name : 'null');
      
      // Strong type assumption - message is always ArrayBuffer or Uint8Array
      const data = arg as ArrayBuffer | Uint8Array
      const size = data instanceof Uint8Array ? data.length : data.byteLength
      console.log('[Socket] Data size:', size, 'bytes');
      console.log('[Socket] Data is Uint8Array:', data instanceof Uint8Array);
      console.log('[Socket] Data is ArrayBuffer:', data instanceof ArrayBuffer);
      
      this.onMessage(data)
      console.log('[Socket] ========== MESSAGE HANDLER COMPLETE ==========');
    })
    this.ws.on('pong', () => {
      this.onPong()
    })
    this.ws.on('close', (arg?: unknown) => {
      // Strong type assumption - close event has code property
      const closeEvent = arg as { code?: number | string } | undefined
      this.onClose({ code: closeEvent?.code })
    })
  }

  send<T>(name: string, data: T): void {
    const packet = writePacket(name, data)
    this.ws.send(packet)
  }

  sendPacket(packet: ArrayBuffer | Uint8Array): void {
    this.ws.send(packet)
  }

  ping(): void {
    this.alive = false
    // Use Node.js WebSocket ping method
    this.ws.ping()
  }

  // end(code) {
  //   this.send('end', code)
  //   this.disconnect()
  // }

  onPong = (): void => {
    this.alive = true
  }

  onMessage = (packet: ArrayBuffer | Uint8Array): void => {
    console.log('[Socket.onMessage] Called with packet size:', packet instanceof Uint8Array ? packet.length : packet.byteLength);
    
    const result = readPacket(packet)
    console.log('[Socket.onMessage] readPacket result:', result);
    console.log('[Socket.onMessage] result is array:', Array.isArray(result));
    console.log('[Socket.onMessage] result length:', result ? result.length : 'null/undefined');
    
    if (result && result.length === 2) {
      const [method, data] = result
      console.log(`[Socket.onMessage] Parsed method: ${method}`);
      console.log(`[Socket.onMessage] Parsed data:`, data);
      
      if (method === 'onChatAdded' || method === 'onCharacterListRequest' || method === 'onCharacterCreate') {
        console.log(`[Socket] ⭐ Received ${method}, enqueueing for socket:`, this.id);
      }
      console.log(`[Socket.onMessage] Calling network.enqueue with method: ${method}`);
      this.network.enqueue(this, method, data)
      console.log(`[Socket.onMessage] enqueue() call complete`);
    } else {
      console.error('[Socket.onMessage] ❌ readPacket failed or returned invalid result!', result);
    }
  }

  onClose = (e: { code?: number | string }): void => {
    this.closed = true
    this.disconnect(e?.code)
  }

  disconnect(code?: number | string): void {
    if (!this.closed) {
      // Use Node.js WebSocket terminate method
      this.ws.terminate()
    }
    if (this.disconnected) return
    this.disconnected = true
    this.network.onDisconnect(this, code)
  }

  close = (): void => {
    if (!this.closed) {
      this.closed = true;
      this.alive = false;
      this.ws.close();
    }
  }
}
