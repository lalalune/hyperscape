import {
  type IAgentRuntime,
  type Memory,
  type Provider,
  type State,
} from '@elizaos/core'
import { HyperscapeService } from '../../service'

export const firemakingSkillProvider: Provider = {
  name: 'FIREMAKING_INFO',
  description: 'Provides firemaking skill level, nearby fires, tinderbox and log availability',
  dynamic: true, // Only loaded when explicitly requested by firemaking actions
  position: 2, // Contextual skills come after world state, before actions
  get: async (runtime: IAgentRuntime, _message: Memory, _state: State) => {
    const service = runtime.getService<HyperscapeService>(HyperscapeService.serviceName)

    if (!service || !service.isConnected()) {
      return {
        text: '# Firemaking Skill\nStatus: Not connected to world',
        values: {
          firemaking_available: false,
        },
        data: {},
      }
    }

    const world = service.getWorld()
    const player = world?.entities?.player
    const playerData = player?.data as {
      skills?: Record<string, {level: number, xp: number}>,
      inventory?: { items?: Array<{ itemId: string, quantity: number }> }
    } | undefined

    // Get firemaking skill info
    const firemakingSkill = playerData?.skills?.firemaking
    const firemakingLevel = firemakingSkill?.level ?? 1
    const firemakingXP = firemakingSkill?.xp ?? 0

    // Check for tinderbox and logs in inventory
    const inventory = playerData?.inventory?.items || []
    const hasTinderbox = inventory.some(item =>
      item.itemId?.includes('tinderbox')
    )
    const hasLogs = inventory.some(item =>
      item.itemId?.includes('logs')
    )
    const logCount = inventory.find(item =>
      item.itemId?.includes('logs')
    )?.quantity || 0

    // Find nearby fires (these would be interactive fire entities)
    const entities = world?.entities?.items
    const playerPos = player?.position
    const nearbyFires: Array<{ id: string, name: string, distance: number }> = []

    if (entities && playerPos) {
      for (const [id, entity] of entities.entries()) {
        const entityType = entity?.type as string
        const entityName = entity?.name || 'Unnamed'

        if (entityType?.includes('fire') || entityName?.toLowerCase().includes('fire')) {
          const entityPos = entity?.position
          if (entityPos) {
            const dx = entityPos.x - playerPos.x
            const dz = entityPos.z - playerPos.z
            const distance = Math.sqrt(dx * dx + dz * dz)

            if (distance <= 15) {
              nearbyFires.push({ id, name: entityName, distance })
            }
          }
        }
      }
    }

    const fireList = nearbyFires.map(fire =>
      `- ${fire.name} (${fire.distance.toFixed(1)}m away)`
    ).join('\n')

    const text = `# Firemaking Skill

## Current Status
- Level: ${firemakingLevel}
- XP: ${firemakingXP}
- Has Tinderbox: ${hasTinderbox ? 'Yes' : 'No'}
- Has Logs: ${hasLogs ? `Yes (${logCount})` : 'No'}

## Nearby Fires (${nearbyFires.length})
${nearbyFires.length > 0 ? fireList : 'No fires nearby'}

## Firemaking Tips
- Use LIGHT_FIRE action when you have logs and tinderbox
- Fires are needed for cooking
- Higher level logs give more XP
- Chop trees to get logs`

    return {
      text,
      values: {
        firemaking_level: firemakingLevel,
        firemaking_xp: firemakingXP,
        has_tinderbox: hasTinderbox,
        has_logs: hasLogs,
        log_count: logCount,
        nearby_fires_count: nearbyFires.length,
        firemaking_available: hasTinderbox && hasLogs,
      },
      data: {
        skill: firemakingSkill,
        nearbyFires,
      },
    }
  },
}
