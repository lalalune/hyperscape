import { World } from './World'

import { ClientRuntime } from './systems/ClientRuntime'
import { ClientInterface } from './systems/ClientInterface'
import { ClientLoader } from './systems/ClientLoader'
import { ClientInput } from './systems/ClientInput'
import { ClientGraphics } from './systems/ClientGraphics'
import { Environment } from './systems/Environment'
// import { ClientAudio } from './systems/ClientAudio'

export { System } from './systems/System'

export function createViewerWorld() {
  const world = new World()
  world.register('client', ClientRuntime)
  world.register('prefs', ClientInterface)
  world.register('loader', ClientLoader)
  world.register('controls', ClientInput)
  world.register('graphics', ClientGraphics)
  world.register('environment', Environment)
  // world.register('audio', ClientAudio)
  return world
}
