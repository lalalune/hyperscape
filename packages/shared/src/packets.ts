import { Packr } from 'msgpackr'
import type { PacketInfo } from './types/network-types'

const packr = new Packr({ structuredClone: true })

// prettier-ignore
const names = [
  'snapshot',
  'command',
  'chatAdded',
  'chatCleared',
  'entityAdded',
  'entityModified',
  'moveRequest',
  'entityEvent',
  'entityRemoved',
  'playerTeleport',
  'playerPush',
  'playerSessionAvatar',
  'settingsModified',
  'spawnModified',
  'kick',
  'ping',
  'pong',
  // New packets for multiplayer movement
  'input',
  'inputAck',
  'correction',
  'playerState',
  'serverStateUpdate',
  'deltaUpdate',
  'compressedUpdate',
  // Resource system packets
  'resourceSnapshot',
  'resourceSpawnPoints',
  'resourceSpawned',
  'resourceDepleted',
  'resourceRespawned',
  'resourceGather',
  'gatheringComplete',
  // Combat packets
  'attackMob',
  // Item pickup packets
  'pickupItem',
  // Inventory sync packets
  'inventoryUpdated',
  // UI feedback packets
  'showToast',
  // Character selection packets (feature-flagged usage)
  'characterListRequest',
  'characterCreate',
  'characterList',
  'characterCreated',
  'characterSelected',
  'enterWorld',
]

const byName: Record<string, PacketInfo> = {}
const byId: Record<number, PacketInfo> = {}

let ids = -1

for (const name of names) {
  const id = ++ids
  const info: PacketInfo = {
    id,
    name,
    method: `on${capitalize(name)}`, // eg 'connect' -> 'onConnect'
  }
  byName[name] = info
  byId[id] = info
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function writePacket(name: string, data: unknown): ArrayBuffer {
  const info = byName[name]
  if (!info) throw new Error(`writePacket failed: ${name} (name not found)`)
  const packet = packr.pack([info.id, data])
  // Convert Buffer/Uint8Array to ArrayBuffer
  if (packet instanceof ArrayBuffer) {
    return packet
  }
  // If it's a view (Buffer/Uint8Array), create a new ArrayBuffer and copy the data
  const arrayBuffer = new ArrayBuffer(packet.length)
  const view = new Uint8Array(arrayBuffer)
  view.set(packet)
  return arrayBuffer
}

export function readPacket(packet: ArrayBuffer | Uint8Array): [string, unknown] | [] {
  try {
    // Convert ArrayBuffer to Uint8Array if needed
    const buffer = packet instanceof ArrayBuffer ? new Uint8Array(packet) : packet
    const [id, data] = packr.unpack(buffer)
    const info = byId[id]
    if (!info) throw new Error(`readPacket failed: ${id} (id not found)`)
    return [info.method, data]
  } catch (err) {
    console.error(err)
    return []
  }
}
