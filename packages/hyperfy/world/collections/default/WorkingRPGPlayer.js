// Minimal working RPG Player for testing
console.log('🎮 Working RPG Player starting...')

app.configure([
  {
    key: 'playerName',
    type: 'text',
    label: 'Player Name',
    initial: 'Hero'
  },
  {
    key: 'visualColor',
    type: 'text',
    label: 'Player Color',
    initial: 'blue'
  }
])

// Create visual representation
const playerMesh = app.create('mesh')
playerMesh.type = 'box'
playerMesh.scale.set(0.8, 1.8, 0.8)
playerMesh.position.set(0, 0.9, 0)
playerMesh.color = props.visualColor || 'blue'

app.add(playerMesh)

// Expose to window for testing
if (typeof window !== 'undefined') {
  window.workingRPGPlayer = {
    name: props.playerName,
    color: props.visualColor,
    mesh: playerMesh
  };
}

console.log('✅ Working RPG Player created successfully')