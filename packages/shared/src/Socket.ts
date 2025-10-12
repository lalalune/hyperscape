import { readPacket, writePacket } from './packets'
import type { NodeWebSocket, NetworkWithSocket, SocketOptions } from './types/network-types'

import type { Entity } from './entities/Entity'

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
      // Strong type assumption - message is always ArrayBuffer or Uint8Array
      const data = arg as ArrayBuffer | Uint8Array
      const size = data instanceof Uint8Array ? data.length : data.byteLength
      console.log('[Socket] Raw message received on socket:', this.id, 'size:', size);
      this.onMessage(data)
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
    const result = readPacket(packet)
    if (result.length === 2) {
      const [method, data] = result
      if (method === 'onChatAdded' || method === 'onCharacterListRequest' || method === 'onCharacterCreate') {
        console.log(`[Socket] Received ${method}, enqueueing for socket:`, this.id);
      }
      this.network.enqueue(this, method, data)
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
