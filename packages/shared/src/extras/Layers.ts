import type { LayersType } from '../types/physics'

let n = 0

const Groups: Record<string, number> = {}

const Masks: Record<string, number> = {}

export const Layers: LayersType = {}

function ensure(group: string) {
  if (Groups[group] === undefined) {
    Groups[group] = 1 << n
    Masks[group] = 0
    n++
  }
}

function add(group: string, hits: (string | null | undefined)[]) {
  ensure(group)
  for (const otherGroup of hits) {
    if (!otherGroup) continue
    ensure(otherGroup)
    Masks[group] |= Groups[otherGroup]
    // Masks[otherGroup] |= Groups[group]
  }
}

  const playerCollision = (process?.env.PUBLIC_PLAYER_COLLISION || ((globalThis as Record<string, unknown>).env as Record<string, unknown>)?.PUBLIC_PLAYER_COLLISION) === 'true'

add('camera', ['environment'])
add('player', ['environment', 'prop', playerCollision ? 'player' : null])
add('environment', ['camera', 'player', 'environment', 'prop', 'tool'])
add('prop', ['environment', 'prop'])
add('tool', ['environment', 'prop'])
// Aliases and additional layers used by interaction/pathfinding
// Map 'ground' and 'terrain' to behave like 'environment'
add('ground', ['camera', 'player', 'environment', 'prop', 'tool'])
add('terrain', ['camera', 'player', 'environment', 'prop', 'tool'])
// Basic obstacle/building layers for raycast checks
add('obstacle', ['player', 'environment'])
add('building', ['player', 'environment'])
// Internal helper ground plane used by Physics bootstrap; must not participate in queries or collisions
add('ground_helper', [])

for (const key in Groups) {
  Layers[key] = {
    group: Groups[key],
    mask: Masks[key],
  }
}

