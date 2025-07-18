import { createNodeClientWorld } from './build/world-node-client.js'

const world = createNodeClientWorld()

const wsUrl = 'ws://localhost:3000/ws'

// TODO:
// - running two of these fails the second one because they both try to use the same authToken and get kicked (one per world)

world.init({
  wsUrl,
  // name: 'Hypermon',
  // avatar: 'url to a vrm...',
})

let handle

world.once('ready', () => {
  handle = start()
})
world.on('kick', () => {
  handle?.()
  handle = null
})
world.on('disconnect', () => {
  handle?.()
  handle = null
  world.destroy()
})

function start() {
  let timerId
  let elapsed = 0
  let spoken

  const keys = ['keyW', 'keyA', 'keyS', 'keyD', 'space', 'shiftLeft']

  function next() {
    const key = keys[num(0, keys.length - 1)]
    num(0, 10) < 5 ? press(key) : release(key)
    timerId = setTimeout(next, 0.3 * 1000)
    elapsed += 0.3
    if (elapsed > 2 && !spoken) {
      world.chat.send('heyo...')
      spoken = true
    }
  }

  next()

  function press(prop) {
    console.log('press:', prop)
    world.controls.simulateButton(prop, true)
  }

  function release(prop) {
    console.log('release:', prop)
    world.controls.simulateButton(prop, false)
  }

  return () => {
    clearTimeout(timerId)
  }
}

function num(min, max, dp = 0) {
  const value = Math.random() * (max - min) + min
  return parseFloat(value.toFixed(dp))
}
